# Village Threshold Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the accepted tier-one Village composition and five-mode shell as an honest, responsive runtime foundation while preserving the existing authoritative settlement simulation.

**Architecture:** Version the presentation-only settlement scene contract so one visual facility can aggregate existing authoritative buildings and one world hotspot can open a shell mode. Re-author Hearth 01 as a UI-free, hero-free raster using the accepted v4 composition, keep route nodes and engine building IDs unchanged, and render facility labels, state, residents, and navigation in Svelte. Add a truthful Tower foundation panel, but leave floor progression, expedition preparation, mission cargo, and `/explore/[runId]` to their own gameplay-contract plan.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, Svelte 5/SvelteKit 2, Playwright 1.60, Sharp 0.35.3, pnpm 10, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-09-02-living-village-client-visual-direction-design.md`

## Global Constraints

- Preserve the authoritative settlement building IDs `summoning-gate`, `kitchen`, `dormitory`, `training-ground`, and `workshop`. This slice must not migrate engine state, commands, events, persistence, or story logic.
- Present five visual places: `Summoning Circle`, `Residence`, `Training Grounds`, `Forge`, and `Tower Portal`.
- Bind `Residence` to both `kitchen` and `dormitory`; bind the remaining facilities one-to-one; bind `Tower Portal` to `mode=tower`, not to a fabricated settlement building.
- The production background must be a checked-in approved raster with no characters, labels, interface, logo, or watermark. All player-facing characters continue to use approved transparent Village cutouts.
- The accepted composition is fixed: Summoning Circle upper left, Residence lower left, Training Grounds upper right, Forge lower right, and standalone Tower Portal rear center, connected by one axial road and four branches.
- Facility labels are semantic HTML rendered from scene metadata. They support pointer and keyboard focus, do not issue movement commands, and do not rely on color alone.
- A Tower mode may describe the approved floor-choice model, but this foundation must not expose enabled floor, party, cargo, idle-repeat, or departure controls until those actions have authoritative contracts.
- `Missions` remains objective and story history. It must not absorb expedition preparation.
- The existing living resident projection stays authoritative. No decorative crowds or invented characters may be added to the background.
- Reduced motion freezes or hides ambient effects without hiding state or controls.
- Stop after the art-candidate step for explicit visual approval. Do not promote a merely plausible environment into `assets/settlements`.
- Follow `AGENTS.md`: keep unrelated work unstaged, validate each reviewable slice, commit with a concise Conventional Commit subject, and push before each handoff.

## Deliberately Deferred Follow-On Plans

- Tower floor availability, conquered-floor idle repeat, party selection, mission cargo editing, and the `/explore/[runId]` handoff.
- Shared Inventory custody, per-hero equipment assignment, temporary Mission Inventory, and return reconciliation.
- Point-to-move commands and selected-resident route control; this slice preserves current authoritative resident travel display.
- Facility tier thresholds and upgrade visuals beyond the approved tier-one background.
- Any rename or consolidation of authoritative kitchen/dormitory engine concepts.

---

### Task 1: Version the scene contract around visual facilities

**Files:**
- Modify: `packages/contracts/src/settlement-scene.ts`
- Create: `packages/contracts/src/settlement-scene.spec.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`

**Interfaces:**
- Consumes: `NormalizedScenePointSchema`, `NormalizedSceneBoundsSchema`, `StateHashSchema`.
- Produces: `VillageFacilityIdSchema`, `SettlementSceneHotspotTargetSchema`, `SettlementSceneHotspotSchema`, and `SettlementSceneDefinitionSchema` v2.

- [ ] **Step 1: Write failing schema tests for composite and mode targets**

  Create `packages/contracts/src/settlement-scene.spec.ts` with a `settlement-scene-v2` fixture and assert the exact facility order and bindings:

  ```ts
  expect(scene.hotspots.map((hotspot) => hotspot.facilityId)).toEqual([
    'summoning-circle',
    'residence',
    'training-grounds',
    'forge',
    'tower-portal'
  ]);
  expect(scene.hotspots.find((entry) => entry.facilityId === 'residence')?.target).toEqual({
    kind: 'settlement-buildings',
    buildingIds: ['kitchen', 'dormitory'],
    entranceNodeIds: ['kitchen-entry', 'dormitory-entry']
  });
  expect(scene.hotspots.find((entry) => entry.facilityId === 'tower-portal')?.target).toEqual({
    kind: 'village-mode',
    mode: 'tower'
  });
  ```

  Add rejection tests for duplicate facility IDs, a building appearing in two targets, mismatched building/entrance array lengths, a Tower Portal targeting a settlement building, and fewer or more than five visual facilities.

- [ ] **Step 2: Run the focused contract tests and verify RED**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/settlement-scene.spec.ts packages/contracts/src/contracts.spec.ts
  ```

  Expected: FAIL because the v1 schema only accepts one `buildingId` and one `entranceNodeId` per hotspot.

