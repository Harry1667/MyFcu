import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { requireSession } from '@/lib/auth-helpers';
import { DashboardClient } from './dashboard-client';

export default async function HomePage() {
  const session = await requireSession();
  const accounts = await db
    .select({
      id: fcuAccounts.id,
      displayName: fcuAccounts.displayName,
      fcuNid: fcuAccounts.fcuNid,
    })
    .from(fcuAccounts)
    .where(eq(fcuAccounts.userId, session.userId))
    .orderBy(asc(fcuAccounts.sortOrder));

  return <DashboardClient accounts={accounts} userEmail={session.email ?? ''} />;
}
