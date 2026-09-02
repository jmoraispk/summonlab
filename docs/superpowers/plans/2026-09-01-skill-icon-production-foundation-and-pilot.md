# Skill Icon Production Foundation and Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the manifest-bound skill-icon production pipeline, create the seven standalone rarity frames and universal backing, and prove the workflow with fifteen individually generated skill masters across Martial, Magical, and Craft.

**Architecture:** Canonical skill metadata remains authored in the wiki skill tables; a generated icon catalog joins that metadata to the accepted motif map and icon-owned visual specifications. Image generation writes only collision-safe candidate files and structured results, while deterministic Sharp tooling validates geometry and alpha, promotes approved masters, composes runtime derivatives, and produces review evidence. A Forge route consumes the generated catalog and derived assets without importing source PNGs into the initial application bundle.

**Tech Stack:** TypeScript 6, Zod 4, Sharp 0.35, Vitest 4, Svelte 5/SvelteKit 2, Playwright, Markdown/JSON manifests, built-in image generation through a dedicated repository skill

**Spec:** `docs/superpowers/specs/2026-09-01-skill-icon-production-system-design.md`

## Global Constraints

- The current canonical catalog contains exactly 456 unique skills: 258 Martial, 124 Magical, and 74 Craft.
- Every skill has exactly one motif-family assignment and at most one primary visual parent.
- Mechanical prerequisites remain separate from visual inheritance.
- Artwork is Painted Emblem: one dominant subject, at most one supporting cue, semantic color, no frame, text, rarity cue, type badge, or narrative scenery.
- All standalone masters use a `1024×1024` RGBA canvas with shared registration.
- The dominant subject remains inside the central 64% safe zone; supporting effects may extend to 72%.
- Runtime derivatives are `512×512`, `256×256`, and `128×128`; recognition review also uses `96×96`.
- Runtime composition order is charcoal backing, skill artwork, rarity frame, then interface-rendered name and `MASTERY · LV N` text.
- The approved F–S ladder remains weathered iron, aged bronze, tempered blue steel, moonlit silver, blackened amethyst, champagne electrum, and ceremonial antique gold.
- Calibration plates are reference evidence only and are never cropped into production assets.
- Individual skill masters are generated independently at the same size.
- Generated jobs may write only their declared candidate and result paths; only the coordinator may update shared catalogs, approvals, or runtime exports.
- The 456-of-456 completion gate remains disabled until the fifteen-skill pilot receives owner approval.

## Scope boundary

This plan deliberately ends at the accepted three-domain pilot and a machine-generated queue for the remaining 441 skills. That boundary implements the rollout gate in the accepted specification: the visual grammar must survive isolated high-resolution production before bulk generation begins. After pilot acceptance, write a separate catalog-rollout plan using the approved prompts, measured revision rate, and final wave size; do not guess those values in advance.

## File responsibility map

| Path | Responsibility |
| --- | --- |
| `packages/contracts/src/skill-icon-production.ts` | Versioned schemas for geometry, catalog records, generation targets/results, assets, and reviews |
| `tools/skill-icon-production-lib.ts` | Canonical row loading, motif parsing, catalog joining, graph validation, path construction, and readiness summaries |
| `tools/export-skill-icon-production.ts` | Deterministic `--write`/`--check` exporter for geometry guides, machine motif map, catalog, targets, and JSON schemas |
| `tools/validate-skill-icon-assets.ts` | Sharp-based dimensions, alpha, safe-zone, registration, hash, and derivative validation |
| `tools/persist-skill-icon-output.ts` | Collision-safe persistence and structured receipt generation for one image job |
| `tools/compose-skill-icon-assets.ts` | Backing/art/frame composition, runtime derivatives, recognition thumbnails, and contact sheets |
| `tools/report-skill-icon-readiness.ts` | Exact coverage and lifecycle gate report for all 456 skills |
| `tools/tsconfig.skill-icon-production.json` | Focused type-check boundary for the pipeline |
| `assets/wiki/skills/icon-production-v1/geometry.json` | One shared 1024-pixel registration contract |
| `assets/wiki/skills/icon-production-v1/motif-map.json` | Generated 456-skill visual lineage projection |
| `assets/wiki/skills/icon-production-v1/visual-specs.json` | Icon-owned subject, cue, palette, composition, exclusions, and lifecycle state |
| `assets/wiki/skills/icon-production-v1/catalog.json` | Generated canonical join used by validation, Forge, and runtime export |
| `assets/wiki/skills/icon-production-v1/targets/` | Immutable one-image production target and assignment packets |
| `assets/wiki/skills/icon-production-v1/candidates/` | Unapproved generated images with collision-safe versioned filenames |
| `assets/wiki/skills/icon-production-v1/masters/` | Coordinator-promoted transparent reference and artwork masters |
| `assets/wiki/skills/icon-production-v1/review/` | Contact sheets, human decisions, and readiness evidence |
| `apps/web/static/skill-icons/v1/` | Generated web derivatives and a small public runtime manifest |
| `skills/summonlab-skill-icon-production/` | One-target/one-image Codex production skill and verifier |
| `apps/web/src/lib/components/skills/SkillHex.svelte` | Reusable hexagon plus two-row interface text component |
| `apps/web/src/routes/forge/skills/` | Developer review page for full-size, composed, and 96-pixel views |

---

### Task 1: Define the versioned skill-icon contracts

**Files:**

- Create: `packages/contracts/src/skill-icon-production.ts`
- Create: `packages/contracts/src/skill-icon-production.spec.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Produces `SkillIconGeometrySchema`, `SkillIconVisualSpecSchema`, `SkillIconRecordSchema`, `SkillIconCatalogSchema`, `SkillIconTargetSchema`, `SkillIconAssignmentSchema`, `SkillIconResultSchema`, and `SkillIconReviewSchema`.
- Produces inferred types with the same names minus the `Schema` suffix.
- Lifecycle states are exactly `mapped`, `authored`, `candidate`, and `approved`.
- Production targets use a slugged `jobId`; `skillTargetId` is required only for `skill-art`,
  `motifFamily` is required only for `calibration-plate`, and both are null for frames/backing.

- [ ] **Step 1: Write failing schema tests**

Create fixtures that prove the staged lifecycle and reject silent incompleteness:

```ts
expect(SkillIconRecordSchema.parse(mappedRecord)).toMatchObject({
	status: 'mapped',
	visualSpec: null,
	assets: null
});

