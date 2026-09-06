# Persistent Village Hero Cutouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the persistent Hearth 01 Village a canonical, alpha-validated cutout path and show all three real campaign residents without restoring the rejected scene redesign.

**Architecture:** Advance the existing summonable-hero source and runtime manifests to v2 with an optional `villageCutout` binding, then resolve that asset through the existing server portrait owner. Project every authoritative settlement occupant into the current `LivingHearthScene`, produce three manifest-bound cutout candidates, stop for visual approval, and only then promote the accepted sources and regenerate lazy runtime assets.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, Sharp 0.35.3, Svelte 5/SvelteKit 2, Playwright 1.60, Python 3 via uv, rembg 2.0.83 with `u2net_human_seg`, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-09-06-persistent-village-hero-cutouts-design.md`

## Global Constraints

- The approved `summonable-heroes-v1` catalog remains the only production owner of summon, combat-chibi, and Village-cutout art.
- Catalog and runtime schema versions advance to v2; the 200-identity catalog version remains `summonable-heroes-v1`.
- `summon` and `combatChibi` stay required; `villageCutout` is optional until individually approved.
- A Village cutout is a normal-proportion transparent derivative of the exact summon source. It never derives from a chibi.
- Persistent Village residents come only from the current campaign and settlement projections.
- Missing or failed cutouts show a labeled non-character state; they never fall back to chibis, opaque portraits, vectors, emoji, or procedural character drawings.
- Preserve the current Village environment, status plaques, building chips, campaign controls, and four-mode phone navigation.
- The first production wave contains only Yaso Dreno, Oren Sorin, and Joror Pelleth.
- No candidate is added to the approved catalog without explicit user approval of the review sheet.
- Runtime output is checked in. Vercel and normal local development do not run Python, rembg, Docker, or an image model.
- Follow `AGENTS.md`: validate, commit each reviewable task, push before handoff, and keep unrelated changes unstaged.

---

### Task 1: Version the canonical hero visual pipeline atomically

**Files:**
- Modify: `packages/contracts/src/summonable-hero.ts`
- Modify: `packages/contracts/src/summonable-hero.spec.ts`
- Modify: `packages/contracts/src/visual.ts`
- Modify: `assets/heroes/approved/summonable-roster-v1/catalog.json`
- Modify: `tools/summonable-hero-runtime-lib.ts`
- Modify: `tools/summonable-hero-runtime-lib.spec.ts`
- Modify: `tools/export-summonable-hero-runtime.ts`
- Modify: `apps/web/src/lib/server/runtime-portraits.ts`
- Modify: `apps/web/src/lib/server/runtime-portraits.spec.ts`
- Modify: `package.json`
- Regenerate: `apps/web/static/runtime/summonable-heroes-v1/manifest.json`

**Interfaces:**
- Consumes: existing `ApprovedHeroSourceAssetSchema`, `SummonableHeroEntrySchema`, `SummonableHeroCatalogSchema`, `SummonableHeroRuntimeManifestSchema`, and `RuntimeVisualUsageSchema`.
- Produces: `VillageCutoutBindingSchema`, catalog schema `summonable-hero-catalog-v2`, runtime schema `summonable-hero-runtime-manifest-v2`, runtime usage `village-cutout`, `assertVillageCutoutAlpha(bytes: Buffer): Promise<void>`, optional 384-pixel runtime WebPs, and `runtimePortraitFor(..., 'village-cutout')` returning `RuntimePortrait | null`.

- [ ] **Step 1: Write failing catalog tests for optional, source-bound cutouts**

  Extend `packages/contracts/src/summonable-hero.spec.ts` so fixtures emit
  `schemaVersion: 'summonable-hero-catalog-v2'`. Add these tests using the first valid entry's
  summon asset as the authority:

  ```ts
  it('accepts a partial catalog with one source-bound Village cutout', () => {
    const entries = validEntries();
    const first = entries[0]!;
    entries[0] = {
      ...first,
      visuals: {
        ...first.visuals,
        villageCutout: {
          sourceSummonAssetKey: first.visuals.summon.assetKey,
          sourceSummonContentHash: first.visuals.summon.contentHash,
          asset: {
            ...first.visuals.summon,
            assetKey: `${first.heroId}-village-cutout-v1`,
            role: 'village-cutout',
            file: 'assets/heroes/experiments/example/village-cutout.png'
          }
        }
      }
    };

    const parsed = SummonableHeroCatalogSchema.parse(catalog(entries));
    expect(parsed.entries[0]!.visuals.villageCutout?.asset.role).toBe('village-cutout');
    expect(parsed.entries[1]!.visuals.villageCutout).toBeUndefined();
  });

  it('rejects a Village cutout bound to a different summon source', () => {
    const entries = validEntries();
    const first = entries[0]!;
    entries[0] = {
      ...first,
      visuals: {
        ...first.visuals,
        villageCutout: {
          sourceSummonAssetKey: 'another-hero-summon-v1',
          sourceSummonContentHash: 'f'.repeat(64),
          asset: {
            ...first.visuals.summon,
            assetKey: `${first.heroId}-village-cutout-v1`,
            role: 'village-cutout'
          }
        }
      }
    };

    expect(() => SummonableHeroCatalogSchema.parse(catalog(entries))).toThrow(
      /Village cutout must bind the matching summon source/u
    );
  });
  ```

- [ ] **Step 2: Run the contract test and verify RED**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/summonable-hero.spec.ts
  ```

  Expected: FAIL because v1 is the only accepted catalog schema and `village-cutout` is not an
  approved source role.

