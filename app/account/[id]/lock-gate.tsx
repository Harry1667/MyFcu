'use client';

import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { gateAdmin, type GateState } from '@/lib/actions/vaults';
import { IconChevronLeft, IconLock } from '@/app/icons';

export function LockGate({ displayName, fcuNid }: { displayName: string; fcuNid: string }) {
  const [state, formAction, pending] = useActionState<GateState, FormData>(gateAdmin, null);

  // On correct admin password, reload so the now-admin request shows details.
  useEffect(() => {
    if (state?.ok) window.location.reload();
  }, [state]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="pt-2">
        <Link href="/" className="-ml-1 flex w-fit items-center text-[17px] text-[--tint]">
          <IconChevronLeft size={22} />
          首頁
        </Link>
      </header>

      <div className="mt-16 flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[--fill] text-[--label-2]">
          <IconLock size={26} />
        </div>
        <h1 className="mt-4 text-[20px] font-bold text-[--label]">{displayName}</h1>
        <p className="mt-0.5 font-mono text-[13px] text-[--label-2]">{fcuNid}</p>
        <p className="mt-3 text-[14px] text-[--label-2]">
          這個帳號已上鎖，查看詳情需要管理員密碼。
        </p>
      </div>

      <form action={formAction} className="mt-7 space-y-3">
        <input
          name="password"
          type="password"
          autoFocus
          required
          autoComplete="off"
          placeholder="管理員密碼"
          className="ios-input text-center text-[18px] tracking-[0.25em]"
        />
        {state?.error && <p className="text-center text-[13px] text-[--danger]">{state.error}</p>}
        <button type="submit" disabled={pending} className="ios-btn">
          {pending ? '驗證中…' : '查看詳情'}
        </button>
      </form>
    </main>
  );
}
