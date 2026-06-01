'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { logScanAttempts, type LogEntry } from '@/lib/actions/logs';
import { verifyAccount } from '@/lib/actions/verify';

type Account = {
  id: string;
  displayName: string;
  fcuNid: string;
  fcuPassword: string;
};

type ResultStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'verifying'
  | 'verified'
  | 'unverified';
type Result = {
  id: string;
  status: ResultStatus;
  error?: string;
  verifyMessage?: string;
};
type Phase = 'preflight' | 'scan' | 'processing' | 'done';
type Facing = 'environment' | 'user';

const QR_ENDPOINT = 'https://signin.fcu.edu.tw/clockIn/ClassClockinQR.aspx';

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 55%)`;
}

export function ClassClockinClient({ accounts }: { accounts: Account[] }) {
  const [phase, setPhase] = useState<Phase>('preflight');
  const [results, setResults] = useState<Result[]>([]);
  const [facing, setFacing] = useState<Facing>('environment');
  const [error, setError] = useState<string | null>(null);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [manualValue, setManualValue] = useState('');
  const [manualOpen, setManualOpen] = useState(false);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
      } catch {
        /* ignore */
      }
      try {
        await s.clear();
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Manual fallback: user pastes the QR contents they decoded with the
  // phone's native camera (which handles screen glare far better).
  const submitManual = () => {
    const v = manualValue.trim();
    if (!v || handledRef.current) return;
    handledRef.current = true;
    setScannedToken(v);
  };

  // Photo fallback: decode a still photo instead of the live stream. A
  // high-res still off a monitor decodes much more reliably than live video.
  const scanPhoto = async (file: File) => {
    if (handledRef.current) return;
    setError(null);
    await stopScanner();
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const tmp = new Html5Qrcode('qr-file-reader');
      const decoded = await tmp.scanFile(file, false);
      try {
        await tmp.clear();
      } catch {
        /* ignore */
      }
      handledRef.current = true;
      setScannedToken(decoded);
    } catch {
      setError('照片裡找不到 QR，可以再拍清楚一點，或直接貼上掃到的內容。');
      setPhase('preflight');
    }
  };

  const postToFcu = useCallback(
    async (token: string) => {
      setPhase('processing');
      setResults(accounts.map<Result>((a) => ({ id: a.id, status: 'pending' })));

      const finalResults = await Promise.allSettled(
        accounts.map(async (acc) => {
          try {
            const body = new URLSearchParams({
              username: acc.fcuNid,
              password: acc.fcuPassword,
              token,
            });
            await fetch(QR_ENDPOINT, {
              method: 'POST',
              mode: 'no-cors',
              body,
            });
            setResults((prev) =>
              prev.map((r) => (r.id === acc.id ? { ...r, status: 'sent' } : r)),
            );
            return { ok: true as const, acc };
          } catch (e) {
            const msg = (e as Error).message;
            setResults((prev) =>
              prev.map((r) =>
                r.id === acc.id ? { ...r, status: 'failed', error: msg } : r,
              ),
            );
            return { ok: false as const, acc, error: msg };
          }
        }),
      );

      const logEntries: LogEntry[] = finalResults.flatMap((r) => {
        if (r.status !== 'fulfilled') return [];
        const v = r.value;
        return [
          {
            accountId: v.acc.id,
            displayName: v.acc.displayName,
            fcuNid: v.acc.fcuNid,
            status: v.ok ? 'sent' : 'failed',
            errorMessage: v.ok ? undefined : v.error,
          },
        ];
      });
      let logIdMap: Record<string, string> = {};
      try {
        logIdMap = await logScanAttempts(token, logEntries);
      } catch (e) {
        setError(`寫入紀錄失敗：${(e as Error).message}`);
      }

      // Kick off server-side verification for each sent account in parallel.
      const sentEntries = logEntries.filter((e) => e.status === 'sent');
      if (sentEntries.length > 0) {
        setResults((prev) =>
          prev.map((r) =>
            sentEntries.some((e) => e.accountId === r.id)
              ? { ...r, status: 'verifying' }
              : r,
          ),
        );

        await Promise.allSettled(
          sentEntries.map(async (entry) => {
            try {
              const v = await verifyAccount(
                entry.accountId,
                logIdMap[entry.accountId] ?? null,
              );
              setResults((prev) =>
                prev.map((r) =>
                  r.id === entry.accountId
                    ? {
                        ...r,
                        status: v.verified ? 'verified' : 'unverified',
                        verifyMessage: v.message,
                      }
                    : r,
                ),
              );
            } catch (e) {
              setResults((prev) =>
                prev.map((r) =>
                  r.id === entry.accountId
                    ? {
                        ...r,
                        status: 'unverified',
                        verifyMessage: (e as Error).message,
                      }
                    : r,
                ),
              );
            }
          }),
        );
      }

      setPhase('done');
    },
    [accounts],
  );

  // When scannedToken is set, stop scanner then post.
  useEffect(() => {
    if (!scannedToken) return;
    void (async () => {
      await stopScanner();
      try {
        await postToFcu(scannedToken);
      } catch (e) {
        setError(`POST failed: ${(e as Error).message}`);
        setPhase('done');
      }
    })();
  }, [scannedToken, postToFcu, stopScanner]);

  // Start scanner whenever phase === 'scan' (and on facing change while scanning).
  useEffect(() => {
    if (phase !== 'scan') return;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: facing },
          {
            fps: 10,
            // Size the scan box to ~90% of the viewfinder so a large
            // screen-sized QR (whose finder patterns would fall outside a
            // small fixed box) is fully inside the decode region.
            qrbox: (vw: number, vh: number) => {
              const size = Math.floor(Math.min(vw, vh) * 0.9);
              return { width: size, height: size };
            },
          },
          (decoded) => {
            if (handledRef.current) return;
            handledRef.current = true;
            setScannedToken(decoded);
          },
          () => {},
        );
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error
              ? e.message
              : typeof e === 'string'
                ? e
                : '無法開啟相機';
          setError(msg);
          setPhase('preflight');
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .then(() => {
            try {
              s.clear();
            } catch {
              /* ignore */
            }
          })
          .catch(() => {});
      }
    };
  }, [phase, facing]);

  const startCamera = () => {
    setError(null);
    handledRef.current = false;
    setScannedToken(null);
    setPhase('scan');
  };

  const switchCamera = () => {
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  };

  const rescan = () => {
    handledRef.current = false;
    setScannedToken(null);
    setResults([]);
    setError(null);
    setManualValue('');
    setManualOpen(false);
    setPhase('preflight');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">掃 QR 打卡</h1>
        <Link href="/" className="text-sm text-zinc-600 underline">
          取消
        </Link>
      </header>

      <p className="mt-2 text-sm text-zinc-500">
        對準老師螢幕的 QR，自動為 {accounts.length} 個帳號送出打卡。
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Scanner div is always mounted; only visible during scan phase. */}
      <div className={phase === 'scan' ? 'mt-4' : 'hidden'}>
        <div
          id="qr-reader"
          className="overflow-hidden rounded-2xl bg-black"
        />
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={switchCamera}
            className="rounded-full bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm hover:bg-zinc-100"
          >
            🔄 切換鏡頭（目前 {facing === 'environment' ? '後' : '前'} 鏡頭）
          </button>
        </div>
      </div>

      {/* Hidden element used by scanFile() for the photo fallback. */}
      <div id="qr-file-reader" className="hidden" />

      {/* Fallbacks for when live scanning off a screen won't lock on. */}
      {(phase === 'preflight' || phase === 'scan') && (
        <div className="mt-4 space-y-2">
          <label className="block w-full cursor-pointer rounded-2xl border border-zinc-300 bg-white py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            📸 改用拍照辨識
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void scanPhoto(f);
              }}
            />
          </label>

          {!manualOpen ? (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="w-full text-center text-xs text-zinc-400 underline"
            >
              掃不到？手動貼上 QR 內容
            </button>
          ) : (
            <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3">
              <textarea
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                rows={3}
                placeholder="用手機相機掃 QR 後，貼上掃到的文字…"
                className="w-full resize-none rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-xs"
              />
              <button
                type="button"
                onClick={submitManual}
                disabled={!manualValue.trim()}
                className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                送出打卡
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'preflight' && (
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl border-2 border-dashed border-zinc-300 p-12 text-center text-zinc-500">
            📷
            <div className="mt-2 text-sm">需要使用相機</div>
          </div>
          <button
            type="button"
            onClick={startCamera}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-lg font-semibold text-white shadow-sm hover:bg-emerald-600"
          >
            啟用相機
          </button>
        </div>
      )}

      {phase !== 'preflight' && phase !== 'scan' && (
        <>
          {scannedToken && (
            <div className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-xs">
              <span className="text-zinc-500">QR：</span>
              <span className="ml-2 font-mono break-all">
                {scannedToken.length > 60 ? `${scannedToken.slice(0, 60)}…` : scannedToken}
              </span>
            </div>
          )}
          <ul className="mt-4 space-y-2">
            {accounts.map((acc) => {
              const r = results.find((x) => x.id === acc.id);
              const status = r?.status ?? 'waiting';
              const detail = r?.verifyMessage ?? r?.error;
              return (
                <li
                  key={acc.id}
                  className="rounded-xl bg-white px-3 py-2 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: avatarColor(acc.id) }}
                    >
                      {acc.displayName.slice(0, 1)}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{acc.displayName}</div>
                      <div className="font-mono text-[10px] text-zinc-400">{acc.fcuNid}</div>
                    </div>
                    <StatusBadge status={status as ResultStatus | 'waiting'} />
                  </div>
                  {detail && (status === 'unverified' || status === 'failed') && (
                    <div className="mt-1 break-words pl-13 text-[11px] text-zinc-500">
                      {detail}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {phase === 'done' && (
        <div className="mt-6 space-y-3">
          {results.some((r) => r.status === 'unverified' || r.status === 'failed') && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠️ 有未確認 / 失敗的帳號。可以到 <Link href="/logs" className="underline">📋 紀錄</Link> 看詳細，或開 FCU app 自己確認。
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={rescan}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium"
            >
              再掃一次
            </button>
            <Link
              href="/"
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-center font-medium text-white"
            >
              回首頁
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: ResultStatus | 'waiting' }) {
  const map: Record<ResultStatus | 'waiting', { bg: string; text: string; label: string }> = {
    waiting: { bg: 'bg-zinc-100', text: 'text-zinc-500', label: '等待' },
    pending: { bg: 'bg-blue-100', text: 'text-blue-700', label: '傳送中' },
    sent: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '已送出' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', label: '失敗' },
    verifying: { bg: 'bg-blue-100', text: 'text-blue-700', label: '驗證中…' },
    verified: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '✓ 已記錄' },
    unverified: { bg: 'bg-amber-100', text: 'text-amber-700', label: '⚠️ 未確認' },
  };
  const s = map[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
