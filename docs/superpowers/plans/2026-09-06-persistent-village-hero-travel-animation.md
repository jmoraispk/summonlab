# Persistent Village Hero Travel Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every authoritative Hearth 01 journey as a 3–5 second, directionally correct raster run for Yaso Dreno, Oren Sorin, and Joror Pelleth without changing simulation truth or the accepted Village UI.

**Architecture:** Add optional, source-bound Village-run packs to the canonical summonable-hero catalog and its checked-in runtime export. Keep the Village in Svelte/HTML and lazy-mount one transparent PixiJS v8 overlay for active travelers, driven by pure deterministic path math and the existing authoritative `SettlementPresentation`.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, Sharp 0.35.3, Svelte 5/SvelteKit 2, PixiJS 8.20.0, Playwright 1.60, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-09-06-persistent-village-hero-travel-animation-design.md`

## Global Constraints

- Every journey visible to the current player animates whether it began from a player direction or an autonomous decision.
- Visual travel uses the authoritative route but lasts `clamp(3000 + remainingLength * 2000, 3000, 5000)` milliseconds.
- `SettlementPresentation` remains the only source of route, occupancy, activity, and arrival truth; client playback emits no game commands and advances no clock.
- Motion authority is `classical-human-run-5`, with support sequence `left,left,none,right,right` and five frames per direction at 10 FPS.
- Each hero has one toward-camera row and one away-camera row; leftward travel mirrors the raster horizontally.
- Yaso Dreno is produced and accepted before Oren Sorin or Joror Pelleth is generated.
- Characters must be approved raster images. Never draw or approximate a character using vector graphics, CSS geometry, canvas primitives, emoji, or text.
- Village characters retain normal proportions and their approved face, clothing, equipment, scale, camera, and bottom-center foot anchor. Never substitute combat chibis.
- No candidate enters the approved catalog or runtime tree before explicit owner approval.
- Keep the accepted painted Village, HTML controls, resident links, activity labels, four-button phone navigation, and accessibility semantics.
- Full motion uses one lazy transparent PixiJS `Application` and canvas per mounted Village scene, never one per hero.
- Reduced motion mounts no canvas, requests no PixiJS or motion atlas, and places the static cutout at the destination.
- Runtime atlases are `1280x768` transparent WebPs containing ten logical `256x384` frames, at most `600000` encoded bytes and `3932160` decoded RGBA bytes per hero.
- The PixiJS ticker is private, capped at 60 FPS, starts only while a hero moves, and stops immediately when all playbacks settle.
- Retain no more than the current three campaign atlases, cap resolution at `min(devicePixelRatio, 2)`, and stay within the existing `300000000`-byte renderer working-set reference.
- Vercel and ordinary local development consume checked-in runtime assets; they do not run image generation, Python, rembg, or Docker.
- Follow `AGENTS.md`: isolate in-scope changes, validate every completed slice, commit with a concise Conventional Commit subject, and push before handoff.

---

### Task 1: Add the optional canonical Village-run contract

**Files:**
- Modify: `packages/contracts/src/summonable-hero.ts`
- Modify: `packages/contracts/src/summonable-hero.spec.ts`
- Modify: `assets/heroes/approved/summonable-roster-v1/catalog.json`
- Modify: `tools/summonable-hero-runtime-lib.ts`
- Modify: `tools/summonable-hero-runtime-lib.spec.ts`
- Modify generated: `apps/web/static/runtime/summonable-heroes-v1/manifest.json`

**Interfaces:**
- Consumes: `VillageCutoutBindingSchema`, `SummonableHeroEntrySchema`, `SummonableHeroRuntimeEntrySchema`, and the current v2 source/runtime manifests.
- Produces: `ApprovedVillageRunSourceSchema`, `VillageRunBindingSchema`, `VillageRunRuntimePackSchema`, optional `entry.visuals.villageRun`, optional `runtimeEntry.villageRun`, source schema `summonable-hero-catalog-v3`, runtime schema `summonable-hero-runtime-manifest-v3`, and exporter `summonable-hero-runtime-exporter-v3`.

- [ ] **Step 1: Write failing source-contract tests**

  In `packages/contracts/src/summonable-hero.spec.ts`, advance valid fixture catalogs to v3 and add a helper that binds a run source to the first entry's exact cutout:

  ```ts
  function withVillageRun(entry: SummonableHeroEntry): SummonableHeroEntry {
    const cutout = entry.visuals.villageCutout!;
    return {
      ...entry,
      visuals: {
        ...entry.visuals,
        villageRun: {
          sourceVillageCutoutAssetKey: cutout.asset.assetKey,
          sourceVillageCutoutContentHash: cutout.asset.contentHash,
          actionAuthority: 'classical-human-run-5',
          support: ['left', 'left', 'none', 'right', 'right'],
          directions: ['toward-camera', 'away-camera'],
          source: {
            assetKey: `${entry.heroId}-village-run-v1`,
            role: 'village-run',
            status: 'approved',
            file: `assets/heroes/experiments/village-run-current-company-001/heroes/${entry.heroId}/candidate-source-v1.png`,
            width: 1536,
            height: 1024,
            bytes: 1000,
            contentHash: 'a'.repeat(64),
            sourceExperimentId: 'village-run-current-company-001',
            approvalId: 'village-run-current-company-001-owner-approval-v1'
          }
        }
      }
    };
  }
  ```

  Add assertions that a partial catalog with one binding parses, while bindings with a different
  cutout asset key, cutout hash, action authority, support order, direction list, non-approved source,
  or non-`1536x1024` source are rejected. Assert a run binding is rejected when `villageCutout` is
  absent.

- [ ] **Step 2: Run the source-contract test and verify RED**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/summonable-hero.spec.ts
  ```

  Expected: FAIL because v3 and `villageRun` are not defined.

