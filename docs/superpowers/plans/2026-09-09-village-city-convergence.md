# Village City Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the visual lab's Village composition the only player-facing City, supply it from authoritative campaign state, preserve the five-option responsive dock and liked resident interactions, then remove the duplicate campaign and lab renderers.

**Architecture:** `/play/[runId]` loads one serializable `CityViewModel` through a pure server-side projector and renders one `CityScreen.svelte`. The screen owns only camera, selection, and sheet state; training and rest submit narrow typed intents to a production API that commits existing settlement assignment commands. Tests may render the same screen from a frozen projection, but no public fixture route or fixture reducer survives migration.

**Tech Stack:** Svelte 5, SvelteKit 2, TypeScript 6, Zod, Vitest, Playwright, the existing `@summonlab/engine` command reducer, the existing `@summonlab/database` event store, and the manifest-bound settlement image pipeline.

**Spec:** `docs/superpowers/specs/2026-09-09-village-city-convergence-design.md`

## Global Constraints

- Work in the current isolated branch/worktree. Before every commit, inspect `git status --short` and stage only files named by that task.
- Use test-driven development for code behavior: write the focused failing assertion, run it and confirm the expected failure, implement the smallest production change, then rerun the focused suite.
- Keep the database and engine as the only persistent state. Client code may change focus, selection, pan, zoom, and open sheet state; it must never move a resident, change an assignment, start an activity, or prepare a mission locally.
- Use approved `village-cutout` raster assets for residents in the world and approved roster/dialogue raster assets in quick view and details. Never introduce CSS, SVG, canvas, emoji, or opaque placeholder character art.
- Preserve the internal `tower-portal` facility ID, but display exactly `Portal`. The other world labels are exactly `Summoning Circle`, `Residence`, `Training Grounds`, and `Forge`.
- Preserve the occupancy rows in this exact order and language: `Dorm`, `Kitchen`, `Gate`, `Training`, `Forge`.
- The dock order is exactly `Village`, `Residents`, `Tower`, `Inventory`, `Missions`; it is above the City on desktop and fixed above the bottom safe area on phone.
- Do not enable fake Tower hunts. Portal selection changes to Tower mode; unsupported expedition controls remain unavailable.
- Do not delete either current renderer until the shared City passes the migrated behavior and campaign browser tests.
- Every task that changes repository files ends with focused validation, one concise Conventional Commit, and a push to the configured upstream, as required by `AGENTS.md`.

---

## Task 1: Define the canonical City view model and pure projection

**Files:**

- Create: `apps/web/src/lib/city.ts`
- Create: `apps/web/src/lib/city.spec.ts`
- Create: `apps/web/src/lib/server/city.ts`
- Create: `apps/web/src/lib/server/city.spec.ts`
- Modify: `apps/web/src/lib/village-scene.ts`
- Modify: `apps/web/src/lib/village-scene.spec.ts`
- Reference: `apps/web/src/lib/village-shell.ts`
- Reference: `apps/web/src/routes/play/[runId]/+page.server.ts`

- [ ] **Step 1: Write the failing City contract tests**

  In `city.spec.ts`, require the approved mode order, route construction, and strict fallback:

  ```ts
  import { CITY_MODES, cityModeHref, parseCityMode } from './city';

  expect(CITY_MODES.map(({ id }) => id)).toEqual([
    'village',
    'residents',
    'tower',
    'inventory',
    'missions'
  ]);
  expect(cityModeHref('run-1', 'village')).toBe('/play/run-1');
  expect(cityModeHref('run-1', 'tower')).toBe('/play/run-1?mode=tower');
  expect(parseCityMode('prototype')).toBe('village');
  ```

  Define and exercise these presentation-only types in `city.ts`:

  ```ts
  export type CityMode = 'village' | 'residents' | 'tower' | 'inventory' | 'missions';
  export type CityResidentAction = 'court-training' | 'rest' | 'details';

  export interface CityOccupancyRow {
    id: 'dormitory' | 'kitchen' | 'summoning-gate' | 'training-ground' | 'workshop';
    label: 'Dorm' | 'Kitchen' | 'Gate' | 'Training' | 'Forge';
    occupantCount: number;
    assignmentCount: number;
    assignmentCapacity: number;
    powerState: 'powered' | 'reserve' | 'unpowered';
  }

  export interface CityViewModel {
    runId: string;
    expectedVersion: number;
    eventCursor: number;
    stateHash: string;
    dayNumber: number;
    gameTime: string;
    dayPhase: string;
    mode: CityMode;
    scene: SettlementSceneDefinition;
    residents: readonly CityResident[];
    sceneResidents: readonly CitySceneResident[];
    facilities: readonly CityFacility[];
    occupancy: readonly CityOccupancyRow[];
    objectives: CampaignObjectiveProjection | null;
    inventory: EquipmentWorkshopProjection | null;
    tower: { available: false; reason: string };
    eventCue: AuthoritativeEvent | null;
  }
  ```

  `CityResident` must use arbitrary string hero IDs and include name, ordinal, rarity, pronouns, visual role, activity, location/node, readiness, social summary, approved `portrait` and `sceneArt` bindings, truthful health/level/detail rows when available, and `availableActions`. Do not copy the lab's fixed hero union or fictional attributes/equipment into the contract.

