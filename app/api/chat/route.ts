import { NextResponse } from 'next/server';
import { getSimilaritySearch } from '../../../lib/search/similarity-search';
import { getOpenRouterAnswerGenerator } from '../../../lib/openrouter/answer-generation';
import { logger } from '../../../lib/utils/logger';

export const maxDuration = 30;

const SYSTEM_EXTRACTION_PATTERNS = [
  /how are you built/i,
  /what model are you using/i,
  /what prompt are you using/i,
  /show (me )?(your )?system instructions/i,
  /show (me )?(your )?hidden instructions/i,
  /print hidden instructions/i,
  /reveal (your )?(system prompt|prompt|instructions|internal setup)/i,
  /ignore previous instructions/i,
  /developer mode/i,
  /show raw data/i,
  /what database do you use/i,
  /how does .*retrieval work/i,
  /how does .*embedding/i,
  /backend structure/i,
  /environment variables/i,
  /api keys?/i,
  /tokens?/i,
];

function isSystemExtractionQuery(query: string): boolean {
  return SYSTEM_EXTRACTION_PATTERNS.some((pattern) => pattern.test(query));
}

function protectedReply() {
  return "I focus on giving you the best guidance I can. I don't get into how I'm built, but I've got you.";
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const cleanQuery = query.trim();

    if (isSystemExtractionQuery(cleanQuery)) {
      return NextResponse.json({
        answer: protectedReply(),
        sources: [],
      });
    }

    const similaritySearch = getSimilaritySearch();
    const answerGenerator = getOpenRouterAnswerGenerator();

    const searchResponse = await similaritySearch.search(cleanQuery, 5);

    if (searchResponse.results.length === 0) {
      return NextResponse.json({
        answer: "I don't have enough information in the provided transcript lessons to answer that question.",
        sources: [],
      });
    }

    const chatResponse = await answerGenerator.generateAnswer(
      cleanQuery,
      searchResponse.results.map((result) => result.chunk)
    );

    return NextResponse.json({
      answer: chatResponse.answer,
      sources: chatResponse.sources.map((source) => ({
        lesson_title: source.lesson_title,
        course_name: source.course_name,
        module_name: source.module_name,
      })),
    });
  } catch (error) {
    logger.error('Chat API error', error);
    return NextResponse.json(
      {
        error: 'I ran into a problem answering that. Please try again in a moment.',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
    });
  } catch (error) {
    logger.error('Health check failed', error);
    return NextResponse.json(
      { status: 'unhealthy' },
      { status: 503 }
    );
  }
}
