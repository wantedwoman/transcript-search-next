import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';
import { checkGHLTags } from '../ghl/check-tags';

const ADMIN_EMAILS = ['coach@wantedwoman.com', 'inspiremany@gmail.com'];

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

  // Route checks
  const isChatRoute = request.nextUrl.pathname.startsWith('/chat');
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
  const isApiWebhookRoute = request.nextUrl.pathname.startsWith('/api/webhooks');

  // Webhook routes don't require auth — they have their own signature verification
  if (isApiWebhookRoute) {
    return response;
  }

  // If user is not authenticated and trying to access protected routes
  if (!user && (isChatRoute || isAdminRoute)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is authenticated, check access
  if (user && (isChatRoute || isAdminRoute)) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('status, email')
      .eq('user_id', user.id)
      .single();

    // Revoked users can't access chat or admin — redirect to payment required
    if (!profile || profile.status === 'revoked') {
      return NextResponse.redirect(new URL('/payment-required', request.url));
    }

    // GHL tag check for /chat access — source of truth is now GHL tags, not webhooks
    if (isChatRoute) {
      const userEmail = (profile?.email || user.email || '').trim().toLowerCase();
      if (userEmail) {
        const tagResult = await checkGHLTags(userEmail);

        if (!tagResult.hasAccess) {
          // Cancellation tag found — redirect to payment required
          return NextResponse.redirect(new URL('/payment-required', request.url));
        }
      }
    }

    // Admin routes: only specific emails
    if (isAdminRoute) {
      const userEmail = (profile?.email || user.email || '').toLowerCase();
      if (!ADMIN_EMAILS.includes(userEmail)) {
        return NextResponse.redirect(new URL('/chat', request.url));
      }
    }
  }

  // If user is authenticated and on the login page, redirect to chat
  if (user && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  return response;
}