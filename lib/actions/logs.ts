'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLogs, clockinLogs } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth-guard';
import { logActivity } from '@/lib/activity-log';

// Server-side backstop against duplicate clock-ins: if the same account already
// has a row for this exact QR token in the last window, don't write another.
// The client guards this too, but a stray re-fire / double-tap shouldn't be able
// to pollute the log (it once produced 26 dup rows for one scan).
const DEDUP_WINDOW_MS = 60_000;

export type LogEntry = {
  accountId: string;
  displayName: string;
  fcuNid: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
};

export async function logScanAttempts(
  token: string,
  entries: LogEntry[],
): Promise<Record<string, string>> {
  if (entries.length === 0) return {};
  const now = new Date();

  // Skip accounts that already logged this same token very recently.
  const since = new Date(now.getTime() - DEDUP_WINDOW_MS);
  const recent = await db
    .select({ id: clockinLogs.id, accountId: clockinLogs.accountId })
    .from(clockinLogs)
    .where(and(eq(clockinLogs.token, token), gt(clockinLogs.createdAt, since)));
  const recentByAccount = new Map(
    recent.flatMap((r) => (r.accountId ? [[r.accountId, r.id] as const] : [])),
  );
  const fresh = entries.filter((e) => !recentByAccount.has(e.accountId));
  if (fresh.length === 0) {
    // Everything was a duplicate — return the existing log ids so the client can
    // still attach its verify result to the original row.
    return Object.fromEntries(
      entries.flatMap((e) => {
        const existing = recentByAccount.get(e.accountId);
        return existing ? [[e.accountId, existing] as const] : [];
      }),
    );
  }

  const rows = fresh.map((e) => ({
    id: randomUUID(),
    accountId: e.accountId,
    displayName: e.displayName,
    fcuNid: e.fcuNid,
    token,
    status: e.status,
    errorMessage: e.errorMessage ?? null,
    verified: null,
    verifyMessage: null,
    verifyAt: null,
    createdAt: now,
  }));
  await db.insert(clockinLogs).values(rows);
  await logActivity('clockin', `掃描打卡 ${fresh.length} 人`, {
    token,
    accounts: fresh.map((e) => ({ name: e.displayName, nid: e.fcuNid, status: e.status })),
  });
  revalidatePath('/logs');
  // New rows + any deduped accounts mapped to their existing row, so the client
  // can attach verify results regardless of which path each account took.
  return Object.fromEntries([
    ...rows.map((r) => [r.accountId, r.id] as const),
    ...entries.flatMap((e) => {
      const existing = recentByAccount.get(e.accountId);
      return existing ? [[e.accountId, existing] as const] : [];
    }),
  ]);
}

export async function clearLogs() {
  await requireAdmin();
  await db.delete(clockinLogs);
  revalidatePath('/logs');
}

export async function clearActivity() {
  await requireAdmin();
  await db.delete(activityLogs);
  revalidatePath('/logs');
}
