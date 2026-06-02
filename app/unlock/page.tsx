import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vaults } from '@/lib/db/schema';
import { UnlockPicker } from './unlock-picker';

export const dynamic = 'force-dynamic';

export default async function UnlockPage() {
  const rows = await db
    .select({ id: vaults.id, name: vaults.name })
    .from(vaults)
    .orderBy(asc(vaults.sortOrder));
  return <UnlockPicker vaults={rows} />;
}