- [ ] **Step 3: Implement the source binding and advance the catalog schema**

  Add strict schemas with these exact fields:

  ```ts
  export const ApprovedVillageRunSourceSchema = z.object({
    assetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
    role: z.literal('village-run'),
    status: z.literal('approved'),
    file: z.string().regex(/^assets\/heroes\/[a-z0-9./-]+\.png$/u)
      .refine((value) => !value.includes('..'), { message: 'Village run source path cannot traverse' }),
    width: z.literal(1536),
    height: z.literal(1024),
    bytes: z.number().int().positive(),
    contentHash: StateHashSchema,
    sourceExperimentId: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
    approvalId: z.string().regex(/^[a-z][a-z0-9-]{2,119}$/u)
  }).strict();

  export const VillageRunBindingSchema = z.object({
    sourceVillageCutoutAssetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
    sourceVillageCutoutContentHash: StateHashSchema,
    actionAuthority: z.literal('classical-human-run-5'),
    support: z.tuple([
      z.literal('left'), z.literal('left'), z.literal('none'),
      z.literal('right'), z.literal('right')
    ]),
    directions: z.tuple([z.literal('toward-camera'), z.literal('away-camera')]),
    source: ApprovedVillageRunSourceSchema
  }).strict();
  ```

  Add `villageRun: VillageRunBindingSchema.optional()` after `villageCutout`. In the entry
  refinement, require a cutout and exact asset-key/hash equality. Include the run source asset key in
  catalog-wide uniqueness. Change the source literal to `summonable-hero-catalog-v3` and change only
  the root `schemaVersion` in the approved catalog; do not add any run binding.

- [ ] **Step 4: Write failing runtime-pack tests**

  In `tools/summonable-hero-runtime-lib.spec.ts`, add a fixture with one valid source binding and an
  already-built pack descriptor:

  ```ts
  const pack = {
    alias: 'hero.yaso-dreno.village-run',
    actionAuthority: 'classical-human-run-5' as const,
    framesPerSecond: 10,
    loop: true,
    towardFrames: ['run-toward-01', 'run-toward-02', 'run-toward-03', 'run-toward-04', 'run-toward-05'],
    awayFrames: ['run-away-01', 'run-away-02', 'run-away-03', 'run-away-04', 'run-away-05'],
    atlasJsonPublicPath: '/runtime/summonable-heroes-v1/yaso-dreno/village-run-atlas.abc.json',
    atlasImagePublicPath: '/runtime/summonable-heroes-v1/yaso-dreno/village-run.abc.webp',
    motionManifestPublicPath: '/runtime/summonable-heroes-v1/yaso-dreno/village-run-manifest.abc.json',
    bytes: 500000,
    decodedRgbaBytes: 3932160,
    sourceAssetKey: 'yaso-dreno-village-run-v1',
    sourceContentHash: 'a'.repeat(64),
    contentHash: 'b'.repeat(64)
  };
  ```

  Assert `VillageRunRuntimePackSchema` accepts this pack and rejects 11 frames, 9 FPS, a non-looping
  clip, a decoded byte count other than `3932160`, a byte count over `600000`, or a non-content-
  addressed public path. Assert an entry without a source binding has no runtime pack.

- [ ] **Step 5: Run the runtime-contract tests and verify RED**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/summonable-hero.spec.ts tools/summonable-hero-runtime-lib.spec.ts
  ```

  Expected: FAIL because `VillageRunRuntimePackSchema` and v3 runtime fields do not exist.

- [ ] **Step 6: Implement the v3 runtime schema and empty-pack exporter compatibility**

  Add `VillageRunRuntimePackSchema` to `packages/contracts/src/summonable-hero.ts` with the exact
  fields exercised above. Use five-element tuples for each frame direction and regexes that require
  `/runtime/summonable-heroes-v1/<hero-id>/village-run*.{json,webp}` paths. Add
  `villageRun: VillageRunRuntimePackSchema.optional()` to each runtime entry.

  Advance runtime and exporter literals to v3. Compute manifest `totalBytes` as static bundle bytes
  plus optional run-pack bytes. A Pixi bundle must contain each static asset plus one atlas-JSON alias
  when `villageRun` exists. Keep all 200 entries valid with no packs at this step, then regenerate the
  checked-in runtime manifest.

- [ ] **Step 7: Verify the contract and generated manifest**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/summonable-hero.spec.ts packages/contracts/src/contracts.spec.ts tools/summonable-hero-runtime-lib.spec.ts
  pnpm --filter @summonlab/contracts typecheck
  pnpm validate:summonable-hero-runtime
  git diff --check
  ```

  Expected: all commands PASS; the catalog and runtime manifest are v3 with zero Village-run packs.

- [ ] **Step 8: Commit the contract slice**

  ```bash
  git add packages/contracts/src/summonable-hero.ts packages/contracts/src/summonable-hero.spec.ts assets/heroes/approved/summonable-roster-v1/catalog.json tools/summonable-hero-runtime-lib.ts tools/summonable-hero-runtime-lib.spec.ts apps/web/static/runtime/summonable-heroes-v1/manifest.json
  git commit -m "feat(heroes): define village run packs"
  ```

---

### Task 2: Build collision-safe Village-run production and review tooling

