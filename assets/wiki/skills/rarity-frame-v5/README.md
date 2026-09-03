# Regular-hexagon rarity-frame calibration sheet

Status: **visual candidate; owner review pending**.

![Seven regular-hexagon rarity frames in a four-over-three grid](calibration/seven-rarity-frames-4x3-v1.png)

This 1484×1060 RGB source corrects the v4 strip's vertically stretched frames. It uses a compact
four-over-three layout to spend more of the available canvas on each frame:

- top row: F, E, D, C;
- bottom row: B, A, S.

The frame bodies are point-up regular hexagons: six equal apparent side lengths, 120-degree interior
angles, and an intended body height-to-width ratio of `2 / √3 ≈ 1.1547`. The small rank crest may
protrude above the regular body without changing that geometry.

The image provider depicted a checkerboard and returned an RGB PNG instead of the requested genuine
alpha. Treat the checkerboard as a removable matte, not as transparency or part of the design. If
the owner accepts the sheet, crop the seven frames from these exact pixels first, then remove the
matte and validate each crop separately. Do not generate another visual interpretation during that
process.

Source SHA-256:
`4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266`.

## Canvas strategy

The built-in conversational image tool does not expose a caller-selected pixel size, so this sheet
uses its provider-selected 1484×1060 canvas. The OpenAI Image API supports explicit flexible sizes
up to a 3840-pixel edge and 8,294,400 total pixels, provided both dimensions are multiples of 16 and
the aspect ratio is at most 3:1. An exact 3840×2160 four-over-three sheet would therefore maximize
the documented API pixel budget, but it is a separate explicit API/CLI production route rather than
the built-in workflow used here.

## Exact generation prompt

```text
Use case: stylized-concept
Asset type: maximum-resolution seven-rarity fantasy skill-frame calibration sheet for later cropping
Input images: Image 1 is the exact visual authority for materials, painted-metal finish, rank hierarchy, crest lettering, and ornament. Image 2 is useful only for its clean empty-frame treatment and consistent styling; correct its overly tall geometry.
Primary request: generate exactly seven EMPTY rarity frames in a compact 4-over-3 grid. Top row, left to right: F, E, D, C. Bottom row, left to right: B, A, S, centered beneath the gaps of the top row.
Mathematical geometry: every frame BODY must be a true regular point-up hexagon. All six outer sides must have exactly the same apparent length and all six interior angles must be 120 degrees. For a point-up regular hexagon, the body bounding-box height must be approximately 1.1547 times its width—do not make it tall, vertically stretched, narrow, shield-shaped, or rectangular. All seven bodies must use the same side length, aperture size, center geometry, and line weight. The small top rank crest may protrude above the regular hexagon body but must not distort it.
Composition: use a large near-square or landscape canvas. Make each hexagon as large as possible without cropping, with narrow safe margins and even spacing. Exactly four frames on the first row and exactly three on the second. No other objects.
Ranks and materials: F weathered black iron with minimal ornament; E warm aged bronze; D cool tempered blue steel; C clean bright silver; B blackened gunmetal with restrained amethyst accents; A champagne electrum with refined pointed ornament; S ceremonial antique gold with the richest symmetrical filigree. Match Image 1 closely and preserve the clear progression.
Rank text: place exactly one large uppercase serif letter in each top crest, respectively F, E, D, C, B, A, S. No other text anywhere.
Transparency: return a genuine RGBA PNG. The entire sheet background must be truly transparent, not black, white, green, gray, or a painted checkerboard. Every hexagonal interior must also be truly transparent. Only the metal frames, their ornaments, and rank letters may be opaque.
Constraints: no skill icons, no emblems inside the apertures, no backing texture, no labels beneath frames, no levels, no mastery text, no captions, no UI panels, no scenery, no smoke, no particles, no watermark. Do not crop any frame or ornament.
```
