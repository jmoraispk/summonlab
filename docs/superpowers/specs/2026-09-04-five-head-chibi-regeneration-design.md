# Five-Head Combat Chibi Regeneration Design

**Status:** Accepted for implementation

**Date:** 2026-09-04

**Decision:** [Combat chibis target five anatomical heads](../../decisions/0070-combat-chibis-target-five-heads.md)

## Objective

Regenerate a candidate combat chibi for each of the 200 owner-approved one-star heroes while
preserving the selected summon portrait's identity and correcting the recurring oversized-head,
inflated-arm, inflated-hand, widened-torso, and added-body-mass failures.

The run is complete when every selected hero has one provenance-complete `1024x1536` PNG candidate,
the complete set passes structural validation, and a ten-page comparison site allows the owner to
review summon source, historical chibi, and five-head candidate together. Completion is not visual
approval or runtime promotion.

## Frozen authority

The source roster is exactly the 200 `selectedPairs` in:

`assets/heroes/experiments/one-star-overnight-200-001/review/review-manifest.json`

Its accepted SHA-256 is:

`8ae3ee617fb200018c261cdee7b2e3fb5a2f1d807cea77df2fe75b78464c6fe5`

The upstream completion report SHA-256 is:

`ce2534962da3c6e869cc3a18d26d6b88bd61ebfbef1a25915aabf0cdf4f370ef`

The new experiment copies the roster fields and source hashes into an immutable snapshot. It never
changes the upstream review manifest, summon candidates, historical chibis, decisions, or reports.

## Visual contract

Every output is a full-body, weaponless, adult combat chibi in the accepted cinematic
semi-realistic painted register. It targets 5.0 anatomical heads from skull crown to soles. Hair
mass, hats, horns, or ornaments are excluded from the unit.

The selected summon portrait is the only raster reference sent to generation. The prompt repeats
the source character's face, apparent age, skin, body construction, muscle and fat distribution,
shoulder width, arm and wrist girth, torso and hip width, leg length, hairstyle silhouette,
wardrobe construction, palette, footwear, accessories, tattoos, and durable marks. It asks for a
compact combat-readable translation without generic widening or inflation.

The historical chibi is shown only in review. Supplying it to generation would encourage the model
to preserve the defects this run exists to remove.

Hard negatives are:

- oversized baby or bobble head;
- generic thick arms, swollen forearms, giant hands, widened shoulders, barrel torso, shortened
  legs, added fat, or added muscle;
- face, age, phenotype, gender-expression, hairstyle, costume, palette, accessory, tattoo, or
  footwear drift;
- cropped hair, hands, clothing, or feet;
- weapons, magic, affinity effects, rarity frames, stars, interface, labels, logos, or text;
- photoreal photography, plastic 3D rendering, or cel-anime treatment.

The canvas is `1024x1536` PNG. The complete silhouette and a small grounding shadow fit inside a
plain warm parchment studio field. Background removal and runtime footprint normalization are
later promotion work and are not part of this candidate run.

### Canonical generation prompt

The materializer substitutes the bracketed fields and records the complete rendered prompt in each
target. Workers submit it without paraphrasing:

```text
Create a new full-body combat chibi of the adult hero in the single supplied summon reference.
This is the same person, not a reinterpretation. Preserve exactly the reference hero's [identity
facts], [body construction], [hair silhouette], [wardrobe construction and palette], [footwear],
and [durable accessories, tattoos, and markings].

Proportion contract: render the complete standing figure at a target of 5.0 anatomical heads tall,
measured from the top of the skull to the chin and repeated to the soles of the feet. Do not count
hair volume, hats, horns, or ornaments as part of the head unit. Use a moderately enlarged stylized
head, a clearly developed adult torso, naturally long limbs, source-faithful shoulders and hips,
and source-faithful arm, wrist, hand, thigh, and calf girth. Do not make the hero baby-like,
super-deformed, fatter, more muscular, broader, shorter-limbed, or puffier than the reference.

Keep the accepted cinematic semi-realistic painted game-character style: warm cohesive color,
believable anatomy and materials, controlled expression, and clean combat-readable silhouette.
Show the entire hairstyle, both hands, all clothing, and both feet with a small grounding shadow on
a plain warm parchment studio field. Vertical 1024x1536 composition.

Weaponless. No magic, affinity effects, aura, rarity frame, stars, interface, label, logo, watermark,
or text. Not photography, plastic 3D, cel anime, caricature, toddler, mascot, or bobble-head art.
Do not duplicate, fuse, omit, or crop anatomy. The summon reference is the only visual authority.
```

## Ratio and visual QA

Automated image checks verify format, dimensions, readable bytes, and hashes. A review worker may
estimate the skull-crown-to-chin unit from the rendered image, but this estimate is advisory rather
than a claim of exact computer-vision measurement.

A candidate enters owner review when:

- its estimated ratio is within 4.5–5.75 anatomical heads;
- the full silhouette is visible;
- there is no obvious broken anatomy, duplicate limb, fused hand, or missing body part;
- identity, body mass, and wardrobe visibly agree with the summon source.

Anything outside the band or failing a visible gate is labeled `revise` in producer QA. It is still
retained as immutable evidence; the run does not spend visual-correction calls automatically.

