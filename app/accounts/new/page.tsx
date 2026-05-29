'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { addFcuAccount, type FormState } from '@/lib/actions/accounts';

export default function NewAccountPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addFcuAccount, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">新增 FCU 帳號</h1>
        <Link href="/" className="text-sm text-zinc-600 underline">
          取消
        </Link>
      </header>

      <form action={formAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">顯示名稱</span>
          <input
            type="text"
            name="displayName"
            required
            maxLength={30}
            placeholder="例：華柏翰"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-zinc-900 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">FCU 學號（NID）</span>
          <input
            type="text"
            name="fcuNid"
            required
            pattern="[A-Za-z][0-9]{7}"
            placeholder="例：D1363482"
            autoCapitalize="characters"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono focus:border-zinc-900 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">FCU 密碼</span>
          <input
            type="password"
            name="fcuPassword"
            required
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-zinc-900 focus:outline-none"
          />
        </label>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? '儲存中...' : '儲存'}
        </button>
      </form>
    </main>
  );
}
