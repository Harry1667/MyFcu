import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { ensureAccountAccess, isAdmin } from '@/lib/auth-guard';
import { AccountPanel } from './account-client';
import { LockGate } from './lock-gate';

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
      isLocked: fcuAccounts.isLocked,
    })
    .from(fcuAccounts)
    .where(eq(fcuAccounts.id, id))
    .limit(1);

  if (!acc) redirect('/');
  // Block guessing an account id outside your unlocked vaults.
  await ensureAccountAccess(acc.vaultId);

  // Locked account: details need the admin password (clock-in is unaffected).
  if (acc.isLocked && !(await isAdmin())) {
    return <LockGate displayName={acc.displayName} fcuNid={acc.fcuNid} />;
  }

  return <AccountPanel account={{ id: acc.id, displayName: acc.displayName, fcuNid: acc.fcuNid }} />;
}