- [ ] **Step 3: Implement the v2 hotspot schemas**

  Add these public schemas beside the existing normalized geometry schemas:

  ```ts
  export const VillageFacilityIdSchema = z.enum([
    'summoning-circle',
    'residence',
    'training-grounds',
    'forge',
    'tower-portal'
  ]);

  export const SettlementSceneHotspotTargetSchema = z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('settlement-buildings'),
      buildingIds: z.array(SceneSlugSchema).min(1).max(2),
      entranceNodeIds: z.array(SceneSlugSchema).min(1).max(2)
    }).strict(),
    z.object({
      kind: z.literal('village-mode'),
      mode: z.literal('tower')
    }).strict()
  ]);

  export const SettlementSceneHotspotSchema = z.object({
    facilityId: VillageFacilityIdSchema,
    label: z.string().min(1).max(48),
    target: SettlementSceneHotspotTargetSchema,
    center: NormalizedScenePointSchema,
    bounds: NormalizedSceneBoundsSchema,
    labelAnchor: NormalizedScenePointSchema,
    labelPlacement: z.enum(['above-left', 'above-right', 'below-left', 'below-right']),
    labelPriority: z.number().int().min(1).max(5)
  }).strict();
  ```

  Change the root literal to `settlement-scene-v2` and use `z.array(SettlementSceneHotspotSchema).length(5)`. In `superRefine`, enforce:

  - five unique facility IDs;
  - exactly one instance of every `VillageFacilityIdSchema` option;
  - exactly one `village-mode` target and it belongs to `tower-portal`;
  - `buildingIds.length === entranceNodeIds.length` for every settlement target;
  - no duplicate building or entrance IDs across settlement targets;
  - hotspot centers and label anchors remain inside their bounds.

  Export inferred `VillageFacilityId`, `SettlementSceneHotspot`, and updated `SettlementSceneDefinition` types. Do not accept v1 and v2 simultaneously: checked-in Hearth 01 content is migrated atomically in Task 2.