- [ ] **Step 2: Write the failing projector tests**

  In `server/city.spec.ts`, build a minimal `SettlementPresentation`, the current Hearth scene, three arbitrary residents, campaign objectives, and inventory input. Assert that `projectCityView(...)`:

  - returns the three residents in campaign ordinal order;
  - resolves scene positions through `projectVillageSceneResidents` rather than fixture coordinates;
  - returns five physical facilities with labels exactly `Summoning Circle`, `Residence`, `Training Grounds`, `Forge`, `Portal`;
  - folds `kitchen` and `dormitory` into Residence while keeping separate operational rows;
  - returns occupancy rows in the exact `Dorm`, `Kitchen`, `Gate`, `Training`, `Forge` order;
  - reports `occupantCount`, `assignmentCount`, `assignmentCapacity`, and `powerState` from the presentation;
  - exposes `court-training`, `rest`, and `details` only for an active, non-travelling resident with no current activity, and only `details` when busy;
  - carries run version, event cursor, state hash, time, objective, inventory, and event cue without inventing defaults.

  Add a regression to `village-scene.spec.ts` that expects the portal projection label to be `Portal` while its `facilityId` remains `tower-portal`.

- [ ] **Step 3: Run the tests and confirm the expected red state**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/city.spec.ts apps/web/src/lib/server/city.spec.ts apps/web/src/lib/village-scene.spec.ts
  ```

  Expected: the two new modules cannot be resolved and the portal-label assertion fails against `Tower Portal`.

- [ ] **Step 4: Implement the pure contract and projector**

  Keep `city.ts` browser-safe: imports may be `import type`, and it must not import database or engine implementation modules. Implement `CITY_MODES`, `parseCityMode`, and URL-encoded `cityModeHref` there.

  Implement `projectCityView` in `$lib/server/city.ts`. Use a constant ordered mapping owned by the projector, not by the component:

  ```ts
  const OCCUPANCY_ROWS = [
    ['dormitory', 'Dorm'],
    ['kitchen', 'Kitchen'],
    ['summoning-gate', 'Gate'],
    ['training-ground', 'Training'],
    ['workshop', 'Forge']
  ] as const;
  ```

  Reuse the current tested facility aggregation and route interpolation from `village-scene.ts`; do not clone those algorithms. Normalize the portal's presentation label in the projector during this task. The scene content itself changes in Task 7 after the approved raster is promoted.

- [ ] **Step 5: Verify and commit the projection boundary**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/city.spec.ts apps/web/src/lib/server/city.spec.ts apps/web/src/lib/village-scene.spec.ts
  pnpm --filter @summonlab/web typecheck
  pnpm exec prettier --check apps/web/src/lib/city.ts apps/web/src/lib/city.spec.ts apps/web/src/lib/server/city.ts apps/web/src/lib/server/city.spec.ts apps/web/src/lib/village-scene.ts apps/web/src/lib/village-scene.spec.ts
  git status --short
  git add apps/web/src/lib/city.ts apps/web/src/lib/city.spec.ts apps/web/src/lib/server/city.ts apps/web/src/lib/server/city.spec.ts apps/web/src/lib/village-scene.ts apps/web/src/lib/village-scene.spec.ts
  git commit -m "feat(city): define authoritative view projection"
  git push
  ```

---

## Task 2: Extract the lab's interaction model into shared City components

**Files:**

- Create: `apps/web/src/lib/components/city/CityScreen.svelte`
- Create: `apps/web/src/lib/components/city/CityVillageViewport.svelte`
- Create: `apps/web/src/lib/components/city/CityResidentDetails.svelte`
- Create: `apps/web/src/lib/components/city/CityStatusStrip.svelte`
- Create: `apps/web/src/lib/components/city/camera.ts`
- Create: `apps/web/src/lib/components/city/camera.spec.ts`
- Create: `apps/web/src/lib/components/city/city-screen.fixture.ts`
- Modify: `apps/web/src/routes/living-village-lab/village/+page.svelte`
- Modify: `apps/web/src/routes/living-village-lab/village/village.e2e.ts`
- Reference: `apps/web/src/lib/components/living-village/village/VillageViewport.svelte`
- Reference: `apps/web/src/lib/components/living-village/village/VillageHeroDrawer.svelte`
- Reference: `apps/web/src/lib/components/living-village/village/VillageSummary.svelte`

- [ ] **Step 1: Freeze the liked interaction behavior in browser tests**

  Change the lab browser test to address the shared surface by stable City test IDs. Preserve assertions for:

  - one dominant viewport with the accepted environment raster;
  - approved transparent cutouts only;
  - five facility targets and arbitrary resident IDs;
  - resident ribbon and world resident opening the same quick view;
  - `Details` replacing the quick view instead of stacking over it;
  - facility focus, pan, wheel/button zoom, Fit, Reset, keyboard operation, and reduced motion;
  - one quick view or one details sheet at a time;
  - no API call for camera, selection, focus, or details.

  Replace assertions that expect Dara, Mara, Jori, local `data-availability` mutations, fake `Tower hunt`, or route-local fixture URLs. Use Yaso Dreno, Oren Sorin, and Joror Pelleth with their approved runtime cutouts in the frozen `CityViewModel` fixture. For action buttons, assert only that the component dispatches an intent and remains visually unchanged until its `view` prop is replaced.

