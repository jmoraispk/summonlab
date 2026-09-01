# 0066 — Hero rarity frame v3 and v4 sources are frozen

**Status:** Superseded by ADR 0067

**Date:** 2026-09-01

## Context

The owner approved the completed hero rarity-frame direction after reviewing the v3 comparison and
affinity studies, the v4 no-affinity progression, all equal-canvas individual families, and the
corrected inward-facing Wind rank 7 v2. Continuing to describe these files as candidates would make
the approved visual source ambiguous and invite accidental regeneration or drift.

## Decision

- Rarity Frames v3 is the frozen comparison and affinity authority. Its neutral progression, seven
  high-resolution neutral frames, and four affinity sheets are approved visual sources.
- Rarity Frames v4 is the frozen equal-canvas production source set. Its gemless neutral sheet and
  35 active Neutral, Fire, Water, Earth, and Wind individuals are approved visual sources.
- Wind rank 7 v2 is the active frozen Wind apex frame. The outward-facing v1 remains superseded
  provenance and is not an approved source.
- `assets/heroes/visuals/rarity-frames-freeze-v1/checksums.sha256` is the immutable byte-level freeze
  boundary for all 48 approved PNG sources.
- “Approved visual source” does not mean “runtime-ready asset.” These opaque RGB images still need an
  explicit runtime export/integration pass for transparency, cleanup, sizing, and catalog binding.
- No engine contract, affinity contract, or shared runtime catalog changes are authorized by this
  decision.

## Consequences

The historical `candidates/` directory names remain as generation-stage provenance; approval is
carried by this ADR and the checksum-bound freeze manifest. Frozen files must not be regenerated,
normalized, or overwritten in place. Any later visual revision requires a new versioned packet and
an explicit superseding decision. Runtime work must derive from these frozen sources without
silently changing their approved pixels.
