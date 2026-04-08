import { logger } from '../utils/logger';

/**
 * Legacy compatibility wrapper.
 * Query embeddings are now generated inside the Supabase-backed search service.
 */
export class EmbeddingService {
  private model = 'text-embedding-3-small';

  constructor() {
    logger.info(`EmbeddingService compatibility wrapper initialized for ${this.model}`);
  }

  async embedText(): Promise<number[]> {
    throw new Error('Use lib/search/similarity-search.ts for live query embeddings.');
  }
}

export default EmbeddingService;
