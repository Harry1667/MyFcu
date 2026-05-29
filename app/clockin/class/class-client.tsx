'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Account = {
  id: string;
  displayName: string;
  fcuNid: string;
  fcuPassword: string;
};

type ResultStatus = 'pending' | 'sent' | 'failed';
type Result = { id: string; status: ResultStatus; message?: string };

const QR_ENDPOINT = 'https://signin.fcu.edu.tw/clockIn/ClassClockinQR.aspx';

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 55%)`;
}

export function ClassClockinClient({ accounts }: { accounts: Account[] }) {
  const [phase, setPhase] = useState<'scan' | 'processing' | 'done'>('scan');
  const [results, setResults] = useState<Result[]>([]);
  const [token, setToken] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (phase !== 'scan') return;
    let scanner: import('html5-qrcode').Html5QrcodeScanner | null = null;
    let mounted = true;

    (async () => {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      if (!mounted) return;
      scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
        },
        false,
      );
      scanner.render(
        (decoded) => {
          if (handledRef.current) return;
          handledRef.current = true;
          void scanner?.clear().catch(() => {});
          handleToken(decoded);
        },
        () => {},
      );
    })();

    return () => {
      mounted = false;
      void scanner?.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function handleToken(scanned: string) {
    setToken(scanned);
    setPhase('processing');
    const initial = accounts.map<Result>((a) => ({ id: a.id, status: 'pending' }));
    setResults(initial);

    await Promise.allSettled(
      accounts.map(async (acc) => {
        try {
          const body = new URLSearchParams({
            username: acc.fcuNid,
            password: acc.fcuPassword,
            token: scanned,
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
                ? { ...r, status: 'failed', message: (e as Error).message }
                : r,
            ),
          );
        }
      }),
    );
    setPhase('done');
  }

  function rescan() {
    handledRef.current = false;
    setPhase('scan');
    setResults([]);
    setToken('');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">課堂打卡</h1>
        <Link href="/" className="text-sm text-zinc-600 underline">
          取消
        </Link>
      </header>

      <p className="mt-2 text-sm text-zinc-500">
        對準老師螢幕的 QR code，掃到後會自動為以下 {accounts.length} 個帳號送出打卡。
      </p>

      {phase === 'scan' && (
        <div className="mt-4">
          <div
            id="qr-reader"
            ref={containerRef}
            className="overflow-hidden rounded-2xl bg-black"
          />
          <p className="mt-2 text-center text-xs text-zinc-500">
            如果鏡頭沒有打開，請允許瀏覽器使用相機並重新整理。
          </p>
        </div>
      )}

      {phase !== 'scan' && token && (
        <div className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-xs">
          <span className="text-zinc-500">QR token：</span>
          <span className="ml-2 font-mono break-all">{token.slice(0, 80)}{token.length > 80 ? '…' : ''}</span>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {accounts.map((acc) => {
          const r = results.find((x) => x.id === acc.id);
          const status = r?.status ?? (phase === 'scan' ? 'waiting' : 'pending');
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
              <StatusBadge status={status as ResultStatus | 'waiting' | 'pending'} />
            </li>
          );
        })}
      </ul>

      {phase === 'done' && (
        <div className="mt-6 space-y-3">
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ 因瀏覽器跨網域限制無法讀取 FCU 的回應。請進 FCU app 或網站確認打卡記錄。
          </div>
          <div className="flex gap-2">
            <button
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
