# PRD: Coach Cass AI — Growth Reminders (Feature #7)

**Date:** May 3, 2026
**Status:** Draft

## Overview
Periodic check-ins from Suzy based on what the user last discussed: "Hey Sis, it's been 2 weeks since we talked about boundaries around consistent communication. How's that going?"

## Key Features
- After a conversation, Suzy optionally suggests: "Want me to check in on this in a week?"
- User opts in → sets a server-side reminder (cron-based)
- When triggered, Suzy sends a gentle nudge in the chat
- Reminders appear as a new chat message from Suzy
- Opt-out anytime

## New Files
- `lib/reminders/reminder-engine.ts` — Create, list, cancel reminders
- `app/api/suzy/reminders/route.ts` — CRUD for reminders
- `app/api/cron/check-reminders/route.ts` — Cron endpoint to fire due reminders
- `supabase/migrations/..._create_reminders.sql`

## Constraints
- Never spam — max 1 reminder active per user at a time
- Heartbeat links only
