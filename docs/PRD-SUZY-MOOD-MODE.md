# PRD: Suzy AI — Mood-Based Suzy (Feature #8)

**Date:** May 3, 2026
**Status:** Draft

## Overview
Users select a mode for Suzy's delivery: **Hypeme, Soft Place, Real Talk, or Strategy**. Same intelligence, different energy. Adapts the system prompt tone per mode.

## Key Features
- Mode selector in chat header (pill buttons)
- Mode saved to session/localStorage
- Each mode adjusts Suzy's system prompt:
  - **Hypeme**: High energy, affirmations, "You got this"
  - **Soft Place**: Gentle, nurturing, permission to feel
  - **Real Talk**: Direct, no sugar-coating, tough love
  - **Strategy**: Analytical, step-by-step, practical
- Mode indicator on each response (small tag)

## New Files
- `lib/mood/mood-prompts.ts` — System prompt variations per mode
- `components/chat/MoodSelector.tsx` — Pill toggle UI

## Constraints
- Core knowledge base unchanged across modes — only delivery
- Default mode: "Soft Place" for new users
- Mode persists across sessions in profile (V2)
