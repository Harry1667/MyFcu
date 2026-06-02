import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountGroups, fcuAccounts, vaults } from '@/lib/db/schema';
import { ADMIN_COOKIE, VAULT_COOKIE, isAdminCookie, parseUnlocked } from '@/lib/vaults';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const jar = await cookies();
  const isAdmin = await isAdminCookie(jar.get(ADMIN_COOKIE)?.value);
  const unlockedTokens = parseUnlocked(jar.get(VAULT_COOKIE)?.value);

  const [allAccounts, allVaults, groups] = await Promise.all([
    db
      .select({
        id: fcuAccounts.id,
        displayName: fcuAccounts.displayName,
        fcuNid: fcuAccounts.fcuNid,
        vaultId: fcuAccounts.vaultId,
        isLocked: fcuAccounts.isLocked,
      })
      .from(fcuAccounts)
      .orderBy(asc(fcuAccounts.sortOrder)),
    db.select().from(vaults).orderBy(asc(vaults.sortOrder)),
    db.select().from(accountGroups).orderBy(asc(accountGroups.sortOrder)),
  ]);

  // Which vaults can this visitor see?
  const visibleVaults = isAdmin
    ? allVaults
    : allVaults.filter((v) => unlockedTokens.has(v.passToken));
  const visibleVaultIds = new Set(visibleVaults.map((v) => v.id));

  // Admin sees everything (including unassigned). Members see only accounts in
  // a vault they've unlocked.
  const accounts = isAdmin
    ? allAccounts
    : allAccounts.filter((a) => a.vaultId != null && visibleVaultIds.has(a.vaultId));

  // Non-admin with nothing unlocked (e.g. forged/empty cookie) → back to unlock.
  if (!isAdmin && visibleVaults.length === 0) redirect('/unlock');

  return (
    <DashboardClient
      isAdmin={isAdmin}
      accounts={accounts}
      vaults={visibleVaults.map((v) => ({ id: v.id, name: v.name }))}
      groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.memberIds }))}
    />
  );
}
