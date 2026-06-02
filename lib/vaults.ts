/**
 * Password-vault access gate (UI-level, not encryption).
 *
 * Two kinds of secret:
 *  - ADMIN: process.env.SITE_PIN. Holder sees every account + every vault and
 *    can manage them. Cookie `site_auth` = sha256(`${SITE_PIN}:${AUTH_SECRET}`).
 *  - VAULT: each vault row has passToken = sha256(`${password}:${AUTH_SECRET}`).
 *    A visitor who enters a vault password gets that token added to the
 *    `unlocked_vaults` cookie and can then see/clock-in that vault's accounts.
 *
 * Tokens never contain the plaintext password. Uses Web Crypto so the same code
 * runs in edge middleware and Node server actions.
 */

export const ADMIN_COOKIE = 'site_auth';
export const VAULT_COOKIE = 'unlocked_vaults';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Token for an arbitrary secret (vault password or admin PIN). */
export async function tokenFor(secret: string): Promise<string | null> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) return null;
  return sha256Hex(`${secret}:${authSecret}`);
}

/** Expected admin cookie token, or null when no SITE_PIN is configured. */
export async function adminToken(): Promise<string | null> {
  const pin = process.env.SITE_PIN;
  if (!pin) return null;
  return tokenFor(pin);
}

/** Whether the given admin-cookie value proves admin access. */
export async function isAdminCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await adminToken();
  return expected != null && cookieValue === expected;
}

/** Parse the unlocked-vaults cookie into a set of passTokens. */
export function parseUnlocked(cookieValue: string | undefined): Set<string> {
  if (!cookieValue) return new Set();
  return new Set(cookieValue.split('.').filter(Boolean));
}

/** Serialize a set/array of passTokens back into a cookie value. */
export function serializeUnlocked(tokens: Iterable<string>): string {
  return [...new Set(tokens)].join('.');
}
