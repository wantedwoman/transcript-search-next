# PRD: Coach Cass AI — Photo Feedback (Feature #9)

**Date:** May 3, 2026
**Status:** Draft

## Overview
Users can upload screenshots of text exchanges, dating app profiles, or photos for Suzy's feedback. Already partially supported via image upload in chat. This feature formalizes it with guided prompts and structured output.

## Key Features
- Guided upload: "Upload a screenshot and tell me what you want feedback on"
- Auto-detection of image type: text exchange vs dating profile vs outfit
- Structured feedback:
  - Text screenshots: "Here's what communicates well / Here's what to reconsider"
  - Dating profiles: "Your vibe, what's working, what to change"
  - Outfit/photo: Energy check — "This look says [X]"
- All feedback is honest but kind
- Uses existing vision model pipeline (already built in chat route)

## New Files
- `components/chat/PhotoFeedbackModal.tsx` — Guided upload + feedback display
- `lib/photo-feedback/feedback-templates.ts` — Prompt templates per image type
- `app/api/suzy/photo-feedback/route.ts` — POST for structured photo analysis

## Constraints
- Don't store images permanently (privacy)
- Never critique appearance — only energy/vibe/communication
- Heartbeat links only for recommendations
