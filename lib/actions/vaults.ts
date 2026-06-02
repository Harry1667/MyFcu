'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fcuAccounts, vaults } from '@/lib/db/schema';
import {
  ADMIN_COOKIE,
  VAULT_COOKIE,
  adminToken,
  parseUnlocked,
  serializeUnlocked,
  tokenFor,
} from '@/lib/vaults';
import { requireAdmin } from '@/lib/auth-guard';
import { logActivity } from '@/lib/activity-log';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 180, // ~6 months
};

export type UnlockState = { error?: string } | null;

/**
 * Single entry password. Admin PIN → admin cookie (see all + manage). Otherwise
 * a vault password → that vault's token is added to the unlocked set. Wrong →
 * error.
 */
export async function unlock(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const pw = String(formData.get('password') ?? '').trim();
  if (!pw) return { error: '請輸入密碼' };

  const token = await tokenFor(pw);
  if (!token) return { error: '伺服器未設定，無法解鎖' };

  const jar = await cookies();

  // Admin?
  const admin = await adminToken();
  if (admin && token === admin) {
    jar.set(ADMIN_COOKIE, token, COOKIE_OPTS);
    redirect('/');
  }

  // A vault?
  const match = await db
    .select({ id: vaults.id })
    .from(vaults)
    .where(eq(vaults.passToken, token))
    .limit(1);
  if (match.length > 0) {
    const unlocked = parseUnlocked(jar.get(VAULT_COOKIE)?.value);
    unlocked.add(token);
    jar.set(VAULT_COOKIE, serializeUnlocked(unlocked), COOKIE_OPTS);
    redirect('/');
  }

  return { error: '密碼不正確' };
}

/** Forget all access on this device (admin + every unlocked vault). */
export async function lockAll() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  jar.delete(VAULT_COOKIE);
  redirect('/unlock');
}

const nameSchema = z.string().trim().min(1, '請輸入分檔名稱').max(30);
const pwSchema = z.string().trim().min(1, '請輸入密碼').max(64);

export type VaultFormState = { ok: boolean; error?: string } | null;

export async function createVault(
  _prev: VaultFormState,
  formData: FormData,
): Promise<VaultFormState> {
  await requireAdmin();
  const name = nameSchema.safeParse(formData.get('name'));
  const pw = pwSchema.safeParse(formData.get('password'));
  if (!name.success) return { ok: false, error: name.error.issues[0]?.message };
  if (!pw.success) return { ok: false, error: pw.error.issues[0]?.message };

  const token = await tokenFor(pw.data);
  if (!token) return { ok: false, error: '伺服器未設定' };

  // Reject a password already used by another vault (or the admin PIN), so an
  // entered password maps to exactly one place.
  const admin = await adminToken();
  if (admin && token === admin) return { ok: false, error: '不能用管理員密碼當分檔密碼' };
  const dupe = await db.select({ id: vaults.id }).from(vaults).where(eq(vaults.passToken, token));
  if (dupe.length > 0) return { ok: false, error: '這組密碼已被其他分檔使用' };

  const existing = await db.select({ id: vaults.id }).from(vaults);
  await db.insert(vaults).values({
    id: randomUUID(),
    name: name.data,
    passToken: token,
    sortOrder: existing.length,
    createdAt: new Date(),
  });
  await logActivity('vault_create', `建立分檔：${name.data}`);
  revalidatePath('/');
  revalidatePath('/vaults');
  return { ok: true };
}

export async function renameVault(id: string, name: string) {
  await requireAdmin();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return;
  await db.update(vaults).set({ name: parsed.data }).where(eq(vaults.id, id));
  await logActivity('vault_update', `重新命名分檔：${parsed.data}`);
  revalidatePath('/');
  revalidatePath('/vaults');
}

export async function setVaultPassword(id: string, password: string) {
  await requireAdmin();
  const parsed = pwSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const token = await tokenFor(parsed.data);
  if (!token) return { ok: false, error: '伺服器未設定' };
  const admin = await adminToken();
  if (admin && token === admin) return { ok: false, error: '不能用管理員密碼' };
  const dupe = await db.select({ id: vaults.id }).from(vaults).where(eq(vaults.passToken, token));
  if (dupe.some((d) => d.id !== id)) return { ok: false, error: '這組密碼已被其他分檔使用' };
  await db.update(vaults).set({ passToken: token }).where(eq(vaults.id, id));
  await logActivity('vault_update', '更新分檔密碼');
  revalidatePath('/vaults');
  return { ok: true };
}

export async function deleteVault(id: string) {
  await requireAdmin();
  const [v] = await db.select({ name: vaults.name }).from(vaults).where(eq(vaults.id, id)).limit(1);
  // Orphan its accounts back to unassigned (admin-only) rather than deleting them.
  await db.update(fcuAccounts).set({ vaultId: null }).where(eq(fcuAccounts.vaultId, id));
  await db.delete(vaults).where(eq(vaults.id, id));
  if (v) await logActivity('vault_delete', `刪除分檔：${v.name}（成員退回未分檔）`);
  revalidatePath('/');
  revalidatePath('/vaults');
}

/** Move one account into a vault (or null = back to unassigned). Admin only. */
export async function assignAccountVault(accountId: string, vaultId: string | null) {
  await requireAdmin();
  await db.update(fcuAccounts).set({ vaultId }).where(eq(fcuAccounts.id, accountId));
  revalidatePath('/');
  revalidatePath('/vaults');
}

/** Admin-only list of vaults with their member counts, for the manage page. */
export async function listVaultsWithCounts() {
  await requireAdmin();
  const [vs, accs] = await Promise.all([
    db.select().from(vaults).orderBy(asc(vaults.sortOrder)),
    db.select({ id: fcuAccounts.id, vaultId: fcuAccounts.vaultId }).from(fcuAccounts),
  ]);
  return vs.map((v) => ({
    id: v.id,
    name: v.name,
    count: accs.filter((a) => a.vaultId === v.id).length,
  }));
}
