import { redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts, vaults } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth-guard';
import { EditAccountForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
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

  const vaultRows = await db
    .select({ id: vaults.id, name: vaults.name })
    .from(vaults)
    .orderBy(asc(vaults.sortOrder));

  return <EditAccountForm account={acc} vaults={vaultRows} />;
}
