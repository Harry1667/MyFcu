/**
 * UI-level reveal gate for hidden accounts. Accounts flagged is_hidden are
 * filtered out of the dashboard for everyone, *unless* the visitor has presented
 * the reveal code — share that code only with the people who should see them.
 *
 * Enabled only when HIDDEN_CODE is set in the environment. When it's unset the
 * gate is dormant: hidden accounts are simply always shown (mark them, set the
 * code later). Mirrors lib/site-pin.ts — the cookie stores
 * sha256(`${code}:${AUTH_SECRET}`), never the code itself.
 *
 * This is privacy-by-obscurity, not encryption: anyone with the code, the raw
 * DB, or a guessed account id can still reach the data. See the dashboard notes.
 */

export const HIDDEN_REVEAL_COOKIE = 'hidden_reveal';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Whether the reveal gate is configured at all. */
export function hiddenGateEnabled(): boolean {
  return Boolean(process.env.HIDDEN_CODE);
}

/** Token for a given candidate code, or null if the gate can't be configured. */
export async function tokenForCode(code: string): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return sha256Hex(`${code}:${secret}`);
}

/** The expected cookie token, or null when the reveal gate is disabled. */
export async function expectedRevealToken(): Promise<string | null> {
  const code = process.env.HIDDEN_CODE;
  if (!code) return null;
  return tokenForCode(code);
}

/**
 * Whether this request may see hidden accounts. True when the gate is disabled
 * (dormant) or the cookie matches the expected token.
 */
export async function isRevealed(cookieValue: string | undefined): Promise<boolean> {
  const expected = await expectedRevealToken();
  if (!expected) return true; // gate dormant — nothing is gated
  return cookieValue === expected;
}