- [ ] **Step 2: Add pure camera-controller tests**

  In `camera.spec.ts`, pin the lab's current bounds and reset behavior:

  ```ts
  expect(zoomCamera(fitted, 1, center).zoom).toBe(1.9);
  expect(zoomCamera(maximum, 1, center).zoom).toBe(3);
  expect(fitCamera()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
  expect(resetCamera()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
  ```

  Include clamping tests for drag offsets at desktop and 390×844 viewport sizes.

- [ ] **Step 3: Run the focused tests and confirm failure**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/components/city/camera.spec.ts
  pnpm --filter @summonlab/web test:e2e -- living-village-lab/village/village.e2e.ts
  ```

  Expected: the shared component/controller modules and City test IDs do not exist.

- [ ] **Step 4: Extract without redesigning**

  Move the lab's proven camera math, pointer handling, selection, quick view, and drawer behavior into the new `components/city` files. `CityScreen.svelte` receives:

  ```ts
  interface Props {
    view: CityViewModel;
    onIntent?: (intent: CityIntent) => void | Promise<void>;
    pendingIntent?: CityIntent | null;
    intentError?: string | null;
  }
  ```

  `CityVillageViewport` renders coordinates only from `view.sceneResidents` and `view.facilities`. It may preview facility focus, but it cannot alter a resident's activity, position, or availability. `CityResidentDetails` uses only truthful `CityResident` fields and shows a labeled unavailable row when the projection lacks data.

  `city-screen.fixture.ts` is test input only. Point its resident art at the content-addressed approved Yaso/Oren/Joror runtime paths and freeze the object recursively. It must contain no `assignOrder`, reducer, timer, random choice, or mission logic.

  During migration only, have `/living-village-lab/village` mount this same `CityScreen` fixture so the existing Playwright config can validate it. Add a visible `Prototype migration preview` label so nobody mistakes fixture state for a saved campaign. This route is deleted in Task 8.

- [ ] **Step 5: Verify and commit the shared interaction layer**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/components/city/camera.spec.ts
  pnpm --filter @summonlab/web test:e2e -- living-village-lab/village/village.e2e.ts
  pnpm --filter @summonlab/web typecheck
  pnpm exec prettier --check apps/web/src/lib/components/city apps/web/src/routes/living-village-lab/village/+page.svelte apps/web/src/routes/living-village-lab/village/village.e2e.ts
  git status --short
  git add apps/web/src/lib/components/city apps/web/src/routes/living-village-lab/village/+page.svelte apps/web/src/routes/living-village-lab/village/village.e2e.ts
  git commit -m "feat(city): extract shared village interactions"
  git push
  ```

---

## Task 3: Put the five-mode dock and occupancy ledger into the shared City shell

**Files:**

- Create: `apps/web/src/lib/components/city/CityModeDock.svelte`
- Create: `apps/web/src/lib/components/city/CityModeIcon.svelte`
- Create: `apps/web/src/lib/components/city/CityOccupancyLedger.svelte`
- Modify: `apps/web/src/lib/components/city/CityScreen.svelte`
- Modify: `apps/web/src/lib/components/city/city-screen.fixture.ts`
- Modify: `apps/web/src/routes/living-village-lab/village/village.e2e.ts`
- Reference: `apps/web/src/lib/components/village-shell/VillageModeNav.svelte`
- Reference: `apps/web/src/lib/components/village-shell/VillageModeIcon.svelte`
- Reference: `apps/web/src/lib/components/LivingHearthScene.svelte`

- [ ] **Step 1: Add failing layout assertions**

  Extend the shared-screen browser test to require:

  - exactly five dock links in the approved order and the current mode marked `aria-current="page"`;
  - dock bounding box above the viewport at 1440×900;
  - dock fixed above `env(safe-area-inset-bottom)` and below the quick/details sheet at 390×844;
  - five ledger rows in exact order with `occupants / capacity` and assignment count available to assistive technology;
  - no overlap among dock controls, camera controls, facility targets, resident targets, quick view, details, and ledger;
  - all interactive targets at least 44×44 CSS pixels on phone.

- [ ] **Step 2: Confirm the new assertions fail**

  Run:

  ```bash
  pnpm --filter @summonlab/web test:e2e -- living-village-lab/village/village.e2e.ts
  ```

  Expected: the fixture preview has no shared dock or canonical operational ledger.

- [ ] **Step 3: Implement the shared shell pieces**

  Port the existing dock's icon assets, accessibility name, URL behavior, and selected state into `CityModeDock.svelte`, using `CITY_MODES` and `cityModeHref`. Render it once in `CityScreen`: normal document flow on desktop and fixed at the phone bottom safe area. Do not render both desktop and phone dock copies.

  Port only the campaign scene's useful time plaque and occupancy information into `CityStatusStrip` and `CityOccupancyLedger`. The ledger loops over `view.occupancy`; it does not know engine building IDs or aggregate Residence. Use `aria-label="City occupancy and assignment capacity"`.

  Keep the viewport visually dominant. On phone, reserve dock height with layout padding so content is never obscured. A quick view is a bounded bottom sheet above the dock; details replaces it at the same stacking level.

