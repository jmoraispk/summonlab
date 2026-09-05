# Monster Family Affinity Production Implementation Plan

> **Superseded production gate (2026-09-03):** the approved-Normal-before-affinity dependency in
> this historical plan is replaced for candidate generation by the hash-bound
> `normal-verified-candidate` protocol in
> [the single-checkpoint goal harness](2026-09-03-monster-image-single-checkpoint-goal-harness.md).
> This does not grant visual approval or runtime promotion.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate thirty monster families into 150 authored T1–T5 forms, reconcile all forty current classes, retire Wood/Metal visual artifacts, and produce a collision-safe, reviewable 750-target Normal/Fire/Earth/Wind/Water image program without promoting anything to runtime.

**Architecture:** Create a new enemy-owned `family-affinity-v1` experiment whose per-family JSON packets are the canonical visual-production source. Local tools validate the roster, compile immutable target/assignment files, export the wiki and review evidence, and enforce candidate/approved-review/runtime separation. Existing six-affinity v1 TypeScript contracts remain historical; the new experiment does not alter engine contracts or shared runtime catalogs.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, TSX, Prettier, Sharp, Markdown/JSON wiki exports, `summonlab-image-production`, Git.

**Spec:** `docs/superpowers/specs/2026-09-01-monster-family-floor-image-production-design.md`

## Global Constraints

- The canonical matrix is exactly `30 families × 5 forms × 5 affinities = 750 targets`.
- The only production affinities are `normal`, `fire`, `earth`, `wind`, and `water`.
- Dual affinities are outside this manifest and require a separate future experiment.
- A T3 is a qualitative Specialist pivot; a T5 is an authored Sovereign boss, never merely a larger T4.
- Every one of the current forty classes receives exactly one explicit disposition: `map`, `rename-map`, `secondary-archetype`, `fauna`, or `retire`.
- Delete Wood/Metal pixels and active records directly. Do not create a legacy folder, retirement ledger, or hash ledger; Git history is the recovery path.
- Candidate, approved-review, and runtime are distinct states. Generation cannot approve or promote an image.
- Family 21 is affinity-neutral `Elementals`, with Wisp, Elemental Spirit, Elemental Warden,
  Elemental Colossus, and Elemental Sovereign as its T1–T5 forms. Affinity substance forms the
  body; a flame-like contour is shape language, not evidence of Fire.
- The former Flame Elementals packet and Ember Wisp bridge attempts are immutable provenance, not
  active production. Future Wisp production uses `elementals/elemental-wisp/*` after its Normal
  anchor is independently approved.
- Owner accepted the Elementals T1–T5 names on 2026-09-02. Wisp, Elemental Spirit, Elemental
  Warden, and Elemental Colossus now have approved-review Normal anchors; Elemental Sovereign
  remains ungenerated pending a successful revised Normal anchor.
- Affinity variants are individual full-resolution images, not palette swaps. The Wisp calibration
  sets the production bar: Fire uses active flame tongues and ember shedding; Wind partially
  dissipates into directional pressure filaments; Water exposes layered currents, refraction, and
  droplets; Earth remains flowing spell-matter with detached orbiting mineral fragments rather than
  becoming a solid rock body. The owner accepted all four Wisp v2 candidates on 2026-09-02; use
  this material-and-motion distinction as the calibration for later Elemental forms.
- Elemental Spirit Fire/Earth/Wind/Water v2 candidates apply that calibration; their v1
  palette/mechanical-shell treatments retain immutable `revise` evidence. On 2026-09-03, the owner
  accepted all 173 active images in the consolidated review gallery: 166 canonical candidates and
  seven provisional Earth bridge candidates. This visual acceptance is recorded in
  `docs/evidence/enemy-image-review-gallery-v1/owner-acceptance.md`; it does not replace the
  independent blind-review requirement for T3/T5 or promote any image to runtime. The full
  collision-safe overnight schedule is recorded in
  `docs/superpowers/plans/2026-09-02-monster-image-overnight-goal-harness.md`.
- Do not modify `packages/contracts`, engine code, skills, unrelated visual domains, or shared runtime catalogs. Any later runtime promotion is a separate integration request to the root orchestrator.
- Family authors own only one numbered family packet. Producers own only one target's candidate and result receipt. The controller alone writes aggregate manifests, indexes, contact sheets, and wiki output.
- Each implementation task ends with focused tests, a concise Conventional Commit, and a push of the current branch.

---

## Task 1: Add the experiment-local roster and mapping schemas

**Files:**

- Create: `tools/family-affinity-production-lib.ts`
- Create: `tools/family-affinity-production-lib.spec.ts`
- Modify: `tools/tsconfig.image-production.json`
- Modify: `package.json`

- [ ] Write failing tests that parse one valid family packet and reject: fewer/more than five forms, duplicate tiers or form IDs, a T3 without a signature mechanic/telegraph/counterplay, a T5 without a boss mechanic and lower-form interaction, affinities outside the five approved IDs, and incomplete current-class mappings.

