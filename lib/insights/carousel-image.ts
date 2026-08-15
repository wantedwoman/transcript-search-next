/**
 * Carousel Image Generator using @vercel/og (satori + resvg)
 * Renders 5-slide Instagram carousel content as PNG images.
 * Brand colors: Bold Pink #FF7095, Rich Purple #4D1D57, Metallic Gold #FFD700
 * IG format: 1080x1080px
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { createElement } from 'react';
// Load the standalone @vercel/og Node build from a VENDORED copy inside the
// repo (lib/vendor/og), imported by relative path. Next 16's Turbopack
// rewrites bare `@vercel/og` imports (and even createRequire('@vercel/og'))
// to `next/og`, whose serverless build loads
// `next/dist/compiled/@vercel/og/index.node.js` — a file Vercel does not
// ship to lambdas ("Cannot find module"). Vendoring bypasses package
// resolution entirely: Turbopack bundles index.node.js in, and its asset
// reads (Geist-Regular.ttf, resvg.wasm, yoga.wasm via import.meta.url)
// resolve to the vendored siblings.
import { ImageResponse } from '../vendor/og/index.node.js';
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

// ---------------------------------------------------------------------------
// Overflow-safe text layout bounds.
//
// Satori does not auto-fit text: a slide with a very long headline/body used
// to grow past the fixed 1080x1080 canvas and clip silently at the edge. We
// bound the text column to a vertical budget, fit the font size down to a
// legibility-preserving floor when needed, and line-clamp with an ellipsis as
// a final safety net (see `fitCarouselText`).
// ---------------------------------------------------------------------------
const SLIDE_PADDING = 80;
const HEADLINE_WIDTH = 800;
const BODY_WIDTH = 700;
const BASE_HEADLINE_SIZE = 52;
const BASE_BODY_SIZE = 28;
// Floors: keep the brand look — never shrink to illegibility. Truncation with
// an ellipsis is the graceful fallback below these sizes.
const MIN_HEADLINE_SIZE = 34;
const MIN_BODY_SIZE = 20;
const HEADLINE_LINE_HEIGHT = 1.15;
const BODY_LINE_HEIGHT = 1.6;
// Vertical space available to the text column: canvas minus padding minus a
// 40px safety band above the absolute-positioned footer.
const TEXT_COLUMN_HEIGHT = SLIDE_HEIGHT - SLIDE_PADDING * 2 - 40;
// Fixed non-text heights inside the column: badge (~34) + badge margin (40) +
// headline margin (32) + a small buffer for measurement variance.
const TEXT_BUDGET = TEXT_COLUMN_HEIGHT - 112;
// Satori's rendered line box is fontSize*lineHeight * ~1.004 (measured). We
// budget with a slightly larger factor so the fit never fills the box to the
// pixel, leaving headroom for glyph/line-box variance. Because the wrap
// counter is exact, fitting content is NOT clamped down (clamp = natural line
// count); the factor only decides when to shrink the font.
const LINE_BOX_FACTOR = 1.06;
const MAX_FIT_ITERATIONS = 6;

// Slide type configurations — white-background palette per Coach Cass feedback.
// Base: clean white so the pink pops and the carousel feels premium on IG feeds.
const SLIDE_CONFIGS: Record<string, { bg: string; accent: string; textColor: string; subtextColor: string }> = {
  hook: { bg: '#FFFFFF', accent: '#FF7095', textColor: '#4D1D57', subtextColor: '#FF7095' },
  insight: { bg: '#FFFFFF', accent: '#FF7095', textColor: '#1A0A1F', subtextColor: '#4D1D57' },
  tip: { bg: '#FFFFFF', accent: '#FF7095', textColor: '#1A0A1F', subtextColor: '#4D1D57' },
  cta: { bg: '#FFFFFF', accent: '#4D1D57', textColor: '#1A0A1F', subtextColor: '#FF7095' },
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

// ---------------------------------------------------------------------------
// Text measurement + fit-then-clamp
//
// To contain oversized text gracefully we need to know, before rendering, how
// many lines Satori will wrap a given string into. Satori measures glyphs with
// the same TTFs it embeds, so we parse the bundled Manrope advance widths and
// reproduce the word-wrap (break at whitespace, break only over-long words) to
// predict the wrapped line count. That lets us shrink the font (to a floor)
// only when the text would otherwise exceed the vertical budget, and derive a
// safe line-clamp as the truncation fallback.
// ---------------------------------------------------------------------------

interface CarouselFontMetrics {
  unitsPerEm: number;
  /** advance width in font units for a single character */
  advanceOf: (char: string) => number;
}

