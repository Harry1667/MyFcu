import { redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountGroups, fcuAccounts, vaults } from '@/lib/db/schema';
import { accessContext } from '@/lib/auth-guard';
import { GroupsManager } from './groups-client';

export const dynamic = 'force-dynamic';

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ vault?: string }>;
}) {
  const { vault: vaultParam } = await searchParams;
  const { isAdmin, vaultIds } = await accessContext();

  const allVaults = await db
    .select({ id: vaults.id, name: vaults.name })
    .from(vaults)
    .orderBy(asc(vaults.sortOrder));
  const accessible = isAdmin ? allVaults : allVaults.filter((v) => vaultIds.has(v.id));
  if (accessible.length === 0) redirect('/unlock');

  const current = accessible.find((v) => v.id === vaultParam) ?? accessible[0];

  const [accounts, groups] = await Promise.all([
    db
      .select({ id: fcuAccounts.id, displayName: fcuAccounts.displayName, fcuNid: fcuAccounts.fcuNid })
      .from(fcuAccounts)
      .where(eq(fcuAccounts.vaultId, current.id))
      .orderBy(asc(fcuAccounts.sortOrder)),
    db
      .select()
      .from(accountGroups)
      .where(eq(accountGroups.vaultId, current.id))
      .orderBy(asc(accountGroups.sortOrder)),
  ]);

  return (
    <GroupsManager
      accounts={accounts}
      groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.memberIds }))}
      currentVault={current}
      vaults={accessible}
    />
  );
}
