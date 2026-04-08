import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ChatResponse, TranscriptChunk } from '../types';

export class OpenRouterAnswerGenerator {
  private apiKey: string;
  private model: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';

  constructor() {
    this.apiKey = env.OPENROUTER_API_KEY;
    this.model = env.OPENROUTER_MODEL || 'google/gemini-flash-1.5';
    
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }
    
    logger.info(`OpenRouter Answer Generator initialized with model: ${this.model}`);
  }

  /**
   * Generate a grounded answer using retrieved context
   */
  async generateAnswer(
    question: string,
    contextChunks: TranscriptChunk[]
  ): Promise<ChatResponse> {
    try {
      logger.info(`Generating answer for question: "${question.substring(0, 50)}..." with ${contextChunks.length} context chunks`);

      // Build the prompt with clear grounding instructions
      const prompt = this.buildPrompt(question, contextChunks);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that answers questions based ONLY on the provided context. If the context does not contain sufficient information to answer the question, say so clearly. Do not invent or hallucinate information.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      const answer = data.choices[0]?.message?.content || 'Sorry, I could not generate an answer.';
      
      logger.info(`Generated answer of length ${answer.length}`);

      return {
        answer,
        sources: contextChunks,
        usage: data.usage
      };
    } catch (error) {
      logger.error('Failed to generate answer:', error);
      
      // Return a graceful error response
      return {
        answer: 'I apologize, but I encountered an error while generating the answer. Please try again.',
        sources: contextChunks
      };
    }
  }

  /**
   * Build a prompt with clear context and question separation
   */
  private buildPrompt(question: string, contextChunks: TranscriptChunk[]): string {
    const contextText = contextChunks
      .map((chunk, index) => 
        `[Source ${index + 1}]\n${chunk.text}\n---\nSource: ${chunk.lesson_title} (${chunk.course_name}, ${chunk.module_name})`
      )
      .join('\n\n');

    return `Based on the following context from WANTED Woman transcript lessons, please answer the user's question.

CONTEXT:
${contextText}

QUESTION: ${question}

INSTRUCTIONS:
- Answer based ONLY on the provided context
- If the context doesn't contain sufficient information, say: "I don't have enough information in the provided transcript lessons to answer that question."
- Be conversational and helpful
- Cite sources when possible by referencing the lesson title
- Keep the answer focused and relevant to the question`;
  }
}

// Singleton instance
let instance: OpenRouterAnswerGenerator | null = null;

export function getOpenRouterAnswerGenerator(): OpenRouterAnswerGenerator {
  if (!instance) {
    instance = new OpenRouterAnswerGenerator();
  }
  return instance;
}