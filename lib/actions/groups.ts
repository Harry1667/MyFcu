'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accountGroups } from '@/lib/db/schema';

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

  await db
    .update(accountGroups)
    .set({ name: p.data.name, memberIds: p.data.memberIds })
    .where(eq(accountGroups.id, id));
  revalidatePath('/');
  revalidatePath('/groups');
  return { ok: true };
}

export async function deleteGroup(id: string) {
  await db.delete(accountGroups).where(eq(accountGroups.id, id));
  revalidatePath('/');
  revalidatePath('/groups');
}

export async function listGroups() {
  return db.select().from(accountGroups).orderBy(asc(accountGroups.sortOrder));
}
