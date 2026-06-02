'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { revealHidden, type RevealState } from '@/lib/actions/reveal';

export default function RevealPage() {
  const [state, formAction, pending] = useActionState<RevealState, FormData>(revealHidden, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[--tint] text-3xl text-white shadow-sm">
          🔒
        </div>
        <h1 className="mt-4 text-[22px] font-bold text-[--label]">顯示隱藏帳號</h1>
        <p className="mt-1 text-[14px] text-[--label-2]">請輸入揭露碼</p>
      </div>

      <form action={formAction} className="mt-7 space-y-3">
        <input
          name="code"
          type="password"
          autoFocus
          required
          autoComplete="off"
          placeholder="揭露碼"
          className="ios-input text-center text-[20px] tracking-[0.3em]"
        />
        {state?.error && (
          <p className="text-center text-[14px] text-[--danger]">{state.error}</p>
        )}
        <button type="submit" disabled={pending} className="ios-btn">
          {pending ? '驗證中…' : '顯示'}
        </button>
        <Link href="/" className="block text-center text-[15px] text-[--tint]">
          返回
        </Link>
      </form>
    </main>
  );
}
