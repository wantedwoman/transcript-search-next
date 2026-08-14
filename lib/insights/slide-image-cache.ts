import type { CarouselSlide } from './carousel-image';

/**
 * Server-side cache for rendered carousel slide PNGs.
 *
 * Renders (resvg via @vercel/og) are expensive and the slide-image route is
 * hit once per slide whenever a carousel is expanded in the admin dashboard.
 * Without a server-side cache every expand = N fresh CPU-heavy renders.
 *
 * The cache key is derived from the slide CONTENT (not just id + slide number),
 * so it is automatically invalidated whenever the carousel's slides change:
 * a regenerated/edited slide produces a different fingerprint and therefore a
 * different key, so stale images are never served. Regeneration that creates a
 * brand-new carousel row also produces a new id, which changes the key too.
 *
 * Backed by a bounded module-level Map with LRU eviction (max PNG_CACHE_MAX
 * entries). Node runtime only — fine for the nodejs-runtime image route.
 */

const PNG_CACHE_MAX = 200;
const pngCache = new Map<string, Buffer>();

/**
 * Number of times the slide image route actually rendered a slide from scratch
 * (i.e. cache misses). Exposed for the CC-06 prove-fixed check: a second GET
 * for the same slide must not bump this counter.
 */
let slideRenderCount = 0;

/** Record that a slide was rendered from scratch rather than served from cache. */
export function incrementSlideRenderCount(): void {
  slideRenderCount += 1;
}

/** Total number of cache-miss renders since the process started. */
export function getSlideRenderCount(): number {
  return slideRenderCount;
}

/** Fast non-cryptographic hash (FNV-1a) of the slide's text content. */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Deterministic fingerprint of a slide's rendering inputs. */
export function slideFingerprint(slide: CarouselSlide): string {
  return fnv1a(
    `${slide.slide_number ?? ''}|${slide.headline ?? ''}|${slide.body ?? ''}|${slide.type ?? ''}`
  );
}

/** Cache key tying a rendered slide to its carousel id, position and content. */
export function slideImageCacheKey(
  id: string,
  slideNumber: number,
  slideIndex: number,
  slide: CarouselSlide
): string {
  return `${id}:${slideNumber}:${slideIndex}:${slideFingerprint(slide)}`;
}

/** Read a cached slide PNG, touching it for LRU ordering. */
export function getCachedSlideImage(key: string): Buffer | undefined {
  if (!pngCache.has(key)) {
    return undefined;
  }
  const value = pngCache.get(key)!;
  // Move to the end (most recently used) for LRU eviction.
  pngCache.delete(key);
  pngCache.set(key, value);
  return value;
}

/** Store a rendered slide PNG, evicting the least-recently-used entry if full. */
export function cacheSlideImage(key: string, png: Buffer): void {
  pngCache.set(key, png);
  if (pngCache.size > PNG_CACHE_MAX) {
    const oldestKey = pngCache.keys().next().value;
    if (oldestKey !== undefined) {
      pngCache.delete(oldestKey);
    }
  }
}

/** Number of entries currently cached — exposed for testing/monitoring. */
export function slideImageCacheSize(): number {
  return pngCache.size;
}
