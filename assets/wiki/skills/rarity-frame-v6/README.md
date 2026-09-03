# Tight staggered rarity-frame calibration sheets

Status: **Variant 2 selected as the canonical crop source**. Variant 1 remains noncanonical review
history.

## Variant 1 — maximum fill

![Seven maximum-fill rarity frames](calibration/seven-rarity-frames-4x3-tight-v1.png)

- File: `calibration/seven-rarity-frames-4x3-tight-v1.png`
- Provider canvas: 1514×1039 RGB
- SHA-256: `ec7d617b86a7cfdcaa7b8d4ca9df5ebd6cb654a44dd73f4e8d16fccfef409057`
- Intent: maximize frame pixels and minimize unused canvas while retaining a narrow safety margin.

## Variant 2 — uniform crop cells

![Seven uniformly spaced rarity frames](calibration/seven-rarity-frames-4x3-tight-v2.png)

- File: `calibration/seven-rarity-frames-4x3-tight-v2.png`
- Provider canvas: 1536×1024 RGB
- SHA-256: `837d89a2a8f45fe7144af85e36030ed4f0833a266c39638cc192365ec87bffce`
- Intent: retain large frames while favoring consistent crop gutters and shared baselines.
- Owner decision: accepted on 2026-09-03.

Both sheets were prompted with the same staggered center rule:

- top row F, E, D, C at x = 12.5%, 37.5%, 62.5%, and 87.5%;
- bottom row B, A, S at x = 25%, 50%, and 75%;
- B is centered between F/E, A between E/D, and S between D/C;
- every frame has the same intended scale, with no row overlap.

The generated layouts visually follow that stagger, but the image provider does not guarantee
pixel-exact coordinates. Treat these as visual sources rather than layout metadata. After owner
selection, deterministic crop normalization must measure each frame and place it on the exact
shared center; it must not assume the provider honored the percentages numerically.

The provider again painted a checkerboard and returned RGB rather than genuine RGBA transparency.
The checkerboard is a removable matte, not part of the design. A tightly scoped built-in
background-extraction edit was attempted after selection, but it redrew the frames and returned
another RGB checkerboard. That attempt was rejected and is not retained as an asset. Deterministic
connected-background removal is therefore the accepted extraction route because it preserves the
selected source pixels.

## Superseded filled-frame extraction pilot

![Seven extracted rarity frames](review/individual-frames.png)

The first deterministic extractor created seven genuine 1024×1024 RGBA candidates under
`candidates/individuals/`. They preserve Variant 2's relative visual scale, share one normalization
factor and canvas center, keep their dark interiors opaque, and have transparent exteriors.

![Measured Cut in every rarity frame](review/measured-cut-all-rarities.png)

The same standalone Measured Cut emblem is layered into all seven crops under
`candidates/measured-cut/`. This contact sheet is the first composition pilot: it tests frame
extraction, shared icon placement, and rarity-only visual variation. The individual frames and
composites are review candidates, not promoted runtime masters. The companion
`review/measured-cut-recognition-96.png` verifies the same seven composites at their 96-pixel
recognition size.

This pilot proved the crop, but its opaque interiors coupled the frame and backing together. It is
retained as review history and is not the production layering model.

## Empty-frame layer architecture

The production model is now **backing → skill art → empty rarity frame**. Every layer is a genuine
1024×1024 RGBA PNG sharing the geometry-v2 center and aperture.

![Seven empty rarity-frame layers](review/empty-individual-frames.png)

The seven preferred frame layers live under `candidates/empty-individuals/`. Both the central
aperture and canvas exterior are transparent. The rank medallion, rim, and ornaments remain opaque.
All ranks use the same deterministic inner-aperture mask.

The universal `candidates/charcoal-forged-stone-backing.png` supplies the quiet dark interior as an
independent layer. It slightly overlaps beneath the rim so no seam can appear, but it cannot extend
outside the frame silhouette.

![Measured Cut assembled from three independent layers](review/layered-measured-cut-all-rarities.png)

Measured Cut is reduced to the shared safe scale and clipped to the intersection of the 64% subject
circle and inner aperture before composition. The frame is always composited last, so no skill art
can cover the rim or rank crest. Future separately identifiable secondary effects may use the wider
72% effect circle. The 96-pixel review is
`review/layered-measured-cut-recognition-96.png`.

