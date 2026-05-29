import { redirect } from 'next/navigation';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { requireSession } from '@/lib/auth-helpers';
import { decryptCredential } from '@/lib/crypto/encryption';
import { ClassClockinClient } from './class-client';

export default async function ClassClockinPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const session = await requireSession();
  const { ids = '' } = await searchParams;
  const idList = ids.split(',').filter(Boolean);
  if (idList.length === 0) redirect('/');

  const rows = await db
    .select()
    .from(fcuAccounts)
    .where(and(eq(fcuAccounts.userId, session.userId), inArray(fcuAccounts.id, idList)))
    .orderBy(asc(fcuAccounts.sortOrder));

  const accounts = rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    fcuNid: r.fcuNid,
    fcuPassword: decryptCredential(
      session.masterKey,
      Buffer.from(r.nonce),
      Buffer.from(r.ciphertext),
      Buffer.from(r.authTag),
    ),
  }));

  return <ClassClockinClient accounts={accounts} />;
}