**Files:**
- Create: `tools/village-run-motion-lib.ts`
- Create: `tools/village-run-motion-lib.spec.ts`
- Create: `tools/build-village-run-motion-pack.ts`
- Create: `tools/export-village-run-review.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: a `1536x1024` five-column, two-row provider PNG and the exact approved Village-cutout binding.
- Produces: `VILLAGE_RUN_BATCH_ID`, `VillageRunCandidateManifestSchema`, `buildVillageRunCandidate(...)`, `validateVillageRunCandidate(...)`, a collision-safe CLI, deterministic `1280x768` candidate atlas PNG, Pixi atlas JSON, motion manifest JSON, static review PNG, and 10-FPS browser review HTML.

- [ ] **Step 1: Write failing builder tests**

  In `tools/village-run-motion-lib.spec.ts`, generate a synthetic `1536x1024` pale-background plate
  with ten distinct opaque subjects using Sharp. Test:

  ```ts
  const built = await buildVillageRunCandidate({
    heroId: 'yaso-dreno',
    displayName: 'Yaso Dreno',
    providerBytes,
    sourceVillageCutoutAssetKey: 'yaso-dreno-village-cutout-v1',
    sourceVillageCutoutContentHash: 'a'.repeat(64),
    characterManifestHash: 'b'.repeat(64),
    prompt: 'bounded test prompt',
    providerResultPath: 'generated/provider.png'
  });
  expect(await sharp(built.atlasPng).metadata()).toMatchObject({
    width: 1280, height: 768, hasAlpha: true
  });
  expect(built.motionManifest).toMatchObject({
    actionAuthority: 'classical-human-run-5',
    support: ['left', 'left', 'none', 'right', 'right'],
    framesPerSecond: 10,
    loop: true
  });
  expect(built.atlas.animations['run-toward']).toHaveLength(5);
  expect(built.atlas.animations['run-away']).toHaveLength(5);
  ```

  Also assert rejection of wrong source dimensions, empty cells, edge-touching subjects, background
  that cannot be isolated, unequal logical source sizes, changed foot anchors, duplicate frame
  hashes, and output paths outside the declared batch.

- [ ] **Step 2: Run the builder tests and verify RED**

  Run:

  ```bash
  pnpm vitest run tools/village-run-motion-lib.spec.ts
  ```

  Expected: FAIL because the production library does not exist.

- [ ] **Step 3: Implement deterministic extraction and manifests**

  Export these constants:

  ```ts
  export const VILLAGE_RUN_BATCH_ID = 'village-run-current-company-001';
  export const SOURCE_WIDTH = 1536;
  export const SOURCE_HEIGHT = 1024;
  export const FRAME_WIDTH = 256;
  export const FRAME_HEIGHT = 384;
  export const FEET_Y = 372;
  export const COLUMNS = 5;
  export const ROWS = 2;
  export const FPS = 10;
  ```

  Adapt the proven connected-component isolation pattern in
  `tools/build-realtime-combat-motion-pack.mjs`: split using floor-divided source cell bounds plus a
  24-pixel overlap, isolate the substantial component nearest each expected cell center, clear the
  pale background into true alpha, calculate one common scale across all ten frames, and place every
  subject on a `256x384` transparent cell with bottom-center anchor `{ x: 0.5, y: 0.96875 }`.

  Name frames `run-toward-01`…`05` in row 0 and `run-away-01`…`05` in row 1. The motion manifest must
  record the source/cutout/character hashes, exact prompt, provider result path, action authority,
  support, directions, FPS, loop, logical size, anchor, per-frame alpha bounds and hashes, and
  lifecycle `candidate`.

- [ ] **Step 4: Write failing collision and review-export tests**

  Add tests that `build-village-run-motion-pack.ts` refuses to overwrite provider, candidate, atlas,
  manifest, or review evidence; refuses symlink parents; writes only beneath
  `assets/heroes/experiments/village-run-current-company-001/`; and that `--check` recomputes every
  byte and fails on drift.

  Test that `exportVillageRunReview(...)` emits:

  ```ts
  {
    contactSheetPath: 'assets/heroes/experiments/village-run-current-company-001/review/yaso-dreno-v1.png',
    playbackPath: 'assets/heroes/experiments/village-run-current-company-001/review/yaso-dreno-v1.html'
  }
  ```

  The HTML must contain two raster-only 10-FPS loops at `96x144` and `192x288`, three repetitions per
  direction, the frame order and hashes, and no inline SVG, canvas character drawing, remote URL, or
  executable dependency.

- [ ] **Step 5: Run the tooling tests and verify RED**

  Run:

  ```bash
  pnpm vitest run tools/village-run-motion-lib.spec.ts
  ```

  Expected: FAIL on the unimplemented persistence and review functions.

- [ ] **Step 6: Implement the CLIs and repository scripts**

  `build-village-run-motion-pack.ts` accepts:

  ```text
  --hero <slug> --provider-result <absolute png> --prompt-file <absolute text>
  --cutout-asset-key <slug> --cutout-hash <sha256> --manifest-hash <sha256> --version <integer>
  ```

  It reads the provider file, verifies PNG dimensions, then creates immutable provider source,
  byte-identical candidate source, candidate atlas, atlas JSON, motion manifest, and result receipt
  using exclusive file creation. `export-village-run-review.ts --hero <slug> --version <integer>
  --write|--check` deterministically derives the review PNG and HTML from those candidate files.

  Add scripts:

  ```json
  "build:village-run-motion": "tsx tools/build-village-run-motion-pack.ts",
  "export:village-run-review": "tsx tools/export-village-run-review.ts",
  "validate:village-run-motion": "vitest run tools/village-run-motion-lib.spec.ts"
  ```

- [ ] **Step 7: Verify and commit the tooling**

  Run:

  ```bash
  pnpm validate:village-run-motion
  pnpm exec prettier --check tools/village-run-motion-lib.ts tools/village-run-motion-lib.spec.ts tools/build-village-run-motion-pack.ts tools/export-village-run-review.ts package.json
  pnpm typecheck:packaging
  git diff --check
  ```

  Expected: all commands PASS.

  ```bash
  git add tools/village-run-motion-lib.ts tools/village-run-motion-lib.spec.ts tools/build-village-run-motion-pack.ts tools/export-village-run-review.ts package.json
  git commit -m "feat(heroes): build village run candidates"
  ```

---

### Task 3: Produce and review the Yaso run calibration

**Files:**
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/yaso-dreno/provider-source-v1.png`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/yaso-dreno/candidate-source-v1.png`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/yaso-dreno/candidate-atlas-v1.png`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/yaso-dreno/candidate-atlas-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/yaso-dreno/candidate-motion-manifest-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/yaso-dreno/result-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/prompts/yaso-dreno-v1.txt`
- Create generated: `assets/heroes/experiments/village-run-current-company-001/review/yaso-dreno-v1.png`
- Create generated: `assets/heroes/experiments/village-run-current-company-001/review/yaso-dreno-v1.html`

**Interfaces:**
- Consumes: approved Yaso Village cutout `assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/yaso-dreno/candidate-v1.png`, Yaso's approved summon source and manifest hash, `classical-human-run-5`, and Task 2's collision-safe builder.
- Produces: one immutable candidate Yaso two-direction run pack and owner-review evidence. It produces no approved catalog binding.

- [ ] **Step 1: Read the required production skills and write the exact clip brief**

  Read `.agents/skills/summonlab-character-animations/SKILL.md`, its `clip-contracts.md` and
  `known-actions.md`, plus `/home/joao/.codex/skills/.system/imagegen/SKILL.md`. Write the required
  clip brief into the prompt file, including Yaso's exact approved source path/hash/approval,
  equipment and identity locks, both directions, mirror policy, 5×2 source regions, 10 FPS loop, and
  output version.

- [ ] **Step 2: Generate one temporal-unit raster sheet with image generation**

  Use the approved Yaso cutout as the first referenced image and Yaso's approved summon source as the
  second. The generation prompt must contain this exact production request after the clip brief:

  ```text
  Produce one finished 1536x1024 raster character-motion sheet for the same adult hero, Yaso Dreno.
  Use exactly five evenly spaced full-body poses across the top row facing three-quarter toward the
  camera and the same five ordered beats across the bottom row facing three-quarter away. In each row:
  1 left-foot contact, 2 left-leg compression and push, 3 airborne pass with neither foot planted,
  4 distinct right-foot contact, 5 right-leg recovery that loops naturally into frame 1. Preserve
  Yaso's exact face, normal adult proportions, hair, clothing, equipment, palette, handedness, and
  silhouette from the references. Keep one fixed high-three-quarter Village camera, identical scale,
  bottom-center foot line, and generous separation in every cell. Use a flat near-white removable
  studio field. No scenery, ground shadow, text, labels, borders, grid lines, effects, duplicate pose,
  planted airborne frame, chibi proportions, extra limbs, detached gear, or design change.
  ```

  Persist the returned provider image through Task 2's builder; do not copy it with an untracked shell
  command or overwrite an existing attempt.

- [ ] **Step 3: Build and validate the candidate pack**

  Run the builder with the exact catalog-derived values, then:

  ```bash
  pnpm export:village-run-review --hero yaso-dreno --version 1 --write
  pnpm export:village-run-review --hero yaso-dreno --version 1 --check
  pnpm validate:village-run-motion
  ```

  Expected: PASS with ten nonduplicate, alpha-bounded frames, equal anchors, correct source binding,
  and immutable review artifacts.

- [ ] **Step 4: Inspect source resolution and runtime playback**

  Inspect the review PNG at original resolution. Serve the experiment directory on `0.0.0.0` and
  review the HTML at 10 FPS using the remote server address from `AGENTS.md`. Watch at least three
  loops per direction and record pass/fail for temporal causality, foot support, identity,
  equipment, registration, loop seam, runtime reachability, and gameplay read in `result-v1.json`.
  The lifecycle remains `candidate` regardless of internal review result.

- [ ] **Step 5: Validate, commit, push, and stop for owner acceptance**

  Run:

  ```bash
  pnpm export:village-run-review --hero yaso-dreno --version 1 --check
  git diff --check
  ```

  Commit and push the candidate evidence:

  ```bash
  git add assets/heroes/experiments/village-run-current-company-001
  git commit -m "feat(heroes): prepare Yaso village run"
  git push origin codex/persistent-village-cutouts
  ```

  Present the review PNG and 10-FPS browser preview to the owner. Stop here until the owner explicitly
  accepts Yaso or requests a versioned correction. Do not generate Oren or Joror yet.

---

### Task 4: Produce the accepted current-company motion pack

**Files:**
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/approval-yaso-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/oren-sorin/provider-source-v1.png`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/oren-sorin/candidate-source-v1.png`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/oren-sorin/candidate-atlas-v1.png`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/oren-sorin/candidate-atlas-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/oren-sorin/candidate-motion-manifest-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/oren-sorin/result-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/joror-pelleth/provider-source-v1.png`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/joror-pelleth/candidate-source-v1.png`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/joror-pelleth/candidate-atlas-v1.png`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/joror-pelleth/candidate-atlas-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/joror-pelleth/candidate-motion-manifest-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/heroes/joror-pelleth/result-v1.json`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/prompts/oren-sorin-v1.txt`
- Create exclusively: `assets/heroes/experiments/village-run-current-company-001/prompts/joror-pelleth-v1.txt`
- Create generated: `assets/heroes/experiments/village-run-current-company-001/manifest-v1.json`
- Create generated: `assets/heroes/experiments/village-run-current-company-001/review/current-company-v1.png`
- Create generated: `assets/heroes/experiments/village-run-current-company-001/review/current-company-v1.html`
- Create after owner decision: `assets/heroes/experiments/village-run-current-company-001/approval-v1.json`

**Interfaces:**
- Consumes: explicit Yaso acceptance, the approved Oren/Joror cutouts and summon identities, and the exact accepted Yaso camera/scale/layout contract.
- Produces: three separately source-bound candidate packs, an aggregate immutable manifest, three-hero review evidence, and an owner approval receipt. It still does not modify the approved hero catalog.

- [ ] **Step 1: Record Yaso's owner decision immutably**

  Write `approval-yaso-v1.json` with schema version, batch ID, hero ID, candidate manifest hash,
  reviewer `owner`, review date, exact user acceptance text, verdict `approved`, and the hashes of the
  source sheet, candidate atlas, review PNG, and review HTML. Validate every hash before writing with
  exclusive creation.

- [ ] **Step 2: Write Oren and Joror clip briefs**

  Copy the accepted motion/camera/anchor/runtime fields from Yaso, then bind each brief to its own
  approved cutout, summon source, character ID, manifest hash, equipment, and approval record. Do not
  use Yaso's pixels as an identity reference.

- [ ] **Step 3: Generate Oren and Joror as separate temporal units**

  For each hero, use exactly that hero's cutout and summon source as image references and use the same
  ten-beat prompt structure from Task 3 with the correct display name. Make one image-generation call
  per hero. Persist and build each provider result into its own exclusive v1 paths.

- [ ] **Step 4: Export and validate aggregate evidence**

  Extend `export-village-run-review.ts` so `--company --write|--check` validates all three candidate
  manifests, Yaso's approval, source hashes, distinct character IDs, distinct frame hashes, common
  logical geometry, and 10-FPS playback. It emits a three-hero contact sheet and HTML with both
  directions at runtime scale.

  Run:

  ```bash
  pnpm export:village-run-review --hero oren-sorin --version 1 --write
  pnpm export:village-run-review --hero joror-pelleth --version 1 --write
  pnpm export:village-run-review --company --write
  pnpm export:village-run-review --company --check
  pnpm validate:village-run-motion
  ```

- [ ] **Step 5: Inspect, commit, push, and stop for current-company acceptance**

  Review every direction for every hero at source and gameplay scale for at least three loops. Commit
  and push the candidate pack and review evidence:

  ```bash
  git add assets/heroes/experiments/village-run-current-company-001 tools/export-village-run-review.ts
  git commit -m "feat(heroes): prepare company village runs"
  git push origin codex/persistent-village-cutouts
  ```

  Present the aggregate PNG and 10-FPS preview. Stop until the owner explicitly approves all three or
  requests a versioned correction.

- [ ] **Step 6: Record the aggregate owner approval**

  After explicit acceptance, exclusively create `approval-v1.json` containing the exact user text,
  aggregate manifest hash, accepted hero IDs, and every candidate/source/review hash. Re-run
  `--company --check`, commit, and push:

  ```bash
  git add assets/heroes/experiments/village-run-current-company-001/approval-v1.json
  git commit -m "docs(heroes): approve company village runs"
  git push origin codex/persistent-village-cutouts
  ```

---

### Task 5: Promote approved motion and export lazy runtime packs

**Files:**
- Create: `tools/promote-village-run-current-company.ts`
- Create: `tools/promote-village-run-current-company.spec.ts`
- Modify: `tools/summonable-hero-runtime-lib.ts`
- Modify: `tools/summonable-hero-runtime-lib.spec.ts`
- Modify: `tools/export-summonable-hero-runtime.ts`
- Modify: `assets/heroes/approved/summonable-roster-v1/catalog.json`
- Modify generated: `apps/web/static/runtime/summonable-heroes-v1/manifest.json`
- Create generated beneath each of `apps/web/static/runtime/summonable-heroes-v1/yaso-dreno/`, `apps/web/static/runtime/summonable-heroes-v1/oren-sorin/`, and `apps/web/static/runtime/summonable-heroes-v1/joror-pelleth/`: `village-run.<atlas-hash-prefix>.webp`, `village-run-atlas.<atlas-json-hash-prefix>.json`, and `village-run-manifest.<motion-manifest-hash-prefix>.json`, where every prefix is the first 12 lowercase hexadecimal characters of that file's SHA-256.
- Modify: `apps/web/src/lib/server/runtime-portraits.ts`
- Modify: `apps/web/src/lib/server/runtime-portraits.spec.ts`
- Modify: `apps/web/src/lib/village-shell.ts`
- Modify: `apps/web/src/routes/play/[runId]/+page.server.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 4's approved immutable batch and Task 1's v3 source/runtime contracts.
- Produces: three catalog `villageRun` bindings, content-addressed runtime atlas/atlas-JSON/motion-manifest trios, `RuntimeVillageRun`, `runtimeVillageRunFor(manifestHash: string): RuntimeVillageRun | null`, and `VillageResident.sceneMotion`.