let fontMetricsCache: { regular: CarouselFontMetrics; bold: CarouselFontMetrics } | null = null;

export 
// Logo URL - served from Next.js public folder
const LOGO_URL = '/logo.png';

async function getCarouselFontMetrics(fonts: { regular: Buffer; bold: Buffer }): Promise<{
  regular: CarouselFontMetrics;
  bold: CarouselFontMetrics;
}> {
  if (!fontMetricsCache) {
    fontMetricsCache = {
      regular: parseFontMetrics(fonts.regular),
      bold: parseFontMetrics(fonts.bold),
    };
  }
  return fontMetricsCache;
}

function parseFontMetrics(buf: Buffer): CarouselFontMetrics {
  const numTables = buf.readUInt16BE(4);
  const tables: Record<string, { offset: number; length: number }> = {};
  for (let i = 0; i < numTables; i++) {
    const recOff = 12 + i * 16;
    const tag = buf.toString('ascii', recOff, recOff + 4);
    tables[tag] = { offset: buf.readUInt32BE(recOff + 8), length: buf.readUInt32BE(recOff + 12) };
  }

  const unitsPerEm = buf.readUInt16BE(tables.head.offset + 18);
  const numHMetrics = buf.readUInt16BE(tables.hhea.offset + 34);
  const hmtxBase = tables.hmtx.offset;

  const advanceOfGlyph = (glyphId: number): number => {
    const idx = Math.min(glyphId, numHMetrics - 1);
    return buf.readUInt16BE(hmtxBase + idx * 4);
  };

  const glyphOf = parseCmap(buf, tables.cmap.offset);
  const spaceGlyph = glyphOf(0x20);

  return {
    unitsPerEm,
    advanceOf: (char: string): number => {
      const cp = char.codePointAt(0) ?? 0x20;
      // Normalize spaces to the space glyph so collapsing whitespace measures sanely.
      if (cp === 0x20 || cp === 0xa0) return advanceOfGlyph(spaceGlyph);
      return advanceOfGlyph(glyphOf(cp));
    },
  };
}

/** Build a unicode-codepoint → glyph-id lookup from the font's cmap table. */
function parseCmap(buf: Buffer, cmapOffset: number): (code: number) => number {
  const numTables = buf.readUInt16BE(cmapOffset + 2);
  let chosen: { offset: number } | null = null;
  for (let i = 0; i < numTables; i++) {
    const platform = buf.readUInt16BE(cmapOffset + 4 + i * 8);
    const encoding = buf.readUInt16BE(cmapOffset + 6 + i * 8);
    const subOffset = cmapOffset + buf.readUInt32BE(cmapOffset + 8 + i * 8);
    // Prefer the Unicode (platform 0) subtable, then Windows (platform 3).
    if (platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) {
      chosen = { offset: subOffset };
      if (platform === 0) break;
    }
  }
  if (!chosen) throw new Error('carousel: no usable cmap subtable in Manrope font');
  const sub = chosen.offset;
  const format = buf.readUInt16BE(sub);

  if (format === 4) {
    const segCountX2 = buf.readUInt16BE(sub + 6);
    const segCount = segCountX2 / 2;
    const endCodesOff = sub + 14;
    const startCodesOff = endCodesOff + segCountX2 + 2;
    const idDeltaOff = startCodesOff + segCountX2;
    const idRangeOffsetOff = idDeltaOff + segCountX2;
    const endCodes: number[] = [];
    const startCodes: number[] = [];
    const idDeltas: number[] = [];
    const idRangeOffsets: number[] = [];
    for (let i = 0; i < segCount; i++) {
      endCodes.push(buf.readUInt16BE(endCodesOff + i * 2));
      startCodes.push(buf.readUInt16BE(startCodesOff + i * 2));
      idDeltas.push(buf.readUInt16BE(idDeltaOff + i * 2));
      idRangeOffsets.push(buf.readUInt16BE(idRangeOffsetOff + i * 2));
    }
    return (code: number): number => {
      for (let i = 0; i < segCount; i++) {
        if (code >= startCodes[i] && code <= endCodes[i]) {
          if (idRangeOffsets[i] === 0) return (code + idDeltas[i]) & 0xffff;
          const glyphAddr = idRangeOffsetOff + i * 2 + idRangeOffsets[i] + (code - startCodes[i]) * 2;
          const gid = buf.readUInt16BE(glyphAddr);
          if (gid === 0) return 0;
          return (gid + idDeltas[i]) & 0xffff;
        }
      }
      return 0;
    };
  }

  if (format === 12) {
    const nGroups = buf.readUInt32BE(sub + 12);
    const groupsOff = sub + 16;
    const startChars: number[] = [];
    const endChars: number[] = [];
    const startGlyphs: number[] = [];
    for (let i = 0; i < nGroups; i++) {
      startChars.push(buf.readUInt32BE(groupsOff + i * 12));
      endChars.push(buf.readUInt32BE(groupsOff + i * 12 + 4));
      startGlyphs.push(buf.readUInt32BE(groupsOff + i * 12 + 8));
    }
    return (code: number): number => {
      for (let i = 0; i < nGroups; i++) {
        if (code >= startChars[i] && code <= endChars[i]) return startGlyphs[i] + (code - startChars[i]);
      }
      return 0;
    };
  }

  throw new Error(`carousel: unsupported cmap format ${format}`);
}