expect(
	SkillIconRecordSchema.safeParse({
		...mappedRecord,
		status: 'authored',
		visualSpec: null
	}).success
).toBe(false);

expect(
	SkillIconRecordSchema.safeParse({
		...approvedRecord,
		assets: { ...approvedRecord.assets, runtime128: undefined }
	}).success
).toBe(false);
```

Also prove that rarity accepts only `F`, `E`, `D`, `C`, `B`, `A`, or `S`; `mastery`
accepts only `Novice`, `Intermediate`, `Expert`, or `Master`; asset paths are
repository-relative POSIX paths; hashes are lowercase SHA-256; a standalone record has
`motifFamily: null` and `primaryVisualParent: null`; every target owns one candidate plus one result
path; and role-specific `skillTargetId`/`motifFamily` rules are enforced.

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
pnpm exec vitest run packages/contracts/src/skill-icon-production.spec.ts
```

Expected: FAIL because the skill-icon schemas are not exported.

- [ ] **Step 3: Implement the strict schemas**

Use discriminated lifecycle records so invalid partial states cannot parse:

```ts
export const SkillIconVisualSpecSchema = z
	.object({
		dominantSubject: z.string().trim().min(3).max(300),
		supportingCue: z.string().trim().min(3).max(200).nullable(),
		semanticPalette: z.array(z.string().trim().min(2).max(80)).min(1).max(5),
		composition: z.string().trim().min(3).max(500),
		exclusions: z.array(z.string().trim().min(3).max(200)).min(1).max(12)
	})
	.strict();

export const SkillIconLifecycleSchema = z.enum(['mapped', 'authored', 'candidate', 'approved']);
export const SkillIconRaritySchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']);
export const SkillMasterySchema = z.enum(['Novice', 'Intermediate', 'Expert', 'Master']);
```

Define a strict `SkillIconRecordSchema` union with common canonical fields plus these state rules:

| State | Visual spec | Candidate | Approved master | Derivatives | Human review |
| --- | --- | --- | --- | --- | --- |
| `mapped` | null | absent | absent | absent | absent |
| `authored` | required | absent | absent | absent | absent |
| `candidate` | required | required | absent | absent | producer findings only |
| `approved` | required | required | required | 512/256/128 and 96 required | accepted owner decision required |

Add `schemaVersion` literals ending in `-v1` to every top-level contract. Export all schemas and inferred types through `packages/contracts/src/index.ts`.

- [ ] **Step 4: Run focused and package tests**

Run:

```bash
pnpm exec vitest run packages/contracts/src/skill-icon-production.spec.ts
pnpm --filter @summonlab/contracts typecheck
pnpm --filter @summonlab/contracts test
```

Expected: PASS.

- [ ] **Step 5: Commit the contract boundary**

```bash
git add packages/contracts/src/skill-icon-production.ts packages/contracts/src/skill-icon-production.spec.ts packages/contracts/src/index.ts
git commit -m "feat(skills): define icon production contracts"
```

---

### Task 2: Freeze shared geometry and export visual guides

**Files:**

- Create: `assets/wiki/skills/icon-production-v1/geometry.json`
- Create: `tools/export-skill-icon-geometry.ts`
- Create: `tools/export-skill-icon-geometry.spec.ts`
- Create: `assets/wiki/skills/icon-production-v1/references/geometry-guide.svg` (generated)
- Create: `assets/wiki/skills/icon-production-v1/references/geometry-guide.png` (generated)

**Interfaces:**

- Consumes `SkillIconGeometrySchema` from Task 1.
- Produces `loadSkillIconGeometry(root?: string): Promise<SkillIconGeometry>` and `renderSkillIconGeometryGuide(geometry): Promise<Buffer>`.
- Later validators consume percentages from JSON and derive integer pixel masks; no task duplicates geometry constants.

- [ ] **Step 1: Write the failing geometry test**

```ts
expect(geometry).toMatchObject({
	schemaVersion: 'skill-icon-geometry-v1',
	canvas: { width: 1024, height: 1024 },
	center: { x: 512, y: 512 },
	subjectSafePercent: 64,
	effectSafePercent: 72,
	runtimeSizes: [512, 256, 128],
	recognitionSize: 96
});
expect(await sharp(guide).metadata()).toMatchObject({ width: 1024, height: 1024 });
```