- [ ] **Step 4: Verify and commit the complete shared shell**

  Run:

  ```bash
  pnpm --filter @summonlab/web test:e2e -- living-village-lab/village/village.e2e.ts
  pnpm --filter @summonlab/web typecheck
  pnpm exec prettier --check apps/web/src/lib/components/city apps/web/src/routes/living-village-lab/village/village.e2e.ts
  git status --short
  git add apps/web/src/lib/components/city apps/web/src/routes/living-village-lab/village/village.e2e.ts
  git commit -m "feat(city): add dock and occupancy shell"
  git push
  ```

---

## Task 4: Add the narrow authoritative City action API

**Files:**

- Create: `packages/contracts/src/city-actions.ts`
- Create: `packages/contracts/src/city-actions.spec.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/web/src/lib/server/city-actions.ts`
- Create: `apps/web/src/lib/server/city-actions.spec.ts`
- Create: `apps/web/src/routes/api/runs/[runId]/city-actions/+server.ts`
- Reference: `apps/web/src/routes/api/runs/[runId]/directives/+server.ts`
- Reference: `packages/contracts/src/engine/commands.ts`

- [ ] **Step 1: Specify the request boundary with failing tests**

  Define a strict request schema that accepts only:

  ```ts
  {
    action: 'court-training' | 'rest';
    heroId: string;
    expectedVersion: number;
  }
  ```

  Test rejection of missing hero ID, negative/fractional version, unknown keys, fake hunt/species fields, arbitrary building IDs, arbitrary roles, and raw engine command objects. This endpoint is intentionally narrower than the dev-only `/commands` route.

- [ ] **Step 2: Specify command mapping with failing tests**

  In `city-actions.spec.ts`, test `cityIntentCommand(snapshot, request, commandId)`:

  ```ts
  expect(command).toMatchObject({
    commandType: 'settlement.assign.hero',
    actorId: snapshot.state.master.masterId,
    heroId,
    expectedVersion,
    buildingId: 'training-ground',
    role: 'trainee',
    source: { source: 'manual', timing: 'step' }
  });
  ```

  The `rest` mapping is `dormitory` / `resident`. Assert `commandId === correlationId`. Add a guard that rejects snapshots without facility state or without the requested active hero before database commit.

