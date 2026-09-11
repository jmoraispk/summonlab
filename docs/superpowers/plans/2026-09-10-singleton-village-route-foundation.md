# Singleton Village Route Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the anonymous player one create-or-resume entry and one stable five-destination Village surface, while removing the two obsolete browsable Village prototypes and every player-facing run-ID link.

**Architecture:** A server-owned singleton resolver selects or creates the one active campaign. The public SvelteKit route `/(city)/[mode=city]` owns `/village`, `/residents`, `/tower`, `/inventory`, and `/missions`; it resolves the internal run ID on the server and returns a discriminated `onboarding | journey | city` page model. Existing onboarding and pre-City presentation are moved into reusable components behind `/village` for this foundation slice, then replaced by the accepted in-Village story and summoning flow in the next subproject. Old ID-bearing player routes become redirects only, and the settlement lab plus deterministic Village preview are deleted after their surviving assertions and non-playable visual evidence are migrated.

**Tech Stack:** TypeScript 6, Svelte 5, SvelteKit 2.63, Zod 4, Vitest 4, Playwright 1.60, PostgreSQL persistence through `@summonlab/database`, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-09-10-single-village-progression-design.md`

## Global Constraints

- There is one anonymous active Village. Run IDs remain internal database/API identifiers and must not appear in player URLs, dock links, facility links, or front-page markup.
- The only player destinations introduced here are `/village`, `/residents`, `/tower`, `/inventory`, and `/missions`. All five are rendered by the same canonical route and `CityScreen` shell.
- `/residents`, `/tower`, `/inventory`, and `/missions` redirect to `/village` until the campaign reaches the City stage. They must not expose a second onboarding or journey view.
- The first request to enter creates a campaign only when no active campaign exists. Repeated and concurrent entry requests in the current single-server anonymous deployment resolve to the same campaign.
- The existing campaign-creation API remains available for deterministic automated fixture setup and restart history, but no player UI calls it or follows an ID-bearing path. Fixture campaigns are serialized in browser tests so the newest active fixture is the singleton under test.
- Do not add account, registration, Village selection, reset, restart, seed selection, or multiple-campaign UI.
- Preserve the current onboarding and journey behavior only as temporary components mounted by `/village`. Do not redesign that content in this slice; the next plan moves the accepted story and three summons into the Village itself.
- Preserve all authoritative commands, clock catch-up, event cursors, resident actions, equipment projection, and approved raster character art.
- `CityScreen` and `CityVillageViewport` remain the sole player Village renderer. No new canvas, CSS-built character, fixture resident, or second City projector is permitted.
- Keep the six historical lab cutouts as non-playable wiki evidence, but move them out of route ownership. Do not promote them into the summonable roster in this slice.
- Historical documents remain historical. Mark superseded decisions; do not rewrite old evidence to pretend the retired routes never existed.
- Follow `AGENTS.md`: isolate in-scope changes, validate, commit with concise Conventional Commit subjects, push every completed task, and provide the remote `0.0.0.0` preview as `http://10.110.24.122:<port>`.

## Deliberately Deferred Follow-On Work

- Replacing the temporarily relocated onboarding presentation with the accepted in-Village backstory and Summoning Circle flow.
- Persisting the first three summons as tutorial stages and completing summon/roster/chibi/Village-cutout coverage for every spawn-enabled hero.
- Master-assisted starter forging, equipment assignment, Tower Floor One, unified exploration/combat, return placement, schedules, and agent deviations.
- Removing the opening, summon, Tower, exploration, and combat labs before their liked behavior has migrated in the corresponding later subproject.
- Distributed multi-instance singleton locking and authenticated multi-Village ownership. The current contract is one anonymous player served by one application process.

---

### Task 1: Make the five dock destinations canonical and run-ID-free

**Files:**
- Modify: `apps/web/src/lib/city.spec.ts`
- Modify: `apps/web/src/lib/city.ts`
- Modify: `apps/web/src/lib/components/city/CityModeDock.svelte`
- Modify: `apps/web/src/lib/components/city/CityScreen.svelte`
- Modify: `apps/web/src/lib/components/city/CityVillageViewport.svelte`
- Create: `apps/web/src/params/city.ts`
- Create: `apps/web/src/params/city.spec.ts`

**Interfaces:**
- Replaces: `cityModeHref(runId, mode)`.
- Produces: `CITY_MODE_PATHS`, `CityModePath`, `cityModeHref(mode)`, and the SvelteKit `city` matcher.

