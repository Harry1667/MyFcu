'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { deleteFcuAccount } from '@/lib/actions/accounts';

type Account = { id: string; displayName: string; fcuNid: string };

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 55%)`;
}

export function DashboardClient({ accounts }: { accounts: Account[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manageMode, setManageMode] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    if (manageMode) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === accounts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(accounts.map((a) => a.id)));
    }
  };

  const handleDelete = (acc: Account) => {
    if (!confirm(`刪除 ${acc.displayName}（${acc.fcuNid}）？`)) return;
    startTransition(async () => {
      await deleteFcuAccount(acc.id);
      setSelected((s) => {
        const n = new Set(s);
        n.delete(acc.id);
        return n;
      });
    });
  };

  const selectedIds = useMemo(() => [...selected], [selected]);
  const startHref =
    selectedIds.length === 0 ? '#' : `/clockin/class?ids=${selectedIds.join(',')}`;
  const startDisabled = selectedIds.length === 0 || manageMode;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">逢甲打卡</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/logs" className="text-zinc-600 underline">
            📋 紀錄
          </Link>
          {accounts.length > 0 && (
            <button
              type="button"
              onClick={() => setManageMode((m) => !m)}
              className="text-zinc-600 underline"
            >
              {manageMode ? '完成' : '管理'}
            </button>
          )}
        </div>
      </header>

      <section className="mt-8 flex-1">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">
            選擇要打卡的帳號
            {accounts.length > 1 && !manageMode && (
              <button
                type="button"
                onClick={selectAll}
                className="ml-3 text-xs font-normal text-zinc-500 underline"
              >
                {selected.size === accounts.length ? '全部取消' : '全選'}
              </button>
            )}
          </h2>
          <Link href="/accounts/new" className="text-sm text-zinc-600 underline">
            ＋ 新增
          </Link>
        </div>

        {accounts.length === 0 ? (
          <Link
            href="/accounts/new"
            className="mt-4 block rounded-2xl border-2 border-dashed border-zinc-300 p-12 text-center text-zinc-500 hover:border-zinc-400"
          >
            ＋ 新增第一個 FCU 帳號
          </Link>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {accounts.map((a) => {
              const isSel = selected.has(a.id);
              return (
                <li key={a.id} className="relative">
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    disabled={manageMode}
                    className={`group flex w-full flex-col items-center gap-1 rounded-2xl border-2 p-3 transition ${
                      isSel
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-transparent bg-white hover:border-zinc-200'
                    } ${manageMode ? 'opacity-60' : ''}`}
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
                  {manageMode && (
                    <button
                      type="button"
                      onClick={() => handleDelete(a)}
                      disabled={pending}
                      aria-label={`刪除 ${a.displayName}`}
                      className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow"
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {accounts.length > 0 && (
        <div className="pt-6">
          <Link
            href={startHref}
            aria-disabled={startDisabled}
            tabIndex={startDisabled ? -1 : 0}
            className={`block w-full rounded-2xl py-4 text-center text-lg font-semibold ${
              startDisabled
                ? 'pointer-events-none bg-zinc-200 text-zinc-400'
                : 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600'
            }`}
          >
            ▶ 掃 QR 打卡{selectedIds.length > 0 && `（${selectedIds.length}）`}
          </Link>
        </div>
      )}
    </div>
  );
}
