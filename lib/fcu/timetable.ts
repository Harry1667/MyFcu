import { FCU_UA } from './session';
import type { FcuCredential, Timetable, TimetableSlot } from './types';

const TIMETABLE_URL =
  'https://service206-sds.fcu.edu.tw/mobileservice/CourseService.svc/Timetable2';

type RawSlot = {
  ClsId: string;
  ClsName: string;
  ColorCode: string;
  PeriodTime: string;
  RomName: string;
  SctPeriod: number;
  SctWeek: number;
  SubId: string;
  SubName: string;
  YmsSmester: number;
  YmsYear: number;
};

type RawResponse = {
  Success: boolean;
  Message: string; // 學號 on success
  TimetableTw?: RawSlot[];
  TimetableEn?: RawSlot[];
};

/**
 * 課表查詢 — Variant A: a single credential-bearing POST returns the whole
 * timetable as JSON. No session, no IP lock. We keep the Chinese names
 * (TimetableTw) and split scheduled vs unscheduled (week 0 / no period time)
 * so the UI grid stays clean.
 */
export async function fetchTimetable(acc: FcuCredential): Promise<Timetable> {
  const res = await fetch(TIMETABLE_URL, {
    method: 'POST',
    headers: {
      'User-Agent': FCU_UA,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
    },
    body: JSON.stringify({ Account: acc.fcuNid, Password: acc.password }),
  });

  if (!res.ok) {
    throw new Error(`課表服務回應 ${res.status}`);
  }

  let data: RawResponse;
  try {
    data = (await res.json()) as RawResponse;
  } catch {
    throw new Error('課表回應解析失敗（可能帳密錯誤或服務維護中）');
  }

  if (!data.Success) {
    throw new Error('登入失敗，請確認 FCU 帳號密碼');
  }

  const raw = data.TimetableTw ?? data.TimetableEn ?? [];
  const slots: TimetableSlot[] = [];
  const unscheduled: TimetableSlot[] = [];

  for (const r of raw) {
    const slot: TimetableSlot = {
      subId: r.SubId,
      subName: (r.SubName ?? '').trim(),
      room: (r.RomName ?? '').trim(),
      periodTime: (r.PeriodTime ?? '').trim(),
      week: r.SctWeek,
      period: r.SctPeriod,
      color: (r.ColorCode ?? '').trim() || '#62D617',
    };
    if (slot.week >= 1 && slot.week <= 7 && slot.period >= 1) {
      slots.push(slot);
    } else {
      unscheduled.push(slot);
    }
  }

  const first = raw[0];
  return {
    studentNo: data.Message ?? acc.fcuNid,
    year: first?.YmsYear ?? 0,
    semester: first?.YmsSmester ?? 0,
    slots,
    unscheduled,
  };
}
