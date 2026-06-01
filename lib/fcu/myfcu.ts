import { CookieJar, extractSetCookies, FCU_UA } from './session';
import type {
  AbsenceRecord,
  ExamSchedule,
  FcuCredential,
} from './types';

const MYFCU = 'https://myfcu.fcu.edu.tw/main/';
const REDIRECT_SVC =
  'https://service206-sds.fcu.edu.tw/MobileService/RedirectService.svc/Redirect';

/**
 * Follow 30x redirects by hand, threading the cookie jar through every hop.
 * fetch() has no cookie jar, so this is the only way to capture the
 * ASP.NET_SessionId that gets set mid-chain (e.g. inside SingleSignOn.aspx).
 */
async function followRedirects(
  jar: CookieJar,
  startUrl: string,
  maxHops = 6,
): Promise<void> {
  let url = startUrl;
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': FCU_UA, Cookie: jar.header() },
      redirect: 'manual',
    });
    jar.add(extractSetCookies(res));
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url).toString();
      continue;
    }
    return;
  }
}

/**
 * Establish an authenticated myfcu session.
 *
 * The mobile RedirectService exchanges credentials for a one-time SSO key; we
 * then walk sso.aspx → SingleSignOn.aspx, which sets the ASP.NET_SessionId.
 * That session is a *general* myfcu auth — once issued it can call any
 * module's AJAX page-method (verified: a "Leave of Absence" session reaches
 * S3501/GetInit fine), so we use "Leave of Absence" as the universal
 * bootstrap for every myfcu feature.
 *
 * (mobileToApps.aspx is NOT used: from a backend IP it just renders a
 * WebForms login page, same dead end as the FcuCard simple-login path.)
 */
async function myfcuSession(acc: FcuCredential): Promise<CookieJar> {
  const jar = new CookieJar();
  const res = await fetch(REDIRECT_SVC, {
    method: 'POST',
    headers: {
      'User-Agent': FCU_UA,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      Account: acc.fcuNid,
      Password: acc.password,
      RedirectService: 'Leave of Absence',
      BeaconUUID: '',
      BeaconMajor: '',
      BeaconMinor: '',
    }),
  });

  let data: { Success?: boolean; RedirectUrl?: string };
  try {
    data = (await res.json()) as { Success?: boolean; RedirectUrl?: string };
  } catch {
    throw new Error('登入失敗（RedirectService 無回應），請確認帳密');
  }
  if (!data.Success || !data.RedirectUrl) {
    throw new Error('登入失敗，請確認 FCU 帳號密碼');
  }

  await followRedirects(jar, data.RedirectUrl);
  if (!jar.has('ASP.NET_SessionId')) {
    throw new Error('SSO 失敗，無法建立 myfcu session');
  }
  return jar;
}

/** Call a myfcu ASP.NET AJAX page-method and return its `d` payload. */
async function callMethod<T>(
  jar: CookieJar,
  pagePath: string,
  method: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${MYFCU}${pagePath}/${method}`, {
    method: 'POST',
    headers: {
      'User-Agent': FCU_UA,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Cookie: jar.header(),
    },
    body: JSON.stringify(body),
  });
  let parsed: { d?: T };
  try {
    parsed = (await res.json()) as { d?: T };
  } catch {
    throw new Error(`${method} 回應解析失敗（session 可能過期）`);
  }
  if (parsed.d === undefined || parsed.d === null) {
    throw new Error(`${method} 沒有回傳資料`);
  }
  return parsed.d;
}

type RawAbsence = {
  abs_date: string;
  sub_name: string;
  abs_period: string;
  abs_kind: string;
  abs_name: string;
  emp_name: string;
  cls_name: string;
};

/** 請假 / 缺曠查詢 (S3401). */
export async function fetchAbsence(acc: FcuCredential): Promise<AbsenceRecord[]> {
  const jar = await myfcuSession(acc);
  const rows = await callMethod<RawAbsence[]>(
    jar,
    'S3401/s3401_leave.aspx',
    'GetCurrStuabsc',
    { stuid: acc.fcuNid, fromDay: null, toDay: null },
  );
  return (rows ?? []).map((r) => ({
    date: (r.abs_date ?? '').trim(),
    subName: (r.sub_name ?? '').trim(),
    period: (r.abs_period ?? '').trim(),
    kind: (r.abs_kind ?? '').trim(),
    reason: (r.abs_name ?? '').trim(),
    teacher: (r.emp_name ?? '').trim(),
    clsName: (r.cls_name ?? '').trim(),
  }));
}

type RawExam = {
  unCentraData?: { x: string; y: string }[];
  ymsData?: string;
};

/** 考試課表 (S3501). */
export async function fetchExamSchedule(
  acc: FcuCredential,
): Promise<ExamSchedule> {
  const jar = await myfcuSession(acc);
  const d = await callMethod<RawExam>(
    jar,
    'S3501/S3501_exam_stuschedule.aspx',
    'GetInit',
    {},
  );
  return {
    semesterLabel: (d.ymsData ?? '').trim(),
    courses: (d.unCentraData ?? [])
      .map((c) => ({ label: (c.x ?? '').trim() }))
      .filter((c) => c.label.length > 0),
  };
}
