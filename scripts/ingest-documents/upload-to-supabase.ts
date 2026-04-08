#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INDEX_PATH = process.env.DATA_INDEX_PATH || '/Users/coachcass/workspace/transcript-search-next/data/index';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const chunks = JSON.parse(await readFile(`${INDEX_PATH}/chunks.json`, 'utf8'));
  const vectors = JSON.parse(await readFile(`${INDEX_PATH}/vectors.json`, 'utf8'));

  if (chunks.length !== vectors.length) {
    throw new Error(`Mismatch: ${chunks.length} chunks vs ${vectors.length} vectors`);
  }

  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((chunk: any, index: number) => ({
      ...chunk,
      embedding: vectors[i + index],
    }));

    const { error } = await supabase.from('transcript_chunks').upsert(batch, { onConflict: 'chunk_id' });
    if (error) throw error;
    console.log(`Uploaded ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
  }

  console.log('Done uploading transcript chunks to Supabase');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
