# Task 7 report — semantic revisions and review evidence

## Status

Complete. The batch contains review evidence only: no owner review,
selection, promotion, or wiki-source replacement was created or inferred.

## Execution summary

- Processed all 28 immutable revision packets in sorted packet-path order.
- Used the built-in image-generation route for exactly 56 calls: one initial call and one bounded
  correction for each packet. No job exceeded its two-attempt ceiling.
- Persisted each terminal output immediately through
  `persist:skill-icon-cleanup-output` with its source SHA-256, attempt count, and explicit full-size
  and 384px observations.
- Retained all 28 four-artifact receipts under the packet-derived destinations:
  `provider-sources/*-v1.png`, `revisions/*-v1.png`, `composites/*-v1.png`, and
  `results/revisions/*-v1.json`.
- Terminal accounting: 26 `candidate`, 2 `revise`, 0 provider/runtime failures.

## Terminal receipts

Every row used two attempts. `candidate` rows passed both the full-size and 384px inspection;
`revise` rows retain their honest failures rather than receiving an unapproved third attempt.

| Target                                | Status    | Full / 384px |
| ------------------------------------- | --------- | ------------ |
| `craft:cooking:comfort`               | candidate | pass / pass  |
| `craft:cooking:cooking`               | candidate | pass / pass  |
| `craft:cooking:preserving`            | candidate | pass / pass  |
| `craft:cooking:restorative-broth`     | candidate | pass / pass  |
| `craft:forging:fuel-craft`            | candidate | pass / pass  |
| `craft:forging:living-metal`          | revise    | fail / fail  |
| `craft:forging:ore-sense`             | revise    | fail / fail  |
| `craft:forging:tempering`             | candidate | pass / pass  |
| `craft:forging:weaponsmithing`        | candidate | pass / pass  |
| `craft:gathering:taming`              | candidate | pass / pass  |
| `craft:gathering:the-earth-provides`  | candidate | pass / pass  |
| `magical:elemental:ashfall`           | candidate | pass / pass  |
| `magical:elemental:still-depths`      | candidate | pass / pass  |
| `magical:elemental:warmth`            | candidate | pass / pass  |
| `magical:enchantment:sustained-weave` | candidate | pass / pass  |
| `magical:restoration:soothe`          | candidate | pass / pass  |
| `martial:blade:assassin-s-certainty`  | candidate | pass / pass  |
| `martial:blade:blade-dance`           | candidate | pass / pass  |
| `martial:blade:hamstring`             | candidate | pass / pass  |
| `martial:blade:hewing-blow`           | candidate | pass / pass  |
| `martial:blade:severed-thread`        | candidate | pass / pass  |
| `martial:body:joint-lock`             | candidate | pass / pass  |
| `martial:body:low-kick`               | candidate | pass / pass  |
| `martial:polearm:berserk-swing`       | candidate | pass / pass  |
| `martial:polearm:reaping-arc`         | candidate | pass / pass  |
| `martial:polearm:red-harvest`         | candidate | pass / pass  |
| `martial:polearm:rend-armor`          | candidate | pass / pass  |
| `martial:ranged:heartseeker`          | candidate | pass / pass  |

The two retained `revise` findings are deliberate terminal evidence:

- `craft:forging:living-metal`: the bounded correction removed the copied border but retained a
  rocky painted backing and an ambiguously arrow-like branching metal silhouette.
- `craft:forging:ore-sense`: the correction removed the copied frame and eye badge, but the
  hand/forearm remains visibly cropped at the lower-left protected-aperture boundary.

## Re-finalization and review renderer

The pre-existing cleanup finalizer validates the deterministic 456-item base but does not produce
Task 7 review evidence. A narrow `render-skill-icon-quality-cleanup-review` command was added after
test-first evidence:

- RED: `corepack pnpm vitest run tools/render-skill-icon-quality-cleanup-review.spec.ts` failed
  because the requested review-plan module did not exist.
- GREEN: the focused suite passed after the review-only plan was implemented; the normal
  `test:skill-icons` command now includes it.

The renderer reads only authenticated terminal revision receipts. It substitutes revision composites
only in review layouts, retaining base cleanup composites for all other records and returning
`ownerPromotion: false`. It never writes `selection.json`, an owner review, promotion receipts, or
wiki derivatives.

The generated review package contains 23 PNGs:

- `review/reference-assets-v1.png` — backing plus seven canonical rarity frames, `1680×1034`.
- `review/catalog/page-01.png` through `page-19.png` — all 456 before/after pairs, each
  `3240×1652`, with name, domain/family, rank, motif, disposition, and finding tags outside each
  image.
- `review/frame-examples-v1.png` — ten frame/composition cases, `3280×1628`, paired at 384px.
- `review/semantic-revisions-v1.png` — all 28 semantic before/after pairs, `3280×3668`, paired at
  384px.
- `review/symbolic-decisions-v1.png` — ten symbolic-language cases, `1440×2662`, each at 384px and
  explicitly marked `KEEP / REMOVE: UNDECIDED`.

Focused visual inspection found that the first symbolic sheet’s fixed-width owner-decision text
overran its narrow text lane. The root cause was the long label inside the 296px available column.
The renderer now uses bounded labels, was re-rendered, and the resulting sheet was visually checked.
This presentation correction changed no candidate, receipt, or decision state.

## Validation

All documented Task 7 gates passed:

```text
corepack pnpm check:skill-icon-quality-cleanup
PASS — 456 skills (258 Martial, 124 Magical, 74 Craft); 28 packets; 0 written; 0 drifted

corepack pnpm validate:skill-icon-quality-cleanup
PASS — ready=true; total=456; finalized=456; written=[]; drifted=[]

corepack pnpm check:skill-icon-quality-cleanup-review
PASS — 19 catalog pages, 28 review revisions (26 candidate / 2 revise), 10 frame examples,
10 symbolic cases, ownerPromotion=false

corepack pnpm check:skill-icon-mass-production
PASS — 705/705 current files; 124 families; 456 skills; 19 catalog pages

corepack pnpm validate:skill-icons
PASS — 456 canonical, 456 mapped, 124 map entries; skill icon assets valid

corepack pnpm typecheck:skill-icons
PASS

corepack pnpm test:skill-icons
PASS — 17 files, 410 tests
```

The cleanup validator retains its existing near-white component diagnostics as warnings; it reported
no drift or failure.

## Immutable-byte audit

| Protected scope                                         | Files | Aggregate SHA-256                                                  | Task 6 baseline match |
| ------------------------------------------------------- | ----: | ------------------------------------------------------------------ | --------------------- |
| `mass-production-v1`                                    | 2,465 | `55133003f54d931442ff9acb653dda821d735674ab87873a581d8b030f475339` | yes                   |
| Cleanup base interiors/composites/base results          | 1,368 | `7483e18aeb37be211ae7174f4eef69e78d75732c554711567b04b467d97fe330` | yes                   |
| Shared reference targets/assignments/candidates/results |   210 | `d5582c4a721a8ed2a54f225d616a424d3127935d2f7dbd3967a6e8b272eba1f7` | yes                   |

The immutable packet aggregate remains
`3dea4152c13d4b7c3bf3d87c683637b6ff836f1a7383b416fce947fbee0b8715`.

## Boundary for Task 8

The review package is ready for an owner decision. The ten symbolic-language cases remain unresolved
until an owner records explicit `keep` or `remove` decisions. The Task 7 candidate batch does not
authorize acceptance, selection, promotion, or wiki refresh.
