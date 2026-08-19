import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_EMAILS } from '@/lib/config/admin';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { renderSlideToPNG, type CarouselSlide } from '@/lib/insights/carousel-image';
import {
  cacheSlideImage,
  getCachedSlideImage,
  incrementSlideRenderCount,
  slideImageCacheKey,
} from '@/lib/insights/slide-image-cache';

// Renders a single carousel slide (1080x1080 PNG) on demand from the real,
// already-generated slide content stored in `carousel_content.slides`.
// Node runtime — @vercel/og (satori + resvg) requires Node APIs (fs) to load
// the bundled Manrope font files.
export const runtime = 'nodejs';

;

/**
 * Render a slide to PNG, serving from the server-side cache when the same
 * carousel id + slide number + slide content was already rendered. The key is
 * content-derived, so any change to the carousel's slides automatically
 * invalidates the cached image. Exported so the CC-06 prove-fixed check can
 * exercise the exact code path the route uses.
 */
export async function getSlideImagePNG(
  id: string,
  targetSlideNumber: number,
  slideIndex: number,
  slide: CarouselSlide
): Promise<Buffer> {
  const key = slideImageCacheKey(id, targetSlideNumber, slideIndex, slide);
  const cached = getCachedSlideImage(key);
  if (cached) {
    return cached;
  }
  const png = await renderSlideToPNG(slide, slideIndex);
  cacheSlideImage(key, png);
  incrementSlideRenderCount();
  return png;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slideNumber: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, slideNumber } = await params;
    const targetSlideNumber = Number(slideNumber);
    if (!id || !Number.isFinite(targetSlideNumber)) {
      return NextResponse.json({ error: 'Invalid slide reference' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: carousel, error } = await supabase
      .from('carousel_content')
      .select('title, slides')
      .eq('id', id)
      .single();

    if (error || !carousel) {
      return NextResponse.json({ error: 'Carousel not found' }, { status: 404 });
    }

    const slides = (carousel.slides || []) as CarouselSlide[];
    const slideIndex = slides.findIndex((s) => s.slide_number === targetSlideNumber);
    const resolvedIndex = slideIndex >= 0 ? slideIndex : targetSlideNumber - 1;
    const slide = slides[resolvedIndex];

    if (!slide) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 });
    }

    const png = await getSlideImagePNG(id, targetSlideNumber, resolvedIndex, slide);

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Failed to render carousel slide image', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
