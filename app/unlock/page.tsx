'use client';

import { useActionState } from 'react';
import { unlock, type UnlockState } from '@/lib/actions/vaults';

export default function UnlockPage() {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(unlock, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[--tint] text-3xl font-extrabold text-white shadow-sm">
          逢
        </div>
        <h1 className="mt-4 text-[22px] font-bold text-[--label]">逢甲打卡</h1>
        <p className="mt-1 text-[14px] text-[--label-2]">輸入密碼進入你的分檔</p>
      </div>

      <form action={formAction} className="mt-7 space-y-3">
        <input
          name="password"
          type="password"
          inputMode="numeric"
          autoFocus
          required
          autoComplete="off"
          placeholder="密碼"
          className="ios-input text-center text-[20px] tracking-[0.3em]"
        />
        {state?.error && (
          <p className="text-center text-[14px] text-[--danger]">{state.error}</p>
        )}
        <button type="submit" disabled={pending} className="ios-btn">
          {pending ? '驗證中…' : '進入'}
        </button>
      </form>
    </main>
  );
}
