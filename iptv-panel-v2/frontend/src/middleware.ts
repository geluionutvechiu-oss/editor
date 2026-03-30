import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths that don't require auth
  const publicPaths = ['/login']
  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  // Check for JWT token in cookies
  const token = request.cookies.get('jwt_token')?.value

  // If no token and not on a public path, redirect to login
  if (!token && !pathname.startsWith('/api')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