```ts
expect(() => FamilyPacketSchema.parse(validFamily)).not.toThrow();
expect(() => FamilyPacketSchema.parse({ ...validFamily, forms: validFamily.forms.slice(0, 4) }))
	.toThrow(/five forms/i);
expect(() => CurrentClassMappingFileSchema.parse({ schemaVersion: 'current-class-mapping-v1', entries: [] }))
	.toThrow(/40 current classes/i);
```

- [ ] Run the focused test and verify it fails because the schemas do not exist.

```bash
pnpm vitest run tools/family-affinity-production-lib.spec.ts
```

- [ ] Implement experiment-local Zod schemas and exported types. The family schema must include `familyId`, `displayName`, `sourceRaceNumber`, `sourcePage`, `classificationNotes`, `visualConstants`, `escalationAxis`, nullable `floorSlot`, and five forms containing every field named in the approved spec. The mapping schema must require forty unique `currentClassId` values and enforce disposition-specific canonical IDs. `floorSlot` remains null until a separate floor-ordering decision.

```ts
export const PRODUCTION_AFFINITIES = ['normal', 'fire', 'earth', 'wind', 'water'] as const;
export const FORM_TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;
export const CURRENT_CLASS_DISPOSITIONS = [
	'map',
	'rename-map',
	'secondary-archetype',
	'fauna',
	'retire'
] as const;
export const FAMILY_AFFINITY_ROOT = 'assets/enemies/experiments/family-affinity-v1' as const;
```

- [ ] Add `test:family-affinity-production` and `typecheck:family-affinity-production` package scripts and include the tool in the image-production TypeScript project.

- [ ] Run the focused test and typecheck.

```bash
pnpm test:family-affinity-production
pnpm typecheck:family-affinity-production
```

- [ ] Commit and push.

```bash
git add package.json tools/family-affinity-production-lib.ts tools/family-affinity-production-lib.spec.ts tools/tsconfig.image-production.json
git commit -m "feat(enemies): add family production schemas"
git push
```

## Task 2: Author and validate the Goblins reference packet

**Files:**

- Create: `assets/enemies/experiments/family-affinity-v1/families/01-goblins.json`
- Modify: `tools/family-affinity-production-lib.spec.ts`

- [ ] Add a failing fixture test that loads the Goblins packet and asserts the exact source tiers `Runt`, `Cutter`, `Raider`, `Warboss`, and `Goblin King`, plus the normalized Initiate/Soldier/Specialist/Champion/Sovereign contracts.

- [ ] Author the packet from `docs/wiki/creatures/monster-races/generator-bestiary-01.md`. Preserve visual identity while assigning distinct battlefield duties, teaching goals, telegraphs, counterplay, visual deltas, and lower-form interactions. Make Raider a qualitative Specialist and Goblin King an authored boss with command/production behavior.

- [ ] Add all five affinity theme blocks to the packet. Each elemental block must alter at least two construction dimensions; Normal must explicitly forbid unexplained elemental anatomy, glow, and environmental wake.

- [ ] Validate the packet and review it as the template for the other twenty-nine family agents.

```bash
pnpm vitest run tools/family-affinity-production-lib.spec.ts
pnpm prettier --check assets/enemies/experiments/family-affinity-v1/families/01-goblins.json
```

- [ ] Commit and push.

```bash
git add assets/enemies/experiments/family-affinity-v1/families/01-goblins.json tools/family-affinity-production-lib.spec.ts
git commit -m "docs(enemies): define goblin family forms"
git push
```

## Task 3: Author the remaining twenty-nine family packets in bounded subagent waves

**Files:**

- Create only the numbered JSON files listed below under `assets/enemies/experiments/family-affinity-v1/families/`
- Modify: `tools/family-affinity-production-lib.spec.ts`

Each family packet is an independent subagent task. Dispatch no more than the available concurrency allows; a worker owns one file and may not edit the shared test, manifest, index, or another family packet. Use the Goblins packet as the structural reference, the listed bestiary volume as source, and the approved spec as the mechanics contract.

| Wave | Source | Collision-safe family-owned files |
| --- | --- | --- |
| A | `generator-bestiary-01.md` | `02-orcs.json`, `03-giants.json`, `04-trolls.json`, `05-dragons.json`, `06-skeletons.json` |
| B | `generator-bestiary-02.md` | `07-rotwalkers.json`, `08-wraiths.json`, `09-vampires.json`, `10-mummies.json`, `11-demons.json`, `12-celestials.json` |
| C | `generator-bestiary-03.md` | `13-harpies.json`, `14-minotaurs.json`, `15-nagas.json`, `16-lizardfolk.json`, `17-insectoids.json`, `18-arachnids.json` |
| D | `generator-bestiary-04.md` | `19-slimes.json`, `20-golems.json`, active replacement `family-replacements/21-elementals.json`, `22-treants.json`, `23-fungalfolk.json`, `24-deep-ones.json` |
| E | `generator-bestiary-05.md` | `25-werebeasts.json`, `26-gargoyles.json`, `27-djinn.json`, `28-fae.json`, `29-void-horrors.json`, `30-doppelgangers.json` |

- [ ] Before dispatch, extend the controller-owned test to discover numbered packet files and require source race numbers 1–30 exactly once, unique family/form IDs, exactly 150 forms, and exact T1–T5 coverage per family.

