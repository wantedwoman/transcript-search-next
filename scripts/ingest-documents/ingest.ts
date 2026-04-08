#!/usr/bin/env node
/**
 * Resumable streaming ingestion.
 * State file tracks progress. Safe to kill and resume.
 * Writes index files incrementally — no memory accumulation.
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Chunk {
  chunk_id: string; source_platform: string; course_name: string;
  module_name: string; lesson_title: string; source_path: string;
  chunk_index: number; text: string;
}

interface IndexManifest {
  created_at: string; total_chunks: number; total_lessons: number;
  sources: string[]; embedding_model: string; chunk_token_size: number; version: string;
}

interface State {
  transcriptIndex: number; totalChunks: number; totalLessons: number;
  sources: string[]; done: boolean; startedAt: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.GOOGLE_EMBEDDINGS_API_KEY;
if (!OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

const TRANSCRIPT_SOURCE = process.env.TRANSCRIPT_SOURCE_PATH || '/Users/coachcass/rln-transcripts/catalog';
const INDEX_PATH = process.env.DATA_INDEX_PATH || '/Users/coachcass/workspace/transcript-search-next/data/index';
const STATE_FILE = join(INDEX_PATH, '.ingest_state.json');
const CHUNK_TOKENS = 512;

async function embedText(text: string): Promise<number[]> {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!r.ok) throw new Error(`Embed ${r.status}: ${await r.text()}`);
  const d = (await r.json()) as { data: { embedding: number[] }[] };
  return d.data[0].embedding;
}

function chunkText(text: string, maxTokens: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = '';
  let tokens = 0;
  for (const word of words) {
    const wt = Math.ceil(word.length / 4);
    if (tokens + wt > maxTokens && current.trim()) {
      chunks.push(current.trim());
      const ov = current.split(/\s+/).slice(-4).join(' ');
      current = ov + ' ' + word; tokens = Math.ceil(current.length / 4);
    } else { current += ' ' + word; tokens += wt; }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function findTranscripts(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const r: string[] = [];
  for (const e of entries) {
    const fp = join(dir, e.name);
    if (e.isDirectory()) r.push(...(await findTranscripts(fp)));
    else if (e.name === 'transcript.txt') r.push(fp);
  }
  return r;
}

async function loadMeta(dir: string): Promise<Record<string, string>> {
  try { return JSON.parse(await readFile(join(dir, 'metadata.json'), 'utf-8')); }
  catch { return {}; }
}

function detectPlatform(p: string): string {
  const l = p.toLowerCase();
  if (l.includes('/youtube/')) return 'youtube';
  if (l.includes('/vimeo/')) return 'vimeo';
  if (l.includes('/heartbeat/')) return 'heartbeat';
  return 'unknown';
}

function deriveStructure(tp: string) {
  const parts = tp.split('/');
  const idx = parts.findIndex(p => p === 'catalog');
  if (idx >= 0 && parts.length > idx + 4)
    return { course_name: parts[idx+2]||'Unknown', module_name: parts[idx+3]||'MODULE_01', lesson_title: parts[idx+4]||'Unknown' };
  return { course_name: dirname(dirname(tp)), module_name: dirname(tp), lesson_title: dirname(tp) };
}

async function main() {
  await mkdir(INDEX_PATH, { recursive: true });
  console.log(`Source: ${TRANSCRIPT_SOURCE}`);
  console.log(`Output: ${INDEX_PATH}\n`);

  // Load or init state
  let state: State;
  try {
    state = JSON.parse(await readFile(STATE_FILE, 'utf-8'));
    console.log(`Resuming from lesson ${state.transcriptIndex + 1}`);
    if (state.done) { console.log('Already complete!'); return; }
  } catch {
    state = { transcriptIndex: -1, totalChunks: 0, totalLessons: 0, sources: [], done: false, startedAt: new Date().toISOString() };
    // Init index files
    createWriteStream(join(INDEX_PATH, 'chunks.json')).write('[\n');
    createWriteStream(join(INDEX_PATH, 'vectors.json')).write('[\n');
  }

  const transcripts = await findTranscripts(TRANSCRIPT_SOURCE);
  console.log(`Total transcripts: ${transcripts.length}\n`);

  const startIdx = state.transcriptIndex + 1;
  let firstEntry = state.transcriptIndex >= 0;
  let chunksOut = createWriteStream(join(INDEX_PATH, 'chunks.json'), { flags: 'a' });
  let vectorsOut = createWriteStream(join(INDEX_PATH, 'vectors.json'), { flags: 'a' });

  for (let i = startIdx; i < transcripts.length; i++) {
    const tp = transcripts[i];
    const { course_name, module_name, lesson_title } = deriveStructure(tp);
    const meta = await loadMeta(dirname(tp));
    const platform = detectPlatform(tp);
    const displayName = lesson_title.slice(0, 55).padEnd(55);

    process.stdout.write(`[${i+1}/${transcripts.length}] ${displayName} `);

    try {
      const text = (await readFile(tp, 'utf-8')).trim();
      if (!text) { console.log('(empty skip)'); continue; }

      const chunks = chunkText(text, CHUNK_TOKENS);
      state.totalLessons++;
      const courseKey = meta.course || course_name;
      if (!state.sources.includes(courseKey)) state.sources.push(courseKey);

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk: Chunk = {
          chunk_id: `${platform}/${course_name}/${lesson_title}/${String(ci).padStart(3,'0')}`,
          source_platform: platform,
          course_name: courseKey,
          module_name: meta.module || module_name,
          lesson_title: meta.title || lesson_title,
          source_path: tp,
          chunk_index: ci,
          text: chunks[ci],
        };
        const vector = await embedText(chunk.text);
        state.totalChunks++;

        if (!firstEntry) firstEntry = true;
        else { chunksOut.write(',\n'); vectorsOut.write(',\n'); }
        chunksOut.write(JSON.stringify(chunk));
        vectorsOut.write(JSON.stringify(vector));
        process.stdout.write('.');
      }
      console.log(` ${chunks.length} chunks`);
    } catch (err) {
      console.log(`ERROR: ${err}`);
    }

    // Save state every 10 lessons
    state.transcriptIndex = i;
    if ((i + 1) % 10 === 0) {
      await writeFile(STATE_FILE, JSON.stringify(state));
      process.stdout.write(`  [State saved @ ${state.totalChunks} chunks]\n`);
    }

    // Brief pause to avoid overwhelming API
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 100));
  }

  state.done = true;
  state.transcriptIndex = transcripts.length - 1;
  await writeFile(STATE_FILE, JSON.stringify(state));

  // Close index arrays
  await new Promise(r => chunksOut.end('\n]', () => r(undefined)));
  await new Promise(r => vectorsOut.end('\n]', () => r(undefined)));

  const manifest: IndexManifest = {
    created_at: new Date().toISOString(),
    total_chunks: state.totalChunks,
    total_lessons: state.totalLessons,
    sources: state.sources.sort(),
    embedding_model: 'text-embedding-3-small',
    chunk_token_size: CHUNK_TOKENS,
    version: '1.0.0',
  };
  await writeFile(join(INDEX_PATH, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n\nDONE: ${state.totalLessons} lessons | ${state.totalChunks} chunks`);
  console.log(`Sources: ${state.sources.sort().join(', ')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
