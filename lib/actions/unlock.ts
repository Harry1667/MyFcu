'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { expectedToken, tokenForPin, SITE_AUTH_COOKIE } from '@/lib/site-pin';

export type UnlockState = { error?: string } | null;

export async function unlock(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const expected = await expectedToken();
  if (!expected) redirect('/'); // gate disabled — nothing to unlock

  const pin = String(formData.get('pin') ?? '');
  const token = await tokenForPin(pin);
  if (!token || token !== expected) {
    return { error: 'PIN 不正確' };
  }

  const jar = await cookies();
  jar.set(SITE_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // ~6 months
  });
  redirect('/');
}
