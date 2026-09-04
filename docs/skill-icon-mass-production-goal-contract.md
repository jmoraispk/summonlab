# Sol Skill-Icon Mass-Production Goal Contract

Status: **active execution contract**

Date: **2026-09-03**

## Objective

Produce a review-ready, complete framed icon for every skill in the frozen Summonlab skill catalog.
The run does not pause for visual approval. It saves one framed reference sheet for every motif
family, uses that sheet to generate every member again at full resolution, validates and indexes all
artifacts, produces review contact sheets, updates production documentation, and finishes only when
the entire frozen inventory is present and mechanically verified.

Owner review happens after mass generation. This contract does not authorize self-approval,
promotion, or deletion of historical candidates.

## Frozen authorities

At run creation, the coordinator reads and hashes these files:

- `assets/wiki/skills/icon-production-v1/catalog.json`
- `assets/wiki/skills/icon-production-v1/motif-map.json`
- `assets/wiki/skills/icon-production-v1/visual-specs.json`
- `assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png`
- `assets/wiki/skills/icon-production-v1/geometry-v2.json`
- `assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png`

The owner-approved frame-shape authority is the seven-frame RGB sheet whose SHA-256 is
`4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266`. It defines the regular
point-up hexagon, integrated rank crest and letter, materials, ornaments, and relative visual weight
of F, E, D, C, B, A, and S. The letter and crest are permanent parts of each frame.

The current derived inventory is:

- 456 skills: 258 Martial, 124 Magical, and 74 Craft;
- 124 motif families;
- 20 one-skill families and 104 multi-skill families;
- a largest family of 12 skills.

These numbers describe the current inputs, but the run manifest derives its requirements from the
frozen file contents. If the live catalog changes afterward, those changes belong to a subsequent
run revision and do not silently expand or shrink the active run.

## Output model

The execution root is:

`assets/wiki/skills/icon-production-v1/mass-production-v1/`

It contains:

```text
manifest.json
prompts/
  families/<family-slug>.json
  skills/<skill-slug>.json
reference-sheets/
  <family-slug>.png
reference-sheet-maps/
  <family-slug>.json
icons/
  <skill-slug>.png
provider-sources/
  <skill-slug>-v<revision>.png
results/
  families/<family-slug>.json
  skills/<skill-slug>.json
contact-sheets/
  families/<family-slug>.png
  catalog/page-<number>.png
```

`family-slug` is the motif-family ID with dots replaced by hyphens. `skill-slug` is the canonical
skill target ID with colons replaced by hyphens. Export fails on any slug collision.

Every generated file is additive and collision-safe. A new attempt receives a higher revision;
existing bytes are never overwritten. The manifest selects exactly one current revision while
retaining the complete provenance chain.

## Artifact contracts

### Family reference sheet

Every one of the 124 motif families receives one saved provider-native PNG reference sheet,
including singleton families. The sheet shows all family members as complete framed skill tiles in
canonical lineage order. Each tile contains:

- the member's concrete painted-emblem subject;
- the correct F-S rarity frame, including its crest and letter;
- a consistent charcoal interior;
- no skill name, mastery, level, type badge, caption, UI panel, watermark, or scenery.

The layout uses four columns and enough rows for every member, with no overlap or crop. The largest
family therefore uses a 4-by-3 layout. The adjacent JSON map records each cell's index, target ID,
name, rarity, row, and column so image text is never used as identity evidence.

The family sheet establishes shared silhouette grammar, material language, action direction,
palette boundaries, and progression. It is a visual reference, not a source of final skill pixels.

### Individual skill image

Every frozen catalog skill receives one independently generated final candidate. Each candidate is
a `1024x1024` RGBA PNG containing:

- one centered, complete, geometrically regular point-up hexagonal tile;
- the correct rarity frame with its integrated crest and uppercase letter;
- the standard charcoal interior;
- one dominant skill emblem and at most one subordinate supporting effect;
- transparent pixels outside the complete frame;
- no text except the single rank letter in the crest.

The image is generated at the provider's largest available square size and downsampled to
`1024x1024` when necessary. A smaller source is rejected rather than enlarged. All visible frame
and ornament pixels remain inside the canvas.

F through A are concrete-first: the weapon, projectile, body, element, magical operation, craft
tool, material, ingredient, creature, document, or result that performs or embodies the skill is
visible. Effects support that subject rather than replace it. S may become primarily abstract only
when the existing visual specification explicitly permits an abstract pinnacle and the family
ancestry remains recognizable.

## Reuse and frame-repair rules

Before generating a new artifact, the coordinator inventories existing provider and repository
images. An existing complete framed skill may be cropped and retained only when all of these are
true:

1. the exact skill and rarity are unambiguous from provenance rather than inferred from appearance;
2. the complete frame, crest, letter, interior, and emblem are unobstructed;
3. the crop contains at least `1024x1024` native source pixels and requires no enlargement;
4. regular-hexagon geometry, alpha, safe-area, and visual-integrity validation pass;
5. the source path and SHA-256 are recorded in the result.

Family-sheet cells normally fail the native-pixel requirement and therefore remain references only.

New individual generations include their complete frame by default. No separate overlay stage is
mandatory. If the emblem passes but the generated frame has a wrong letter, broken edge, malformed
hexagon, or materially incorrect rarity treatment, the coordinator may preserve the emblem and
apply the approved extracted frame for that rarity as a deterministic repair. The repair records the
source image hash, frame hash, crop/mask geometry, and output hash. If clean separation is impossible,
the individual is regenerated instead. A repair never changes the emblem's design.

