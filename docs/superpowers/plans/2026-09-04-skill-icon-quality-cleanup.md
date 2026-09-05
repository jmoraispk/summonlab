# Skill Icon Quality Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and review a fully provenance-bound cleanup candidate set for all 456 skill icons,
with canonical rank frames, protected artwork geometry, and confirmed stray UI glyphs removed.

**Architecture:** Freeze the current mass-production run as immutable input, generate standalone
shared frame/backing candidates through the existing reference-asset protocol, and create a new
`quality-cleanup-v1` namespace for deterministic interiors, revisions, composites, results, and
review evidence. Nothing changes in the live wiki until one final owner decision selects the
completed cleanup manifest, after which the existing content-addressed wiki exporter regenerates
browser derivatives.

**Tech Stack:** TypeScript 6, Zod 4, Sharp 0.35.3/libvips, Vitest 4, existing skill-icon production
contracts and promotion tooling, SvelteKit wiki exporter.

**Spec:** `docs/superpowers/specs/2026-09-04-skill-icon-quality-cleanup-design.md`

## Global Constraints

- Preserve every file under `mass-production-v1` byte-for-byte.
- Preserve every revision-5 shared-layer target, assignment, candidate, and result byte-for-byte;
  new normalization authority requires a higher revision.
- Bind the frozen input hashes listed in the spec; fail closed on drift.
- Preserve the integrated crest and uppercase rank letter as part of every frame.
- Produce only regular point-up hexagons on `1024×1024` RGBA canvases with transparent exteriors.
- Use the selected frame sheet only as visual generation authority, never as a crop or trace source.
- Do not modify the live wiki manifest or derivatives before the final accepted owner review.
- Generate the batch without per-rank or per-family checkpoints; retain collision-safe progress.
- Never let a worker self-promote a generated candidate or edit a shared manifest.

## File Structure

| Path | Responsibility |
| --- | --- |
| `packages/contracts/src/skill-icon-quality-cleanup.ts` | Strict cleanup manifest, finding, result, selection, and review schemas |
| `packages/contracts/src/skill-icon-quality-cleanup.spec.ts` | Schema acceptance and rejection coverage |
| `packages/contracts/src/index.ts` | Public cleanup-contract exports |
| `tools/skill-icon-quality-cleanup-lib.ts` | Authority loading, geometry masks, deterministic composition, inventory checks, and review rendering |
| `tools/skill-icon-quality-cleanup-lib.spec.ts` | Pixel geometry, provenance, drift, and idempotence tests |
| `tools/export-skill-icon-quality-cleanup.ts` | `--write`/`--check` manifest and findings exporter |
| `tools/export-skill-icon-cleanup-reference-packets.ts` | Higher-revision E–S frame and backing target/assignment exporter |
| `tools/persist-skill-icon-cleanup-output.ts` | No-replace persistence for targeted semantic revision sources/results |
| `tools/finalize-skill-icon-quality-cleanup.ts` | Builds all deterministic interiors/composites/review sheets and completion evidence |
| `tools/select-skill-icon-quality-cleanup.ts` | Applies an accepted owner review and writes the selected cleanup authority |
| `tools/tsconfig.skill-icon-production.json` | Includes the cleanup tools in skill-icon typechecking |
| `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/findings.source.json` | Authored confirmed/review-required defect inventory |
| `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json` | Generated frozen cleanup inventory and hashes |
| `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/**` | Versioned interiors, revisions, composites, results, and review evidence |
| `apps/web/static/wiki-media/skills/visual-catalog-v1/**` | Content-addressed derivatives regenerated only after acceptance |

---

### Task 1: Add the cleanup contracts and frozen defect inventory

**Files:**

- Create: `packages/contracts/src/skill-icon-quality-cleanup.ts`
- Create: `packages/contracts/src/skill-icon-quality-cleanup.spec.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/findings.source.json`

**Interfaces:**

- Produces: `SkillIconCleanupManifestSchema`, `SkillIconCleanupFindingSchema`,
  `SkillIconCleanupResultSchema`, `SkillIconCleanupOwnerReviewSchema`, and
  `SkillIconCleanupSelectionSchema`.