/**
 * Greedy word-wrap line counter matching Satori's default text wrapping:
 * lines break at whitespace, and a single word wider than the box breaks
 * (mirrors `word-break: break-word`). Returns the number of wrapped lines.
 */
export function countWrappedLines(
  text: string,
  fontSizePx: number,
  font: CarouselFontMetrics,
  maxWidthPx: number
): number {
  if (!text) return 0;
  const scale = fontSizePx / font.unitsPerEm;
  const widthOf = (s: string): number => {
    let w = 0;
    for (const ch of s) w += font.advanceOf(ch);
    return w * scale;
  };
  const spaceW = widthOf(' ');

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;

  let lines = 1;
  let lineW = 0;
  let lineHasContent = false;

  for (const word of words) {
    const wordW = widthOf(word);
    if (wordW > maxWidthPx) {
      // Over-long word: break it across as many lines as needed.
      const chars = Array.from(word);
      let i = 0;
      while (i < chars.length) {
        let run = '';
        let runW = 0;
        while (i < chars.length) {
          const cw = font.advanceOf(chars[i]) * scale;
          if (runW + cw <= maxWidthPx) {
            run += chars[i];
            runW += cw;
            i++;
          } else {
            break;
          }
        }
        if (run === '') {
          // A single glyph wider than the box: place it anyway (Satori would too).
          run = chars[i];
          runW = font.advanceOf(chars[i]) * scale;
          i++;
        }
        if (lineHasContent && lineW + spaceW + runW > maxWidthPx) {
          lines++;
          lineW = runW;
        } else {
          lineW = (lineHasContent ? lineW + spaceW : 0) + runW;
          lineHasContent = true;
        }
      }
      continue;
    }

    if (lineHasContent && lineW + spaceW + wordW > maxWidthPx) {
      lines++;
      lineW = wordW;
    } else {
      lineW = (lineHasContent ? lineW + spaceW : 0) + wordW;
      lineHasContent = true;
    }
  }
  return lines;
}

interface TextFit {
  headSize: number;
  bodySize: number;
  headClamp: number;
  bodyClamp: number;
}

/**
 * Choose font sizes and line-clamps so headline + body fit the vertical budget.
 *
 * - If the text already fits at the brand sizes, nothing shrinks and no content
 *   is truncated: the clamp is the exact natural wrapped line count (the
 *   counter matches Satori's layout, see exp validation).
 * - If it would overflow, both sizes step down together to a legibility floor,
 *   preserving the brand proportions rather than a jarring single-text shrink.
 * - The final clamp is the truncation safety net: it guarantees the rendered
 *   line box can never exceed the budget, even if real wrapping differed from
 *   the measurement. All heights are measured with LINE_BOX_FACTOR so the box
 *   is never filled to the pixel.
 */