- [x] **Step 1: Write failing navigation and matcher tests**

  Replace the run-ID URL assertions in `apps/web/src/lib/city.spec.ts` with the complete public mapping:

  ```ts
  expect(CITY_MODES.map(({ id }) => cityModeHref(id))).toEqual([
    '/village',
    '/residents',
    '/tower',
    '/inventory',
    '/missions'
  ]);
  expect(cityModeHref('tower')).toBe('/tower');
  ```

  Add `apps/web/src/params/city.spec.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { match } from './city';

  describe('city route matcher', () => {
    it.each(['village', 'residents', 'tower', 'inventory', 'missions'])(
      'accepts %s',
      (mode) => expect(match(mode)).toBe(true)
    );

    it.each(['play', 'settlement-lab', 'living-village-lab', 'Village', '']) (
      'rejects %s',
      (mode) => expect(match(mode)).toBe(false)
    );
  });
  ```

- [x] **Step 2: Run the focused tests and verify RED**

  Run:

  ```bash
  pnpm --filter @summonlab/web exec vitest run src/lib/city.spec.ts src/params/city.spec.ts
  ```

  Expected: FAIL because `cityModeHref` still requires a run ID and the matcher does not exist.

- [x] **Step 3: Implement one typed path table**

  In `apps/web/src/lib/city.ts`, keep `CITY_MODES` as the product-order source and add:

  ```ts
  export const CITY_MODE_PATHS = {
    village: '/village',
    residents: '/residents',
    tower: '/tower',
    inventory: '/inventory',
    missions: '/missions'
  } as const satisfies Record<CityMode, `/${string}`>;

  export type CityModePath = (typeof CITY_MODE_PATHS)[CityMode];

  export function cityModeHref(mode: CityMode): CityModePath {
    return CITY_MODE_PATHS[mode];
  }
  ```

  Create `apps/web/src/params/city.ts` without copying the literal names:

  ```ts
  import { CITY_MODES } from '$lib/city';

  const modes = new Set<string>(CITY_MODES.map(({ id }) => id));

  export function match(value: string): boolean {
    return modes.has(value);
  }
  ```

- [x] **Step 4: Remove run IDs from both dock entry points**

  Change `CityModeDock.svelte` to accept only `current`, and resolve each `cityModeHref(mode.id)`. Remove `runId` from the `CityScreen` call. Change the Portal hotspot in `CityVillageViewport.svelte` to resolve `cityModeHref('tower')`. Use `CityModePath` in the `resolve` casts; do not retain `/play/${string}` casts or query-string mode navigation.

- [x] **Step 5: Verify navigation types and behavior**

  Run:

  ```bash
  pnpm --filter @summonlab/web exec vitest run src/lib/city.spec.ts src/params/city.spec.ts
  pnpm --filter @summonlab/web typecheck
  ```

  Expected: PASS; no City dock or Portal source contains `/play/`, `runId` props, or `?mode=`.

- [x] **Step 6: Commit and push the canonical-link slice**

  ```bash
  git add apps/web/src/lib/city.ts apps/web/src/lib/city.spec.ts apps/web/src/params/city.ts apps/web/src/params/city.spec.ts apps/web/src/lib/components/city/CityModeDock.svelte apps/web/src/lib/components/city/CityScreen.svelte apps/web/src/lib/components/city/CityVillageViewport.svelte
  git commit -m "refactor(city): use canonical destination paths"
  git push -u origin HEAD
  ```

---

### Task 2: Establish one idempotent anonymous campaign owner

**Files:**
- Create: `apps/web/src/lib/server/singleton-village.ts`
- Create: `apps/web/src/lib/server/singleton-village.spec.ts`
- Modify: `apps/web/src/routes/+page.server.ts`
- Modify: `apps/web/src/routes/+page.svelte`
- Modify: `apps/web/src/lib/server/campaign.ts`
- Modify: `apps/web/src/routes/api/campaigns/+server.ts`
- Modify: `apps/web/src/routes/campaign.e2e.ts`

**Interfaces:**
- Produces: `createSingletonVillageResolver(dependencies)` for deterministic tests and `getOrCreateSingletonVillage(databaseUrl, clockSpeed)` for runtime.
- Keeps: `POST /api/campaigns` as an internal deterministic-fixture/restart seam, while every returned player continuation points to `/village`.

