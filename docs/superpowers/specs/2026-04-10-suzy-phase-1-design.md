# Suzy Phase 1 Design

**Date:** 2026-04-10  
**Project:** WANTED Woman AI App  
**AI Name:** Suzy 💜  
**Phase:** Phase 1 Revised

## 1. Objective

Build a premium, beautiful, user-facing app experience around the existing transcript-search intelligence layer.

Phase 1 is not a rebuild of the transcript-search brain. It is a productization layer that wraps the existing retrieval and answer-generation system in a premium coaching experience.

The app should feel like:
- clarity
- guidance
- discernment
- calm private coaching

It should not feel like:
- research
- citations
- transcript search
- document retrieval
- a developer dashboard

## 2. Existing System Assumption

The following already exists in some form and should be audited and reused instead of rebuilt where possible:
- transcript search capability
- transcript retrieval logic
- transcript source data
- AI answer generation logic
- safety and security controls

The first implementation step must be an audit of the existing system to confirm:
1. what transcript-search components already exist
2. what API routes already exist
3. what answer-generation logic already exists
4. what is missing for a polished user-facing app
5. whether the current transcript answer flow can be wrapped rather than rebuilt

## 3. Chosen Approach

**Selected approach:** Option A, evolve the current `transcript-search-next` app into the premium Suzy experience.

### Why this approach was selected
- fastest path to market
- least waste
- preserves what already works
- aligns with the instruction to wrap the existing brain instead of rebuilding it

### Guiding implementation rule
Reuse the brain, control the experience.

## 4. Core Architecture

### 4.1 Existing brain layer
The current transcript-search intelligence layer remains the backend engine.

This layer includes:
- transcript retrieval
- answer generation
- safety and harm-prevention behavior
- protected internal-boundary behavior
- current `/api/chat` behavior if it remains clean enough to wrap

### 4.2 New product layer
A new premium product experience is built around the existing brain.

This product layer includes:
- public landing page for **Meet Suzy 💜**
- magic-link auth
- logged-in member experience
- welcome screen before chat
- user-owned session persistence
- premium answer presentation
- mobile-friendly UI

### 4.3 Phase 1 data layer
Phase 1 stores only lightweight app data.

In scope:
- `auth.users` (Supabase Auth)
- optional `profiles` table only if app-specific user fields are needed
- `chat_sessions`
- `chat_messages`

### 4.4 Experience boundary
Internally, Suzy may rely on transcript-backed retrieval.

Externally, the app must feel like a calm, private coaching conversation.

The user-facing app must:
- never show visible sources
- never reference transcripts, sessions, or source documents directly
- never say “based on transcripts” or similar language
- never feel like a research or retrieval tool

The answer voice should feel like:
- direct coaching
- calm discernment
- lived wisdom energy
- trusted guidance

## 5. User Experience Design

### 5.1 Public landing page
The app begins with a polished public landing page.

Required messaging:
- **Meet Suzy 💜**
- **Your WANTED Woman AI**
- supporting subtext that invites emotionally relevant questions
- primary CTA: **Talk to Suzy**

The page should feel:
- warm
- feminine
- premium
- emotionally intelligent
- spacious and calm

### 5.2 Auth entry
Phase 1 uses **Supabase magic-link auth only**.

Rationale:
- cleanest entry
- simplest maintenance path
- enough for user ownership now
- easy to extend later in Phase 2

### 5.3 Post-login welcome experience
After login, the user should not be dropped directly into a raw chat interface.

Instead, the product should present a light welcome/home screen first.

This screen may include:
- warm greeting
- optional starter prompts
- a clear start-conversation action
- subtle reassurance that conversations are saved privately

### 5.4 Main chat experience
The main chat should be:
- centered
- breathable
- elegant
- easy to read
- mobile responsive
- emotionally safe

Required traits:
- lots of spacing
- elegant typography
- soft brand-aligned colors
- rounded message bubbles
- readable answers
- premium polish

### 5.5 Returning-user experience
Returning users should be able to continue prior conversations.

