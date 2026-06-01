import { CookieJar, extractSetCookies, parseHidden, FCU_UA } from './session';
import type { FcuCredential, StudentCard } from './types';

const BASE = 'https://service202-sds.fcu.edu.tw/FcucardQrcode/';
const LOGIN_URL = BASE + 'login.aspx';
const ICCARD_URL = BASE + 'FcuCard.aspx/GetICCard';
const ENCRYPT_URL = BASE + 'FcuCard.aspx/GetEncryptData';

type EncResult = {
  hexString: string;
  qrcodeUrl: string; // "CreateQRCode.ashx?txt=<hex>"
};

type ICCardResponse = {
  d?: {
    encResult?: EncResult;
    userInfo?: { cls_uname?: string };
    cardInfo?: { id?: string; name?: string; card_type?: string; barcode?: string };
    ymsInfo?: {
      yms_year?: string;
      yms_smester?: string;
      yms_year_en?: string;
      yms_smester_en?: string;
    };
    pname?: string; // short-lived JWT for the photo
  };
};

/** Sniff an image mime from magic bytes (FCU's CreateQRCode.ashx mislabels JPEG as text/plain). */
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  return null;
}

/** Fetch a binary asset (QR image / photo) with the session cookie and inline it as a data URL. */
async function fetchDataUrl(
  url: string,
  jar: CookieJar,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': FCU_UA, Cookie: jar.header() },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = sniffImageMime(buf);
    if (!mime) return null;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * 電子學生證 — Variant B: form login sets an ASP.NET session cookie, then the
 * AngularJS shell's AJAX page-methods return the card data + a server-encrypted
 * QR blob. We render the official CreateQRCode.ashx image (byte-faithful to the
 * app) and the photo, inlined as data URLs.
 *
 * Privacy: the GetICCard response also carries idno (身分證) and bdate — we
 * deliberately drop those and never return or log them.
 */
/**
 * ASP.NET WebForms login (LoginLdap) → returns an authenticated cookie jar.
 * The "simple username/password" mobile path the app uses does not
 * authenticate a backend IP (it just re-renders the login form), so we drive
 * the real form: GET to grab __VIEWSTATE/__EVENTVALIDATION, then POST creds.
 */
async function loginFcuCard(acc: FcuCredential): Promise<CookieJar> {
  const jar = new CookieJar();
  const loginGet = await fetch(LOGIN_URL, { headers: { 'User-Agent': FCU_UA } });
  jar.add(extractSetCookies(loginGet));
  const loginHtml = await loginGet.text();
  const vs = parseHidden(loginHtml, '__VIEWSTATE');
  if (!vs) throw new Error('學生證登入頁解析失敗');

  const loginRes = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'User-Agent': FCU_UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.header(),
      Referer: LOGIN_URL,
    },
    body: new URLSearchParams({
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      __VIEWSTATE: vs,
      __VIEWSTATEGENERATOR: parseHidden(loginHtml, '__VIEWSTATEGENERATOR'),
      __EVENTVALIDATION: parseHidden(loginHtml, '__EVENTVALIDATION'),
      'LoginLdap$UserName': acc.fcuNid,
      'LoginLdap$Password': acc.password,
      'LoginLdap$LoginButton': '登入',
    }),
    redirect: 'manual',
  });
  jar.add(extractSetCookies(loginRes));
  // Success = 302 to FcuCard.aspx; failure re-renders the 200 login form.
  if (loginRes.status !== 302) {
    throw new Error('學生證登入失敗，請確認 FCU 帳號密碼');
  }
  return jar;
}

/** Build the QR image data URL from a session + encResult. */
async function qrDataUrlFrom(
  jar: CookieJar,
  enc: EncResult,
): Promise<string> {
  const qrUrl = enc.qrcodeUrl
    ? BASE + enc.qrcodeUrl
    : BASE + 'CreateQRCode.ashx?txt=' + encodeURIComponent(enc.hexString);
  const url = await fetchDataUrl(qrUrl, jar);
  if (!url) throw new Error('學生證 QR 取得失敗');
  return url;
}

export async function fetchStudentCard(acc: FcuCredential): Promise<StudentCard> {
  const jar = await loginFcuCard(acc);

  // GetICCard → card data + encrypted QR blob + photo JWT
  const cardRes = await fetch(ICCARD_URL, {
    method: 'POST',
    headers: {
      'User-Agent': FCU_UA,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Cookie: jar.header(),
    },
    body: '{}',
  });
  let parsed: ICCardResponse;
  try {
    parsed = (await cardRes.json()) as ICCardResponse;
  } catch {
    throw new Error('學生證資料解析失敗（session 可能過期）');
  }
  const d = parsed.d;
  if (!d || !d.cardInfo || !d.encResult) {
    throw new Error('學生證資料不完整');
  }

  // QR image (server-encrypted blob, cannot be forged — we just render it)
  const qrDataUrl = await qrDataUrlFrom(jar, d.encResult);

  // Photo (best-effort; JWT is short-lived)
  const photoDataUrl = d.pname
    ? await fetchDataUrl(BASE + 'download_photo.aspx?pname=' + encodeURIComponent(d.pname), jar)
    : null;

  const yms = d.ymsInfo ?? {};
  const semesterLabel = [
    [yms.yms_year, yms.yms_smester].filter(Boolean).join(' '),
    [yms.yms_year_en, yms.yms_smester_en].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    name: (d.cardInfo.name ?? '').trim(),
    studentNo: (d.cardInfo.id ?? acc.fcuNid).trim(),
    deptName: (d.userInfo?.cls_uname ?? '').trim(),
    cardType: (d.cardInfo.card_type ?? '學生證').trim(),
    barcode: (d.cardInfo.barcode ?? '').trim(),
    semesterLabel,
    qrDataUrl,
    photoDataUrl,
  };
}

/**
 * Lightweight QR refresh: login → GetEncryptData → CreateQRCode only.
 * Skips GetICCard + photo so the periodic auto-refresh stays cheap. The QR
 * blob is server-encrypted and short-lived, so the card view re-fetches it on
 * an interval to keep a scannable code on screen.
 */
export async function fetchStudentCardQr(acc: FcuCredential): Promise<string> {
  const jar = await loginFcuCard(acc);
  const res = await fetch(ENCRYPT_URL, {
    method: 'POST',
    headers: {
      'User-Agent': FCU_UA,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Cookie: jar.header(),
    },
    body: '{}',
  });
  let parsed: { d?: EncResult };
  try {
    parsed = (await res.json()) as { d?: EncResult };
  } catch {
    throw new Error('學生證 QR 更新失敗（session 可能過期）');
  }
  if (!parsed.d?.hexString) throw new Error('學生證 QR 更新失敗');
  return qrDataUrlFrom(jar, parsed.d);
}
