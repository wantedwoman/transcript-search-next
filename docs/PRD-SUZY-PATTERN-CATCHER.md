# PRD: Suzy AI — Pattern Catcher (Feature #1)

**Date:** May 3, 2026
**Status:** Draft → Approved
**Author:** Rashida

---

## 1. Overview

Suzy currently only responds when asked. The Pattern Catcher makes Suzy **proactive** — after several conversations with a user, she surfaces recurring themes, emotional trends, and growth patterns she's observed.

**Tagline:** *"Hey Sis — I've noticed something."*

---

## 2. Problem Statement

Users have conversations with Suzy but receive no reflection on their patterns over time. Key signals (repeated questions, emotional shifts, recurring topics) are lost because Suzy treats each conversation in isolation. Users miss out on the self-awareness that comes from seeing their own trajectory.

---

## 3. User Stories

### Must Have (MVP)

| ID | Story | Priority |
|----|-------|----------|
| P1 | As a user, after my 3rd conversation with Suzy, I want her to notice recurring topics so I can see what I keep coming back to. | P0 |
| P2 | As a user, I want Suzy to surface this pattern gently as a banner so I can choose to engage or dismiss it. | P0 |
| P3 | As a user, when I tap the pattern, I want to see a simple breakdown of what Suzy noticed (topics, tone trend, repeat questions). | P0 |
| P4 | As a user, I want patterns to update every few conversations, not every single time (no spam). | P1 |
| P5 | As a user, I want the pattern to include a suggested next step — something actionable like a course link in Heartbeat. | P1 |

### Nice to Have (V2)

| ID | Story | Priority |
|----|-------|----------|
| N1 | As a user, I want to see a "Your Patterns" timeline on my profile page. | P2 |
| N2 | As a user, I want to save a pattern insight to my Private Vault for later. | P2 |
| N3 | As a user, I want to be notified (push/SMS) when a new significant pattern is detected. | P3 |

---

## 4. Functional Requirements

### FR1: Pattern Detection Engine

- **Trigger:** After every successful Suzy chat response, fire-and-forget pattern check.
- **Gate:** Only run if user has 3+ completed conversations.
- **Gate:** Only run if last pattern detection was 7+ days ago.
- **Input:** All `user_insights` for this user, ordered by date.
- **Output:** JSON with:
  - `topics_observed: string[]` — Topics appearing 2+ times
  - `tone_trend: string` — e.g. "anxious → empowered"
  - `repeat_questions: string[]` — Similar questions asked multiple times
  - `suggested_focus: string` — Natural language summary (1 sentence)
  - `heartbeat_link: string | null` — Link to related course in Heartbeat if applicable
- **Storage:** Save to `user_patterns` table in Supabase.

### FR2: Storage Schema

**New table: `user_patterns`**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | gen_random_uuid() | PK |
| `user_id` | uuid | — | FK → user_profiles.user_id |
| `generated_at` | timestamptz | now() | When detected |
| `topics_observed` | text[] | — | e.g. ["communication", "boundary setting"] |
| `tone_trend` | text | — | e.g. "anxious → hopeful" |
| `repeat_questions` | text[] | — | e.g. ["Why does he pull away?"] |
| `suggested_focus` | text | — | 1-sentence summary |
| `heartbeat_link` | text | null | Link to related Heartbeat course |
| `is_read` | boolean | false | Has user seen it? |
| `is_dismissed` | boolean | false | User dismissed it? |

### FR3: Surface to User

- **Entry point:** Subtle banner above the chat input in SuzyChatWindow.
  - Text: *"🧠 Pattern Catch: You've been exploring [topic] lately. Want to see your patterns?"*
  - Two buttons: "Show Me" / "Not Now"
- **Pattern Drawer:** A slide-out panel showing:
  - Topics observed (tag-style badges)
  - Tone trend with arrow (e.g., "Anxious → More Confident")
  - Repeat questions (bullet list)
  - Suggested next step (link to Heartbeat course if available, or actionable text)
  - "Dismiss" button
- **Cooldown:** Banner only shows for latest unread pattern. After dismissed or read, waits 7 days before showing new one.

