import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateToken } from '@/lib/oauth';

export async function middleware(req: NextRequest) {
  if (
    req.nextUrl.pathname.startsWith('/api/auth') ||
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const isValid = await validateToken(token);
  if (!isValid) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!login|_next/static|favicon.ico).*)',
  ],
}; 
