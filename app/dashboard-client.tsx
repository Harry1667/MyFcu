'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { signOutAction } from '@/lib/actions/auth';

type Account = { id: string; displayName: string; fcuNid: string };
type Mode = 'class_qr' | 'parttime_code' | 'active_code' | 'assistant_code';

const MODE_OPTIONS: { value: Mode; label: string; hint: string }[] = [
  { value: 'class_qr', label: '課堂打卡', hint: '老師螢幕的 QR' },
  { value: 'parttime_code', label: '助學服務刷卡', hint: '輸入今日認證碼' },
  { value: 'active_code', label: '活動簽到', hint: '輸入今日認證碼' },
  { value: 'assistant_code', label: '計畫助理簽到', hint: '輸入今日認證碼' },
];

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 55%)`;
}

export function DashboardClient({
  accounts,
  userEmail,
}: {
  accounts: Account[];
  userEmail: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>('class_qr');

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectedIds = useMemo(() => [...selected], [selected]);

  const targetHref =
    selectedIds.length === 0
      ? '#'
      : mode === 'class_qr'
        ? `/clockin/class?ids=${selectedIds.join(',')}`
        : `/clockin/code?mode=${mode}&ids=${selectedIds.join(',')}`;

  const startDisabled = selectedIds.length === 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">逢甲打卡</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500">{userEmail}</span>
          <form action={signOutAction}>
            <button type="submit" className="text-zinc-600 underline">
              登出
            </button>
          </form>
        </div>
      </header>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">我的 FCU 帳號</h2>
          <Link href="/accounts/new" className="text-sm text-zinc-600 underline">
            ＋ 新增
          </Link>
        </div>

        {accounts.length === 0 ? (
          <Link
            href="/accounts/new"
            className="mt-4 block rounded-2xl border-2 border-dashed border-zinc-300 p-8 text-center text-zinc-500 hover:border-zinc-400"
          >
            還沒有 FCU 帳號，按此新增
          </Link>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {accounts.map((a) => {
              const isSel = selected.has(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={`group flex w-full flex-col items-center gap-1 rounded-2xl border-2 p-3 transition ${
                      isSel
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-transparent bg-white hover:border-zinc-200'
                    }`}
                  >
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                      style={{ backgroundColor: avatarColor(a.id) }}
                    >
                      {a.displayName.slice(0, 1)}
                    </span>
                    <span className="line-clamp-1 text-sm font-medium">{a.displayName}</span>
                    <span className="font-mono text-[10px] text-zinc-400">{a.fcuNid}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-700">打卡模式</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {MODE_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <label
                className={`flex cursor-pointer flex-col rounded-xl border-2 p-3 ${
                  mode === opt.value
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="sr-only"
                />
                <span className="font-medium">{opt.label}</span>
                <span className={`text-xs ${mode === opt.value ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {opt.hint}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-auto pt-8">
        <Link
          href={targetHref}
          aria-disabled={startDisabled}
          tabIndex={startDisabled ? -1 : 0}
          className={`block w-full rounded-2xl py-4 text-center text-lg font-semibold ${
            startDisabled
              ? 'pointer-events-none bg-zinc-200 text-zinc-400'
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
        >
          ▶ 開始打卡{selectedIds.length > 0 && `（${selectedIds.length}）`}
        </Link>
      </div>
    </div>
  );
}
