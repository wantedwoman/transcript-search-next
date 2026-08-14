import { createServiceRoleClient } from '../auth/auto-provision';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface CarouselSlide {
  slide_number: number;
  headline: string;
  body: string;
  type: 'hook' | 'insight' | 'tip' | 'cta';
}

interface CarouselResult {
  title: string;
  topic: string;
  slides: CarouselSlide[];
}

const CAROUSEL_PROMPT = `You are a social media content creator for WANTED Woman, a relationship coaching brand for professional Black women. Create a 5-slide Instagram carousel based on the provided insights.

Brand voice: warm, direct, culturally grounded, empowering. No corporate speak. Real talk.

Brand colors: Bold Pink #FF7095, Rich Purple #4D1D57, Metallic Gold #FFD700

Carousel structure:
- Slide 1 (hook): Attention-grabbing question or statement that stops the scroll
- Slide 2 (insight): Key relationship insight from real coaching conversations
- Slide 3 (tip): Actionable advice or framework
- Slide 4 (tip): Second actionable tip or reframe
- Slide 5 (cta): Call to action — "Follow for more" or "DM WANTED for coaching"

Return JSON with exactly these fields:
- title: short catchy title for the carousel (3-6 words)
- topic: the main topic this carousel covers
- slides: array of exactly 5 slides, each with:
  - slide_number: 1-5
  - headline: bold text for the slide (max 8 words)
  - body: supporting text (max 40 words)
  - type: one of "hook", "insight", "tip", "cta"

Return ONLY valid JSON, no markdown.`;

export async function generateCarouselContent(): Promise<CarouselResult[]> {
  try {
    const supabase = createServiceRoleClient();

    // Get latest aggregate insights
    const { data: aggregates, error } = await supabase
      .from('aggregate_insights')
      .select('*')
      .order('date', { ascending: false })
      .limit(3);

    if (error || !aggregates || aggregates.length === 0) {
      logger.info('No aggregate insights available for carousel generation');
      return [];
    }

    const insightsText = aggregates
      .map((agg: Record<string, unknown>) => {
        const parts: string[] = [];
        if ((agg.trending_topics as string[])?.length) {
          parts.push(`Trending: ${(agg.trending_topics as string[]).join(', ')}`);
        }
        if ((agg.common_questions as string[])?.length) {
          parts.push(`Questions: ${(agg.common_questions as string[]).join('; ')}`);
        }
        if ((agg.recurring_pain_points as string[])?.length) {
          parts.push(`Pain points: ${(agg.recurring_pain_points as string[]).join('; ')}`);
        }
        if ((agg.content_hooks as string[])?.length) {
          parts.push(`Content hooks: ${(agg.content_hooks as string[]).join('; ')}`);
        }
        return parts.join('\n');
      })
      .join('\n\n');

    // Generate 2 carousels
    const carousels: CarouselResult[] = [];

    for (let i = 0; i < 2; i++) {
      const focus = i === 0 ? 'a trending topic' : 'a common pain point';
      const carouselPrompt = `${CAROUSEL_PROMPT}\n\nFocus on ${focus} from these insights:\n\n${insightsText}`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.1-flash-lite-preview',
          messages: [
            { role: 'system', content: carouselPrompt },
            {
              role: 'user',
              content: `Create carousel ${i + 1} of 2. Make it different from carousel 1. Focus on ${focus}.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 600,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        logger.error(`Carousel generation API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || '';

      let carousel: CarouselResult;
      try {
        carousel = JSON.parse(rawContent);
        if (!carousel.title || !carousel.slides || carousel.slides.length !== 5) {
          logger.error('Invalid carousel structure', rawContent);
          continue;
        }
        carousels.push(carousel);
      } catch {
        logger.error('Failed to parse carousel JSON', rawContent);
        continue;
      }
    }

    // Store carousels in database
    for (const carousel of carousels) {
      const latestAggregate = aggregates[0] as Record<string, unknown>;
      const { data: stored, error: insertError } = await supabase
        .from('carousel_content')
        .insert({
          title: carousel.title,
          slides: carousel.slides,
          status: 'draft',
          source_insight_id: latestAggregate.id,
        })
        .select('id')
        .single();

      if (insertError) {
        logger.error('Failed to store carousel content', insertError);
        continue;
      }

      // Auto-deliver to Telegram after every generation (cron + manual).
      // Renders the 5 slides to PNGs and sends them to the owner's chat.
      // Never blocks the generation pipeline if delivery fails.
      try {
        const { renderCarouselPNGs } = await import('./carousel-image');
        const { sendCarouselToTelegram } = await import('../delivery/telegram');
        const rendered = await renderCarouselPNGs(carousel);
        if (rendered.error) {
          logger.error(
            `Telegram delivery skipped for "${carousel.title}": PNG render failed`,
            rendered.error.message
          );
          continue;
        }
        const pngBuffers: Buffer[] = [];
        for (const pngPath of rendered.pngFiles) {
          const { readFile } = await import('fs/promises');
          pngBuffers.push(await readFile(pngPath));
        }
        const result = await sendCarouselToTelegram(carousel, pngBuffers);
        if (result.ok) {
          logger.info(
            `Carousel "${carousel.title}" (${carousel.slides.length} slides) delivered to Telegram`
          );
        } else {
          logger.warn(
            `Telegram delivery issue for "${carousel.title}": ${result.reason || 'unknown'}`
          );
        }
      } catch (deliveryErr) {
        logger.error(`Telegram delivery failed for "${carousel.title}"`, deliveryErr);
      }
    }

    logger.info(`Generated ${carousels.length} carousel content items`);
    return carousels;
  } catch (error) {
    logger.error('Carousel content generation failed', error);
    return [];
  }
}