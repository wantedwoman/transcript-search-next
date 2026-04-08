export interface TranscriptChunk {
  chunk_id: string;
  source_platform: string;
  course_name: string;
  module_name: string;
  lesson_title: string;
  source_path: string;
  chunk_index: number;
  text: string;
}

export interface SearchResult {
  chunk: TranscriptChunk;
  similarity: number;
  rank: number;
}

export interface ChatResponse {
  answer: string;
  sources: TranscriptChunk[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface SearchRequest {
  query: string;
  topK?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  processingTimeMs: number;
}
