# Producer review rubric

For a normalized `rarity-frame` or `backing` retry, first inspect the provider raster only for
visible fidelity and eligibility: it must be a non-interlaced 8-bit 1254×1254 RGB PNG over an
opaque `#00FF00` matte, never a depicted checkerboard. Profile v1 requires an explicit
perceptual-sRGB declaration. Profiles v2 and v3 instead require exactly one bounded, structurally
valid `caBX` provider container and assign perceptual sRGB after removing it; neither rule relaxes
the matte, role-mask, or forbidden-region gates. Profile v3 uses only its hash-bound geometry-v2
guide for the expanded frame envelope and unchanged backing aperture. Then let the helper normalize
it. V1 `skill-art` and
`calibration-plate` jobs do not use this green-key profile. Inspect the retained canonical raster
at full target resolution and as a 96×96 view. Record concise `pass`, `concern`, or `fail` findings
for both retained-candidate views, including `revise`; `not-applicable` does not satisfy either
required view. A candidate explicitly passes both views and has no concern or failure; unrelated
role-inapplicable criteria may remain `not-applicable`. This is informed producer inspection, not
owner acceptance or blind recognition.

## Shared checks

- **Manifest fidelity:** the immutable prompt's subject, cue, palette, composition, and exclusions
  are present without undeclared narrative content.
- **Geometry:** canvas, registration, aperture, subject/effect safe zones, and medallion exclusion
  follow the geometry guide for the role.
- **Alpha:** standalone `skill-art`, `rarity-frame`, and `backing` outputs are genuine RGBA PNGs
  and satisfy their role-specific transparency or coverage rules. A `calibration-plate` may be RGB
  or RGBA when its declared canvas and the role-aware inspector permit it.
- **Normalization:** v2 frame/backing candidates contain no green matte or fringe, obey the exact
  role mask, and carry source/geometry/output hash evidence. Provider eligibility is not candidate
  acceptance; never repair an ineligible provider source by hand.
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
