'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accountGroups } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth-guard';
import { logActivity } from '@/lib/activity-log';

export type GroupFormState = { ok: boolean; error?: string } | null;

const schema = z.object({
  name: z.string().trim().min(1, '請輸入群組名稱').max(20),
  memberIds: z.array(z.string()).min(1, '請至少選一個帳號'),
});

function parse(formData: FormData) {
  return schema.safeParse({
    name: formData.get('name'),
    memberIds: formData.getAll('memberIds').map(String),
  });
}

export async function createGroup(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  await requireAdmin();
  const p = parse(formData);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? '輸入錯誤' };

  const existing = await db.select({ s: accountGroups.sortOrder }).from(accountGroups);
  await db.insert(accountGroups).values({
    id: randomUUID(),
    name: p.data.name,
    memberIds: p.data.memberIds,
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
  await requireAdmin();
  const p = parse(formData);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? '輸入錯誤' };

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
  await requireAdmin();
  const [g] = await db
    .select({ name: accountGroups.name })
    .from(accountGroups)
    .where(eq(accountGroups.id, id))
    .limit(1);
  await db.delete(accountGroups).where(eq(accountGroups.id, id));
  if (g) await logActivity('group_delete', `刪除群組：${g.name}`);
  revalidatePath('/');
  revalidatePath('/groups');
}

export async function listGroups() {
  return db.select().from(accountGroups).orderBy(asc(accountGroups.sortOrder));
}

/** Move a group up or down one slot; renormalises every sortOrder to its index. */
export async function moveGroup(id: string, dir: 'up' | 'down') {
  await requireAdmin();
  const groups = await db
    .select({ id: accountGroups.id })
    .from(accountGroups)
    .orderBy(asc(accountGroups.sortOrder));
  const idx = groups.findIndex((g) => g.id === id);
  const swap = dir === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= groups.length) return;

  const order = groups.map((g) => g.id);
  [order[idx], order[swap]] = [order[swap], order[idx]];

  await Promise.all(
    order.map((gid, i) =>
      db.update(accountGroups).set({ sortOrder: i }).where(eq(accountGroups.id, gid)),
    ),
  );
  revalidatePath('/');
  revalidatePath('/groups');
}
