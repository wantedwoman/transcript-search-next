import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_EMAILS } from '@/lib/config/admin';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { generateCarouselContent } from '@/lib/insights/carousel-generator';
import { renderCarouselImages } from '@/lib/insights/carousel-image';

export async function GET() {
  try {
    // Admin auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    // Get all carousel content
    const { data: carousels, error } = await supabase
      .from('carousel_content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch carousels' }, { status: 500 });
    }

    return NextResponse.json({ carousels: carousels || [] });
  } catch (err) {
    console.error('Failed to fetch carousels', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Admin auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate new carousel content
    const { carousels } = await generateCarouselContent();

    if (carousels.length === 0) {
      return NextResponse.json({ error: 'No insights available for carousel generation' }, { status: 400 });
    }

    const renderedCarousels = [];
    for (const carousel of carousels) {
      const htmlFiles = await renderCarouselImages(carousel);
      renderedCarousels.push({
        ...carousel,
        htmlFiles,
      });
    }

    return NextResponse.json({
      message: `Generated ${carousels.length} carousel(s)`,
      carousels: renderedCarousels,
    });
  } catch (err) {
    console.error('Failed to generate carousels', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}