- [ ] **Step 4: Run focused contract checks and verify GREEN**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/settlement-scene.spec.ts packages/contracts/src/contracts.spec.ts
  pnpm --filter @summonlab/contracts typecheck
  ```

  Expected: PASS with v2 accepting the composite Residence and rejecting ambiguous target coverage.

- [ ] **Step 5: Commit and push the contract slice**

  ```bash
  git add packages/contracts/src/settlement-scene.ts packages/contracts/src/settlement-scene.spec.ts packages/contracts/src/contracts.spec.ts
  git commit -m "feat(village): version visual facility scene contract"
  git push -u origin HEAD
  ```

---

### Task 2: Produce and approve the UI-free tier-one environment

**Files:**
- Reference: `docs/design-proposals/living-village-ui/mockups/village-balanced-cozy-layout-desktop-v4.png`
- Reference: `assets/settlements/hearth-01/hearth-01-environment-v1.png`
- Create candidate: `docs/design-proposals/living-village-ui/candidates/hearth-01-threshold-v2.png`
- Create after approval: `assets/settlements/hearth-01/hearth-01-threshold-v2.png`
- Create after approval: `apps/web/static/runtime/settlements/hearth-01/environment.<first-12-sha256>.webp`
- Modify after approval: `packages/content/src/hearth-01-scene.ts`
- Modify: `packages/content/src/hearth-01-scene.spec.ts`
- Modify: `tools/validate-settlement-scene.ts`

**Interfaces:**
- Consumes: accepted v4 spatial composition, existing v1 material/lighting reference, `loadHearth01()` authoritative buildings and route nodes.
- Produces: approved 1536×1024 source PNG, content-addressed runtime WebP, `HEARTH_01_SCENE_VERSION = 'hearth-01-scene-v2'`, five visual hotspots, and complete route-node projections.

- [ ] **Step 1: Write failing content and validator assertions**

  Replace the old one-hotspot-per-building expectation in `packages/content/src/hearth-01-scene.spec.ts` with flattened coverage:

  ```ts
  const settlementTargets = scene.hotspots.filter(
    (hotspot) => hotspot.target.kind === 'settlement-buildings'
  );
  expect(settlementTargets.flatMap((hotspot) => hotspot.target.buildingIds).sort()).toEqual(
    settlement.buildings.map((building) => building.buildingId).sort()
  );
  expect(settlementTargets.flatMap((hotspot) => hotspot.target.entranceNodeIds).sort()).toEqual(
    settlement.buildings.map((building) => building.entranceNodeId).sort()
  );
  expect(scene.hotspots.find((hotspot) => hotspot.facilityId === 'tower-portal')?.target).toEqual({
    kind: 'village-mode',
    mode: 'tower'
  });
  ```

  Update `tools/validate-settlement-scene.ts` to flatten settlement targets before `assertSameSet`. Replace the old compass check with exact accepted relationships: Circle left of the center axis; Residence below Circle; Training right of the axis; Forge below Training; Portal above every other facility and within `0.08` normalized units of `x=0.5`.

- [ ] **Step 2: Run the content checks and verify RED**

  Run:

  ```bash
  pnpm vitest run packages/content/src/hearth-01-scene.spec.ts
  pnpm validate:settlement-scene
  ```

  Expected: FAIL because checked-in Hearth 01 still uses `settlement-scene-v1` and the superseded compass layout.

- [ ] **Step 3: Generate one review candidate with the approved references**

  Use the `imagegen` skill with both reference images and this production prompt:

  ```text
  Create a hero-free, UI-free 1536×1024 high-three-quarter game environment base plate for Summonlab's tier-one Hearth 01 Village. Preserve the accepted v4 spatial composition exactly: standalone glowing Tower Portal centered at the rear; modest Summoning Circle in the upper-left plot; one larger Residence in the lower-left plot, with subtle hearth and communal-kitchen cues but no separate kitchen building; open Training Grounds upper right; working Forge lower right. Connect all five destinations with one broad center road and four clear branches. Keep roads geometrically readable for point-to-move while softening shoulders with irregular grass, worn earth, field stones, timber, water barrels, herb beds, and restrained practical clutter. Use deep charcoal and midnight navy, ember-gold habitation light, cool cyan portal and summoning accents, premium painterly dark-fantasy materials, stable silhouettes, and generous unobstructed walkable ground. Starting Village only: humble complete facilities, three-to-five-resident scale, no dense mature-city detail. No people, no characters, no monsters, no labels, no text, no icons, no navigation, no panels, no logo, no watermark, no physical tower.
  ```

  Save only the candidate to `docs/design-proposals/living-village-ui/candidates/hearth-01-threshold-v2.png`. Inspect it at original resolution and verify all five plots, readable entrances, axial road, four branches, empty character ground, absence of UI/text, and absence of a physical tower.

- [ ] **Step 4: Stop for explicit visual approval**

  Present the candidate beside the accepted v4 mockup. Ask specifically whether facility identity, tier-one density, road readability, and the Portal-vs-tower silhouette are accepted. If the answer is revise, keep the current candidate as design evidence and generate a new suffixed candidate; do not overwrite an approved source or update scene metadata.

- [ ] **Step 5: Promote the approved source and export runtime bytes**

  Copy the explicitly approved candidate to `assets/settlements/hearth-01/hearth-01-threshold-v2.png`. Encode with Sharp using width 1536, height 1024, WebP quality 86, effort 6, `preset: 'picture'`, `smartSubsample: true`, and stripped metadata. Name the runtime file from the first 12 characters of its SHA-256. Record exact source/runtime dimensions, bytes, hashes, budgets, encoder settings, generation prompt, the accepted v4 reference hash as `spatial-layout`, and the v1 environment hash as `visual-style` in `packages/content/src/hearth-01-scene.ts`.

- [ ] **Step 6: Author v2 hotspots and projections without changing engine topology**

  Use these bindings and tune normalized geometry against the approved raster:

  ```ts
  const facilityBindings = [
    ['summoning-circle', ['summoning-gate'], ['gate-court']],
    ['residence', ['kitchen', 'dormitory'], ['kitchen-entry', 'dormitory-entry']],
    ['training-grounds', ['training-ground'], ['training-entry']],
    ['forge', ['workshop'], ['workshop-entry']],
    ['tower-portal', 'tower']
  ] as const;
  ```

  Preserve every existing route-node ID in `nodeProjections`. Reposition those projections to the new road graph, keeping `gate-dais` and `gate-court` at the Summoning Circle, kitchen/dormitory nodes within the Residence bounds, training nodes at Training Grounds, workshop nodes at Forge, and `courtyard-heart` on the center road. The Tower Portal has no fabricated engine node.

  Recalculate `sceneHash` with `calculateSettlementSceneHash`; do not edit the hash by trial and error.

- [ ] **Step 7: Run asset, content, and contract verification**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/settlement-scene.spec.ts packages/content/src/hearth-01-scene.spec.ts
  pnpm validate:settlement-content
  pnpm validate:settlement-scene
  pnpm validate:repository-assets
  ```

  Expected: PASS; validator output reports five visual hotspots, full canonical building/entrance/node coverage, a content-addressed WebP within both encoded and decoded budgets, and valid reference hashes.

