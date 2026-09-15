# Canonical Tower and Combat Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every remaining player-like Tower, mission, exploration, and combat prototype with one persistent `/tower` mode inside the canonical City application, while preserving the useful authored content and the two useful combat presentations.

**Architecture:** Extend the singleton `CityViewModel` with a server-projected Tower state machine. Floor selection, tile exploration, encounter resolution, loot, and extraction remain states of the same `/tower` mode and one authoritative campaign run. Turn-based and automated combat consume the same encounter request and produce the same receipt shape; only their control and presentation adapters differ. Prototype routes are removed in the same slice that gives their useful behavior a tested canonical home.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript 6, Zod 4, PostgreSQL, Vitest 4, Playwright 1.60, PixiJS 8.20, pnpm 10.33, Node 24

**Spec:** `docs/superpowers/specs/2026-09-10-single-village-progression-design.md`

## Non-negotiable boundary

- `/tower` is the only player-facing Tower, exploration, and combat surface.
- The Village Portal and the Tower dock destination both open the same `/tower` state.
- Tower Threshold is deleted outright; it has no behavior to migrate.
- Mission Lab contributes its authored first-five-floor content and knowledge rules, then its route is deleted.
- Ruined Observatory contributes the turn-based control/presentation adapter, then its route is deleted.
- Ruined Threshold contributes the automated control/presentation adapter, then its route is deleted.
- The two combat adapters share encounter, party, action legality, result, reward, replay, and persistence contracts. They are not separate engines.
- Exploration remains mounted at its exact authoritative tile while an encounter is active and resumes that tile after victory.
- Legacy `/mission/[runId]` UI and the emptied `/living-village-lab` root are deleted after their required commands have canonical coverage.
- Historical specifications, decisions, screenshots, mockups, and approved evidence assets remain as history. They do not remain as routes or runtime ownership.
- Development diagnostics may remain only when they provide a current, named engineering function, require `devRoutesEnabled`, and have no link from the player journey. Obsolete galleries and route-only fixtures are deleted.
- Use approved raster combat chibis and approved battlefield art. A missing approved character image renders a labeled missing-art state, never a procedural stand-in.
- Use test-first red/green cycles. Bind previews to `0.0.0.0` and publish them as `http://10.110.24.218:<port>`.

## Prototype disposition

| Current source | Canonical destination | Final disposition |
| --- | --- | --- |
| `VillageTowerPanel.svelte` threshold placeholder | `/tower` floor list | Replace and delete placeholder |
| `/living-village-lab/tower` | None | Delete outright |
| `/mission-lab` | Tower floor catalog and exploration knowledge projection | Migrate content/model; delete route and E2E |
| Floor One branch commits `0ba945265` and `d5ee4aa15` | Canonical exploration contracts, engine domain, and Tower viewport | Selectively port mechanics; do not merge route shell |
| `/living-village-lab/combat` | Turn-based encounter adapter | Migrate useful components; delete route |
| `/living-village-lab/realtime-combat` | Automated encounter adapter | Migrate useful components; delete route |
| `/mission/[runId]` | Canonical Tower commands and `/missions` objective history | Migrate coverage; delete page route |
| `/living-village-lab` and `LabBackLink.svelte` | None after child retirement | Delete |
| Route-local fixtures and route E2E | Canonical server/engine/component tests | Migrate useful assertions; delete fixtures/tests |
| Historical visual evidence | `docs/` and evidence catalogs | Keep, unlinked from runtime |

## File and responsibility map

### Authoritative Tower state

- `packages/contracts/src/exploration.ts` — selectively port the compatible Floor One attempt, tile, knowledge, and movement contracts from `0ba945265` and `d5ee4aa15`.
- `packages/contracts/src/exploration-combat.ts` — retain the shared encounter request, rejection, receipt, replay, and presentation bindings.
- `packages/content/src/tower-floor-01-exploration.ts` — selectively port the authored Floor One topology and validate it against the current floor package.
- `packages/content/src/tower-band-01.ts` — remain the canonical first-five-floor content source; no route-local copy.
- `packages/engine/src/domains/exploration/` — own legal movement, discovery, encounter suspension/resume, completion, and extraction transitions.
- `packages/database/migrations/` and `packages/database/src/` — persist one active exploration attempt and its encounter receipts under the singleton run.