- [x] **Step 1: Write failing singleton orchestration tests**

  Create `apps/web/src/lib/server/singleton-village.spec.ts` with an in-memory active campaign and deferred creation promise. Test all three contracts:

  ```ts
  it('returns the active campaign without creating another', async () => {
    const create = vi.fn<() => Promise<CampaignRun>>();
    const resolver = createSingletonVillageResolver({
      loadActive: vi.fn().mockResolvedValue(existing),
      create
    });
    await expect(resolver()).resolves.toBe(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it('coalesces concurrent first-entry requests', async () => {
    const results = await Promise.all([resolver(), resolver(), resolver()]);
    expect(new Set(results.map(({ runId }) => runId))).toEqual(new Set([created.runId]));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('clears a failed in-flight creation so retry can succeed', async () => {
    await expect(resolver()).rejects.toThrow('offline');
    await expect(resolver()).resolves.toEqual(created);
    expect(create).toHaveBeenCalledTimes(2);
  });
  ```

  Keep the factory dependency surface exact:

  ```ts
  interface SingletonVillageDependencies {
    loadActive(): Promise<CampaignRun | null>;
    create(): Promise<CampaignRun>;
  }
  ```

- [x] **Step 2: Run the focused unit test and verify RED**

  Run:

  ```bash
  pnpm --filter @summonlab/web exec vitest run src/lib/server/singleton-village.spec.ts
  ```

  Expected: FAIL because no singleton resolver exists.

- [x] **Step 3: Implement create-or-resume with one in-flight promise**

  In `singleton-village.ts`, define server-owned defaults:

  ```ts
  export const SINGLETON_VILLAGE_SEED = 'hearth-01-singleton-v1';
  export const SINGLETON_CONTROL_MODE: CampaignControlMode = 'wait';

  export function createSingletonVillageResolver(
    dependencies: SingletonVillageDependencies
  ): () => Promise<CampaignRun> {
    let inFlight: Promise<CampaignRun> | null = null;
    return async () => {
      const active = await dependencies.loadActive();
      if (active) return active;
      inFlight ??= dependencies.create();
      try {
        return await inFlight;
      } finally {
        inFlight = null;
      }
    };
  }
  ```

  Bind one module-level runtime resolver to `getLatestActiveCampaignRun` and `createPlayerCampaign`. Pass `getConfig().simulationSpeed` from the public wrapper; do not expose seed or control-mode inputs to the page.

- [x] **Step 4: Turn Enter Village into a server action**

  Replace root `resumePath` loading with a simple `hasVillage` boolean. Add a default action:

  ```ts
  export const actions = {
    default: async () => {
      const config = getConfig();
      try {
        await getOrCreateSingletonVillage(config.databaseUrl, config.simulationSpeed);
      } catch (cause) {
        return fail(503, {
          entryError: cause instanceof Error ? cause.message : 'The Village gate did not answer.'
        });
      }
      redirect(303, '/village');
    }
  } satisfies Actions;
  ```

  In `+page.svelte`, replace the anchor with `<form method="POST">` and a submit button retaining `class="enter-village"`, `data-testid="enter-village"`, and `data-sound-cue="gate"`. Display `form?.entryError` in an `aria-live="polite"` status. Remove `openingPath`, `villagePath`, and all front-page references to `/living-village-lab`.

- [x] **Step 5: Make every campaign continuation canonical**

  Change `campaignResumePath` in `apps/web/src/lib/server/campaign.ts` to return the constant `/village` for every campaign lifecycle stage:

  ```ts
  export function campaignResumePath(_campaign: CampaignRun): '/village' {
    return '/village';
  }
  ```

  Keep `POST /api/campaigns` seed/control-mode behavior as an internal fixture and restart seam; changing its creation semantics would erase deterministic test coverage without improving the player path. Its GET and POST responses now inherit `/village` from `campaignResumePath`. Add a source-boundary assertion in `singleton-village.spec.ts` that no component under `apps/web/src/routes/+page.svelte` or `apps/web/src/lib/components/` posts to `/api/campaigns` except `PlayerMenu.svelte`'s explicit restart action.

- [x] **Step 6: Update entry E2E assertions**

  In `campaign.e2e.ts`, replace assertions expecting `/onboarding/<id>` or `/play/<id>` from the front page/API with `/village`. Add a front-page test that submits **Enter Village** twice across two page loads and confirms the same active campaign through `GET /api/campaigns`; do not display that ID in DOM or URL assertions.

- [x] **Step 7: Verify, commit, and push singleton ownership**

  Run:

  ```bash
  pnpm --filter @summonlab/web exec vitest run src/lib/server/singleton-village.spec.ts
  pnpm --filter @summonlab/web typecheck
  ```

  Then:

  ```bash
  git add apps/web/src/lib/server/singleton-village.ts apps/web/src/lib/server/singleton-village.spec.ts apps/web/src/lib/server/campaign.ts apps/web/src/routes/+page.server.ts apps/web/src/routes/+page.svelte apps/web/src/routes/api/campaigns/+server.ts apps/web/src/routes/campaign.e2e.ts
  git commit -m "feat(village): add singleton anonymous entry"
  git push
  ```

---

