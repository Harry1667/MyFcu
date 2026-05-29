import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const accounts = await db
    .select({
      id: fcuAccounts.id,
      displayName: fcuAccounts.displayName,
      fcuNid: fcuAccounts.fcuNid,
    })
    .from(fcuAccounts)
    .orderBy(asc(fcuAccounts.sortOrder));

  return <DashboardClient accounts={accounts} />;
}