### Canonical City/Tower projection

- `apps/web/src/lib/city.ts` — replace `tower: { available: false }` with a discriminated Tower view model.
- `apps/web/src/lib/server/singleton-village-page.ts` — load Tower content and active attempt state for `mode === 'tower'`.
- `apps/web/src/lib/server/tower.ts` — project floor list, preparation, exploration, encounter, report, and extraction states.
- `apps/web/src/lib/components/tower/` — own the canonical floor list, exploration viewport, encounter shell, report, and adapters.
- `apps/web/src/lib/components/city/CityScreen.svelte` — mount the canonical Tower surface under the existing five-option dock.
- `apps/web/src/routes/api/runs/[runId]/tower/` — typed commands for attempt start, movement, encounter action/policy, and extraction; run IDs remain internal API identifiers.

### Retirement and acceptance

- `docs/decisions/2026-09-14-tower-combat-retirement.md` — record what migrated, what was deleted, and what historical evidence remains.
- `apps/web/src/lib/city.spec.ts` — enforce the forbidden player-route list.
- `apps/web/src/routes/tower.e2e.ts` — cover the complete canonical flow on desktop and phone.
- Delete the three remaining `/living-village-lab/*` child routes, `/mission-lab`, `/mission/[runId]`, the lab root, `LabBackLink.svelte`, and route-only tests/fixtures after replacement coverage passes.

---

### Task 1: Freeze the retirement boundary with failing route tests

**Files:**

- Create: `docs/decisions/2026-09-14-tower-combat-retirement.md`
- Modify: `apps/web/src/lib/city.spec.ts`

- [ ] **Step 1: Write the retirement manifest**

Record every source in the disposition table above and give it one of exactly four states: `delete outright`, `migrate then delete`, `retain as internal diagnostic`, or `retain as historical evidence`. Include the target file or subsystem for every migrated capability.

- [ ] **Step 2: Add a failing forbidden-route assertion**

Scan `apps/web/src/routes` and assert that the final tree contains none of:

```text
living-village-lab
mission-lab
mission/[runId]
settlement-lab
summon/[runId]
onboarding/[runId]
```

Run:

```bash
pnpm --filter @summonlab/web exec vitest run src/lib/city.spec.ts
```

Expected: FAIL on the currently retained Tower/combat lab routes and legacy mission route.

- [ ] **Step 3: Commit the auditable boundary before migration**

```bash
git add docs/decisions/2026-09-14-tower-combat-retirement.md apps/web/src/lib/city.spec.ts
git commit -m "docs(tower): freeze prototype retirement boundary"
git push origin HEAD
```

### Task 2: Port Floor One mechanics without its lab shell

**Files:**

- Create: `packages/contracts/src/exploration.ts`
- Create: `packages/contracts/src/exploration.spec.ts`
- Create: `packages/content/src/tower-floor-01-exploration.ts`
- Create: `packages/content/src/tower-floor-01-exploration.spec.ts`
- Create: `packages/engine/src/domains/exploration/model.ts`
- Create: `packages/engine/src/domains/exploration/model.spec.ts`
- Modify: package indexes and public API snapshots

- [ ] **Step 1: Recreate the source-branch contract and model tests first**

Use commits `0ba945265` and `d5ee4aa15` as provenance. Cover schema strictness, topology validity, fog/knowledge separation, legal adjacency, five-tile movement, attempt identity, and deterministic state hashes. Do not copy route components or fixture navigation.

- [ ] **Step 2: Run the focused package tests and verify red**

