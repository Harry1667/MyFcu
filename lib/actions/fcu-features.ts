'use server';

import { loadAccountWithPassword } from '@/lib/fcu/account';
import { fetchTimetable } from '@/lib/fcu/timetable';
import { fetchStudentCard } from '@/lib/fcu/card';
import { fetchAbsence, fetchExamSchedule } from '@/lib/fcu/myfcu';
import type {
  AbsenceRecord,
  ExamSchedule,
  FcuCredential,
  FeatureResult,
  StudentCard,
  Timetable,
} from '@/lib/fcu/types';

/**
 * Shared wrapper: load+decrypt the account, run the FCU fetch, and box the
 * outcome into a FeatureResult so the client always gets data-or-error, never
 * a thrown exception. The decrypted password stays inside this server module.
 */
async function run<T>(
  accountId: string,
  fn: (acc: FcuCredential) => Promise<T>,
): Promise<FeatureResult<T>> {
  const acc = await loadAccountWithPassword(accountId);
  if (!acc) return { ok: false, error: '找不到帳號或解密失敗' };
  try {
    return { ok: true, data: await fn(acc) };
  } catch (e) {
    return { ok: false, error: (e as Error).message || '查詢失敗' };
  }
}

export async function getTimetable(
  accountId: string,
): Promise<FeatureResult<Timetable>> {
  return run(accountId, fetchTimetable);
}

export async function getStudentCard(
  accountId: string,
): Promise<FeatureResult<StudentCard>> {
  return run(accountId, fetchStudentCard);
}

export async function getAbsence(
  accountId: string,
): Promise<FeatureResult<AbsenceRecord[]>> {
  return run(accountId, fetchAbsence);
}

export async function getExamSchedule(
  accountId: string,
): Promise<FeatureResult<ExamSchedule>> {
  return run(accountId, fetchExamSchedule);
}
