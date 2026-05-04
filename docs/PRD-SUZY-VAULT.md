# PRD: Suzy AI — Private Vault (Feature #10)

**Date:** May 3, 2026
**Status:** Draft

## Overview
Users can save Suzy's most impactful responses to a personal "vault" — a collection of truths they needed to hear that they can return to anytime. Per Coach Cass's specification: ALL vault entries link to Heartbeat lessons, NOT Vimeo videos.

## Key Features
- After any Suzy response, user can tap "Save to Vault"
- Saved entries appear in a dedicated "My Vault" section on the profile page
- Each saved entry includes:
  - Suzy's response text
  - Date saved
  - User's own tag/label (optional)
  - Linked Heartbeat course/lesson (not Vimeo)
- Browse, search, and delete vault entries
- Export vault as text

## New Files
- `lib/vault/vault-engine.ts` — Save, list, delete, search
- `app/api/suzy/vault/route.ts` — CRUD API
- `components/vault/VaultButton.tsx` — Inline save button on chat messages
- `components/vault/VaultPage.tsx` — Full vault browsing page
- `supabase/migrations/..._create_vault_entries.sql`

## Constraints
- ALL links must be to Heartbeat (community.reallovenetwork.com), NOT Vimeo
- RLS: users can only see their own vault entries
- Max 100 entries per user (enforce in API)