```bash
pnpm --filter @summonlab/contracts test -- src/exploration.spec.ts
pnpm --filter @summonlab/content test -- src/tower-floor-01-exploration.spec.ts
pnpm --filter @summonlab/engine test -- src/domains/exploration/model.spec.ts
```

Expected: FAIL because the current branch does not expose the exploration model.

- [ ] **Step 3: Selectively port and adapt the mechanics**

Keep the current `@summonlab/contracts` encounter contract as the encounter boundary. Port only domain/content code compatible with the singleton run and current package versions. Ensure movement commands can suspend on an encounter and resume without constructing a new attempt.

- [ ] **Step 4: Run package tests and public API checks**

```bash
pnpm --filter @summonlab/contracts test
pnpm --filter @summonlab/content test
pnpm --filter @summonlab/engine test
pnpm check:engine-boundaries
```

Expected: PASS.

### Task 3: Persist one Tower attempt and shared encounter receipts

**Files:**

- Create: the next sequential database migration for exploration attempts
- Create: `packages/database/src/exploration.ts`
- Create: `packages/database/src/exploration.integration.spec.ts`
- Modify: `packages/database/src/index.ts`

- [ ] **Step 1: Write failing integration tests**

Cover start idempotency, optimistic version rejection, reload from the same tile, one active encounter per attempt, receipt idempotency, victory resume, defeat termination, extraction, and concurrent duplicate commands.

- [ ] **Step 2: Run and verify red**

```bash
TEST_DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @summonlab/database test:integration -- src/exploration.integration.spec.ts
```

- [ ] **Step 3: Add normalized persistence and locked commands**

Store attempt state and receipts under the existing internal campaign run ID. Keep floor content hashes and encounter request hashes so reload/replay cannot silently use different rules.

- [ ] **Step 4: Run migrations and focused integration tests**

```bash
pnpm --filter @summonlab/database migrate
TEST_DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @summonlab/database test:integration -- src/migration.integration.spec.ts src/exploration.integration.spec.ts
```

Expected: PASS, including restart/reload assertions.

### Task 4: Project the first five floors into the canonical City model

**Files:**

- Modify: `apps/web/src/lib/city.ts`
- Create: `apps/web/src/lib/server/tower.ts`
- Create: `apps/web/src/lib/server/tower.spec.ts`
- Modify: `apps/web/src/lib/server/singleton-village-page.ts`
- Modify: `apps/web/src/lib/server/singleton-village-page.spec.ts`

- [ ] **Step 1: Write failing projector tests**

Assert one discriminated `TowerView` union for `floor-list | preparation | exploration | encounter | report`, derived from `loadTowerBand01()` and persistent attempt state. Verify floors one through five expose authored objectives, topology/knowledge, known monsters, reward summaries, and locked/available/active/cleared status without a Mission Lab data copy.

- [ ] **Step 2: Run and verify red**

```bash
pnpm --filter @summonlab/web exec vitest run src/lib/server/tower.spec.ts src/lib/server/singleton-village-page.spec.ts
```

- [ ] **Step 3: Implement the server-owned projection**

Replace `CityViewModel.tower.available: false` with the typed Tower union. Load detailed Tower state only in Tower mode; keep Village, Residents, Inventory, and Missions projections on the same singleton campaign.

- [ ] **Step 4: Verify projector and type boundaries**

```bash
pnpm --filter @summonlab/web exec vitest run src/lib/server/tower.spec.ts src/lib/server/singleton-village-page.spec.ts src/lib/city.spec.ts
pnpm --filter @summonlab/web typecheck
```

Expected: PASS; no canonical projector imports a route fixture.

### Task 5: Build one Tower viewport for selection and exploration

**Files:**

- Create: `apps/web/src/lib/components/tower/TowerScreen.svelte`
- Create: `apps/web/src/lib/components/tower/TowerFloorList.svelte`
- Create: `apps/web/src/lib/components/tower/TowerExplorationMap.svelte`
- Create: `apps/web/src/lib/components/tower/tower-screen.spec.ts`
- Create: typed Tower command endpoints under `apps/web/src/routes/api/runs/[runId]/tower/`
- Modify: `apps/web/src/lib/components/city/CityScreen.svelte`
- Delete: `apps/web/src/lib/components/village-shell/VillageTowerPanel.svelte`

