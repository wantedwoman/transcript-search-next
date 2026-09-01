# TODO — Coach Cass AI V2

> Document 3 — the ordered queue of what to do next, plus the questions waiting on
> a human, with a recommendation attached. Updated as items move. An item is never
> removed before it is BOTH merged (on trunk) AND verified.

## To do next (in order)

| # | Work item | Where it lives | Needed first | State |
|---|---|---|---|---|
| 1 | CC-01 · Apply & consolidate loose schema into live DB | MASTER-SPEC §3, CC-01 | nothing | MERGED (8ed8ecf → trunk b6f0cc4, tag v1.1.0, 2026-08-14; verified at HEAD); live-DB apply still pending Named Stop 6 backup + DB credential |
| 2 | CC-06 · IG carousel images render | MASTER-SPEC §3, CC-06 | nothing | PASSED (verdict 9.3 Gates 1/2/3 PASS, review-tick-5, cycle 2/3); landing queue; 3 non-blocking improvements logged |
| 3 | CC-07 · Date-audit button opens | MASTER-SPEC §3, CC-07 | nothing | PASSED (verdict 8.9 Gates 1/2/3 PASS, review-tick-1); in landing queue; card-surface deviation flagged |
| 4 | CC-08 · Reminders actually fire | MASTER-SPEC §3, CC-08 | nothing | PASSED (verdict 9.25 Gates 1/2/3 PASS, review-tick-7, cycle 2/3); landing queue |
| 5 | CC-09 · Harm alerts + 988 referral | MASTER-SPEC §3, CC-09 | nothing | PASSED (verdict 8.85 Gates 1/2/3 PASS, review-tick-5, cycle 3/3 CAP); landing queue; F-7 hotfix fd3f448 verified |
| 6 | CC-10 · Disclaimer in chat UI | MASTER-SPEC §3, CC-10 | nothing | PASSED (verdict 9.9 Gates 1/2/3 PASS, review-tick-7, cycle 1/3); landing queue |
| 7 | CC-11 · Add to Home Screen guidance | MASTER-SPEC §3, CC-11 | nothing | PASSED (verdict 8.9 Gates 1/2/3 PASS, review-tick-3, cycle 2/3); landing queue |
| 8 | CC-12 · Large-text / readability (mobile) | MASTER-SPEC §3, CC-12 | nothing | BLOCKED-REPEATED-FAIL (Rule 3.22, cycle 3 cap reached; LEDGER verdict 8.7 Gate 3 FAIL with F-2 timestamp glow AA residual unresolved; fixer died twice — swept 06:48Z + declared dead 07:58:50Z; branch fix/cc-12-f2-timestamp-glow-aa never pushed; WIP preserved .worktrees/cc-12-fix-f2; owner/human adjudication owns any next move) |
| 9 | CC-13 · First-24h engagement flow | MASTER-SPEC §3, CC-13 | nothing | BLOCKED (verdict review-tick-8 cycle 2/3 — Gates 1+2 PASS 9.4; Gate 3 BLOCKED by comparative unrunnable; Law 50 — fresh-account capture needs owner session/live-DB seed) |
| 10 | CC-02 · Profile save persists | MASTER-SPEC §3, CC-02 | CC-01 | PASSED (verdict 9.5 Gates 1/2/3 PASS, review-tick-9, cycle 1/3); landing queue |
| 11 | CC-03 · Coaching adapts to profile | MASTER-SPEC §3, CC-03 | CC-01 | PASSED (verdict 9.1 Gates 1/2/3 PASS, review-tick-9, cycle 1/3); landing queue |
| 12 | CC-04 · Affiliate lifecycle | MASTER-SPEC §3, CC-04 | CC-01 | PASSED (verdict 9.1 Gates 1/2/3 PASS, review-tick-10, cycle 2/3); landing queue; 24/24 adversarial probe, 2 mutation proofs |
| 13 | CC-15 · Real-calendar reminders | MASTER-SPEC §3, CC-15 | CC-08 | PASSED (verdict 8.9 Gates 1/2/3 PASS, review-tick-12, cycle 1/3); landing queue |
| 14 | CC-05 · FTC disclosure + hygiene | MASTER-SPEC §3, CC-05 | CC-04 | PASSED (verdict 9.6 Gates 1/2/3 PASS, review-tick-12, cycle 1/3); landing queue |
| 15 | CC-14 · Admin dashboard consolidation | MASTER-SPEC §3, CC-14 | CC-04, CC-06, CC-09 | PASSED (verdict 9.0 Gates 1/2/3 PASS, review-tick-14, cycle 2/3); landing queue; origin/rejudge/cc-14-2@1f2e2da; integration/clean-v1.2.0@70430cb includes CC-14; origin/main still at contaminated 23e974b — owner trunk-merge decision pending |

## Questions waiting on a human (with recommendation)