- [ ] **Step 3: Implement the v2 source and runtime schemas**

  In `packages/contracts/src/summonable-hero.ts`, replace the existing source-role field with:

  ```ts
  role: z.enum(['summon', 'combat-chibi', 'village-cutout'])
  ```

  Add this adjacent schema:

  ```ts
  export const VillageCutoutBindingSchema = z.object({
    sourceSummonAssetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
    sourceSummonContentHash: StateHashSchema,
    asset: ApprovedHeroSourceAssetSchema
  }).strict();
  ```

  Add `villageCutout: VillageCutoutBindingSchema.optional()` beside `summon` and `combatChibi`.
  Extend `SummonableHeroEntrySchema.superRefine` with these exact checks:

  ```ts
  const cutout = entry.visuals.villageCutout;
  if (cutout && (
    cutout.asset.role !== 'village-cutout' ||
    cutout.sourceSummonAssetKey !== entry.visuals.summon.assetKey ||
    cutout.sourceSummonContentHash !== entry.visuals.summon.contentHash
  )) {
    context.addIssue({
      code: 'custom',
      message: `Village cutout must bind the matching summon source: ${entry.heroId}`
    });
  }
  ```

  Include the optional cutout asset key in the catalog-wide uniqueness list. Change the catalog
  literal to `summonable-hero-catalog-v2`.

  Add `'village-cutout'` to `RuntimeVisualUsageSchema` in `packages/contracts/src/visual.ts`. Advance
  runtime manifest literals to `summonable-hero-runtime-manifest-v2` and
  `summonable-hero-runtime-exporter-v2`. Its entry refinement must require exactly one `summon`, one
  `combat-chibi`, zero or one `village-cutout`, and no other usage. Its Pixi validation must compare
  each bundle's Pixi asset count to `entry.bundle.assets.length`, not the old fixed count of two.

  Update only the root catalog's `schemaVersion` to `summonable-hero-catalog-v2`; do not add a cutout
  to any entry in this task.