- [ ] **Step 1: Write failing component and endpoint tests**

Cover dock persistence, floor selection, locked explanations, party readiness, manual adjacent/five-tile movement, automatic movement through the same command, fog, discoveries, encounter transition without route navigation, and exact-tile restoration.

- [ ] **Step 2: Run and verify red**

```bash
pnpm --filter @summonlab/web exec vitest run src/lib/components/tower/tower-screen.spec.ts
```

- [ ] **Step 3: Implement canonical components and typed commands**

Mount `TowerScreen` inside `CityScreen` for `view.mode === 'tower'`. The URL remains `/tower` across all internal states. Use the existing five-option City dock as the only global header.

- [ ] **Step 4: Verify the canonical Tower shell**

```bash
pnpm --filter @summonlab/web test
pnpm --filter @summonlab/web typecheck
```

Expected: PASS; Portal and dock both land on this screen.

### Task 6: Migrate both combat presentations onto one encounter

**Files:**

- Move/adapt: useful files from `apps/web/src/lib/components/living-village/combat/` to `apps/web/src/lib/components/tower/combat/turn-based/`
- Move/adapt: useful files from `apps/web/src/lib/components/living-village/realtime-combat/` to `apps/web/src/lib/components/tower/combat/automated/`
- Create: `apps/web/src/lib/components/tower/combat/TowerEncounter.svelte`
- Create: `apps/web/src/lib/components/tower/combat/encounter-adapters.spec.ts`
- Modify: Tower command endpoints and server projection

- [ ] **Step 1: Write one shared encounter conformance suite**

Run both adapters against the same request fixture and assert the same legal action boundary, final receipt hash, rewards, defeat/victory result, replay verification, and reduced-motion outcome. Presentation timing may differ; authoritative output may not.

- [ ] **Step 2: Run and verify red**

```bash
pnpm --filter @summonlab/web exec vitest run src/lib/components/tower/combat/encounter-adapters.spec.ts
```

- [ ] **Step 3: Adapt Ruined Observatory as turn-based control**

Replace its proxy playback ownership with legal player commands against the active Tower encounter. Keep useful initiative, action, focus, impact, settle, and activity-feed presentation.

- [ ] **Step 4: Adapt Ruined Threshold as automated control**

Keep useful agent playback, pause, speed, detail, replay verification, and approved 2.5D presentation. Remove independent fixture state and route ownership.

- [ ] **Step 5: Verify shared rules and approved assets**

```bash
pnpm --filter @summonlab/contracts test -- src/exploration-combat.spec.ts
pnpm --filter @summonlab/web exec vitest run src/lib/components/tower/combat
pnpm --filter @summonlab/web typecheck
```

Expected: PASS; both modes settle the same authoritative encounter.

### Task 7: Complete loot, extraction, and exact Village return

**Files:**

- Create: `apps/web/src/lib/components/tower/TowerReport.svelte`
- Modify: exploration persistence and City projector
- Modify: `packages/engine/src/objectives.ts` and focused tests
- Modify: `apps/web/src/lib/server/city.ts` and focused tests

- [ ] **Step 1: Write failing end-state tests**

Assert victory resumes exploration at the encounter tile, defeat closes the attempt without rewards, extraction commits loot exactly once, Floor One becomes cleared, the party returns to the Village Portal, and the resident schedule tutorial unlocks monotonically.

- [ ] **Step 2: Implement report and extraction transitions**

Use authoritative inventory and objective commands. Do not reset health/mana or synthesize training handoffs in route-local state.

- [ ] **Step 3: Verify reload and retry safety**

Run the focused engine, database, City, inventory, and objective suites. Expected: repeated extraction or browser refresh cannot duplicate rewards or move tutorial state backward.

