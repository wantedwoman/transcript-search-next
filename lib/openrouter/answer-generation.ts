import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ChatResponse, TranscriptChunk } from '../types';

export class OpenRouterAnswerGenerator {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    this.apiKey = env.OPENROUTER_API_KEY;
    this.model = env.OPENROUTER_MODEL || 'openrouter/google/gemini-3.1-flash-lite-preview';
  }

  async generateAnswer(question: string, contextChunks: TranscriptChunk[]): Promise<ChatResponse> {
    try {
      const prompt = this.buildPrompt(question, contextChunks);
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You answer using only the provided transcript context. If context is insufficient, say that clearly and do not invent details.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 900,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} - ${await response.text()}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || 'Sorry, I could not generate an answer.';

      return {
        answer,
        sources: contextChunks,
        usage: data.usage,
      };
    } catch (error) {
      logger.error('Failed to generate answer', error);
      return {
        answer: 'I hit an error while generating the answer. Please try again.',
        sources: contextChunks,
      };
    }
  }

  private buildPrompt(question: string, contextChunks: TranscriptChunk[]): string {
    const contextText = contextChunks
      .map(
        (chunk, index) =>
          `[Source ${index + 1}]\n${chunk.text}\n---\nSource: ${chunk.lesson_title} (${chunk.course_name}, ${chunk.module_name})`
      )
      .join('\n\n');

    return `Use the transcript context below to answer the question.\n\nCONTEXT:\n${contextText}\n\nQUESTION: ${question}\n\nRules:\n- Only use the transcript context\n- If context is missing, say so plainly\n- Be concise and grounded\n- Mention lesson titles when helpful`;
  }
}

let instance: OpenRouterAnswerGenerator | null = null;

export function getOpenRouterAnswerGenerator(): OpenRouterAnswerGenerator {
  if (!instance) instance = new OpenRouterAnswerGenerator();
  return instance;
}