- [ ] **Step 4: Run focused contract tests and verify GREEN**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/summonable-hero.spec.ts packages/contracts/src/contracts.spec.ts
  pnpm --filter @summonlab/contracts typecheck
  ```

  Expected: PASS with 200 entries, required summon/chibi pairs, and optional source-bound cutouts.

- [ ] **Step 5: Write failing exporter tests for optionality and alpha**

  In `tools/summonable-hero-runtime-lib.spec.ts`, create a temporary `1024x1536` RGBA PNG with a
  centered opaque rectangle and transparent edges using Sharp. Add one cutout binding to a parsed
  catalog copy and assert:

  ```ts
  expect(planSummonableHeroRuntime(catalogWithOneCutout)).toHaveLength(401);
  expect(
    planSummonableHeroRuntime(catalogWithOneCutout).filter(
      (entry) => entry.usage === 'village-cutout'
    )
  ).toHaveLength(1);
  await expect(assertVillageCutoutAlpha(validCutoutBytes)).resolves.toBeUndefined();
  await expect(assertVillageCutoutAlpha(opaquePngBytes)).rejects.toThrow(/true alpha/u);
  await expect(assertVillageCutoutAlpha(edgeTouchingBytes)).rejects.toThrow(/canvas edge/u);
  ```

  In `apps/web/src/lib/server/runtime-portraits.spec.ts`, add a fixture-level assertion that an
  unknown cutout resolves to `null` without returning the summon or chibi:

  ```ts
  expect(runtimePortraitFor(catalogHero.draft.manifestHash, catalogHero.draft.manifest.artKey, 'village-cutout')).toBeNull();
  ```

- [ ] **Step 6: Run focused tests and verify RED**

  Run:

  ```bash
  pnpm vitest run tools/summonable-hero-runtime-lib.spec.ts apps/web/src/lib/server/runtime-portraits.spec.ts
  ```

  Expected: FAIL because the runtime plan union and manifest do not support `village-cutout`, and the
  alpha validator does not exist.

- [ ] **Step 7: Implement alpha inspection and optional runtime planning**

  Extend `SummonableHeroRuntimePlanEntry['usage']` to include `'village-cutout'`. Append this profile
  only when `entry.visuals.villageCutout` exists:

  ```ts
  {
    usage: 'village-cutout',
    width: 384,
    quality: 82,
    budgetBytes: 120_000,
    source: entry.visuals.villageCutout.asset
  }
  ```

  Export `assertVillageCutoutAlpha`. Read metadata before `ensureAlpha()`, require PNG, `1024x1536`,
  and `metadata.hasAlpha === true`; decode the alpha channel and reject when every pixel is opaque,
  every pixel is transparent, any pixel on the four outside edges has alpha greater than 8, or the
  fraction of pixels with alpha greater than 8 falls outside `0.02..0.60`.

  Call that function before encoding a cutout source. After encoding, inspect the generated WebP and
  require `hasAlpha === true`. Preserve `fit: 'inside'`, stripped metadata, and the existing lazy
  per-hero bundle structure.

  Change the exporter literal to `summonable-hero-runtime-exporter-v2`, keep the output root
  `runtime/summonable-heroes-v1`, and add these root scripts:

  ```json
  "export:summonable-hero-runtime": "tsx tools/export-summonable-hero-runtime.ts",
  "validate:summonable-hero-runtime": "tsx tools/export-summonable-hero-runtime.ts --check"
  ```

  Do not add fallback logic in `runtimePortraitFor`: only `dialogue` and `roster` may fall back to
  `summon`; `village-cutout` must return `null` when absent.

- [ ] **Step 8: Regenerate the v2 manifest and verify GREEN**

  Run:

  ```bash
  pnpm export:summonable-hero-runtime
  pnpm validate:summonable-hero-runtime
  pnpm vitest run tools/summonable-hero-runtime-lib.spec.ts apps/web/src/lib/server/runtime-portraits.spec.ts
  ```

  Expected: PASS. Before cutout approval the manifest still contains 400 assets, and existing WebP
  bytes remain unchanged.

- [ ] **Step 9: Commit and push the atomic catalog/runtime migration**

  ```bash
  git add packages/contracts/src/summonable-hero.ts packages/contracts/src/summonable-hero.spec.ts packages/contracts/src/visual.ts assets/heroes/approved/summonable-roster-v1/catalog.json tools/summonable-hero-runtime-lib.ts tools/summonable-hero-runtime-lib.spec.ts tools/export-summonable-hero-runtime.ts apps/web/src/lib/server/runtime-portraits.ts apps/web/src/lib/server/runtime-portraits.spec.ts apps/web/static/runtime/summonable-heroes-v1/manifest.json package.json
  git commit -m "feat(heroes): support lazy village cutouts"
  git push origin main
  ```

---

### Task 2: Project all authoritative residents into the current Village scene

**Files:**
- Create: `apps/web/src/lib/village-scene.ts`
- Create: `apps/web/src/lib/village-scene.spec.ts`
- Modify: `apps/web/src/lib/village-shell.ts`
- Modify: `apps/web/src/routes/play/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/play/[runId]/+page.svelte`
- Modify: `apps/web/src/lib/components/LivingHearthScene.svelte`
- Modify: `apps/web/src/lib/components/village-shell/VillageResidentsPanel.svelte`
- Modify: `apps/web/src/routes/village-shell.e2e.ts`

**Interfaces:**
- Consumes: `VillageResident.sceneArt`, `SettlementPresentation.occupants`, and scene node projections.
- Produces: `projectVillageSceneResidents(scene, presentation, residents): readonly VillageSceneResident[]`
  plus three linked resident overlays in persistent play.

- [ ] **Step 1: Write failing pure projection and browser tests**

  In `apps/web/src/lib/village-scene.spec.ts`, construct a scene with `gate-dais` at `{x: 0.5, y:
  0.25}`, three occupants, and matching residents. Assert that:

  ```ts
  const projected = projectVillageSceneResidents(scene, presentation, residents);
  expect(projected.map((entry) => entry.resident?.heroId)).toEqual([
    presentation.occupants[0]!.heroId,
    presentation.occupants[1]!.heroId,
    presentation.occupants[2]!.heroId
  ]);
  expect(projected[0]!.point.x).toBeLessThan(projected[1]!.point.x);
  expect(projected[1]!.point.x).toBeLessThan(projected[2]!.point.x);
  expect(projected.every((entry) => entry.point.x >= 0.08 && entry.point.x <= 0.92)).toBe(true);
  ```

  Add a second case with an occupant absent from `residents`; it must remain in the result with
  `resident: null` and `label: 'Resident unavailable'`.

  In `apps/web/src/routes/village-shell.e2e.ts`, change the desktop scene expectation from one
  `settlement-occupant` to three `village-scene-resident` links, and assert each campaign hero name is
  visible. Assert that fixture names `Dara Zev` and `Mara Vey` are absent.

- [ ] **Step 2: Run projection and Village E2E tests and verify RED**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/village-scene.spec.ts
  pnpm --filter @summonlab/web test:e2e -- src/routes/village-shell.e2e.ts
  ```

  Expected: the unit test fails because the projector does not exist; E2E fails because only one
  presence marker renders.

