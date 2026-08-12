/**
 * Carousel Image Generator using @vercel/og (satori + resvg)
 * Renders 5-slide Instagram carousel content as PNG images.
 * Brand colors: Bold Pink #FF7095, Rich Purple #4D1D57, Metallic Gold #FFD700
 * IG format: 1080x1080px
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { createElement } from 'react';
import { ImageResponse } from '@vercel/og';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// We use @vercel/og (satori + resvg) to render slides to real PNG buffers,
// in addition to the plain HTML output kept for quick text preview/debugging.

export interface CarouselSlide {
  slide_number: number;
  headline: string;
  body: string;
  type: 'hook' | 'insight' | 'tip' | 'cta';
}

export interface CarouselData {
  title: string;
  topic: string;
  slides: CarouselSlide[];
}

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1080;

// Slide type configurations
const SLIDE_CONFIGS: Record<string, { bg: string; accent: string; textColor: string }> = {
  hook: { bg: '#4D1D57', accent: '#FFD700', textColor: '#FFFFFF' },
  insight: { bg: '#171117', accent: '#FF7095', textColor: '#FFFFFF' },
  tip: { bg: '#1A0A1F', accent: '#FF7095', textColor: '#FFFFFF' },
  cta: { bg: '#4D1D57', accent: '#FFD700', textColor: '#FFFFFF' },
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Fonts are bundled under public/fonts (TTF, static instances of Manrope,
// each well under Satori's 500KB per-font limit) so Satori can embed real
// glyphs instead of falling back to tofu/missing-glyph boxes.
let fontsPromise: Promise<{ regular: Buffer; bold: Buffer }> | null = null;

async function loadFonts(): Promise<{ regular: Buffer; bold: Buffer }> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const fontsDir = path.join(process.cwd(), 'public', 'fonts');
      const [regular, bold] = await Promise.all([
        readFile(path.join(fontsDir, 'Manrope-Regular.ttf')),
        readFile(path.join(fontsDir, 'Manrope-Bold.ttf')),
      ]);
      return { regular, bold };
    })();
  }
  return fontsPromise;
}

/**
 * Build the Satori-compatible element tree for a single slide.
 * Every text-bearing node is an explicit flex container, per Satori's
 * layout constraints (flexbox only, no implicit block layout).
 */
function buildSlideElement(slide: CarouselSlide, slideIndex: number) {
  const config = SLIDE_CONFIGS[slide.type] || SLIDE_CONFIGS.tip;
  const slideNumber = slide.slide_number || slideIndex + 1;

  return createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: config.bg,
        color: config.textColor,
        fontFamily: 'Manrope',
        padding: 80,
        position: 'relative',
      },
    },
    createElement('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 999,
        background: `${config.accent}15`,
        top: -100,
        right: -100,
      },
    }),
    createElement('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 999,
        background: `${config.accent}10`,
        bottom: -80,
        left: -80,
      },
    }),
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: `${config.accent}20`,
          border: `1px solid ${config.accent}40`,
          borderRadius: 100,
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: config.accent,
          marginBottom: 40,
        },
      },
      slide.type.toUpperCase()
    ),
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1.15,
          textAlign: 'center',
          marginBottom: 32,
          maxWidth: 800,
          letterSpacing: '-0.02em',
        },
      },
      slide.headline
    ),
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          fontSize: 28,
          fontWeight: 400,
          lineHeight: 1.6,
          textAlign: 'center',
          opacity: 0.85,
          maxWidth: 700,
        },
      },
      slide.body
    ),
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          position: 'absolute',
          bottom: 40,
          right: 60,
          fontSize: 18,
          fontWeight: 700,
          opacity: 0.3,
        },
      },
      `${slideNumber}/5`
    ),
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          position: 'absolute',
          bottom: 40,
          left: 60,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: config.accent,
          opacity: 0.6,
        },
      },
      'WANTED Woman'
    )
  );
}

/**
 * Render a single carousel slide to a PNG buffer at 1080x1080 using
 * @vercel/og (Satori + resvg). This is safe to call from a Node-runtime
 * route handler on every request (no filesystem writes required).
 */