### Task 3: Mount every campaign stage behind the canonical Village route

**Files:**
- Create: `apps/web/src/lib/server/singleton-village-page.ts`
- Create: `apps/web/src/lib/server/singleton-village-page.spec.ts`
- Create: `apps/web/src/lib/components/campaign/SingletonOnboarding.svelte`
- Create: `apps/web/src/lib/components/campaign/SingletonJourney.svelte`
- Create: `apps/web/src/lib/components/campaign/SingletonCity.svelte`
- Create: `apps/web/src/routes/(city)/[mode=city]/+page.server.ts`
- Create: `apps/web/src/routes/(city)/[mode=city]/+page.svelte`
- Modify: `apps/web/src/routes/onboarding/[runId]/+page.server.ts`
- Delete: `apps/web/src/routes/onboarding/[runId]/+page.svelte`
- Modify: `apps/web/src/routes/play/[runId]/+page.server.ts`
- Delete: `apps/web/src/routes/play/[runId]/+page.svelte`
- Modify: `apps/web/src/lib/player-audio.ts`
- Modify: `apps/web/src/lib/player-audio.spec.ts`
- Modify: `apps/web/src/lib/components/PlayerMenu.svelte`
- Modify: `apps/web/src/lib/hero-presentation-boundary.spec.ts`

**Interfaces:**
- Produces: `SingletonVillagePageData`, a discriminated union with `stage: 'onboarding' | 'journey' | 'city'`.
- Keeps: current authoritative onboarding APIs, arrival API, city-action API, projections, clock catch-up, and event streaming.
- Retires: ID-bearing player page implementations. Their route servers remain redirect-only for old bookmarks and test artifacts.

- [x] **Step 1: Write failing server-stage and source-boundary tests**

  In `singleton-village-page.spec.ts`, test a pure selector separately from database projection:

  ```ts
  expect(selectSingletonVillageStage({ onboardingStep: 0, arrived: false })).toBe('onboarding');
  expect(selectSingletonVillageStage({ onboardingStep: 3, arrived: false })).toBe('journey');
  expect(selectSingletonVillageStage({ onboardingStep: 3, arrived: true })).toBe('city');
  ```

  Add source-boundary assertions to `city.spec.ts`:

  ```ts
  expect(readFileSync(canonicalPage, 'utf8')).toContain('SingletonCity');
  expect(readFileSync(canonicalPage, 'utf8')).toContain('SingletonOnboarding');
  expect(readFileSync(canonicalPage, 'utf8')).toContain('SingletonJourney');
  expect(readFileSync(legacyPlayPageServer, 'utf8')).toContain("redirect(308, '/village')");
  expect(readFileSync(legacyOnboardingPageServer, 'utf8')).toContain("redirect(308, '/village')");
  expect(existsSync(legacyPlayPageSvelte)).toBe(false);
  expect(existsSync(legacyOnboardingPageSvelte)).toBe(false);
  ```

- [x] **Step 2: Run focused tests and verify RED**

  Run:

  ```bash
  pnpm --filter @summonlab/web exec vitest run src/lib/server/singleton-village-page.spec.ts src/lib/city.spec.ts
  ```

  Expected: FAIL because the canonical stage union and page do not exist.

- [x] **Step 3: Extract the existing pages without behavior redesign**

  Move the markup and logic from `onboarding/[runId]/+page.svelte` into `SingletonOnboarding.svelte`. Replace only its final navigation:

  ```ts
  await goto(resolve('/village'));
  ```

  Move the markup and logic from `play/[runId]/+page.svelte` into `SingletonJourney.svelte`. Keep its arrival timer, First Ember, event journal, equipment, and authoritative commands unchanged. Its `CityScreen` branch is removed because `SingletonCity.svelte` owns that branch. Give both extracted components explicit prop types exported from `singleton-village-page.ts`; neither component may inspect the pathname for its run ID.

  Create `SingletonCity.svelte` from only the existing City branch and these shared behaviors:

  ```svelte
  <RunConnection
    runId={data.city.runId}
    initialCursor={data.city.eventCursor}
    onEvent={showEventCue}
    onProjectionRefresh={refreshProjection}
  />
  <CityScreen
    view={{ ...data.city, eventCue }}
    onIntent={submitCityIntent}
    pendingIntent={pendingCityIntent}
    intentError={cityIntentError}
    onEquipmentChanged={refreshProjection}
  />
  ```

  Keep the internal run ID only in component/API props. It must not be interpolated into navigation URLs.

