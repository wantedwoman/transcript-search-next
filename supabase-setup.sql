create extension if not exists vector;

create table if not exists public.transcript_chunks (
  chunk_id text primary key,
  source_platform text not null,
  course_name text not null,
  module_name text not null,
  lesson_title text not null,
  source_path text not null,
  chunk_index integer not null,
  text text not null,
  embedding vector(1536) not null
);

create index if not exists transcript_chunks_embedding_idx
on public.transcript_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create or replace function public.match_transcript_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  chunk_id text,
  source_platform text,
  course_name text,
  module_name text,
  lesson_title text,
  source_path text,
  chunk_index integer,
  text text,
  similarity float
)
language sql
as $$
  select
    transcript_chunks.chunk_id,
    transcript_chunks.source_platform,
    transcript_chunks.course_name,
    transcript_chunks.module_name,
    transcript_chunks.lesson_title,
    transcript_chunks.source_path,
    transcript_chunks.chunk_index,
    transcript_chunks.text,
    1 - (transcript_chunks.embedding <=> query_embedding) as similarity
  from public.transcript_chunks
  order by transcript_chunks.embedding <=> query_embedding
  limit match_count;
$$;
