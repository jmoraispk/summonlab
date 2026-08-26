# 0052 — Story workshop proposals are development-only

**Status:** Accepted

**Date:** 2026-08-25

## Decision

FIN-009 introduces a versioned development story workshop, not another runtime story authority. A
workshop brief binds one five-floor band to exact world laws, opening facts, unresolved goals,
available/prototype mechanics, enemy duties, objective kinds, production limits, reward ceiling,
forbidden changes, and one target emotional question.

A configured development model may return two or three strict `story-arc-proposal-v1` candidates.
The Responses request is server-only, uses `store: false`, carries a versioned prompt and structured
schema, and records requested/resolved model, response ID, request/output hashes, and token usage.
The checked credential-free fixture is labeled `scripted-fixture` and cannot contain provider
provenance; it must never impersonate a paid model run.

Every candidate is independently checked for brief binding, five-floor range, narrative rhythm,
objective/mechanic/enemy/world-law catalogs, anchor identity, reward bounds, and production bounds.
Passing those checks makes a proposal reviewable, not correct. A developer must review causality,
mechanical fit, emotional arc, character agency, production scope, and envelope compilation.
Only one exact proposal version may be accepted, every criterion must pass, and prototype
dependencies continue to hold compilation.

Acceptance authorizes only a later content compilation change. It does not make prose canonical,
create a mission package, mutate engine state, select a runtime patch, or grant a reward. The later
compiler must produce the existing strict authored envelope and pass its content/replay gates.

## Consequences

- Creative generation can explore alternatives without weakening engine or content authority.
- Prompt, brief, proposal, review, and evidence versions make revisions comparable and auditable.
- Catalog validation catches invented mechanics or duties before subjective review begins.
- Human review remains necessary because schema validity cannot establish emotional value,
  production wisdom, or respect for character agency.
- The repository can validate the workshop without credentials or an unrecorded provider call.
- A useful proposal may remain deliberately unaccepted or production-held without blocking CI.
