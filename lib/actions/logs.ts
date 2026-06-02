'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { activityLogs, clockinLogs } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth-guard';
import { logActivity } from '@/lib/activity-log';

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
  const rows = entries.map((e) => ({
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
  await logActivity('clockin', `掃描打卡 ${entries.length} 人`, {
    token,
    accounts: entries.map((e) => ({ name: e.displayName, nid: e.fcuNid, status: e.status })),
  });
  revalidatePath('/logs');
  return Object.fromEntries(rows.map((r) => [r.accountId, r.id]));
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
