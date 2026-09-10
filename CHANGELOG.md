
## [1.2.0] — 2026-08-31

### Merged from integration/clean-v1.2.0 (Batch 3)

- **CC-02** · Profile save persists — surfaces save errors instead of silent no-op (verdict 9.5)
- **CC-03** · Coaching adapts to profile — bounded member-context injected into system prompt (verdict 9.1)
- **CC-04** · Affiliate lifecycle — pending→released→paid with GHL v2 adapter, CRON_SECRET-guarded payout sweep (verdict 9.1)
- **CC-05** · FTC disclosure + referral hygiene — disclosure on share links, self-referral block (verdict 9.6)
- **CC-06** · IG carousel images render — @vercel/og, brand colors, 1080×1080 PNGs (verdict 9.3)
- **CC-07** · Date-audit button opens — trigger + Escape/backdrop close on chat drawer (verdict 8.9)
- **CC-08** · Reminders actually fire — UI trigger + active-gate + daily cron + message style (verdict 9.25)
- **CC-09** · Harm alerts + 988 referral — team email via Resend, 988 in safety reply, harm-first route (verdict 8.85, F-7 hotfix included)
- **CC-10** · Disclaimer in chat UI — persistent banner with coaching-frame + 988 (verdict 9.9)
- **CC-11** · Add to Home Screen guidance — platform-correct steps, dismissible, persists (verdict 8.9)
- **CC-13** · First-24h engagement flow — T0 welcome + T+2–4h nudge + T+24h in-app+email (verdict 9.4, Gate 3 blocked—Law 50)
- **CC-14** · Admin dashboard consolidation — referral activity + harm alerts + carousel views (verdict 9.0)
- **CC-15** · Real-calendar reminders — Google Calendar OAuth (events scope only), OAuth consent + event sync + disconnect (verdict 8.9)

### Blocked (not merged)
- **CC-12** · Large-text/readability — blocked-repeated-fail cycle-3 CAP; AA contrast residual on chat timestamps over glow (verdict 8.7, Gate 3 FAIL)
- **CC-13 Gate 3** · Comparative unrunnable (Law 50) — fresh-account capture needs owner session/live-DB seed; code-level Gates 1+2 PASS 9.4

### Notes
- CC-01 (schema consolidation) was merged in Batch 1 (v1.1.0, 2026-08-14)
- Live-DB migration apply for CC-01 remains pending Named Stop 6 (backup + DDL credential)
- CC-12 and CC-13 Gate 3 require owner/human adjudication to unblock
