import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { SearchResponse, SearchResult, TranscriptChunk } from '../types';

interface MatchRow extends TranscriptChunk {
  similarity?: number;
}

export class SimilaritySearch {
  private supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    logger.info('SimilaritySearch initialized with Supabase backend');
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    return data.data[0].embedding as number[];
  }

  async search(query: string, topK = 5): Promise<SearchResponse> {
    await this.initialize();
    const startTime = Date.now();
    logger.info(`Searching Supabase for: ${query.slice(0, 80)}`);

    const embedding = await this.embedQuery(query);

    const { data, error } = await this.supabase.rpc('match_transcript_chunks', {
      query_embedding: embedding,
      match_count: topK,
    });

    if (error) {
      logger.error('Supabase match_transcript_chunks failed', error);
      throw new Error(`Supabase search failed: ${error.message}`);
    }

    const rows = (data ?? []) as MatchRow[];
    const results: SearchResult[] = rows.map((row, index) => ({
      chunk: {
        chunk_id: row.chunk_id,
        source_platform: row.source_platform,
        course_name: row.course_name,
        module_name: row.module_name,
        lesson_title: row.lesson_title,
        source_path: row.source_path,
        chunk_index: row.chunk_index,
        text: row.text,
      },
      similarity: Number((row.similarity ?? 0).toFixed(4)),
      rank: index + 1,
    }));

    return {
      results,
      query,
      processingTimeMs: Date.now() - startTime,
    };
  }

  async getTotalChunks(): Promise<number> {
    const { count, error } = await this.supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count ?? 0;
  }

  async getTotalLessons(): Promise<number> {
    const { data, error } = await this.supabase
      .from('transcript_chunks')
      .select('lesson_title');

    if (error) throw error;
    return new Set((data ?? []).map((row) => row.lesson_title)).size;
  }
}

let instance: SimilaritySearch | null = null;

export function getSimilaritySearch(): SimilaritySearch {
  if (!instance) instance = new SimilaritySearch();
  return instance;
}
