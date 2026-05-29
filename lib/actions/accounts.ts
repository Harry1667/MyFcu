'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { encryptCredential } from '@/lib/crypto/encryption';
import { requireSession } from '@/lib/auth-helpers';
import type { FormState } from '@/lib/actions/auth';

const addSchema = z.object({
  displayName: z.string().min(1, '請輸入顯示名稱').max(30),
  fcuNid: z.string().regex(/^[A-Za-z]\d{7}$/, '學號格式錯誤（例：D1363482）'),
  fcuPassword: z.string().min(1, '請輸入 FCU 密碼'),
});

export async function addFcuAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();

  const parsed = addSchema.safeParse({
    displayName: formData.get('displayName'),
    fcuNid: formData.get('fcuNid'),
    fcuPassword: formData.get('fcuPassword'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '輸入錯誤' };
  }
  const { displayName, fcuNid, fcuPassword } = parsed.data;

  const enc = encryptCredential(session.masterKey, fcuPassword);

  const maxOrder = await db
    .select({ s: fcuAccounts.sortOrder })
    .from(fcuAccounts)
    .where(eq(fcuAccounts.userId, session.userId))
    .orderBy(asc(fcuAccounts.sortOrder));

  await db.insert(fcuAccounts).values({
    id: randomUUID(),
    userId: session.userId,
    displayName,
    fcuNid: fcuNid.toUpperCase(),
    nonce: enc.nonce,
    ciphertext: enc.ciphertext,
    authTag: enc.authTag,
    sortOrder: maxOrder.length,
    createdAt: new Date(),
  });

  revalidatePath('/');
  redirect('/');
}

export async function deleteFcuAccount(id: string) {
  const session = await requireSession();
  await db
    .delete(fcuAccounts)
    .where(and(eq(fcuAccounts.id, id), eq(fcuAccounts.userId, session.userId)));
  revalidatePath('/');
}