None open right now — all decisions closed 2026-08-09 (DECISIONS.md D1–D8). If a
question arises during the build that only the owner can answer, it is recorded
here with a recommendation, and the build proceeds around it (Law 46).

## Rules

- Items move to "READY" only when every "Needed first" cell is merged AND verified.
- When an item is being worked by the build loop it is marked IN PROGRESS; when
  its ledger state is `built`, the row's State column reflects the ledger.
- Nothing leaves this list until the ledger shows `landed`/`merged` AND the
  checklist box is flipped on a primary-source fact.






2026-08-17T02:39:02Z | build | tick-stop — STOP CONDITION confirmed: 0 dispatchable unbuilt units; CC-14 in fixing state (review-gate cycle 2/3 @ rejudge/cc-14-2@1f2e2da); CC-12 blocked-repeated-fail (cycle-3 CAP); CC-13 blocked Gate 3 (comparative unrunnable, owner pending). All 15 CC units accounted. Build loop idle until new unbuilt unit enters tracker.
2026-08-17T06:46:11Z | build | 0 | tick-stop — STOP CONDITION confirmed: 0 dispatchable unbuilt units; CC-14 in fixing state (review-gate cycle 2/3 @ rejudge/cc-14-2@1f2e2da on origin); CC-12 blocked-repeated-fail (cycle-3 CAP, f2 branch NOT pushed (ls-remote empty — WIP .worktrees/cc-12-fix-f2 preserved)); CC-13 blocked Gate 3 (comparative unrunnable, owner pending). All 15 CC units accounted. Build loop idle until new unbuilt unit enters tracker.
2026-08-20T06:30Z | merge-train | TRUNK REMEDIATION COMPLETE: Created clean integration branch integration/clean-v1.2.0 from baseline c07b46e (before 10 rogue Telegram/diag commits). Branch pushed to origin. Includes CC-02/03/04/05/06/07/08-fix/09-F7/10/11/14/15. Excludes: rogue commits, CC-13 blocked, CC-08 pre-fix, CC-09 base. tsc EXIT 0, next build EXIT 0. Owner must decide: fast-forward origin/main to f9a44d1 or keep separate.
2026-08-20T06:30Z | build | CC-08 recurrence fix pushed as rejudge/cc-08-recurrence@f14f623
2026-08-20T06:30Z | build | CC-09 F-7 hotfix pushed as rejudge/cc-09-f7@fd3f448
2026-08-20T06:30Z | build | CC-11 desktop fix pushed as rejudge/cc-11-2@eb31655
2026-08-20T06:40Z | build | CC-14 PASS 9.0 Gates 1/2/3 (review-tick-14, cycle 2/3); state: failed→passed
2026-08-20T06:40Z | build | Fix: removed stray script-font changes from carousel-image.ts (not part of any spec unit); tsc EXIT 0, next build EXIT 0; integration/clean-v1.2.0 HEAD=70430cb
2026-08-26T10:55:37Z | build | tick-stop — STOP CONDITION confirmed: 0 dispatchable unbuilt units; all 15 CC units accounted (CC-01 merged, CC-02–11/14/15 passed in landing queue — integration/clean-v1.2.0@70430cb 36 commits ahead of origin/main@23e974b awaiting owner trunk-merge decision; CC-12 blocked-repeated-fail cycle-3 CAP; CC-13 blocked Gate 3 comparative unrunnable). Build loop idle until new unbuilt unit enters tracker.
2026-08-26T12:39:20Z | build | 0 | tick-stop — STOP CONDITION confirmed: 0 dispatchable unbuilt units; all 15 CC units accounted (CC-01 merged, CC-02–11/14/15 passed in landing queue — integration/clean-v1.2.0@70430cb 36 commits ahead of origin/main@23e974b awaiting owner trunk-merge decision; CC-12 blocked-repeated-fail cycle-3 CAP; CC-13 blocked Gate 3 comparative unrunnable). Build loop idle until new unbuilt unit enters tracker.

2026-08-28T05:49:13Z | build | 0 | tick-stop — STOP CONDITION confirmed: 0 dispatchable unbuilt units; all 15 CC units accounted (CC-01 merged, CC-02–11/14/15 passed in landing queue — integration/clean-v1.2.0@70430cb 36 commits ahead of origin/main@23e974b awaiting owner trunk-merge decision; CC-12 blocked-repeated-fail cycle-3 CAP; CC-13 blocked Gate 3 comparative unrunnable). Build loop idle until new unbuilt unit enters tracker.
2026-08-29T15:29:37Z | build | 0 | tick-stop — STOP CONDITION confirmed: 0 dispatchable unbuilt units; all 15 CC units accounted (CC-01 merged, CC-02–11/14/15 passed in landing queue — integration/clean-v1.2.0@70430cb 36 commits ahead of origin/main@23e974b awaiting owner trunk-merge decision; CC-12 blocked-repeated-fail cycle-3 CAP; CC-13 blocked Gate 3 comparative unrunnable). Build loop idle until new unbuilt unit enters tracker.
