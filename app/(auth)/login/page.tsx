'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, type FormState } from '@/lib/actions/auth';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">登入</h1>
          <p className="mt-1 text-sm text-zinc-500">逢甲打卡多帳號工具</p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">密碼</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none"
          />
        </label>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? '登入中...' : '登入'}
        </button>

        <p className="text-center text-sm text-zinc-500">
          還沒有帳號？{' '}
          <Link href="/register" className="font-medium text-zinc-900 underline">
            註冊
          </Link>
        </p>
      </form>
    </main>
  );
}
