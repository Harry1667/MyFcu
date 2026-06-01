import { NextResponse, type NextRequest } from 'next/server';
import { expectedToken, SITE_AUTH_COOKIE } from '@/lib/site-pin';

export async function middleware(req: NextRequest) {
  const token = await expectedToken();
  if (!token) return NextResponse.next(); // PIN gate disabled
  if (req.nextUrl.pathname === '/unlock') return NextResponse.next();

  if (req.cookies.get(SITE_AUTH_COOKIE)?.value === token) return NextResponse.next();

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
