/**
 * Optional site-wide PIN gate. Enabled only when SITE_PIN is set in the
 * environment; otherwise the whole thing is a no-op (the site stays open).
 *
 * The auth cookie never stores the PIN — it stores sha256(`${pin}:${AUTH_SECRET}`),
 * so the cookie alone can't reveal the PIN. Uses Web Crypto so the same code
 * runs in both the edge middleware and Node server actions.
 */

export const SITE_AUTH_COOKIE = 'site_auth';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Token for a given candidate PIN, or null if the gate can't be configured. */
export async function tokenForPin(pin: string): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return sha256Hex(`${pin}:${secret}`);
}

/** The expected cookie token, or null when the PIN gate is disabled. */
export async function expectedToken(): Promise<string | null> {
  const pin = process.env.SITE_PIN;
  if (!pin) return null;
  return tokenForPin(pin);
}
