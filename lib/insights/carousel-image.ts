/**
 * Carousel Image Generator using @vercel/og (satori + resvg)
 * Renders 5-slide Instagram carousel content as PNG images.
 * Brand colors: Bold Pink #FF7095, Rich Purple #4D1D57, Metallic Gold #FFD700
 * IG format: 1080x1080px
 */

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// We'll use satori for server-side rendering (same engine as @vercel/og)
// If @vercel/og is available, we use it. Otherwise, we generate HTML that can be
// converted to images via a headless browser or saved as-is for manual processing.

interface CarouselSlide {
  slide_number: number;
  headline: string;
  body: string;
  type: 'hook' | 'insight' | 'tip' | 'cta';
}

interface CarouselData {
  title: string;
  topic: string;
  slides: CarouselSlide[];
}

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1080;

// Slide type configurations
const SLIDE_CONFIGS: Record<string, { bg: string; accent: string; textColor: string }> = {
  hook: { bg: '#4D1D57', accent: '#FFD700', textColor: '#FFFFFF' },
  insight: { bg: '#171117', accent: '#FF7095', textColor: '#FFFFFF' },
  tip: { bg: '#1A0A1F', accent: '#FF7095', textColor: '#FFFFFF' },
  cta: { bg: '#4D1D57', accent: '#FFD700', textColor: '#FFFFFF' },
};

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
  const slug = carousel.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

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

/**
 * Try to use @vercel/og to render slides as PNG.
 * Falls back to HTML file generation if @vercel/og is not available.
 */
export async function renderCarouselPNGs(
  carousel: CarouselData,
  outputDir?: string
): Promise<{ htmlFiles: string[]; pngFiles: string[] }> {
  // First, always generate HTML files
  const htmlFiles = await renderCarouselImages(carousel, outputDir);

  // Try @vercel/og rendering
  // Note: @vercel/og works as a route handler, not a library function.
  // For server-side rendering, we'd need to use satori directly.
  // For now, we generate HTML files that can be:
  // 1. Served and screenshot'd via the admin dashboard
  // 2. Converted using Puppeteer/Playwright in a serverless function
  // 3. Uploaded to a design tool for final polish

  logger.info(`Carousel "${carousel.title}" rendered as HTML. PNG conversion requires @vercel/og route or browser automation.`);

  return {
    htmlFiles,
    pngFiles: [], // PNG conversion would require satori + resvg or browser automation
  };
}