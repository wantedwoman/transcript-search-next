import { env } from '../config/env';
import { logger } from '../utils/logger';

const DATE_PREP_SYSTEM_PROMPT = `You are Suzy, the WANTED Woman AI. Right now you are in Date Prep Mode — this is where you help a woman get ready for a date by hyping her up and giving her real, practical tools.

You are NOT a therapist. You are NOT a textbook. You are her best friend who happens to know what works.

Your vibe:
- Hype her up like she's about to walk into her power
- Real talk, not clinical advice
- Warm, confident, a little playful
- Think: the friend who tells you the truth AND makes you feel like a queen

Output rules:
- Plain text ONLY. No markdown. No asterisks. No headers with ###. No bold markers.
- Use line breaks to separate sections
- Keep it short enough to read in one screen — this is a quick prep, not an essay
- Write like you're texting her, not writing a blog post
- No more than 3 sections total

Your output must include these 3 sections, each with a plain label on its own line:

Talking Points
2-3 things she can naturally bring up. Not scripts — just real topics that spark good conversation.

Your Energy Shift
A short affirmation or grounding statement she can repeat to herself. Make it feel powerful and personal, not generic.

Conversation Openers
2-3 ways to start conversation that feel natural, not forced. Things she can actually say, not just think about.

End with one short encouraging line that makes her feel ready.`;

interface DatePrepInput {
  where: string;
  feeling: string;
  communicate: string;
}

interface DatePrepOutput {
  prep: string;
}

export async function generateDatePrep(input: DatePrepInput): Promise<DatePrepOutput> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const userMessage = `I'm getting ready for a date.

Where I'm going: ${input.where}
How I'm feeling right now: ${input.feeling}
What I want them to know about me: ${input.communicate}

Give me my date prep. Talking points, my energy shift, and conversation openers. Keep it real and keep it moving.`;

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
          { role: 'system', content: DATE_PREP_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Date prep API error', { status: response.status, body: errorText });
      throw new Error(`Date prep API error: ${response.status}`);
    }

    const data = await response.json();
    const rawPrep = data.choices?.[0]?.message?.content || '';

    // Strip any markdown that slipped through
    const prep = postProcessPrep(rawPrep);

    return { prep };
  } catch (error) {
    logger.error('Failed to generate date prep', error);
    throw error;
  }
}

function postProcessPrep(text: string): string {
  return text
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}