- [ ] Dispatch Wave A family agents, then separate taxonomy/mechanics reviewers. Reject packets that conflate family with duty/faction, turn T3 into a stat increase, turn T5 into an enlarged T4, or use an affinity as the base identity.

- [ ] Run validation, commit, and push Wave A as one reviewable batch.

- [ ] Repeat dispatch, independent review, validation, commit, and push for Waves B, C, D, and E. Use commit subjects `docs(enemies): define bestiary volume N family forms`.

- [ ] Run the complete roster audit after Wave E.

```bash
pnpm test:family-affinity-production
pnpm prettier --check assets/enemies/experiments/family-affinity-v1/families
```

Expected audit output:

```text
families=30 forms=150 tiersPerFamily=5 sourceFormsReconciled=150
```

## Task 4: Reconcile the current forty classes

**Files:**

- Create: `assets/enemies/experiments/family-affinity-v1/current-class-mapping.json`
- Modify: `tools/family-affinity-production-lib.ts`
- Modify: `tools/family-affinity-production-lib.spec.ts`

- [ ] Add a failing test that compares mapping IDs against the forty IDs exported in `docs/wiki/creatures/monsters/visual-index.json`, requiring an exact set match and one disposition per class.

- [ ] Map these exact classes, with no implicit omissions:

```text
armored-brood-guard, giant-broodmother, tunnel-spider, web-caster,
hex-adept, tower-archmage, tower-summoner, ward-mage,
cave-bear, dire-wolf, grey-wolf, tunnel-boar,
bone-mage, death-knight, grave-sentinel, tower-wraith,
clay-golem, crystal-guardian, iron-sentinel, stone-golem,
armored-elder-drake, cave-drake, giant-tower-dragon, venom-wyvern,
burrowing-worm, hungry-mimic, slime-colony, tower-basilisk,
ember-wisp, frost-colossus, stone-breaker, storm-stalker,
goblin-archer, goblin-chieftain, goblin-hexweaver, goblin-skirmisher,
cave-troll, frost-giant, hill-giant, ogoblin-brute
```

- [ ] For each record, store `sourceRoster`, `sourceFamilyLabel`, `disposition`, nullable canonical family/form IDs, rationale, and candidate-reuse eligibility by approved affinity. Use `fauna` for ordinary expedition creatures outside the thirty primary families and `secondary-archetype` for useful roles excluded from the initial 150 forms.

- [ ] Add cross-record checks: a canonical primary form may have at most one `map`/`rename-map`; `secondary-archetype` cannot count toward the 150; only `retire` is excluded from the Earth bridge; retained `secondary-archetype`/`fauna` targets are bridge-only and cannot count toward the canonical 750; reusable candidates must match family, form, duty, anatomy, and framing.

- [ ] Run validation and have a separate taxonomy reviewer inspect every non-`map` disposition.

```bash
pnpm test:family-affinity-production
```

- [ ] Commit and push.

```bash
git add assets/enemies/experiments/family-affinity-v1/current-class-mapping.json tools/family-affinity-production-lib.ts tools/family-affinity-production-lib.spec.ts
git commit -m "docs(enemies): reconcile current monster classes"
git push
```

## Task 5: Delete Wood and Metal artifacts and remove their active dependencies

**Files:**

- Create: `tools/retire-legacy-enemy-affinities-lib.ts`
- Create: `tools/retire-legacy-enemy-affinities-lib.spec.ts`
- Create: `tools/retire-legacy-enemy-affinities.ts`
- Modify: `tools/wiki-monster-database-lib.ts`
- Modify: `tools/wiki-monster-database-lib.spec.ts`
- Modify: `tools/export-wiki-monster-database.ts`
- Modify: `apps/web/src/lib/components/wiki/MonsterVisualMatrix.svelte`
- Modify: `apps/web/src/routes/wiki/monster-database.e2e.ts`
- Delete: `apps/web/src/routes/forge/enemies/affinity-workflow/`
- Delete: `apps/web/src/routes/forge/enemies/affinity-expansion/`
- Modify: `apps/web/src/lib/server/wiki.spec.ts`
- Modify: `docs/wiki/art/monster-gallery.md`
- Modify: `docs/wiki/systems/visuals.md`
- Modify: `docs/wiki/creatures/monster-races/README.md`
- Modify: `package.json`
- Delete: repository-owned Wood/Metal candidates, public derivatives, target JSON, assignment JSON, result JSON, active catalog/review entries, and composite review sheets containing Wood/Metal pixels under `assets/enemies/experiments/affinity-workflow-v1/`, `assets/enemies/experiments/affinity-expansion-v1/`, and `apps/web/static/wiki-media/monsters/`

- [ ] Write a failing filesystem-fixture test with exactly five recursive allowlisted roots: the two legacy experiment roots, `apps/web/static/wiki-media/monsters/`, and the two obsolete enemy forge route roots. Add exact-file allowlists for the remaining UI/wiki files above. Identify Wood/Metal artifacts by parsed affinity plus path/catalog references, refuse every path outside those allowlists, and report dangling references after deletion.

