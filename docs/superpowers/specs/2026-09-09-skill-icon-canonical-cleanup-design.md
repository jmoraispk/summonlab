# Skill icon canonical cleanup design

**Approved:** 2026-09-09

## Decision

Replace the accumulated skill-icon production archive with a small, live canonical source set.
Keep one frameless interior for every cataloged skill so frames can be replaced without
regenerating the artwork. Keep the seven approved complete rarity frames, the shared charcoal
backing, geometry authority, generated catalog/specification data, and the bounded WebP runtime
derivatives.

Reversal Cut is an ordinary member of the canonical catalog. Preserve its frameless interior and
generate its runtime icon through the same pipeline as every other skill. Do not retain its
standalone production history and do not use it as an agent-skill example.

## Canonical layout

`assets/wiki/skills/icon-production-v2/` is the sole live source root:

- `catalog.json`, `motif-map.json`, and `visual-specs.json` describe the 457 skills;
- `interiors/<slug>.png` contains exactly one byte-preserved, unframed 1024px RGBA source artwork
  layer per skill;
- `frames/rarity-frame-<rank>.png` contains exactly one reusable final frame for each of
  `F E D C B A S`;
- `backing.png` is the shared charcoal backing;
- `geometry.json` and `geometry-guide.png` define composition geometry;
- `asset-manifest.json` binds every retained raster to its target and SHA-256 hash.

The manifest records `sourcePolicy: 'exact-frameless-source'` and an identity interior transform.
The wiki runtime is derived deterministically as `backing -> interior -> rarity frame`, resized to
512px WebP. Final framed PNG masters are not retained. Replacing a frame therefore never modifies
or regenerates the source artwork.

## Deletion boundary

Delete completed mass-production inputs and outputs, provider sources, reference and contact
sheets, review galleries, cleanup revisions, rejected frame experiments, special Reversal Cut
runs, old domain-art attempts, and their run-specific tools/tests/docs. Family reference sheets are
generated on demand from the live catalog and canonical assets when a future skill needs lineage
review; they are not permanent assets.

Keep the generic manifest-bound producer contracts needed to create future frameless artwork.
After owner approval, the coordinator promotes a new frameless interior into the canonical source
set and regenerates the runtime catalog. The individual image producer never promotes shared
catalog state.

## Expected result

- exactly 457 canonical frameless interiors;
- exactly seven reusable complete rarity frames;
- exactly one shared backing and one geometry authority;
- exactly 457 wiki runtime icons, including Reversal Cut;
- no separate Reversal Cut runtime or example;
- no retained historical review or experiment raster trees.
