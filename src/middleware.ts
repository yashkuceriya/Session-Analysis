import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';

/**
 * Middleware to protect routes and verify authentication
 * Protected routes: /session/*, /analytics/*, /dashboard/*, /api/rooms/*
 * Public routes: /, /join/*, /api/auth/*, /api/health
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // DEV_SKIP_AUTH: Skip all auth checks in development
  // Set this in .env.local to bypass login during local development
  if (process.env.DEV_SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  // Public routes that don't require auth
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/signup',
    /^\/join\/.*/, // Allow /join/[roomId] without auth
    /^\/highlights\/.*/, // Shareable parent-friendly session summaries
    /^\/progress\/.*/, // Shareable student progress views
    /^\/api\/auth\/.*/, // All auth endpoints
    '/api/health',
  ];

  // Check if route is public
  const isPublic = publicRoutes.some((route) => {
    if (route instanceof RegExp) {
      return route.test(pathname);
    }
    return pathname === route;
  });

  if (isPublic) {
    return NextResponse.next();
  }

  // Protected routes - require authentication
  const protectedPatterns = [
    /^\/session(\/.*)?$/, // Matches /session AND /session/*
    /^\/session-ended(\/.*)?$/, // Matches /session-ended AND /session-ended/*
    /^\/analytics(\/.*)?$/, // Matches /analytics AND /analytics/*
    /^\/dashboard(\/.*)?$/, // Matches /dashboard AND /dashboard/*
    /^\/reports(\/.*)?$/, // Matches /reports AND /reports/*
    /^\/api\/rooms(\/.*)?$/, // Matches /api/rooms AND /api/rooms/*
  ];

  const isProtected = protectedPatterns.some((pattern) => pattern.test(pathname));

  if (isProtected) {
    const session = await auth();

    if (!session) {
      // For API routes, return 401 JSON
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }

      // For page routes, redirect to login
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .next
     */
    '/((?!_next/static|_next/image|favicon.ico|.next).*)',
  ],
};