- [x] **Step 4: Extract one server projection for all three stages**

  Move the useful load logic from the two legacy page servers into `singleton-village-page.ts`. Define the public union:

  ```ts
  export type SingletonVillagePageData =
    | { readonly stage: 'onboarding'; readonly onboarding: OnboardingPageData }
    | { readonly stage: 'journey'; readonly journey: JourneyPageData }
    | { readonly stage: 'city'; readonly city: CityViewModel };
  ```

  Implement:

  ```ts
  export async function loadSingletonVillagePage(input: {
    readonly databaseUrl: string;
    readonly campaign: CampaignRun;
    readonly mode: CityMode;
  }): Promise<SingletonVillagePageData>;
  ```

  The function must:

  - load the campaign experience and summon/roster portraits for `onboarding`;
  - load proof snapshot, engine snapshot, clock, catch-up, event head, presentation, equipment, hero portraits, and scene for `journey`/`city` using the current code without changing command semantics;
  - select `city` only when `onboardingStep >= 3`, the proof is arrived, engine schema is 13, and City projection inputs exist;
  - throw the existing 404/409/503 errors with their current meaning;
  - call `projectCityView` exactly once and use the requested `mode` only for the `city` stage.

- [x] **Step 5: Add the one canonical route**

  In `(city)/[mode=city]/+page.server.ts`, resolve the active campaign server-side. Redirect to `/` if none exists. Parse `params.mode` through `parseCityMode`, load the union, and redirect non-Village modes during tutorial stages:

  ```ts
  if (page.stage !== 'city' && mode !== 'village') redirect(307, '/village');
  return page;
  ```

  In `+page.svelte`, render exactly one component:

  ```svelte
  {#if data.stage === 'onboarding'}
    <SingletonOnboarding data={data.onboarding} />
  {:else if data.stage === 'journey'}
    <SingletonJourney data={data.journey} />
  {:else}
    <SingletonCity data={data} />
  {/if}
  ```

  Use exhaustive type narrowing; do not add a default placeholder.

- [x] **Step 6: Convert old player routes into redirects**

  Delete both legacy `+page.svelte` files. Replace both route servers with unconditional permanent redirects to `/village`:

  ```ts
  import { redirect } from '@sveltejs/kit';
  import type { PageServerLoad } from './$types';

  export const load: PageServerLoad = () => redirect(308, '/village');
  ```

  Do not trust a run ID from an old bookmark and do not use it to switch the singleton.

- [x] **Step 7: Point route-sensitive support code at the canonical stage**

  Update `player-audio.ts` so all five canonical paths return the `hearth` profile; keep the gate sound as the explicit Enter-button cue. Remove the `/onboarding/` and `/play/` pathname cases and update the table in `player-audio.spec.ts` exactly:

  ```ts
  ['/village', 'hearth'],
  ['/residents', 'hearth'],
  ['/tower', 'hearth'],
  ['/inventory', 'hearth'],
  ['/missions', 'hearth'],
  ['/play/old-run', 'silence'],
  ['/onboarding/old-run', 'silence']
  ```

  Update both route-profile objects and restart navigation in `PlayerMenu.svelte` to use `hearth` and `/village`. Move the hero-art source-boundary check from the deleted onboarding page to `SingletonOnboarding.svelte`.

- [x] **Step 8: Verify, commit, and push the canonical stage owner**

  Run:

  ```bash
  pnpm --filter @summonlab/web exec vitest run src/lib/server/singleton-village-page.spec.ts src/lib/city.spec.ts src/lib/player-audio.spec.ts src/lib/hero-presentation-boundary.spec.ts
  pnpm --filter @summonlab/web typecheck
  ```

  Then:

  ```bash
  git add apps/web/src/lib/server/singleton-village-page.ts apps/web/src/lib/server/singleton-village-page.spec.ts apps/web/src/lib/components/campaign apps/web/src/routes/'(city)' apps/web/src/routes/onboarding apps/web/src/routes/play apps/web/src/lib/player-audio.ts apps/web/src/lib/player-audio.spec.ts apps/web/src/lib/components/PlayerMenu.svelte apps/web/src/lib/hero-presentation-boundary.spec.ts apps/web/src/lib/city.spec.ts
  git commit -m "refactor(village): mount campaign stages on one route"
  git push
  ```

---

### Task 4: Migrate campaign tests to the public singleton surface

**Files:**
- Modify: `apps/web/src/routes/village-shell.e2e.ts`
- Modify: `apps/web/src/routes/campaign.e2e.ts`
- Modify: `apps/web/src/routes/equipment-forging.e2e.ts`
- Modify: `apps/web/src/routes/events.e2e.ts`
- Modify: `apps/web/src/routes/performance.e2e.ts`
- Modify: `apps/web/src/routes/playtest-analytics.e2e.ts`
- Modify: `apps/web/src/routes/proof.e2e.ts`
- Modify: `apps/web/src/routes/replay/[runId]/+page.svelte`
- Modify: `apps/web/playwright.config.ts`