- [ ] **Step 8: Commit and push the approved environment slice**

  ```bash
  git add docs/design-proposals/living-village-ui/candidates/hearth-01-threshold-v2.png assets/settlements/hearth-01/hearth-01-threshold-v2.png apps/web/static/runtime/settlements/hearth-01 packages/content/src/hearth-01-scene.ts packages/content/src/hearth-01-scene.spec.ts tools/validate-settlement-scene.ts
  git commit -m "feat(village): promote tier-one threshold environment"
  git push
  ```

---

### Task 3: Add the fifth global mode and a truthful Tower foundation

**Files:**
- Modify: `apps/web/src/lib/village-shell.ts`
- Modify: `apps/web/src/lib/village-shell.spec.ts`
- Modify: `apps/web/src/lib/components/village-shell/VillageModeNav.svelte`
- Modify: `apps/web/src/lib/components/village-shell/VillageModeIcon.svelte`
- Create: `apps/web/src/lib/components/village-shell/VillageTowerPanel.svelte`
- Create: `apps/web/static/ui/village-nav/tower.png`
- Modify: `apps/web/src/routes/play/[runId]/+page.svelte`
- Modify: `apps/web/src/routes/village-shell.e2e.ts`

**Interfaces:**
- Consumes: `VillageMode`, `VILLAGE_MODES`, campaign objective projection already returned by `+page.server.ts`.
- Produces: stable `tower` parsing/routing, fifth nav icon, and disabled explanatory Tower surface with no unauthoritative action.

- [ ] **Step 1: Write failing mode and shell tests**

  Change `apps/web/src/lib/village-shell.spec.ts` to expect:

  ```ts
  expect(VILLAGE_MODES.map((mode) => mode.id)).toEqual([
    'village',
    'residents',
    'tower',
    'inventory',
    'missions'
  ]);
  expect(parseVillageMode('tower')).toBe('tower');
  ```

  In `apps/web/src/routes/village-shell.e2e.ts`, expect five links on desktop and phone, open `Tower`, assert `aria-current="page"`, and assert a `village-tower` region explains floor choice, conquered-floor repeat, and next-floor preparation without any enabled `Depart`, `Repeat`, or `Prepare` button.

