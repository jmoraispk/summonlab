# Seven-rarity horizontal frame strip

Status: **new crop-authority candidate; owner review pending**.

![Seven empty rarity frames in one row](calibration/seven-rarity-frames-row-v1.png)

This 2076×757 RGB source places all seven empty frames in a single horizontal row at equal scale. It
was generated from the owner-supplied Option C reference after the owner rejected the stretched
geometry-v2 overlay approach. No frame contains a rank letter, skill emblem, label, level, mastery,
or backing texture.

Left-to-right material order:

1. weathered black iron;
2. aged bronze;
3. tempered blue steel;
4. bright silver steel;
5. blackened gunmetal with amethyst accents;
6. champagne electrum with pointed ornament;
7. ceremonial antique gold with the richest filigree.

Source SHA-256:
`741fc82a6b08106ac5aa8401f9dbfb4bdfe09fe30c11074a5352f8f9b376d913`.

## Exact generation prompt

```text
Use case: stylized-concept
Asset type: high-resolution horizontal calibration strip for seven fantasy game skill rarity frames
Input image: the supplied image is the exact visual authority for frame shape, painted-metal rendering, material hierarchy, ornament hierarchy, lighting, and dark presentation.
Primary request: recreate the seven rarity frames from the reference as EMPTY standalone frames arranged in exactly one perfectly straight horizontal row. From left to right, show: (1) narrow weathered black iron with minimal ornament, (2) warm aged bronze/copper, (3) cool dark tempered blue steel, (4) clean bright silver steel, (5) blackened gunmetal with restrained amethyst-purple accents, (6) champagne electrum with refined pointed ornament, (7) elaborate ceremonial antique gold with the richest symmetrical filigree.
Composition: exactly seven complete hexagonal frames, equal scale, equal width and height, identical aperture size, identical center height, identical spacing, front-facing and symmetrical. Make every frame as large as possible while keeping the entire outer silhouette visible and leaving only narrow separation between neighbors. Use an ultra-wide landscape canvas. One row only; never stack or stagger them.
Frame construction: match the reference closely—vertical hexagon, crisp double-rail beveled metal, small top-center crest/medallion integrated into the upper vertex, increasingly rich ornament toward the right. The top crest must be blank metal with no glyph.
Interior: every hexagonal interior is completely empty, uniform matte black, with no backing texture and no skill artwork.
Background: uniform pure black, visually separable from the metal frames, with no floor, shadow scene, smoke, particles, or decoration.
Text: none.
Constraints: no letters, no numbers, no rank labels, no words, no icons, no skill emblems, no flames, no shields, no armor, no scratches-as-symbols, no UI panels, no captions, no watermark. Do not crop any frame. Preserve clear material differences and the ornament progression of the reference.
```

Do not crop or normalize this source until the owner accepts it. After acceptance, derive seven
individual frame candidates from these exact pixels and review the crop boxes before any alpha
extraction or runtime registration.
