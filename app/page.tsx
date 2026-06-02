import { cookies } from 'next/headers';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountGroups, fcuAccounts } from '@/lib/db/schema';
import { HIDDEN_REVEAL_COOKIE, hiddenGateEnabled, isRevealed } from '@/lib/hidden-accounts';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const jar = await cookies();
  const revealed = await isRevealed(jar.get(HIDDEN_REVEAL_COOKIE)?.value);
  const gateEnabled = hiddenGateEnabled();

  const [allAccounts, groups] = await Promise.all([
    db
      .select({
        id: fcuAccounts.id,
        displayName: fcuAccounts.displayName,
        fcuNid: fcuAccounts.fcuNid,
        isHidden: fcuAccounts.isHidden,
      })
      .from(fcuAccounts)
      .orderBy(asc(fcuAccounts.sortOrder)),
    db.select().from(accountGroups).orderBy(asc(accountGroups.sortOrder)),
  ]);

  // When the visitor isn't revealed, drop hidden accounts entirely — this also
  // keeps them out of group selection, select-all, health check and clock-in,
  // since all of those derive from this list.
  const accounts = revealed ? allAccounts : allAccounts.filter((a) => !a.isHidden);
  const hiddenCount = allAccounts.filter((a) => a.isHidden).length;

  return (
    <DashboardClient
      accounts={accounts}
      groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.memberIds }))}
      revealed={revealed}
      gateEnabled={gateEnabled}
      hiddenCount={hiddenCount}
    />
  );
}
