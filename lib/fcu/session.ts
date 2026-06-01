/**
 * Low-level helpers shared by every FCU backend call.
 *
 * Extracted from the original verify.ts so the new read-only feature modules
 * (timetable / card / myfcu) and verify.ts all share one cookie/UA story.
 */

export const FCU_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Pull a hidden <input> value (e.g. __VIEWSTATE) out of an ASP.NET WebForms page. */
export function parseHidden(html: string, name: string): string {
  const re = new RegExp(`<input[^>]+name="${name}"[^>]+value="([^"]*)"`);
  return html.match(re)?.[1] ?? '';
}

/** Read every Set-Cookie header off a fetch Response, across runtimes. */
export function extractSetCookies(res: Response): string[] {
  const fn = (res.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie;
  if (fn) return fn.call(res.headers);
  const raw = res.headers.get('set-cookie');
  return raw ? [raw] : [];
}

/** A minimal cookie jar: last-write-wins by cookie name, serialises to a Cookie header. */
export class CookieJar {
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

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}