- Produces defect kinds `frame-composition`, `stray-ui-glyph`, and `symbolic-owner-review`.
- Produces dispositions `recompose`, `revise-art`, `owner-review`, `accepted-unchanged`, and
  `selected`.

- [ ] **Step 1: Write schema tests before the schemas**

Create fixtures proving that a manifest accepts exactly 456 unique records and rejects an unknown
defect kind, duplicate target ID, wrong authority hash, source/output path collision, non-versioned
cleanup path, and a selected record without an accepted owner review.

```ts
expect(() => SkillIconCleanupManifestSchema.parse(validManifest())).not.toThrow();
expect(() =>
	SkillIconCleanupManifestSchema.parse({
		...validManifest(),
		records: [...validManifest().records, validManifest().records[0]]
	})
).toThrow(/duplicate target/i);
```

- [ ] **Step 2: Run the contract test and verify the missing exports fail**

```bash
corepack pnpm vitest run packages/contracts/src/skill-icon-quality-cleanup.spec.ts
```

Expected: FAIL because the cleanup schemas do not exist.

- [ ] **Step 3: Implement strict schemas**

Use `.strict()` objects and lowercase 64-character SHA-256 fields. Bind every record to one source
candidate, one rank, one disposition, zero or more findings, one cleanup composite path, and one
result path. The selection schema must bind the cleanup-manifest hash and owner-review hash.

```ts
export const SkillIconCleanupFindingSchema = z
	.object({
		targetId: z.string().min(1),
		kind: z.enum(['frame-composition', 'stray-ui-glyph', 'symbolic-owner-review']),
		detail: z.string().min(1),
		requiredAction: z.enum(['recompose', 'revise-art', 'owner-review'])
	})
	.strict();
```

- [ ] **Step 4: Encode the complete authored finding lists**

Write all ten confirmed frame/composition targets, all 28 confirmed stray-glyph targets, and all ten
symbolic-owner-review targets from the issue into `findings.source.json` using canonical target IDs.
The file is the only authored defect input; tools must not parse Markdown tables.

- [ ] **Step 5: Run tests and commit**

```bash
corepack pnpm vitest run packages/contracts/src/skill-icon-quality-cleanup.spec.ts
git add packages/contracts/src/skill-icon-quality-cleanup.ts \
  packages/contracts/src/skill-icon-quality-cleanup.spec.ts packages/contracts/src/index.ts \
  assets/wiki/skills/icon-production-v1/quality-cleanup-v1/findings.source.json
git commit -m "feat(skills): define icon cleanup contract"
```

Expected: contract tests PASS.

### Task 2: Export the immutable 456-skill cleanup manifest

**Files:**

- Create: `tools/skill-icon-quality-cleanup-lib.ts`
- Create: `tools/skill-icon-quality-cleanup-lib.spec.ts`
- Create: `tools/export-skill-icon-quality-cleanup.ts`
- Modify: `tools/tsconfig.skill-icon-production.json`
- Modify: `package.json`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/findings.json`

**Interfaces:**

- Consumes: frozen catalog, mass manifest, motif map, visual specs, geometry, and findings source.
- Produces:
  `buildSkillIconCleanupManifest(input: CleanupManifestInput): SkillIconCleanupManifest`.
- Produces:
  `exportSkillIconQualityCleanup({ root, mode }): Promise<CleanupExportReport>` where mode is
  `'write' | 'check'`.

- [ ] **Step 1: Test coverage, hashes, and zero-write check mode**

The fixture must prove exact `456/258/124/74` coverage, one output per source, correct finding
attachment, all frozen hashes, and no filesystem writes in `check` mode.

```ts
expect(report.counts).toEqual({ total: 456, Martial: 258, Magical: 124, Craft: 74 });
expect(report.written).toEqual([]);
expect(afterSnapshot).toEqual(beforeSnapshot);
```

- [ ] **Step 2: Run the focused test and verify failure**

```bash
corepack pnpm vitest run tools/skill-icon-quality-cleanup-lib.spec.ts
```

Expected: FAIL because the exporter and library do not exist.

- [ ] **Step 3: Implement authority and inventory loading**

Resolve paths under the repository root, reject symlinks/non-regular files, hash the exact bytes,
and compare against the spec's frozen hashes. Derive each cleanup path from the canonical target ID;
never accept paths from authored findings.

```ts
export const QUALITY_CLEANUP_ROOT =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1' as const;

