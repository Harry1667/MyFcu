import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vaults } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth-guard';
import { NewAccountForm } from './new-account-form';

export const dynamic = 'force-dynamic';

export default async function NewAccountPage() {
  await requireAdmin();
  const rows = await db
    .select({ id: vaults.id, name: vaults.name })
    .from(vaults)
    .orderBy(asc(vaults.sortOrder));
  return <NewAccountForm vaults={rows} />;
}