- [ ] **Step 3: Run and observe the expected failure**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/city-actions.spec.ts apps/web/src/lib/server/city-actions.spec.ts
  ```

  Expected: the schema and mapper modules do not exist.

- [ ] **Step 4: Implement schema, mapper, and production endpoint**

  Export the schema and inferred type from `@summonlab/contracts`. The endpoint must:

  1. parse JSON with `CityActionRequestSchema`;
  2. fetch the current snapshot and return 404 when absent;
  3. preserve the client's `expectedVersion` when building the command so stale screens get 409 rather than silently overwriting newer state;
  4. use the authoritative master ID as the assignment actor;
  5. commit exactly one existing `settlement.assign.hero` command;
  6. return `runId`, new `version`, new `eventCursor`, `heroId`, and the committed assignment;
  7. map `StaleRunVersionError`, `IdempotencyConflictError`, and `IllegalActionError` to concise 409 responses and invalid input to 400.

  Do not gate this endpoint with `devRoutesEnabled`. Do not duplicate assignment capacity, role, or legality logic; the engine remains authoritative.

- [ ] **Step 5: Verify and commit the action seam**

  Run:

  ```bash
  pnpm vitest run packages/contracts/src/city-actions.spec.ts apps/web/src/lib/server/city-actions.spec.ts packages/contracts/src/contracts.spec.ts
  pnpm --filter @summonlab/contracts typecheck
  pnpm --filter @summonlab/web typecheck
  pnpm exec prettier --check packages/contracts/src/city-actions.ts packages/contracts/src/city-actions.spec.ts packages/contracts/src/index.ts apps/web/src/lib/server/city-actions.ts apps/web/src/lib/server/city-actions.spec.ts apps/web/src/routes/api/runs/'[runId]'/city-actions/+server.ts
  git status --short
  git add packages/contracts/src/city-actions.ts packages/contracts/src/city-actions.spec.ts packages/contracts/src/index.ts apps/web/src/lib/server/city-actions.ts apps/web/src/lib/server/city-actions.spec.ts apps/web/src/routes/api/runs/'[runId]'/city-actions/+server.ts
  git commit -m "feat(city): commit resident assignments"
  git push
  ```

---

## Task 5: Mount the canonical City on the campaign route

**Files:**

- Modify: `apps/web/src/routes/play/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/play/[runId]/+page.svelte`
- Modify: `apps/web/src/routes/village-shell.e2e.ts`
- Modify: `apps/web/src/lib/server/city.spec.ts`
- Modify: `apps/web/src/lib/components/village-shell/VillageResidentsPanel.svelte`
- Reference: `apps/web/src/lib/components/village-shell/VillageResidentsPanel.svelte`
- Reference: `apps/web/src/lib/components/village-shell/VillageTowerPanel.svelte`
- Reference: `apps/web/src/lib/components/village-shell/VillageInventoryPanel.svelte`
- Reference: `apps/web/src/lib/components/village-shell/VillageMissionsPanel.svelte`

- [ ] **Step 1: Rewrite the campaign E2E expectations before production code**

  Keep `prepareArrivedCampaign`. Change the main test so `/play/[runId]` requires one `[data-testid="city-screen"]`, one `[data-testid="city-village-viewport"]`, and zero legacy `[data-testid="living-settlement"]` renderers. Migrate the lab's assertions for pan/zoom, resident ribbon, quick view, mutually exclusive details, keyboard focus, reduced motion, and 390×844 phone layout.

  Also require:

  - the five dock destinations and five physical facility labels, with `Portal` and no visible `Tower Portal`;
  - three authoritative residents with approved transparent `village-cutout` images at projected nodes;
  - time/day/state plaque and operational rows `Dorm`, `Kitchen`, `Gate`, `Training`, `Forge` matching the page's projected counts;
  - clicking `Court training` posts `{ action: 'court-training', heroId, expectedVersion }`, refreshes the server data, and changes that hero's authoritative assignment to Training;
  - clicking `Rest` posts the analogous intent and refreshes the assignment to Dorm;
  - a stale response leaves the resident in the old projected position and displays its 409 reason;
  - Details makes no world-changing request;
  - Portal opens `?mode=tower`, where unsupported expedition buttons remain absent;
  - Residents, Tower, Inventory, and Missions continue to show their existing truthful campaign content inside the same `CityScreen` shell.

- [ ] **Step 2: Run the campaign test and confirm red**

  Start the repository database and app if they are not already listening, then run:

  ```bash
  pnpm db:start
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts
  ```

  Expected: `/play/[runId]` still mounts `LivingHearthScene` and does not expose the shared interactions or City action requests. If local Docker/Postgres is unavailable, record that infrastructure blocker, but continue only after all non-database unit/type checks are green; the task cannot be called complete until this E2E runs in an environment with the repository database.

- [ ] **Step 3: Project the route's server data once**

  In `+page.server.ts`, retain the existing proof-run, catch-up, campaign, equipment, scene, portrait, and `SettlementPresentation` loads. Replace `VillageResident[]` assembly with the richer truthful `CityResidentInput[]`, then call `projectCityView` once. Return `city` plus only the legacy data still required outside the City branch.

  Use engine snapshot health/progression/current activity and manifest/social data where available. Use `runtimePortraitFor(..., 'village-cutout')` for `sceneArt` and roster/dialogue art for quick/details. Missing approved scene art becomes the labeled non-character missing-art state; it is never substituted with an opaque portrait.

- [ ] **Step 4: Replace the campaign Village branch with `CityScreen`**

  In `+page.svelte`, keep onboarding/opening and any non-City campaign states outside the arrived-City branch. For the arrived state, render one `CityScreen view={data.city}`. Move the existing Residents, Tower, Inventory, and Missions panels into CityScreen slots/snippets or direct child props so changing `mode` does not leave the shared shell.

  Implement `onIntent` as:

  1. set pending/error UI state;
  2. POST the narrow intent to `/api/runs/${runId}/city-actions`;
  3. on success, `await invalidateAll()` so resident movement and counts come only from the next projection;
  4. on failure, keep the old `view` untouched and show the returned reason beside the action;
  5. clear pending state in `finally`.

  Do not optimistically patch residents, facilities, occupancy, or version.

- [ ] **Step 5: Verify both rendering and authoritative mutation**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/city.spec.ts apps/web/src/lib/server/city.spec.ts apps/web/src/lib/server/city-actions.spec.ts apps/web/src/lib/village-scene.spec.ts
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts
  pnpm --filter @summonlab/web typecheck
  pnpm exec prettier --check apps/web/src/routes/play/'[runId]'/+page.server.ts apps/web/src/routes/play/'[runId]'/+page.svelte apps/web/src/routes/village-shell.e2e.ts apps/web/src/lib/server/city.spec.ts apps/web/src/lib/components/village-shell/VillageResidentsPanel.svelte
  git status --short
  git add apps/web/src/routes/play/'[runId]'/+page.server.ts apps/web/src/routes/play/'[runId]'/+page.svelte apps/web/src/routes/village-shell.e2e.ts apps/web/src/lib/server/city.spec.ts apps/web/src/lib/components/village-shell/VillageResidentsPanel.svelte
  git commit -m "feat(city): converge campaign village"
  git push
  ```

---

## Task 6: Generate the bounded circular-wall environment candidate

**Required skills:** `imagegen`, then `summonlab-image-production` for manifest-bound persistence and provenance.

**Files:**

