'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { deleteFcuAccount } from '@/lib/actions/accounts';

type Account = { id: string; displayName: string; fcuNid: string };

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 58% 52%)`;
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
    if (selected.size === accounts.length) setSelected(new Set());
    else setSelected(new Set(accounts.map((a) => a.id)));
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-end justify-between pt-3">
        <h1 className="ios-title">逢甲打卡</h1>
        <div className="flex items-center gap-4 pb-1 text-[15px] text-[--tint]">
          <Link href="/logs">紀錄</Link>
          {accounts.length > 0 && (
            <button type="button" onClick={() => setManageMode((m) => !m)} className="font-medium">
              {manageMode ? '完成' : '編輯'}
            </button>
          )}
        </div>
      </header>

      <section className="mt-7 flex-1">
        <div className="ios-section flex items-end justify-between">
          <span>{manageMode ? '管理帳號' : '選擇要打卡的帳號'}</span>
          {accounts.length > 1 && !manageMode && (
            <button type="button" onClick={selectAll} className="text-[--tint]">
              {selected.size === accounts.length ? '全部取消' : '全選'}
            </button>
          )}
        </div>

        {accounts.length === 0 ? (
          <Link
            href="/accounts/new"
            className="ios-card flex items-center justify-center gap-2 px-4 py-8 text-[17px] text-[--tint]"
          >
            ＋ 新增第一個 FCU 帳號
          </Link>
        ) : (
          <>
            <ul className="ios-card">
              {accounts.map((a, i) => {
                const isSel = selected.has(a.id);
                return (
                  <li key={a.id} className="relative flex items-center">
                    {i > 0 && (
                      <span className="ios-divider absolute top-0 right-0 left-[60px]" />
                    )}
                    {manageMode ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        disabled={pending}
                        aria-label={`刪除 ${a.displayName}`}
                        className="flex flex-1 items-center gap-3 py-2 pl-4 text-left active:bg-[--fill]"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[--danger] text-sm font-bold text-white">
                          −
                        </span>
                        <Avatar acc={a} />
                        <Name acc={a} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggle(a.id)}
                        className="flex flex-1 items-center gap-3 py-2 pl-4 text-left active:bg-[--fill]"
                      >
                        <span
                          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-white transition"
                          style={{
                            borderColor: isSel ? 'var(--tint)' : 'var(--label-3)',
                            backgroundColor: isSel ? 'var(--tint)' : 'transparent',
                          }}
                        >
                          {isSel && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2.5 6.2l2.2 2.2L9.5 3.6"
                                stroke="white"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <Avatar acc={a} />
                        <Name acc={a} />
                      </button>
                    )}
                    {!manageMode && (
                      <Link
                        href={`/account/${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${a.displayName} 的功能`}
                        className="flex items-center self-stretch pr-4 pl-2 text-[--label-3] active:bg-[--fill]"
                      >
                        <Chevron />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>

            {!manageMode && (
              <Link
                href="/accounts/new"
                className="ios-card mt-4 flex items-center gap-2 px-4 py-3 text-[17px] text-[--tint]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[--tint] text-lg leading-none text-white">
                  ＋
                </span>
                新增帳號
              </Link>
            )}
          </>
        )}
      </section>

      {accounts.length > 0 && (
        <div className="sticky bottom-0 pt-4">
          <Link
            href={startHref}
            aria-disabled={startDisabled}
            tabIndex={startDisabled ? -1 : 0}
            className={`ios-btn block text-center ${
              startDisabled ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            掃 QR 打卡{selectedIds.length > 0 && `（${selectedIds.length}）`}
          </Link>
        </div>
      )}
    </div>
  );
}

function Avatar({ acc }: { acc: Account }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
      style={{ backgroundColor: avatarColor(acc.id) }}
    >
      {acc.displayName.slice(0, 1)}
    </span>
  );
}

function Name({ acc }: { acc: Account }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[17px] text-[--label]">{acc.displayName}</span>
      <span className="block font-mono text-[12px] text-[--label-2]">{acc.fcuNid}</span>
    </span>
  );
}

function Chevron() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden>
      <path
        d="M1.5 1.5L7 7.5l-5.5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
