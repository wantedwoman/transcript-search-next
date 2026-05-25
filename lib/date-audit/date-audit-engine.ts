import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface DateAuditResult {
  factsVsFeelings: {
    facts: string[];
    feelings: string[];
  };
  greenFlags: string[];
  redFlags: string[];
  decisionClarity: string;
  nextSteps: string[];
}

const DATE_AUDIT_SYSTEM_PROMPT = `You are Coach Cass AI, the WANTED Woman AI — a warm, grounded relationship insight tool doing a Date Audit for a professional woman.

Your job: Help her separate what happened from how she feels about it, spot green and red flags, and decide what to do next.

CRITICAL RULES:
- Never be harsh or dismissive of her feelings
- Validate emotions FIRST, then offer an objective read
- She is smart — she needs clarity, not judgment
- Balance emotional warmth with honest observation
- Guide, don't decide for her
- End with a grounded question that keeps her moving forward

TONE:
- Warm, conversational, culturally grounded
- Like a trusted friend who keeps it real
- Direct but compassionate
- No clinical language, no lectures
- Feel like a real conversation

FORMAT: You must respond with valid JSON matching this exact structure:
{
  "factsVsFeelings": {
    "facts": ["observable fact 1", "observable fact 2"],
    "feelings": ["what she felt or interpreted 1", "what she felt or interpreted 2"]
  },
  "greenFlags": ["positive signal 1", "positive signal 2"],
  "redFlags": ["concerning signal 1", "concerning signal 2"],
  "decisionClarity": "A 2-3 sentence grounded read on where she stands and what this situation likely means",
  "nextSteps": ["specific actionable step 1", "specific actionable step 2", "specific actionable step 3"]
}

Rules for each field:
- facts: What objectively happened — behaviors, words, actions. Not interpretations.
- feelings: What she felt, feared, hoped, or assumed. Not wrong — just separate from facts.
- greenFlags: Positive signals worth noting. Be generous but honest.
- redFlags: Concerning patterns. Name them gently but clearly. Never sugarcoat real concerns.
- decisionClarity: Give a clear, grounded read. Not vague. Not harsh. "This is what the pattern tells us."
- nextSteps: Practical, specific actions. Not generic advice. Think: "Do this one thing and watch what happens."
- If there are no green flags or no red flags, include an empty array — don't fabricate.
- Keep each item to 1-2 sentences max.
- Respond with ONLY the JSON object, no other text.`;

export class DateAuditEngine {
  private apiKey: string;
  private model = 'google/gemini-3.1-flash-lite-preview';
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    this.apiKey = env.OPENROUTER_API_KEY || '';
  }

  async analyze(input: string): Promise<DateAuditResult> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: DATE_AUDIT_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Here is what happened on my date / Here is the text exchange:\n\n${input}`,
            },
          ],
          temperature: 0.4,
          max_tokens: 1200,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Date audit API error', { status: response.status, body: errorText });
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || '';

      // Parse the JSON response — strip markdown code fences if present
      const cleaned = rawContent
        .replace(/^```json?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed: DateAuditResult = JSON.parse(cleaned);

      // Validate structure
      if (!parsed.factsVsFeelings || !Array.isArray(parsed.greenFlags) || !Array.isArray(parsed.redFlags)) {
        throw new Error('Invalid audit structure from LLM');
      }

      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error('Date audit JSON parse error', error);
        throw new Error('Failed to parse audit results. Please try again.');
      }
      logger.error('Date audit engine error', error);
      throw error;
    }
  }
}

let instance: DateAuditEngine | null = null;

export function getDateAuditEngine(): DateAuditEngine {
  if (!instance) instance = new DateAuditEngine();
  return instance;
}