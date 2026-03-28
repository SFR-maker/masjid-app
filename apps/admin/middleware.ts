import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/privacy(.*)', '/support(.*)', '/terms(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return NextResponse.next()

  const { userId } = await auth.protect()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-clerk-user-id', userId ?? '')
  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
