'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clockinLogs, fcuAccounts } from '@/lib/db/schema';
import { decryptCredential } from '@/lib/crypto/encryption';

const LOGIN_URL = 'https://signin.fcu.edu.tw/clockin/login.aspx';
const STUDENT_URL = 'https://signin.fcu.edu.tw/clockin/Student.aspx';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type VerifyResult = {
  ok: boolean;
  verified: boolean;
  message: string;
  htmlSnippet?: string;
};

function parseHidden(html: string, name: string): string {
  const re = new RegExp(`<input[^>]+name="${name}"[^>]+value="([^"]*)"`);
  return html.match(re)?.[1] ?? '';
}

function extractSetCookies(res: Response): string[] {
  const fn = (res.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie;
  if (fn) return fn.call(res.headers);
  const raw = res.headers.get('set-cookie');
  return raw ? [raw] : [];
}

class CookieJar {
  private cookies = new Map<string, string>();
  add(setCookies: string[]) {
    for (const sc of setCookies) {
      const [pair] = sc.split(';');
      const i = pair.indexOf('=');
      if (i < 0) continue;
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (k) this.cookies.set(k, v);
    }
  }
  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

function todayPatterns(): string[] {
  const now = new Date();
  // Convert to Taipei time
  const tpe = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60_000);
  const y = tpe.getFullYear();
  const m = tpe.getMonth() + 1;
  const d = tpe.getDate();
  const m2 = String(m).padStart(2, '0');
  const d2 = String(d).padStart(2, '0');
  const yROC = y - 1911;
  return [
    `${y}/${m2}/${d2}`,
    `${y}-${m2}-${d2}`,
    `${y}/${m}/${d}`,
    `${y}-${m}-${d}`,
    `${yROC}/${m2}/${d2}`,
    `${yROC}-${m2}-${d2}`,
    `民國${yROC}年${m}月${d}日`,
    `${yROC}年${m}月${d}日`,
  ];
}

async function fetchAndUpdateLog(
  logId: string,
  result: VerifyResult,
): Promise<void> {
  await db
    .update(clockinLogs)
    .set({
      verified: result.verified,
      verifyMessage: result.message,
      verifyAt: new Date(),
    })
    .where(eq(clockinLogs.id, logId));
}

async function runVerify(accountId: string): Promise<VerifyResult> {
  const [acc] = await db
    .select()
    .from(fcuAccounts)
    .where(eq(fcuAccounts.id, accountId))
    .limit(1);
  if (!acc) return { ok: false, verified: false, message: '找不到帳號' };

  let password: string;
  try {
    password = decryptCredential(
      Buffer.from(acc.nonce),
      Buffer.from(acc.ciphertext),
      Buffer.from(acc.authTag),
    );
  } catch (e) {
    return {
      ok: false,
      verified: false,
      message: `解密失敗：${(e as Error).message}`,
    };
  }

  const jar = new CookieJar();
  const baseHeaders = { 'User-Agent': UA, Accept: 'text/html' } as const;

  try {
    // 1. GET login.aspx
    const loginGet = await fetch(LOGIN_URL, { headers: baseHeaders });
    jar.add(extractSetCookies(loginGet));
    const loginHtml = await loginGet.text();
    const vs = parseHidden(loginHtml, '__VIEWSTATE');
    const ev = parseHidden(loginHtml, '__EVENTVALIDATION');
    const vsg = parseHidden(loginHtml, '__VIEWSTATEGENERATOR');
    if (!vs || !ev) {
      return {
        ok: false,
        verified: false,
        message: 'login page 解析失敗（ViewState 抓不到）',
      };
    }

    // 2. POST login
    const loginBody = new URLSearchParams({
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      __VIEWSTATE: vs,
      __VIEWSTATEGENERATOR: vsg,
      __EVENTVALIDATION: ev,
      'LoginLdap$UserName': acc.fcuNid,
      'LoginLdap$Password': password,
      'LoginLdap$LoginButton': '登入',
    });
    const loginPost = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        ...baseHeaders,
        Cookie: jar.header(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: LOGIN_URL,
        Origin: 'https://signin.fcu.edu.tw',
      },
      body: loginBody,
      redirect: 'follow',
    });
    jar.add(extractSetCookies(loginPost));
    const studentHtml = await loginPost.text();
    if (studentHtml.includes('LoginLdap_UserName')) {
      return { ok: false, verified: false, message: 'FCU 帳號或密碼錯誤' };
    }

    // 3. POST ButtonClassClockin → ClassClockinRecord.aspx
    const sVs = parseHidden(studentHtml, '__VIEWSTATE');
    const sEv = parseHidden(studentHtml, '__EVENTVALIDATION');
    const sVsg = parseHidden(studentHtml, '__VIEWSTATEGENERATOR');
    if (!sVs) {
      return {
        ok: false,
        verified: false,
        message: 'Student.aspx 解析失敗',
      };
    }
    const recordsBody = new URLSearchParams({
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      __VIEWSTATE: sVs,
      __VIEWSTATEGENERATOR: sVsg,
      __EVENTVALIDATION: sEv,
      ButtonClassClockin: '學生課堂打卡',
    });
    const recordsRes = await fetch(STUDENT_URL, {
      method: 'POST',
      headers: {
        ...baseHeaders,
        Cookie: jar.header(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: STUDENT_URL,
        Origin: 'https://signin.fcu.edu.tw',
      },
      body: recordsBody,
      redirect: 'follow',
    });
    jar.add(extractSetCookies(recordsRes));
    const recordsHtml = await recordsRes.text();

    if (recordsHtml.includes('LoginLdap_UserName')) {
      return { ok: false, verified: false, message: '導回登入頁（session 過期？）' };
    }

    // 4. Look for today's date markers
    const patterns = todayPatterns();
    const matched = patterns.filter((p) => recordsHtml.includes(p));
    const verified = matched.length > 0;

    if (verified) {
      let count = 0;
      for (const p of patterns) {
        const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        count += recordsHtml.match(re)?.length ?? 0;
      }
      return {
        ok: true,
        verified: true,
        message: `今天頁面上找到 ${count} 次日期字串（含命中：${matched[0]}）`,
      };
    } else {
      const snippet = recordsHtml
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
      return {
        ok: true,
        verified: false,
        message: '今天沒在打卡頁找到對應日期字串',
        htmlSnippet: snippet,
      };
    }
  } catch (e) {
    return {
      ok: false,
      verified: false,
      message: `驗證流程錯誤：${(e as Error).message}`,
    };
  }
}

export async function verifyAccount(
  accountId: string,
  logId: string | null,
): Promise<VerifyResult> {
  const result = await runVerify(accountId);
  if (logId) {
    try {
      await fetchAndUpdateLog(logId, result);
    } catch {
      /* log update failure is non-fatal */
    }
  }
  return result;
}
