/**
 * Telegram delivery for generated carousels.
 *
 * Sends the 5 slide PNGs of a carousel to the owner's Telegram chat after
 * every generation (cron and manual). Uses the Bot API directly via fetch —
 * no SDK needed. Every function degrades gracefully: if TELEGRAM_BOT_TOKEN is
 * not configured (local dev, env not yet set), or the chat id is missing, or
 * Telegram is unreachable, we log and return a non-throwing result so the
 * generation pipeline is never blocked by delivery.
 */

import { logger } from '../utils/logger';

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6949338820';

const TELEGRAM_API = 'https://api.telegram.org';

export interface TelegramSendResult {
  ok: boolean;
  reason?: string;
  photoMessageIds?: number[];
  captionMessageId?: number;
}

function telegramUrl(method: string): string {
  return `${TELEGRAM_API}/bot${TELEGRAM_BOT_TOKEN}/${method}`;
}

async function callTelegram<T>(method: string, form: Record<string, string | Blob>): Promise<T | null> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(form)) {
    formData.append(key, value);
  }

  try {
    const res = await fetch(telegramUrl(method), {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      logger.error(`Telegram ${method} failed: HTTP ${res.status}`, await res.text().catch(() => ''));
      return null;
    }

    const data = await res.json();
    return data as T;
  } catch (err) {
    logger.error(`Telegram ${method} threw`, err);
    return null;
  }
}

/**
 * Send a single PNG slide as a photo message.
 */
async function sendPhoto(
  chatId: string,
  imageBuffer: Buffer,
  caption?: string
): Promise<number | null> {
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
  const result = await callTelegram<{ ok: boolean; result?: { message_id?: number } }>('sendPhoto', {
    chat_id: chatId,
    photo: blob,
    ...(caption ? { caption } : {}),
  });

  if (!result?.ok) return null;
  return result.result?.message_id ?? null;
}

/**
 * Send a text message (used for the summary line + the manual re-send button).
 */
export async function sendTelegramMessage(
  text: string,
  chatId: string = TELEGRAM_CHAT_ID
): Promise<TelegramSendResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.info('Telegram delivery skipped: TELEGRAM_BOT_TOKEN not configured');
    return { ok: false, reason: 'no-token' };
  }

  const result = await callTelegram<{ ok: boolean; result?: { message_id?: number } }>('sendMessage', {
    chat_id: chatId,
    text,
  });

  if (!result?.ok) {
    return { ok: false, reason: 'telegram-error' };
  }

  return { ok: true, captionMessageId: result.result?.message_id };
}

/**
 * Send a carousel to the owner's Telegram: a caption line + one photo message
 * per slide, in order. Sends slides one-by-one (each as its own photo) so the
 * receiver sees the full 1080x1080 PNG at full quality, and so partial
 * failures don't drop the whole carousel. Never throws.
 */
export async function sendCarouselToTelegram(
  carousel: { title: string; slides: Array<{ slide_number: number }> },
  pngBuffers: Buffer[],
  chatId: string = TELEGRAM_CHAT_ID
): Promise<TelegramSendResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn(
      `Telegram carousel delivery skipped: TELEGRAM_BOT_TOKEN not configured (chatId="${chatId}", slides=${pngBuffers.length})`
    );
    return { ok: false, reason: 'no-token' };
  }
  logger.info(
    `Telegram carousel delivery starting: chatId="${chatId}", slides=${pngBuffers.length}, tokenSet=true, hasBlob=${typeof Blob !== 'undefined'}, hasFormData=${typeof FormData !== 'undefined'}`
  );

  const slideCount = pngBuffers.length;
  const photoMessageIds: number[] = [];

  const captionResult = await sendTelegramMessage(
    `✨ New carousel ready: "${carousel.title}" — ${slideCount} slide(s). Review & post!`,
    chatId
  );

  for (let i = 0; i < pngBuffers.length; i++) {
    const caption = i === 0 ? `Slide ${i + 1}/${slideCount} · ${carousel.title}` : `Slide ${i + 1}/${slideCount}`;
    const messageId = await sendPhoto(chatId, pngBuffers[i], caption);
    if (messageId) photoMessageIds.push(messageId);
  }

  const delivered = photoMessageIds.length;

  if (delivered === 0) {
    logger.warn(`Telegram carousel delivery: 0/${slideCount} slides delivered for "${carousel.title}"`);
  } else {
    logger.info(
      `Telegram carousel delivered: ${delivered}/${slideCount} slides for "${carousel.title}"`
    );
  }

  return {
    ok: delivered === slideCount,
    reason: delivered === slideCount ? undefined : `partial: ${delivered}/${slideCount}`,
    photoMessageIds,
    captionMessageId: captionResult.captionMessageId,
  };
}
