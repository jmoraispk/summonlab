# 0067 — Hero rarity frames use one canonical six-family library

**Status:** Accepted

**Date:** 2026-09-01

## Context

ADR 0066 froze the approved v3 and v4 source packets, but versioned generation paths are not a stable
consumer authority. The approved work now forms six complete families: Legacy Neutral, gemless
Neutral, Fire, Water, Earth, and Wind. Each family has one full-set sheet and seven individual
frames, and all 48 retained PNGs can be preserved byte-for-byte under one current root.

## Decision

- `assets/heroes/visuals/rarity-frames/` is the sole current hero rarity-frame visual authority.
- The canonical family order is Legacy Neutral, Neutral, Fire, Water, Earth, and Wind. Legacy
  Neutral is the preferred starting family for initial rollout review.
- Each family owns stable, unversioned filenames: `sheet.png` and `frames/rank-1.png` through
  `frames/rank-7.png`. `manifest.json` and `checksums.sha256` bind the inventory, dimensions, modes,
  and approved bytes.
- The five versioned roots `rarity-frames-v1`, `rarity-frames-v2`, `rarity-frames-v3`,
  `rarity-frames-v4`, and `rarity-frames-freeze-v1` are removed from the current tree after canonical
  validation. Git history remains their recovery path; retained provenance is summarized under the
  canonical root.
- The canonical review page and active wiki use only current, unversioned paths and describe the
  files as approved visual sources rather than candidates.
- Approved visual source does not mean runtime-ready. The canonical PNGs remain opaque RGB source
  artwork pending transparency, cleanup, runtime sizing, and catalog binding.
- This decision does **not** authorize changes to a runtime asset catalog, engine contract,
  affinity contract, runtime default, or integration behavior.

## Consequences

Current visual production and review have one stable source of truth, with Legacy Neutral first and
all six seven-rank progressions visible together. New visual work must explicitly supersede this ADR
and produce a new checksum-bound authority rather than overwrite canonical pixels in place.

Historical generation packets no longer remain in the active tree after retirement, but their full
contents remain recoverable from Git. Runtime integration stays a separate, explicit handoff so a
visual-source approval cannot silently change product behavior.