export function fitCarouselText(
  headline: string,
  body: string,
  headFont: CarouselFontMetrics,
  bodyFont: CarouselFontMetrics
): TextFit {
  let headSize = BASE_HEADLINE_SIZE;
  let bodySize = BASE_BODY_SIZE;

  for (let i = 0; i < MAX_FIT_ITERATIONS; i++) {
    const headLines = countWrappedLines(headline, headSize, headFont, HEADLINE_WIDTH);
    const bodyLines = countWrappedLines(body, bodySize, bodyFont, BODY_WIDTH);
    const headH = headLines * headSize * HEADLINE_LINE_HEIGHT * LINE_BOX_FACTOR;
    const bodyH = bodyLines * bodySize * BODY_LINE_HEIGHT * LINE_BOX_FACTOR;
    if (headH + bodyH <= TEXT_BUDGET) break;
    const scale = TEXT_BUDGET / (headH + bodyH);
    const nextHead = Math.max(MIN_HEADLINE_SIZE, headSize * scale);
    const nextBody = Math.max(MIN_BODY_SIZE, bodySize * scale);
    if (nextHead === headSize && nextBody === bodySize) break; // both at floor
    headSize = nextHead;
    bodySize = nextBody;
  }

  // Round down to whole pixels: the budget was checked at the (slightly
  // larger) fractional size, so the integer size is guaranteed to fit.
  headSize = Math.max(MIN_HEADLINE_SIZE, Math.floor(headSize));
  bodySize = Math.max(MIN_BODY_SIZE, Math.floor(bodySize));

  const headLines = countWrappedLines(headline, headSize, headFont, HEADLINE_WIDTH);
  const bodyLines = countWrappedLines(body, bodySize, bodyFont, BODY_WIDTH);
  const headH = headLines * headSize * HEADLINE_LINE_HEIGHT * LINE_BOX_FACTOR;
  const bodyH = bodyLines * bodySize * BODY_LINE_HEIGHT * LINE_BOX_FACTOR;

  if (headH + bodyH <= TEXT_BUDGET) {
    // Fits at the chosen sizes: never truncate content that fits.
    return { headSize, bodySize, headClamp: Math.max(1, headLines), bodyClamp: Math.max(1, bodyLines) };
  }

  // Only reachable when both sizes are already at their floors: share the
  // budget proportionally and clamp each block so its rendered box stays put.
  const ratio = TEXT_BUDGET / (headH + bodyH);
  const headAlloc = headH * ratio;
  const bodyAlloc = bodyH * ratio;
  const headClamp = Math.max(1, Math.floor(headAlloc / (headSize * HEADLINE_LINE_HEIGHT * LINE_BOX_FACTOR)));
  const bodyClamp = Math.max(1, Math.floor(bodyAlloc / (bodySize * BODY_LINE_HEIGHT * LINE_BOX_FACTOR)));

  return { headSize, bodySize, headClamp, bodyClamp };
}

/**
 * Build the Satori-compatible element tree for a single slide.
 * Every text-bearing node is an explicit flex container, per Satori's
 * layout constraints (flexbox only, no implicit block layout).
 */
function buildSlideElement(slide: CarouselSlide, slideIndex: number, fit: TextFit, logoSrc: string | null = null) {
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
        padding: SLIDE_PADDING,
        position: 'relative',
        overflow: 'hidden',
      },
    },
    // Top-left branded header with logo
    createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: 36,
          left: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        },
      },
      [
        logoSrc ? createElement('img', {
          src: logoSrc,
          style: {
            width: 40,
            height: 40,
            objectFit: 'contain',
            opacity: 0.9,
          },
        }) : null,
        createElement(
          'span',
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: config.accent,
              opacity: 0.85,
            },
          },
          'WANTED Woman'
        ),
      ]
    ),
    // Subtle bottom-right badge / watermark area
    createElement(
      'div',
      {
        style: {
          position: 'absolute',
          bottom: 40,
          right: 60,
          fontSize: 18,
          fontWeight: 700,
          opacity: 0.3,
          color: config.subtextColor,
        },
      },
      `${slideNumber}/5`
    ),
    // Decorative accent circle — top right, soft pink
    createElement('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 999,
        background: `${config.accent}10`,
        top: -140,
        right: -140,
      },
    }),
    // Decorative accent circle — bottom left, even softer
    createElement('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 999,
        background: `${config.accent}08`,
        bottom: -80,
        left: -80,
      },
    }),
    // Slide type badge — pill, accent border/bg
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: `${config.accent}15`,
          border: `1.5px solid ${config.accent}50`,
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
    // Headline
    createElement(
      'div',
      {
        style: {
          display: '-webkit-box',
          fontSize: fit.headSize,
          fontWeight: 700,
          lineHeight: HEADLINE_LINE_HEIGHT,
          textAlign: 'center',
          marginBottom: 32,
          maxWidth: HEADLINE_WIDTH,
          letterSpacing: '-0.02em',
          wordBreak: 'break-word',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          WebkitLineClamp: fit.headClamp,
          color: config.textColor,
        },
      },
      slide.headline
    ),
    // Body
    createElement(
      'div',
      {
        style: {
          display: '-webkit-box',
          fontSize: fit.bodySize,
          fontWeight: 400,
          lineHeight: BODY_LINE_HEIGHT,
          textAlign: 'center',
          opacity: 0.8,
          maxWidth: BODY_WIDTH,
          wordBreak: 'break-word',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          WebkitLineClamp: fit.bodyClamp,
          color: config.textColor,
        },
      },
      slide.body
    ),
    // Bottom-left CTA / brand line (on Cta slide this becomes stronger)
    createElement(
      'div',
      {
        style: {
          position: 'absolute',
          bottom: 40,
          left: 60,
          fontSize: slide.type === 'cta' ? 18 : 16,
          fontWeight: slide.type === 'cta' ? 700 : 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: config.accent,
          opacity: slide.type === 'cta' ? 1 : 0.6,
        },
      },
      slide.type === 'cta' ? 'Link in bio' : 'coachcass.com'
    )
  );
}