The exact geometry hash, inputs, outputs, and hashes are recorded in
`candidates/empty-layer-manifest.json`. Rebuild and validate with:

```bash
pnpm exec tsx tools/compose-empty-rarity-frame-v6.ts --write
pnpm exec tsx tools/compose-empty-rarity-frame-v6.ts --check
```

The exact source regions, normalization scale, paths, and SHA-256 hashes are recorded in
`candidates/manifest.json`. Rebuild with:

```bash
pnpm exec tsx tools/extract-rarity-frame-v6.ts --write
pnpm exec tsx tools/extract-rarity-frame-v6.ts --check
```

## Exact generation prompts

Both built-in image-generation calls received the two ordered references: the canonical Option C
comparison plate, followed by the accepted v5 regular-hexagon sheet.

Shared prompt:

```text
Create a production calibration sheet of exactly seven standalone fantasy RPG rarity frames, using the two supplied images as visual references. The first reference is the canonical material and ornament authority; the second reference demonstrates the corrected regular point-up hexagon geometry and 4-over-3 arrangement.

Every frame must be a geometrically regular point-up hexagon: all six sides equal, outer body height-to-width ratio approximately 1.1547. All seven frames must be identical in outer dimensions and scale. Each must have one centered top crest containing exactly one uppercase rank letter. No skill icon, no skill name, no proficiency text, no captions, no title, no visible grid, no guide marks.

Preserve this exact ordered material ladder:
F — weathered black iron, austere and nearly unornamented.
E — aged warm bronze, restrained.
D — tempered blue steel, crisp cool edges.
C — bright silver, clean restrained polish.
B — blackened gunmetal with subtle amethyst accents.
A — champagne electrum with modest angular ornament.
S — ornate antique gold with elegant filigree, the clearest and most prestigious.

Layout must be mathematically staggered and perfectly aligned. Top row, left to right: F, E, D, C. Their horizontal centers are 12.5%, 37.5%, 62.5%, and 87.5% of the canvas width. Bottom row, left to right: B, A, S. Their horizontal centers are exactly 25%, 50%, and 75%, so B is centered precisely between F and E, A between E and D, and S between D and C. Rows must not overlap. Keep every frame fully inside the canvas and evenly spaced.

Use a genuine transparent RGBA background, including transparent negative space outside the frames. Frame interiors should be dark, neutral, and empty enough to receive separately generated skill art later. High-end dark fantasy game UI asset, crisp metal detail, front-facing orthographic presentation, no perspective tilt, consistent lighting, no drop-shadow canvas, no checkerboard painted into the pixels.
```

Variant 1 suffix:

```text
VARIANT 1 — MAXIMUM FILL. Make the seven frames as large as physically possible while satisfying the exact centers and avoiding any overlap or cropping. Use only about 2–3% outer margin, about 96% horizontal occupancy, and about 94% vertical occupancy. Minimize dead space between rows. Favor maximum usable pixel density per future crop.
```

Variant 2 suffix:

```text
VARIANT 2 — UNIFORM CROP CELLS. Optimize the composition for deterministic cutting into seven equal-sized crop boxes. Keep the exact stated centers. Make each frame occupy approximately 92% of its implied cell width and make both rows share exactly the same frame scale and vertical spacing. Leave only a narrow, uniform safety gutter around every frame; maximize frame size within that constraint. The silhouette, top crest height, baseline, and ornament extents must align identically across all ranks.
```

Rejected background-extraction prompt:

```text
Use case: background-extraction
Asset type: transparent production source sheet for deterministic cropping
Input image: the sole edit target and exact pixel-level visual authority.
Primary request: remove only the pale checkerboard outside the seven rarity frames and replace it with genuine alpha transparency.
Invariants: preserve all seven frames exactly—their 4-over-3 placement, scale, geometry, rank letters F E D C B A S, materials, colors, lighting, ornaments, dark interiors, and every edge detail. Do not redraw, restyle, move, resize, crop, simplify, or add anything. Keep the canvas dimensions unchanged.
Output: genuine RGBA PNG. Outside each frame must be transparent. Keep each dark hexagonal interior opaque.
Constraints: no painted checkerboard, no white background, no colored matte, no labels, no new elements, no watermark.
```
