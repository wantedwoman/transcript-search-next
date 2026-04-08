# Checklist — Transcript Search App Build

## PHASE 1: Project Initialization and Memory Bootstrap
- [x] Create project_memory folder
- [x] Initialize session_state.json
- [x] Create PRD.md
- [x] Create changelog.md (append after each phase)
- [x] Create handoff.md
- [x] Create to-do.md
- [x] Create decisions.md
- [x] Create risks.md
- [x] Create environment.md
- [x] Create architecture.md
- [x] Create qc_report.md
- [x] Update session_state.json with phase status

## PHASE 2: Credential and Environment Audit
- [x] OpenRouter API key — FOUND (in OpenClaw config)
- [x] Google Embedding API key — NOT FOUND (switched to OpenAI embeddings)
- [x] OpenAI API key — FOUND (in clawd/secrets/.env)
- [ ] Vercel token — NEED TO CONFIRM/SETUP
- [x] GitHub token — FOUND (provided by user)
- [x] Document env status in environment.md

## PHASE 3: Product Definition and Architecture Lock
- [x] Lock PRD.md
- [x] Finalize architecture.md (frontend/backend/embeddings/search/deployment)
- [x] Decide chunk size strategy (150 tokens)
- [x] Decide K (top chunks per query) = 5
- [x] Record decisions in decisions.md

## PHASE 4: Repository Scaffold
- [x] Initialize Next.js project
- [x] Set up folder structure (app/, api/, lib/, components/, scripts/, data/, project_memory/)
- [x] Add config loader utilities
- [x] Add env validation logic
- [x] Add structured logging helpers
- [x] Add placeholder API routes
- [x] Add placeholder UI components
- [x] Add scripts folder for ingestion/indexing
- [x] Add README.md with setup steps

## PHASE 5: Document Ingestion and Indexing Pipeline
- [x] Build document loader (recursive scan of transcript folders)
- [x] Build chunker (150-token chunks with 25-token overlap)
- [x] Build embedding generator using OpenAI text-embedding-3-small
- [x] Build index writer (chunks.json, vectors.json, manifest.json)
- [x] Support incremental indexing (state saved every 10 lessons)
- [x] Store index artifacts in data/index/
- [x] Ingest completed: 266 lessons → 10,210 chunks

## PHASE 6: Semantic Search Layer
- [x] Build query embedding path using OpenAI text-embedding-3-small
- [x] Build cosine similarity search over indexed chunks
- [x] Return top 5 relevant chunks with metadata
- [x] Expose server-side search function via API route

## PHASE 7: OpenRouter Answer Generation Layer
- [x] Build prompt builder with system instruction, persona placeholder, grounding rule
- [x] Use OpenRouter API with configured free model
- [x] Add answer constraints: use retrieved context first, say if insufficient context
- [x] Keep persona isolated for future replacement
- [x] Return answer plus optional sources

## PHASE 8: Chat UI and User Experience
- [x] Build chat container with message history
- [x] Build input box and submission flow
- [x] Build message bubbles for user and assistant
- [x] Connect frontend to backend chat route
- [x] Display grounded response with sources
- [x] Add loading and error states

## PHASE 9: Deployment to Vercel
- [ ] Connect repo to Vercel (needs VERCEL_TOKEN)
- [ ] Ensure required env vars exist in Vercel project settings
- [ ] Deploy preview
- [ ] Run smoke test in deployed environment
- [ ] Promote/finalize production deployment if preview works
- [ ] Document deployment URLs and notes in handoff.md

## PHASE 10: Final QC, Handoff, and Stabilization
- [ ] Run full phase-by-phase review
- [ ] Update qc_report.md with what passed/failed/remains
- [ ] Update handoff.md with current state, working features, blocked items, next actions
- [ ] Update changelog.md
- [ ] Update checklist.md and to-do.md
- [ ] Update session_state.json to final current state