# 0063 — Supplied design Markdown wins earlier feedback

**Status:** Accepted

**Date:** 2026-08-29

## Context

The progression, skill, equipment, and monster-race documents were authored after earlier product
conversation. Their deliberate rules sometimes conflict with older notes that the architecture had
already recorded—for example, the progression document caps `6★` at level 70 and `7★` at level 99,
while earlier conversation proposed caps of 99 and 999.

## Decision

- When one of the four supplied design Markdown files directly conflicts with earlier conversational
  feedback, the supplied file is authoritative.
- Explicitly unfinished, approximate, contradictory, or parked material inside a supplied file
  remains honestly labeled; precedence does not manufacture missing decisions.
- The canonical cap table is `10, 20, 30, 40, 50, 70, 99` for `1★` through `7★`.
- Level 99 remains a late-tower anchor. Floor 100 and postgame growth rely on skills, affinities,
  equipment, party preparation, and other horizontal progression rather than levels above 99.
- The detailed source attribute vocabulary, base/derived affinity structure, summoning bands,
  skill-merging rules, and equipment terms likewise win their earlier conversational alternatives
  wherever the collision is direct.
- Historical executable rulesets and replay streams keep their original versions. New wiki and
  implementation work follows the supplied-source direction behind new content and ruleset versions.

## Supersession

This ADR supersedes ADR 0058's `99/999` cap table and its assumption of levels above 99. ADR 0058's
smooth, non-wall tower-difficulty principle remains accepted. It also supersedes wiki conflict
records that treated supplied values as obsolete merely because earlier conversation differed.

## Consequences

The wiki can present one coherent design rather than asking every worker to arbitrate old chat
against later authored documents. The Living Village still reaches only `1★` levels 1–10, so this
change does not expand its runtime. Progression-v2 must model the authored 70/99 late-rank caps, and
the final tower bands must test system quality instead of assuming an additional 900 levels.
