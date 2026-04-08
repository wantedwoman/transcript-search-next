import { logger } from '../utils/logger';
import { TranscriptChunk, SearchResult, SearchResponse } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class SimilaritySearch {
  private indexPath: string;
  private chunks: TranscriptChunk[] = [];
  private embeddings: number[][] = [];
  private dimension: number = 0;
  private isInitialized: boolean = false;

  constructor(indexPath: string = './data/index') {
    this.indexPath = indexPath;
    logger.info(`SimilaritySearch initialized with index path: ${this.indexPath}`);
  }

  /**
   * Initialize the search index by loading chunks and embeddings
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Loading search index...');
      
      // Load manifest for metadata
      const manifestPath = path.join(this.indexPath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      logger.info(`Loading index: ${manifest.total_chunks} chunks from ${manifest.total_lessons} lessons`);
      
      // Load chunks
      const chunksPath = path.join(this.indexPath, 'chunks.json');
      const chunksContent = await fs.readFile(chunksPath, 'utf-8');
      this.chunks = JSON.parse(chunksContent);
      
      // Load embeddings (as binary data for efficiency)
      const embeddingsPath = path.join(this.indexPath, 'vectors.json');
      const embeddingsContent = await fs.readFile(embeddingsPath, 'utf-8');
      this.embeddings = JSON.parse(embeddingsContent);
      
      // Validate
      if (this.chunks.length !== this.embeddings.length) {
        throw new Error(`Mismatch: ${this.chunks.length} chunks vs ${this.embeddings.length} embeddings`);
      }
      
      this.dimension = this.embeddings[0].length;
      this.isInitialized = true;
      
      logger.info(`Search index initialized: ${this.chunks.length} chunks, ${this.dimension}-dimensional embeddings`);
    } catch (error) {
      logger.error('Failed to initialize search index:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a query text using OpenAI
   */
  async embedQuery(text: string): Promise<number[]> {
    const { OPENAI_API_KEY } = await import('../config/env');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for query embedding');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      logger.error('Failed to embed query:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Search for top-k similar chunks to the query
   */
  async search(query: string, topK: number = 5): Promise<SearchResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      logger.info(`Searching for: "${query.substring(0, 50)}..." (top ${topK})`);
      
      // Embed the query
      const queryEmbedding = await this.embedQuery(query);
      
      // Calculate similarities
      const similarities: { index: number; similarity: number }[] = [];
      
      for (let i = 0; i < this.embeddings.length; i++) {
        const similarity = this.cosineSimilarity(queryEmbedding, this.embeddings[i]);
        similarities.push({ index: i, similarity });
      }
      
      // Sort by similarity (descending) and take top k
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topResults = similarities.slice(0, topK);
      
      // Build results
      const results: SearchResult[] = topResults.map(({ index, similarity }, rank) => ({
        chunk: this.chunks[index],
        similarity: Number(similarity.toFixed(4)),
        rank: rank + 1
      }));
      
      const searchTime = Date.now() - startTime;
      
      logger.info(`Search completed in ${searchTime}ms, found ${results.length} results`);
      
      return {
        results,
        query,
        processingTimeMs: searchTime
      };
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Get chunk by ID (for source verification)
   */
  getChunkById(chunkId: string): TranscriptChunk | undefined {
    return this.chunks.find(chunk => chunk.chunk_id === chunkId);
  }

  /**
   * Get total count of indexed chunks
   */
  getTotalChunks(): number {
    return this.chunks.length;
  }

  /**
   * Get total count of indexed lessons (approximate from unique courses)
   */
  getTotalLessons(): number {
    const uniqueCourses = new Set(this.chunks.map(c => chunk.course_name));
    return uniqueCourses.size;
  }
}

// Singleton instance
let instance: SimilaritySearch | null = null;

export function getSimilaritySearch(): SimilaritySearch {
  if (!instance) {
    instance = new SimilaritySearch();
  }
  return instance;
}