- [ ] **Step 1: Write failing promotion and runtime tests**

  Test that promotion refuses a missing/non-approved/stale approval receipt, any source or review hash
  drift, an unaccepted hero, a source binding that does not match the catalog cutout, or an already
  populated binding. Assert the successful transform changes exactly Yaso, Oren, and Joror and is
  deterministic in `--check` mode.

  Extend runtime tests to expect three packs and these invariants:

  ```ts
  expect(runtime.entries.filter((entry) => entry.villageRun)).toHaveLength(3);
  expect(runtime.entries.find((entry) => entry.heroId === 'yaso-dreno')!.villageRun).toMatchObject({
    actionAuthority: 'classical-human-run-5',
    framesPerSecond: 10,
    loop: true,
    decodedRgbaBytes: 3932160
  });
  ```

  In `runtime-portraits.spec.ts`, assert the exact manifest hash resolves a motion pack and an unknown
  hash returns `null` without borrowing another hero's pack.

- [ ] **Step 2: Run focused tests and verify RED**

  Run:

  ```bash
  pnpm vitest run tools/promote-village-run-current-company.spec.ts tools/summonable-hero-runtime-lib.spec.ts apps/web/src/lib/server/runtime-portraits.spec.ts
  ```

  Expected: FAIL because promotion, runtime pack export, and resolution are absent.

