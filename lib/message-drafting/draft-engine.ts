import { env } from '../config/env';
import { logger } from '../utils/logger';

export type DraftTone = 'Soft' | 'Direct' | 'Playful' | 'Vulnerable' | 'Neutral';

export interface DraftResult {
  draftedText: string;
  tone: DraftTone;
}

const TONE_INSTRUCTIONS: Record<DraftTone, string> = {
  Soft: `Rewrite with gentle warmth. Use softer language, add tenderness. Make it feel like a whisper, not a declaration. Keep the core message but wrap it in care. Think: what would this sound like if she was being deeply gentle but still honest?`,

  Direct: `Rewrite with clear, confident directness. No hedging, no softening. Say it plainly and powerfully. Keep the warmth but remove the qualifiers. Think: what would this sound like if she owned it completely without apology?`,

  Playful: `Rewrite with lightness and humor. Add a little spark, a little flirt. Keep the real message underneath but make it fun to read. Think: what would this sound like if she was smiling while writing it?`,

  Vulnerable: `Rewrite with raw honesty. Strip the armor. Let the real feeling underneath come through without polishing it away. Think: what would this sound like at 2am when she stopped performing and just told the truth?`,

  Neutral: `Clean up clarity and delivery only. Fix the flow, tighten the phrasing, remove filler — but do not shift the tone in any direction. This is editing, not rewriting. Think: what would this sound like if she just cleaned it up without changing who she is?`,
};

const SYSTEM_PROMPT = `You are Coach Cass AI, a text-drafting assistant for the WANTED Woman app.

Your job: help a woman rephrase what she wants to say to her partner (or someone she's dating) so it lands better — without changing who she is.

CRITICAL RULES:
1. NEVER change the user's voice. You are refining clarity and delivery, not rewriting her identity.
2. Output PLAIN TEXT ONLY. No markdown. No headers (###). No bold (**). No bullets. No formatting of any kind. Just sentences and line breaks.
3. Keep it conversational. Think texting your person, not writing an essay.
4. Preserve the emotional core. If she's hurt, the draft should still feel hurt — just clearer. If she's playful, stay playful.
5. Never add things she didn't say. Never remove things that matter to her.
6. Keep it short enough for a text message. No walls of text. 1-4 sentences max unless her original was longer.
7. End naturally. No "I hope that helps" or "Let me know." Just the message.`;

export async function draftMessage(rawText: string, tone: DraftTone): Promise<DraftResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const toneInstruction = TONE_INSTRUCTIONS[tone];

  const userPrompt = `Here is what she wants to say:

"${rawText}"

Tone: ${tone}

${toneInstruction}

Rewrite it now. Plain text only. No markdown. No formatting. Just the message.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenRouter draft API error', { status: response.status, body: errorText });
      throw new Error(`Draft API error: ${response.status}`);
    }

    const data = await response.json();
    let draftedText = data.choices?.[0]?.message?.content?.trim() || '';

    // Strip any lingering markdown artifacts
    draftedText = draftedText
      .replace(/^#{1,6}\s+(.+)$/gm, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/^[-•]\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { draftedText, tone };
  } catch (error) {
    logger.error('Failed to draft message', error);
    throw error;
  }
}