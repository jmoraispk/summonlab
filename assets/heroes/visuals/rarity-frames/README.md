# Canonical hero rarity-frame library

Status: **approved visual source; not runtime-ready**.

This is the stable, six-family library for owner-approved hero rarity-frame artwork. It preserves
approved production pixels under durable, versionless canonical paths; it does not make the assets
runtime exports or register them in a runtime catalog. `legacy-neutral` is the preferred starting
family for rollout because it retains the approved v3 neutral comparison authority and its seven
high-resolution neutral frames.

## Inventory

The library contains 48 immutable PNG assets: one 2172×724 RGB sheet and seven 1024×1536 RGB
frames for each family, in this order:

1. Legacy Neutral
2. Neutral
3. Fire
4. Water
5. Earth
6. Wind

`manifest.json`, `checksums.sha256`, and `provenance/source-map.json` bind every canonical asset to
exactly one frozen v3 or v4 source byte stream. The source packets remain the historical production
record: v3 supplies Legacy Neutral and the four affinity sheets; v4 supplies gemless Neutral and
the individual Neutral, Fire, Water, Earth, and Wind frame matrix.

## Visual production rules

- The illustrated tray and warm-gold stars are integral to each frame; no stars are assembled as
  separate assets.
- Every frame contains exactly its rank count of stars.
- Affinity ranks 1–2 are neutral byte-identical copies; affinity expression starts at rank 3.
- Dragon mouths remain closed through rank 6; both mouths open only at rank 7.
- Wind rank 7 uses the active inward-facing-heads v2 correction. The earlier outward-facing apex is
  superseded provenance and is not part of this library.
- Sheets are retained production comparison authorities. Canonical paths are not transparent
  runtime exports.

The final submitted prompt text is copied under `provenance/prompts/`; source-map records for
inherited affinity ranks 1–2 intentionally use `inheritedFrom: neutral` instead of inventing a
family-specific prompt.