- [ ] **Step 3: Implement approval-bound promotion**

  `promote-village-run-current-company.ts --write|--check` must parse the v3 catalog and approved batch,
  recompute all hashes, construct the three bindings, validate the transformed catalog, format it with
  Prettier, and either exclusively compare or atomically replace only the catalog file. Add:

  ```json
  "promote:village-run-current-company": "tsx tools/promote-village-run-current-company.ts --write",
  "validate:village-run-current-company": "tsx tools/promote-village-run-current-company.ts --check"
  ```

- [ ] **Step 4: Implement content-addressed runtime export**

  For each approved binding, use Task 2's normalized candidate frames and Sharp to encode one
  transparent `1280x768` WebP with quality 82, effort 6, drawing preset, smart subsampling, and stripped
  metadata. Reject any image over `600000` bytes or without true alpha.

  Write atlas JSON whose `meta.image` names the content-addressed WebP and whose ten frames retain
  `256x384` source sizes and `{ x: 0.5, y: 0.96875 }` anchors. Write a content-addressed motion
  manifest containing the atlas paths, two frame tuples, FPS, loop, action authority, source hashes,
  total encoded bytes, and decoded bytes. Include the atlas-JSON alias in the hero's existing Pixi
  bundle and all three file sizes in `villageRun.bytes`.

  Extend the exporter `--check` inventory so stale or extra atlas, JSON, or manifest files fail just
  as stale static hero art does.