/**
 * Render a single carousel slide to a PNG buffer at 1080x1080 using
 * @vercel/og (Satori + resvg). This is safe to call from a Node-runtime
 * route handler on every request (no filesystem writes required).
 */
export async function renderSlideToPNG(slide: CarouselSlide, slideIndex: number, logoSrc?: string | null): Promise<Buffer> {
  const fonts = await loadFonts();
  const metrics = await getCarouselFontMetrics(fonts);
  const fit = fitCarouselText(slide.headline, slide.body, metrics.bold, metrics.regular);
  const element = buildSlideElement(slide, slideIndex, fit, logoSrc);

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
function generateSlideHTML(
  slide: CarouselSlide,
  title: string,
  slideIndex: number,
  fit: TextFit
): string {
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
    /* Brand header top-left */
    .brand-header {
      position: absolute;
      top: 48px;
      left: 60px;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${config.accent};
      opacity: 0.85;
    }
    /* Slide number bottom-right */
    .slide-number {
      position: absolute;
      bottom: 40px;
      right: 60px;
      font-size: 18px;
      font-weight: 600;
      opacity: 0.3;
      color: ${config.subtextColor};
    }
    /* Decorative accent circles */
    .decorative-circle {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: ${config.accent}10;
      top: -140px;
      right: -140px;
    }
    .decorative-circle-2 {
      position: absolute;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: ${config.accent}08;
      bottom: -80px;
      left: -80px;
    }
    /* Type badge */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: ${config.accent}15;
      border: 1.5px solid ${config.accent}50;
      border-radius: 100px;
      padding: 8px 20px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: ${config.accent};
      margin-bottom: 40px;
    }
    .headline {
      font-size: ${fit.headSize}px;
      font-weight: 700;
      line-height: 1.15;
      text-align: center;
      margin-bottom: 32px;
      max-width: 800px;
      letter-spacing: -0.02em;
      word-break: break-word;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: ${fit.headClamp};
      overflow: hidden;
      text-overflow: ellipsis;
      color: ${config.textColor};
    }
    .body-text {
      font-size: ${fit.bodySize}px;
      font-weight: 400;
      line-height: 1.6;
      text-align: center;
      opacity: 0.8;
      max-width: 700px;
      word-break: break-word;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: ${fit.bodyClamp};
      overflow: hidden;
      text-overflow: ellipsis;
      color: ${config.textColor};
    }
    /* Footer */
    .footer {
      position: absolute;
      bottom: 40px;
      left: 60px;
      font-size: ${slide.type === 'cta' ? 18 : 16}px;
      font-weight: ${slide.type === 'cta' ? 700 : 600};
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${config.accent};
      opacity: ${slide.type === 'cta' ? 1 : 0.6};
    }
  </style>
</head>
<body>
  <div class="brand-header">WANTED Woman</div>
  <div class="decorative-circle"></div>
  <div class="decorative-circle-2"></div>
  <div class="badge">${typeLabels[slide.type] || ''} ${slide.type.toUpperCase()}</div>
  <div class="headline">${escapeHTML(slide.headline)}</div>
  <div class="body-text">${escapeHTML(slide.body)}</div>
  <div class="slide-number">${slideNumber}/5</div>
  <div class="footer">${slide.type === 'cta' ? 'Link in bio' : 'coachcass.com'}</div>
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

  // Measure against the real bundled fonts so the HTML preview matches the PNG
  // renderer's fit-then-clamp exactly.
  const fonts = await loadFonts();
  const metrics = await getCarouselFontMetrics(fonts);

  for (let i = 0; i < carousel.slides.length; i++) {
    const slide = carousel.slides[i];
    const fit = fitCarouselText(slide.headline, slide.body, metrics.bold, metrics.regular);
    const html = generateSlideHTML(slide, carousel.title, i, fit);

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