- [ ] Implement `--check` and `--write` modes. `--write` deletes only the resolved Wood/Metal owned paths, deletes composite contact sheets that embed those pixels, and rewrites aggregate JSON to remove their entries. It must not emit a ledger, archive, replacement hash file, or legacy folder.

- [ ] Update the monster wiki exporter, public matrix component, e2e assertions, monster gallery, visual-system page, and monster-family README to expose only the five current affinities and remove all “legacy visual studies” language. Delete the two obsolete six-affinity enemy forge route trees; the new review exporter in Task 8 supersedes them. Keep candidate status explicit. Do not alter unrelated gameplay material names or historical source notes merely because they contain the English words “wood” or “metal.”

- [ ] Remove obsolete six-affinity materialization checks from the root `check` chain and replace them with the new family-production check. Leave historical TypeScript contracts/source factories unchanged and unexported by the active pipeline.

- [ ] Preview the exact destructive scope before writing.

```bash
pnpm tsx tools/retire-legacy-enemy-affinities.ts --check
git status --short
```

The preview must be limited to parsed Wood/Metal artifacts, the eighty public derivatives, contaminated composite sheets, and the exact active reference allowlist; if any resolved path escapes those allowlists, stop.

- [ ] Apply deletion, regenerate the wiki, and prove no active legacy references remain.

```bash
pnpm tsx tools/retire-legacy-enemy-affinities.ts --write
pnpm export:wiki-monsters
pnpm vitest run tools/retire-legacy-enemy-affinities-lib.spec.ts tools/wiki-monster-database-lib.spec.ts
rg -n -i '"affinity": "(wood|metal)"|/(wood|metal)(-v[0-9]+)?\.(json|png|webp)|legacy visual stud' assets/enemies/experiments apps/web/static/wiki-media/monsters apps/web/src/lib/components/wiki apps/web/src/routes/wiki apps/web/src/routes/forge/enemies docs/wiki/creatures/monsters docs/wiki/creatures/monster-races/README.md docs/wiki/art/monster-gallery.md docs/wiki/systems/visuals.md
pnpm validate:wiki-monsters
pnpm validate:wiki
pnpm --filter @summonlab/web test
```

The `rg` command must return no active target, artifact, or wiki-reference match. Descriptive historical source prose outside the searched production/wiki scope is not changed.

- [ ] Commit the deletions and active-pipeline changes, then push.

```bash
git add -A assets/enemies/experiments/affinity-workflow-v1 assets/enemies/experiments/affinity-expansion-v1 apps/web/static/wiki-media/monsters apps/web/src/lib/components/wiki/MonsterVisualMatrix.svelte apps/web/src/routes/wiki/monster-database.e2e.ts apps/web/src/routes/forge/enemies/affinity-workflow apps/web/src/routes/forge/enemies/affinity-expansion apps/web/src/lib/server/wiki.spec.ts docs/wiki/creatures/monsters docs/wiki/creatures/monster-races/README.md docs/wiki/art/monster-gallery.md docs/wiki/systems/visuals.md tools/retire-legacy-enemy-affinities-lib.ts tools/retire-legacy-enemy-affinities-lib.spec.ts tools/retire-legacy-enemy-affinities.ts tools/wiki-monster-database-lib.ts tools/wiki-monster-database-lib.spec.ts tools/export-wiki-monster-database.ts package.json
git commit -m "chore(enemies): retire wood and metal candidates"
git push
```

## Task 6: Compile the deterministic 750-target manifest

**Files:**

- Modify: `tools/family-affinity-production-lib.ts`
- Modify: `tools/family-affinity-production-lib.spec.ts`
- Create: `tools/export-family-affinity-production.ts`
- Create: `tools/allocate-family-affinity-revision.ts`
- Create generated: `assets/enemies/experiments/family-affinity-v1/manifest.json`
- Create generated: `assets/enemies/experiments/family-affinity-v1/targets/<family>/<form>/<affinity>/target-v1.json`
- Create generated: `assets/enemies/experiments/family-affinity-v1/assignments/<family>/<form>/<affinity>/assignment-v1.json`
- Modify: `package.json`

- [ ] Write failing bundle tests for exactly 750 active canonical-matrix coordinate targets, 750 active canonical assignments, 1,500 unique owned output paths, five affinities per form, twenty-five targets per family, collision-safe versioned files, and `retryCeiling` restricted to `0 | 1`.

- [ ] Implement an experiment-local target schema that carries `familyId`, `formId`, `tier`, `primaryArchetype`, `battlefieldDuty`, identity/anatomy invariants, affinity construction dimensions, telegraph, counterplay, source references, presentation contract, acceptance criteria, and owned output paths. Reuse generic hashing helpers but do not widen shared contract enums.

- [ ] Compile one target and assignment for every coordinate. Use paths shaped as:

```text
assets/enemies/experiments/family-affinity-v1/targets/<family>/<form>/<affinity>/target-v1.json
assets/enemies/experiments/family-affinity-v1/assignments/<family>/<form>/<affinity>/assignment-v1.json
assets/enemies/experiments/family-affinity-v1/candidates/<family>/<form>/<affinity>-v1.png
assets/enemies/experiments/family-affinity-v1/results/<family>/<form>/<affinity>-v1.json
```

