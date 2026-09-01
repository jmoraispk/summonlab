# Hero rarity frame production packet v4

Status: **approved visual source — frozen by ADR 0066; runtime export pending**.

This packet adds a gemless no-affinity authority and a complete individual-frame matrix for Neutral,
Fire, Water, Earth, and Wind. It preserves the accepted v3 authority and affinity sheets unchanged.
The active PNGs are checksum-frozen approved visual sources. They are not bound to runtime.

## Locked production rules

- Every approved individual source is exactly 1024×1536, 8-bit RGB.
- The bottom tray and its stars are one generated frame object; stars are never overlaid separately.
- Each family uses the same warm-gold star style and contains the exact rank count.
- Ranks 1–2 are byte-identical neutral pixels across all five sets.
- Affinity material begins at rank 3 and strengthens through rank 7.
- Neutral dragons are gemless tempered steel and dark iron, with no blue or affinity emission.
- Dragon mouths stay closed through rank 6. Rank 7 alone opens both mouths.
- Within each seven-rank family, widest measured central hero opening divided by narrowest is no more
  than 1.20. Current measured variation is 13.84%–18.60%.

## Contents

- `candidates/sheets/gemless-neutral-seven-rank-v1.png`: no-affinity comparison authority;
- `candidates/individuals/{neutral,fire,water,earth,wind}/`: 35 equal-canvas high-resolution
  approved visual sources;
- `references/crops/`: sheet-derived references used only to guide generation;
- `references/geometry-raw/`: untouched provider renders for candidates receiving bounded
  whole-frame normalization;
- `references/superseded/`: prior candidate versions retained after targeted visual correction;
- `prompts/`: exact sheet prompts and rank-specific individual production prompts;
- `scripts/prepare_individuals.py`: deterministic crop and prompt preparation;
- `scripts/normalize_geometry.py`: geometry audit and complete-frame-only normalization;
- `geometry-report.json`: per-rank measurements and normalization provenance;
- `provider-source-map.json`: full retained provider filenames and prompt bindings;
- `generation-record.md`: provider-source and correction record;
- `review-evidence.md`: bounded visual and dimensional review;
- `review/index.html`: local comparison surface.

The approved paths and hashes are bound by `../rarity-frames-freeze-v1/checksums.sha256`. The packet
does not change engine contracts, shared affinity definitions, or runtime catalogs.
