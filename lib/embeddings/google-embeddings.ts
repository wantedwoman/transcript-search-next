import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Embedding service using OpenAI text-embedding-3-small
 * (Switched from Google due to endpoint compatibility issues with text-embedding-005)
 */
export class EmbeddingService {
  private apiKey: string;
  private model: string = 'text-embedding-3-small';
  private baseUrl: string = 'https://api.openai.com/v1/embeddings';

  constructor() {
    // In a real implementation, we'd get this from env
    // For now, we'll rely on the ingestion process having already created the index
    logger.info('EmbeddingService initialized (using pre-computed index for search)');
  }

  /**
   * Generate embedding for text
   * Note: In production, this would call the OpenAI API
   * For the MVP, we rely on pre-computed embeddings from the ingestion process
   */
  async embedText(text: string): Promise<number[]> {
    throw new Error('Direct embedding generation not implemented in MVP. Use pre-computed index.');
  }

  /**
   * Load pre-computed embeddings from disk
   * This mirrors what the similarity search does
   */
  async loadEmbeddings(indexPath: string = './data/index'): Promise<{ chunks: any[]; embeddings: number[][] }> {
    try {
      const chunksPath = path.join(indexPath, 'chunks.json');
      const embeddingsPath = path.join(indexPath, 'vectors.json');
      
      const [chunksContent, embeddingsContent] = await Promise.all([
        fs.readFile(chunksPath, 'utf-8'),
        fs.readFile(embeddingsPath, 'utf-8')
      ]);
      
      return {
        chunks: JSON.parse(chunksContent),
        embeddings: JSON.parse(embeddingsContent)
      };
    } catch (error) {
      logger.error('Failed to load embeddings:', error);
      throw error;
    }
  }
}

// For compatibility with existing code
export default EmbeddingService;