export function cleanupSlug(targetId: string): string {
	return targetId.replaceAll(':', '-');
}
```

- [ ] **Step 4: Add exporter commands**

```json
"export:skill-icon-quality-cleanup": "tsx tools/export-skill-icon-quality-cleanup.ts --write",
"check:skill-icon-quality-cleanup": "tsx tools/export-skill-icon-quality-cleanup.ts --check"
```

The write mode creates only a missing or byte-identical generated manifest. Check mode reports drift
and performs zero writes.

- [ ] **Step 5: Generate, check, typecheck, and commit**

```bash
corepack pnpm export:skill-icon-quality-cleanup
corepack pnpm check:skill-icon-quality-cleanup
corepack pnpm typecheck:skill-icons
corepack pnpm vitest run tools/skill-icon-quality-cleanup-lib.spec.ts
git add package.json tools/tsconfig.skill-icon-production.json \
  tools/skill-icon-quality-cleanup-lib.ts tools/skill-icon-quality-cleanup-lib.spec.ts \
  tools/export-skill-icon-quality-cleanup.ts \
  assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json \
  assets/wiki/skills/icon-production-v1/quality-cleanup-v1/findings.json
git commit -m "feat(skills): freeze icon cleanup inventory"
```

Expected: 456 records and all commands PASS.

### Task 3: Author the seven missing shared-layer revision packets

**Files:**

- Create: `tools/export-skill-icon-cleanup-reference-packets.ts`
- Create: `tools/export-skill-icon-cleanup-reference-packets.spec.ts`
- Modify: `package.json`
- Generate: `assets/wiki/skills/icon-production-v1/targets/references/rarity-frame-{e,d,c,b,a,s}-v5.json`
- Generate: `assets/wiki/skills/icon-production-v1/assignments/references/rarity-frame-{e,d,c,b,a,s}-v5.json`
- Generate: `assets/wiki/skills/icon-production-v1/targets/references/charcoal-forged-stone-v5.json`
- Generate: `assets/wiki/skills/icon-production-v1/assignments/references/charcoal-forged-stone-v5.json`

**Interfaces:**

- Consumes: strict v2 target/assignment schemas, profile v3, geometry v2, Option C authority,
  selected seven-frame sheet, and provider-space guide.
- Produces:
  `exportCleanupReferencePackets({ root, mode }): Promise<ReferencePacketExportReport>`.

- [ ] **Step 1: Write packet-tuple and authority tests**

Assert six frame packets and one backing packet, explicit revision 5, producer version
`summonlab-skill-icon-production-v4`, profile `skill-icon-green-key-role-mask-v3`, retry ceiling 1,
and collision-safe candidate/result paths. Every frame must bind all three required references in
canonical order; backing binds Option C tonal authority and the geometry guide.

- [ ] **Step 2: Run the test and verify failure**

```bash
corepack pnpm vitest run tools/export-skill-icon-cleanup-reference-packets.spec.ts
```

Expected: FAIL because the packet exporter does not exist.

- [ ] **Step 3: Implement exact prompts and packets**

Reuse the accepted material ladder:

```ts
const FRAME_MATERIAL = {
	E: 'aged bronze with brown-gold patina and understated corner collars',
	D: 'tempered blue steel with cool edge highlights and restrained rivets',
	C: 'moonlit silver with clean bevels and minimal ornament',
	B: 'blackened amethyst metal with subtle violet inlay',
	A: 'champagne electrum with brighter bevels and four restrained point ornaments',
	S: 'ceremonial antique gold with the approved thorned crown ornament'
} as const;
```

Prompts require a uniform opaque `#00FF00` provider matte, a completely empty aperture, a fully
visible regular hexagon, one integrated crest/letter, no art or backing, and no cropping/tracing of
references.

Add:

```json
"export:skill-icon-cleanup-reference-packets": "tsx tools/export-skill-icon-cleanup-reference-packets.ts"
```