**Interfaces:**
- E2E setup may still use internal API run IDs to prepare authoritative state.
- Browser navigation and player assertions use only the five canonical paths.

- [x] **Step 1: Change Village shell assertions first and verify RED**

  In `village-shell.e2e.ts`, continue using the returned `runId` only for setup requests and API-response matching. Navigate with:

  ```ts
  await page.goto('/village');
  await expect(page).toHaveURL('/village');
  ```

  Assert every dock link exactly:

  ```ts
  await expect(villageLink).toHaveAttribute('href', '/village');
  await expect(residentsLink).toHaveAttribute('href', '/residents');
  await expect(towerLink).toHaveAttribute('href', '/tower');
  await expect(inventoryLink).toHaveAttribute('href', '/inventory');
  await expect(missionsLink).toHaveAttribute('href', '/missions');
  ```

  Replace the Tower URL assertion with `/tower`; add equivalent URL and selected-tab assertions for Residents, Inventory, and Missions. Assert `page.url()` never matches `/\/(play|onboarding)\//u`.

  Run the one test against the database-backed harness and expect RED until Tasks 1–3 are present:

  ```bash
  pnpm --filter @summonlab/web test:e2e -- village-shell.e2e.ts
  ```

- [x] **Step 2: Keep singleton E2E state deterministic**

  Add `workers: 1` to `apps/web/playwright.config.ts`. The canonical browser routes resolve the latest active fixture, so campaign UI tests must not create competing latest campaigns in parallel. Each setup creates its deterministic fixture immediately before opening the canonical route. Add a helper local to the campaign E2E group:

  ```ts
  async function openCanonicalVillage(page: Page) {
    await page.goto('/village');
    await expect(page).not.toHaveURL(/\/(?:play|onboarding)\//u);
  }
  ```

  Do not add `?runId=`, cookies that select a run, or test-only browser routes.

- [x] **Step 3: Migrate the remaining browser destinations**

  Update the listed E2E files so setup API calls retain their internal `runId`, but `page.goto` and final navigation use `/village` or the relevant dock destination. Change Replay’s “Return to settlement” link to `/village`. Where a test truly validates a legacy API rather than the player page, keep the API URL and rename the assertion to say `internal run API`.

- [ ] **Step 4: Run the focused canonical progression suite**

  > Environment note (2026-09-10): browser-test discovery succeeds, but execution remains open
  > because this workspace has neither Docker nor a PostgreSQL listener. The database-backed suite
  > must be run before integration.

  Start the repository harness if it is not running:

  ```bash
  pnpm dev
  ```

  In another shell run:

  ```bash
  pnpm --filter @summonlab/web test:e2e -- campaign.e2e.ts village-shell.e2e.ts equipment-forging.e2e.ts events.e2e.ts proof.e2e.ts
  ```

  Expected: PASS. The browser remains on canonical paths while authoritative API calls still target the resolved internal run.

- [x] **Step 5: Commit and push the E2E migration**

  ```bash
  git add apps/web/playwright.config.ts apps/web/src/routes/village-shell.e2e.ts apps/web/src/routes/campaign.e2e.ts apps/web/src/routes/equipment-forging.e2e.ts apps/web/src/routes/events.e2e.ts apps/web/src/routes/performance.e2e.ts apps/web/src/routes/playtest-analytics.e2e.ts apps/web/src/routes/proof.e2e.ts apps/web/src/routes/replay/'[runId]'/+page.svelte
  git commit -m "test(village): exercise canonical singleton routes"
  git push
  ```

---

### Task 5: Delete the two obsolete Village prototypes without losing evidence

**Files:**
- Modify: `apps/web/src/lib/city.spec.ts`
- Delete: `apps/web/src/routes/settlement-lab/+page.server.ts`
- Delete: `apps/web/src/routes/settlement-lab/+page.svelte`
- Delete: `apps/web/src/routes/settlement-lab.e2e.ts`
- Delete: `apps/web/src/lib/components/HearthScene.svelte`
- Delete: `apps/web/src/routes/living-village-lab/village/+page.server.ts`
- Delete: `apps/web/src/routes/living-village-lab/village/+page.svelte`
- Delete: `apps/web/src/routes/living-village-lab/village/playwright.village.config.ts`
- Delete: `apps/web/src/routes/living-village-lab/village/village.e2e.ts`
- Delete: `apps/web/src/lib/components/city/city-screen.fixture.ts`
- Move: `apps/web/src/routes/living-village-lab/village/cutouts/*` to `docs/evidence/living-village-lab-cutouts-v1/`
- Modify: `docs/evidence/living-village-lab-cutouts-v1/README.md`
- Modify: `apps/web/src/routes/living-village-lab/+page.svelte`
- Modify: `apps/web/src/routes/living-village-lab/living-village.e2e.ts`
- Modify: `apps/web/src/routes/living-village-lab/opening/+page.svelte`
- Modify: `apps/web/src/routes/mission-lab/+page.svelte`
- Modify: `apps/web/src/lib/server/wiki.ts`
- Modify: `apps/web/src/lib/server/wiki.spec.ts`
- Modify: `apps/web/src/routes/wiki/[...slug]/+page.server.ts`
- Modify: `tools/validate-web-build-budget.mjs`
- Modify: `docs/evidence/phase-3-runtime-budget.json`
- Modify: `docs/decisions/0011-versioned-settlement-route-graph.md`