The test must also assert a six-point, point-up hexagonal aperture; a top-center rarity-medallion exclusion polygon; and that every aperture/exclusion coordinate lies inside the canvas.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec vitest run tools/export-skill-icon-geometry.spec.ts
```

Expected: FAIL because the geometry and exporter do not exist.

- [ ] **Step 3: Author the single geometry manifest**

Use percentages for safe zones and explicit normalized points for generated guides:

```json
{
	"schemaVersion": "skill-icon-geometry-v1",
	"canvas": { "width": 1024, "height": 1024 },
	"center": { "x": 512, "y": 512 },
	"aperturePoints": [
		[0.5, 0.078125],
		[0.8828125, 0.296875],
		[0.8828125, 0.703125],
		[0.5, 0.921875],
		[0.1171875, 0.703125],
		[0.1171875, 0.296875]
	],
	"subjectSafePercent": 64,
	"effectSafePercent": 72,
	"rarityMedallionExclusion": [
		[0.41015625, 0],
		[0.58984375, 0],
		[0.58984375, 0.21484375],
		[0.41015625, 0.21484375]
	],
	"runtimeSizes": [512, 256, 128],
	"recognitionSize": 96
}
```

Render an SVG and PNG containing the aperture, 64% subject guide, 72% effect guide, center crosshair, and medallion exclusion. Both outputs are generated evidence, not runtime layers.

- [ ] **Step 4: Export and verify determinism**

Run:

```bash
pnpm exec tsx tools/export-skill-icon-geometry.ts --write
pnpm exec tsx tools/export-skill-icon-geometry.ts --check
pnpm exec vitest run tools/export-skill-icon-geometry.spec.ts
```

Expected: PASS; `--check` reports both guides current.

- [ ] **Step 5: Commit geometry**

```bash
git add assets/wiki/skills/icon-production-v1/geometry.json assets/wiki/skills/icon-production-v1/references/geometry-guide.svg assets/wiki/skills/icon-production-v1/references/geometry-guide.png tools/export-skill-icon-geometry.ts tools/export-skill-icon-geometry.spec.ts
git commit -m "feat(skills): freeze icon geometry"
```

---

### Task 3: Materialize the accepted 456-skill motif catalog

**Files:**

- Create: `tools/skill-icon-production-lib.ts`
- Create: `tools/skill-icon-production-lib.spec.ts`
- Create: `tools/export-skill-icon-production.ts`
- Create: `tools/report-skill-icon-readiness.ts`
- Create: `tools/report-skill-icon-readiness.spec.ts`
- Create: `tools/tsconfig.skill-icon-production.json`
- Create: `assets/wiki/skills/icon-production-v1/motif-map.json` (generated)
- Create: `assets/wiki/skills/icon-production-v1/visual-specs.json`
- Create: `assets/wiki/skills/icon-production-v1/catalog.json` (generated)
- Modify: `package.json`

**Interfaces:**

- Produces `loadCanonicalSkillRows()`, `parseAcceptedMotifMap(markdown, rows)`, `validateVisualLineage(rows)`, `buildSkillIconCatalog(rows, lineage, visualSpecs)`, and `summarizeSkillIconCatalog(catalog)`.
- Produces `buildSkillIconReadinessReport(catalog, evidence)` and the states `foundation-incomplete`, `pilot-incomplete`, `eligible-for-owner-activation`, `bulk-active`, and `complete`.
- `visual-specs.json` owns only icon-specific fields and lifecycle state; canonical name/domain/family/labels/rarity/type/requires/effect are rejoined from Markdown every export.
- The generated map carries 124 review-map entries: 104 multi-skill calibration families, 20 standalones, and a longest lineage of 12.

- [ ] **Step 1: Add failing coverage and graph tests**

```ts
expect(summary).toEqual({
	canonical: 456,
	mapped: 456,
	missing: [],
	duplicates: [],
	mapEntries: 124,
	calibrationFamilies: 104,
	standalones: 20,
	longestLineage: 12
});
expect(() => validateVisualLineage(cycleFixture)).toThrow(/visual parent cycle/u);
expect(() => validateVisualLineage(crossFamilyParentFixture)).toThrow(/outside motif family/u);
expect(() => buildSkillIconCatalog(rows, lineageWithoutEmber, specs)).toThrow(/magical:elemental:ember/u);
expect(buildSkillIconReadinessReport(mappedCatalog, noEvidence).state).toBe(
	'foundation-incomplete'
);
expect(
	buildSkillIconReadinessReport(fifteenApprovedCatalog, acceptedPilotEvidence)
).toMatchObject({ state: 'eligible-for-owner-activation', approved: 15, remaining: 441 });
```

Also prove the parser ignores prose bolding, accepts only backticked motif IDs in table rows, maps each bold skill sequence in order, and assigns the immediate predecessor as primary visual parent.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm exec vitest run tools/skill-icon-production-lib.spec.ts tools/report-skill-icon-readiness.spec.ts
```

Expected: FAIL because the parser/exporter is absent.

- [ ] **Step 3: Implement the canonical join**

Read the same eight source paths used by `tools/validate-skill-taxonomy.ts`. Parse
`docs/superpowers/specs/2026-09-01-skill-icon-motif-map.md`, require `**Status:** Accepted`, and emit records ordered by canonical domain, family, then source-table row.
For a one-member sequence, retain the table identifier as `mapEntryId` but emit
`motifFamily: null` and `primaryVisualParent: null`; those 20 records bypass calibration.

Seed `visual-specs.json` with one strict `mapped` record per `targetId`:

```json
{
	"schemaVersion": "skill-icon-visual-specs-v1",
	"records": [
		{
			"targetId": "martial:blade:swordsmanship",
			"status": "mapped",
			"visualSpec": null,
			"assets": null,
			"review": null
		}
	]
}
```

The exporter must preserve authored/produced states when canonical metadata changes, reject unknown or duplicate IDs, reject a renamed/deleted skill until the visual record is reconciled, and never write generated timestamps that make `--check` nondeterministic.

Implement the readiness reporter as a pure catalog/evidence summary plus a CLI. It must never infer
human acceptance from a file's presence: reference, calibration, icon, and pilot decisions count
only when their hashes match explicit accepted review records.

- [ ] **Step 4: Add focused package scripts**

Add:

```json
{
	"export:skill-icons": "tsx tools/export-skill-icon-production.ts --write",
	"check:skill-icon-catalog": "tsx tools/export-skill-icon-production.ts --check",
	"report:skill-icons": "tsx tools/report-skill-icon-readiness.ts",
	"typecheck:skill-icons": "tsc -p tools/tsconfig.skill-icon-production.json",
	"test:skill-icons": "vitest run tools/skill-icon-production-lib.spec.ts tools/export-skill-icon-geometry.spec.ts tools/report-skill-icon-readiness.spec.ts"
}
```

Include the skill-icon typecheck and tests in root `typecheck` and `test`; add the complete
`validate:skill-icons` command to root `check` only after Task 11 creates the initial valid asset
state.

- [ ] **Step 5: Export and verify exact catalog coverage**

Run:

```bash
pnpm export:skill-icons
pnpm check:skill-icon-catalog
pnpm validate:skill-taxonomy
pnpm exec vitest run tools/skill-icon-production-lib.spec.ts tools/report-skill-icon-readiness.spec.ts
pnpm typecheck:skill-icons
git diff --exit-code -- assets/wiki/skills/icon-production-v1/motif-map.json assets/wiki/skills/icon-production-v1/catalog.json
```

Expected: 456 canonical records, 456 mapped visual records, no duplicates, no cycles, and no exporter drift.

- [ ] **Step 6: Commit the machine catalog**

```bash
git add package.json tools/skill-icon-production-lib.ts tools/skill-icon-production-lib.spec.ts tools/export-skill-icon-production.ts tools/report-skill-icon-readiness.ts tools/report-skill-icon-readiness.spec.ts tools/tsconfig.skill-icon-production.json assets/wiki/skills/icon-production-v1/motif-map.json assets/wiki/skills/icon-production-v1/visual-specs.json assets/wiki/skills/icon-production-v1/catalog.json
git commit -m "feat(skills): materialize icon production catalog"
```

---

### Task 4: Validate and persist isolated image outputs

**Files:**

- Create: `tools/validate-skill-icon-assets.ts`
- Create: `tools/validate-skill-icon-assets.spec.ts`
- Create: `tools/persist-skill-icon-output.ts`
- Create: `tools/persist-skill-icon-output.spec.ts`
- Create: `tools/promote-skill-icon-output.ts`
- Create: `tools/promote-skill-icon-output.spec.ts`
- Modify: `tools/tsconfig.skill-icon-production.json`
- Modify: `package.json`

