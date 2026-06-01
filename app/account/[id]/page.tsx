import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
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
    })
    .from(fcuAccounts)
    .where(eq(fcuAccounts.id, id))
    .limit(1);

  if (!acc) redirect('/');

  return <AccountPanel account={acc} />;
}
