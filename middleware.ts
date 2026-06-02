import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, VAULT_COOKIE, isAdminCookie } from '@/lib/vaults';

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/unlock') return NextResponse.next();

  // Admin sees everything.
  if (await isAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  // Any non-empty unlocked-vaults cookie gets through; the dashboard does the
  // real DB-backed check (edge middleware can't read the DB) and bounces back
  // to /unlock if nothing actually matched.
  const vaultCookie = req.cookies.get(VAULT_COOKIE)?.value;
  if (vaultCookie && vaultCookie.length > 0) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/unlock';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Gate everything except Next internals, the manifest, and icon assets so the
  // unlock page can still render and PWA metadata stays reachable.
  matcher: ['/((?!_next/|favicon.ico|manifest.webmanifest|icon-.*\\.png|apple-icon).*)'],
};