## Uninterrupted execution algorithm

1. **Freeze.** Validate the three inventory files, derive all family and skill identities, record
   their hashes, import or verify the approved frame authority, and create the additive run manifest.
2. **Author prompts.** Fill every null visual specification from the canonical name, effect,
   equipment or element labels, motif family, rarity, and parent lineage. Produce one exact family
   prompt and one exact individual prompt per skill. Prompt generation is complete only at
   `124/124` families and `456/456` skills.
3. **Generate family sheets.** Process all 124 families in canonical catalog order. Save the exact
   provider output, its cell map, prompt, references, dimensions, and SHA-256. A failed family is
   queued for a higher revision while unrelated families continue.
4. **Generate individuals.** Process family members in parent-before-child order. Each call receives
   the global Painted Emblem authority, approved frame authority, its saved family sheet, and its
   immediate parent candidate when one exists. Save one full-resolution provider output and one
   normalized final candidate per skill. Standalone families follow the same path; they are not
   skipped.
5. **Correct automatically.** Each revision permits one focused corrective edit after the initial
   call. A still-invalid artifact receives a higher revision with the observed defect added to its
   immutable prompt packet. Other work continues. There is no human-review pause and no silent
   acceptance of a failed artifact.
6. **Repair frames only when useful.** Apply deterministic approved-frame repair when the artwork is
   valid and only the frame is defective. Otherwise regenerate the complete tile.
7. **Index and review.** After every successful artifact, update the run manifest transactionally.
   Once all outputs exist, derive one contact sheet per family from the individual candidates and
   paginated catalog sheets grouped by Domain -> Family -> Motif Family.
8. **Verify and finish.** Run the complete audit below, update the related production documentation,
   commit all in-scope artifacts, and push the active branch. Owner review begins only after this
   completion boundary.

Technical validation is continuous but is not a visual checkpoint. Provider throttling, timeout,
or one malformed image records an attempt and requeues the job; it does not stop independent work.
The run stops only for an external condition that makes further image generation impossible or for
unsafe repository state that cannot be isolated.

## Required manifest evidence

`manifest.json` is the machine-readable completion authority. It records:

- schema and run revision;
- creation time and immutable input hashes;
- approved frame-authority path and hash;
- derived expected counts;
- every family, prompt, reference sheet, cell map, result, status, revision, and content hash;
- every skill, family ID, rarity, parent, prompt, final image, result, status, revision, and hash;
- reuse or repair provenance where applicable;
- provider call counts and observed failures;
- contact-sheet paths and hashes;
- final validation commands and their successful completion times;
- the completion state, which is `incomplete` until every required assertion passes.

An image existing on disk without a matching indexed result and hash does not count. A manifest
claim whose bytes or source authorities have drifted does not count.

## Validation and completion audit

The implementation must provide these commands:

```bash
pnpm export:skill-icon-mass-production -- --write
pnpm check:skill-icon-mass-production
```

The write command derives or resumes the run without overwriting prior outputs. The check command is
read-only and exits nonzero unless all requirements below are proved against current bytes:

1. frozen catalog, motif-map, visual-spec, geometry, and frame hashes match the run;
2. every frozen target appears exactly once and every motif family has exactly its canonical members;
3. all 124 family prompts, sheets, cell maps, and successful family results exist and hash correctly;
4. all 456 skill prompts, `1024x1024` RGBA images, and successful skill results exist and hash correctly;
5. each image has the catalog rarity, correct integrated rank letter, complete regular hexagon,
   transparent exterior, safe emblem placement, and no forbidden UI text;
6. every child result binds its family sheet and declared parent revision;
7. reused crops meet the native-resolution rule and every repaired frame binds exact source and
   frame hashes;
8. all 124 derived family contact sheets and every required catalog page exist and hash correctly;
9. there are no duplicate IDs, slug collisions, missing files, stale hashes, unindexed images,
   unexpected overwrites, or unresolved failed jobs;
10. the repository's skill-taxonomy, skill-icon, typecheck, and relevant test suites pass;
11. production documentation states the actual final counts, call totals, exceptions, and output
    roots rather than planned values;
12. all in-scope changes are committed and pushed to the configured remote.

The goal is complete only after the read-only checker reports full coverage and the repository
commit containing that evidence is pushed. Attractive samples, generated family sheets without
individuals, files without manifest records, technical success without complete coverage, or a
partially completed domain are not completion.

## Explicit non-goals

- No visual approval checkpoint occurs during generation.
- No candidate is called owner-approved or promoted automatically.
- No calibration-sheet cell is enlarged into an individual master.
- No rarity, mastery, level, or skill name is baked into the emblem; only the frame's rank letter is
  image text.
- No existing historical evidence is deleted or rewritten.
- No smaller pilot or subset may redefine the goal.

## Goal-harness instruction

Continue producing and verifying artifacts until the manifest-derived family and skill inventories
are both complete. Preserve failures as evidence, revise them additively, and continue independent
jobs. Do not conclude success from progress summaries. Mark the goal complete only after
`pnpm check:skill-icon-mass-production` proves every requirement in this contract and the resulting
commit is pushed.
