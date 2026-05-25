# PRD: Coach Cass AI — Love Life Dashboard (Feature #4)

**Date:** May 3, 2026
**Status:** Draft

## Overview
A personal dashboard showing each user's most asked topics, emotional tone trends over time, progress indicators, and suggested next steps based on their pattern data.

## Key Features
- Leverages existing `user_insights` + new `user_patterns` data
- Topics breakdown (most discussed, with frequency bars)
- Tone trend line (anxious → empowered over weeks)
- Progress summary: "You're asking more empowered questions than last month"
- Suggested next steps linking to Heartbeat courses
- Accessible from the drawer menu

## New Files
- `components/chat/LoveDashboard.tsx` — Full dashboard page
- `app/api/suzy/dashboard/route.ts` — Aggregated stats for one user
- `lib/dashboard/aggregate-user-stats.ts` — Query pattern + insight data per user

## Constraints
- All video/lesson links go to Heartbeat, not Vimeo
- Data is private per user (RLS enforced)
