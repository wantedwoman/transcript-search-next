import { NextResponse } from 'next/server';
import { getSimilaritySearch } from '@/lib/search/similarity-search';
import { getOpenRouterAnswerGenerator } from '@/lib/openrouter/answer-generation';
import { logger } from '@/lib/utils/logger';
import { env } from '@/lib/config/env';

export const maxDuration = 30; // 30 seconds timeout

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    logger.info(`Received chat query: "${query.substring(0, 100)}..."`);

    // Initialize services
    const similaritySearch = getSimilaritySearch();
    const answerGenerator = getOpenRouterAnswerGenerator();

    // Search for relevant chunks
    const searchResponse = await similaritySearch.search(query.trim(), 5);
    
    if (searchResponse.results.length === 0) {
      return NextResponse.json({
        answer: "I don't have any relevant information in the transcript lessons to answer that question. Try asking about topics covered in the WANTED Woman lessons, such as dating, relationships, mindset, or confidence building.",
        sources: []
      });
    }

    // Generate answer using OpenRouter with retrieved context
    const chatResponse = await answerGenerator.generateAnswer(
      query.trim(),
      searchResponse.results.map(result => result.chunk)
    );

    logger.info(`Generated answer of length ${chatResponse.answer.length} with ${chatResponse.sources.length} sources`);

    return NextResponse.json({
      answer: chatResponse.answer,
      sources: chatResponse.sources.map(source => ({
        chunk_id: source.chunk_id,
        lesson_title: source.lesson_title,
        course_name: source.course_name,
        module_name: source.module_name,
        source_path: source.source_path,
        chunk_index: source.chunk_index,
        text: source.text.substring(0, 200) + (source.text.length > 200 ? '...' : '') // Preview
      })),
      usage: chatResponse.usage
    });
  } catch (error) {
    logger.error('Chat API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process your question. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle GET requests for health check
export async function GET() {
  try {
    const similaritySearch = getSimilaritySearch();
    await similaritySearch.initialize();
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Transcript Search API is operational',
      stats: {
        totalChunks: similaritySearch.getTotalChunks(),
        totalLessons: similaritySearch.getTotalLessons(),
        indexReady: true
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: 'Failed to initialize search index' },
      { status: 503 }
    );
  }
}