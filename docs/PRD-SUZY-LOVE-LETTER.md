# PRD: Coach Cass AI — Love Letter / Text Drafting Engine (Feature #2)

**Date:** May 3, 2026
**Status:** Draft

## Overview
Users type what they want to say to their partner; Suzy helps them communicate it better without changing their voice. Adjustable tone modes. Saves drafts to their profile.

## Key Features
- User pastes raw feelings/message → Suzy reframes it
- Tone selector: Soft, Direct, Playful, Vulnerable, Neutral
- Shows "before vs after" so user sees what changed
- Save drafts to profile (new DB table: `drafted_messages`)
- Share as text or screenshot

## New Files
- `lib/message-drafting/draft-engine.ts` — Core LLM prompt + tone parsing
- `app/api/suzy/draft/route.ts` — POST to draft, GET to list saved drafts
- `components/chat/DraftComposer.tsx` — UI for drafting
- `supabase/migrations/..._create_drafted_messages.sql`

## Constraints
- NEVER change the user's voice — only clarity and delivery
- No markdown in output. Plain text only.
- Heartbeat links for any video recommendations, not Vimeo
