# Five-Head Combat Chibi Regeneration Design

**Status:** Accepted for implementation

**Date:** 2026-09-04

**Decision:** [Combat chibis target five anatomical heads](../../decisions/0070-combat-chibis-target-five-heads.md)

## Objective

Regenerate a candidate combat chibi for each of the 200 owner-approved one-star heroes while
preserving the selected summon portrait's identity and correcting the recurring oversized-head,
inflated-arm, inflated-hand, widened-torso, and added-body-mass failures.

The run is complete when every selected hero has one provenance-complete `1024x1536` PNG candidate
and the complete set passes structural validation. There is no pilot checkpoint, visual acceptance
gate, comparison site, or owner-review workflow in this production run. Completion is not visual
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

## Output validation

Automated checks verify readable PNG bytes, exact `1024x1536` dimensions, declared MIME type, prompt
and reference bindings, collision-safe paths, and SHA-256 evidence. The five-head target lives in the
exact prompt; this run does not use computer vision or human scoring to reject, rank, or revise
valid provider images. A returned readable image is retained even when later visual inspection may
find a flaw.

## Experiment layout

All new artifacts live under:

`assets/heroes/experiments/five-head-chibi-regeneration-001/`

The root owns:

- `README.md`, `decision.json`, `prompt-template.txt`;
- `source-roster.json`, `production-plan.json`, and `provenance/production-journal.jsonl`;
- `scripts/` and `tests/` for materialization, persistence, and structural validation;
- `production-report.json` and `completion-report.json`;

Thirteen wave directories own immutable targets, assignments, candidates, and results. Waves 01–12
contain sixteen heroes each and wave 13 contains eight, for exactly 200 targets. Waves are dispatch
and commit boundaries only; none is a review or approval checkpoint.

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
type, call ordinal, call kind (`primary` or `provider-no-output-retry`), provider metadata, and
timestamps.

Every attempted provider call appends one journal record containing target, assignment, call kind,
start and completion times, outcome, and returned provider artifact when one exists. Aggregate call
counts are derived from the journal, never typed into a report from memory.

## Deterministic dispatch order

The materializer sorts all 200 selected pairs by `designOrdinal`, then by `heroId`, and chunks them
into twelve 16-assignment waves and one eight-assignment wave. The harness proceeds through every
wave without asking for visual feedback or changing the prompt between heroes.

## Generation and budget contract

Each target receives exactly one primary image-generation call. Up to sixteen producers may work in
parallel, each owning only one assignment's candidate and result paths. The root coordinator alone
writes shared manifests, plans, journals, reports, commits, and pushes.

Only a provider response with no usable image may receive one versioned provider retry. The whole
experiment permits at most ten such retries, for a hard ceiling of 210 calls: 200 primary plus ten
provider-failure retries. A visually imperfect but valid image is retained without automatic paid
correction. More than ten no-output failures stop dispatch before the cap is exceeded.

Persistence is exclusive-create and content-addressed. Existing valid candidates are never
regenerated on resume. Conflicting bytes at an occupied path fail closed.

## Completion invariants

- Source roster hash matches the frozen authority and contains exactly 200 unique heroes.
- There are exactly 200 target, assignment, candidate, and strict result records.
- Every source summon hash matches its upstream selected-pair record.
- Every target requests 5.0 heads and references only its selected summon portrait.
- Every candidate is a readable `1024x1536` PNG and its hashes match the retained provider source
  and result record.
- Primary calls equal 200; no-output retries are at most ten; all calls are journaled.
- Automated tests and experiment validation pass.
- No engine contract, summon table, shared runtime catalog, approved-source catalog, or unrelated
  visual domain changes.

## Promotion boundary

All outputs are candidates. A later, separately requested task may inspect them or request targeted
v2 chibis. This run does not authorize alpha cleanup, combat footprint normalization, runtime
catalog mutation, or replacement of historical sources. Those operations require a separately
reviewed promotion plan.
