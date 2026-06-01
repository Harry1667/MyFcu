import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { activityLogs, type ActivityLog } from '@/lib/db/schema';

type ActivityType = ActivityLog['type'];

/**
 * Record one operation to the activity feed. Best-effort: a logging failure
 * must never break the user action that triggered it.
 */
export async function logActivity(
  type: ActivityType,
  summary: string,
  detail?: unknown,
): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      id: randomUUID(),
      type,
      summary,
      detail: detail === undefined ? null : JSON.stringify(detail),
      createdAt: new Date(),
    });
    revalidatePath('/logs');
  } catch {
    /* swallow — never let logging break the action */
  }
}