**Interfaces:**
- Preserves: six PNGs as historical, non-spawnable wiki visual evidence.
- Deletes: both obsolete renderers, their browse routes, their route-local fixture, and their dedicated E2E/config files.

- [x] **Step 1: Expand the source-boundary test and verify RED**

  In `city.spec.ts`, make the sole-renderer test assert all retired files are absent, including:

  ```ts
  const retiredPaths = [
    'apps/web/src/routes/settlement-lab/+page.svelte',
    'apps/web/src/routes/settlement-lab/+page.server.ts',
    'apps/web/src/lib/components/HearthScene.svelte',
    'apps/web/src/routes/living-village-lab/village/+page.svelte',
    'apps/web/src/routes/living-village-lab/village/+page.server.ts',
    'apps/web/src/lib/components/city/city-screen.fixture.ts'
  ];
  for (const path of retiredPaths) expect(existsSync(resolve(repositoryRoot, path)), path).toBe(false);
  ```

  Assert the canonical page imports `SingletonCity`, and that only `CityScreen.svelte` imports `CityVillageViewport.svelte`.

  Run:

  ```bash
  pnpm --filter @summonlab/web exec vitest run src/lib/city.spec.ts
  ```

  Expected: FAIL because both retired paths still exist.

- [x] **Step 2: Move the six cutouts out of route ownership**

  Use `git mv` for all PNGs and the README into `docs/evidence/living-village-lab-cutouts-v1/`. Rewrite the README title to `Historical Living Village visual packet` and preserve the full source table. Add these explicit rules:

  - the images are wiki evidence, not approved summonable runtime assets;
  - they may not satisfy `village-cutout` lookup;
  - later hero migration may promote a character only through the canonical hero catalog and visual-trio validation.

  Update the wiki glob, `getWikiAsset` paths, route visual-packet mapping, and wiki tests to the new asset prefix.

- [x] **Step 3: Remove links before deleting routes**

  Remove the Village preview card from `living-village-lab/+page.svelte` and update its E2E expected-card list. Change the opening lab’s completion navigation to `/village`; it remains a developer story experiment until Task 2 of the governing design migrates it. Change the mission lab’s Hearth link to `/village`. Verify no player component or front page contains `/settlement-lab` or `/living-village-lab/village`.

- [x] **Step 4: Delete obsolete routes, renderer, fixture, and dedicated tests**

  Delete every listed settlement-lab and living-village-lab/village source file after Step 3. Delete `city-screen.fixture.ts` instead of moving it: its canonical behaviors now live in `village-shell.e2e.ts`, and deterministic data that remains useful must be declared inside tests rather than exported to a route.

- [x] **Step 5: Replace the obsolete build-budget surface**

  In `tools/validate-web-build-budget.mjs`, replace `settlementRouteKey` and the `settlementRouteLabLoadedJavaScriptGzipBytes` fields with canonical Village equivalents:

  ```js
  const villageRouteKey = await routeNodeKey('src/routes/(city)/[mode=city]/+page.svelte');
  const villageRouteEntries = new Set([...shellEntries, ...collect([villageRouteKey], true)]);
  ```

  Keep the same 700 KB gzip budget under `villageRouteLoadedJavaScriptGzipBytes`. Rebuild with `--write` so the evidence schema and measurement names match the living runtime rather than a deleted lab.

- [x] **Step 6: Mark the old topology decision superseded**

  Add a status note at the top of `docs/decisions/0011-versioned-settlement-route-graph.md`:

  ```md
  > Superseded for player routing on 2026-09-10 by
  > `docs/superpowers/specs/2026-09-10-single-village-progression-design.md`.
  > The settlement topology remains authoritative; `/settlement-lab` no longer exists.
  ```

  Do not remove its original rationale.