- [ ] **Step 5: Implement server-only motion resolution**

  Define the browser-safe data shape in `apps/web/src/lib/village-shell.ts`:

  ```ts
  export interface RuntimeVillageRun {
    readonly atlasJsonPublicPath: string;
    readonly atlasImagePublicPath: string;
    readonly motionManifestPublicPath: string;
    readonly framesPerSecond: 10;
    readonly towardFrames: readonly [string, string, string, string, string];
    readonly awayFrames: readonly [string, string, string, string, string];
    readonly decodedRgbaBytes: 3932160;
  }

  export function runtimeVillageRunFor(manifestHash: string): RuntimeVillageRun | null;
  ```

  Implement only the resolver function in `runtime-portraits.ts`; it imports the data type from
  `village-shell.ts` and resolves only exact `manifestHash` equality. Add
  `sceneMotion: RuntimeVillageRun | null` to `VillageResident`, and populate it in `+page.server.ts`
  beside `sceneArt`. Browser components import this type only from `village-shell.ts`, never from a
  `$lib/server` module.

- [ ] **Step 6: Promote, export, and verify**

  Run:

  ```bash
  pnpm promote:village-run-current-company
  pnpm export:summonable-hero-runtime
  pnpm validate:village-run-current-company
  pnpm validate:summonable-hero-runtime
  pnpm vitest run tools/promote-village-run-current-company.spec.ts tools/summonable-hero-runtime-lib.spec.ts apps/web/src/lib/server/runtime-portraits.spec.ts
  pnpm --filter @summonlab/web check
  git diff --check
  ```

  Expected: PASS with three approved run bindings and three lazy runtime packs.

- [ ] **Step 7: Commit the promoted runtime slice**

  ```bash
  git add tools/promote-village-run-current-company.ts tools/promote-village-run-current-company.spec.ts tools/summonable-hero-runtime-lib.ts tools/summonable-hero-runtime-lib.spec.ts tools/export-summonable-hero-runtime.ts assets/heroes/approved/summonable-roster-v1/catalog.json apps/web/static/runtime/summonable-heroes-v1 apps/web/src/lib/server/runtime-portraits.ts apps/web/src/lib/server/runtime-portraits.spec.ts apps/web/src/lib/village-shell.ts apps/web/src/routes/play/'[runId]'/+page.server.ts package.json
  git commit -m "feat(heroes): promote village run packs"
  ```

---

### Task 6: Implement deterministic compressed travel playback math

**Files:**
- Create: `apps/web/src/lib/village-travel.ts`
- Create: `apps/web/src/lib/village-travel.spec.ts`

**Interfaces:**
- Consumes: `SettlementPresentation['occupants'][number]`, `SettlementSceneDefinition['nodeProjections']`, and normalized points.
- Produces: `VillageTravelPath`, `VillageTravelDirection`, `villageJourneyKey(...)`, `buildVillageTravelPath(...)`, `villageTravelDurationMs(...)`, `pointAlongVillageTravel(...)`, `villageTravelDirection(...)`, and `villageTravelDepth(...)`.

  ```ts
  export function villageJourneyKey(
    occupant: SettlementPresentation['occupants'][number]
  ): string | null;
  export function buildVillageTravelPath(
    occupant: SettlementPresentation['occupants'][number],
    nodeProjections: SettlementSceneDefinition['nodeProjections']
  ): VillageTravelPath | null;
  export function villageTravelDurationMs(path: VillageTravelPath): number;
  export function pointAlongVillageTravel(
    path: VillageTravelPath,
    progress: number
  ): NormalizedScenePoint;
  export function villageTravelDirection(
    from: NormalizedScenePoint,
    to: NormalizedScenePoint,
    previous: 'toward-camera' | 'away-camera' | null
  ): VillageTravelDirection;
  export function villageTravelDepth(point: NormalizedScenePoint, ordinal: number): number;
  ```

- [ ] **Step 1: Write failing path and duration tests**

  Cover unresolved/consecutive duplicate nodes, mid-route projected progress, constant-distance
  interpolation across unequal segments, and exact clamps:

  ```ts
  const fixturePath = (
    points: readonly NormalizedScenePoint[],
    segmentLengths: readonly number[],
    totalLength: number
  ): VillageTravelPath => ({ points, segmentLengths, totalLength });
  expect(villageTravelDurationMs(fixturePath([{ x: 0, y: 0 }, { x: 0.25, y: 0 }], [0.25], 0.25))).toBe(3500);
  expect(villageTravelDurationMs(fixturePath([{ x: 0, y: 0 }, { x: 2, y: 0 }], [2], 2))).toBe(5000);
  expect(villageTravelDurationMs(fixturePath([{ x: 0, y: 0 }], [], 0))).toBe(3000);
  const route = fixturePath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.5 }], [1, 0.5], 1.5);
  expect(pointAlongVillageTravel(route, 0.5)).toEqual({ x: 0.75, y: 0 });
  ```

  Assert the journey key is exactly `heroId:startedAt:arrivesAt:toNodeId`; positive/negative `dy`
  selects toward/away; `abs(dy) <= 0.002` retains prior direction; negative `dx` mirrors; and depth
  uses normalized `y` plus ordinal tie-breaking.

