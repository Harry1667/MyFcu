import { FCU_UA } from './session';
import type { FcuCredential } from './types';

const TIMETABLE_URL =
  'https://service206-sds.fcu.edu.tw/mobileservice/CourseService.svc/Timetable2';

/**
 * Lightweight credential validity check. Timetable2 is the cheapest
 * credential-bearing endpoint (one POST, no session) and returns Success:false
 * when the stored password no longer works — e.g. the classmate changed it.
 */
export async function checkCredential(acc: FcuCredential): Promise<boolean> {
  const res = await fetch(TIMETABLE_URL, {
    method: 'POST',
    headers: {
      'User-Agent': FCU_UA,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
    },
    body: JSON.stringify({ Account: acc.fcuNid, Password: acc.password }),
  });
  if (!res.ok) throw new Error(`檢查服務回應 ${res.status}`);
  const data = (await res.json()) as { Success?: boolean };
  return data.Success === true;
}
