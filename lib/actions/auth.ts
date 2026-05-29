'use server';

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { generateKdfSalt, hashPassword } from '@/lib/crypto/encryption';

const registerSchema = z.object({
  email: z.string().email('email 格式錯誤'),
  password: z.string().min(8, '密碼至少 8 字'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: '兩次密碼不一致',
  path: ['confirm'],
});

export type FormState = { ok: boolean; error?: string } | null;

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '輸入錯誤' };
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing.length > 0) {
    return { ok: false, error: '此 email 已註冊' };
  }

  const passwordHash = await hashPassword(password);
  const saltKdf = generateKdfSalt();

  await db.insert(users).values({
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash,
    saltKdf,
    createdAt: new Date(),
  });

  try {
    await signIn('credentials', {
      email: normalizedEmail,
      password,
      redirectTo: '/',
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: '註冊成功但自動登入失敗，請手動登入' };
    }
    throw e;
  }
  return { ok: true };
}

const loginSchema = z.object({
  email: z.string().email('email 格式錯誤'),
  password: z.string().min(1, '請輸入密碼'),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '輸入錯誤' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirectTo: '/',
    });
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.type === 'CredentialsSignin') {
        return { ok: false, error: 'email 或密碼錯誤' };
      }
      return { ok: false, error: '登入失敗' };
    }
    throw e;
  }
  return { ok: true };
}

export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}
