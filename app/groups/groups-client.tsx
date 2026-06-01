'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  createGroup,
  deleteGroup,
  moveGroup,
  updateGroup,
  type GroupFormState,
} from '@/lib/actions/groups';

type Account = { id: string; displayName: string; fcuNid: string };
type Group = { id: string; name: string; memberIds: string[] };

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 58% 52%)`;
}

export function GroupsManager({
  accounts,
  groups,
}: {
  accounts: Account[];
  groups: Group[];
}) {
  // null = list view; 'new' = creating; otherwise editing that group id.
  const [editing, setEditing] = useState<string | null>(null);
  const [moving, startMove] = useTransition();

  const editingGroup = groups.find((g) => g.id === editing) ?? null;
  const move = (id: string, dir: 'up' | 'down') =>
    startMove(async () => {
      await moveGroup(id, dir);
    });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="-ml-1 flex w-fit items-center text-[17px] text-[--tint]">
          <Back />
          首頁
        </Link>
        {editing === null && accounts.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="text-[17px] font-medium text-[--tint]"
          >
            ＋ 新增
          </button>
        )}
      </header>
      <h1 className="ios-title mt-2">課程群組</h1>
      <p className="mt-1 text-[13px] text-[--label-2]">
        把同一堂課的同學分成一組，打卡時一鍵選取整組。
      </p>

      {editing !== null ? (
        <GroupEditor
          key={editing}
          accounts={accounts}
          group={editingGroup}
          onDone={() => setEditing(null)}
        />
      ) : accounts.length === 0 ? (
        <div className="ios-card mt-6 px-6 py-12 text-center text-[15px] text-[--label-2]">
          還沒有帳號。先到首頁新增 FCU 帳號，再來建群組。
        </div>
      ) : groups.length === 0 ? (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="ios-card mt-6 flex w-full items-center justify-center gap-2 px-4 py-8 text-[17px] text-[--tint]"
        >
          ＋ 建立第一個群組
        </button>
      ) : (
        <ul className="ios-card mt-6">
          {groups.map((g, i) => {
            const count = g.memberIds.filter((id) => accounts.some((a) => a.id === id)).length;
            return (
              <li key={g.id} className="relative flex items-center">
                {i > 0 && <span className="ios-divider absolute top-0 right-0 left-4" />}
                <button
                  type="button"
                  onClick={() => setEditing(g.id)}
                  className="flex flex-1 items-center justify-between py-3 pl-4 text-left active:bg-[--fill]"
                >
                  <div>
                    <div className="text-[17px] text-[--label]">{g.name}</div>
                    <div className="text-[13px] text-[--label-2]">{count} 人</div>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 pr-3 pl-2">
                  <Arrow
                    dir="up"
                    disabled={i === 0 || moving}
                    onClick={() => move(g.id, 'up')}
                  />
                  <Arrow
                    dir="down"
                    disabled={i === groups.length - 1 || moving}
                    onClick={() => move(g.id, 'down')}
                  />
                  <Chevron />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function GroupEditor({
  accounts,
  group,
  onDone,
}: {
  accounts: Account[];
  group: Group | null;
  onDone: () => void;
}) {
  const isNew = group === null;
  const action = isNew ? createGroup : updateGroup.bind(null, group.id);
  const [state, formAction, pending] = useActionState<GroupFormState, FormData>(action, null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group?.memberIds ?? []),
  );
  const [deletePending, startDelete] = useTransition();

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <div className="space-y-1.5">
        <label htmlFor="name" className="ios-section block">
          群組名稱
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={20}
          defaultValue={group?.name ?? ''}
          placeholder="例：量子力學導論"
          className="ios-input"
        />
      </div>

      <div>
        <div className="ios-section">成員（{selected.size}）</div>
        <ul className="ios-card">
          {accounts.map((a, i) => {
            const on = selected.has(a.id);
            return (
              <li key={a.id} className="relative flex items-center">
                {i > 0 && <span className="ios-divider absolute top-0 right-0 left-[60px]" />}
                {on && <input type="hidden" name="memberIds" value={a.id} />}
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="flex flex-1 items-center gap-3 px-4 py-2.5 text-left active:bg-[--fill]"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: avatarColor(a.id) }}
                  >
                    {a.displayName.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] text-[--label]">
                      {a.displayName}
                    </span>
                    <span className="block font-mono text-[11px] text-[--label-2]">{a.fcuNid}</span>
                  </span>
                  <span
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2"
                    style={{
                      borderColor: on ? 'var(--tint)' : 'var(--label-3)',
                      backgroundColor: on ? 'var(--tint)' : 'transparent',
                    }}
                  >
                    {on && (
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
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {state?.error && (
        <p className="rounded-xl bg-[--fill] px-4 py-3 text-[15px] text-[--danger]">{state.error}</p>
      )}

      <div className="space-y-2">
        <button type="submit" disabled={pending} className="ios-btn">
          {pending ? '儲存中…' : isNew ? '建立群組' : '儲存'}
        </button>
        <button type="button" onClick={onDone} className="ios-btn-secondary">
          取消
        </button>
        {!isNew && (
          <button
            type="button"
            disabled={deletePending}
            onClick={() => {
              if (!confirm(`刪除群組「${group.name}」？`)) return;
              startDelete(async () => {
                await deleteGroup(group.id);
                onDone();
              });
            }}
            className="w-full py-2 text-center text-[15px] font-medium text-[--danger]"
          >
            刪除群組
          </button>
        )}
      </div>
    </form>
  );
}

function Chevron() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15" fill="none" className="text-[--label-3]" aria-hidden>
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

function Arrow({
  dir,
  disabled,
  onClick,
}: {
  dir: 'up' | 'down';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'up' ? '上移' : '下移'}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-[--fill] text-[--tint] active:opacity-60 disabled:opacity-30"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 15 9"
        fill="none"
        className={dir === 'down' ? 'rotate-180' : ''}
      >
        <path
          d="M1.5 7.5L7.5 1.5l6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function Back() {
  return (
    <svg width="11" height="18" viewBox="0 0 11 18" fill="none" className="mr-0.5">
      <path
        d="M9 1.5L2 9l7 7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
