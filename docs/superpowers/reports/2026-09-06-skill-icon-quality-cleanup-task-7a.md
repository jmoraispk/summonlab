# Task 7A — Semantic revision v2 recovery

## Outcome

Task 7 v1 is not treated as complete. Its packet, raster, receipt, and review bytes are retained as
historical evidence. This recovery adds append-only v2 authority and materializes the deterministic
portion of the corrected batch:

- 28 immutable `prompts/revisions-v2/*-v2.json` packets, sorted by canonical path;
- 21 exact deterministic inset recoveries from authenticated v1 providers;
- 3 byte-for-byte identity/adoption recoveries: Still Depths, Warmth, and Red Harvest;
- 24 candidate-v2 provider/revision/composite/result sets;
- 4 explicitly pending generation-v2 packets: Living Metal, Ore Sense, Taming, and Rend Armour;
- zero image-generation calls in this task.

Each deterministic receipt records current-run source-read, normalization, composition, inspection,
and receipt-commit timing; `generation.attemptCount` and `callIdentifiers` are both zero. It does not
invent unavailable v1 call IDs or timing.

## Recovery authority

The 21 inset outputs decode the bound `1254×1254` RGB provider, remove only its bounded `caBX`
container, assign sRGB, resize once with Lanczos3 to `696×696`, position it at `(164,192)` on a
transparent `1024×1024` canvas, and then reuse the bound geometry mask, backing, and rarity frame.
The three approved compositions use a named identity transform and exactly preserve their v1 interior
and composite bytes.

`tools/finalize-skill-icon-quality-cleanup-v2.ts` refuses lower-revision fallback. It accepts only
the highest valid `candidate` receipt for each target; `revise`, `failed`, and missing receipts stay
unresolved. The final review renderer therefore blocks until all 28 candidate-v2 outputs exist.

## Inspection

The 24 deterministic candidates were inspected from immutable contact sheets at both source-composite
and 384px display scale:

- `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v2-recovery/deterministic-v2-1024.png`
- `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v2-recovery/deterministic-v2-384.png`
- `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v2-recovery/deterministic-v2-report.json`

No new aperture clipping was observed in the deterministic/identity set. Subjects, actions, limbs,
and held equipment remain centrally readable at 384px. This is technical candidate evidence only;
there is no owner decision, promotion, selection, or wiki replacement.

## Deliberate incomplete gate

`finalize:skill-icon-cleanup-v2` reports `candidateCount: 24` and `ready: false`. The four pending
generation-v2 targets are the exact unresolved set. `check:skill-icon-quality-cleanup-review` and
`check:skill-icon-cleanup-v2-complete` must fail closed until that set reaches 28 valid candidates.
