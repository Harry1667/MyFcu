import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountGroups, fcuAccounts } from '@/lib/db/schema';
import { GroupsManager } from './groups-client';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const [accounts, groups] = await Promise.all([
    db
      .select({ id: fcuAccounts.id, displayName: fcuAccounts.displayName, fcuNid: fcuAccounts.fcuNid })
      .from(fcuAccounts)
      .orderBy(asc(fcuAccounts.sortOrder)),
    db.select().from(accountGroups).orderBy(asc(accountGroups.sortOrder)),
  ]);

  return (
    <GroupsManager
      accounts={accounts}
      groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.memberIds }))}
    />
  );
}
