import { requireAdmin } from '@/lib/auth-guard';
import { listVaultsWithCounts } from '@/lib/actions/vaults';
import { VaultsClient } from './vaults-client';

export const dynamic = 'force-dynamic';

export default async function VaultsPage() {
  await requireAdmin();
  const vaults = await listVaultsWithCounts();
  return <VaultsClient vaults={vaults} />;
}