- Create: `assets/settlements/hearth-01/experiments/city-circular-wall-v1/manifest.json`
- Create: `assets/settlements/hearth-01/experiments/city-circular-wall-v1/hearth-01-circular-wall-candidate.png`
- Create: `docs/evidence/city-circular-wall-v1-desktop.png`
- Create: `docs/evidence/city-circular-wall-v1-phone.png`
- Create: `docs/evidence/city-circular-wall-v1-review.md`
- Reference: `assets/settlements/hearth-01/hearth-01-threshold-v2.png`
- Reference: `packages/content/src/hearth-01-scene.ts`

- [ ] **Step 1: Inspect the accepted source at original resolution**

  Confirm the source hash matches the current scene provenance and inspect the upper-left wall, right circular wall, Summoning Circle, branch path, nearby vegetation, lamps, and retaining stones. Record the source hash in the experiment manifest before generation.

- [ ] **Step 2: Generate one narrow edit from the accepted source**

  Use the accepted 1536×1024 source as the required image-edit reference with this bounded instruction:

  ```text
  Preserve this accepted Hearth 01 village image, camera, framing, style, palette, lighting,
  mountains, central road, Portal, Residence, Training Grounds, Forge, facility scale, and all
  unaffected pixels as closely as possible. Change only the upper-left district: curve the outer
  wall into a smooth circular silhouette that mirrors the rounded right wall; move the Summoning
  Circle slightly toward the foreground to create room for that curve; reconnect only its short
  branch path and adjust the immediately adjacent vegetation, lamps, and retaining stones. Keep the
  base plate hero-free and UI-free. Add no people, characters, animals, labels, text, icons, panels,
  tower building, separate kitchen, or watermark.
  ```

  Do not ask the model to reinterpret the whole Village. Persist the returned candidate through the project image-production workflow with prompt, source hash, output hash, dimensions, and ownership provenance.

- [ ] **Step 3: Validate the candidate mechanically**

  Require 1536×1024 dimensions, RGB/RGBA bitmap, no alpha holes, and successful repository asset validation. Render it through the shared `CityScreen` test harness at 1440×900 and 390×844 with labels/residents hidden for the clean environment review captures.

  Run:

  ```bash
  pnpm validate:repository-assets
  pnpm validate:settlement-scene
  ```

- [ ] **Step 4: Commit the candidate as an experiment and stop for visual approval**

  The review note must ask only these decisions: Is the upper-left wall now as circular as the right? Is the Circle far enough forward without shrinking the courtyard? Did anything outside the bounded edit drift? Do not update the runtime scene binding yet.

  ```bash
  git status --short
  git add assets/settlements/hearth-01/experiments/city-circular-wall-v1 docs/evidence/city-circular-wall-v1-desktop.png docs/evidence/city-circular-wall-v1-phone.png docs/evidence/city-circular-wall-v1-review.md
  git commit -m "art(city): propose circular wall revision"
  git push
  ```

  **Checkpoint:** Stop here until the owner accepts, revises, experiments on, or defers this candidate. A revision creates `candidate-02.png` in the same experiment with its own generation record; it does not overwrite candidate 01.

---

## Task 7: Promote the accepted environment and align scene geometry

**Prerequisite:** The owner explicitly accepted a Task 6 candidate.

**Files:**

- Create: `assets/settlements/hearth-01/hearth-01-threshold-v3.png`
- Create: `apps/web/static/runtime/settlements/hearth-01/environment.<content-hash-prefix>.webp`
- Modify: `packages/content/src/hearth-01-scene.ts`
- Modify: `packages/content/src/hearth-01-scene.spec.ts`
- Modify: `apps/web/src/lib/components/city/city-screen.fixture.ts`
- Modify: `apps/web/src/routes/village-shell.e2e.ts`
- Modify: `docs/evidence/city-circular-wall-v1-review.md`

- [ ] **Step 1: Write failing scene-binding assertions**

  Update `hearth-01-scene.spec.ts` to require:

  - `HEARTH_01_SCENE_VERSION === 'hearth-01-scene-v3'`;
  - source filename `hearth-01-threshold-v3.png` and its exact accepted SHA-256;
  - runtime filename containing the generated WebP hash prefix and matching bytes/hash/dimensions;
  - portal display label exactly `Portal` with facility ID `tower-portal`;
  - the Summoning Circle center, bounds, label anchor, and gate-node projections measured from the accepted pixels;
  - every authored building and node still projected once and every bound within the normalized canvas.

- [ ] **Step 2: Confirm tests fail against v2**

  Run:

  ```bash
  pnpm vitest run packages/content/src/hearth-01-scene.spec.ts apps/web/src/lib/village-scene.spec.ts
  ```

  Expected: v2 provenance, runtime binding, portal label, and old Circle geometry fail.

- [ ] **Step 3: Promote without destructive overwrite**

  Copy the accepted experiment output to the new versioned source path, encode the content-addressed WebP using the existing quality 86 / effort 6 / picture preset / smart-subsample / stripped-metadata settings, and retain the previous v2 source and runtime file for historical reproducibility. Record exact bytes and hashes in the v3 scene definition.

  Measure the moved Circle and affected `gate-dais`, `gate-court`, and `gate-rail` positions from the accepted raster. Update only those hotspot/node entries whose pixels changed. Recalculate `sceneHash` using `calculateSettlementSceneHash`; never handwave or copy the old hash.

