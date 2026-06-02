'use client';

import { useActionState, useTransition } from 'react';
import Link from 'next/link';
import {
  createVault,
  deleteVault,
  renameVault,
  setVaultPassword,
  type VaultFormState,
} from '@/lib/actions/vaults';

type VaultRow = { id: string; name: string; count: number };

export function VaultsClient({ vaults }: { vaults: VaultRow[] }) {
  const [state, formAction, pending] = useActionState<VaultFormState, FormData>(createVault, null);
  const [busy, startTransition] = useTransition();

  const onRename = (v: VaultRow) => {
    const name = prompt('分檔新名稱', v.name)?.trim();
    if (!name || name === v.name) return;
    startTransition(() => renameVault(v.id, name));
  };

  const onChangePassword = (v: VaultRow) => {
    const pw = prompt(`設定「${v.name}」的新密碼`)?.trim();
    if (!pw) return;
    startTransition(async () => {
      const r = await setVaultPassword(v.id, pw);
      if (r && !r.ok) alert(r.error ?? '設定失敗');
    });
  };

  const onDelete = (v: VaultRow) => {
    if (!confirm(`刪除分檔「${v.name}」？裡面的 ${v.count} 個帳號會退回「未分檔」（只有你看得到），不會被刪除。`))
      return;
    startTransition(() => deleteVault(v.id));
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="-ml-1 flex w-fit items-center text-[17px] text-[--tint]">
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none" className="mr-0.5">
            <path d="M9 1.5L2 9l7 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          完成
        </Link>
        <h1 className="text-[17px] font-semibold text-[--label]">分檔管理</h1>
        <span className="w-12" />
      </header>

      <p className="mt-3 text-[13px] text-[--label-2]">
        每個分檔一組密碼，把密碼給對應的人。他們輸入密碼只看得到自己分檔的帳號，可以打卡、看詳情，但不能增刪。
      </p>

      <section className="mt-6">
        <div className="ios-section">建立新分檔</div>
        <form action={formAction} className="ios-card space-y-2 p-3">
          <input name="name" required maxLength={30} placeholder="分檔名稱（例：資工二甲）" className="ios-input" />
          <input
            name="password"
            required
            maxLength={64}
            autoComplete="off"
            placeholder="分檔密碼（例：1234）"
            className="ios-input"
          />
          {state?.error && <p className="px-1 text-[13px] text-[--danger]">{state.error}</p>}
          {state?.ok && <p className="px-1 text-[13px] text-[--tint]">已建立分檔。</p>}
          <button type="submit" disabled={pending} className="ios-btn">
            {pending ? '建立中…' : '建立分檔'}
          </button>
        </form>
      </section>

      <section className="mt-6 flex-1">
        <div className="ios-section">現有分檔（{vaults.length}）</div>
        {vaults.length === 0 ? (
          <div className="ios-card px-4 py-8 text-center text-[15px] text-[--label-2]">
            還沒有分檔。在上面建立第一個。
          </div>
        ) : (
          <ul className="ios-card">
            {vaults.map((v, i) => (
              <li key={v.id} className="relative px-4 py-3">
                {i > 0 && <span className="ios-divider absolute top-0 right-0 left-4" />}
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-[17px] text-[--label]">{v.name}</div>
                    <div className="text-[12px] text-[--label-2]">{v.count} 個帳號</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[14px]">
                    <button type="button" onClick={() => onRename(v)} disabled={busy} className="text-[--tint]">
                      改名
                    </button>
                    <button type="button" onClick={() => onChangePassword(v)} disabled={busy} className="text-[--tint]">
                      改密碼
                    </button>
                    <button type="button" onClick={() => onDelete(v)} disabled={busy} className="text-[--danger]">
                      刪除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 px-1 text-[12px] text-[--label-3]">
          把帳號分配到哪個分檔，在首頁「編輯」模式裡每個帳號下方選。
        </p>
      </section>
    </main>
  );
}