- [ ] Implement controller-only revision allocation for both canonical family/form coordinates and bridge-only current-class/Earth coordinates. Given a rejected `vN` receipt, `allocate-family-affinity-revision.ts` exclusively creates the coordinate's `target-vN+1.json` and `assignment-vN+1.json`, assigns new `-vN+1` candidate/result paths, links the preceding attempt, and updates the appropriate canonical or bridge manifest's active version. It must refuse allocation while any proposed path exists; no target, assignment, candidate, result, decision, or blind-review receipt is overwritten.

- [ ] Require one approved Normal identity reference for ordinary elemental dispatch. Before Normal approval, elemental targets remain `blocked-on-anchor`. The sole exception is an `earth-bridge-provisional` assignment from Task 10 with a hash-bound mapped Normal candidate; its Earth result remains candidate-only and cannot reach approved-review until the canonical Normal anchor passes.

- [ ] Add `export:family-affinity-production` and `check:family-affinity-production` scripts. Generated JSON must be stable under a second export.

```bash
pnpm export:family-affinity-production
family_snapshot=$(mktemp)
find assets/enemies/experiments/family-affinity-v1/manifest.json assets/enemies/experiments/family-affinity-v1/targets assets/enemies/experiments/family-affinity-v1/assignments -type f -print0 | sort -z | xargs -0 sha256sum > "$family_snapshot"
pnpm export:family-affinity-production
find assets/enemies/experiments/family-affinity-v1/manifest.json assets/enemies/experiments/family-affinity-v1/targets assets/enemies/experiments/family-affinity-v1/assignments -type f -print0 | sort -z | xargs -0 sha256sum | diff -u "$family_snapshot" -
pnpm check:family-affinity-production
pnpm test:family-affinity-production
```

- [ ] Commit and push.

```bash
git add package.json tools/family-affinity-production-lib.ts tools/family-affinity-production-lib.spec.ts tools/export-family-affinity-production.ts tools/allocate-family-affinity-revision.ts assets/enemies/experiments/family-affinity-v1
git commit -m "feat(enemies): materialize family affinity targets"
git push
```

## Task 7: Export the canonical family/form wiki

**Files:**

- Modify: `tools/wiki-monster-database-lib.ts`
- Modify: `tools/wiki-monster-database-lib.spec.ts`
- Modify: `tools/export-wiki-monster-database.ts`
- Modify: `docs/wiki/creatures/monster-races/README.md`
- Modify generated: `docs/wiki/creatures/monsters/README.md`
- Modify generated: `docs/wiki/creatures/monsters/visual-index.json`
- Create generated: `docs/wiki/creatures/monsters/<form-id>.md` for 150 forms
- Delete generated: obsolete current-class pages not retained as canonical form IDs

- [ ] Write failing exporter tests for thirty family sections, 150 unique form pages, five tiers per family, five production affinity coordinates per page, exact reconciliation links for the forty old IDs, and zero candidate-as-approved wording.

- [ ] Change the exporter source from the old forty-class visual index to the validated family packets plus current-class mapping. Family pages must explain T1–T5 escalation, archetypes, teaching goals, telegraphs, and counterplay. Form pages must show the five-coordinate visual matrix and status for each coordinate.

- [ ] Add a “Current class reconciliation” section that shows each old ID and its disposition without treating secondary archetypes/fauna as missing canonical forms.

- [ ] Regenerate and validate.

```bash
pnpm export:wiki-monsters
pnpm validate:wiki-monsters
pnpm validate:wiki
pnpm vitest run tools/wiki-monster-database-lib.spec.ts
```

- [ ] Commit and push.

```bash
git add -A docs/wiki/creatures/monster-races docs/wiki/creatures/monsters tools/wiki-monster-database-lib.ts tools/wiki-monster-database-lib.spec.ts tools/export-wiki-monster-database.ts
git commit -m "docs(enemies): publish canonical family database"
git push
```

## Task 8: Build review state, family contact sheets, and promotion gates

**Files:**

- Create: `tools/family-affinity-review-lib.ts`
- Create: `tools/family-affinity-review-lib.spec.ts`
- Create: `tools/export-family-affinity-review.ts`
- Create generated: `assets/enemies/experiments/family-affinity-v1/review/catalog.json`
- Create generated: `assets/enemies/experiments/family-affinity-v1/review/families/<family>/contact-sheet.png`
- Create generated: `assets/enemies/experiments/family-affinity-v1/review/families/<family>/summary.json`
- Create reviewer-owned: `assets/enemies/experiments/family-affinity-v1/review/decisions/<family>/<form>/<affinity>/candidate-vN-review-vN.json`
- Create blind-reviewer-owned: `assets/enemies/experiments/family-affinity-v1/review/blind/<family>/<form>/<affinity>/candidate-vN-blind-vN.json` for T3/T5
- Modify: `package.json`

- [ ] Write failing tests for legal transitions only: `planned → candidate → approved-review`; reject `planned → approved-review`, producer self-approval, missing result receipts, hash mismatches, and every transition to `runtime` inside this experiment.