- [x] **Step 7: Verify deletion and evidence integrity**

  Run:

  ```bash
  pnpm --filter @summonlab/web exec vitest run src/lib/city.spec.ts src/lib/server/wiki.spec.ts
  pnpm validate:wiki
  pnpm validate:repository-assets
  pnpm --filter @summonlab/web build
  node tools/validate-web-build-budget.mjs --write
  pnpm validate:web-build-budget
  rg -n "settlement-lab|living-village-lab/village" apps/web/src tools --glob '!**/.svelte-kit/**'
  ```

  Expected: tests and validators PASS. The final `rg` returns no obsolete runtime route references; historical docs may still mention them.

- [x] **Step 8: Commit and push prototype retirement**

  Stage only the files in this task, inspect `git diff --cached --stat`, then:

  ```bash
  git commit -m "refactor(village): retire parallel village prototypes"
  git push
  ```

---

### Task 6: Run the canonical-path acceptance checkpoint

**Files:**
- Modify only if validation reveals an in-scope defect: files from Tasks 1–5
- Modify: `docs/superpowers/specs/2026-09-10-single-village-progression-design.md`
- Modify: this plan’s checkbox states as work completes

- [x] **Step 1: Run focused unit and source-boundary checks**

  ```bash
  pnpm --filter @summonlab/web exec vitest run src/lib/city.spec.ts src/params/city.spec.ts src/lib/server/singleton-village.spec.ts src/lib/server/singleton-village-page.spec.ts src/lib/player-audio.spec.ts src/lib/hero-presentation-boundary.spec.ts src/lib/server/wiki.spec.ts
  pnpm --filter @summonlab/web typecheck
  pnpm --filter @summonlab/web lint
  ```

  Expected: PASS with no ignored failures.

- [ ] **Step 2: Run database-backed canonical E2E checks**

  > Blocked in this workspace: Docker is unavailable and no PostgreSQL listener is present.
  > `playwright test --list` discovers all 72 browser tests, including the canonical campaign and
  > Village shell tests, but it does not substitute for executing them.

  With `pnpm dev` running and listening on `0.0.0.0`, run:

  ```bash
  pnpm --filter @summonlab/web test:e2e -- campaign.e2e.ts village-shell.e2e.ts equipment-forging.e2e.ts events.e2e.ts proof.e2e.ts
  ```

  Expected: PASS. The test browser never exposes `/play/<id>` or `/onboarding/<id>`.

- [ ] **Step 3: Run repository gates proportional to the route deletion**

  > The asset, wiki, build, Village build-budget, lint, typecheck, and in-scope formatting gates
  > pass. Repository-wide `format:check` remains open because three pre-existing realtime-combat
  > files are not formatted; they are outside this plan's change set. A full `pnpm test` audit also
  > reaches 15 pre-existing family-affinity production failures caused by an installed skill profile
  > drifting from its sealed approval receipt; all 263 web tests pass.

  ```bash
  pnpm validate:repository-assets
  pnpm validate:wiki
  pnpm format:check
  pnpm --filter @summonlab/web build
  pnpm validate:web-build-budget
  git diff --check
  ```

  Expected: PASS; the canonical Village remains within the 700 KB loaded JavaScript gzip budget.

- [ ] **Step 4: Perform desktop and phone playtest checks**

  Share `http://10.110.24.122:<port>/` and verify:

  1. Click **Enter Village** twice or reload; both resume the same Village and the address remains `/village`.
  2. On an arrived campaign, click all five dock destinations and the Portal; URLs are the five named paths, state and residents persist, and there is one header.
  3. At 390×844, the dock is fixed to the bottom, all five targets are at least 44×44 CSS pixels, no horizontal overflow appears, and no run ID is visible.

  The decision requested from this checkpoint is whether route convergence feels invisible and stable enough to begin the in-Village story/summoning replacement. Do not ask for final Tower, forging, or schedule feedback yet.

- [x] **Step 5: Record accepted foundation status**

  In the governing spec’s Delivery Decomposition, mark only subproject 1 implemented and link this plan. Keep subprojects 2–5 pending. Update this plan’s completed checkboxes with the verified commands; do not mark a failed or skipped check complete.

- [x] **Step 6: Commit, push, and report the clean branch**

  If Step 5 or verification fixes changed files:

  ```bash
  git add docs/superpowers/specs/2026-09-10-single-village-progression-design.md docs/superpowers/plans/2026-09-10-singleton-village-route-foundation.md
  git commit -m "docs(village): record singleton route foundation"
  git push
  ```

  Finish with:

  ```bash
  git status --short --branch
  git log -1 --oneline
  ```

  Expected: the branch tracks its remote and the working tree is clean.
