# Skill-art pilot — Measured Cut

Status: **visual review candidate**.

![Standalone Measured Cut emblem](candidates/measured-cut.png)

This is the first standalone skill-art pilot under the Painted Emblem direction. It depicts one
longsword and one controlled crescent slash. It intentionally contains no rarity frame, rank letter,
skill label, mastery, level, UI, character, or scenery.

The built-in image generator returned a 1254×1254 RGB PNG with a painted pale checkerboard despite
the genuine-alpha request. The immutable provider source is retained at
`sources/measured-cut-provider-v1.png`, SHA-256
`d9478e5966e22040d92b4b643dde48927bd6f0f31b46c006511dc1a05de3f689`. The deterministic v6
extractor removes the connected checker matte, preserves the sword, slash, and visible sparks, then
fits the result to the shared 1024×1024 RGBA canvas. The candidate hash and every composite hash are
bound in the v6 extraction manifest.

## Exact generation prompt

The built-in image-generation call used the approved three-icon Painted Emblem comparison as its
sole style reference and this exact prompt:

```text
Use case: stylized-concept
Asset type: standalone fantasy RPG skill emblem for deterministic placement inside rarity frames
Input image: visual style authority only—the painted-emblem treatment shown in the reference. Do not copy its frames, rank letters, labels, or layout.
Primary request: create one standalone emblem for a sword-cut skill named Measured Cut.
Subject: one clean steel longsword sweeping diagonally upward through a single precise crescent-shaped slash trail. The blade and arc should read immediately as a controlled sword cut, not a generic weapon portrait.
Style/medium: premium hand-painted dark-fantasy game icon, sculptural steel, crisp silhouette, restrained fine detail, matching the reference's painted-emblem direction.
Composition: centered square asset; one dominant sword and one supporting slash arc; generous negative space; subject contained within the middle 64% of the canvas and all effects within 72%; readable at 96 pixels.
Color palette: neutral silver steel, charcoal shadows, tiny restrained warm spark accents.
Background: genuine transparent RGBA. No painted checkerboard, no colored matte, no floor, no scenery.
Constraints: skill artwork only. No hexagon, no border, no frame, no crest, no rank letter, no words, no mastery, no level, no UI panel, no second weapon, no hand, no character, no blood, no watermark.
```
