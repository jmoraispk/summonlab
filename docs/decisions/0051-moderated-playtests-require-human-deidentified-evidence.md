# 0051 — Moderated playtests require human, de-identified evidence

**Status:** Accepted

**Date:** 2026-08-25

## Decision

FIN-007 uses five actual adult participants. Automated browsers, scripted personas, language models,
and developer walkthroughs may preflight the protocol but never count toward the five-session gate.
The cohort uses anonymous codes `P01`–`P05`, two phone sessions, three desktop sessions, and five
bounded tracks that together cover the vertical-slice definition of done.

Qualitative note consent is disclosed separately from FIN-006 analytics consent. The moderator does
not retain participant identity, contact details, direct quotations, audio, video, seeds, run IDs,
questions, replies, or analytics capabilities. Raw notes stay outside the repository. Only
paraphrased redacted findings and bounded task outcomes enter the checked cohort source. A
participant may withdraw those notes; removal regenerates the aggregate report and evidence hash.

Every assigned task records whether it was completed unassisted, completed after a moderator prompt,
not completed, or not attempted. Prompted and failed tasks require a linked finding. Findings are
triaged P0–P3; unresolved P0 and P1 findings hold the release. FIN-007 completes only after five
sessions and full assigned coverage. FIN-008 completes only after every P0/P1 finding is fixed and
verified.

## Consequences

- A green automated suite cannot silently satisfy the human quality gate.
- The checked readiness report may remain `ready` or `in-progress` without failing CI; it must not
  claim `complete` until all human evidence is present and internally consistent.
- Moderator prompts become measurable evidence rather than disappearing from a success claim.
- Participant privacy is stronger than longitudinal research convenience: withdrawal deletes the
  retained session evidence instead of preserving an administrative copy.
- Deep tracks may begin from prepared state, but participants interact only through player-facing
  routes during measured tasks.
