# PRD: Coach Cass AI — Date Prep Mode (Feature #3)

**Date:** May 3, 2026
**Status:** Draft

## Overview
Before a date, user inputs details (where, how they feel, what they want to communicate). Suzy gives prep that feels like a friend hyping them up — talking points, energy shift, grounding.

## Key Features
- Guided form: "Where are you going? How are you feeling? What do you want them to know about you?"
- Suzy generates: talking points, energy/grounding affirmation, conversation openers
- Optional: "Send me a reminder in 2 hours" (future — no push infra yet)
- Result is shareable text (copy/paste friendly)
- All Heartbeat video links, never Vimeo

## New Files
- `lib/date-prep/date-prep-engine.ts` — LLM prompt for date preparation
- `app/api/suzy/date-prep/route.ts` — POST to generate prep
- `components/chat/DatePrepModal.tsx` — Modal with form + results

## Constraints
- Output is plain text — no markdown
- Keep it hype + practical, not clinical
- No storage needed — ephemeral per session