- [ ] **Step 2: Run focused tests and verify RED**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/village-shell.spec.ts
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts
  ```

  Expected: unit test FAIL because `tower` falls back to Village; E2E FAIL because only four links render.

- [ ] **Step 3: Add Tower to the stable shell model**

  Insert this entry between Residents and Inventory:

  ```ts
  { id: 'tower', label: 'Tower', route: '/play/[runId]?mode=tower' }
  ```

  Keep route construction in `VillageModeNav.svelte` data-driven. Change desktop and phone grid sizing from four fixed columns to `repeat(5, minmax(0, 1fr))`, preserve safe-area padding, and confirm every hit target remains at least 44×44 CSS pixels.

- [ ] **Step 4: Create a raster Tower navigation icon**

  Use the accepted shell mockup as the visual reference and create a transparent 130×130 PNG matching the existing four engraved silhouettes. It must depict a portal/threshold, not a physical tower, contain no text, and remain legible at the rendered phone size. Save it as `apps/web/static/ui/village-nav/tower.png`; `VillageModeIcon.svelte` continues to resolve icons from `/ui/village-nav/${mode}.png`.

- [ ] **Step 5: Render a non-deceptive Tower foundation panel**

  Create `VillageTowerPanel.svelte` with `data-testid="village-tower"`, heading `Tower threshold`, the approved floor-choice explanation, and a visible status `Expedition controls are not connected yet`. Show static rows for `Conquered floor repeat` and `Next unconquered floor` as explanatory content, not buttons or links. In `+page.svelte`, render it for `data.mode === 'tower'` before Inventory and Missions branches.

- [ ] **Step 6: Run focused web verification and verify GREEN**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/village-shell.spec.ts
  pnpm --filter @summonlab/web typecheck
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts
  ```

  Expected: PASS with five stable modes, correct active state, no horizontal phone overflow, and no false Tower action.

- [ ] **Step 7: Commit and push the five-mode shell**

  ```bash
  git add apps/web/src/lib/village-shell.ts apps/web/src/lib/village-shell.spec.ts apps/web/src/lib/components/village-shell apps/web/static/ui/village-nav/tower.png apps/web/src/routes/play/'[runId]'/+page.svelte apps/web/src/routes/village-shell.e2e.ts
  git commit -m "feat(village): add Tower shell mode"
  git push
  ```

---

### Task 4: Project aggregate facility state from authoritative buildings

**Files:**
- Modify: `apps/web/src/lib/village-scene.ts`
- Modify: `apps/web/src/lib/village-scene.spec.ts`

**Interfaces:**
- Consumes: `SettlementSceneDefinition['hotspots']`, `SettlementPresentation['buildings']`.
- Produces: `VillageFacilityProjection` and `projectVillageFacilities(scene, presentation)`.

- [ ] **Step 1: Write failing projection tests**

  Add a v2 scene fixture with the five approved facilities and a presentation where kitchen is powered with one occupant, dormitory is in reserve with two occupants, workshop is unpowered, and Tower has no settlement state. Assert:

  ```ts
  expect(projectVillageFacilities(scene, presentation)).toEqual([
    expect.objectContaining({ facilityId: 'summoning-circle', occupantCount: 0 }),
    expect.objectContaining({
      facilityId: 'residence',
      buildingIds: ['kitchen', 'dormitory'],
      occupantCount: 3,
      powerState: 'powered'
    }),
    expect.objectContaining({ facilityId: 'training-grounds' }),
    expect.objectContaining({ facilityId: 'forge', powerState: 'unpowered' }),
    expect.objectContaining({
      facilityId: 'tower-portal',
      buildingIds: [],
      occupantCount: 0,
      powerState: 'destination'
    })
  ]);
  ```

  Add cases proving occupant IDs are de-duplicated, `powered` wins over `reserve` and `unpowered`, a missing bound building yields `unknown`, and Tower never borrows an engine building state.

- [ ] **Step 2: Run the projection test and verify RED**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/village-scene.spec.ts
  ```

  Expected: FAIL because `projectVillageFacilities` does not exist.

- [ ] **Step 3: Implement the pure aggregate projector**

  Export:

  ```ts
  export interface VillageFacilityProjection {
    readonly hotspot: SettlementSceneDefinition['hotspots'][number];
    readonly facilityId: VillageFacilityId;
    readonly label: string;
    readonly buildingIds: readonly string[];
    readonly occupantHeroIds: readonly string[];
    readonly occupantCount: number;
    readonly assignmentCount: number;
    readonly assignmentCapacity: number;
    readonly powerState: 'powered' | 'reserve' | 'unpowered' | 'unknown' | 'destination';
    readonly hrefMode: 'tower' | null;
  }
  ```

  For settlement targets, look up each bound building, flatten unique occupants, sum assignment counts/capacities, return `unknown` if any binding is absent, and otherwise apply precedence `powered > reserve > unpowered`. For the mode target, return `destination` and `hrefMode: 'tower'`. Keep this function deterministic and DOM-free.

- [ ] **Step 4: Run unit and type checks and verify GREEN**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/village-scene.spec.ts
  pnpm --filter @summonlab/web typecheck
  ```

  Expected: PASS with Residence presenting combined kitchen/dormitory truth and Tower remaining presentation-only.