- [ ] **Step 3: Implement the pure authoritative projection**

  Define:

  ```ts
  export interface VillageSceneResident {
    readonly occupant: SettlementPresentation['occupants'][number];
    readonly resident: VillageResident | null;
    readonly point: NormalizedScenePoint;
    readonly label: string;
  }

  export function projectVillageSceneResidents(
    scene: SettlementSceneDefinition,
    presentation: SettlementPresentation,
    residents: readonly VillageResident[]
  ): readonly VillageSceneResident[];
  ```

  Iterate `presentation.occupants` in its authoritative order. Resolve route interpolation with the
  existing algorithm from `LivingHearthScene.svelte`. Group equal base points by coordinates rounded
  to three decimals and apply horizontal offsets centered around the base point at increments of
  `0.06`, clamped to `0.08..0.92`. Join resident data by `heroId`; never synthesize a resident from the
  page's primary manifest.

- [ ] **Step 4: Wire scene art and semantic resident links**

  Add shared `VillageResidentArt` and `sceneArt: VillageResidentArt | null` in
  `apps/web/src/lib/village-shell.ts`. In the server load, resolve:

  ```ts
  sceneArt: runtimePortraitFor(
    hero.draft.manifestHash,
    hero.draft.manifest.artKey,
    'village-cutout'
  )
  ```

  Pass `residents={data.residents}` into `LivingHearthScene`. Replace the component's single-occupant
  selection with `projectVillageSceneResidents(...)` and render each known resident as an `<a>` whose
  `href` is `?mode=residents#resident-${heroId}`. Render the cutout with `object-fit: contain`, bottom
  anchoring, and a raster drop shadow. On missing art or `onerror`, reserve the same footprint and show
  the literal label `Art pending`. For an unmatched occupant show `Resident unavailable` and no link.

  Keep the existing environment, phase layers, building auras/chips, time plaque, state seal,
  occupancy ledger, and activity effects. Do not copy facility callouts, camera controls, drawers, or
  any CSS character silhouette from commit `5f4a28e41` or `1d4b3b6d4`.

  Add `id={`resident-${resident.heroId}`}` and `scroll-margin-top` to each Residents article so the
  scene link reaches the canonical detail surface.

