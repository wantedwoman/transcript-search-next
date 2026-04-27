import { NextRequest, NextResponse } from 'next/server';
import { checkGhlTags } from '@/lib/ghl/check-tags';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // 1. Verify the email has the "Suzy AI Subscriber" tag in GHL
    const { hasAccess, tags } = await checkGhlTags(email);

    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            'Access by invitation only. Purchase through WANTED Woman to get started.',
        },
        { status: 403 }
      );
    }

    // 2. Create the Supabase user
    const { data: userData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      console.error('Supabase create user error:', createError);
      return NextResponse.json(
        { error: createError.message || 'Failed to create account.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: { id: userData.user?.id, email: userData.user?.email },
    });
  } catch (err: any) {
    console.error('Signup route error:', err);
    return NextResponse.json(
      { error: err.message || 'Something went wrong.' },
      { status: 500 }
    );
  }
}