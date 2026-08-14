import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';

// Diagnostic endpoint: runs the full Telegram delivery path for the latest
// stored carousel (render PNGs to /tmp + sendPhoto) and returns the exact
// result — so a delivery failure is observable instead of silent.
// Guarded by the cron secret so it is not open to the public.
export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const out: {
    env: {
      tokenSet: boolean;
      chatId: string;
      cwd: string;
      node: string;
      hasBlob: boolean;
      hasFormData: boolean;
      tmpWritable: unknown;
    };
    carousel?: { id: string; title: string; slides: number };
    step?: string;
    error?: unknown;
    render?: { ok: boolean; error: string | null; pngFiles: string[] };
    delivery?: { ok: boolean; reason: string | null; photoMessageIds?: number[]; captionMessageId?: number };
  } = {
    env: {
      tokenSet: !!process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID || '(default 6949338820)',
      cwd: process.cwd(),
      node: process.version,
      hasBlob: typeof Blob !== 'undefined',
      hasFormData: typeof FormData !== 'undefined',
      tmpWritable: null,
    },
  };

  // Test /tmp writability first
  try {
    const { mkdtemp, writeFile, readFile, rm } = await import('fs/promises');
    const { join } = await import('path');
    const { tmpdir } = await import('os');
    const dir = await mkdtemp(join(tmpdir(), 'diag-'));
    const f = join(dir, 'probe.txt');
    await writeFile(f, 'probe');
    const back = await readFile(f, 'utf-8');
    await rm(dir, { recursive: true });
    out.env.tmpWritable = back === 'probe' ? 'yes' : 'mismatch';
  } catch (e) {
    out.env.tmpWritable = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    return NextResponse.json(out, { status: 200 });
  }

  // Load the latest carousel from the DB and try the full delivery path
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('carousel_content')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) {
      out.step = 'no-carousel';
      return NextResponse.json(out, { status: 200 });
    }

    out.carousel = { id: data.id, title: data.title, slides: data.slides?.length ?? 0 };

    const carousel: {
      title: string;
      topic: string;
      slides: Array<{ slide_number: number; headline: string; body: string; type: 'hook' | 'insight' | 'tip' | 'cta' }>;
    } = {
      title: data.title,
      topic: data.topic,
      slides: data.slides as Array<{
        slide_number: number;
        headline: string;
        body: string;
        type: 'hook' | 'insight' | 'tip' | 'cta';
      }>,
    };

    // Render to /tmp
    const { renderCarouselPNGs } = await import('@/lib/insights/carousel-image');
    const { sendCarouselToTelegram } = await import('@/lib/delivery/telegram');
    const { tmpdir } = await import('os');
    const { join } = await import('path');

    const rendered = await renderCarouselPNGs(carousel, join(tmpdir(), 'cc-diag'));
    out.render = { ok: !rendered.error, error: rendered.error?.message || null, pngFiles: rendered.pngFiles };

    if (rendered.error || rendered.pngFiles.length === 0) {
      return NextResponse.json(out, { status: 200 });
    }

    const { readFile } = await import('fs/promises');
    const pngBuffers = [];
    for (const p of rendered.pngFiles) pngBuffers.push(await readFile(p));

    const result = await sendCarouselToTelegram(carousel, pngBuffers);
    out.delivery = {
      ok: result.ok,
      reason: result.reason || null,
      photoMessageIds: result.photoMessageIds,
      captionMessageId: result.captionMessageId,
    };
  } catch (e) {
    out.step = 'delivery-path';
    out.error = e instanceof Error ? { message: e.message, stack: e.stack?.slice(0, 500) } : String(e);
  }

  return NextResponse.json(out, { status: 200 });
}