**Interfaces:**

- Produces `inspectSkillIconAsset(buffer, role, geometry): Promise<SkillIconAssetInspection>`.
- Produces `persistSkillIconOutput({ sourcePath, candidatePath, expectedRole, geometry }): Promise<SkillIconAssetReceipt>`.
- Produces `promoteSkillIconOutput({ jobId, reviewPath, root }): Promise<SkillIconAssetRecord>`.
- Produces `promoteReviewedSkillIconOutputs({ reviewDirectory, root }): Promise<readonly SkillIconAssetRecord[]>` with all-record preflight before the first write.
- Roles are exactly `rarity-frame`, `backing`, `calibration-plate`, and `skill-art`.

- [ ] **Step 1: Write failing validation tests using generated buffers**

Use Sharp to create fixtures in temporary directories. Assert:

```ts
expect((await inspectSkillIconAsset(validArt, 'skill-art', geometry)).violations).toEqual([]);
expect((await inspectSkillIconAsset(rgbOnly, 'skill-art', geometry)).violations).toContain(
	'skill-art requires a real alpha channel'
);
expect((await inspectSkillIconAsset(oversizedEffect, 'skill-art', geometry)).violations).toContain(
	'visible pixels escape the 72% effect-safe region'
);
expect((await inspectSkillIconAsset(filledFrameAperture, 'rarity-frame', geometry)).violations).toContain(
	'rarity-frame aperture must remain transparent'
);
```

Persistence tests must reject an existing candidate path, a source/candidate hash mismatch, output outside `assets/wiki/skills/icon-production-v1/candidates/`, wrong dimensions, and a media type other than PNG. A success receipt records source identity, retained path, `1024×1024`, bytes, alpha mode, SHA-256, and timestamp supplied by the caller.

Promotion tests must reject a missing review, any decision other than `accepted`, a review/candidate
hash mismatch, an existing master path, and a review that does not name the owner as reviewer. A
success copies the exact candidate bytes, updates only the coordinator-owned visual record, and
preserves candidate/result evidence.
The directory mode must validate every accepted review and every destination before writing any
master, so one bad record cannot leave a half-promoted batch.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm exec vitest run tools/validate-skill-icon-assets.spec.ts tools/persist-skill-icon-output.spec.ts tools/promote-skill-icon-output.spec.ts
```

Expected: FAIL because inspection and persistence are absent.

- [ ] **Step 3: Implement role-specific inspection**

Decode to raw RGBA once. Treat alpha `<= 8` as transparent for bounds checks. Enforce:

- `skill-art`: transparent outside the 72% circular mask, at least 90% of visible pixels inside the 64% subject mask, no visible pixel in the rarity-medallion exclusion;
- `rarity-frame`: transparent outside the aperture envelope and through the central aperture, with visible material intersecting all six edge bands;
- `backing`: transparent outside the aperture, at least 85% aperture coverage, and no frame-like pixels outside it;
- `calibration-plate`: PNG with dimensions recorded by its target and no alpha-safe-zone requirement.

Alpha values `<= 8` are transparent; every value above 8 must remain inside the role's strict
aperture or envelope. Reject degenerate outputs with geometry-relative minimums accepted by the
production design: skill artwork covers at least 1% of the subject-safe disk, while rarity frames
cover at least 3% of the aperture and 4% of every edge band. The percentages preserve thin valid
silhouettes while distinguishing readable continuous material from isolated pixels.

Keep thresholds named and exported so tests and reports use the same values.

- [ ] **Step 4: Implement collision-safe persistence**

The CLI accepts only explicit arguments:

```bash
pnpm persist:skill-icon-output -- \
  --source /absolute/provider/output.png \
  --target assets/wiki/skills/icon-production-v1/targets/icons/martial-blade-horizontal-slash-v1.json \
  --assignment assets/wiki/skills/icon-production-v1/assignments/icons/martial-blade-horizontal-slash-v1.json
