import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { decryptCredential } from '@/lib/crypto/encryption';
import type { FcuCredential } from './types';

/**
 * Load one stored account and decrypt its FCU password.
 * Returns null if the account is gone or the ciphertext can't be opened.
 *
 * The returned password is for backend FCU calls only — never log it, never
 * return it past a server action boundary except where the front-end clock-in
 * flow already requires it.
 */
export async function loadAccountWithPassword(
  accountId: string,
): Promise<FcuCredential | null> {
  const [acc] = await db
    .select()
    .from(fcuAccounts)
    .where(eq(fcuAccounts.id, accountId))
    .limit(1);
  if (!acc) return null;

  let password: string;
  try {
    password = decryptCredential(
      Buffer.from(acc.nonce),
      Buffer.from(acc.ciphertext),
      Buffer.from(acc.authTag),
    );
  } catch {
    return null;
  }

  return {
    id: acc.id,
    displayName: acc.displayName,
    fcuNid: acc.fcuNid,
    password,
  };
}
