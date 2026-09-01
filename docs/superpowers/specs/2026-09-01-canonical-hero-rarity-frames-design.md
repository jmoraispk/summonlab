# Canonical hero rarity frames design

**Status:** Approved for implementation

**Date:** 2026-09-01

**Owner:** Heroes visual production

## Purpose

Replace the versioned hero rarity-frame packets with one current, stable asset authority containing
six complete progressions:

1. Legacy Neutral, ported from the approved v3 neutral progression;
2. Neutral, the approved gemless progression;
3. Fire;
4. Water;
5. Earth;
6. Wind.

Legacy Neutral is the preferred starting family for the initial product rollout. This is a visual
production preference only; the migration does not bind a runtime default or change an engine
contract, affinity contract, or shared runtime catalog.

## Canonical structure

All current frame assets move under the unversioned root:

```text
assets/heroes/visuals/rarity-frames/
├── README.md
├── manifest.json
├── checksums.sha256
├── families/
│   ├── legacy-neutral/
│   │   ├── sheet.png
│   │   └── frames/rank-1.png … rank-7.png
│   ├── neutral/
│   │   ├── sheet.png
│   │   └── frames/rank-1.png … rank-7.png
│   ├── fire/
│   │   ├── sheet.png
│   │   └── frames/rank-1.png … rank-7.png
│   ├── water/
│   │   ├── sheet.png
│   │   └── frames/rank-1.png … rank-7.png
│   ├── earth/
│   │   ├── sheet.png
│   │   └── frames/rank-1.png … rank-7.png
│   └── wind/
│       ├── sheet.png
│       └── frames/rank-1.png … rank-7.png
├── provenance/
│   ├── source-map.json
│   ├── generation-record.md
│   └── prompts/
└── review/
    └── index.html
```

The canonical filenames contain no packet version suffix. Version history belongs to Git and the
source map, not to the consumer-facing path.

## Retained image authority

The migration retains exactly 48 approved images: six sheets and 42 individual frames. No retained
image is regenerated, recompressed, normalized, or otherwise changed during the move.

| Canonical family | Full-set sheet source | Seven individual-frame source |
| --- | --- | --- |
| `legacy-neutral` | v3 `neutral-progression-v4.png` | v3 high-resolution Neutral ranks 1–7 |
| `neutral` | v4 `gemless-neutral-seven-rank-v1.png` | v4 Neutral ranks 1–7 |
| `fire` | v3 `affinity-fire-v1.png` | v4 Fire ranks 1–7 |
| `water` | v3 `affinity-water-v1.png` | v4 Water ranks 1–7 |
| `earth` | v3 `affinity-earth-v1.png` | v4 Earth ranks 1–7 |
| `wind` | v3 `affinity-wind-v1.png` | v4 Wind ranks 1–6 plus corrected inward-facing rank 7 v2 |

Each affinity therefore retains all seven individual frames, not merely its sheet. Affinity ranks
1–2 remain the approved byte-identical neutral frames; affinity expression begins at rank 3.

## Manifest contract

`manifest.json` is the machine-readable authority and records:

- status `approved-visual-source`;
- runtime status `not-runtime-ready`;
- family order `legacy-neutral`, `neutral`, `fire`, `water`, `earth`, `wind`;
- preferred starting family `legacy-neutral`;
- exactly one sheet and seven ranked frames per family;
- dimensions, color mode, and SHA-256 for every approved image;
- the source path and source packet identity for every canonical image;
- the active inward-facing Wind rank 7 source;
- the rule that approved source paths are immutable until explicitly superseded.

`checksums.sha256` binds only the 48 approved canonical PNGs. Prompt files, review surfaces, and
provenance documents are not approved runtime images and remain outside that checksum boundary.

## Provenance retention

The canonical packet preserves the information needed to audit every retained image:

- exact final prompt text associated with retained generated assets;
- old source path, old SHA-256, new canonical path, and new SHA-256;
- provider/source identifiers already recorded by v3 and v4;
- normalization history for retained v4 frames;
- the Wind rank 7 correction record;
- the distinction between generated sheets and independently generated high-resolution frames.

Intermediate crops, rejected outputs, superseded artwork, provider-normalization working files, and
obsolete scripts leave the current tree. Their recovery path is Git history. The source map retains
their relevant identifiers and hashes when they materially explain an approved image.

## Review surface

The sole current review URL becomes:

`/assets/heroes/visuals/rarity-frames/review/`

The page presents all six complete families in canonical order, with Legacy Neutral first. Every
family shows its full-set sheet and its seven individual frames. The page uses the terms “current”
and “approved visual source”; it contains no v1–v4 navigation or candidate labeling. It continues to
state that runtime export is pending.

## Retirement and deletion

After destination hashes and counts match the source authority, remove these versioned packet roots
from the current tree:

- `assets/heroes/visuals/rarity-frames-v1/`;
- `assets/heroes/visuals/rarity-frames-v2/`;
- `assets/heroes/visuals/rarity-frames-v3/`;
- `assets/heroes/visuals/rarity-frames-v4/`;
- `assets/heroes/visuals/rarity-frames-freeze-v1/`.

The former v4 packet is moved into the canonical authority rather than duplicated. The selected v3
Legacy Neutral individuals and the five retained v3 sheets are likewise moved into their canonical
families before the remainder of v3 is deleted.

Historical specifications and decisions remain in Git as decision history. The existing freeze ADR
is marked superseded by a new collision-safe ADR that establishes the unversioned authority. Active
wiki and review documentation must not refer readers to deleted packet paths.

## Validation

The migration is complete only when all of the following pass:

1. The old freeze verifies 48 source hashes before any deletion.
2. The canonical packet contains exactly six family directories.
3. Every family contains exactly one sheet and ranks 1 through 7 with no gaps or extras.
4. All 42 individual frames are 1024×1536 8-bit RGB PNGs.
5. All six sheets are 2172×724 8-bit RGB PNGs.
6. Every canonical PNG is byte-identical to its approved source.
7. Canonical checksums verify 48 of 48 images.
8. The active Wind rank 7 hash matches the approved inward-facing v2 image.
9. The source map has one unique record for every canonical PNG and no unresolved source.
10. The review page references only existing canonical paths and exposes all six sheets and all 42
    individual frames.
11. Active Heroes wiki and review files contain no references to removed versioned packet paths.
12. The canonical preview responds over `0.0.0.0` and is shared using `10.110.24.218`.
13. No engine contract, affinity contract, or shared runtime catalog changes appear in the diff.

## Delivery batches

Implementation is split into reviewable commits:

1. establish the canonical manifest, provenance, and byte-identical six-family asset tree;
2. replace the review surface and active wiki/decision authority;
3. delete superseded packet roots after all canonical validation passes.

Each batch is validated, committed, and pushed. The final handoff reports the branch, every commit,
the merge or integration request, checksum results, image-shape results, preview URL, and working-tree
state.
