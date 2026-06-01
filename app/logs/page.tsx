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
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="pt-2">
        <Link href="/" className="-ml-1 flex w-fit items-center text-[17px] text-[--tint]">
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none" className="mr-0.5">
            <path
              d="M9 1.5L2 9l7 7.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          首頁
        </Link>
        <h1 className="ios-title mt-2">打卡紀錄</h1>
      </header>

      {sessions.length === 0 ? (
        <div className="ios-card mt-6 px-6 py-12 text-center text-[15px] text-[--label-2]">
          還沒有紀錄。掃過 QR 之後會自動寫進來。
        </div>
      ) : (
        <LogsClient sessions={sessions} totalCount={rows.length} />
      )}
    </main>
  );
}
