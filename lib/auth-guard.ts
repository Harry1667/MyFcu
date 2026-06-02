import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { vaults } from '@/lib/db/schema';
import { ADMIN_COOKIE, VAULT_COOKIE, isAdminCookie, parseUnlocked } from '@/lib/vaults';

/** Whether the current request holds a valid admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return isAdminCookie(jar.get(ADMIN_COOKIE)?.value);
}

/** Redirect to /unlock unless the caller is the admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/unlock');
}

/** Admin flag + the set of vault ids this request has unlocked. */
export async function accessContext(): Promise<{ isAdmin: boolean; vaultIds: Set<string> }> {
  const jar = await cookies();
  if (await isAdminCookie(jar.get(ADMIN_COOKIE)?.value)) {
    return { isAdmin: true, vaultIds: new Set() };
  }
  const tokens = parseUnlocked(jar.get(VAULT_COOKIE)?.value);
  const vs = await db.select({ id: vaults.id, passToken: vaults.passToken }).from(vaults);
  return {
    isAdmin: false,
    vaultIds: new Set(vs.filter((v) => tokens.has(v.passToken)).map((v) => v.id)),
  };
}

/** Whether this request may touch an account belonging to the given vault. */
export async function canAccessVault(vaultId: string | null): Promise<boolean> {
  const { isAdmin: admin, vaultIds } = await accessContext();
  if (admin) return true;
  return vaultId != null && vaultIds.has(vaultId);
}

/** Redirect to /unlock unless the request may access the given account's vault. */
export async function ensureAccountAccess(vaultId: string | null): Promise<void> {
  if (!(await canAccessVault(vaultId))) redirect('/unlock');
}
