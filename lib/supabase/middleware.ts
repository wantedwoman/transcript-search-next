import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh the session so it doesn't expire
  const { data: { user } } = await supabase.auth.getUser();

  // Protected routes: /chat requires authentication
  const isChatRoute = request.nextUrl.pathname.startsWith('/chat');
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');

  // If user is not authenticated and trying to access protected routes
  if (!user && isChatRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is not authenticated and trying to access admin routes
  if (!user && isAdminRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is authenticated, check if their profile is active
  if (user && (isChatRoute || isAdminRoute)) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.status === 'revoked') {
      // Revoked users get redirected to login with a message
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('error', 'access_revoked');
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If user is authenticated and on the login page, redirect to chat
  if (user && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  return response;
}