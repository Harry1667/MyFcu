'use client';

import { useState } from 'react';
import Link from 'next/link';

type Account = {
  id: string;
  displayName: string;
  fcuNid: string;
  fcuPassword: string;
};

type CodeMode = 'parttime_code' | 'active_code' | 'assistant_code';

const MODE_META: Record<CodeMode, { label: string; targetButton: string; note: string }> = {
  parttime_code: {
    label: '助學服務刷卡',
    targetButton: '助學服務刷卡',
    note: '登入後按「助學服務刷卡」→ 輸入認證碼 → 確認 → 服務開始簽到',
  },
  active_code: {
    label: '活動簽到',
    targetButton: '活動簽到',
    note: '登入後按「活動簽到」→ 輸入認證碼 → 確認 → 簽到',
  },
  assistant_code: {
    label: '計畫助理簽到',
    targetButton: '計畫助理簽到',
    note: '登入後按「計畫助理簽到」→ 輸入認證碼 → 確認 → 簽到',
  },
};

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 55%)`;
}

export function CodeClockinClient({ accounts, mode }: { accounts: Account[]; mode: CodeMode }) {
  const meta = MODE_META[mode];
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function launchAccount(acc: Account) {
    try {
      await navigator.clipboard.writeText(acc.fcuPassword);
      setCopied(acc.id);
      setTimeout(() => setCopied((c) => (c === acc.id ? null : c)), 2000);
    } catch {
      // clipboard 失敗也繼續開分頁
    }
    window.open('https://signin.fcu.edu.tw/clockin/login.aspx', '_blank', 'noopener,noreferrer');
  }

  function markDone(id: string) {
    setDone((prev) => new Set(prev).add(id));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{meta.label}</h1>
        <Link href="/" className="text-sm text-zinc-600 underline">
          取消
        </Link>
      </header>

      <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        ⚠️ FCU 認證碼模式無法在我們的網站完成（跨網域限制）。我們會把密碼複製到剪貼簿並開啟 FCU 登入頁，你貼上密碼後按上面流程完成打卡。
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-zinc-700">今日認證碼（手抄用，不會自動帶入）</span>
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="從牆上 QR 掃到的數字"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-2xl tracking-widest focus:border-zinc-900 focus:outline-none"
        />
      </label>

      <p className="mt-3 text-xs text-zinc-500">流程：{meta.note}</p>

      <ul className="mt-4 space-y-2">
        {accounts.map((acc) => {
          const isDone = done.has(acc.id);
          const isCopied = copied === acc.id;
          return (
            <li
              key={acc.id}
              className={`rounded-xl bg-white p-3 shadow-sm transition ${isDone ? 'opacity-50' : ''}`}
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
                {isDone ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    完成
                  </span>
                ) : (
                  <button
                    onClick={() => launchAccount(acc)}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    {isCopied ? '已複製，請貼上' : '複製密碼 + 開啟 FCU'}
                  </button>
                )}
              </div>
              {!isDone && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(acc.fcuNid);
                    }}
                    className="text-xs text-zinc-500 underline"
                  >
                    複製學號
                  </button>
                  <span className="text-xs text-zinc-300">·</span>
                  <button
                    onClick={() => markDone(acc.id)}
                    className="text-xs text-zinc-500 underline"
                  >
                    標記為完成
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {done.size === accounts.length && (
        <div className="mt-6">
          <Link
            href="/"
            className="block w-full rounded-2xl bg-emerald-500 py-3 text-center text-lg font-semibold text-white"
          >
            全部完成，回首頁
          </Link>
        </div>
      )}
    </main>
  );
}