export async function renderSlideToPNG(slide: CarouselSlide, slideIndex: number): Promise<Buffer> {
  const fonts = await loadFonts();
  const element = buildSlideElement(slide, slideIndex);

  const imageResponse = new ImageResponse(element, {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    fonts: [
      { name: 'Manrope', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Manrope', data: fonts.bold, weight: 700, style: 'normal' },
    ],
  });

  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate HTML for a carousel slide.
 * This HTML can be rendered with @vercel/og, Puppeteer, or saved as-is.
 */
function generateSlideHTML(slide: CarouselSlide, title: string, slideIndex: number): string {
  const config = SLIDE_CONFIGS[slide.type] || SLIDE_CONFIGS.tip;
  const slideNumber = slide.slide_number || slideIndex + 1;

  const typeLabels: Record<string, string> = {
    hook: '✨',
    insight: '💡',
    tip: '💎',
    cta: '💅',
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${SLIDE_WIDTH}px;
      height: ${SLIDE_HEIGHT}px;
      background: ${config.bg};
      color: ${config.textColor};
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 80px;
      position: relative;
      overflow: hidden;
    }
    .decorative-circle {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: ${config.accent}15;
      top: -100px;
      right: -100px;
    }
    .decorative-circle-2 {
      position: absolute;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: ${config.accent}10;
      bottom: -80px;
      left: -80px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: ${config.accent}20;
      border: 1px solid ${config.accent}40;
      border-radius: 100px;
      padding: 8px 20px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: ${config.accent};
      margin-bottom: 40px;
    }
    .headline {
      font-size: 52px;
      font-weight: 700;
      line-height: 1.15;
      text-align: center;
      margin-bottom: 32px;
      max-width: 800px;
      letter-spacing: -0.02em;
    }
    .body-text {
      font-size: 28px;
      font-weight: 400;
      line-height: 1.6;
      text-align: center;
      opacity: 0.85;
      max-width: 700px;
    }
    .slide-number {
      position: absolute;
      bottom: 40px;
      right: 60px;
      font-size: 18px;
      font-weight: 600;
      opacity: 0.3;
    }
    .brand-mark {
      position: absolute;
      bottom: 40px;
      left: 60px;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${config.accent};
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="decorative-circle"></div>
  <div class="decorative-circle-2"></div>
  <div class="badge">${typeLabels[slide.type] || ''} ${slide.type.toUpperCase()}</div>
  <div class="headline">${escapeHTML(slide.headline)}</div>
  <div class="body-text">${escapeHTML(slide.body)}</div>
  <div class="slide-number">${slideNumber}/5</div>
  <div class="brand-mark">WANTED Woman</div>
</body>
</html>`;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render carousel slides as HTML files.
 * These can be converted to PNG using @vercel/og, Puppeteer, or a screenshot service.
 * Returns paths to the generated HTML files.
 */
export async function renderCarouselImages(
  carousel: CarouselData,
  outputDir?: string
): Promise<string[]> {
  const dir = outputDir || path.join(process.cwd(), 'public', 'carousels');

  // Ensure output directory exists
  await mkdir(dir, { recursive: true });

  const slideFiles: string[] = [];
  const slug = slugify(carousel.title);

  for (let i = 0; i < carousel.slides.length; i++) {
    const slide = carousel.slides[i];
    const html = generateSlideHTML(slide, carousel.title, i);

    const filename = `${slug}-slide-${i + 1}.html`;
    const filepath = path.join(dir, filename);

    await writeFile(filepath, html, 'utf-8');
    slideFiles.push(filepath);
  }

  logger.info(`Rendered ${slideFiles.length} carousel slides for "${carousel.title}"`);
  return slideFiles;
}

export interface CarouselRenderResult {
  htmlFiles: string[];
  pngFiles: string[];
  /**
   * Present when PNG rendering failed entirely or partway through. A result
   * with `error` set must be treated as a broken/incomplete carousel — the
   * file counts alone cannot distinguish a failed render from a legitimately
   * empty carousel. `undefined` on success and on a 0-slide input.
   */
  error?: { message: string; cause?: unknown };
}

/**
 * Render all slides of a carousel to real 1080x1080 PNG files on disk using
 * @vercel/og (satori + resvg), in addition to the HTML preview files.
 *
 * Render failures are NOT swallowed: if any slide fails to render (e.g. a
 * missing font), the returned result carries an `error` marker so callers can
 * surface the failure instead of silently shipping a broken/empty carousel.
 * The PNGs written before the failure are still returned best-effort. A
 * genuinely empty carousel (0 slides) returns cleanly with no `error`.
 *
 * Note: on serverless platforms the filesystem is ephemeral, so these written
 * files are best-effort (useful for local generation/testing). The admin
 * dashboard renders/downloads PNGs on demand via the OG-image API route
 * (see app/api/admin/insights/carousels/[id]/slide/[slideNumber]/image),
 * which calls `renderSlideToPNG` directly and never depends on these files
 * existing.
 */
export async function renderCarouselPNGs(
  carousel: CarouselData,
  outputDir?: string
): Promise<CarouselRenderResult> {
  // Always generate the HTML preview files too.
  const htmlFiles = await renderCarouselImages(carousel, outputDir);

  const dir = outputDir || path.join(process.cwd(), 'public', 'carousels');
  await mkdir(dir, { recursive: true });

  const slug = slugify(carousel.title);
  const pngFiles: string[] = [];

  try {
    for (let i = 0; i < carousel.slides.length; i++) {
      const slide = carousel.slides[i];
      const buffer = await renderSlideToPNG(slide, i);

      const filename = `${slug}-slide-${i + 1}.png`;
      const filepath = path.join(dir, filename);

      await writeFile(filepath, buffer);
      pngFiles.push(filepath);
    }

    logger.info(`Rendered ${pngFiles.length} carousel PNGs for "${carousel.title}"`);
  } catch (error) {
    logger.error(`Failed to render carousel PNGs for "${carousel.title}"`, error);

    // Surface the failure to callers. `pngFiles` may contain the slides that
    // rendered before the error, so keep them, but the error marker makes a
    // partial/complete render failure distinguishable from an empty carousel.
    return {
      htmlFiles,
      pngFiles,
      error: {
        message: error instanceof Error ? error.message : String(error),
        cause: error,
      },
    };
  }

  return { htmlFiles, pngFiles };
}