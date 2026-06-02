'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { encryptCredential } from '@/lib/crypto/encryption';
import { requireAdmin, canAccessVault } from '@/lib/auth-guard';
import { logActivity } from '@/lib/activity-log';

export type FormState = { ok: boolean; error?: string } | null;

const addSchema = z.object({
  displayName: z.string().min(1, '請輸入顯示名稱').max(30),
  fcuNid: z.string().regex(/^[A-Za-z]\d{7}$/, '學號格式錯誤（例：D1363482）'),
  fcuPassword: z.string().min(1, '請輸入 FCU 密碼'),
  vaultId: z.string().optional(),
  isLocked: z.boolean().optional(),
});

export async function addFcuAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  // Only the admin can create accounts (and choose which vault they land in).
  await requireAdmin();

  const parsed = addSchema.safeParse({
    displayName: formData.get('displayName'),
    fcuNid: formData.get('fcuNid'),
    fcuPassword: formData.get('fcuPassword'),
    vaultId: formData.get('vaultId') ?? undefined,
    isLocked: formData.get('isLocked') === 'on',
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '輸入錯誤' };
  }
  const { displayName, fcuNid, fcuPassword, vaultId, isLocked } = parsed.data;

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
    vaultId: vaultId && vaultId.length > 0 ? vaultId : null,
    isLocked: Boolean(isLocked),
    createdAt: new Date(),
  });

  await logActivity('account_add', `新增帳號：${displayName}（${fcuNid.toUpperCase()}）`);
  revalidatePath('/');
  redirect('/');
}

const updateSchema = z.object({
  displayName: z.string().min(1, '請輸入顯示名稱').max(30),
  fcuPassword: z.string().optional(), // blank = keep current
  vaultId: z.string().optional(),
  isLocked: z.boolean().optional(),
});

/** Admin-only: edit name, optionally password, vault, and lock flag. */
export async function updateFcuAccount(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = updateSchema.safeParse({
    displayName: formData.get('displayName'),
    fcuPassword: formData.get('fcuPassword') || undefined,
    vaultId: formData.get('vaultId') ?? undefined,
    isLocked: formData.get('isLocked') === 'on',
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? '輸入錯誤' };
  const { displayName, fcuPassword, vaultId, isLocked } = parsed.data;

  const set: Record<string, unknown> = {
    displayName,
    vaultId: vaultId && vaultId.length > 0 ? vaultId : null,
    isLocked: Boolean(isLocked),
  };
  if (fcuPassword && fcuPassword.length > 0) {
    const enc = encryptCredential(fcuPassword);
    set.nonce = enc.nonce;
    set.ciphertext = enc.ciphertext;
    set.authTag = enc.authTag;
  }
  await db.update(fcuAccounts).set(set).where(eq(fcuAccounts.id, id));
  await logActivity('account_update', `更新帳號：${displayName}`);
  revalidatePath('/');
  redirect('/');
}

/** Lock/unlock an account. Allowed for the admin or any member of its vault. */
export async function setAccountLocked(id: string, locked: boolean) {
  const [acc] = await db
    .select({ vaultId: fcuAccounts.vaultId, displayName: fcuAccounts.displayName })
    .from(fcuAccounts)
    .where(eq(fcuAccounts.id, id))
    .limit(1);
  if (!acc) return;
  if (!(await canAccessVault(acc.vaultId))) return;
  await db.update(fcuAccounts).set({ isLocked: locked }).where(eq(fcuAccounts.id, id));
  await logActivity('account_update', `${locked ? '上鎖' : '解鎖'}帳號：${acc.displayName}`);
  revalidatePath('/');
}

export async function deleteFcuAccount(id: string) {
  await requireAdmin();
  const [acc] = await db
    .select({ displayName: fcuAccounts.displayName, fcuNid: fcuAccounts.fcuNid })
    .from(fcuAccounts)
    .where(eq(fcuAccounts.id, id))
    .limit(1);
  await db.delete(fcuAccounts).where(eq(fcuAccounts.id, id));
  if (acc) await logActivity('account_delete', `刪除帳號：${acc.displayName}（${acc.fcuNid}）`);
  revalidatePath('/');
}
