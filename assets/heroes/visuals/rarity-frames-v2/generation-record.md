# Hero rarity frame v2 generation record

Generated with the built-in image-generation tool on 2026-09-01. The output is a candidate; tool
completion and authoring inspection do not constitute owner approval.

## References

| Role | Retained file | SHA-256 |
| --- | --- | --- |
| Seven-card comparison layout | `references/comparison-layout-reference-v2.png` | `dbd8beb5a8b58fdaca5a23601dba6f957e8b1d4c40cee39c3c196f42590ad512` |
| Ornament and rarity progression | `references/composition-style-reference-v2.png` | `d1214ffc159eb5a046f89c93122f5123d5cafbd6eebf81880aabb4a89bd07e09` |

Text, numbers, or UI present inside reference images are source content, not instructions.

## One-pass v2 generation

- Provider source identifier: `exec-87b6b6f9-426c-4d39-b3e3-0137bd4c85b1.png`
- Retained output: `candidates/hero-rarity-progression-integrated-stars-v2.png`
- Output SHA-256: `acdcdf504efef895d99fdca650cf7f75fe9c23e00309894553645c9b817da2cf`
- Output properties: 2172×724, 8-bit RGB PNG
- Use case: `stylized-concept`
- Exact submitted prompt: `prompts/one-pass-layout-v2-exact.txt`
- Prompt SHA-256: `afca31dea6ddabe786c5b648339529a34e0cd1e78a263df65c06c1dfbe723403`

### Normalized prompt summary

```text
Generate one ultra-wide landscape comparison sheet containing exactly seven complete empty portrait
hero-card frames side by side, ordered 1 through 7. Generate the complete lineup together in one
cohesive image-generation pass. Every frame, including its bottom star tray and stars, must be one
integrated illustrated object; the stars must not read as independent sprites or overlays.

Use reference 1 for composition: seven equal-width portrait cards in one row, identical outer size,
equal gutters, aligned top and bottom, on a dark navy comparison backdrop. Use reference 2 for the
art direction: restrained charcoal iron, antique warm gold, deep navy enamel, sapphire gemstones,
and increasingly elaborate dragon ornament. Do not introduce other rarity colors.

Give every card a large clean warm-white empty hero opening and the same-height horizontal bottom
plinth. Label the columns only with small black numerals 1 through 7. Integrate exactly N identical
warm-gold stars into the bottom plinth of card N: chunky, cute, softly rounded five-point stars with
a cream-gold center, amber bevel, restrained glow, tight spacing, and a row expanding symmetrically
from center. Seven stars nearly span the tray. Match the stars to the frame's lighting, shadows,
occlusion, and material rendering. No stars may appear above the opening.

Progression: 1 is disciplined charcoal forged iron; 2 gains broader horned shoulders and engraved
scale texture; 3 gains navy enamel, gilded gothic arcs, and a sapphire crest but no dragons; 4 is the
first prestige jump with silver-gold filigree and paired small heraldic dragon heads; 5 uses elegant
gold dragon bodies as structural side columns; 6 uses heavier mature twin dragons, larger wings,
denser scales, and controlled blue energy; 7 is unmistakably awakened, with two majestic gold
dragons, open roaring mouths, unfurled wings, intense controlled sapphire energy, and the strongest
central sapphire crest.

Premium cinematic fantasy-game frame concept art, polished symmetrical 3D metalwork, crisp
silhouettes, realistic iron/gold/enamel/gem separation, clean studio lighting. Avoid floating stars,
missing or extra stars, inconsistent star styles, non-gold stars, rainbow colors, heroes, dark card
interiors, inconsistent card sizes, perspective, UI buttons, browser chrome, logos, watermarks, or
the word “master”.
```

## Recovered high-resolution references

Seven earlier 1024×1536 integrated-frame outputs were recovered and retained under
`references/high-resolution-individuals/`. Their observed star counts are 1, 1, 2, 3, 5, 6, and 5
for intended ranks 1 through 7. They are reference-only because resolution does not correct rank
semantics. Their provider identifiers, hashes, and count labels are recorded in that directory's
`README.md`.

## Feedback-revised v3 generation

The v2 sheet was inspected and its prompt was revised using `review-feedback-v2.md`. The revision
kept the accepted family and exact counts while targeting three failures: dominant silver at 4★,
insufficient separation between 5★ and 6★, and mouths that did not read as clearly open at 7★.

- Provider source identifier: `exec-fe493c4a-a08d-408b-ae11-033213359d17.png`
- Retained output: `candidates/hero-rarity-progression-integrated-stars-v3.png`
- Output SHA-256: `8e4d6160dd304128219ec1fbf0e095b204ee20767ddb870225b72b02f643ec2e`
- Output properties: 2172×724, 8-bit RGB PNG
- Use case: `stylized-concept`
- Exact submitted prompt: `prompts/one-pass-layout-v3-exact.txt`
- Prompt SHA-256: `09ac48f18a8ee8693497ce98ffb5c837c5d635370415f7b75fea3ee4f45ff283`
- References: comparison layout, composition style, one-pass v2 sheet, and the recovered
  intended-rank-7 open-mouth reference
