# 0065 — Premium art is the only hero renderer

**Status:** Accepted
**Date:** 2026-08-31

## Decision

Player-facing heroes are represented only by approved, catalog-bound authored artwork. A generated
manifest may exist before matching artwork does, but it must not be converted into a procedural
person, silhouette, stick figure, or other synthetic stand-in.

When approved art is unavailable, portrait surfaces show a clearly labeled, non-character
`Portrait pending` state. Settlement views may show a location and activity marker because that
marker represents world state, not the hero's appearance. Developer surfaces may inspect manifest
facts as text, measures, and color or rarity metadata, but may not render those facts as a person.

The former procedural hero component and the two development routes whose product was that renderer
are removed. The premium catalog, runtime export pipeline, identity profiles, and historical audit
records remain. This is a presentation-boundary change only: engine state, database schemas, event
replays, and character manifests require no migration.

This decision supersedes the hero-fallback clause in ADR 0049 and active guidance that recommends
compact or modular character rigs. Earlier plans and evidence remain historical records.

## Consequences

- New heroes can enter deterministic data flows before their art is ready without implying that
  placeholder graphics are accepted character designs.
- Hero, skill, and enemy art agents can own catalog-bound assets independently of engine work.
- Runtime consumers must resolve approved delivery assets by manifest hash or art key.
- Missing-art behavior is intentionally visible and test-covered.
- The v1 build-budget schema retains its historical `recognitionAudit` field name as a compatibility
  alias, but that field measures the canonical authored-art visual lab after this change.
