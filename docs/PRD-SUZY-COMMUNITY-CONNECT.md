# PRD: Suzy AI — Sis, You're Not Alone / Community Connection (Feature #5)

**Date:** May 3, 2026
**Status:** Draft

## Overview
When Suzy detects a common struggle, she suggests relevant Heartbeat course content: "Several women have asked that same question. There's a Masterclass on this exact topic — want me to link you?" This drives course engagement directly from chat.

## Key Features
- On chat response, LLM optionally appends a course suggestion
- Matches user's topic to known Heartbeat courses (mapped in code)
- Renders as a subtle card below Suzy's answer: "📚 Related: [Course Name]"
- Never pushes more than 1 suggestion per response

## New Files
- `lib/course-mapper/course-map.ts` — Static map of topic → Heartbeat course URL
- `lib/course-mapper/match-course.ts` — Given a query, find best matching course
- `components/chat/CourseSuggestion.tsx` — Inline course suggestion card

## Constraints
- Only Heartbeat course links. No Vimeo.
- One suggestion max per response
- Don't force it — only suggest when match confidence is high