### Task 8: Delete migrated prototypes and their runtime ownership

**Files:**

- Delete: `apps/web/src/routes/living-village-lab/tower/`
- Delete: `apps/web/src/routes/living-village-lab/combat/`
- Delete: `apps/web/src/routes/living-village-lab/realtime-combat/`
- Delete: `apps/web/src/routes/mission-lab/`
- Delete: `apps/web/src/routes/mission/[runId]/`
- Delete: `apps/web/src/routes/living-village-lab/`
- Delete: `apps/web/src/lib/components/living-village/LabBackLink.svelte`
- Delete/move: route-only fixtures, components, and Playwright files
- Modify: `apps/web/src/routes/iron-moon/+page.svelte`, `apps/web/src/routes/aftermath/+page.svelte`, and any remaining links

- [ ] **Step 1: Move surviving tests under canonical ownership**

Before deletion, map every non-CSS assertion from the lab E2E/unit tests to a canonical Tower, engine, or content test. Historical screenshots and documents stay under `docs/`; production imports to them are forbidden.

- [ ] **Step 2: Delete the routes and redirect no player link to replacements by query string**

Remove links from Iron Moon, Aftermath, reports, and debug return actions. Player continuation goes to `/tower`, `/missions`, or `/village` according to actual state.

- [ ] **Step 3: Run the forbidden-route test**

```bash
pnpm --filter @summonlab/web exec vitest run src/lib/city.spec.ts
rg -n "living-village-lab|mission-lab|/mission/" apps/web/src --glob '!**/*.spec.ts'
```

Expected: the test passes and `rg` finds no player link or runtime dependency. Historical documentation references are allowed.

- [ ] **Step 4: Audit remaining development routes**

For `design-reference`, `debug/*`, Forge galleries, story workshops, playtest tools, and archives, record a current owner and purpose. Keep only useful internal tools behind `devRoutesEnabled`; delete obsolete visual studies. None may appear in front-page, dock, facility, tutorial, or Tower navigation.

### Task 9: Prove the one-way player journey and prepare merge

**Files:**

- Create: `apps/web/src/routes/tower.e2e.ts`
- Modify: `apps/web/src/routes/campaign.e2e.ts`
- Modify: `docs/decisions/2026-09-14-tower-combat-retirement.md`

- [ ] **Step 1: Add desktop and phone end-to-end coverage**

Cover: front page → Village → three summons → starter equipment → Portal/Tower → Floor One → manual movement → encounter in each presentation → exact-tile resume → extraction → same Village. Reload once during exploration and once during combat. Assert the five-option dock stays the only global navigation chrome.

- [ ] **Step 2: Run the complete validation matrix under Node 24**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm check
pnpm test:integration
pnpm --filter @summonlab/web test:e2e -- tower.e2e.ts campaign.e2e.ts
```

Expected: all commands pass; any environment prerequisite is reported distinctly from a code failure.

- [ ] **Step 3: Serve the review build**

```bash
pnpm --filter @summonlab/web dev --host 0.0.0.0
```

Publish the exact assigned port as `http://10.110.24.218:<port>/` and ask the owner to compare turn-based and automated combat from the same Floor One encounter.

- [ ] **Step 4: Close the retirement record and merge only after approval**

Mark each disposition row with its canonical test/evidence location, verify the worktree is clean, push the branch, and present the merge commit range. Do not merge until the owner approves the canonical Tower playtest.

## Merge readiness definition

The consolidation is ready to merge only when:

1. `/village`, `/residents`, `/tower`, `/inventory`, and `/missions` are the only player destinations;
2. one persistent singleton campaign drives every destination;
3. floor selection, exploration, both combat presentations, loot, and extraction stay within `/tower`;
4. no migrated lab or legacy mission page exists;
5. the full validation matrix passes under the recorded Node 24 runtime;
6. historical evidence remains intact but has no runtime ownership; and
7. the owner has playtested the direct Village → Tower → Village loop and approved the merge.