- [ ] **Step 5: Verify unit, accessibility, desktop, and phone behavior**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/village-scene.spec.ts apps/web/src/lib/server/runtime-portraits.spec.ts
  pnpm --filter @summonlab/web typecheck
  pnpm --filter @summonlab/web test:e2e -- src/routes/village-shell.e2e.ts
  ```

  Expected: PASS with three resident overlays, working Residents anchors, no horizontal phone
  overflow, and non-character markers wherever cutouts are absent.

- [ ] **Step 6: Commit and push the honest scene connection**

  ```bash
  git add apps/web/src/lib/village-scene.ts apps/web/src/lib/village-scene.spec.ts apps/web/src/lib/village-shell.ts apps/web/src/routes/play/'[runId]'/+page.server.ts apps/web/src/routes/play/'[runId]'/+page.svelte apps/web/src/lib/components/LivingHearthScene.svelte apps/web/src/lib/components/village-shell/VillageResidentsPanel.svelte apps/web/src/routes/village-shell.e2e.ts
  git commit -m "feat(village): show authoritative campaign residents"
  git push origin main
  ```

---

### Task 3: Build the manifest-bound current-company cutout batch

**Files:**
- Create: `tools/village-cutout-backfill-lib.ts`
- Create: `tools/village-cutout-backfill-lib.spec.ts`
- Create: `tools/export-village-cutout-review.ts`
- Modify: `package.json`
- Create: `assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/manifest.json`
- Create: `assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/{yaso-dreno,oren-sorin,joror-pelleth}/provider-source-v1.png`
- Create: `assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/{yaso-dreno,oren-sorin,joror-pelleth}/candidate-v1.png`
- Create: `assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/review/current-company-cutouts-v1.png`

**Interfaces:**
- Consumes: the three exact summon assets in the canonical catalog and deterministic rembg outputs.
- Produces: `VillageCutoutBackfillManifestSchema`, `buildVillageCutoutBackfillManifest(...)`,
  `validateVillageCutoutCandidate(...)`, and one review sheet; no approved assets.

- [ ] **Step 1: Read the raster-production contract before producing images**

  Read `/home/joao/.codex/skills/summonlab-image-production/SKILL.md` completely and follow its
  manifest, provenance, inspection, and collision-safe ownership requirements. This task uses
  deterministic background isolation rather than a generative redraw; do not invoke imagegen or
  alter character pixels.

- [ ] **Step 2: Write failing backfill manifest and alpha tests**

  In `tools/village-cutout-backfill-lib.spec.ts`, use Sharp-created in-memory PNGs and assert:

  ```ts
  await expect(validateVillageCutoutCandidate(validTransparentPng)).resolves.toMatchObject({
    width: 1024,
    height: 1536,
    status: 'valid'
  });
  await expect(validateVillageCutoutCandidate(opaquePng)).rejects.toThrow(/true alpha/u);
  await expect(validateVillageCutoutCandidate(edgeTouchingPng)).rejects.toThrow(/canvas edge/u);
  expect(
    buildVillageCutoutBackfillManifest(catalog, ['yaso-dreno', 'oren-sorin', 'joror-pelleth'])
      .heroes.map((hero) => hero.heroId)
  ).toEqual(['yaso-dreno', 'oren-sorin', 'joror-pelleth']);
  ```

  Also assert the manifest records each summon source path/key/hash and manifest hash, candidate hash,
  `rembg: '2.0.83'`, model `u2net_human_seg`, the model SHA-256, and exact alpha-matting parameters.

- [ ] **Step 3: Run the focused test and verify RED**

  Run:

  ```bash
  pnpm vitest run tools/village-cutout-backfill-lib.spec.ts
  ```

  Expected: FAIL because the backfill schema, validator, and builder do not exist.

- [ ] **Step 4: Implement candidate validation, manifest writing, and review composition**

  Define strict schema version `village-cutout-backfill-v1` and lifecycle `candidate`. Reuse the same
  alpha thresholds as `assertVillageCutoutAlpha`: PNG `1024x1536`, true alpha, transparent four-edge
  border, nonempty figure, and visible fraction `0.02..0.60`. Hash all summon and candidate bytes
  before emitting the manifest.

  `tools/export-village-cutout-review.ts --write` must validate the immutable provider/candidate PNGs,
  exclusively create the manifest and review file, refuse to overwrite existing evidence, and compose
  a `1536x3456` review sheet with one `768x1152` row per hero: approved summon on the left and cutout
  over a neutral checkerboard on the right. Print JSON containing the batch ID, three hero IDs,
  manifest hash, and review-sheet path.

  Add:

  ```json
  "export:village-cutout-review": "tsx tools/export-village-cutout-review.ts --write",
  "validate:village-cutout-review": "tsx tools/export-village-cutout-review.ts --check"
  ```

- [ ] **Step 5: Produce the three immutable rembg outputs**

  Verify the canonical catalog still contains this exact authority set before producing anything:

  | Hero | Summon asset key | Summon path | Summon SHA-256 | Manifest SHA-256 |
  | --- | --- | --- | --- | --- |
  | Yaso Dreno | `yaso-dreno-summon-v1` | `assets/heroes/experiments/one-star-overnight-200-001/waves/wave-07/candidates/yaso-dreno/summon-v1.png` | `2c757553d089e409e79cdf403b4c170de5e47b84d2f48a25cba57fa8838537e0` | `6cec5db614ec93fab229d7b24bd4d83bb9255c9ea52bcfadd7ca84bcfcfe1db4` |
  | Oren Sorin | `oren-sorin-summon-v1` | `assets/heroes/experiments/one-star-overnight-200-001/waves/wave-05/candidates/oren-sorin/summon-v2.png` | `00b1cee63c25ce4590afea39e5539c4b1aeb4e63a2dc61ace2bdc830c10a9b4b` | `1532dbdc8342ee47453c748bdebfabe684ce3208d30231ba46d189425fb1e249` |
  | Joror Pelleth | `joror-pelleth-summon-v1` | `assets/heroes/experiments/one-star-overnight-200-001/waves/wave-09/candidates/joror-pelleth/summon-v1.png` | `130360a4f48dff40971d9039a6a813fa549549f03627cdb87422cd400864819f` | `97667fed1d0ec5be0ca326ef9e364a2bd301ff44f1921656c401295f007ca04b` |

  Fail closed if any value differs. Then use one task-specific model directory and do not install rembg
  into the application workspace:

  ```bash
  VILLAGE_MODEL_HOME="$(mktemp -d)"
  VILLAGE_CUTOUT_TMP="$(mktemp -d)"
  export U2NET_HOME="$VILLAGE_MODEL_HOME"
  uv run --with 'rembg[cpu]==2.0.83' rembg i -m u2net_human_seg -a -ae 15 -ab 10 -af 240 assets/heroes/experiments/one-star-overnight-200-001/waves/wave-07/candidates/yaso-dreno/summon-v1.png "$VILLAGE_CUTOUT_TMP/yaso-dreno.png"
  uv run --with 'rembg[cpu]==2.0.83' rembg i -m u2net_human_seg -a -ae 15 -ab 10 -af 240 assets/heroes/experiments/one-star-overnight-200-001/waves/wave-05/candidates/oren-sorin/summon-v2.png "$VILLAGE_CUTOUT_TMP/oren-sorin.png"
  uv run --with 'rembg[cpu]==2.0.83' rembg i -m u2net_human_seg -a -ae 15 -ab 10 -af 240 assets/heroes/experiments/one-star-overnight-200-001/waves/wave-09/candidates/joror-pelleth/summon-v1.png "$VILLAGE_CUTOUT_TMP/joror-pelleth.png"
  sha256sum "$U2NET_HOME/u2net_human_seg.onnx"
  ```

  Persist each temporary output byte-identically with these commands:

  ```bash
  python3 .agents/skills/summonlab-hero-creation/scripts/persist_image.py --workspace-root "$PWD" --source "$VILLAGE_CUTOUT_TMP/yaso-dreno.png" --provider-destination assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/yaso-dreno/provider-source-v1.png --candidate-destination assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/yaso-dreno/candidate-v1.png
  python3 .agents/skills/summonlab-hero-creation/scripts/persist_image.py --workspace-root "$PWD" --source "$VILLAGE_CUTOUT_TMP/oren-sorin.png" --provider-destination assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/oren-sorin/provider-source-v1.png --candidate-destination assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/oren-sorin/candidate-v1.png
  python3 .agents/skills/summonlab-hero-creation/scripts/persist_image.py --workspace-root "$PWD" --source "$VILLAGE_CUTOUT_TMP/joror-pelleth.png" --provider-destination assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/joror-pelleth/provider-source-v1.png --candidate-destination assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/joror-pelleth/candidate-v1.png
  ```

  Record alpha parameters `foregroundThreshold=240`, `backgroundThreshold=10`, and `erodeSize=15`
  plus the observed model SHA-256. Do not delete or overwrite a failed v1; use v2 paths for a
  correction.

- [ ] **Step 6: Export and validate the review evidence**

  Run:

  ```bash
  pnpm export:village-cutout-review
  pnpm validate:village-cutout-review
  pnpm vitest run tools/village-cutout-backfill-lib.spec.ts
  ```

  Expected: PASS and one review sheet containing exactly Yaso, Oren, and Joror.

- [ ] **Step 7: Commit and push candidate evidence**

  ```bash
  git add tools/village-cutout-backfill-lib.ts tools/village-cutout-backfill-lib.spec.ts tools/export-village-cutout-review.ts package.json assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001
  git commit -m "feat(heroes): prepare current village cutouts"
  git push origin main
  ```

- [ ] **Step 8: STOP for explicit visual approval**

  Show the user the absolute-path image
  `assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/review/current-company-cutouts-v1.png`.
  Ask specifically whether Yaso's hair edge, Oren's full silhouette, and Joror's clothing/feet remain
  faithful. Do not create an approval record, edit the canonical catalog, or continue to Task 4 until
  the user explicitly accepts all three or identifies revisions.

---

### Task 4: Promote only the accepted cutouts and prove them in persistent play

**Files:**
- Create: `tools/promote-village-cutout-backfill.ts`
- Modify: `tools/village-cutout-backfill-lib.ts`
- Modify: `tools/village-cutout-backfill-lib.spec.ts`
- Create: `assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/approval-v1.json`
- Modify: `assets/heroes/approved/summonable-roster-v1/catalog.json`
- Regenerate: `apps/web/static/runtime/summonable-heroes-v1/manifest.json`
- Create: `apps/web/static/runtime/summonable-heroes-v1/{yaso-dreno,oren-sorin,joror-pelleth}/village-cutout.*.webp`
- Modify: `apps/web/src/lib/server/runtime-portraits.spec.ts`
- Modify: `apps/web/src/routes/village-shell.e2e.ts`
- Create: `docs/evidence/persistent-village-cutouts/village-desktop.png`
- Create: `docs/evidence/persistent-village-cutouts/village-phone.png`

**Interfaces:**
- Consumes: the explicit user approval and immutable candidate manifest from Task 3.
- Produces: three approved `villageCutout` bindings, three lazy runtime WebPs, and persistent Village
  desktop/phone evidence.

- [ ] **Step 1: Write failing promotion tests**

  Extend `tools/village-cutout-backfill-lib.spec.ts` to assert that promotion rejects a missing
  approval, stale manifest hash, unlisted hero, changed candidate hash, and `revise` verdict. Assert
  that a valid approval returns a catalog where exactly these hero IDs have cutouts:

  ```ts
  expect(
    promoteVillageCutouts(catalog, manifest, approval).entries
      .filter((entry) => entry.visuals.villageCutout)
      .map((entry) => entry.heroId)
      .sort()
  ).toEqual(['joror-pelleth', 'oren-sorin', 'yaso-dreno']);
  ```

  In `runtime-portraits.spec.ts`, assert each promoted hero resolves a path matching:

  ```ts
  /^\/runtime\/summonable-heroes-v1\/(?:yaso-dreno|oren-sorin|joror-pelleth)\/village-cutout\.[a-f0-9]{12}\.webp$/u
  ```

- [ ] **Step 2: Run promotion and resolver tests and verify RED**

  Run:

  ```bash
  pnpm vitest run tools/village-cutout-backfill-lib.spec.ts apps/web/src/lib/server/runtime-portraits.spec.ts
  ```

  Expected: FAIL because no approval schema, promotion function, catalog bindings, or runtime cutouts
  exist.

- [ ] **Step 3: Record the user's exact approval and implement guarded promotion**

  Write `approval-v1.json` with schema `village-cutout-backfill-approval-v1`, the immutable batch and
  manifest hashes, reviewer `owner`, review date, verdict `approved`, the three accepted hero IDs, and
  the user's exact approval text.

  Implement `promoteVillageCutouts(catalog, manifest, approval)` as a pure function. It must verify all
  source/candidate hashes, approval identity, and exact accepted set, then add this binding only to an
  accepted entry:

  ```ts
  villageCutout: {
    sourceSummonAssetKey: entry.visuals.summon.assetKey,
    sourceSummonContentHash: entry.visuals.summon.contentHash,
    asset: {
      assetKey: `${entry.heroId}-village-cutout-v1`,
      role: 'village-cutout',
      status: 'approved',
      file: candidate.file,
      width: 1024,
      height: 1536,
      bytes: candidate.bytes,
      contentHash: candidate.contentHash,
      sourceExperimentId: manifest.batchId,
      approvalId: approval.approvalId
    }
  }
  ```

  `tools/promote-village-cutout-backfill.ts --write` formats and writes the catalog; `--check` rebuilds
  in memory and fails on drift.

- [ ] **Step 4: Promote, regenerate runtime output, and verify alpha**

  Run:

  ```bash
  pnpm tsx tools/promote-village-cutout-backfill.ts --write
  pnpm tsx tools/promote-village-cutout-backfill.ts --check
  pnpm export:summonable-hero-runtime
  pnpm validate:summonable-hero-runtime
  pnpm vitest run tools/summonable-hero-runtime-lib.spec.ts tools/village-cutout-backfill-lib.spec.ts apps/web/src/lib/server/runtime-portraits.spec.ts
  ```

  Expected: 403 runtime assets total, with three alpha-preserving `village-cutout` WebPs under the
  existing per-hero directories.

- [ ] **Step 5: Extend the persistent Village E2E assertions**

  Use campaign seed `village-shell-19aa1947-bcad-4fab-b2f8-e0e34a9b7eb3`. Assert three
  `.village-resident-art` images, no `Art pending` marker for this campaign, natural image alpha of
  zero at pixel `(0, 0)`, correct hero names, and working links to the three Residents anchors.

  Keep the existing phone checks for 44-pixel navigation targets, objective-bar clearance, and no
  horizontal overflow. Preserve conditional screenshot capture through
  `CAPTURE_VILLAGE_SHELL_DIR`.

- [ ] **Step 6: Capture desktop and phone evidence, then expose a collaborator preview**

  Let Playwright build and start its isolated preview while capturing both viewports:

  ```bash
  mkdir -p docs/evidence/persistent-village-cutouts
  CAPTURE_VILLAGE_SHELL_DIR="$PWD/docs/evidence/persistent-village-cutouts" pnpm --filter @summonlab/web test:e2e -- src/routes/village-shell.e2e.ts
  ```

  After the evidence run passes, start the normal app without local Docker on the
  collaborator-visible interface:

  ```bash
  pnpm dev:app
  ```

  Verify the server listens on `0.0.0.0`. Share the matching
  collaborator URL by replacing only `localhost` with `10.110.24.218` in the exact preview URL,
  preserving the actual port, path, query string, and run ID printed by the setup flow.

- [ ] **Step 7: Commit and push approved runtime integration**

  ```bash
  git add tools/promote-village-cutout-backfill.ts tools/village-cutout-backfill-lib.ts tools/village-cutout-backfill-lib.spec.ts assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/approval-v1.json assets/heroes/approved/summonable-roster-v1/catalog.json apps/web/static/runtime/summonable-heroes-v1 apps/web/src/lib/server/runtime-portraits.spec.ts apps/web/src/routes/village-shell.e2e.ts docs/evidence/persistent-village-cutouts
  git commit -m "feat(village): render approved campaign cutouts"
  git push origin main
  ```

---

### Task 5: Clarify the lab boundary and run final verification

**Files:**
- Modify: `apps/web/src/routes/living-village-lab/village/cutouts/README.md`
- Modify: `docs/wiki/art/hero-identity-and-evolution.md`
- Modify: `apps/web/DESIGN.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: the completed canonical catalog, runtime resolver, scene projection, and approval evidence.
- Produces: durable ownership documentation and repository-wide validation coverage.