- [ ] Implement deterministic review catalogs and 5×5 per-family contact sheets: rows T1–T5, columns Normal/Fire/Earth/Wind/Water. Empty coordinates render an explicit `NOT GENERATED` tile rather than disappearing.

- [ ] Implement immutable review-decision and blind-review receipt schemas. A reviewer receives one candidate coordinate/version and owns only one exclusive-create receipt path; it never edits catalogs, summaries, contact sheets, target files, or producer results. Receipts require reviewer identity distinct from the producer, decision version, candidate/result hashes, and rubric fields for identity, tier, archetype, anatomy, affinity, counterplay, framing, finish, source hash, and prompt hash. Every T3/T5 candidate version requires a separate blind-review receipt before approval.

- [ ] Make the controller exporter aggregate only valid immutable receipts. A rejected/revise decision keeps the coordinate non-approved and triggers Task 6's controller-only revision allocator; an approval is effective only when the ordinary decision and any required blind receipt agree on the same candidate version and hashes.

- [ ] Add `export:family-affinity-review` and `check:family-affinity-review` scripts.

```bash
pnpm export:family-affinity-review
pnpm check:family-affinity-review
pnpm vitest run tools/family-affinity-review-lib.spec.ts
```

- [ ] Commit and push.

```bash
git add package.json tools/family-affinity-review-lib.ts tools/family-affinity-review-lib.spec.ts tools/export-family-affinity-review.ts assets/enemies/experiments/family-affinity-v1/review
git commit -m "feat(enemies): add family affinity review gates"
git push
```

## Task 9: Satisfy the image-production skill compatibility gate

**Files:**

- Create: `assets/enemies/experiments/family-affinity-v1/production-compatibility.json`
- Modify: no skill, shared contract, engine, or runtime-catalog file in this repository

The currently available `summonlab-image-production` contract predates Earth, the family/form IDs,
the new experiment root, and versioned target/assignment paths. Pixel production must not begin by
silently assuming compatibility.

- [ ] Ask the root orchestrator for a compatible, versioned production-skill contract. The request must name `image-production-family-target-v1`, the five affinity IDs, `family-affinity-v1`, target/assignment/candidate/result vN paths, exclusive-create semantics, retry ceiling `0 | 1`, and immutable result-receipt expectations. The user owns skill changes; this plan does not edit the skill.

- [ ] Record the returned compatibility receipt in `production-compatibility.json` with skill version, supported schema, supported experiment root, supported affinities, permitted path templates, reviewed-at timestamp, and root-orchestrator approval reference.

- [ ] Add a failing preflight test that rejects absent/mismatched compatibility, unsupported Earth, a non-versioned output template, a retry ceiling above one, or a skill version different from the receipt.

```bash
pnpm check:family-affinity-production
pnpm test:family-affinity-production
```

- [ ] Stop only the pixel-production phases if compatibility is unavailable. Tasks 1–8 remain valid and reviewable, but Tasks 10–13 must not dispatch an image agent until this gate passes.

- [ ] Commit and push the compatibility receipt and preflight test after approval.

```bash
git add assets/enemies/experiments/family-affinity-v1/production-compatibility.json tools/family-affinity-production-lib.ts tools/family-affinity-production-lib.spec.ts
git commit -m "chore(enemies): authorize family image production"
git push
```

## Task 10: Execute the Earth bridge wave for retained current classes

**Files:**

- Create generated: `assets/enemies/experiments/family-affinity-v1/waves/earth-bridge-v1.json`
- Create generated for retained non-primary classes: `assets/enemies/experiments/family-affinity-v1/bridge/targets/<current-class>/earth/target-v1.json`
- Create generated for retained non-primary classes: `assets/enemies/experiments/family-affinity-v1/bridge/assignments/<current-class>/earth/assignment-v1.json`
- Create per retained non-primary class: `assets/enemies/experiments/family-affinity-v1/bridge/candidates/<current-class>/earth-vN.png`
- Create per retained non-primary class: `assets/enemies/experiments/family-affinity-v1/bridge/results/<current-class>/earth-vN.json`
- Create per target: Earth candidate PNG and result receipt at versioned manifest/bridge-owned paths
- Create per review: immutable decision receipt; T3/T5 canonical coordinates also require a blind receipt
- Modify generated: review catalog/contact sheets only through the controller exporter

- [ ] Materialize the bridge wave from `current-class-mapping.json`. Include every retained `map`, `rename-map`, `secondary-archetype`, and `fauna` identity; exclude only `retire`. `map`/`rename-map` records use canonical 750-matrix coordinates. Retained `secondary-archetype`/`fauna` records use bridge-only targets outside the 750 matrix. Assert `0 < targetCount <= 40`, unique current-class IDs, and no duplicate canonical coordinate.

- [ ] Bind each bridge assignment to the mapped existing Normal candidate hash. Mark that reference and its Earth output `earth-bridge-provisional`; allow production before the complete Normal-anchor gate, but forbid approved-review until the corresponding canonical Normal anchor passes. Bridge-only secondary/fauna remain candidate evidence unless separately admitted to the canonical roster.

