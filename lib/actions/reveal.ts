'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  expectedRevealToken,
  tokenForCode,
  HIDDEN_REVEAL_COOKIE,
} from '@/lib/hidden-accounts';

export type RevealState = { error?: string } | null;

export async function revealHidden(_prev: RevealState, formData: FormData): Promise<RevealState> {
  const expected = await expectedRevealToken();
  if (!expected) redirect('/'); // gate dormant — nothing to reveal

  const code = String(formData.get('code') ?? '');
  const token = await tokenForCode(code);
  if (!token || token !== expected) {
    return { error: '揭露碼不正確' };
  }

  const jar = await cookies();
  jar.set(HIDDEN_REVEAL_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // ~6 months
  });
  redirect('/');
}

/** Forget the reveal cookie — hidden accounts disappear again on this device. */
export async function hideAgain() {
  const jar = await cookies();
  jar.delete(HIDDEN_REVEAL_COOKIE);
  redirect('/');
}