- [ ] **Step 2: Run the unit test and verify RED**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/village-travel.spec.ts
  ```

  Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure travel module**

  Define:

  ```ts
  export interface VillageTravelPath {
    readonly points: readonly NormalizedScenePoint[];
    readonly segmentLengths: readonly number[];
    readonly totalLength: number;
  }

  export interface VillageTravelDirection {
    readonly row: 'toward-camera' | 'away-camera';
    readonly mirrored: boolean;
  }
  ```

  Slice the full route at authoritative `travel.progress` for mid-journey page entry, preserve the
  interpolated first point, and use Euclidean cumulative distance. Clamp progress inputs to `0..1`.
  The module must not read `Date.now`, DOM state, or PixiJS.

- [ ] **Step 4: Verify and commit the playback model**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/village-travel.spec.ts apps/web/src/lib/village-scene.spec.ts
  pnpm --filter @summonlab/web check
  git diff --check
  ```

  Expected: PASS.

  ```bash
  git add apps/web/src/lib/village-travel.ts apps/web/src/lib/village-travel.spec.ts
  git commit -m "feat(village): model compressed hero travel"
  ```

---

### Task 7: Add the lazy single-canvas PixiJS travel layer

**Files:**
- Create: `apps/web/src/lib/components/village-shell/VillageTravelLayer.svelte`
- Create: `apps/web/src/lib/components/village-shell/village-travel-controller.ts`
- Create: `apps/web/src/lib/components/village-shell/village-travel-controller.spec.ts`

**Interfaces:**
- Consumes: projected `VillageSceneResident[]`, Task 5 `sceneMotion`, Task 6 path utilities, and effective player motion.
- Produces: one transparent canvas with `data-testid="village-travel-canvas"`, diagnostics `data-renderer-state` and `data-active-traveler-count`, `VillageTravelController`, and callbacks `onPlaybackStart(heroId)` / `onPlaybackSettle(heroId)`.

- [ ] **Step 1: Write failing controller lifecycle tests**

  Use a fake clock and renderer adapter. Assert that a new journey key starts exactly once, repeated
  projections do not restart it, a replacement journey begins at the current rendered point, a
  hidden tab pauses elapsed playback time, arrival before 3000 ms does not snap, settling stops the
  private ticker when active count reaches zero, and dispose cancels late asset loads.

  Add reduced/failure tests asserting no `loadRenderer` or `loadMotion` call and a settled static
  callback when motion is reduced, the pack is missing, path resolution fails, or load rejects.

- [ ] **Step 2: Run controller tests and verify RED**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/components/village-shell/village-travel-controller.spec.ts
  ```

  Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement the renderer-independent controller**

  Define a small adapter instead of importing PixiJS in the controller:

  ```ts
  export interface VillageTravelRenderer {
    loadMotion(heroId: string, motion: RuntimeVillageRun): Promise<void>;
    show(heroId: string, frameNames: readonly string[]): void;
    place(heroId: string, point: NormalizedScenePoint, direction: VillageTravelDirection, depth: number): void;
    hide(heroId: string): void;
    start(): void;
    stop(): void;
    destroy(): Promise<void> | void;
  }
  ```

  The controller owns observed journey keys, per-hero elapsed visible milliseconds, current points,
  direction dead-zone state, and active playback count. It accepts `step(deltaMs)` so tests never
  depend on real animation frames.

- [ ] **Step 4: Implement the lazy PixiJS Svelte adapter**

  `VillageTravelLayer.svelte` renders no canvas until at least one full-motion journey with a pack is
  present. Then dynamically import exactly:

  ```ts
  const { AnimatedSprite, Application, Assets, Container } = await import('pixi.js');
  ```

  Initialize one application with:

  ```ts
  await app.init({
    canvas,
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: false,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoStart: false,
    sharedTicker: false,
    preference: 'webgl',
    powerPreference: 'high-performance'
  });
  app.ticker.maxFPS = 60;
  ```

  Use one sortable container, one `AnimatedSprite({ textures, autoUpdate: false })` per active hero,
  bottom-center anchor, and renderer-local frame advancement at 10 FPS. `Assets.load` receives only
  the hero's atlas JSON public path. Retain loaded packs until component teardown, then call
  `Assets.unload` for each and
  `app.destroy({ removeView: false, releaseGlobalResources: true }, { children: true })`.

  The canvas must have `aria-hidden="true"` and `pointer-events:none`. Subscribe to the root
  `data-player-motion` attribute and `matchMedia('(prefers-reduced-motion: reduce)')`; changing to
  reduced motion disposes the renderer and settles static destinations.

- [ ] **Step 5: Verify focused lifecycle behavior and commit**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/components/village-shell/village-travel-controller.spec.ts apps/web/src/lib/village-travel.spec.ts
  pnpm --filter @summonlab/web check
  pnpm exec prettier --check apps/web/src/lib/components/village-shell/VillageTravelLayer.svelte apps/web/src/lib/components/village-shell/village-travel-controller.ts apps/web/src/lib/components/village-shell/village-travel-controller.spec.ts
  git diff --check
  ```

  Expected: PASS with no static `pixi.js` value import in the route dependency graph.

  ```bash
  git add apps/web/src/lib/components/village-shell/VillageTravelLayer.svelte apps/web/src/lib/components/village-shell/village-travel-controller.ts apps/web/src/lib/components/village-shell/village-travel-controller.spec.ts
  git commit -m "feat(village): render lazy hero travel"
  ```

---

### Task 8: Integrate travel into the persistent Village and prove phone performance

**Files:**
- Modify: `apps/web/src/lib/components/LivingHearthScene.svelte`
- Modify: `apps/web/src/lib/village-scene.ts`
- Modify: `apps/web/src/lib/village-scene.spec.ts`
- Modify: `apps/web/src/routes/village-shell.e2e.ts`
- Modify: `apps/web/src/routes/performance.e2e.ts`
- Modify generated: `docs/evidence/phase-3-runtime-budget.json`
- Create evidence: `docs/evidence/persistent-village-travel-desktop.png`
- Create evidence: `docs/evidence/persistent-village-travel-phone.png`

**Interfaces:**
- Consumes: Task 5 resident motion metadata, Task 6 path math, Task 7 renderer and callbacks, current scene residents, SSE-triggered projection refreshes, and the fixed campaign seed.
- Produces: moving persistent-play residents with stable DOM links/static fallbacks and automated desktop, phone, reduced-motion, failure, simultaneous-travel, lazy-load, and performance evidence.