Conversation history should:
- be persisted per user
- feel subtle and secondary
- not dominate the interface like a dashboard

## 6. Data Model

### 6.1 `auth.users`
Supabase Auth is the primary identity layer.

### 6.2 `profiles` (optional)
Use only if app-specific user fields are required.

Possible fields:
- `id` (same as auth user id)
- `email`
- `created_at`
- `updated_at`

If these fields are unnecessary in Phase 1, this table can be deferred.

### 6.3 `chat_sessions`
Purpose: group conversations into distinct threads.

Likely fields:
- `id`
- `user_id`
- `title` (nullable)
- `created_at`
- `updated_at`
- `metadata` (nullable, optional)

### 6.4 `chat_messages`
Purpose: store the conversation turns.

Likely fields:
- `id`
- `session_id`
- `role` (`user` or `assistant`)
- `content`
- `created_at`

### 6.5 Ownership rules
Each authenticated user can access only:
- their own sessions
- their own messages

## 7. Integration Design

### 7.1 Preferred path
Prefer reusing the existing `/api/chat` route if it is clean enough for the new app flow.

### 7.2 Fallback path
If `/api/chat` is too tightly coupled to the old UI, create a thin product wrapper route that still reuses:
- the existing retrieval logic
- the existing answer-generation logic
- the existing safety and security behavior

### 7.3 Product server flow
The intended flow is:
1. authenticated user opens a chat session
2. user sends a message
3. app stores the user message in `chat_messages`
4. product server route calls the existing brain integration
5. brain returns Suzy’s answer
6. app stores the assistant answer in `chat_messages`
7. UI renders the answer in premium coaching format

### 7.4 Output behavior rules
The product response layer must ensure answers are presented as:
- direct coaching
- calm discernment
- grounded clarity
- polished conversation

The product must never expose:
- transcript summary language
- internal source talk
- retrieval language
- visible source attribution

## 8. Answer Experience Rules

All answers must:
- feel conversational
- use short paragraphs
- include spacing
- use simple structure where helpful
- remain easy to read
- preserve Coach Cass tone and response logic

The answer experience should feel like ChatGPT readability with Coach Cass energy.

The UI must not show:
- robotic phrasing
- transcript narration language
- dense blocks of text
- visible citation mechanics

## 9. Safety and Security

Keep the existing safety and security behavior in place.

Must preserve:
- no harm-planning support
- escalation to licensed mental health support and/or 911 when appropriate
- no disclosure of internal prompts, architecture, APIs, or hidden logic

## 10. Phase 1 Deliverables

Phase 1 delivers:
- public landing page for **Meet Suzy 💜**
- magic-link login
- logged-in member app shell
- welcome screen before chat
- persistent user-owned conversation history
- product server flow that wraps the existing brain
- premium answer rendering
- no visible source display in the user-facing app
- mobile-friendly UI
- updated project docs

## 11. Explicitly Deferred to Phase 2

Do not build yet:
- GHL sync
- revoke-access flow
- payment gating
- subscription enforcement
- GHL webhooks
- admin tooling
- advanced member-state logic

These items must be documented as deferred, not forgotten.

## 12. Required Project Documentation

Maintain and update:
- `PRD.md`
- `changelog.md`
- `handoff.md`
- `checklist.md`
- `to-do.md`
- `architecture.md`
- `qc_report.md`

These documents must clearly track:
- what already existed
- what was reused
- what was wrapped
- what was newly built
- what was deferred

## 13. QC Standard

Phase 1 is only complete if all of the following are true:
1. the existing brain was audited first
2. no unnecessary rebuild happened
3. the landing page feels premium
4. magic-link auth works
5. the user can start and continue chats
6. sessions and messages persist correctly
7. brain answers flow through the new experience correctly
8. answers read cleanly and feel on-brand
9. no visible source presentation appears in the UI
10. mobile experience feels good
11. docs are current

## 14. Done Definition

Phase 1 is complete when Suzy feels like a premium private coaching app built on top of the existing intelligence layer, not a transcript-search tool in better clothes.
