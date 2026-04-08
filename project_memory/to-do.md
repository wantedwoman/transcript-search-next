# To-Do — Transcript Search App Build

## IMMEDIATE NEXT ACTIONS (Priority Order)

1. **VERCEL TOKEN SETUP** 
   - Check if VERCEL_TOKEN exists in any secrets location
   - If missing, create Vercel token via https://vercel.com/account/tokens
   - Add to ~/clawd/secrets/.env or ~/.openclaw/workspace/secrets.env
   - Required for Vercel deployment

2. **GITHUB REPO CREATION & PUSH**
   - Create new repo: transcript-search-next
   - Push local code to GitHub main branch
   - Set as private initially (can make public later)

3. **VERCEL DEPLOYMENT**
   - Import GitHub repo to Vercel
   - Configure environment variables:
     - OPENROUTER_API_KEY (from OpenClaw system)
     - OPENAI_API_KEY (from clawd/secrets/.env)
     - GITHUB_TOKEN (already have)
   - Deploy preview build
   - Test production deployment

4. **SMOKE TEST & VALIDATION**
   - Test chat interface with sample questions
   - Verify search returns relevant transcript chunks
   - Confirm OpenRouter generates grounded answers
   - Check source attribution display

5. **DOCUMENTATION FINALIZATION**
   - Update all project_memory files with final status
   - Ensure no secrets leaked in docs or code
   - Prepare handoff for future maintenance

## CURRENT BLOCKERS
- VERCEL_TOKEN confirmation needed

## COMPLETED TASKS
- Project initialization and memory bootstrap
- Environment audit (API keys confirmed)
- Product definition and architecture lock
- Repository scaffold and app structure
- Document ingestion and indexing pipeline (10,210 chunks from 266 lessons)
- Semantic search layer implementation
- OpenRouter answer generation layer
- Chat UI and user experience

## NEXT CHECKPOINT
After Vercel token is confirmed: push to GitHub → deploy to Vercel → smoke test → mark phase 9 complete