- [ ] **Step 4: Generate and validate packets**

```bash
corepack pnpm export:skill-icon-cleanup-reference-packets -- --write
corepack pnpm vitest run tools/export-skill-icon-cleanup-reference-packets.spec.ts
corepack pnpm typecheck:skill-icons
```

Expected: six frame and one backing revision-5 packet pairs validate; the existing F revision-5
candidate remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add package.json tools/export-skill-icon-cleanup-reference-packets.ts \
  tools/export-skill-icon-cleanup-reference-packets.spec.ts \
  assets/wiki/skills/icon-production-v1/targets/references \
  assets/wiki/skills/icon-production-v1/assignments/references
git commit -m "feat(skills): queue canonical cleanup layers"
```

### Task 4: Build deterministic protected-aperture composition

**Files:**

- Modify: `tools/skill-icon-quality-cleanup-lib.ts`
- Modify: `tools/skill-icon-quality-cleanup-lib.spec.ts`
- Create: `tools/finalize-skill-icon-quality-cleanup.ts`
- Modify: `package.json`

**Interfaces:**

- Produces:
  `extractLegacyInterior(source: Buffer, geometry: SkillIconGeometryV2): Promise<InteriorResult>`.
- Produces:
  `composeCleanupIcon(input: { backing: Buffer; interior: Buffer; frame: Buffer }): Promise<Buffer>`.
- Produces:
  `inspectCleanupComposite(input: CleanupInspectionInput): Promise<CleanupInspection>`.
- Produces:
  `finalizeSkillIconQualityCleanup({ root, mode }): Promise<CleanupFinalizeReport>`.

- [ ] **Step 1: Write pixel-level failing tests**

Create synthetic red backing, green interior, and blue semitransparent frame fixtures. Assert layer
order, medallion exclusion, zero interior alpha in the frame band, zero exterior alpha, and exact
same-rank protected-band bytes across two different interiors. Assert that a deliberately clipped
outer subject reports nonzero removed-pixel bounds.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
corepack pnpm vitest run tools/skill-icon-quality-cleanup-lib.spec.ts
```

Expected: FAIL on missing composition functions.

- [ ] **Step 3: Implement masks from geometry-v2 authority**

Derive all polygons from normalized geometry coordinates. Do not copy the broad ad hoc constants
from `repair-skill-icon-mass-exteriors.ts`. The interior mask is the geometry-v2 outer envelope
scaled by `innerApertureScale` about the declared center, minus the declared medallion exclusion.

```ts
const innerPoint = ([x, y]: readonly [number, number]) => [
	center.x + (x * width - center.x) * geometry.innerApertureScale,
	center.y + (y * height - center.y) * geometry.innerApertureScale
] as const;
```

Use Sharp raw buffers for deterministic alpha clearing and fixed PNG options
`compressionLevel: 9`, `adaptiveFiltering: false`, `palette: false`.

- [ ] **Step 4: Implement reproducibility and contamination checks**

For each output, recompute the expected composite from bound layer hashes and compare exact bytes.
Compare the final protected band to the canonical `backing + frame` band. Detect opaque near-white
connected components only as a structural warning; do not classify transparent checkerboard pixels
as white contamination.

- [ ] **Step 5: Add finalizer commands and commit**

```json
"finalize:skill-icon-quality-cleanup": "tsx tools/finalize-skill-icon-quality-cleanup.ts --write",
"validate:skill-icon-quality-cleanup": "tsx tools/finalize-skill-icon-quality-cleanup.ts --check"
```

```bash
corepack pnpm vitest run tools/skill-icon-quality-cleanup-lib.spec.ts
corepack pnpm typecheck:skill-icons
git add package.json tools/skill-icon-quality-cleanup-lib.ts \
  tools/skill-icon-quality-cleanup-lib.spec.ts tools/finalize-skill-icon-quality-cleanup.ts
git commit -m "feat(skills): add protected icon recomposition"
```

Expected: focused tests and typecheck PASS.

### Task 5A: Add the approved geometry-first shared-layer normalization route

**Files:**

