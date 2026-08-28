# 0054 — Owner playtesting is one conversational loop

**Status:** Accepted

**Date:** 2026-08-27

## Context

The original FIN-007 plan required five moderated participants, assigned device tracks, a separate
facilitator script, and manual structured evidence entry. The project is currently tested by its one
owner. Requiring a research cohort now made playing feel like paperwork and prevented useful product
feedback without improving the truth of the current decision.

FIN-006 already collects minimal journey statistics automatically after explicit consent. The owner
wants to play a normal build and send ordinary comments; Codex can maintain the internal evidence.

## Decision

- Replace the five-person cohort with one real `OWNER-01` playthrough on the owner's chosen device.
- Ask the owner to play one coherent player-facing route from title and summoning through Hearth,
  the prototype Floor 01 return, First Ember choice, and pause menu, stopping early if blocked.
- Require no moderator script, task spreadsheet, screenshots, file copying, JSON editing, or manual
  statistics from the owner. The owner sends conversational comments to Codex.
- Do not ask the owner to report device, timestamps, or duration; those are either unnecessary or
  belong to the consented aggregate-statistics boundary.
- Let Codex paraphrase those comments, record the eight journey outcomes, triage P0–P3 findings,
  regenerate checked evidence, and verify fixes.
- Keep background analytics optional and consent-based. Once enabled, the existing FIN-006 client
  records allowlisted statistics automatically; declining never invalidates the owner playtest.
- Keep the release fail-closed: automation cannot create the owner session, and unverified P0/P1
  findings still block packaging.
- Treat feedback from friends as a later optional expansion round, not a prerequisite for the first
  private package.
- Keep development-only mission routes out of the owner protocol until the campaign links to them;
  automated coverage of those routes does not imply that a player can reach them naturally.

This decision supersedes ADR 0051 as the current FIN-007 gate and amends ADR 0053's human-evidence
cardinality. It does not weaken ADR 0050's analytics consent and deletion boundary.

## Consequences

- The next feedback request is one playable journey and a normal conversation.
- The checked owner report remains `ready`, 0/1, until real feedback is received and reviewed.
- Automated browser tests still provide responsive and regression coverage but never claim human
  feedback.
- A broader cohort can be designed after the owner loop exposes which questions are worth asking.
