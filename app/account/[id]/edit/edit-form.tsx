'use client';

import { useActionState, useTransition } from 'react';
import Link from 'next/link';
import { deleteFcuAccount, updateFcuAccount, type FormState } from '@/lib/actions/accounts';
import { IconChevronLeft } from '@/app/icons';

type Account = {
  id: string;
  displayName: string;
  fcuNid: string;
  vaultId: string | null;
  isLocked: boolean;
};
type Vault = { id: string; name: string };

export function EditAccountForm({ account, vaults }: { account: Account; vaults: Vault[] }) {
  const action = updateFcuAccount.bind(null, account.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const [deleting, startDelete] = useTransition();

  const onDelete = () => {
    if (!confirm(`刪除 ${account.displayName}（${account.fcuNid}）？此動作無法復原。`)) return;
    startDelete(async () => {
      await deleteFcuAccount(account.id);
      window.location.href = '/';
    });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="pt-2">
        <Link href="/" className="-ml-1 flex w-fit items-center text-[17px] text-[--tint]">
          <IconChevronLeft size={22} />
          首頁
        </Link>
        <h1 className="ios-title mt-2">編輯帳號</h1>
        <p className="mt-0.5 font-mono text-[13px] text-[--label-2]">{account.fcuNid}</p>
      </header>

      <form action={formAction} className="mt-6 space-y-6">
        <div className="space-y-1.5">
          <label htmlFor="displayName" className="ios-section block">
            顯示名稱
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            maxLength={30}
            defaultValue={account.displayName}
            className="ios-input"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="fcuPassword" className="ios-section block">
            FCU 密碼
          </label>
          <input
            id="fcuPassword"
            name="fcuPassword"
            type="password"
            autoComplete="off"
            placeholder="留空＝不變更"
            className="ios-input"
          />
          <p className="px-4 pt-1 text-[12px] text-[--label-3]">只有要換密碼時才填。</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="vaultId" className="ios-section block">
            分檔
          </label>
          <select
            id="vaultId"
            name="vaultId"
            defaultValue={account.vaultId ?? ''}
            className="ios-input"
          >
            <option value="">未分檔（只有管理員看得到）</option>
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <label className="ios-card flex items-center justify-between px-4 py-3">
          <span>
            <span className="block text-[15px] text-[--label]">上鎖此帳號</span>
            <span className="block text-[12px] text-[--label-2]">
              仍可打卡，但要看詳情需管理員密碼
            </span>
          </span>
          <input
            type="checkbox"
            name="isLocked"
            defaultChecked={account.isLocked}
            className="h-5 w-5 accent-[#34c759]"
          />
        </label>

        {state?.error && (
          <p className="rounded-xl bg-[--fill] px-4 py-3 text-[15px] text-[--danger]">{state.error}</p>
        )}

        <button type="submit" disabled={pending} className="ios-btn">
          {pending ? '儲存中…' : '儲存'}
        </button>
      </form>

      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="ios-card mt-6 w-full py-3 text-center text-[16px] font-medium text-[--danger] active:opacity-70"
      >
        {deleting ? '刪除中…' : '刪除帳號'}
      </button>
    </main>
  );
}
