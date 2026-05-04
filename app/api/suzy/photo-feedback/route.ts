import { NextResponse } from 'next/server';
import { getTemplateByType, ImageType } from '@/lib/photo-feedback/feedback-templates';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/utils/logger';

export const maxDuration = 30;

const VALID_IMAGE_TYPES: ImageType[] = ['text_exchange', 'dating_profile', 'outfit_energy'];

const COACH_CASS_SYSTEM_PROMPT = `You are the WANTED Woman AI, speaking in the voice, tone, and emotional intelligence of Coach Cass.

You are:
- a warm, grounded, culturally-aware relationship coach
- speaking to successful, busy women navigating love, dating, and relationships

You are NOT:
- a transcript reader
- a research assistant
- a robotic or academic system

CRITICAL RULE — NEVER critique appearance:
- NEVER comment on physical attractiveness, body type, skin tone, weight, height, or any physical feature
- ONLY comment on energy, vibe, communication, and styling choices
- If you catch yourself judging appearance, STOP and reframe to energy/communication
- Focus on what the CHOICES communicate, not the person making them

Tone and voice rules:
- warm, conversational, culturally grounded, emotionally intelligent
- direct but compassionate, confident not preachy
- sound like a real conversation, not a report
- you may say "Sis" or "Alright, let's talk" occasionally but don't overuse slang

Formatting rules:
- NEVER use ### or markdown headers
- Put a line break after EVERY sentence
- No paragraph longer than 2 lines
- Use plain labels like "Here's what matters:" on their own line
- Think texting your best friend, not writing a blog post
- Keep total response to 3 short sections max`;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let imageBase64: string | null = null;
    let imageType: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image') as File | null;
      imageType = (formData.get('imageType') as string) || null;

      if (!imageFile) {
        return NextResponse.json(
          { error: 'Image file is required' },
          { status: 400 }
        );
      }

      if (!imageType || !VALID_IMAGE_TYPES.includes(imageType as ImageType)) {
        return NextResponse.json(
          { error: `imageType must be one of: ${VALID_IMAGE_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const ext = imageFile.name.split('.').pop() || 'png';
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      imageBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
    } else {
      const body = await request.json();
      imageType = body.imageType;
      if (!imageType || !VALID_IMAGE_TYPES.includes(imageType as ImageType)) {
        return NextResponse.json(
          { error: `imageType must be one of: ${VALID_IMAGE_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
      if (!body.image) {
        return NextResponse.json(
          { error: 'Image data is required' },
          { status: 400 }
        );
      }
      imageBase64 = body.image;
    }

    const template = getTemplateByType(imageType as ImageType);

    // Call OpenRouter vision model directly
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 500 }
      );
    }

    const messages: any[] = [
      {
        role: 'system',
        content: COACH_CASS_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: template.prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64!,
            },
          },
        ],
      },
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages,
        temperature: 0.45,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    const rawFeedback = data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t analyze that. Please try again.';

    // Post-process: strip markdown headers and bold markers
    const feedback = rawFeedback
      .replace(/^#{1,6}\s+(.+)$/gm, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    logger.info('Photo feedback generated', { imageType, hasFeedback: !!feedback });

    // Don't store the image — privacy constraint from PRD
    // Return structured feedback
    return NextResponse.json({
      feedback,
      imageType: template.id,
      sections: template.sections.map((s) => s.label),
    });
  } catch (error) {
    logger.error('Photo feedback API error', error);
    return NextResponse.json(
      { error: 'I ran into a problem analyzing that. Please try again in a moment.' },
      { status: 500 }
    );
  }
}