import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { ensureAccountAccess } from '@/lib/auth-guard';
import { AccountPanel } from './account-client';

export const dynamic = 'force-dynamic';

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [acc] = await db
    .select({
      id: fcuAccounts.id,
      displayName: fcuAccounts.displayName,
      fcuNid: fcuAccounts.fcuNid,
      vaultId: fcuAccounts.vaultId,
    })
    .from(fcuAccounts)
    .where(eq(fcuAccounts.id, id))
    .limit(1);

  if (!acc) redirect('/');
  // Block guessing an account id outside your unlocked vaults.
  await ensureAccountAccess(acc.vaultId);

  return <AccountPanel account={{ id: acc.id, displayName: acc.displayName, fcuNid: acc.fcuNid }} />;
}