```

It validates target/assignment IDs and permitted paths before copying, refuses overwrite, inspects the retained bytes, then writes the owned result JSON. Add `persist:skill-icon-output` to `package.json`.

Implement `promote-skill-icon-output.ts` as the only coordinator path from candidate to master. It
parses `SkillIconReviewSchema`, recomputes the candidate hash, checks an `accepted` owner decision,
copies without overwrite, updates that record's lifecycle/assets/review fields, and regenerates the
catalog. It never deletes rejected evidence.

Also add the focused asset command without yet adding it to root `check`:

```json
{
	"persist:skill-icon-output": "tsx tools/persist-skill-icon-output.ts",
	"promote:skill-icon-output": "tsx tools/promote-skill-icon-output.ts",
	"validate:skill-icons": "tsx tools/export-skill-icon-production.ts --check && tsx tools/validate-skill-icon-assets.ts"
}
```

- [ ] **Step 5: Run focused validation**

```bash
pnpm exec vitest run tools/validate-skill-icon-assets.spec.ts tools/persist-skill-icon-output.spec.ts tools/promote-skill-icon-output.spec.ts
pnpm typecheck:skill-icons
```

Expected: PASS.

- [ ] **Step 6: Commit the asset gate**

```bash
git add package.json tools/validate-skill-icon-assets.ts tools/validate-skill-icon-assets.spec.ts tools/persist-skill-icon-output.ts tools/persist-skill-icon-output.spec.ts tools/promote-skill-icon-output.ts tools/promote-skill-icon-output.spec.ts tools/tsconfig.skill-icon-production.json
git commit -m "feat(skills): validate isolated icon assets"
```

---

### Task 5: Build deterministic composition and review exports

**Files:**

- Create: `tools/compose-skill-icon-assets.ts`
- Create: `tools/compose-skill-icon-assets.spec.ts`
- Modify: `tools/tsconfig.skill-icon-production.json`
- Modify: `package.json`

**Interfaces:**

- Produces `composeSkillHex({ backingPath, artPath, framePath }): Promise<Buffer>`.
- Produces `exportSkillRuntimeSet(record, root): Promise<SkillIconDerivedAssets>`.
- Produces `renderSkillReviewCard({ composite, name, mastery, level, rarity }): Promise<Buffer>` and `renderSkillContactSheet(cards): Promise<Buffer>`.
- Runtime files are named by `targetId` slug beneath `apps/web/static/skill-icons/v1/{512,256,128}/`.

- [ ] **Step 1: Write failing compositor tests**

Generate red backing, green art, and blue frame fixtures with known alpha regions, then assert center/edge pixels prove the exact layer order. Assert `exportSkillRuntimeSet` creates 512/256/128 WebP derivatives and a 96-pixel PNG recognition thumbnail without modifying any input. Assert review-card text is outside the hexagonal raster area and runtime images contain no text.

- [ ] **Step 2: Run the test and verify RED**

```bash
pnpm exec vitest run tools/compose-skill-icon-assets.spec.ts
```

Expected: FAIL because the compositor is absent.

- [ ] **Step 3: Implement deterministic exports**

Use Sharp `composite` in this order:

```ts
const layers = [
	{ input: backingPath, blend: 'over' as const },
	{ input: artPath, blend: 'over' as const },
	{ input: framePath, blend: 'over' as const }
];
```

Render labels only in review cards through an SVG overlay using the exact display form
`INTERMEDIATE · LV 7`; validate levels as integers from 1 through 10. Contact sheets are generated evidence and cannot be passed as master paths.

- [ ] **Step 4: Add export scripts and run GREEN**

Add:

```json
{
	"export:skill-icon-runtime": "tsx tools/compose-skill-icon-assets.ts --write",
	"check:skill-icon-runtime": "tsx tools/compose-skill-icon-assets.ts --check"
}
```

Run:

```bash
pnpm exec vitest run tools/compose-skill-icon-assets.spec.ts
pnpm typecheck:skill-icons
```

Expected: PASS.

- [ ] **Step 5: Commit the compositor**

```bash
git add package.json tools/compose-skill-icon-assets.ts tools/compose-skill-icon-assets.spec.ts tools/tsconfig.skill-icon-production.json
git commit -m "feat(skills): compose icon review assets"
```

---

### Task 6: Create the dedicated one-icon production skill

**Required implementation skills:** `skill-creator`, `superpowers:writing-skills`

**Files:**

- Create: `skills/summonlab-skill-icon-production/SKILL.md`
- Create: `skills/summonlab-skill-icon-production/agents/openai.yaml`
- Create: `skills/summonlab-skill-icon-production/references/target-schema.md`
- Create: `skills/summonlab-skill-icon-production/references/result-schema.md`
- Create: `skills/summonlab-skill-icon-production/references/review-rubric.md`
- Create: `skills/summonlab-skill-icon-production/scripts/validate_target.py`
- Create: `skills/summonlab-skill-icon-production/scripts/verify_result.py`
- Create: `skills/summonlab-skill-icon-production/scripts/test_verify_result.py`

**Interfaces:**

- Consumes exactly one `SkillIconTarget` and matching `SkillIconAssignment`.
- Calls image generation for one image only, inspects the result, persists through `pnpm persist:skill-icon-output`, and returns one structured result.
- Never edits catalogs, visual specs, reviews, application code, approved masters, or another job's paths.

- [ ] **Step 1: Use the skill-authoring workflows and add failing verifier tests**

Cover target/assignment mismatch, extra written paths, overwrite attempts, missing exact prompt, missing reference hashes, absent alpha, incorrect dimensions, retry-ceiling violation, and illegal self-promotion. The successful fixture must contain `noSharedFilesEdited: true` and `selfPromoted: false`.

- [ ] **Step 2: Run the verifier tests and verify RED**

```bash
python -m unittest skills/summonlab-skill-icon-production/scripts/test_verify_result.py
```

Expected: FAIL because the verifier is absent.

- [ ] **Step 3: Write the bounded skill workflow**

The `SKILL.md` sequence is exact:

1. validate target and assignment;
2. inspect every declared reference for its stated purpose;
3. render the exact prompt from the immutable target;
4. make at most one corrective image edit when the assignment permits it;
5. inspect full-size and 96-pixel views;
6. persist only through the repository helper;
7. write and verify one result;
8. stop without promotion.

Require `imagegen` for raster generation and prohibit calibration-sheet cropping. For individual icons, require the global Painted Emblem authority, family calibration plate when applicable, geometry guide, and approved primary-parent master when present.

- [ ] **Step 4: Run skill validation**

```bash
python -m unittest skills/summonlab-skill-icon-production/scripts/test_verify_result.py
python skills/summonlab-skill-icon-production/scripts/validate_target.py --help
python skills/summonlab-skill-icon-production/scripts/verify_result.py --help
```

Expected: PASS and both CLIs exit 0 for `--help`.

- [ ] **Step 5: Install the repository skill for local execution**

Use the `skill-installer` workflow against the repository skill directory, then compare hashes of the repository and installed `SKILL.md`. Do not hand-copy files into the installed skill tree.

- [ ] **Step 6: Commit the production skill**

```bash
git add skills/summonlab-skill-icon-production
git commit -m "feat(skills): add icon production skill"
```

---

### Task 7: Produce the seven frame masters and universal backing

**Files:**

- Create: `assets/wiki/skills/icon-production-v1/targets/references/*.json`
- Create: `assets/wiki/skills/icon-production-v1/assignments/references/*.json`
- Create: `assets/wiki/skills/icon-production-v1/candidates/references/*.png`
- Create: `assets/wiki/skills/icon-production-v1/results/references/*.json`
- Create: `assets/wiki/skills/icon-production-v1/masters/frames/{f,e,d,c,b,a,s}.png` after owner acceptance
- Create: `assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png` after owner acceptance
- Create: `assets/wiki/skills/icon-production-v1/review/decisions/references/*.json`
- Create: `assets/wiki/skills/icon-production-v1/review/reference-assets-v1.png`
- Modify: `assets/wiki/skills/icon-production-v1/catalog.json`

**Interfaces:**

- Consumes the Option C source at `assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png` and the geometry guide from Task 2.
- Produces eight approved reference masters required by every individual skill composite.

- [ ] **Step 1: Add immutable targets and assignments**

Create one target per rarity and one backing target. Every frame prompt must state its exact material and ornament row from `docs/wiki/art/skill-rarity-frames.md`, require transparent outside/inside regions, preserve the shared point-up geometry, and prohibit icon art or text other than the rarity medallion letter. The backing prompt requires charcoal forged stone, subtle low-contrast texture, no emblem, no letter, no glow, and transparency outside the aperture.

- [ ] **Step 2: Verify the missing-output gate**

```bash
pnpm validate:skill-icons
```

Expected: FAIL with exactly eight missing candidate outputs and no catalog-structure errors.

- [ ] **Step 3: Dispatch eight isolated generation jobs**

Use `summonlab-skill-icon-production` once per target. The seven frames may run independently; the backing is independent of all frames. Each job returns only its versioned candidate PNG and result JSON.

- [ ] **Step 4: Validate candidates and create the comparison sheet**

```bash
pnpm validate:skill-icons
pnpm export:skill-icon-runtime -- --scope references
```

Expected: all eight files pass role-specific alpha/geometry checks and
`review/reference-assets-v1.png` shows F through S plus the backing at equal scale.

- [ ] **Step 5: Pause for owner review**

Ask the owner to accept or revise each of the eight assets. Record one `SkillIconReview` per job under
`review/decisions/references/`, binding the candidate SHA-256 and a nonempty rationale. A rejection
creates a version-incremented target and candidate path; it never overwrites v1 evidence.

- [ ] **Step 6: Promote accepted reference masters**

Promote all accepted reference jobs with one atomic directory preflight:

```bash
pnpm promote:skill-icon-output -- \
  --review-dir assets/wiki/skills/icon-production-v1/review/decisions/references
```

The command copies accepted candidate bytes to the exact master paths and regenerates catalog
hashes/review bindings. Then run:

```bash
pnpm validate:skill-icons
pnpm check:skill-icon-runtime
```

Expected: eight approved references and no unreviewed promoted file.

- [ ] **Step 7: Commit accepted references**

```bash
git add assets/wiki/skills/icon-production-v1
git commit -m "feat(skills): approve icon frames and backing"
```

---

### Task 8: Author and calibrate the three-domain pilot

**Files:**

- Modify: `assets/wiki/skills/icon-production-v1/visual-specs.json`
- Create: `assets/wiki/skills/icon-production-v1/targets/calibration/*.json`
- Create: `assets/wiki/skills/icon-production-v1/assignments/calibration/*.json`
- Create: `assets/wiki/skills/icon-production-v1/candidates/calibration/*.png`
- Create: `assets/wiki/skills/icon-production-v1/results/calibration/*.json`
- Create: `assets/wiki/skills/icon-production-v1/masters/calibration/*.png` after owner acceptance
- Create: `assets/wiki/skills/icon-production-v1/review/decisions/calibration/*.json`
- Create: `assets/wiki/skills/icon-production-v1/review/pilot-calibration-v1.png`

**Interfaces:**

- Produces approved calibration authorities for `blade.sweeping-cut`, `elemental.fire-projectile`, and `forging.smithing`.
- Promotes exactly fifteen pilot records from `mapped` to `authored`.

- [ ] **Step 1: Author the exact fifteen visual records**

Use these accepted lineages:

```text
Horizontal Slash → Crescent Sweep → Wind Slash → Rising Moon → Ten Thousand Leaves
Fireball → Great Fireball → Charged Fireball → Meteor → Sunfall
Ore Sense → Simple Smithing → Weaponsmithing → Armoursmithing → Godsmithing
```

Use one visual grammar per family:

- `blade.sweeping-cut`: one polished blade arc as the dominant subject; the supporting cue progresses from a clean lateral pressure wake to crescent air, launched wind, rising lunar force, and finally leaf-like afterimages; steel, pale cyan-white air, and restrained amber impact sparks.
- `elemental.fire-projectile`: one self-contained fire projectile or descending fire mass; the supporting cue progresses through hotter core compression, charge rings, atmospheric descent, and solar corona; ember orange, deep red, and white-hot centers against transparent edges.
- `forging.smithing`: one material/tool emblem progressing from exposed ore vein to worked billet, weapon, armour, and divine anvil-work; at most one ember or hammer-strike cue; iron, steel, charcoal, and controlled forge orange.

Author these exact subject/cue pairs:

| Skill | Dominant subject | Supporting cue |
| --- | --- | --- |
| Horizontal Slash | One polished sword cutting laterally through the center | One thin horizontal pressure wake |
| Crescent Sweep | One curved blade caught at the apex of a broad sweep | One pale crescent of compressed air |
| Wind Slash | One airborne crescent cut separated from its blade | One tapering wind ribbon |
| Rising Moon | One blade arc rising sharply upward | One restrained moon-pale crescent |
| Ten Thousand Leaves | One central sweeping blade | One fan of leaf-like cutting afterimages |
| Fireball | One compact spherical flame projectile | One short ember tail |
| Great Fireball | One enlarged flame sphere with a dense core | One expanded outer corona |
| Charged Fireball | One compressed white-hot fire orb | One concentric charge ring |
| Meteor | One descending molten stone wrapped in fire | One directional flame trail |
| Sunfall | One miniature descending sun | One restrained solar corona |
| Ore Sense | One split ore-bearing stone showing a mineral vein | One directional mineral glint |
| Simple Smithing | One heated metal billet resting on a small anvil | One hammer-strike spark |
| Weaponsmithing | One newly forged sword blank across an anvil | One controlled forge spark |
| Armoursmithing | One shaped breastplate panel on an anvil | One low forge ember |
| Godsmithing | One monumental masterwork anvil joined to impossible bright metal | One restrained sacred-metal halo |

Every child names only its immediate predecessor as `primaryVisualParent`. Every record uses the
family palette above and the composition `single centered emblem, three-quarter dimensional read,
clear negative space, silhouette recognizable at 96×96`. Add exclusions that prevent hands,
characters, scenery, multiple unrelated tools, text, borders, rarity materials, and full narrative
workshops.

- [ ] **Step 2: Validate authored-state transition**

```bash
pnpm export:skill-icons
pnpm validate:skill-icons
```

Expected: 15 authored, 441 mapped, and no candidate/master paths claimed by authored records.

- [ ] **Step 3: Generate one calibration plate per pilot family**

Each target requests all five family stages at equal scale in one reference plate, using the global Painted Emblem direction and geometry guide. The plates establish motif progression only; the prompts explicitly state `reference only—never crop into individual assets`.

- [ ] **Step 4: Validate and review the three plates**

Create `review/pilot-calibration-v1.png` with the three plates at readable size. Ask the owner whether each family is internally consistent, whether adjacent stages remain distinct, and whether the three families still look like one game.

- [ ] **Step 5: Promote accepted calibration plates**

Record hash-bound owner decisions under `review/decisions/calibration/`. Promote the accepted plates
after one all-record preflight:

```bash
pnpm promote:skill-icon-output -- \
  --review-dir assets/wiki/skills/icon-production-v1/review/decisions/calibration
```

Then run:

```bash
pnpm validate:skill-icons
pnpm report:skill-icons
```

Expected: three accepted calibration plates, 15 authored skills, and 441 mapped skills.

- [ ] **Step 6: Commit pilot authoring and calibration**

```bash
git add assets/wiki/skills/icon-production-v1
git commit -m "feat(skills): calibrate pilot icon families"
```

---

### Task 9: Generate and approve fifteen individual pilot masters

**Files:**

- Create: `assets/wiki/skills/icon-production-v1/targets/icons/*.json`
- Create: `assets/wiki/skills/icon-production-v1/assignments/icons/*.json`
- Create: `assets/wiki/skills/icon-production-v1/candidates/icons/*.png`
- Create: `assets/wiki/skills/icon-production-v1/results/icons/*.json`
- Create: `assets/wiki/skills/icon-production-v1/masters/icons/{target-id}.png` after owner acceptance
- Create: `assets/wiki/skills/icon-production-v1/review/decisions/icons/*.json`
- Create: `assets/wiki/skills/icon-production-v1/review/pilot-icons-v1.png`
- Create: `apps/web/static/skill-icons/v1/{512,256,128}/*.{webp}` after promotion
- Create: `apps/web/static/skill-icons/v1/manifest.json`
- Modify: `assets/wiki/skills/icon-production-v1/visual-specs.json`
- Modify: `assets/wiki/skills/icon-production-v1/catalog.json`

**Interfaces:**

- Consumes accepted reference assets, pilot calibration plates, and approved immediate-parent masters.
- Produces fifteen independent `1024×1024` transparent masters and 45 runtime WebP derivatives.

- [ ] **Step 1: Materialize the fifteen target packets**

The exporter binds each target to the global style authority, geometry guide, its family plate, and its primary-parent master when present. Root skills omit the parent reference. Every target repeats its dominant subject, cue, semantic palette, composition, and exclusions verbatim from `visual-specs.json`.

- [ ] **Step 2: Verify the parent-order gate**

```bash
pnpm validate:skill-icons
```

Expected: root targets are dispatchable; every child reports `blocked-by-unapproved-primary-parent` until its immediate parent is approved.

- [ ] **Step 3: Generate in three parallel lineage lanes**

Run one lane for each motif family. Within a lane, generate and approve root-to-leaf so each child can reference the approved parent master. Across the three lanes, equivalent lineage depths may run in parallel. Each job creates one image and one result only.

- [ ] **Step 4: Review every candidate at three sizes**

For each candidate inspect:

1. isolated `1024×1024` artwork;
2. deterministic backing/art/rarity composite at normal UI size;
3. the `96×96` recognition thumbnail without text.

Record recognition, family distinction, lineage continuity, safe-zone compliance, frame-color collision, and artifact findings. A failed child receives a new versioned target; previously approved parents remain immutable.

- [ ] **Step 5: Produce the owner contact sheet**

```bash
pnpm export:skill-icon-runtime -- --scope pilot
pnpm validate:skill-icons
```

Expected: `review/pilot-icons-v1.png` contains exactly 15 composed cards with skill name and example mastery/level text beneath each hexagon, while each underlying master remains standalone and text-free.

- [ ] **Step 6: Pause for owner pilot acceptance**

Ask for one decision on each family and its member icons. The pilot is accepted only if all fifteen icons are independently legible, the three motif grammars are coherent, and rarity frames remain distinct from semantic icon color.

- [ ] **Step 7: Promote and export accepted pilot assets**

After acceptance, write one hash-bound review per icon under `review/decisions/icons/`, run the
atomic directory promotion, then generate the 512/256/128 derivatives and 96-pixel thumbnails and
write the public runtime manifest containing only approved asset URLs and immutable hashes:

```bash
pnpm promote:skill-icon-output -- \
  --review-dir assets/wiki/skills/icon-production-v1/review/decisions/icons
pnpm export:skill-icon-runtime -- --scope pilot
```

- [ ] **Step 8: Run the pilot gate**

```bash
pnpm validate:skill-icons
pnpm check:skill-icon-runtime
pnpm report:skill-icons -- --require-pilot
```

Expected: 15 approved, 441 mapped, 15/15 pilot recognition reviews passed, and the bulk gate becomes `eligible-for-owner-activation` rather than activating automatically.

- [ ] **Step 9: Commit the accepted pilot**

```bash
git add assets/wiki/skills/icon-production-v1 apps/web/static/skill-icons/v1
git commit -m "feat(skills): approve three-domain icon pilot"
```

---

### Task 10: Build the reusable SkillHex and Forge review surface

**Required implementation skills:** `frontend-design-premium:frontend-design` and `frontend-design-premium:frontend-design-premium`

**Files:**

- Create: `apps/web/src/lib/components/skills/skill-icon-data.ts`
- Create: `apps/web/src/lib/components/skills/skill-icon-data.spec.ts`
- Create: `apps/web/src/lib/components/skills/SkillHex.svelte`
- Create: `apps/web/src/routes/forge/skills/+page.server.ts`
- Create: `apps/web/src/routes/forge/skills/+page.svelte`
- Create: `apps/web/src/routes/forge/skills/skills.e2e.ts`
- Modify: `apps/web/src/routes/forge/+page.svelte`
- Modify: `apps/web/DESIGN.md`

**Interfaces:**

- Produces `SkillHex` props `{ name: string; rarity: SkillIconRarity; mastery: SkillMastery; level: number; src: string; size?: 'compact' | 'standard' }`.
- Produces `loadApprovedSkillIcons()` on the server and `skillIconUrl(targetId, size)` for approved records only.
- The Forge page supports domain, family, rarity, motif, and lifecycle filters and exposes full-size, composite, and 96-pixel views.

- [ ] **Step 1: Write failing data-boundary tests**

```ts
expect(skillIconUrl('magical:elemental:fireball', 256)).toBe(
	'/skill-icons/v1/256/magical-elemental-fireball.webp'
);
expect(() => skillIconUrl('magical:elemental:fireball', 300)).toThrow(/unsupported size/u);
expect(loadApprovedSkillIcons().every((entry) => entry.status === 'approved')).toBe(true);
```

Also assert that no source master or candidate path is exposed to the browser manifest.

- [ ] **Step 2: Run the unit test and verify RED**

```bash
pnpm --filter @summonlab/web exec vitest run src/lib/components/skills/skill-icon-data.spec.ts
```

Expected: FAIL because the loader and component are absent.

- [ ] **Step 3: Implement `SkillHex`**

Use an `<img>` for the precomposed approved derivative and ordinary DOM text beneath it. The top row is the unabbreviated skill name. The second row is uppercase mastery plus `· LV N`; only the compact breakpoint may shorten `Intermediate` to `INT`. Give the image explicit dimensions and aspect ratio, preserve the hex silhouette without CSS recoloring, and provide a focus-visible state on the containing link/button rather than on decorative frame pixels.

- [ ] **Step 4: Implement the Forge review page**

The server reads the generated catalog and public manifest. The page defaults to the fifteen pilot assets, keeps filters in the query string, shows readiness counts, and offers side-by-side isolated/composed/96-pixel views. It is a review surface only; it does not mutate approval files.

- [ ] **Step 5: Write and run the browser checks**

The Playwright test must:

1. open `/forge/skills`;
2. assert exactly 15 approved pilot tiles;
3. filter to Magical and see 5;
4. inspect Fireball and verify full-size plus 96-pixel previews;
5. check a narrow mobile viewport for non-overlapping name/mastery rows;
6. tab through filters and tiles with visible focus.

Run:

```bash
pnpm --filter @summonlab/web test
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web build
pnpm --filter @summonlab/web exec playwright test src/routes/forge/skills/skills.e2e.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the review UI**

```bash
git add apps/web/src/lib/components/skills apps/web/src/routes/forge/skills apps/web/src/routes/forge/+page.svelte apps/web/DESIGN.md
git commit -m "feat(web): add skill icon review forge"
```

---

### Task 11: Publish readiness evidence and enable continuous validation

**Files:**

- Modify: `tools/report-skill-icon-readiness.ts`
- Modify: `tools/report-skill-icon-readiness.spec.ts`
- Create: `docs/wiki/art/skill-icons.md`
- Create: `docs/wiki/sources/2026-09-01-skill-icon-pilot-evidence.md`
- Modify: `docs/wiki/art/skill-rarity-frames.md`
- Modify: `docs/wiki/catalog.json`
- Modify: `apps/web/src/lib/server/wiki.ts`
- Modify: `apps/web/src/lib/server/wiki.spec.ts`
- Modify: `tools/skill-rarity-frame-contract.spec.ts`
- Modify: `package.json`

**Interfaces:**

- Produces readiness states `foundation-incomplete`, `pilot-incomplete`, `eligible-for-owner-activation`, `bulk-active`, and `complete`.
- Produces a deterministic report with canonical/mapped/authored/candidate/approved counts, reference-asset status, pilot status, remaining count, and all blocking reasons.
- Adds a public wiki page that documents the reproducible new-skill procedure and embeds only approved review imagery.

- [ ] **Step 1: Write failing readiness tests**

```ts
expect(reportFor({ approved: 15, bulkActivated: false })).toMatchObject({
	state: 'eligible-for-owner-activation',
	canonical: 456,
	approved: 15,
	remaining: 441
});
expect(reportFor({ approved: 455, bulkActivated: true }).state).not.toBe('complete');
expect(reportFor({ approved: 456, bulkActivated: true }).state).toBe('complete');
```

Prove that missing frames/backing, a failed pilot review, catalog drift, stale derivatives, or any missing provenance keeps the gate closed.

- [ ] **Step 2: Run the test and verify RED**

```bash
pnpm exec vitest run tools/report-skill-icon-readiness.spec.ts
```

Expected: FAIL because the readiness reporter is absent.

- [ ] **Step 3: Implement reporting and root checks**

Extend the existing reporter tests with every final asset/provenance blocker, include all new tool
files in `tools/tsconfig.skill-icon-production.json`, add `pnpm validate:skill-icons` and
`pnpm check:skill-icon-runtime` to root `check`, and ensure check mode never rewrites manifests or
images.

- [ ] **Step 4: Publish the wiki contract and evidence**

`docs/wiki/art/skill-icons.md` must state:

- frame, backing, artwork, and text are independent layers;
- Option C defines rarity and Painted Emblem defines skill artwork;
- calibration plates establish consistency but never become asset crops;
- individual masters are 1024-pixel transparent PNGs;
- the exact new-skill lifecycle is map → author → calibrate if needed → generate → validate → owner review → promote → export;
- changing rarity recomposes the frame and does not regenerate artwork;
- the current pilot count and link to evidence.

Update the rarity-frame page from “individual runtime exports pending” to the verified status produced by Task 7. Bundle only the pilot review image through `apps/web/src/lib/server/wiki.ts`; keep 1024-pixel masters out of eager wiki imports.

- [ ] **Step 5: Run the complete verification suite**

```bash
pnpm validate:skill-taxonomy
pnpm validate:skill-icons
pnpm check:skill-icon-runtime
pnpm report:skill-icons -- --require-pilot
pnpm test:skill-icons
pnpm typecheck:skill-icons
pnpm validate:wiki
pnpm --filter @summonlab/web test
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web build
git diff --check
```

Expected: all commands PASS; the report states 15 approved, 441 remaining, and `eligible-for-owner-activation`.

- [ ] **Step 6: Commit the verified pilot boundary**

```bash
git add package.json tools/report-skill-icon-readiness.ts tools/report-skill-icon-readiness.spec.ts tools/tsconfig.skill-icon-production.json docs/wiki/art/skill-icons.md docs/wiki/art/skill-rarity-frames.md docs/wiki/sources/2026-09-01-skill-icon-pilot-evidence.md docs/wiki/catalog.json apps/web/src/lib/server/wiki.ts apps/web/src/lib/server/wiki.spec.ts tools/skill-rarity-frame-contract.spec.ts
git commit -m "docs(skills): publish icon pilot workflow"
```

---

## Final execution checkpoint

After Task 11, stop and present the owner with:

- the eight reference assets;
- all three family calibration plates;
- the fifteen isolated masters and composed tiles;
- desktop and mobile `/forge/skills` screenshots;
- the readiness report and observed first-pass/revision counts;
- a proposed safe parallel wave size derived from the pilot.

Only an explicit owner decision may change the catalog gate from `eligible-for-owner-activation` to `bulk-active`. That decision authorizes writing the follow-on 441-skill rollout plan; it does not authorize automatic generation in the same checkpoint.
