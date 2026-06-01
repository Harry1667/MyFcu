'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { addFcuAccount, type FormState } from '@/lib/actions/accounts';

export default function NewAccountPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addFcuAccount, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="pt-2">
        <Link href="/" className="-ml-1 flex w-fit items-center text-[17px] text-[--tint]">
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none" className="mr-0.5">
            <path
              d="M9 1.5L2 9l7 7.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          取消
        </Link>
        <h1 className="ios-title mt-2">新增帳號</h1>
      </header>

      <form action={formAction} className="mt-6 space-y-6">
        <div className="space-y-1.5">
          <label htmlFor="displayName" className="ios-section block">
            顯示名稱
          </label>
          <input
            id="displayName"
            type="text"
            name="displayName"
            required
            maxLength={30}
            placeholder="例：華柏翰"
            className="ios-input"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="fcuNid" className="ios-section block">
            FCU 學號（NID）
          </label>
          <input
            id="fcuNid"
            type="text"
            name="fcuNid"
            required
            pattern="[A-Za-z][0-9]{7}"
            placeholder="例：D1363482"
            autoCapitalize="characters"
            className="ios-input font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="fcuPassword" className="ios-section block">
            FCU 密碼
          </label>
          <input
            id="fcuPassword"
            type="password"
            name="fcuPassword"
            required
            autoComplete="off"
            placeholder="••••••••"
            className="ios-input"
          />
          <p className="px-4 pt-1 text-[12px] text-[--label-3]">
            密碼以 AES-256 加密儲存於伺服器，僅用於代為登入 FCU。
          </p>
        </div>

        {state?.error && (
          <p className="rounded-xl bg-[--fill] px-4 py-3 text-[15px] text-[--danger]">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="ios-btn">
          {pending ? '儲存中…' : '儲存'}
        </button>
      </form>
    </main>
  );
}
