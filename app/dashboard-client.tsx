'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { deleteFcuAccount } from '@/lib/actions/accounts';
import { assignAccountVault, lockAll } from '@/lib/actions/vaults';
import { checkAccountHealth } from '@/lib/actions/fcu-features';

type Health = 'checking' | 'valid' | 'invalid' | 'error';

type Account = { id: string; displayName: string; fcuNid: string; vaultId: string | null };
type Vault = { id: string; name: string };
type Group = { id: string; name: string; memberIds: string[] };

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 58% 52%)`;
}

export function DashboardClient({
  isAdmin,
  accounts,
  vaults,
  groups,
}: {
  isAdmin: boolean;
  accounts: Account[];
  vaults: Vault[];
  groups: Group[];
}) {
  // Start with nothing selected — the user picks who to clock in (pre-selecting
  // all risks accidentally clocking in the whole group).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manageMode, setManageMode] = useState(false);
  const [pending, startTransition] = useTransition();
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [checking, setChecking] = useState(false);

  // Accounts grouped into vault sections (+ an "未分檔" bucket admin-only),
  // so the list reads as "this group's people" instead of a flat mix.
  const sections = useMemo(() => {
    const byVault = new Map<string, Account[]>();
    for (const a of accounts) {
      const k = a.vaultId ?? '__none__';
      const arr = byVault.get(k);
      if (arr) arr.push(a);
      else byVault.set(k, [a]);
    }
    const out: { key: string; name: string; accounts: Account[] }[] = [];
    for (const v of vaults) {
      const arr = byVault.get(v.id);
      if (arr) out.push({ key: v.id, name: v.name, accounts: arr });
    }
    const none = byVault.get('__none__');
    if (none) out.push({ key: '__none__', name: '未分檔', accounts: none });
    return out;
  }, [accounts, vaults]);

  const runHealthCheck = () => {
    if (checking) return;
    setChecking(true);
    setHealth(Object.fromEntries(accounts.map((a) => [a.id, 'checking' as Health])));
    void Promise.all(
      accounts.map(async (a) => {
        const status = await checkAccountHealth(a.id).catch(() => 'error' as const);
        setHealth((h) => ({ ...h, [a.id]: status }));
      }),
    ).finally(() => setChecking(false));
  };

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

  const liveMembers = (g: Group) => g.memberIds.filter((id) => accounts.some((a) => a.id === id));
  const isGroupActive = (g: Group) => {
    const m = liveMembers(g);
    return m.length > 0 && m.length === selected.size && m.every((id) => selected.has(id));
  };
  const selectGroup = (g: Group) => {
    if (manageMode) return;
    setSelected(isGroupActive(g) ? new Set() : new Set(liveMembers(g)));
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

  const handleAssign = (id: string, vaultId: string) => {
    startTransition(async () => {
      await assignAccountVault(id, vaultId || null);
    });
  };

  const selectedIds = useMemo(() => [...selected], [selected]);
  const startHref =
    selectedIds.length === 0 ? '#' : `/clockin/class?ids=${selectedIds.join(',')}`;
  const startDisabled = selectedIds.length === 0 || manageMode;

  const groupsWithMembers = groups.filter((g) => liveMembers(g).length > 0);

  const renderRow = (a: Account, i: number) => {
    const isSel = selected.has(a.id);
    return (
      <li key={a.id} className="relative flex items-center">
        {i > 0 && <span className="ios-divider absolute top-0 right-0 left-[60px]" />}
        {manageMode ? (
          <>
            <button
              type="button"
              onClick={() => handleDelete(a)}
              disabled={pending}
              aria-label={`刪除 ${a.displayName}`}
              className="flex items-center gap-3 py-2 pl-4 text-left active:bg-[--fill]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[--danger] text-sm font-bold text-white">
                −
              </span>
              <Avatar acc={a} />
            </button>
            <div className="min-w-0 flex-1 py-2 pl-3">
              <Name acc={a} />
              <select
                value={a.vaultId ?? ''}
                onChange={(e) => handleAssign(a.id, e.target.value)}
                disabled={pending}
                className="mt-1 w-full rounded-md bg-[--fill] px-2 py-1 text-[12px] text-[--label] outline-none"
                aria-label={`${a.displayName} 的分檔`}
              >
                <option value="">未分檔（只有管理員看得到）</option>
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </>
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
        {!manageMode && health[a.id] && <HealthBadge status={health[a.id]} />}
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
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-end justify-between pt-3">
        <div>
          <h1 className="ios-title">逢甲打卡</h1>
          {!isAdmin && vaults.length > 0 && (
            <p className="mt-0.5 text-[13px] text-[--label-2]">
              分檔：{vaults.map((v) => v.name).join('、')}
            </p>
          )}
          {isAdmin && <p className="mt-0.5 text-[13px] text-[--tint]">管理員模式</p>}
        </div>
        <div className="flex items-center gap-4 pb-1 text-[15px] text-[--tint]">
          {accounts.length > 0 && !manageMode && (
            <button type="button" onClick={runHealthCheck} disabled={checking}>
              {checking ? '檢查中…' : '檢查'}
            </button>
          )}
          {isAdmin && <Link href="/vaults">分檔</Link>}
          {isAdmin && <Link href="/logs">紀錄</Link>}
          {isAdmin && accounts.length > 0 && (
            <button type="button" onClick={() => setManageMode((m) => !m)} className="font-medium">
              {manageMode ? '完成' : '編輯'}
            </button>
          )}
        </div>
      </header>

      {accounts.length > 0 && !manageMode && groupsWithMembers.length > 0 && (
        <section className="mt-6">
          <div className="ios-section flex items-end justify-between">
            <span>課程群組</span>
            {isAdmin && (
              <Link href="/groups" className="text-[--tint]">
                管理
              </Link>
            )}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {groupsWithMembers.map((g) => {
              const active = isGroupActive(g);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => selectGroup(g)}
                  className="shrink-0 rounded-full px-4 py-2 text-[15px] font-medium transition active:opacity-70"
                  style={{
                    backgroundColor: active ? 'var(--tint)' : 'var(--bg-elevated)',
                    color: active ? '#fff' : 'var(--label)',
                  }}
                >
                  {g.name}
                  <span className={active ? 'ml-1.5 opacity-80' : 'ml-1.5 text-[--label-3]'}>
                    {liveMembers(g).length}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6 flex-1">
        <div className="ios-section flex items-end justify-between">
          <span>{manageMode ? '管理帳號' : '選擇要打卡的帳號'}</span>
          {accounts.length > 1 && !manageMode && (
            <button type="button" onClick={selectAll} className="text-[--tint]">
              {selected.size === accounts.length ? '全部取消' : '全選'}
            </button>
          )}
        </div>

        {accounts.length === 0 ? (
          isAdmin ? (
            <Link
              href="/accounts/new"
              className="ios-card flex items-center justify-center gap-2 px-4 py-8 text-[17px] text-[--tint]"
            >
              ＋ 新增第一個 FCU 帳號
            </Link>
          ) : (
            <div className="ios-card px-4 py-8 text-center text-[15px] text-[--label-2]">
              這個分檔還沒有帳號。
            </div>
          )
        ) : (
          <>
            {sections.map((s) => (
              <div key={s.key} className="mb-4">
                {(isAdmin || sections.length > 1) && (
                  <div className="ios-section">
                    {s.name}
                    {isAdmin && ` · ${s.accounts.length}`}
                  </div>
                )}
                <ul className="ios-card">{s.accounts.map((a, i) => renderRow(a, i))}</ul>
              </div>
            ))}

            {isAdmin && !manageMode && (
              <Link
                href="/accounts/new"
                className="ios-card mt-1 flex items-center gap-2 px-4 py-3 text-[17px] text-[--tint]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[--tint] text-lg leading-none text-white">
                  ＋
                </span>
                新增帳號
              </Link>
            )}
          </>
        )}

        {!manageMode && (
          <div className="mt-6 flex flex-col items-center gap-2 text-[14px] text-[--label-2]">
            <Link href="/unlock">輸入其他分檔密碼</Link>
            <form action={lockAll}>
              <button type="submit" className="text-[--label-3]">
                鎖定離開
              </button>
            </form>
          </div>
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

function HealthBadge({ status }: { status: Health }) {
  if (status === 'checking') {
    return (
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[--fill-strong] border-t-[--tint]" />
    );
  }
  const ok = status === 'valid';
  const color = ok ? 'var(--tint)' : 'var(--danger)';
  return (
    <span
      className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-white"
      style={{ backgroundColor: color }}
      title={ok ? '密碼有效' : status === 'invalid' ? '密碼失效' : '檢查失敗'}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        {ok ? (
          <path d="M2.5 6.2l2.2 2.2L9.5 3.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
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