- [ ] **Step 4: Verify the promoted image through the real campaign**

  Run:

  ```bash
  pnpm validate:settlement-scene
  pnpm validate:repository-assets
  pnpm vitest run packages/content/src/hearth-01-scene.spec.ts apps/web/src/lib/village-scene.spec.ts apps/web/src/lib/server/city.spec.ts
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts
  pnpm --filter @summonlab/web typecheck
  ```

  Capture a real arrived campaign at desktop and phone sizes and confirm label leaders, cutouts, and routes attach to the moved pixels.

- [ ] **Step 5: Commit and push the accepted runtime binding**

  ```bash
  git status --short
  git add assets/settlements/hearth-01/hearth-01-threshold-v3.png apps/web/static/runtime/settlements/hearth-01 packages/content/src/hearth-01-scene.ts packages/content/src/hearth-01-scene.spec.ts apps/web/src/lib/components/city/city-screen.fixture.ts apps/web/src/routes/village-shell.e2e.ts docs/evidence/city-circular-wall-v1-review.md
  git commit -m "art(city): promote circular Hearth village"
  git push
  ```

---

## Task 8: Remove both superseded Village paths after parity

**Prerequisite:** Tasks 1-5 are green; Tasks 6-7 may be complete or the environment edit may be explicitly deferred without blocking code convergence.

**Files:**

- Delete: `apps/web/src/lib/components/LivingHearthScene.svelte`
- Delete: `apps/web/src/lib/components/living-village/village/VillageViewport.svelte`
- Delete: `apps/web/src/lib/components/living-village/village/VillageHeroDrawer.svelte`
- Delete: `apps/web/src/lib/components/living-village/village/VillageSummary.svelte`
- Delete: `apps/web/src/lib/components/living-village/village/types.ts`
- Delete: `apps/web/src/routes/living-village-lab/village/+page.svelte`
- Delete: `apps/web/src/routes/living-village-lab/village/fixtures.ts`
- Delete: `apps/web/src/routes/living-village-lab/village/playwright.village.config.ts`
- Delete: `apps/web/src/routes/living-village-lab/village/village.e2e.ts`
- Delete: `apps/web/src/routes/living-village-lab/village/cutouts/README.md`
- Delete: `apps/web/src/routes/living-village-lab/village/cutouts/dara-zev.png`
- Delete: `apps/web/src/routes/living-village-lab/village/cutouts/iven-orra.png`
- Delete: `apps/web/src/routes/living-village-lab/village/cutouts/jori-daro.png`
- Delete: `apps/web/src/routes/living-village-lab/village/cutouts/kira-toren.png`
- Delete: `apps/web/src/routes/living-village-lab/village/cutouts/mara-vey.png`
- Delete: `apps/web/src/routes/living-village-lab/village/cutouts/remy-nahl.png`
- Delete: `apps/web/src/lib/components/village-shell/VillageModeNav.svelte`
- Delete: `apps/web/src/lib/components/village-shell/VillageModeIcon.svelte`
- Delete: `apps/web/src/lib/village-shell.ts`
- Delete: `apps/web/src/lib/village-shell.spec.ts`
- Modify: `apps/web/src/routes/living-village-lab/+page.svelte`
- Modify: `apps/web/src/routes/village-shell.e2e.ts`

- [ ] **Step 1: Prove the campaign test owns every liked scenario**

  Compare the retired lab E2E against `village-shell.e2e.ts`. Before deletion, require a campaign assertion for each still-valid behavior: ribbon/world selection convergence, quick view, Details replacement, pan, zoom, fit/reset, five facilities, dock placement, ledger, keyboard, reduced motion, touch targets, authoritative training/rest, and rejected-command feedback. Fake hunt and local resident mutation are intentionally not migrated.

- [ ] **Step 2: Add a no-duplicate ownership test**

  Add a source-boundary assertion to `city.spec.ts` that scans player route imports and requires `CityScreen.svelte` while rejecting `LivingHearthScene`, `VillageViewport`, and `/living-village-lab/village`. Also assert there is exactly one exported five-mode constant: `CITY_MODES`.

- [ ] **Step 3: Run the boundary test red**

  Run:

  ```bash
  pnpm vitest run apps/web/src/lib/city.spec.ts
  ```

  Expected: legacy files/imports and `VILLAGE_MODES` still exist.

- [ ] **Step 4: Remove the superseded code and route**

  First run read-only ownership checks:

  ```bash
  rg -n "LivingHearthScene|VillageViewport|VillageHeroDrawer|VillageSummary|VillageModeNav|VILLAGE_MODES|living-village-lab/village" apps/web/src
  ```

  Remove only the files listed above after confirming their behavior exists under `components/city`. Update the lab index to remove the Village card; do not redirect it to a fixture. Delete `village-shell.ts` and `village-shell.spec.ts`; Task 1 already moved their approved mode behavior into `city.ts` and `city.spec.ts`. Remove the old dock components only after all imports use `CityModeDock`.

  The existing Residents/Tower/Inventory/Missions panel components may remain temporarily because they are real campaign surfaces, not competing Village renderers. Their future rename is outside this convergence.

