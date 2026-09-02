# Producer review rubric

Inspect the exact selected raster at full 1024 resolution and as a 96×96 view before persistence.
Record concise `pass`, `concern`, or `fail` findings for both views of every retained image,
including `revise`; `not-applicable` does not satisfy either required view. A candidate explicitly
passes both views and has no concern or failure; unrelated role-inapplicable criteria may remain
`not-applicable`. This is informed producer inspection, not owner acceptance or blind recognition.

## Shared checks

- **Manifest fidelity:** the immutable prompt's subject, cue, palette, composition, and exclusions
  are present without undeclared narrative content.
- **Geometry:** canvas, registration, aperture, subject/effect safe zones, and medallion exclusion
  follow the geometry guide for the role.
- **Alpha:** the output is a real transparent RGBA PNG with no visible pixels outside its allowed
  mask or envelope.
- **Recognition:** at 96 pixels the dominant silhouette and action/material cue remain distinct,
  uncluttered, and different from adjacent family stages.
- **Reference discipline:** each reference influenced only its declared purpose. No calibration
  cell, parent pixels, label, watermark, UI, or reference text was copied.

## Role checks

- `skill-art`: Painted Emblem treatment; one dominant subject and at most one supporting cue; no
  rarity frame, backing, badge, text, or scenery. Preserve calibrated family progression and change
  only what distinguishes the child from an approved parent.
- `rarity-frame`: transparent central aperture, correct six-edge registration, no embedded art or
  backing, and readable rank material at small size.
- `backing`: continuous aperture coverage without frame-like pixels or subject artwork.
- `calibration-plate`: all requested stages at equal scale and clearly useful as reference only;
  never extract a cell as an individual deliverable.

Use the one allowed corrective edit only for a bounded visible defect whose correction can preserve
passing traits. If no correction is authorized or one edit does not resolve it, stop with honest
`revise`/`failed` evidence. A visually attractive image does not override geometry, provenance,
ownership, or recognition failures.
