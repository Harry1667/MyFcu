'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Account = {
  id: string;
  displayName: string;
  fcuNid: string;
  fcuPassword: string;
};

type ResultStatus = 'pending' | 'sent' | 'failed';
type Result = { id: string; status: ResultStatus; error?: string };
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

  const postToFcu = useCallback(
    async (token: string) => {
      setPhase('processing');
      setResults(accounts.map<Result>((a) => ({ id: a.id, status: 'pending' })));

      await Promise.allSettled(
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
          } catch (e) {
            setResults((prev) =>
              prev.map((r) =>
                r.id === acc.id
                  ? { ...r, status: 'failed', error: (e as Error).message }
                  : r,
              ),
            );
          }
        }),
      );
      setPhase('done');
    },
    [accounts],
  );

  // When scannedToken is set, stop scanner then post.
  useEffect(() => {
    if (!scannedToken) return;
    void (async () => {
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
      try {
        await postToFcu(scannedToken);
      } catch (e) {
        setError(`POST failed: ${(e as Error).message}`);
        setPhase('done');
      }
    })();
  }, [scannedToken, postToFcu]);

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
          { fps: 10, qrbox: { width: 260, height: 260 } },
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
              return (
                <li
                  key={acc.id}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm"
                >
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
                </li>
              );
            })}
          </ul>
        </>
      )}

      {phase === 'done' && (
        <div className="mt-6 space-y-3">
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ 瀏覽器跨網域讀不到 FCU 回應。請在 FCU app 或網站確認打卡記錄。
          </div>
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
  };
  const s = map[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
