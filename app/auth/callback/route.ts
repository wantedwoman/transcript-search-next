import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // If user clicked a password reset link, redirect them to the reset page
  const next = searchParams.get('next') ?? '/chat';
  const type = searchParams.get('type');

  if (code) {
    const redirectPath = type === 'recovery' ? '/auth/reset-password' : next;
    const response = NextResponse.redirect(`${origin}${redirectPath}`);
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Check for referral code in the URL (persisted via cookie during signup)
      // The referral tracking is handled during the signup API call
      return response;
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`);
}