import { redirect } from 'next/navigation';
import { asc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fcuAccounts } from '@/lib/db/schema';
import { decryptCredential } from '@/lib/crypto/encryption';
import { CodeClockinClient } from './code-client';

type CodeMode = 'parttime_code' | 'active_code' | 'assistant_code';
const VALID: CodeMode[] = ['parttime_code', 'active_code', 'assistant_code'];

export const dynamic = 'force-dynamic';

export default async function CodeClockinPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; mode?: string }>;
}) {
  const { ids = '', mode = '' } = await searchParams;
  const idList = ids.split(',').filter(Boolean);
  if (idList.length === 0) redirect('/');
  if (!VALID.includes(mode as CodeMode)) redirect('/');

  const rows = await db
    .select()
    .from(fcuAccounts)
    .where(inArray(fcuAccounts.id, idList))
    .orderBy(asc(fcuAccounts.sortOrder));

  const accounts = rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    fcuNid: r.fcuNid,
    fcuPassword: decryptCredential(
      Buffer.from(r.nonce),
      Buffer.from(r.ciphertext),
      Buffer.from(r.authTag),
    ),
  }));

  return <CodeClockinClient accounts={accounts} mode={mode as CodeMode} />;
}