- [ ] Dispatch one subagent per Earth target using `summonlab-image-production`. Each agent reads exactly one target JSON and matching assignment JSON, may make at most the assignment's bounded retry count, and writes only its candidate/result paths.

- [ ] After each bounded concurrency batch, run result/hash validation before dispatching the next batch. The controller alone refreshes aggregate review evidence.

```bash
pnpm check:family-affinity-production
pnpm export:family-affinity-review
pnpm check:family-affinity-review
```

- [ ] Have independent reviewers inspect Earth construction against the approved theme: compressed mineral mass/sediment/load-bearing stone or crystal/rooted weight, plus visible fracture/binding/load-bearing counterplay. Reject brown recolors, pasted rocks, foliage substitution, and anatomy-obscuring mass.

- [ ] Reviewers write only their versioned decision/blind receipts. The controller runs the exporter; it may reuse an accepted mapped-primary Earth candidate later in the 750 matrix, but it may not count provisional or bridge-only evidence as approved-review.

- [ ] Commit and push the bridge candidates/results/review evidence as one or more bounded batches with subject `feat(enemies): add earth bridge candidates batch N`.

## Task 11: Resolve all 150 Normal identity anchors

**Files:**

- Modify per target: Normal candidate/result coordinates where generation is required
- Modify generated: `assets/enemies/experiments/family-affinity-v1/review/catalog.json`
- Modify generated: per-family contact sheets and summaries

- [ ] For each canonical form, evaluate mapped existing Normal art against exact family, form, duty, anatomy, framing, and counterplay. Reuse it only by copying into the new collision-safe candidate path and writing a provenance-preserving result receipt; never point the new manifest at an old shared path.

- [ ] Dispatch one manifest-bound producer per missing/rejected Normal coordinate. Normal prompts must use species-native construction and explicitly forbid elemental material, glow, anatomy, and wake.

- [ ] Review in family units so T1–T5 continuity and tier distinction are visible together. Reviewers write immutable decision receipts, plus blind receipts for T3/T5. Require independent review before changing any Normal coordinate to `approved-review`.

- [ ] Re-evaluate provisional mapped-primary Earth bridge candidates after each corresponding Normal approval. Valid Earth candidates may now receive immutable approval receipts and enter the 750 matrix; rejected ones allocate v2+ work. Bridge-only secondary/fauna do not enter the canonical matrix.

- [ ] Run the anchor gate. It must report `normalTargets=150`, `normalCandidates=150`, `normalApprovedReview=150`, and `elementalDispatchUnblocked=600` before Task 12.

```bash
pnpm check:family-affinity-production
pnpm export:family-affinity-review
pnpm check:family-affinity-review
```

- [ ] Commit and push bounded family batches with subject `feat(enemies): add normal family anchors batch N`.

## Task 12: Run the five-family full-matrix pilot

**Files:**

- Modify per target: missing Fire/Earth/Wind/Water candidate/result coordinates for families 01–05
- Modify generated: review catalog, five family summaries, and five contact sheets

- [ ] Select source families 01–05 (Goblins, Orcs, Giants, Trolls, Dragons), yielding 125 total matrix coordinates. Subtract already accepted Normal/Earth coordinates; dispatch only missing candidate work.

- [ ] Use one subagent per target with `summonlab-image-production`, bounded concurrency, collision-safe paths, no shared-file edits, and no self-promotion.

- [ ] Review each 25-image family sheet for within-family continuity and each affinity column for construction consistency. Reuse already-valid, hash-matching Normal/Earth decision and blind receipts from Tasks 10–11. Reviewers write new immutable decision/blind receipts only for active candidate versions that do not already have valid receipts; the completed pilot must contain fifty valid T3/T5 blind receipts in total.

- [ ] The pilot gate requires: all 125 coordinates have valid candidate/result pairs; all five families pass identity continuity; all fifty T3/T5 affinity images pass blind role/tier recognition; zero affinity is only a color wash; zero candidate is marked runtime.

- [ ] Commit and push each family separately so visual feedback can revert one family without disturbing another. Use subject `feat(enemies): complete <family> affinity candidates`.

## Task 13: Produce the remaining twenty-five family matrices

**Files:**

- Modify per target: missing candidate/result coordinates for families 06–30
- Modify generated: review catalog, family summaries, and contact sheets

Run five collision-safe family waves. A family reviewer must close each wave before the next one begins.

| Wave | Families | Full matrix coordinates |
| --- | --- | ---: |
| 1 | Skeletons, Rotwalkers, Wraiths, Vampires, Mummies | 125 |
| 2 | Demons, Celestials, Harpies, Minotaurs, Nagas | 125 |
| 3 | Lizardfolk, Insectoids, Arachnids, Slimes, Golems | 125 |
| 4 | Elementals, Treants, Fungalfolk, Deep Ones, Werebeasts | 125 |
| 5 | Gargoyles, Djinn, Fae, Void Horrors, Doppelgangers | 125 |

- [ ] For each wave, compute missing coordinates from validated review state; do not regenerate accepted candidates merely to fill a dispatch quota.

- [ ] Dispatch one manifest-bound image target per producer subagent. Run automated receipt/hash/framing checks after every bounded concurrency batch.

