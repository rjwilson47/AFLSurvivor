import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that require authentication
const protectedRoutes = ['/tips', '/me', '/admin']

// Routes that require admin or superadmin role (checked at page level, not middleware)
// Middleware only checks authentication; role checks happen in page components

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Supabase redirects expired/invalid magic links to the site URL with error params.
  // Catch these and redirect to /login with a user-friendly message.
  if (searchParams.get('error_code') === 'otp_expired') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'link_expired')
    return NextResponse.redirect(loginUrl)
  }

  const response = await updateSession(request)

  // Check if this is a protected route
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route))

  if (isProtected) {
    // We need to check if the user is authenticated
    // The updateSession call above refreshes the session
    // We check for the auth cookie presence as a quick gate
    const hasAuthCookie = request.cookies.getAll().some(
      (cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
    )

    if (!hasAuthCookie) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
