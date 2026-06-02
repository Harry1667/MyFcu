'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { encryptCredential } from '@/lib/crypto/encryption';
import { logActivity } from '@/lib/activity-log';

export type FormState = { ok: boolean; error?: string } | null;

const addSchema = z.object({
  displayName: z.string().min(1, '請輸入顯示名稱').max(30),
  fcuNid: z.string().regex(/^[A-Za-z]\d{7}$/, '學號格式錯誤（例：D1363482）'),
  fcuPassword: z.string().min(1, '請輸入 FCU 密碼'),
});

export async function addFcuAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = addSchema.safeParse({
    displayName: formData.get('displayName'),
    fcuNid: formData.get('fcuNid'),
    fcuPassword: formData.get('fcuPassword'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '輸入錯誤' };
  }
  const { displayName, fcuNid, fcuPassword } = parsed.data;

  const enc = encryptCredential(fcuPassword);

  const existing = await db
    .select({ s: fcuAccounts.sortOrder })
    .from(fcuAccounts)
    .orderBy(asc(fcuAccounts.sortOrder));

  await db.insert(fcuAccounts).values({
    id: randomUUID(),
    displayName,
    fcuNid: fcuNid.toUpperCase(),
    nonce: enc.nonce,
    ciphertext: enc.ciphertext,
    authTag: enc.authTag,
    sortOrder: existing.length,
    createdAt: new Date(),
  });

  await logActivity('account_add', `新增帳號：${displayName}（${fcuNid.toUpperCase()}）`);
  revalidatePath('/');
  redirect('/');
}

export async function setAccountHidden(id: string, hidden: boolean) {
  const [acc] = await db
    .select({ displayName: fcuAccounts.displayName, fcuNid: fcuAccounts.fcuNid })
    .from(fcuAccounts)
    .where(eq(fcuAccounts.id, id))
    .limit(1);
  await db.update(fcuAccounts).set({ isHidden: hidden }).where(eq(fcuAccounts.id, id));
  if (acc) {
    await logActivity(
      'account_update',
      `${hidden ? '隱藏' : '取消隱藏'}帳號：${acc.displayName}（${acc.fcuNid}）`,
    );
  }
  revalidatePath('/');
}

export async function deleteFcuAccount(id: string) {
  const [acc] = await db
    .select({ displayName: fcuAccounts.displayName, fcuNid: fcuAccounts.fcuNid })
    .from(fcuAccounts)
    .where(eq(fcuAccounts.id, id))
    .limit(1);
  await db.delete(fcuAccounts).where(eq(fcuAccounts.id, id));
  if (acc) await logActivity('account_delete', `刪除帳號：${acc.displayName}（${acc.fcuNid}）`);
  revalidatePath('/');
}