- [ ] Dispatch separate family reviewers after producers finish. Reviewers write only coordinate/version-owned immutable decision receipts and required T3/T5 blind receipts; the controller alone exports family summaries and aggregates.

- [ ] Require complete 25-coordinate family sheets, one immutable decision receipt per active candidate, blind receipts for every T3/T5 affinity image, identity continuity, affinity construction, counterplay visibility, and no candidate/runtime conflation.

- [ ] Commit and push each completed family or five-family wave as a reviewable batch. Do not combine unrelated fixes from other visual domains.

## Task 14: Finalize the 750-target evidence and wiki

**Files:**

- Modify generated: `assets/enemies/experiments/family-affinity-v1/manifest.json`
- Modify generated: `assets/enemies/experiments/family-affinity-v1/review/catalog.json`
- Modify generated: all thirty contact sheets and summaries
- Modify generated: `docs/wiki/creatures/monsters/visual-index.json`
- Modify generated: 150 form pages and thirty family sections
- Create: `assets/enemies/experiments/family-affinity-v1/review/final-readiness.json`

- [ ] Add a failing final-readiness test requiring 30 families, 150 forms, exactly 750 active canonical-matrix targets/assignments, 750 active canonical candidate/result pairs at `approved-review`, 750 matching immutable approval receipts, 300 matching blind-review receipts for all T3/T5 affinity images, 30 contact sheets, 150 Normal plus 600 elemental coordinates, exact current-40 reconciliation, a separately reported bridge-only target/assignment count equal to the retained `secondary-archetype`/`fauna` mapping count, zero Wood/Metal active records, and zero runtime statuses. Bridge-only records never enter the 750 tally. Historical rejected v1/v2 attempts may increase the on-disk attempt count but never the active-coordinate count.

- [ ] Export final review evidence and wiki from validated sources only.

```bash
pnpm export:family-affinity-production
pnpm export:family-affinity-review
pnpm export:wiki-monsters
pnpm check:family-affinity-production
pnpm check:family-affinity-review
pnpm validate:wiki-monsters
pnpm validate:wiki
pnpm validate:visual-assets
pnpm typecheck
pnpm test
```

- [ ] Scan for placeholders, obsolete affinity references, broken candidate paths, and status leakage.

```bash
rg -n 'TBD|TODO|implement later' assets/enemies/experiments/family-affinity-v1 docs/wiki/creatures/monsters
rg -n -i '"affinity": "(wood|metal)"|/(wood|metal)(-v[0-9]+)?\.(json|png|webp)|legacy visual stud' assets/enemies/experiments apps/web/static/wiki-media/monsters apps/web/src/lib/components/wiki apps/web/src/routes/wiki apps/web/src/routes/forge/enemies docs/wiki/creatures/monsters docs/wiki/creatures/monster-races/README.md docs/wiki/art/monster-gallery.md docs/wiki/systems/visuals.md
rg -n '"status": "runtime"|Runtime status: \*\*approved' assets/enemies/experiments/family-affinity-v1 docs/wiki/creatures/monsters
git diff --check
```

- [ ] Ask an independent final reviewer to audit the spec against the manifest, mapping, review evidence, and generated wiki. Resolve every blocking finding and rerun the complete validation suite.

- [ ] Commit and push the final evidence batch.

```bash
git add assets/enemies/experiments/family-affinity-v1 docs/wiki/creatures/monsters docs/wiki/creatures/monster-races package.json tools
git commit -m "docs(enemies): finalize family affinity production evidence"
git push
git status --short --branch
```

## Task 15: Request runtime integration separately

No runtime mutation is authorized by this plan.

- [ ] Prepare an integration request naming only owner-approved image coordinates, exact source hashes, proposed runtime destinations, catalog keys, fallback behavior, and rollback steps.

- [ ] Send the request to the root orchestrator before touching a shared runtime catalog or engine contract.

- [ ] If approval is deferred, leave all images in `approved-review`; the completed wiki and evidence remain valid without runtime promotion.

## Execution checkpoints

1. **Roster checkpoint:** Tasks 1–4 complete; owner reviews thirty families, 150 forms, and forty dispositions.
2. **Retirement checkpoint:** Task 5 complete; Wood/Metal artifacts are gone with no ledger and no dangling active reference.
3. **Manifest checkpoint:** Tasks 6–8 complete; 750 immutable active targets exist and the review system cannot self-promote.
4. **Compatibility checkpoint:** Task 9 complete; the root orchestrator has approved a skill contract that supports Earth and the new versioned experiment.
5. **Earth checkpoint:** Task 10 complete; owner confirms the Earth construction language before scale production.
6. **Anchor checkpoint:** Task 11 complete; all 150 Normal identities are approved-review anchors.
7. **Pilot checkpoint:** Task 12 complete; owner judges five complete family matrices before the remaining 625-coordinate matrix scope proceeds.
8. **Production checkpoint:** Tasks 13–14 complete; all 750 coordinates are approved-review and the wiki is synchronized.
9. **Integration checkpoint:** Task 15 is an explicit request, not an automatic catalog mutation.
