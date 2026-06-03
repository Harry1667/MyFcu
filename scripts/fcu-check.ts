// Standalone FCU clock-in record check (read-only).
//
// Logs into FCU with a stored account's credentials and reports whether today's
// *class* clock-in actually shows up on FCU's record page — the same check
// verifyAccount() does, but runnable straight from the server CLI for a one-off
// independent confirmation (e.g. "did 鄒立帆 really clock in today?").
//
//   cd /www/wwwroot/myfcu.looptw.com
//   bun --env-file=.env.local scripts/fcu-check.ts D1363418
//
// Needs AUTH_SECRET + DATABASE_URL from .env.local (to open prod.db and decrypt
// the password). Touches nothing — only GET/POST against FCU and a SELECT.

import { createClient } from '@libsql/client';
import { decryptCredential } from '../lib/crypto/encryption';
import { CookieJar, extractSetCookies, parseHidden, FCU_UA as UA } from '../lib/fcu/session';

const LOGIN_URL = 'https://signin.fcu.edu.tw/clockin/login.aspx';
const STUDENT_URL = 'https://signin.fcu.edu.tw/clockin/Student.aspx';

function todayPatterns(): string[] {
  const now = new Date();
  const tpe = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60_000);
  const y = tpe.getFullYear();
  const m = tpe.getMonth() + 1;
  const d = tpe.getDate();
  const m2 = String(m).padStart(2, '0');
  const d2 = String(d).padStart(2, '0');
  const yROC = y - 1911;
  return [
    `${y}/${m2}/${d2}`, `${y}-${m2}-${d2}`, `${y}/${m}/${d}`, `${y}-${m}-${d}`,
    `${yROC}/${m2}/${d2}`, `${yROC}-${m2}-${d2}`, `民國${yROC}年${m}月${d}日`, `${yROC}年${m}月${d}日`,
  ];
}

const nid = process.argv[2];
if (!nid) {
  console.error('用法: bun --env-file=.env.local scripts/fcu-check.ts <學號NID>');
  process.exit(1);
}

const client = createClient({ url: process.env.DATABASE_URL ?? 'file:./prod.db' });
const rs = await client.execute({
  sql: 'select display_name, fcu_nid, nonce, ciphertext, auth_tag from fcu_accounts where fcu_nid = ?',
  args: [nid],
});
if (rs.rows.length === 0) {
  console.error(`✗ 找不到學號 ${nid} 的帳號`);
  process.exit(1);
}
const acc = rs.rows[0] as Record<string, unknown>;
const name = String(acc.display_name);
const password = decryptCredential(
  Buffer.from(acc.nonce as ArrayBuffer),
  Buffer.from(acc.ciphertext as ArrayBuffer),
  Buffer.from(acc.auth_tag as ArrayBuffer),
);

const jar = new CookieJar();
const baseHeaders = { 'User-Agent': UA, Accept: 'text/html' } as const;

// 1. GET login → grab ViewState
const loginGet = await fetch(LOGIN_URL, { headers: baseHeaders });
jar.add(extractSetCookies(loginGet));
const loginHtml = await loginGet.text();
const vs = parseHidden(loginHtml, '__VIEWSTATE');
const ev = parseHidden(loginHtml, '__EVENTVALIDATION');
const vsg = parseHidden(loginHtml, '__VIEWSTATEGENERATOR');
if (!vs || !ev) { console.error('✗ login page 解析失敗（抓不到 ViewState）'); process.exit(2); }

// 2. POST login
const loginPost = await fetch(LOGIN_URL, {
  method: 'POST',
  headers: { ...baseHeaders, Cookie: jar.header(), 'Content-Type': 'application/x-www-form-urlencoded', Referer: LOGIN_URL, Origin: 'https://signin.fcu.edu.tw' },
  body: new URLSearchParams({
    __EVENTTARGET: '', __EVENTARGUMENT: '', __VIEWSTATE: vs, __VIEWSTATEGENERATOR: vsg, __EVENTVALIDATION: ev,
    'LoginLdap$UserName': nid, 'LoginLdap$Password': password, 'LoginLdap$LoginButton': '登入',
  }),
  redirect: 'follow',
});
jar.add(extractSetCookies(loginPost));
const studentHtml = await loginPost.text();
if (studentHtml.includes('LoginLdap_UserName')) { console.error(`✗ ${name}（${nid}）FCU 帳號或密碼錯誤`); process.exit(3); }

// 3. POST 學生課堂打卡 → 紀錄頁
const sVs = parseHidden(studentHtml, '__VIEWSTATE');
const sEv = parseHidden(studentHtml, '__EVENTVALIDATION');
const sVsg = parseHidden(studentHtml, '__VIEWSTATEGENERATOR');
if (!sVs) { console.error('✗ Student.aspx 解析失敗'); process.exit(4); }
const recordsRes = await fetch(STUDENT_URL, {
  method: 'POST',
  headers: { ...baseHeaders, Cookie: jar.header(), 'Content-Type': 'application/x-www-form-urlencoded', Referer: STUDENT_URL, Origin: 'https://signin.fcu.edu.tw' },
  body: new URLSearchParams({
    __EVENTTARGET: '', __EVENTARGUMENT: '', __VIEWSTATE: sVs, __VIEWSTATEGENERATOR: sVsg, __EVENTVALIDATION: sEv,
    ButtonClassClockin: '學生課堂打卡',
  }),
  redirect: 'follow',
});
const recordsHtml = await recordsRes.text();
if (recordsHtml.includes('LoginLdap_UserName')) { console.error('✗ 導回登入頁（session 過期？）'); process.exit(5); }

// 4. 找今天日期
const patterns = todayPatterns();
const matched = patterns.filter((p) => recordsHtml.includes(p));
let count = 0;
for (const p of patterns) {
  const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  count += recordsHtml.match(re)?.length ?? 0;
}

console.log('────────────────────────────');
console.log(`帳號  : ${name}（${nid}）`);
if (matched.length > 0) {
  console.log(`結果  : ✅ FCU 今天有打卡紀錄`);
  console.log(`命中  : ${matched[0]}，頁面上共 ${count} 次`);
} else {
  console.log(`結果  : ⚠️ FCU 今天查不到打卡紀錄（試過：${patterns.join(', ')}）`);
}
console.log(`HTML 長度: ${recordsHtml.length}`);
console.log('────────────────────────────');
process.exit(matched.length > 0 ? 0 : 6);
