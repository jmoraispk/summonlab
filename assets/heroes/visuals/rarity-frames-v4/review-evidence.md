# Hero rarity frame v4 review evidence

## Authoring status

Status: **candidate — owner visual approval pending**.

The packet contains production-review candidates, generation references, prompts, and inspection
evidence. It contains no approved or runtime assets.

## Dimensional evidence

- 35 of 35 individual PNGs are exactly 1024×1536 and RGB.
- Ranks 1–2 have identical SHA-256 values across Neutral, Fire, Water, Earth, and Wind.
- Median central hero-opening variation by family:
  - Neutral: 448–510 px, 13.84% variation;
  - Fire: 432–510 px, 18.06% variation;
  - Water: 430–510 px, 18.60% variation;
  - Earth: 430–510 px, 18.60% variation;
  - Wind: 430–510 px, 18.60% variation.
- Every widest/narrowest ratio is below the required 1.20 cap.
- The measurement method, exact per-rank readings, normalization factors, and hashes live in
  `geometry-report.json`.

## Bounded visual inspection

- The no-affinity authority contains seven aligned frames with integrated star counts 1–7.
- Neutral uses charcoal iron, tempered steel, restrained warm-gold trim, and flat forged crests. It
  contains no blue gems, affinity-colored gems, or affinity emission.
- Every individual candidate contains exactly one complete frame and one horizontal lower star tray.
- Stars retain the same warm-gold, broad, softly rounded five-point treatment and are rendered as
  part of the frame object.
- Rank 1 remains relatively rectangular; rank 2 adds a horned silhouette without an abrupt material
  color change.
- Ranks 3–7 add ornament, heraldry, guardian anatomy, elder density, and awakening in sequence.
- Fire, Water, Earth, and Wind begin affinity expression at rank 3 and increase it through rank 7.
- Dragon mouths remain visually sealed through rank 6. Rank 7 alone shows two open roaring mouths.
- Wind rank 7 v2 turns the left dragon head rightward and the right dragon head leftward so both
  open roars point inward toward the hero opening, matching the accepted Wind authority.
- Whole-frame normalization retained integrated relationships; stars were never moved separately.
- Hero openings remain broad and clear of characters, scenery, and interface text.

## Known production limitations

- All pixels are opaque RGB. Runtime transparency, exact alpha cleanup, nine-slice behavior, and
  engine sizing have not been produced or requested.
- The opening metric is a bounded image-analysis measurement for review consistency, not a runtime
  layout contract.
- Affinity candidates are visual studies and do not authorize changes to canonical affinity
  semantics.
- Owner approval is required before promotion or runtime preparation.

## Owner review questions

1. Does the gemless neutral treatment preserve enough prestige through ranks 5–7 without spending an
   affinity color?
2. Does the internal hero space now feel consistent enough when each family is read left to right?
3. Do ranks 1–2 remain distinct enough through silhouette alone?
4. Does rank 7’s open-mouth awakening separate decisively from the closed-mouth rank 6 in every
   family?
5. Which family, if any, should advance to approval-focused transparency and runtime-fit work?
