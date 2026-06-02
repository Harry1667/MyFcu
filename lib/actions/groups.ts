'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accountGroups } from '@/lib/db/schema';
import { canAccessVault } from '@/lib/auth-guard';
import { logActivity } from '@/lib/activity-log';

export type GroupFormState = { ok: boolean; error?: string } | null;

const schema = z.object({
  name: z.string().trim().min(1, '請輸入群組名稱').max(20),
  memberIds: z.array(z.string()).min(1, '請至少選一個帳號'),
  vaultId: z.string().min(1, '缺少分檔'),
});

function parse(formData: FormData) {
  return schema.safeParse({
    name: formData.get('name'),
    memberIds: formData.getAll('memberIds').map(String),
    vaultId: formData.get('vaultId'),
  });
}

/** The vault a group belongs to, or undefined if the group is gone. */
async function groupVault(id: string): Promise<string | null | undefined> {
  const [g] = await db
    .select({ vaultId: accountGroups.vaultId })
    .from(accountGroups)
    .where(eq(accountGroups.id, id))
    .limit(1);
  return g?.vaultId;
}

export async function createGroup(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const p = parse(formData);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? '輸入錯誤' };
  if (!(await canAccessVault(p.data.vaultId))) return { ok: false, error: '無權限' };

  const existing = await db
    .select({ id: accountGroups.id })
    .from(accountGroups)
    .where(eq(accountGroups.vaultId, p.data.vaultId));
  await db.insert(accountGroups).values({
    id: randomUUID(),
    name: p.data.name,
    memberIds: p.data.memberIds,
    vaultId: p.data.vaultId,
    sortOrder: existing.length,
    createdAt: new Date(),
  });
  await logActivity('group_create', `建立群組：${p.data.name}（${p.data.memberIds.length} 人）`);
  revalidatePath('/');
  revalidatePath('/groups');
  return { ok: true };
}

export async function updateGroup(
  id: string,
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const p = parse(formData);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? '輸入錯誤' };
  const vault = await groupVault(id);
  if (vault === undefined) return { ok: false, error: '群組不存在' };
  if (!(await canAccessVault(vault))) return { ok: false, error: '無權限' };

  await db
    .update(accountGroups)
    .set({ name: p.data.name, memberIds: p.data.memberIds })
    .where(eq(accountGroups.id, id));
  await logActivity('group_update', `修改群組：${p.data.name}（${p.data.memberIds.length} 人）`);
  revalidatePath('/');
  revalidatePath('/groups');
  return { ok: true };
}

export async function deleteGroup(id: string) {
  const [g] = await db
    .select({ name: accountGroups.name, vaultId: accountGroups.vaultId })
    .from(accountGroups)
    .where(eq(accountGroups.id, id))
    .limit(1);
  if (!g) return;
  if (!(await canAccessVault(g.vaultId))) return;
  await db.delete(accountGroups).where(eq(accountGroups.id, id));
  await logActivity('group_delete', `刪除群組：${g.name}`);
  revalidatePath('/');
  revalidatePath('/groups');
}

/** Move a group up/down within its own vault; renormalises that vault's order. */
export async function moveGroup(id: string, dir: 'up' | 'down') {
  const vault = await groupVault(id);
  if (vault === undefined) return;
  if (!(await canAccessVault(vault))) return;

  const groups = await db
    .select({ id: accountGroups.id, vaultId: accountGroups.vaultId })
    .from(accountGroups)
    .orderBy(asc(accountGroups.sortOrder));
  const scoped = groups.filter((g) => g.vaultId === vault);
  const idx = scoped.findIndex((g) => g.id === id);
  const swap = dir === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= scoped.length) return;

  const order = scoped.map((g) => g.id);
  [order[idx], order[swap]] = [order[swap], order[idx]];
  await Promise.all(
    order.map((gid, i) =>
      db.update(accountGroups).set({ sortOrder: i }).where(eq(accountGroups.id, gid)),
    ),
  );
  revalidatePath('/');
  revalidatePath('/groups');
}