- Modify: `packages/contracts/src/skill-icon-production.ts`
- Modify: `tools/normalize-skill-icon-provider-source.ts`
- Modify: persistence, validation, composition, promotion, and revision consumers/tests
- Modify: `skills/summonlab-skill-icon-production/**`
- Modify: cleanup design, plan, and issue documents

**Interfaces:**

- Adds profile `skill-icon-geometry-role-mask-v1` paired only with
  `summonlab-skill-icon-production-v5` on structural-v2 frame/backing packets.
- Reuses the exact profile-v3 `caBX`, assigned-sRGB, geometry-v2/guide-v2, chroma, resize, and fixed
  encoder authorities.
- Clears non-green provider pixels outside the geometry-v2 role mask without weakening strict
  retained-output alpha, backing-coverage, or frame-registration inspection.

- [x] **Step 1: Add focused RED regressions across every tuple consumer**

Cover exact and mixed tuples, dirty-edge profile-v3 rejection, geometry-first mask clearing,
container/alpha/geometry/guide rejection, complete result provenance, no-replace persistence, and
validation/composition/promotion recognition.

- [x] **Step 2: Implement the additive contract and deterministic normalizer behavior**

Keep profile v1/v2/v3 branches unchanged. Geometry-first skips only the clean-edge and forbidden
provider-color eligibility checks, clears forbidden output pixels, canonicalizes transparent RGB,
and invokes the role-aware inspector before returning bytes.

- [x] **Step 3: Update repository skill preflight/result verification and durable docs**

The Python and TypeScript validators bind the new profile to producer v5 and the exact geometry-v2
and guide-v2 authorities. Reprocess v1 remains pinned to profile v3.

- [x] **Step 4: Verify code while preserving production evidence**

Run focused TypeScript and Python suites, typecheck, the full skill-icon suite, formatting, and
`git diff --check`; compare pre/post hashes for `mass-production-v1` and every v5 packet/result.
This task creates no revision-6 packet or image.

### Task 5B: Issue geometry-first revision-6 shared-layer packets

**Files:**

- Modify: `tools/export-skill-icon-cleanup-reference-packets.ts` and focused tests
- Modify: cleanup result contract and finalizer shared-layer mapping/tests
- Generate: `charcoal-forged-stone-v6` and `rarity-frame-{e,d,c,b,a,s}-v6` target/assignment pairs
- Generate: authority-bound `superseded` results for E/D/C/B/A/S revision-5 frame packets

- [x] **Step 1: Add RED coverage for immutable v5 bytes and the exact v6 tuple inventory**
- [x] **Step 2: Export seven structural-v2 revision-6 packet pairs using geometry-first/producer-v5**
- [x] **Step 3: Point cleanup composition at backing-v6, F-v5, and E/D/C/B/A/S-v6**
- [x] **Step 4: Coordinator-supersede only the six output-free revision-5 frame packets**

No image is generated or promoted in this slice. Failed backing-v5 and successful F-v5 evidence
remain byte-identical, and no F-v6 packet exists.

### Task 5: Produce shared layers and all deterministic cleanup candidates

**Files:**

