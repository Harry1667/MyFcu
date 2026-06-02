'use client';

import { useActionState, useState } from 'react';
import { ADMIN_TARGET } from '@/lib/vaults';
import {
  createVault,
  unlock,
  type UnlockState,
  type VaultFormState,
} from '@/lib/actions/vaults';
import { IconChevronDown, IconLock, IconPlus, IconShield } from '@/app/icons';

type Vault = { id: string; name: string };

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 58% 52%)`;
}

export function UnlockPicker({ vaults }: { vaults: Vault[] }) {
  // Which row is expanded: a vault id, ADMIN_TARGET, '__new__', or null.
  const [open, setOpen] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[--tint] text-3xl font-extrabold text-white shadow-sm">
          逢
        </div>
        <h1 className="mt-4 text-[22px] font-bold text-[--label]">逢甲打卡</h1>
        <p className="mt-1 text-[14px] text-[--label-2]">選擇你的群組，輸入密碼進入</p>
      </div>

      <section className="mt-8">
        <div className="ios-section">群組</div>
        {vaults.length === 0 ? (
          <div className="ios-card px-4 py-6 text-center text-[14px] text-[--label-2]">
            還沒有群組。用下方「新增群組」建立第一個。
          </div>
        ) : (
          <ul className="ios-card">
            {vaults.map((v, i) => (
              <li key={v.id} className="relative">
                {i > 0 && <span className="ios-divider absolute top-0 right-0 left-[60px]" />}
                <button
                  type="button"
                  onClick={() => setOpen((o) => (o === v.id ? null : v.id))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[--fill]"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
                    style={{ backgroundColor: avatarColor(v.id) }}
                  >
                    {v.name.slice(0, 1)}
                  </span>
                  <span className="flex-1 truncate text-[17px] text-[--label]">{v.name}</span>
                  <span className="text-[--label-3]">
                    {open === v.id ? <IconChevronDown size={18} /> : <IconLock size={17} />}
                  </span>
                </button>
                {open === v.id && (
                  <PasswordForm vaultId={v.id} username={v.name} placeholder={`${v.name} 的密碼`} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <ul className="ios-card">
          <li className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => (o === '__new__' ? null : '__new__'))}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-[17px] text-[--tint] active:bg-[--fill]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[--tint] text-white">
                <IconPlus size={18} />
              </span>
              新增群組
            </button>
            {open === '__new__' && <NewGroupForm />}
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <ul className="ios-card">
          <li className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => (o === ADMIN_TARGET ? null : ADMIN_TARGET))}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[--fill]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[--label-2] text-white">
                <IconShield size={18} />
              </span>
              <span className="flex-1 text-[17px] text-[--label]">管理員</span>
              <span className="text-[--label-3]">
                {open === ADMIN_TARGET ? <IconChevronDown size={18} /> : <IconLock size={17} />}
              </span>
            </button>
            {open === ADMIN_TARGET && (
              <PasswordForm vaultId={ADMIN_TARGET} username="管理員" placeholder="管理員密碼" />
            )}
          </li>
        </ul>
      </section>
    </main>
  );
}

function PasswordForm({
  vaultId,
  username,
  placeholder,
}: {
  vaultId: string;
  username: string;
  placeholder: string;
}) {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(unlock, null);
  return (
    <form action={formAction} className="space-y-2 px-4 pb-3">
      <input type="hidden" name="vaultId" value={vaultId} />
      {/* Identifies which group's password this is, so the browser's password
          manager can save/autofill it per group. */}
      <input
        type="text"
        name="username"
        value={username}
        readOnly
        autoComplete="username"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
      />
      <input
        name="password"
        type="password"
        autoFocus
        required
        autoComplete="current-password"
        placeholder={placeholder}
        className="ios-input text-center text-[18px] tracking-[0.25em]"
      />
      {state?.error && <p className="text-center text-[13px] text-[--danger]">{state.error}</p>}
      <button type="submit" disabled={pending} className="ios-btn">
        {pending ? '驗證中…' : '進入'}
      </button>
    </form>
  );
}

function NewGroupForm() {
  const [state, formAction, pending] = useActionState<VaultFormState, FormData>(createVault, null);
  return (
    <form action={formAction} className="space-y-2 px-4 pb-3">
      <input name="name" required maxLength={30} placeholder="群組名稱（例：光電二乙）" className="ios-input" />
      <input
        name="password"
        required
        maxLength={64}
        autoComplete="new-password"
        placeholder="設定群組密碼"
        className="ios-input"
      />
      {state?.error && <p className="text-center text-[13px] text-[--danger]">{state.error}</p>}
      {state?.ok && <p className="text-center text-[13px] text-[--tint]">已建立，現在可在上方用密碼進入。</p>}
      <button type="submit" disabled={pending} className="ios-btn">
        {pending ? '建立中…' : '建立群組'}
      </button>
    </form>
  );
}
