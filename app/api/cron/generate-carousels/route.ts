import { NextRequest, NextResponse } from 'next/server';
import { generateCarouselContent } from '@/lib/insights/carousel-generator';

// This endpoint is called by a cron job (Vercel Cron or external scheduler)
// to generate weekly Instagram carousel content from aggregated insights.

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const carousels = await generateCarouselContent();

    return NextResponse.json({
      message: `Generated ${carousels.length} carousel(s)`,
      carousels: carousels.map((c) => ({
        title: c.title,
        topic: c.topic,
        slideCount: c.slides.length,
      })),
    });
  } catch (error) {
    console.error('Cron: carousel generation failed', error);
    return NextResponse.json({ error: 'Carousel generation failed' }, { status: 500 });
  }
}