- [ ] **Step 1: Write failing scene and browser assertions**

  Extend scene projection so a traveling resident exposes its destination point separately from its
  authoritative projected point. Unit-test source point, destination point, and deterministic shared-
  node cluster offsets.

  In Playwright, intercept resource requests and assert an idle Village loads no URL containing the
  Pixi chunk or `village-run`. Trigger a real `hero.start.travel` through the existing run command API,
  then assert:

  ```ts
  await expect(page.getByTestId('village-travel-canvas')).toHaveCount(1);
  await expect(page.getByTestId('living-settlement')).toHaveAttribute('data-active-traveler-count', '1');
  await expect(page.getByTestId('living-settlement').locator('.scene-resident.is-traveling img.resident-cutout')).toBeHidden();
  await expect(page.getByRole('link', { name: /^Yaso Dreno:/u })).toBeVisible();
  ```

  Sample the renderer diagnostic at 500 ms and 2500 ms to prove position changes, assert the duration
  is between 3000 and 5000 ms, force a projection refresh mid-run and prove the journey key/start time
  do not change, then assert active count returns to zero and the ticker diagnostic is `idle`.

- [ ] **Step 2: Run focused browser coverage and verify RED**

  Run:

  ```bash
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts
  ```

  Expected: FAIL because the scene has no travel layer or diagnostics.

- [ ] **Step 3: Integrate the layer without changing semantic ownership**

  Add `destinationPoint` to `VillageSceneResident`. Mount one `VillageTravelLayer` after the building
  overlays and before the DOM residents. Track only a `Set<string>` of active hero IDs in
  `LivingHearthScene`; use it to add `.is-traveling`, hide that hero's cutout, and anchor the existing
  DOM link/activity tag at `destinationPoint`. Do not move the DOM link every frame or render labels
  in PixiJS.

  Forward renderer state and active count as `data-*` attributes on `living-settlement`. Preserve the
  existing `Art pending`, image-error fallback, resident deep links, focus outline, building chips,
  state seal, occupancy ledger, and event cue.

- [ ] **Step 4: Cover reduced motion, failure, simultaneous travel, and phone layout**

  Add Playwright cases that:

  - set `data-player-motion='reduced'`, trigger travel, and observe no Pixi/canvas/atlas request;
  - abort the atlas JSON request and observe a static destination cutout, usable link, zero unhandled
    page errors, and renderer state `fallback`;
  - start two real journeys and observe one canvas, active count 2, distinct hero sprites, and depth
    order matching normalized `y`;
  - repeat at `390x844`, assert 44-pixel resident/link targets, unobstructed four-button bottom
    navigation, and `documentElement.scrollWidth <= innerWidth`.

- [ ] **Step 5: Extend the throttled performance proof**

  In `performance.e2e.ts`, keep the existing
  `mid-range-phone-390x844-2x` profile: 150 ms network latency, 200000 download bytes/s, 93750 upload
  bytes/s, and 4× CPU slowdown. Trigger one journey, sample animation frames for 2000 ms, and require
  at least 30 FPS. Sum motion resource encoded sizes, require each atlas at most `600000`, assert one
  canvas, and keep the existing `300000000` renderer working-set reference.

  Rebuild the production budget and assert initial JavaScript remains at or below the current
  `700000` budget and PixiJS stays a lazy chunk:

  ```bash
  pnpm measure:web-build-budget
  pnpm validate:web-build-budget
  ```

- [ ] **Step 6: Run the complete verification set**

  Run:

  ```bash
  pnpm validate:village-run-current-company
  pnpm validate:village-run-motion
  pnpm validate:summonable-hero-runtime
  pnpm vitest run packages/contracts/src/summonable-hero.spec.ts tools/summonable-hero-runtime-lib.spec.ts tools/promote-village-run-current-company.spec.ts apps/web/src/lib/server/runtime-portraits.spec.ts apps/web/src/lib/village-travel.spec.ts apps/web/src/lib/village-scene.spec.ts apps/web/src/lib/components/village-shell/village-travel-controller.spec.ts
  pnpm --filter @summonlab/web check
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts performance.e2e.ts
  pnpm validate:web-build-budget
  git diff --check
  ```

  Expected: all commands PASS.

- [ ] **Step 7: Capture desktop and phone evidence**

  Bind the preview to `0.0.0.0`. Use the fixed campaign seed, trigger a route with a visible corner,
  and capture one desktop and one `390x844` screenshot while Yaso is moving. Verify both screenshots
  contain the painted Village, one normal-proportion raster Yaso run frame, the destination activity
  label, and unobstructed navigation; reject any frame with a vector, chibi, opaque plate, or clipped
  body.

- [ ] **Step 8: Commit the integrated slice**

  ```bash
  git add apps/web/src/lib/components/LivingHearthScene.svelte apps/web/src/lib/village-scene.ts apps/web/src/lib/village-scene.spec.ts apps/web/src/routes/village-shell.e2e.ts apps/web/src/routes/performance.e2e.ts docs/evidence/phase-3-runtime-budget.json docs/evidence/persistent-village-travel-desktop.png docs/evidence/persistent-village-travel-phone.png
  git commit -m "feat(village): animate authoritative hero travel"
  git push origin codex/persistent-village-cutouts
  ```

---

## Final branch verification

- [ ] Run `pnpm check` and record the exact result.
- [ ] Run `pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts performance.e2e.ts` and record the exact result.
- [ ] Run `git status --short --branch` and confirm the working tree is clean.
- [ ] Request a whole-branch spec-compliance and code-quality review against
  `docs/superpowers/specs/2026-09-06-persistent-village-hero-travel-animation-design.md`.
- [ ] Resolve any load-bearing finding, re-run affected checks, push the final branch, and provide the
  two evidence screenshots plus exact remote preview path for owner playtest feedback.
