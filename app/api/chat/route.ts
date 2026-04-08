import { NextResponse } from 'next/server';
import { getSimilaritySearch } from '../../../lib/search/similarity-search';
import { getOpenRouterAnswerGenerator } from '../../../lib/openrouter/answer-generation';
import { logger } from '../../../lib/utils/logger';

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const similaritySearch = getSimilaritySearch();
    const answerGenerator = getOpenRouterAnswerGenerator();

    const searchResponse = await similaritySearch.search(query.trim(), 5);

    if (searchResponse.results.length === 0) {
      return NextResponse.json({
        answer: "I don't have enough information in the provided transcript lessons to answer that question.",
        sources: [],
      });
    }

    const chatResponse = await answerGenerator.generateAnswer(
      query.trim(),
      searchResponse.results.map((result) => result.chunk)
    );

    return NextResponse.json({
      answer: chatResponse.answer,
      sources: chatResponse.sources.map((source) => ({
        chunk_id: source.chunk_id,
        lesson_title: source.lesson_title,
        course_name: source.course_name,
        module_name: source.module_name,
        source_path: source.source_path,
        chunk_index: source.chunk_index,
        text: source.text,
      })),
      usage: chatResponse.usage,
    });
  } catch (error) {
    logger.error('Chat API error', error);
    return NextResponse.json(
      {
        error: 'Failed to process your question.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const similaritySearch = getSimilaritySearch();
    const [totalChunks, totalLessons] = await Promise.all([
      similaritySearch.getTotalChunks(),
      similaritySearch.getTotalLessons(),
    ]);

    return NextResponse.json({
      status: 'healthy',
      stats: { totalChunks, totalLessons, backend: 'supabase' },
    });
  } catch (error) {
    logger.error('Health check failed', error);
    return NextResponse.json(
      { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 503 }
    );
  }
}
