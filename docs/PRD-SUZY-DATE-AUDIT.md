# PRD: Coach Cass AI — Date Audit / Post-Date Reflection Tool (Feature #6)

**Date:** May 3, 2026
**Status:** Draft

## Overview
User pastes a text exchange or describes how the date went. Suzy helps them separate facts from feelings, identify green vs red flags, and decide next steps.

## Key Features
- User pastes text exchange or describes date
- Suzy analyzes: "Here's what's fact, here's what's feeling"
- Green flag / red flag breakdown
- Decision clarity: "Based on this, here's what I'd look for next"
- Save audit to profile (optional, V2)

## New Files
- `lib/date-audit/date-audit-engine.ts` — LLM prompt for date reflection
- `app/api/suzy/date-audit/route.ts` — POST to audit
- `components/chat/DateAuditModal.tsx` — Modal for input + results

## Constraints
- Never be harsh or dismissive of user's feelings
- Balance emotional validation with objective read
- Heartbeat links only for recommendations