## Experiment layout

All new artifacts live under:

`assets/heroes/experiments/five-head-chibi-regeneration-001/`

The root owns:

- `README.md`, `decision.json`, `prompt-template.txt`;
- `source-roster.json`, `production-plan.json`, and `provenance/production-journal.jsonl`;
- `scripts/` and `tests/` for materialization, persistence, validation, and review export;
- `production-report.json` and `completion-report.json`;
- `review/review-manifest.json`, `review/index.html`, and ten paginated review pages.

Thirteen wave directories own immutable targets, assignments, candidates, and results. Wave 01 is
a 12-hero calibration pilot. Waves 02–12 contain sixteen heroes each, and wave 13 contains twelve,
for exactly 200 targets.

## Record contracts

`source-roster.json` contains the upstream manifest path and hash plus 200 records with `heroId`,
`displayName`, `designOrdinal`, `sourceWaveId`, `summonTargetId`, `historicalChibiTargetId`, exact
summon and chibi paths, and both source hashes.

Each target contains `schemaVersion`, `experimentId`, `targetId`, `heroId`, `waveId`, `promptVersion`,
the fully rendered prompt and its hash, exactly one summon reference with its hash, the historical
chibi comparison path and hash outside the generation-reference array, output dimensions and MIME
type, lifecycle `candidate`, and the immutable character facts resolved from the source target.

Each assignment contains `assignmentId`, `targetId`, `waveId`, `candidatePath`,
`providerSourcePath`, `resultPath`, `exclusiveOwner`, and status `planned`. Paths must remain inside
the assignment's wave and be unique across the experiment.

Each strict result contains the target and assignment hashes, rendered prompt and hash, sole
reference path and hash, provider-source path and hash, candidate path and hash, dimensions and MIME
type, call ordinal, call kind (`primary` or `provider-no-output-retry`), provider metadata,
timestamps, and producer QA. Producer QA records `status`, the estimated ratio, optional landmark
Y-coordinates for skull crown, chin, and soles, inspection method `visual-review`, and defect codes.

Every attempted provider call appends one journal record containing target, assignment, call kind,
start and completion times, outcome, and returned provider artifact when one exists. Aggregate call
counts are derived from the journal, never typed into a report from memory.

## Deterministic pilot

The materializer selects the lowest `designOrdinal` not already selected for each of twelve strata:

- one woman and one man from `healthy-slight` or `lanky`;
- one woman and one man from `ordinary-average`;
- one woman and one man from `soft-round` or `plus-size-heavy`;
- one woman and one man from `athletic-conditioned` or `clearly-muscular`;
- one woman and one man from `extreme-bodybuilder`;
- one woman and one man with high-volume hair not already selected.

The remaining heroes retain ascending `designOrdinal` order and are chunked into the later waves.
This makes the pilot broad enough to expose proportion failures without allowing manual cherry
picking or roster drift.

## Generation and budget contract

Each target receives exactly one primary image-generation call. Up to sixteen producers may work in
parallel, each owning only one assignment's candidate and result paths. The root coordinator alone
writes shared manifests, plans, journals, review pages, reports, commits, and pushes.

Only a provider response with no usable image may receive one versioned provider retry. The whole
experiment permits at most ten such retries, for a hard ceiling of 210 calls: 200 primary plus ten
provider-failure retries. A visually imperfect but valid image is retained and marked for review;
it does not trigger an automatic paid correction. More than ten no-output failures stop dispatch
before the cap is exceeded.

Persistence is exclusive-create and content-addressed. Existing valid candidates are never
regenerated on resume. Conflicting bytes at an occupied path fail closed.

## Review experience

The review site shows twenty heroes per page across ten pages. Each row presents:

1. selected summon source;
2. immutable historical chibi;
3. new five-head candidate.

It includes hero identity, wave, source hashes, candidate hash, prompt version, provider-call count,
and producer QA. The only owner decisions are `accept-five-head`, `revise-five-head`, and `hold`,
with an optional note. Decisions persist locally and export as JSON. The interface never offers a
hero rejection because the 200 summon identities are already approved.

The server binds `0.0.0.0`. Every collaborator-facing URL uses `10.110.24.218` with the exact port,
path, query string, and session key.

## Completion invariants

- Source roster hash matches the frozen authority and contains exactly 200 unique heroes.
- There are exactly 200 target, assignment, candidate, and strict result records.
- Every source summon hash matches its upstream selected-pair record.
- Every target requests 5.0 heads and references only its selected summon portrait.
- Every candidate is a readable `1024x1536` PNG and its hashes match the retained provider source
  and result record.
- Primary calls equal 200; no-output retries are at most ten; all calls are journaled.
- Review manifest contains 200 unique entries and pages contain 20 entries each.
- Automated tests and experiment validation pass.
- No engine contract, summon table, shared runtime catalog, approved-source catalog, or unrelated
  visual domain changes.

## Promotion boundary

All outputs are candidates. Owner review can request targeted v2 chibis in a later additive run.
Accepting a five-head candidate still does not authorize alpha cleanup, combat footprint
normalization, runtime catalog mutation, or replacement of historical sources. Those operations
require a separately reviewed promotion plan.
