# Target and assignment schema

Targets and assignments are temporary JSON files beneath `.skill-icon-work/<job-id>/`. They are
review inputs, not repository history.

## Target

Required fields:

- `schemaVersion`: `summonlab-skill-art-target-v1`;
- `jobId`: lowercase hyphenated ID ending in `-v<number>`;
- `targetId`, `name`, and `rarity`: exact values from the unified catalog;
- `exactPrompt`: immutable prompt ending with the literal clause below;
- `references`: ordered path, purpose, and lowercase SHA-256 triples;
- `outputPath`: `.skill-icon-work/<job-id>/candidate.png`.

Required literal prompt clause:

```text
Artwork layer only: transparent background; no rarity frame, rank crest, rank letter, border rails, backing, UI, label, logo, watermark, or text.
```

The prompt describes one dominant concrete subject, at most one supporting cue, the canonical
palette, centered composition, and exclusions. It must not request framing or presentation chrome.

References must include:

1. `assets/wiki/skills/icon-production-v2/geometry-guide.png` with purpose
   `Safe-zone geometry only.`;
2. the temporary on-demand family sheet for motif-lineage context when the target has a non-null
   `motifFamily` with at least one already accepted member; the sheet excludes the target and uses
   `Temporary accepted lineage context only; excludes target; never crop.`;
3. the canonical immediate-parent interior when `primaryVisualParent` is non-null, with purpose
   `Immediate visual parent interior only.`.

Use this exact order, do not duplicate a path, and supply no extra references.

A standalone (`motifFamily: null`) or the first skill in a new motif lineage omits the family sheet.
A complete sheet containing the new candidate can be composed after generation for owner review,
but it cannot become a generation reference.

Do not supply a frame or backing as generation input.

## Assignment

Required fields:

- `schemaVersion`: `summonlab-skill-art-assignment-v1`;
- matching `jobId` and `targetId`;
- exact temporary `targetPath`, `assignmentPath`, `candidatePath`, and `resultPath`;
- `retryCeiling`: `0` or `1`;
- `selfPromotionForbidden`: `true`.

Both candidate and result paths must be absent at preflight. All paths stay inside the matching
temporary job directory.