- [ ] **Step 5: Commit and push the projector**

  ```bash
  git add apps/web/src/lib/village-scene.ts apps/web/src/lib/village-scene.spec.ts
  git commit -m "feat(village): project aggregate facility state"
  git push
  ```

---

### Task 5: Render the accepted living scene with semantic facility pointers

**Files:**
- Modify: `apps/web/src/lib/components/LivingHearthScene.svelte`
- Modify: `apps/web/src/lib/components/HearthScene.svelte`
- Modify: `apps/web/src/routes/settlement-lab/+page.svelte`
- Modify: `apps/web/src/routes/village-shell.e2e.ts`
- Modify: `apps/web/src/routes/settlement-lab.e2e.ts`

**Interfaces:**
- Consumes: `projectVillageFacilities`, v2 hotspot label metadata, `resolve`, current route run ID.
- Produces: five collision-bounded facility pointers, Tower Portal link, aggregate facility status, and updated settlement lab compatibility.

- [ ] **Step 1: Write failing living-scene E2E expectations**

  In `village-shell.e2e.ts`, replace `.building-chip` checks with five `[data-testid="village-facility"]` elements and assert exact visible labels. Assert no separate `Kitchen` or `Dorm` facility label. Activate Tower Portal with keyboard and expect `/play/${runId}?mode=tower` without any movement or arrival request. At 1440×900 and 390×844, assert every visible facility pointer stays inside the scene, every pointer has a 44×44 hit target, and visible pointer boxes do not intersect the nav or one another.

  In `settlement-lab.e2e.ts`, update the painted-scene expectation from five engine building buttons to four settlement-facility buttons plus one Tower Portal link; Residence selection resolves deterministically to its first bound building (`kitchen`) for the legacy route demonstration. Render Tower Portal as a link to the persistent shell rather than passing it to `onSelectBuilding`.

- [ ] **Step 2: Run both E2E files and verify RED**

  Run:

  ```bash
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts settlement-lab.e2e.ts
  ```

  Expected: FAIL because the renderer still emits five engine-building chips and v2 hotspots have no `buildingId` property.

- [ ] **Step 3: Replace per-building chips with facility projections**

  In `LivingHearthScene.svelte`, derive `facilities = projectVillageFacilities(scene, presentation)`. Key loops by `facilityId`. Use `labelAnchor` for the label origin and `center` for an `aria-hidden` leader endpoint. Render:

  ```svelte
  {#if facility.hrefMode === 'tower'}
    <a
      data-testid="village-facility"
      href={resolve(`/play/${page.params.runId}?mode=tower`)}
      aria-label="Open Tower mode through Tower Portal"
    >...</a>
  {:else}
    <button
      type="button"
      data-testid="village-facility"
      aria-label={`Inspect ${facility.label}; ${facility.occupantCount} residents here`}
      onclick={() => focusFacility(facility.facilityId)}
    >...</button>
  {/if}
  ```

  `focusFacility` changes only local focus styling and an accessible detail line; it must not call an API, navigate, or move a resident. Use `:focus-visible`, text, a leader, and a target ring for focus so state is not color-only. Suppress labels by `labelPriority` only when measured boxes collide; keep all five semantic controls in the accessibility tree and expose suppressed labels through a compact `Facilities` list below the scene on narrow screens.

- [ ] **Step 4: Preserve authoritative resident placement and aggregate status**

  Keep `projectVillageSceneResidents`, approved cutout rendering, event cue, time plaque, and authoritative state seal. Replace the five-entry engine occupancy ledger with four aggregate settlement facilities plus a Tower destination row. Residence shows combined occupancy and assignment totals. No resident art is baked into or procedurally drawn over the background.

- [ ] **Step 5: Adapt the settlement lab to v2 targets**

  In `HearthScene.svelte`, look up all buildings listed by a settlement target. Use the first binding only for the existing single-building route demonstration, label the composite as Residence, and display combined state copy. Render the mode target as a normal link. Update the alt text to the accepted five-place composition and rename old `.kitchen-light`, `.dormitory-light`, and `.gate-light` classes to facility-oriented Circle, Residence, and Portal illumination hooks.

