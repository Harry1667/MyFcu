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

// In-app browsers (LINE / FB / IG / Messenger / WeChat / generic Android wv)
// commonly block getUserMedia — the live camera silently fails there.
function detectInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|Messenger|MicroMessenger|Twitter|; wv\)|KAKAOTALK/i.test(ua);
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
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(detectInAppBrowser()), []);
  // Live camera controls discovered from the running track (help with hard
  // screen/projector QRs): optical zoom + torch.
  const [zoom, setZoom] = useState<{ min: number; max: number; step: number; value: number } | null>(
    null,
  );
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({
    available: false,
    on: false,
  });

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
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const tmp = new Html5Qrcode('qr-file-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });
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
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;
        // QR-only decoder + native BarcodeDetector when the browser has it
        // (Android Chrome) — far more robust on glary screen QRs than jsQR.
        const scanner = new Html5Qrcode('qr-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: facing },
          {
            fps: 15,
            // Scan box at ~92% of the viewfinder so a large screen-sized QR
            // (finder patterns near the edges) stays fully inside the region.
            qrbox: (vw: number, vh: number) => {
              const size = Math.floor(Math.min(vw, vh) * 0.92);
              return { width: size, height: size };
            },
            // Ask for a high-res stream with continuous autofocus — sharper
            // frames decode a distant/small QR far more reliably.
            videoConstraints: {
              facingMode: facing,
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              // focusMode isn't in the standard TS type yet.
              advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
            },
          },
          (decoded) => {
            if (handledRef.current) return;
            handledRef.current = true;
            setScannedToken(decoded);
          },
          () => {},
        );

        // Surface zoom/torch controls if the camera supports them.
        try {
          const caps = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & {
            zoom?: { min: number; max: number; step: number };
            torch?: boolean;
          };
          if (!cancelled && caps.zoom && caps.zoom.max > caps.zoom.min) {
            setZoom({
              min: caps.zoom.min,
              max: caps.zoom.max,
              step: caps.zoom.step || 0.1,
              value: caps.zoom.min,
            });
          }
          if (!cancelled && caps.torch) setTorch({ available: true, on: false });
        } catch {
          /* capabilities not available */
        }
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
      setZoom(null);
      setTorch({ available: false, on: false });
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

  const applyZoom = (value: number) => {
    setZoom((z) => (z ? { ...z, value } : z));
    scannerRef.current
      ?.applyVideoConstraints({
        advanced: [{ zoom: value } as MediaTrackConstraintSet],
      })
      .catch(() => {});
  };

  const toggleTorch = () => {
    const next = !torch.on;
    scannerRef.current
      ?.applyVideoConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      })
      .then(() => setTorch((t) => ({ ...t, on: next })))
      .catch(() => {});
  };

  const rescan = () => {
    handledRef.current = false;
    setScannedToken(null);
    setResults([]);
    setError(null);
    setManualValue('');
    setManualOpen(false);
    setZoom(null);
    setTorch({ available: false, on: false });
    setPhase('preflight');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[17px] font-semibold text-[--label]">掃 QR 打卡</h1>
        <Link href="/" className="text-[17px] text-[--tint]">
          取消
        </Link>
      </header>

      <p className="mt-3 text-[15px] text-[--label-2]">
        對準老師螢幕的 QR，自動為 {accounts.length} 個帳號送出打卡。
      </p>

      {inApp && (
        <div className="mt-3 rounded-xl bg-[--fill] px-4 py-3 text-[13px] text-[--label]">
          ⚠️ 你在 App 內建瀏覽器（LINE／IG／FB…）開啟，相機常常打不開。
          建議用 <b>Safari / Chrome</b> 開這個網址；或直接用下方的「📸 拍照辨識」，不需要開相機權限。
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl bg-[--fill] px-4 py-3 text-[15px] text-[--danger]">
          ⚠️ {error}
        </div>
      )}

      {/* Scanner div is always mounted; only visible during scan phase. */}
      <div className={phase === 'scan' ? 'mt-4' : 'hidden'}>
        <div
          id="qr-reader"
          className="overflow-hidden rounded-2xl bg-black"
        />
        {zoom && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[--fill] px-4 py-2.5">
            <span className="text-[13px] text-[--label-2]">縮放</span>
            <input
              type="range"
              min={zoom.min}
              max={zoom.max}
              step={zoom.step}
              value={zoom.value}
              onChange={(e) => applyZoom(Number(e.target.value))}
              className="h-1 flex-1 accent-[#34c759]"
              aria-label="相機縮放"
            />
            <span className="w-9 text-right font-mono text-[12px] text-[--label-2]">
              {(zoom.value / zoom.min || zoom.value).toFixed(1)}×
            </span>
          </div>
        )}
        <div className="mt-3 flex justify-center gap-2">
          <button
            type="button"
            onClick={switchCamera}
            className="rounded-full bg-[--fill] px-4 py-2 text-[14px] font-medium text-[--label] active:opacity-70"
          >
            🔄 切換鏡頭（{facing === 'environment' ? '後' : '前'}）
          </button>
          {torch.available && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`rounded-full px-4 py-2 text-[14px] font-medium active:opacity-70 ${
                torch.on ? 'bg-[--tint] text-white' : 'bg-[--fill] text-[--label]'
              }`}
            >
              {torch.on ? '💡 關燈' : '🔦 開燈'}
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[12px] text-[--label-3]">
          對不到焦？用縮放拉近老師螢幕的 QR，或改用下方「拍照辨識」。
        </p>
      </div>

      {/* Hidden element used by scanFile() for the photo fallback. */}
      <div id="qr-file-reader" className="hidden" />

      {/* Fallbacks for when live scanning off a screen won't lock on. */}
      {(phase === 'preflight' || phase === 'scan') && (
        <div className="mt-4 space-y-2">
          <label className="ios-card block w-full cursor-pointer py-3 text-center text-[15px] font-medium text-[--tint] active:opacity-70">
            📸 拍照辨識（免相機權限，最穩）
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
              className="w-full py-1 text-center text-[13px] text-[--label-2]"
            >
              掃不到？手動貼上 QR 內容
            </button>
          ) : (
            <div className="ios-card space-y-2 p-3">
              <textarea
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                rows={3}
                placeholder="用手機相機掃 QR 後，貼上掃到的文字…"
                className="w-full resize-none rounded-lg bg-[--fill] px-3 py-2 font-mono text-[13px] text-[--label] outline-none placeholder:text-[--label-3]"
              />
              <button
                type="button"
                onClick={submitManual}
                disabled={!manualValue.trim()}
                className="ios-btn"
              >
                送出打卡
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'preflight' && (
        <div className="mt-6 space-y-3">
          <div className="ios-card flex flex-col items-center gap-2 py-14 text-[--label-2]">
            <span className="text-4xl">📷</span>
            <div className="text-[15px]">需要使用相機</div>
          </div>
          <button type="button" onClick={startCamera} className="ios-btn">
            啟用相機
          </button>
        </div>
      )}

      {phase !== 'preflight' && phase !== 'scan' && (
        <>
          {scannedToken && (
            <div className="mt-4 rounded-xl bg-[--fill] px-3 py-2 text-[12px]">
              <span className="text-[--label-2]">QR：</span>
              <span className="ml-2 font-mono break-all text-[--label]">
                {scannedToken.length > 60 ? `${scannedToken.slice(0, 60)}…` : scannedToken}
              </span>
            </div>
          )}
          <ul className="ios-card mt-4">
            {accounts.map((acc, i) => {
              const r = results.find((x) => x.id === acc.id);
              const status = r?.status ?? 'waiting';
              const detail = r?.verifyMessage ?? r?.error;
              return (
                <li key={acc.id} className="relative px-3 py-2.5">
                  {i > 0 && <span className="ios-divider absolute top-0 right-0 left-[56px]" />}
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: avatarColor(acc.id) }}
                    >
                      {acc.displayName.slice(0, 1)}
                    </span>
                    <div className="flex-1">
                      <div className="text-[15px] text-[--label]">{acc.displayName}</div>
                      <div className="font-mono text-[10px] text-[--label-2]">{acc.fcuNid}</div>
                    </div>
                    <StatusBadge status={status as ResultStatus | 'waiting'} />
                  </div>
                  {detail && (status === 'unverified' || status === 'failed') && (
                    <div className="mt-1 break-words pl-[52px] text-[11px] text-[--label-2]">
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
            <div className="rounded-xl bg-[--fill] px-4 py-3 text-[13px] text-[--label-2]">
              ⚠️ 有未確認 / 失敗的帳號。可以到 <Link href="/logs" className="font-medium text-[--tint]">紀錄</Link> 看詳細，或開 FCU app 自己確認。
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={rescan}
              className="ios-btn-secondary flex-1"
            >
              再掃一次
            </button>
            <Link href="/" className="ios-btn flex-1 text-center">
              回首頁
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: ResultStatus | 'waiting' }) {
  const map: Record<ResultStatus | 'waiting', { color: string; label: string }> = {
    waiting: { color: 'var(--label-2)', label: '等待' },
    pending: { color: '#0a84ff', label: '傳送中' },
    sent: { color: 'var(--tint)', label: '已送出' },
    failed: { color: 'var(--danger)', label: '失敗' },
    verifying: { color: '#0a84ff', label: '驗證中…' },
    verified: { color: 'var(--tint)', label: '✓ 已記錄' },
    unverified: { color: 'var(--amber)', label: '⚠️ 未確認' },
  };
  const s = map[status];
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ color: s.color, backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)` }}
    >
      {s.label}
    </span>
  );
}