- Create: `assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-{e,d,c,b,a,s}-v6.png`
- Create: `assets/wiki/skills/icon-production-v1/results/references/rarity-frame-{e,d,c,b,a,s}-v6.json`
- Preserve: the failed `assets/wiki/skills/icon-production-v1/results/references/charcoal-forged-stone-v5.json`
- Preserve: the successful `rarity-frame-f-v5` candidate and result
- Create: the `charcoal-forged-stone-v6` candidate and result using the issued revision-6 packet
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/interiors/*.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites/*.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/results/*.json`

**Interfaces:**

- Consumes: six revision-6 frame assignments, the revision-6 backing assignment, the retained F
  revision-5 frame, and the complete cleanup manifest.
- Produces: six frame candidates/results, one geometry-first backing candidate/result, and 456 deterministic cleanup
  interiors/composites/results.

- [ ] **Step 1: Dispatch the seven independent reference jobs as one batch**

Use `summonlab-skill-icon-production` once for each revision-6 E/D/C/B/A/S frame and the revision-6
backing packet, each binding `skill-icon-geometry-role-mask-v1` to
`summonlab-skill-icon-production-v5`; never alter the failed backing-v5 or successful F-v5 evidence.
Each worker validates its exact target and assignment, submits the exact prompt, persists through
`pnpm persist:skill-icon-output`, records full-size and 96-pixel findings, and writes only its
candidate/result pair. Do not ask for per-job owner approval and do not promote.

- [ ] **Step 2: Verify all eight shared-layer candidates**

```bash
corepack pnpm validate:skill-icons
corepack pnpm finalize:skill-icon-quality-cleanup
corepack pnpm validate:skill-icon-quality-cleanup
```

Expected: F revision 5 plus six new frames and the revision-6 backing are role-valid; the reference contact sheet is
current in the cleanup namespace. If a job is terminally failed after its allowed correction, stop
the batch honestly and issue a higher revision in a new plan rather than weakening normalization.

- [ ] **Step 3: Recompose the complete catalog**

```bash
corepack pnpm finalize:skill-icon-quality-cleanup
corepack pnpm validate:skill-icon-quality-cleanup
```

Expected: 456 interiors, 456 composites, 456 results, exact domain counts, and no writes from the
second command.

- [ ] **Step 4: Verify immutable historical evidence**

Rehash `mass-production-v1` and assert its manifest plus every source/output/result hash still
matches the frozen input snapshot. The cleanup finalizer must fail if any historical byte changed.

- [ ] **Step 5: Commit the batch artifacts**

```bash
git add assets/wiki/skills/icon-production-v1/candidates/references \
  assets/wiki/skills/icon-production-v1/results/references \
  assets/wiki/skills/icon-production-v1/quality-cleanup-v1 \
  assets/wiki/skills/icon-production-v1/review
git commit -m "feat(skills): recompose canonical icon frames"
```

### Task 6: Add collision-safe targeted semantic revisions

**Files:**

- Create: `tools/persist-skill-icon-cleanup-output.ts`
- Create: `tools/persist-skill-icon-cleanup-output.spec.ts`
- Modify: `tools/skill-icon-quality-cleanup-lib.ts`
- Modify: `tools/export-skill-icon-quality-cleanup.ts`
- Modify: `package.json`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions/*.json`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/*.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/revisions/*.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/results/revisions/*.json`

**Interfaces:**

- Produces one immutable revision packet for each of the 28 confirmed stray-glyph targets.
- Produces:
  `persistCleanupRevision(input: PersistCleanupRevisionInput): Promise<CleanupRevisionResult>`.
- The input binds target ID, exact prompt, ordered reference paths/hashes, provider source hash,
  output paths, and one-attempt-plus-one-correction ceiling.

- [ ] **Step 1: Write persistence and authority tests**

Reject wrong target IDs, stale source/current-candidate/family-sheet hashes, unlisted references,
path traversal, symlinks, existing output paths, more than two attempts, and any manifest edit by a
worker. Prove candidate and result publish together without replacement.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
corepack pnpm vitest run tools/persist-skill-icon-cleanup-output.spec.ts
```

Expected: FAIL because the persister does not exist.

- [ ] **Step 3: Export exact revision prompts**

Each prompt repeats the canonical dominant subject, optional supporting cue, palette, composition,
and exclusions. It adds the exact unwanted glyph from `findings.source.json` and this invariant:

```text
Preserve the dominant subject, action, palette, lighting, and motif-family ancestry. Remove only the
detached explanatory UI glyph named in this packet. Add no replacement badge, arrow, gauge, heart,
cross, chevron, corner symbol, text, frame, crest, or rarity letter. Keep the complete subject inside
the protected central aperture.
```

References are the Painted Emblem authority, geometry guide, exact family reference sheet, original
provider source, and current cleanup composite, each with a purpose-limited hash.

- [ ] **Step 4: Implement no-replace persistence**

Retain exact provider bytes, normalize only the cleanup interior through the declared mask, compose
with the same backing/frame hashes, and publish provider source, revised interior, composite, and
result through one authenticated transaction. A worker writes only its assigned paths.

Add:

```json
"persist:skill-icon-cleanup-output": "tsx tools/persist-skill-icon-cleanup-output.ts"
```

The command accepts exactly `--packet`, `--source`, `--source-hash`, `--attempt-count`, and the two
full-size/384-pixel inspection outcomes and observations. It derives every repository destination
from the immutable packet.

- [ ] **Step 5: Run tests and commit the protocol**

```bash
corepack pnpm vitest run tools/persist-skill-icon-cleanup-output.spec.ts \
  tools/skill-icon-quality-cleanup-lib.spec.ts
corepack pnpm typecheck:skill-icons
git add package.json tools/persist-skill-icon-cleanup-output.ts \
  tools/persist-skill-icon-cleanup-output.spec.ts tools/skill-icon-quality-cleanup-lib.ts \
  tools/export-skill-icon-quality-cleanup.ts \
  assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions
git commit -m "feat(skills): add targeted icon cleanup jobs"
```

### Task 7: Generate the 28 confirmed revisions and complete review evidence

**Files:**

- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/*.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/revisions/*.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites/*.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/results/revisions/*.json`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/reference-assets-v1.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/catalog/page-*.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/frame-examples-v1.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/semantic-revisions-v1.png`
- Generate: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/symbolic-decisions-v1.png`

**Interfaces:**

- Consumes: 28 immutable revision packets and the completed deterministic cleanup set.
- Produces: revised composites/results plus one complete end-of-run review package.

- [ ] **Step 1: Dispatch all confirmed semantic jobs without intermediate checkpoints**

Generate exactly one provider image per packet, with at most one bounded corrective edit when the
packet permits it. Persist every successful result immediately. A failed target does not erase
other completed work and remains resumable only through a new explicit revision.

- [ ] **Step 2: Re-finalize the catalog with revised interiors selected**

```bash
corepack pnpm finalize:skill-icon-quality-cleanup
corepack pnpm validate:skill-icon-quality-cleanup
```

Expected: all 456 composites remain present; 28 select revised interiors; deterministic-only records
retain their original cleanup hashes.

- [ ] **Step 3: Render the review package**

The catalog pages show before/after pairs over a solid-dark well with target name, domain/family,
rank, motif family, disposition, and finding tags outside the image. The focused sheets show the ten
frame examples, all 28 semantic revisions, and the ten undecided symbolic-language cases at no less
than 384 pixels per icon.

- [ ] **Step 4: Run complete technical validation**

```bash
corepack pnpm check:skill-icon-quality-cleanup
corepack pnpm validate:skill-icon-quality-cleanup
corepack pnpm check:skill-icon-mass-production
corepack pnpm validate:skill-icons
corepack pnpm typecheck:skill-icons
corepack pnpm test:skill-icons
```

Expected: all commands PASS and check modes write zero files.

- [ ] **Step 5: Commit the completed candidate batch**

```bash
git add assets/wiki/skills/icon-production-v1/quality-cleanup-v1
git commit -m "feat(skills): complete icon quality candidates"
```

### Task 8: Record one owner decision, select the cleanup set, and refresh the wiki

**Files:**

- Create: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/owner-review-v1.json`
- Create: `assets/wiki/skills/icon-production-v1/review/decisions/references/*.json`
- Create: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/selection.json`
- Create: `tools/select-skill-icon-quality-cleanup.ts`
- Create: `tools/select-skill-icon-quality-cleanup.spec.ts`
- Modify: `tools/wiki-skill-visual-catalog-lib.ts`
- Modify: `tools/wiki-skill-visual-catalog-lib.spec.ts`
- Regenerate: `apps/web/static/wiki-media/skills/visual-catalog-v1/manifest.json`
- Regenerate: `apps/web/static/wiki-media/skills/visual-catalog-v1/icons/*.webp`
- Modify: `docs/wiki/art/skill-rarity-frames.md`
- Modify: `docs/superpowers/issues/2026-09-04-skill-icon-quality-cleanup.md`

**Interfaces:**

- Consumes: one hash-bound owner review covering all eight shared layers, 456 selected composites,
  28 semantic findings, and ten symbolic decisions.
- Produces:
  `selectSkillIconQualityCleanup({ root, reviewPath }): Promise<CleanupSelectionReport>`.
- Changes the wiki exporter input only when the review decision is `accepted` and all symbolic
  decisions are explicit.

- [ ] **Step 1: Write selection and wiki-source tests**

Reject a missing review, non-owner reviewer, stale cleanup-manifest hash, rejected shared layer,
missing target decision, unresolved symbolic case, changed composite hash, or partial selection.
Assert that an accepted selection causes all 456 wiki records to resolve from cleanup composites
and that no selection preserves `mass-production-v1` as the source.

- [ ] **Step 2: Run tests and verify failure**

```bash
corepack pnpm vitest run tools/select-skill-icon-quality-cleanup.spec.ts \
  tools/wiki-skill-visual-catalog-lib.spec.ts
```

Expected: FAIL because selection support does not exist.

- [ ] **Step 3: Record the single end-of-run owner review**

Present the review package. Record one `accepted` or `rejected` shared-layer/catalog decision plus
one `keep` or `remove` decision for each symbolic case. A `remove` decision queues that target into
the same bounded semantic-revision protocol and must complete before selection. Never infer owner
acceptance from conversation text without writing the hash-bound review.

- [ ] **Step 4: Implement atomic selection**

Validate every input before the first write. Materialize hash-bound accepted reference decisions
from the owner review, promote the seven frames and backing through the existing all-record preflight,
then write `selection.json` without replacement. Update the wiki source resolver to prefer only a
valid selected cleanup manifest. A rejected review writes no decisions or selection and leaves the
current wiki unchanged.

```bash
corepack pnpm promote:skill-icon-output -- \
  --review-dir assets/wiki/skills/icon-production-v1/review/decisions/references
```

- [ ] **Step 5: Regenerate and validate wiki derivatives**

```bash
corepack pnpm export:wiki-skill-visual-catalog
corepack pnpm validate:wiki-skill-visual-catalog
corepack pnpm test:wiki-skill-visual-catalog
corepack pnpm validate:wiki
corepack pnpm --filter @summonlab/web test
corepack pnpm --filter @summonlab/web typecheck
corepack pnpm --filter @summonlab/web lint
```

Expected: 456 cleanup-derived WebP assets, 258/124/74 counts, no stale browser assets, and all tests
PASS.

- [ ] **Step 6: Update durable documentation**

Record the selected shared-layer hashes, cleanup manifest/selection hashes, resolved finding counts,
and verification commands in the rarity-frame wiki page. Mark the cleanup issue complete only after
the selected wiki derivatives validate.

- [ ] **Step 7: Commit the accepted integration**

```bash
git add assets/wiki/skills/icon-production-v1/quality-cleanup-v1 \
  apps/web/static/wiki-media/skills/visual-catalog-v1 \
  tools/select-skill-icon-quality-cleanup.ts tools/select-skill-icon-quality-cleanup.spec.ts \
  tools/wiki-skill-visual-catalog-lib.ts tools/wiki-skill-visual-catalog-lib.spec.ts \
  docs/wiki/art/skill-rarity-frames.md \
  docs/superpowers/issues/2026-09-04-skill-icon-quality-cleanup.md
git commit -m "feat(wiki): publish cleaned skill icons"
```

## Final Verification

Run from the repository root:

```bash
corepack pnpm check:skill-icon-quality-cleanup
corepack pnpm validate:skill-icon-quality-cleanup
corepack pnpm check:skill-icon-mass-production
corepack pnpm validate:skill-icons
corepack pnpm typecheck:skill-icons
corepack pnpm test:skill-icons
corepack pnpm validate:wiki-skill-visual-catalog
corepack pnpm test:wiki-skill-visual-catalog
corepack pnpm validate:wiki
corepack pnpm --filter @summonlab/web test
corepack pnpm --filter @summonlab/web typecheck
corepack pnpm --filter @summonlab/web lint
git diff --check
git status --short
```

Expected:

- eight valid shared layers;
- 456 selected cleanup composites;
- 28 confirmed semantic findings resolved;
- ten symbolic findings explicitly decided;
- unchanged historical mass-production hashes;
- 456 wiki catalog records with domain counts `258/124/74`;
- no test, lint, typecheck, drift, or working-tree failures.