- [ ] **Step 5: Prove no competing implementation remains**

  Run:

  ```bash
  rg -n "LivingHearthScene|VillageViewport|VillageHeroDrawer|VillageSummary|VillageModeNav|VILLAGE_MODES|living-village-lab/village" apps/web/src
  pnpm vitest run apps/web/src/lib/city.spec.ts apps/web/src/lib/server/city.spec.ts apps/web/src/lib/server/city-actions.spec.ts apps/web/src/lib/village-scene.spec.ts
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts
  pnpm --filter @summonlab/web typecheck
  ```

  Expected `rg` output: only the historical campaign E2E filename/seed, or no matches. There must be no player route import and no public Village fixture route.

- [ ] **Step 6: Commit and push the retirement**

  ```bash
  git status --short
  git add -A apps/web/src/lib/components/LivingHearthScene.svelte apps/web/src/lib/components/living-village/village apps/web/src/routes/living-village-lab apps/web/src/lib/components/village-shell/VillageModeNav.svelte apps/web/src/lib/components/village-shell/VillageModeIcon.svelte apps/web/src/lib/village-shell.ts apps/web/src/lib/village-shell.spec.ts apps/web/src/lib/city.spec.ts apps/web/src/routes/village-shell.e2e.ts
  git commit -m "refactor(city): retire duplicate village renderers"
  git push
  ```

---

## Task 9: Record convergence and run the release gate

**Files:**

- Modify: `docs/superpowers/specs/2026-09-09-village-city-convergence-design.md`
- Create: `docs/evidence/village-city-convergence-validation.md`
- Create: `docs/evidence/village-city-convergence-desktop.png`
- Create: `docs/evidence/village-city-convergence-phone.png`
- Create: `docs/evidence/village-city-convergence-resident-quick-view.png`
- Create: `docs/evidence/village-city-convergence-resident-details.png`
- Modify: `docs/design-proposals/living-village-ui/README.md`

- [ ] **Step 1: Capture final real-state evidence**

  Serve the app on `0.0.0.0` and verify the listening interface. Create one arrived campaign and capture `/play/[runId]` at 1440×900 and 390×844, plus quick-view and details states. Do not use the removed fixture route. The validation note records the run seed, browser sizes, runtime image hash, exact test commands, and whether the database-backed action assertions passed.

- [ ] **Step 2: Run focused and repository-wide validation**

  Run in this order so failures are attributable:

  ```bash
  pnpm vitest run packages/contracts/src/city-actions.spec.ts packages/contracts/src/contracts.spec.ts packages/content/src/hearth-01-scene.spec.ts apps/web/src/lib/city.spec.ts apps/web/src/lib/server/city.spec.ts apps/web/src/lib/server/city-actions.spec.ts apps/web/src/lib/village-scene.spec.ts apps/web/src/lib/components/city/camera.spec.ts
  pnpm validate:settlement-scene
  pnpm validate:repository-assets
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts
  pnpm --filter @summonlab/web lint
  pnpm --filter @summonlab/web typecheck
  pnpm --filter @summonlab/web build
  pnpm check
  ```

  Record exact successes and any environment-only limitation. Do not label the convergence complete if the campaign E2E, typecheck, build, or focused tests are unrun or failing.

- [ ] **Step 3: Mark the approved design implemented**

  Change the spec status to `Implemented` only after the gates above pass. Update the Living Village design README to state that `/play/[runId]` is the canonical City and that frozen City projections are test input, not a standalone product path. Record the environment outcome as accepted/promoted or explicitly deferred.

- [ ] **Step 4: Perform the plan-completeness audit**

  Before the final commit:

  - map every accepted product decision and every completion criterion in the spec to a passing test or evidence item;
  - scan new source/docs for `TODO`, `TBD`, `placeholder`, fictional hero IDs, fake hunt logic, and hardcoded unhashed environment paths;
  - confirm City types are imported consistently and there is no second mode enum, facility mapping, assignment mapper, or resident reducer;
  - run `git diff --check` and inspect `git status --short` for unrelated files.

- [ ] **Step 5: Commit, push, and hand off the runnable City**

  ```bash
  git status --short
  git add docs/superpowers/specs/2026-09-09-village-city-convergence-design.md docs/evidence/village-city-convergence-validation.md docs/evidence/village-city-convergence-desktop.png docs/evidence/village-city-convergence-phone.png docs/evidence/village-city-convergence-resident-quick-view.png docs/evidence/village-city-convergence-resident-details.png docs/design-proposals/living-village-ui/README.md
  git commit -m "docs(city): record convergence validation"
  git push
  git status --short
  ```

  Hand off the exact remote preview URL using `10.110.24.122` with the full port and `/play/[runId]` path. Ask the owner to test: (1) dock placement and mode continuity on desktop/phone, (2) resident quick view → Details → training/rest behavior, and (3) upper-left wall/Circle composition. The decisions sought are whether the City is now the sole preferred Village, whether any liked lab interaction is missing, and whether the bounded environment revision is final.