- [ ] **Step 1: Document the completed ownership boundary**

  State in the lab README that its six names are visual-development fixtures absent from the approved
  roster and cannot be imported by `/play`. Update the wiki with the v2 catalog/runtime paths, the
  three approved pilot cutouts, and the remaining count of 197. Reconcile `apps/web/DESIGN.md` only if
  implementation details revealed a durable rule not already captured; do not restyle the document.

  Add `pnpm validate:summonable-hero-runtime` and `pnpm validate:village-cutout-review` to the root
  `check` chain so stale catalog/runtime/review evidence cannot merge.

- [ ] **Step 2: Search for forbidden persistent-scene fallbacks**

  Run:

  ```bash
  rg -n "combat-chibi|walking-portrait|resident-silhouette|sceneArt.*portrait|Dara Zev|Mara Vey" apps/web/src/lib/components/LivingHearthScene.svelte apps/web/src/routes/play apps/web/src/lib/server
  ```

  Expected: no combat-chibi, opaque portrait, procedural resident silhouette, or lab-fixture fallback
  in the persistent Village path. Legitimate portrait use in the HUD and Residents ledger remains.

- [ ] **Step 3: Run complete project verification**

  Run:

  ```bash
  pnpm validate:village-cutout-review
  pnpm tsx tools/promote-village-cutout-backfill.ts --check
  pnpm validate:summonable-hero-runtime
  pnpm validate:hero-creation-skill
  pnpm validate:wiki
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  pnpm validate:web-build-budget
  pnpm --filter @summonlab/web test:e2e -- src/routes/village-shell.e2e.ts
  git diff --check
  ```

  Expected: every command passes, the web build remains within budget, and the Village E2E proves the
  three approved current-company cutouts on desktop and phone.

- [ ] **Step 4: Inspect scope, commit documentation, and push**

  ```bash
  git status --short
  git diff --stat
  git add apps/web/src/routes/living-village-lab/village/cutouts/README.md docs/wiki/art/hero-identity-and-evolution.md apps/web/DESIGN.md package.json
  git commit -m "docs(village): record canonical cutout ownership"
  git push origin main
  ```

  Confirm the working tree is clean and report every task commit, push destination, evidence paths,
  preview URL, and any deferred risk. The only expected deferred production work is the 197-hero
  backfill, which remains outside this plan.