### FR4: API Endpoint

**`GET /api/suzy/patterns`**
- Returns the latest unread pattern for the authenticated user.
- Response: `{ pattern: UserPattern | null }`
- Also lists all historical patterns for the profile page (V2).

**`PATCH /api/suzy/patterns`**
- Body: `{ patternId: string, action: "read" | "dismiss" }`
- Updates `is_read` or `is_dismissed` on the pattern row.

---

## 5. Technical Architecture

### New Files

```
lib/pattern-detection/
├── analyze-patterns.ts    # Core detection engine + trigger logic
├── patterns-llm.ts        # LLM prompt for pattern analysis
└── types.ts               # UserPattern type + related interfaces

components/chat/
├── PatternBanner.tsx       # Subtle banner above chat input
└── PatternDrawer.tsx      # Slide-out panel showing patterns

app/api/suzy/patterns/
└── route.ts               # GET (fetch) + PATCH (read/dismiss)
```

### Modified Files

```
lib/types.ts               # Add UserPattern type
app/api/suzy/chat/route.ts # Add pattern trigger after successful answer
components/chat/SuzyChatWindow.tsx # Add PatternBanner + PatternDrawer
```

### Data Flow

```
User sends message → Suzy responds → Save conversation → Fire pattern check
                                                          ↓
                                              Check: 3+ conversations?
                                              Check: Last pattern > 7 days ago?
                                                          ↓
                                              Fetch user_insights → LLM analysis
                                                          ↓
                                              Save to user_patterns
                                                          ↓
                                              Next chat load → Banner appears
```

---

## 6. LLM Prompt (Pattern Detection)

**System prompt** for the pattern detection LLM call:

```
You are a relationship coaching pattern analyst for WANTED Woman.

Analyze the provided user insights from coaching conversations. The user has been
talking with Suzy, an AI relationship coach, and their insights include topics,
emotional tone, and key questions.

Return JSON with exactly these fields:
- topics_observed: string[] — Topics that appear in 2+ conversations. Max 5. Be specific, not generic.
- tone_trend: string — Describe the emotional journey. Example: "Started anxious, showing shift toward confidence"
- repeat_questions: string[] — Questions the user keeps coming back to. Max 3.
- suggested_focus: string — One sentence suggesting the area that would benefit them most.
- heartbeat_link: string | null — If topics match a known course, suggest a link. Otherwise null.

Return ONLY valid JSON. No markdown. No explanation.
```

---

## 7. Edge Cases & Constraints

| Edge Case | Handling |
|-----------|----------|
| User has < 3 conversations | Skip detection silently |
| Pattern detected but same as last one | Skip — don't save duplicate |
| User dismisses pattern | Set `is_dismissed = true`, don't show again unless new pattern appears |
| Pattern detection LLM fails | Log error, don't block chat response |
| User has no `user_insights` | Detection may be incomplete — still try with raw conversation data |
| Heartbeat link not found | Return `heartbeat_link: null` in pattern |
| Multiple unread patterns exist | Only show the latest one |

---

## 8. Success Metrics

- **Pattern detection rate:** >80% of users with 3+ conversations have at least one pattern
- **Banner engagement rate:** >30% of users shown a banner tap "Show Me"
- **Dismiss rate:** <40% — if too many dismiss, pattern quality needs improvement
- **Return rate:** Users who see patterns return for more chats at higher rate than those who don't

---

## 9. Future Iterations

- **V2:** Full pattern timeline on profile/insights page
- **V2:** Push notification for significant pattern shifts
- **V2:** "Compare yourself" — show how their patterns evolved month over month
- **V2:** Save to Private Vault (Heartbeat link, not Vimeo link — as specified by Coach Cass)

---

## 10. Implementation Order

1. Create `user_patterns` table in Supabase (migration)
2. Build pattern detection engine + LLM prompt
3. Add pattern trigger to chat API
4. Build API endpoints (GET + PATCH)
5. Build PatternBanner + PatternDrawer UI components
6. Integrate into SuzyChatWindow
7. Test end-to-end flow
8. QA pass
