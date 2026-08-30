# 0060 — Wiki is the canon and artifact loop

**Status:** Accepted

**Date:** 2026-08-29

## Context

Summonlab's subsystems, creature catalogs, affinities, story, art, implementation, and generated
evidence will be developed by several humans and agents. Ordinary design notes do not give a worker
one stable place to learn the rule, generate an artifact, return it for review, and show whether the
game matches. The owner wants a formal wiki that can act as both session input and output and become
an art book as visual instantiations are produced.

## Decision

- `docs/wiki/` is the joint rulebook, world bible, subsystem index, and visual-art-book entry point.
- Every non-template page has a stable wiki ID and a checked catalog entry.
- Status uses independent design, implementation, visual, and spoiler axes; “done” cannot conceal a
  draft rule, partial code, or candidate image.
- A session consumes a bounded page/dependency packet and returns text, artifact links, provenance,
  implementation/evidence links, questions, and status updates to the wiki.
- Markdown is the normative human specification. Typed contracts/content are the executable
  representation. A page becomes `verified` only when reproducible evidence shows they agree.
- Visual bytes remain in domain asset catalogs. Wiki pages embed them by path and status; generated
  candidates do not become approved/runtime canon without exact-byte provenance and human review.
- One source corpus supports public rules, discoverable compendium entries, and internal spoilers.
  Wiki scope does not grant knowledge inside a run.
- The wiki preserves the complete design inventory. A named release roadmap separately marks
  documented capabilities `on`, `off`, `placeholder`, or `decision`; disabled-for-release content
  remains documented and is not treated as rejected or deleted.
- `pnpm validate:wiki` checks registry uniqueness, status vocabulary, page declarations, local
  links, and registered asset existence and runs in the repository quality gate.

## Consequences

Large creature lists and affinity ideas can enter as seeds, become reviewed mechanical/visual
briefs, drive agent image production, and return as honest candidate galleries before runtime work.
Subsystem agents have a stable handoff surface, while executable content and replay remain necessary
to claim implementation. Wiki maintenance becomes a first-class production activity rather than
documentation deferred until after the game.