- [ ] **Step 6: Run focused verification and verify GREEN**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/village-scene.spec.ts apps/web/src/lib/village-shell.spec.ts
  pnpm --filter @summonlab/web typecheck
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts settlement-lab.e2e.ts
  ```

  Expected: PASS with five accepted labels, combined Residence truth, keyboard Tower routing, current residents intact, and no facility/nav collisions at the two required viewports.

- [ ] **Step 7: Commit and push the living scene**

  ```bash
  git add apps/web/src/lib/components/LivingHearthScene.svelte apps/web/src/lib/components/HearthScene.svelte apps/web/src/routes/settlement-lab/+page.svelte apps/web/src/routes/village-shell.e2e.ts apps/web/src/routes/settlement-lab.e2e.ts
  git commit -m "feat(village): render accepted threshold facilities"
  git push
  ```

---

### Task 6: Align the visual lab and responsive evidence with the production foundation

**Files:**
- Modify: `apps/web/src/lib/components/living-village/village/types.ts`
- Modify: `apps/web/src/routes/living-village-lab/village/fixtures.ts`
- Modify: `apps/web/src/routes/living-village-lab/village/+page.svelte`
- Modify: `apps/web/src/lib/components/living-village/village/VillageViewport.svelte`
- Modify: `apps/web/src/routes/living-village-lab/village/village.e2e.ts`
- Modify: `docs/evidence/living-village-village-validation.md`
- Create: `docs/evidence/village-threshold-foundation-desktop.png`
- Create: `docs/evidence/village-threshold-foundation-phone.png`

**Interfaces:**
- Consumes: production scene runtime path and the approved facility names/layout.
- Produces: a lab that no longer advertises the superseded six-destination layout and current desktop/phone evidence.

- [ ] **Step 1: Write failing lab assertions for the accepted five-place vocabulary**

  Update `village.e2e.ts` to expect exactly five facilities in this order: Tower Portal, Summoning Circle, Residence, Training Grounds, Forge. Assert the page does not expose `Dormitory`, `Kitchen`, or `Tower Threshold` as separate facility labels. Keep the existing zoom, pan, hero selection, keyboard, and drawer assertions.

- [ ] **Step 2: Run the lab E2E and verify RED**

  Run:

  ```bash
  pnpm --filter @summonlab/web test:e2e -- living-village-lab/village/village.e2e.ts
  ```

  Expected: FAIL because the lab fixture still defines six historical facilities.

- [ ] **Step 3: Replace the historical fixture vocabulary and background**

  Change `VillageFacilityId` to the same five presentation IDs used by the scene contract. Point the fixture environment at `loadHearth01Scene().runtime.publicPath` through page data or a shared serializable fixture exported from content; do not duplicate the content-addressed filename in multiple source files. Replace the six regions with five normalized regions matching production metadata. Map Residence activity copy to communal eating/resting, Circle to summoning/synthesis, Training to practice, Forge to equipment work, and Portal to floor travel.

- [ ] **Step 4: Preserve interaction semantics while removing false commands**

  The lab may continue to demonstrate camera and selection behavior, but facility activation only opens details. Remove or disable local actions that imply an authoritative rest, train, forge, court, or hunt command. Tower Portal opens the Tower explanation; it does not start a hunt or departure.

- [ ] **Step 5: Run the preview and capture evidence**

  Start the lab bound for remote review:

  ```bash
  pnpm --filter @summonlab/web dev --host 0.0.0.0
  ```

  Verify the listening interface is `0.0.0.0`, then test `/living-village-lab/village` at 1440×900 and 390×844. Capture the two evidence PNGs. Check label attachment, no edge clipping, scene dominance, fixed phone nav safe area, 44×44 controls, keyboard order, selected-resident cutout identity, and reduced-motion behavior.

- [ ] **Step 6: Update the evidence note and verify GREEN**

  Record the exact command, viewport sizes, screenshots, accepted facility order, known Tower gameplay boundary, and remaining follow-on plans in `docs/evidence/living-village-village-validation.md`.

  Run:

  ```bash
  pnpm --filter @summonlab/web test:e2e -- living-village-lab/village/village.e2e.ts
  pnpm --filter @summonlab/web typecheck
  ```

  Expected: PASS with no historical six-facility or hunt semantics remaining in the Village lab.

- [ ] **Step 7: Commit and push the aligned visual lab**

  ```bash
  git add apps/web/src/lib/components/living-village/village apps/web/src/routes/living-village-lab/village docs/evidence/living-village-village-validation.md docs/evidence/village-threshold-foundation-desktop.png docs/evidence/village-threshold-foundation-phone.png
  git commit -m "docs(village): align threshold validation evidence"
  git push
  ```

---

### Task 7: Run the release gate and document the next contract boundary

**Files:**
- Modify: `docs/evidence/living-village-village-validation.md`

**Interfaces:**
- Consumes: all prior slices and repository validation commands.
- Produces: verified Village threshold foundation and an explicit handoff boundary for Tower gameplay work.

- [ ] **Step 1: Run focused unit, contract, content, and web checks**

  ```bash
  pnpm vitest run packages/contracts/src/settlement-scene.spec.ts packages/contracts/src/contracts.spec.ts packages/content/src/hearth-01-scene.spec.ts apps/web/src/lib/village-scene.spec.ts apps/web/src/lib/village-shell.spec.ts
  pnpm validate:settlement-content
  pnpm validate:settlement-scene
  pnpm validate:repository-assets
  pnpm --filter @summonlab/contracts typecheck
  pnpm --filter @summonlab/content typecheck
  pnpm --filter @summonlab/web typecheck
  ```

  Expected: PASS.

- [ ] **Step 2: Run targeted browser coverage**

  ```bash
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts settlement-lab.e2e.ts living-village-lab/village/village.e2e.ts
  ```

  Expected: PASS on desktop and phone assertions with five global modes, five visual places, approved resident cutouts, and no enabled Tower gameplay actions.

- [ ] **Step 3: Run repository formatting and diff hygiene**

  ```bash
  pnpm exec prettier --check packages/contracts/src/settlement-scene.ts packages/contracts/src/settlement-scene.spec.ts packages/content/src/hearth-01-scene.ts packages/content/src/hearth-01-scene.spec.ts tools/validate-settlement-scene.ts apps/web/src/lib/village-shell.ts apps/web/src/lib/village-shell.spec.ts apps/web/src/lib/village-scene.ts apps/web/src/lib/village-scene.spec.ts apps/web/src/lib/components/LivingHearthScene.svelte apps/web/src/lib/components/HearthScene.svelte apps/web/src/lib/components/village-shell apps/web/src/routes/play/'[runId]'/+page.svelte apps/web/src/routes/village-shell.e2e.ts apps/web/src/routes/settlement-lab.e2e.ts apps/web/src/routes/living-village-lab/village docs/evidence/living-village-village-validation.md
  git diff --check
  git status --short
  ```

  Expected: formatting and diff checks PASS; status lists only in-scope files before the final commit.

- [ ] **Step 4: Attempt the full repository gate and classify baseline failures**

  ```bash
  pnpm check
  ```

  Expected for this branch: all Village-specific checks above remain green. If the known family-affinity local-path or skill-icon provenance/time-budget baselines still fail, capture their exact output and confirm they reproduce on `origin/main`; do not change unrelated pipelines in this branch.

- [ ] **Step 5: Record the verified product boundary**

  Update the evidence note to state that the Village presentation foundation is complete, Tower mode is intentionally non-actionable, and Tower floor/party/cargo/departure behavior requires its own approved contract plan. Do not create `/explore/[runId]`, synthetic floor state, or client-owned repeat timers here.

- [ ] **Step 6: Commit, push, and verify a clean branch**

  ```bash
  git add docs/evidence/living-village-village-validation.md
  git commit -m "docs(village): record threshold release evidence"
  git push
  git status --short --branch
  ```

  Expected: current branch tracks its origin branch and the worktree is clean.

## Completion Criteria

- Hearth 01 displays the approved five-place tier-one composition from a reviewed UI-free raster.
- All five canonical engine buildings remain unchanged and are covered exactly once by presentation bindings.
- Residence truthfully aggregates kitchen and dormitory state.
- Tower Portal opens the fifth global mode but cannot start unauthoritative gameplay.
- Desktop and phone expose five global modes, semantic facility controls, approved resident cutouts, safe-area navigation, and no critical overlap.
- Settlement lab, living Village, contract tests, asset validators, and evidence documentation use the same current vocabulary.
- Focused checks pass; any full-suite baseline failure is reproduced on `origin/main` and reported without unrelated fixes.
