import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/lib/db';
import { clockinLogs } from '@/lib/db/schema';
import { LogsClient } from './logs-client';

export const dynamic = 'force-dynamic';

export default async function LogsPage() {
  const rows = await db
    .select()
    .from(clockinLogs)
    .orderBy(desc(clockinLogs.createdAt))
    .limit(500);

  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.createdAt.getTime()}|${r.token}`;
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  }

  const sessions = [...grouped.entries()].map(([key, items]) => ({
    key,
    createdAt: items[0].createdAt,
    token: items[0].token,
    items: items.map((it) => ({
      id: it.id,
      displayName: it.displayName,
      fcuNid: it.fcuNid,
      status: it.status,
      errorMessage: it.errorMessage,
      verified: it.verified,
      verifyMessage: it.verifyMessage,
    })),
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">打卡紀錄</h1>
        <Link href="/" className="text-sm text-zinc-600 underline">
          回首頁
        </Link>
      </header>

      {sessions.length === 0 ? (
        <div className="mt-12 rounded-2xl border-2 border-dashed border-zinc-300 p-12 text-center text-zinc-500">
          還沒有紀錄。掃過 QR 之後會自動寫進來。
        </div>
      ) : (
        <LogsClient sessions={sessions} totalCount={rows.length} />
      )}
    </main>
  );
}
