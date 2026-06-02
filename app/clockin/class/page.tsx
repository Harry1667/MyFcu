import { redirect } from 'next/navigation';
import { asc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { decryptCredential } from '@/lib/crypto/encryption';
import { accessContext } from '@/lib/auth-guard';
import { ClassClockinClient } from './class-client';

export const dynamic = 'force-dynamic';

export default async function ClassClockinPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids = '' } = await searchParams;
  const idList = ids.split(',').filter(Boolean);
  if (idList.length === 0) redirect('/');

  const rows = await db
    .select()
    .from(fcuAccounts)
    .where(inArray(fcuAccounts.id, idList))
    .orderBy(asc(fcuAccounts.sortOrder));

  // Drop any requested account outside the caller's unlocked vaults (admin sees
  // all). Stops clocking in someone else's vault by guessing ids.
  const { isAdmin, vaultIds } = await accessContext();
  const allowed = rows.filter((r) => isAdmin || (r.vaultId != null && vaultIds.has(r.vaultId)));
  if (allowed.length === 0) redirect('/');

  const accounts = allowed.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    fcuNid: r.fcuNid,
    fcuPassword: decryptCredential(
      Buffer.from(r.nonce),
      Buffer.from(r.ciphertext),
      Buffer.from(r.authTag),
    ),
  }));

  return <ClassClockinClient accounts={accounts} />;
}
