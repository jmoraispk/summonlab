# Direct Village and Summoning House Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Enter Village mount the canonical visual Village immediately, summon the first three heroes one at a time through a Summoning House opened from the Summoning Circle, and delete the duplicate onboarding, opening, and summon interfaces without deleting their retained evidence images.

**Architecture:** Keep the generated three-hero company as the campaign's deterministic candidate set, but persist `summonedHeroCount` as the monotonic activation boundary. The City projection filters candidates that have not been summoned, and the Village owns a typed introduction projection plus the only Summoning House UI. Existing engine conversation commands remain authoritative for first replies; the new campaign summon command controls which candidate may become an active resident next.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript 6, Zod 4, PostgreSQL, Vitest 4, Playwright 1.60, PixiJS 8.20, pnpm 10.33, Node 24

**Spec:** `docs/superpowers/specs/2026-09-10-single-village-progression-design.md`

## Global Constraints

- `/village` always mounts `CityScreen` with `CityVillageViewport`, including at campaign step zero.
- The five-option City dock remains the only global navigation chrome; the Summoning House is a Village interaction, not another route.
- The Summoning Circle opens the Summoning House. The blue Portal and Tower dock remain Tower-only.
- A summon commits exactly the next candidate in ordinal order and cannot skip or duplicate an arrival.
- Only summoned heroes appear as residents, occupants, facility counts, or legal City-action targets.
- Character presentation uses approved summon portraits, roster portraits, and Village cutouts only. No CSS, SVG, canvas, emoji, typography, or opaque portrait may stand in for missing character art.
- Preserve all four `docs/design-proposals/living-village-ui/mockups/opening-*-desktop.png` images and `docs/evidence/living-village-lab-cutouts-v1/`; deleting a route must not delete historical evidence.
- Keep internal run IDs in APIs and persistence, but expose no ID-bearing player page for onboarding or summoning.
- Use test-first red/green cycles and commit each independently reviewable task.
- Bind all user-facing preview servers to `0.0.0.0` and publish them through `http://10.110.24.122:<port>`.

---

## File and responsibility map

### Persistent campaign boundary

- `packages/contracts/src/campaign.ts` — add `summonedHeroCount` and the strict summon request schema.
- `packages/contracts/src/campaign.spec.ts` — new focused coverage for schema bounds and unknown request fields.
- `packages/database/migrations/0018_campaign_summoning_progress.sql` — add and backfill the monotonic count.
- `packages/database/src/campaign.ts` — lock the campaign row and commit one ordinal idempotently.
- `packages/database/src/campaign.integration.spec.ts` — prove persistence, order, retry safety, and restart behavior.
- `apps/web/src/routes/api/campaigns/[runId]/summons/+server.ts` — expose the campaign-owned summon command.

### Canonical City projection

- `apps/web/src/lib/city.ts` — define `CityIntroduction`, `CitySummonHero`, and `CitySummonIntent`.
- `apps/web/src/lib/server/city.ts` — restrict the settlement projection to summoned hero IDs and project introduction state.
- `apps/web/src/lib/server/city.spec.ts` — verify zero/one/three-resident views and correct occupancy.
- `apps/web/src/lib/server/campaign.ts` and `campaign.spec.ts` — identify whether a campaign candidate is already summoned.
- `apps/web/src/routes/api/runs/[runId]/city-actions/+server.ts` — reject actions aimed at unsummoned campaign candidates.
- `apps/web/src/routes/api/runs/[runId]/conversations/+server.ts` — reject first questions aimed at unsummoned campaign candidates.
- `packages/engine/src/objectives.ts` and `packages/engine/src/objectives.spec.ts` — use the committed summon count, replace the obsolete first-destination tutorial objective with starter arms, and keep objective order deterministic.
- `apps/web/src/lib/server/singleton-village-page.ts` — load one City page model for every campaign stage.
- `apps/web/src/lib/server/singleton-village-page.spec.ts` — remove the onboarding/journey stage selector contract.
- `apps/web/src/routes/(city)/[mode=city]/+page.server.ts` — keep incomplete introductions in Village mode while using the same loader.
- `apps/web/src/routes/(city)/[mode=city]/+page.svelte` — mount `SingletonCampaign` unconditionally.

### Canonical Summoning House

- `apps/web/src/lib/components/summoning/SummoningHouse.svelte` — own the modal interior, next-summon action, first reply, progress, close, and reduced-motion behavior.
- `apps/web/src/lib/components/summoning/SummonReveal.svelte` — retain the single-arrival reveal cadence without wallets, rates, batches, pity, or lab navigation.
- `apps/web/src/lib/components/summoning/SummonedHeroDossier.svelte` — show only observable canonical identity and mind fields.
- `apps/web/src/lib/components/summoning/PortalCanvas.svelte` — move the existing Pixi gate effect under canonical ownership.
- `apps/web/src/lib/components/summoning/PortalGlyph.svelte` and `MechanicIcon.svelte` — move retained visual helpers under canonical ownership.
- `apps/web/src/lib/components/city/CityVillageViewport.svelte` — make the circle open the House and keep the Tower Portal link unchanged.
- `apps/web/src/lib/components/city/CityScreen.svelte` — pass introduction actions into the Village viewport.
- `apps/web/src/lib/components/campaign/SingletonCampaign.svelte` — become a City-only controller for summon, conversation, refresh, live events, and the existing player menu.

### Retirement and acceptance

- `docs/decisions/2026-09-11-direct-village-summoning-retirement.md` — record behavior, assets, contracts, and deletions for each retired path.
- `apps/web/src/routes/campaign.e2e.ts` — test direct entry, three committed arrivals, first replies, reload, desktop, and phone.
- `apps/web/src/routes/village-shell.e2e.ts` — prepare campaigns through the new summon command.
- `apps/web/src/routes/proof.e2e.ts` — replace the retired page walkthrough with API-level coverage for communication, directives, decision preview, and missing-art behavior.
- `apps/web/src/routes/debug/decisions/[jobId]/+page.svelte` — return to the canonical Village instead of the deleted summon page.
- `apps/web/src/lib/city.spec.ts` — prevent deleted components and routes from returning.
- Delete `apps/web/src/lib/components/campaign/SingletonOnboarding.svelte`.
- Delete `apps/web/src/routes/onboarding/[runId]/+page.server.ts`.
- Delete `apps/web/src/routes/summon/[runId]/+page.server.ts` and `+page.svelte`.
- Delete `apps/web/src/routes/living-village-lab/opening/` and `apps/web/src/routes/living-village-lab/summon/`.
- Delete route-only `RatesPanel.svelte`, `ResultPresentation.svelte`, and the old `RevealStage.svelte` after canonical replacements are tested.
- Modify `apps/web/src/routes/living-village-lab/+page.svelte` to remove only the retired opening and summon cards; Tower and combat studies remain until their own migration slices.

---

### Task 1: Record the retirement manifest

**Files:**

- Create: `docs/decisions/2026-09-11-direct-village-summoning-retirement.md`

**Interfaces:**

- Consumes: the route and asset disposition rules in the governing specification.
- Produces: a checked inventory used by Task 7 to distinguish preserved evidence from deleted runtime ownership.

- [ ] **Step 1: Write the manifest with explicit classifications**

```markdown
# Direct Village and Summoning Retirement

| Source | Preserve or migrate | Delete after replacement |
| --- | --- | --- |
| `SingletonOnboarding.svelte` | Story copy, individual first questions, observable dossier fields | Full-page renderer and its CSS |
| `/living-village-lab/opening` | Four mockups under `docs/design-proposals/living-village-ui/mockups/` as evidence | Route, WeaponGlyph, fixture heroes, Playwright test |
| `/living-village-lab/summon` | Single-arrival reveal cadence, reduced motion, dossier interaction, Pixi gate effect | Wallets, rates, batch pull, pity, fixtures, lab route and Playwright test |
| `/summon/[runId]` | First reveal and first question move to the House; communication, directive, policy-preview, and decision-job APIs remain covered without a player page | Page loader, page component, and fixed legacy walkthrough |
| `/onboarding/[runId]` | No page UI; campaign persistence remains internal | Redirect route |

The preserved mockups and cutouts are evidence only. Production code must not import them.
```

- [ ] **Step 2: Verify every deletion target exists and every evidence target is outside route ownership**

Run:

```bash
test -f apps/web/src/lib/components/campaign/SingletonOnboarding.svelte
test -f apps/web/src/routes/living-village-lab/opening/+page.svelte
test -f apps/web/src/routes/living-village-lab/summon/+page.svelte
test -f docs/design-proposals/living-village-ui/mockups/opening-master-connection-desktop.png
test -f docs/design-proposals/living-village-ui/mockups/opening-three-arrivals-desktop.png
test -f docs/design-proposals/living-village-ui/mockups/opening-weapon-assignment-desktop.png
test -f docs/design-proposals/living-village-ui/mockups/opening-first-tower-objective-desktop.png
```

Expected: every command exits zero.

- [ ] **Step 3: Commit the auditable retirement boundary**

```bash
git add docs/decisions/2026-09-11-direct-village-summoning-retirement.md
git commit -m "docs(village): inventory summoning route retirement"
git push origin HEAD
```

### Task 2: Persist monotonic individual summons

**Files:**

- Modify: `packages/contracts/src/campaign.ts`
- Create: `packages/contracts/src/campaign.spec.ts`
- Create: `packages/database/migrations/0018_campaign_summoning_progress.sql`
- Modify: `packages/database/src/campaign.ts`
- Modify: `packages/database/src/campaign.integration.spec.ts`

**Interfaces:**

- Consumes: the existing deterministic three-entry `CampaignRun.heroes` tuple.
- Produces: `CampaignRun.summonedHeroCount: 0 | 1 | 2 | 3`, `CampaignSummonRequest`, and `summonNextCampaignHero(databaseUrl, runId, request): Promise<CampaignRun>`.

- [ ] **Step 1: Write failing contract tests**

Add assertions equivalent to:

```ts
expect(
	CampaignRunSchema.parse({ ...validCampaign, summonedHeroCount: 2 }).summonedHeroCount
).toBe(2);
expect(() => CampaignRunSchema.parse({ ...validCampaign, summonedHeroCount: 4 })).toThrow();
expect(
	CampaignSummonRequestSchema.parse({ ordinal: 1, expectedSummonedHeroCount: 0 })
).toEqual({ ordinal: 1, expectedSummonedHeroCount: 0 });
expect(() =>
	CampaignSummonRequestSchema.parse({ ordinal: 2, expectedSummonedHeroCount: 0, heroId: 'leak' })
).toThrow();
```

- [ ] **Step 2: Run the contract test and verify red**

Run:

```bash
pnpm --filter @summonlab/contracts test -- src/campaign.spec.ts
```

Expected: FAIL because `summonedHeroCount` and `CampaignSummonRequestSchema` do not exist.

- [ ] **Step 3: Add the strict contract**

Add:

```ts
export const CampaignSummonedHeroCountSchema = z.union([
	z.literal(0),
	z.literal(1),
	z.literal(2),
	z.literal(3)
]);

export const CampaignSummonRequestSchema = z
	.object({
		ordinal: z.number().int().min(1).max(3),
		expectedSummonedHeroCount: CampaignSummonedHeroCountSchema
	})
	.strict();
```

Add `summonedHeroCount: CampaignSummonedHeroCountSchema` to `CampaignRunSchema` and export inferred types for both new schemas.

- [ ] **Step 4: Add the database migration with compatibility backfill**

```sql
alter table summonlab_campaign_runs
  add column if not exists summoned_hero_count smallint;

update summonlab_campaign_runs
set summoned_hero_count = case when onboarding_step >= 2 then 3 else 0 end
where summoned_hero_count is null;

alter table summonlab_campaign_runs
  alter column summoned_hero_count set default 0,
  alter column summoned_hero_count set not null;

alter table summonlab_campaign_runs
  drop constraint if exists summonlab_campaign_runs_summoned_hero_count_check;

alter table summonlab_campaign_runs
  add constraint summonlab_campaign_runs_summoned_hero_count_check
  check (summoned_hero_count between 0 and 3);
```

- [ ] **Step 5: Write failing database integration assertions**

Extend the campaign persistence test to prove:

```ts
expect((await getCampaignRun(databaseUrl, firstRunId))?.summonedHeroCount).toBe(0);
await expect(
	summonNextCampaignHero(databaseUrl, firstRunId, {
		ordinal: 2,
		expectedSummonedHeroCount: 0
	})
).rejects.toThrow('The next summon must be ordinal 1');

const firstSummon = await summonNextCampaignHero(databaseUrl, firstRunId, {
	ordinal: 1,
	expectedSummonedHeroCount: 0
});
expect(firstSummon).toMatchObject({ summonedHeroCount: 1, onboardingStep: 1 });
expect(
	(
		await summonNextCampaignHero(databaseUrl, firstRunId, {
			ordinal: 1,
			expectedSummonedHeroCount: 0
		})
	).summonedHeroCount
).toBe(1);
```

Then summon ordinals two and three and assert the last result is `{ summonedHeroCount: 3, onboardingStep: 2 }`.

- [ ] **Step 6: Run the database integration test and verify red**

Run:

```bash
TEST_DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @summonlab/database test:integration -- src/campaign.integration.spec.ts
```

Expected: FAIL because the row mapping and command do not include summon progress.

- [ ] **Step 7: Implement the locked, idempotent database command**

Add `summoned_hero_count` to `CampaignRunRow` and map it to `summonedHeroCount`. Implement:

```ts
export async function summonNextCampaignHero(
	databaseUrl: string,
	runId: string,
	request: CampaignSummonRequest
): Promise<CampaignRun>;
```

Inside one `sql.begin` transaction, select the active campaign `for update`. If `request.ordinal <= summoned_hero_count`, return without updating so a network retry is idempotent. Otherwise require both `request.expectedSummonedHeroCount === summoned_hero_count` and `request.ordinal === summoned_hero_count + 1`; reject with `The next summon must be ordinal N` when order is wrong. Update the count and set `onboarding_step` to `1` after the first summon and `2` after the third.

Also include `summoned_hero_count` in `advanceCampaignOnboarding`'s locked row. Reject a request for step 2 unless the count is 3, so the old endpoint cannot bypass individual summoning. Step 3 continues to require a recorded first reply from all three heroes.

- [ ] **Step 8: Run migration and persistence tests**

Run:

```bash
pnpm --filter @summonlab/database migrate
TEST_DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @summonlab/database test:integration -- src/migration.integration.spec.ts src/campaign.integration.spec.ts
pnpm --filter @summonlab/contracts test -- src/campaign.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Commit the persistent summon boundary**

```bash
git add packages/contracts/src/campaign.ts packages/contracts/src/campaign.spec.ts packages/database/migrations/0018_campaign_summoning_progress.sql packages/database/src/campaign.ts packages/database/src/campaign.integration.spec.ts
git commit -m "feat(campaign): persist individual hero summons"
git push origin HEAD
```

### Task 3: Expose the canonical summon command and project introduction state

**Files:**

- Create: `apps/web/src/routes/api/campaigns/[runId]/summons/+server.ts`
- Modify: `apps/web/src/lib/city.ts`
- Modify: `apps/web/src/lib/server/campaign.ts`
- Modify: `apps/web/src/lib/server/campaign.spec.ts`
- Modify: `apps/web/src/lib/server/city.ts`
- Modify: `apps/web/src/lib/server/city.spec.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/city-actions/+server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/conversations/+server.ts`
- Modify: `packages/engine/src/objectives.ts`
- Modify: `packages/engine/src/objectives.spec.ts`

**Interfaces:**

- Consumes: `summonNextCampaignHero`, `CampaignRun.summonedHeroCount`, approved runtime portraits, and existing campaign first replies.
- Produces: `CityIntroduction`, `CitySummonHero`, `CitySummonIntent`, and a POST endpoint returning `{ campaign }`.

- [ ] **Step 1: Define the City-side types in a failing projection test**

Use this interface shape:

```ts
export interface CitySummonHero {
	readonly heroId: string;
	readonly ordinal: 1 | 2 | 3;
	readonly name: string;
	readonly rarityStars: number;
	readonly adultAge: number;
	readonly heightCm: number;
	readonly bodyBuild: string;
	readonly voice: string;
	readonly role: string;
	readonly primaryValue: string;
	readonly primaryDrive: string;
	readonly socialStyle: string;
	readonly stressResponse: string;
	readonly dailyHabit: string;
	readonly summonArt: CityResidentArt;
	readonly rosterArt: CityResidentArt | null;
	readonly firstReply: { readonly exactText: string; readonly publicReason: string } | null;
}

export interface CityIntroduction {
	readonly stage: 'village-entry' | 'summoning' | 'first-voices' | 'complete';
	readonly summonedHeroCount: 0 | 1 | 2 | 3;
	readonly nextHero: CitySummonHero | null;
	readonly summonedHeroes: readonly CitySummonHero[];
	readonly answeredHeroCount: number;
}

export interface CitySummonIntent {
	readonly ordinal: 1 | 2 | 3;
	readonly expectedSummonedHeroCount: 0 | 1 | 2;
}
```

Add `readonly introduction: CityIntroduction` to `CityViewModel`.

Add projection cases asserting zero summoned heroes yields no `residents`, `sceneResidents`, or Gate occupants; one summon yields only ordinal one; and three summons restore all three.

- [ ] **Step 2: Run the City projection test and verify red**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/server/city.spec.ts
```

Expected: FAIL because the introduction projection and visibility boundary do not exist.

- [ ] **Step 3: Implement visibility-restricted settlement projection**

Extend `ProjectCityViewInput` with `campaign`, `summonHeroes`, and `visibleHeroIds`. Before calling the existing facility, resident, and occupancy projectors, build a presentation copy whose `occupants`, `social`, and every building's `occupantHeroIds` contain only visible IDs. Set each filtered building's `assignmentCount` to `Math.min(building.assignmentCount, occupantHeroIds.length)` during the introduction. Pass the restricted presentation to all three projectors.

Derive introduction stage exactly as follows:

```ts
const stage =
	campaign.onboardingStep >= 3
		? 'complete'
		: campaign.summonedHeroCount === 0
			? 'village-entry'
			: campaign.summonedHeroCount < 3
				? 'summoning'
				: 'first-voices';
```

`nextHero` is the candidate whose ordinal is `summonedHeroCount + 1`; `summonedHeroes` contains only ordinals at or below the count.

- [ ] **Step 4: Add the POST endpoint**

Parse `CampaignSummonRequestSchema`, call `summonNextCampaignHero`, return `{ campaign }` with `cache-control: no-store`, use status 400 for malformed bodies, 404 for an absent campaign, and 409 for stale or out-of-order requests. Do not accept a hero ID from the browser.

- [ ] **Step 5: Reject commands for latent campaign candidates**

Add and test:

```ts
export function campaignHeroIsSummoned(campaign: CampaignRun, heroId: string): boolean {
	return campaign.heroes
		.slice(0, campaign.summonedHeroCount)
		.some((hero) => hero.draft.manifest.characterId === heroId);
}
```

In the City-action and conversation POST endpoints, load the campaign by `runId`. When a campaign exists and the requested hero fails this predicate, return status 409 with `The requested hero has not been summoned.` A standalone proof run has no campaign row and continues through the existing engine validation.

- [ ] **Step 6: Update objective projection tests first**

Change the summon objective to complete only when `campaign.summonedHeroCount === 3`. Replace `follow-the-first-choice` with:

```ts
{
	objectiveId: 'forge-the-starter-arms',
	chapter: 'Prologue · A company needs tools',
	title: 'Make the starter gear',
	detail: 'Use the Forge to make a spear, a bow, and a sword with shield for the first company.',
	evidence: []
}
```

Its completion remains `false` in this slice, making it the next current objective after all first voices are heard. Assert the active objective transition in `objectives.spec.ts`.

- [ ] **Step 7: Run unit tests**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/server/campaign.spec.ts src/lib/server/city.spec.ts
pnpm --filter @summonlab/engine test -- src/objectives.spec.ts
pnpm --filter @summonlab/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit the canonical projection and endpoint**

```bash
git add apps/web/src/routes/api/campaigns/[runId]/summons/+server.ts apps/web/src/lib/city.ts apps/web/src/lib/server/campaign.ts apps/web/src/lib/server/campaign.spec.ts apps/web/src/lib/server/city.ts apps/web/src/lib/server/city.spec.ts apps/web/src/routes/api/runs/[runId]/city-actions/+server.ts apps/web/src/routes/api/runs/[runId]/conversations/+server.ts packages/engine/src/objectives.ts packages/engine/src/objectives.spec.ts
git commit -m "feat(village): project canonical summon progression"
git push origin HEAD
```

### Task 4: Make every campaign stage load the same City

**Files:**

- Modify: `apps/web/src/lib/server/singleton-village-page.ts`
- Modify: `apps/web/src/lib/server/singleton-village-page.spec.ts`
- Modify: `apps/web/src/routes/(city)/[mode=city]/+page.server.ts`
- Modify: `apps/web/src/routes/(city)/[mode=city]/+page.svelte`

**Interfaces:**

- Consumes: the extended `projectCityView` input and `CampaignRun.summonedHeroCount`.
- Produces: `loadSingletonVillagePage(...): Promise<CampaignPageData>` with a non-null City for engine-v13 campaigns at every introduction stage.

- [ ] **Step 1: Replace the stage-selector unit test with direct-City assertions**

Delete `selectSingletonVillageStage` expectations. Add a source-boundary assertion that the canonical page contains `SingletonCampaign`, does not contain `SingletonOnboarding`, and does not branch on `data.stage`.

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/server/singleton-village-page.spec.ts src/lib/city.spec.ts
```

Expected: FAIL because the loader and route still expose onboarding stages.

- [ ] **Step 3: Collapse the singleton loader to one page model**

Remove `SingletonVillageStage`, `selectSingletonVillageStage`, `loadOnboardingPage`, `OnboardingPageData`, and the tagged `SingletonVillagePageData` union. In `loadCampaignPage`:

- remove the `!snapshot.destination && !equipmentHistory` error;
- load `campaignExperienceView` before constructing residents;
- take visible candidates with `campaignView.heroes.slice(0, campaign.summonedHeroCount)`;
- require summon art for every candidate offered by `CityIntroduction`, but include only summoned candidates in `CityResidentSource[]`;
- project the City even when `snapshot.arrived` is false;
- keep simulation catch-up disabled until the proof run has arrived;
- return the `CampaignPageData` object directly.

The route server redirects non-Village modes to `/village` only while `page.city.introduction.stage !== 'complete'`. The route page renders:

```svelte
<script lang="ts">
	import SingletonCampaign from '$lib/components/campaign/SingletonCampaign.svelte';
	let { data } = $props();
</script>

<SingletonCampaign {data} />
```

- [ ] **Step 4: Run loader, route, and type checks**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/server/singleton-village-page.spec.ts src/lib/server/city.spec.ts src/lib/city.spec.ts
pnpm --filter @summonlab/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit direct City loading**

```bash
git add apps/web/src/lib/server/singleton-village-page.ts apps/web/src/lib/server/singleton-village-page.spec.ts apps/web/src/routes/'(city)'/'[mode=city]'/+page.server.ts apps/web/src/routes/'(city)'/'[mode=city]'/+page.svelte
git commit -m "refactor(village): enter the City at every stage"
git push origin HEAD
```

### Task 5: Build the canonical Summoning House interaction

**Files:**

- Create: `apps/web/src/lib/components/summoning/SummoningHouse.svelte`
- Create: `apps/web/src/lib/components/summoning/SummonReveal.svelte`
- Create: `apps/web/src/lib/components/summoning/SummonedHeroDossier.svelte`
- Move: `apps/web/src/lib/components/living-village/summon/PortalCanvas.svelte` to `apps/web/src/lib/components/summoning/PortalCanvas.svelte`
- Move: `apps/web/src/lib/components/living-village/summon/PortalGlyph.svelte` to `apps/web/src/lib/components/summoning/PortalGlyph.svelte`
- Move: `apps/web/src/lib/components/living-village/summon/MechanicIcon.svelte` to `apps/web/src/lib/components/summoning/MechanicIcon.svelte`
- Modify: `apps/web/src/lib/components/city/CityVillageViewport.svelte`
- Modify: `apps/web/src/lib/components/city/CityScreen.svelte`
- Modify: `apps/web/src/lib/components/campaign/SingletonCampaign.svelte`
- Test: `apps/web/src/routes/campaign.e2e.ts`

**Interfaces:**

- Consumes: `CityIntroduction`, `CitySummonIntent`, existing `/api/runs/[runId]/conversations`, and `/api/campaigns/[runId]/onboarding` step 3.
- Produces: `onSummon(intent)`, `onAskFirstQuestion(heroId, exactText)`, and `onCompleteIntroduction()` callbacks owned by `SingletonCampaign`.

- [ ] **Step 1: Rewrite the campaign E2E expectation first**

For a fresh campaign, assert:

```ts
await page.goto(resumePath);
await expect(page).toHaveURL('/village');
await expect(page.getByTestId('city-screen')).toBeVisible();
await expect(page.getByTestId('campaign-onboarding')).toHaveCount(0);
await expect(page.getByTestId('city-scene-resident')).toHaveCount(0);
await page.getByRole('button', { name: 'Enter Summoning House' }).click();
await expect(page.getByRole('dialog', { name: 'Summoning House' })).toBeVisible();
```

Before the first summon, POST a City action and a conversation for candidate ordinal two and assert both return 409 with `The requested hero has not been summoned.`

For each ordinal from one through three, click `Summon next hero`, wait for `summon-reveal` to report `data-phase="complete"`, close the House, assert the Village resident count equals the ordinal, reload, and assert the same count. Reopen the House before the next summon.

- [ ] **Step 2: Run the E2E test and verify red**

Run:

```bash
DATABASE_URL="$DATABASE_URL" pnpm --filter @summonlab/web test:e2e -- src/routes/campaign.e2e.ts
```

Expected: FAIL because the fresh campaign still mounts the full-page onboarding renderer and the circle does not open a House.

- [ ] **Step 3: Move the retained visual helpers**

Use `git mv` for `PortalCanvas.svelte`, `PortalGlyph.svelte`, and `MechanicIcon.svelte`. Update their relative imports to the new canonical directory. Keep Pixi's `Application` initialization and reduced-motion branches unchanged so this task does not create a second effect implementation.

- [ ] **Step 4: Implement a single-arrival reveal**

`SummonReveal.svelte` accepts:

```ts
{
	hero: CitySummonHero;
	runToken: number;
	reducedMotion: boolean;
	onComplete: () => void;
}
```

Retain the `charge → threshold → silhouette → identity → complete` gate sequence and Skip action from the study. Remove direction switching, result grids, replay, batch mode, wallet/rate copy, and fixture types. Render `hero.summonArt.publicPath` with its real width and height. The outer element has `data-testid="summon-reveal"` and `data-phase={phase}`.

- [ ] **Step 5: Implement the canonical dossier**

`SummonedHeroDossier.svelte` accepts one `CitySummonHero` and renders age, height, build, voice, role, primary value, drive, social style, stress response, daily habit, and the recorded first reply. It uses the approved summon portrait and labels the section `Observable mind · no hidden reasoning`. It traps focus with the existing `focusDialog`/`handleModalKeydown` helpers and returns focus to the button that opened it.

- [ ] **Step 6: Implement the Summoning House state machine**

The House is an `aria-modal="true"` dialog over the Village with these exact states:

1. `village-entry` or `summoning` with `nextHero`: show `Summon next hero`; POST only after the player clicks.
2. reveal running: disable close and duplicate submission; allow Skip and reduced-motion completion.
3. reveal complete: announce the committed hero and enable `Return to Village` plus `View details`.
4. `first-voices`: show the three summoned roster buttons and one question field; each unanswered hero uses the existing conversation command.
5. every hero answered: show `Finish introductions`; advance onboarding to step 3 and close the House after refresh.
6. `complete`: show the summoned roster for review without re-offering tutorial summons.

The House exposes errors through one `role="alert"` and never increments local progress before the server response succeeds.

- [ ] **Step 7: Wire the circle and preserve the Portal**

Add an optional `onOpenSummoningHouse` callback to `CityVillageViewport`. For `facilityId === 'summoning-circle'`, render a button labeled `Enter Summoning House` that selects the facility and invokes the callback. Keep `facility.hrefMode === 'tower'` as the existing `/tower` link. Mount `SummoningHouse` inside the Village surface so the City dock and map remain the underlying canonical page.

- [ ] **Step 8: Reduce `SingletonCampaign` to a City controller**

Remove the non-City walking scene, duplicate header, standalone hero HUD, social ledger, prototype First Ember bridge, journal drawer, and related CSS/state. Keep `RunConnection`, `CityScreen`, `PlayerMenu`, live event refresh, City intents, and equipment refresh.

Add controller methods:

```ts
async function summonHero(intent: CitySummonIntent): Promise<void>;
async function askFirstQuestion(heroId: string, exactText: string): Promise<void>;
async function completeIntroduction(): Promise<void>;
```

Each method POSTs to its existing or new authoritative endpoint, reads `{ message?: string }`, throws on non-2xx, and calls `invalidateAll()` only after success.

- [ ] **Step 9: Run component type checks and E2E green**

Run:

```bash
pnpm --filter @summonlab/web typecheck
DATABASE_URL="$DATABASE_URL" pnpm --filter @summonlab/web test:e2e -- src/routes/campaign.e2e.ts src/routes/village-shell.e2e.ts
```

Expected: PASS on desktop and the existing 390-by-844 phone branch, with exactly five dock destinations and no second header.

- [ ] **Step 10: Commit the playable direct-entry slice**

```bash
git add apps/web/src/lib/components/summoning apps/web/src/lib/components/city/CityVillageViewport.svelte apps/web/src/lib/components/city/CityScreen.svelte apps/web/src/lib/components/campaign/SingletonCampaign.svelte apps/web/src/routes/campaign.e2e.ts apps/web/src/routes/village-shell.e2e.ts
git commit -m "feat(village): summon the first company in place"
git push origin HEAD
```

### Task 6: Retire the superseded interfaces

**Files:**

- Modify: `apps/web/src/lib/city.spec.ts`
- Modify: `apps/web/src/routes/living-village-lab/+page.svelte`
- Modify: `apps/web/src/routes/proof.e2e.ts`
- Modify: `apps/web/src/routes/debug/decisions/[jobId]/+page.svelte`
- Delete: `apps/web/src/lib/components/campaign/SingletonOnboarding.svelte`
- Delete: `apps/web/src/routes/onboarding/[runId]/+page.server.ts`
- Delete: `apps/web/src/routes/summon/[runId]/+page.server.ts`
- Delete: `apps/web/src/routes/summon/[runId]/+page.svelte`
- Delete: `apps/web/src/routes/living-village-lab/opening/+page.svelte`
- Delete: `apps/web/src/routes/living-village-lab/opening/WeaponGlyph.svelte`
- Delete: `apps/web/src/routes/living-village-lab/opening/heroes.ts`
- Delete: `apps/web/src/routes/living-village-lab/opening/opening.e2e.ts`
- Delete: `apps/web/src/routes/living-village-lab/summon/+page.svelte`
- Delete: `apps/web/src/routes/living-village-lab/summon/fixtures.ts`
- Delete: `apps/web/src/routes/living-village-lab/summon/summon.e2e.ts`
- Delete: `apps/web/src/lib/components/living-village/summon/HeroDossier.svelte`
- Delete: `apps/web/src/lib/components/living-village/summon/RatesPanel.svelte`
- Delete: `apps/web/src/lib/components/living-village/summon/ResultPresentation.svelte`
- Delete: `apps/web/src/lib/components/living-village/summon/RevealStage.svelte`

**Interfaces:**

- Consumes: green canonical Village and Summoning House E2E coverage from Task 5.
- Produces: source-boundary enforcement that these player-facing alternatives cannot return.

- [ ] **Step 1: Expand the boundary test before deleting files**

Add every deletion path above to the `retiredPath` list in `city.spec.ts`. Also scan production Svelte and TypeScript sources and assert they contain neither `SingletonOnboarding` nor the strings `/living-village-lab/opening`, `/living-village-lab/summon`, `/onboarding/[runId]`, or `/summon/[runId]`.

Before deleting the legacy summon page, replace its fixed walkthrough in `proof.e2e.ts` with an active API test that creates a proof run and successfully calls:

```text
POST /api/runs/[runId]/communications
POST /api/runs/[runId]/conversations
POST /api/runs/[runId]/directives
GET  /api/runs/[runId]/decision-preview?heroId=[heroId]
```

Assert that the responses retain witnessed communication, a hero reply, directive influence, and the redacted decision packet. Keep the existing missing-art assertion on `/mission/[runId]`; the canonical summon pool rejects missing summon art before a candidate reaches the House. Change the decision-inspector backlink from `/summon/[runId]` to `/village`.

- [ ] **Step 2: Run the boundary test and verify red**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/city.spec.ts
```

Expected: FAIL and enumerate the still-existing retired paths.

- [ ] **Step 3: Delete only classified runtime ownership**

Use `apply_patch` to remove the listed route/component files. Remove the opening and summon objects plus their image imports from `living-village-lab/+page.svelte`; leave Tower Threshold, Ruined Observatory, and Ruined Threshold cards intact for their later retirement slices.

Do not remove any file under:

```text
docs/design-proposals/living-village-ui/mockups/
docs/evidence/living-village-lab-cutouts-v1/
docs/evidence/living-village-summon-*.png
```

- [ ] **Step 4: Verify deletion and evidence retention**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/city.spec.ts
rg -n "SingletonOnboarding|/living-village-lab/(opening|summon)|/onboarding/\[runId\]|/summon/\[runId\]" apps/web/src
test -f docs/design-proposals/living-village-ui/mockups/opening-master-connection-desktop.png
test -d docs/evidence/living-village-lab-cutouts-v1
```

Expected: the test passes, `rg` exits one with no matches, and both evidence checks exit zero.

- [ ] **Step 5: Commit the retirement**

```bash
git add -A apps/web/src docs/decisions/2026-09-11-direct-village-summoning-retirement.md
git commit -m "refactor(village): retire parallel summon interfaces"
git push origin HEAD
```

### Task 7: Full validation and visual checkpoint

**Files:**

- Modify: `docs/decisions/2026-09-11-direct-village-summoning-retirement.md`
- Create: `docs/evidence/direct-village-summoning-house/village-desktop.png`
- Create: `docs/evidence/direct-village-summoning-house/summoning-house-desktop.png`
- Create: `docs/evidence/direct-village-summoning-house/village-phone.png`
- Create: `docs/evidence/direct-village-summoning-house/summoning-house-phone.png`

**Interfaces:**

- Consumes: the complete direct-entry and canonical summon slice.
- Produces: release evidence, checked retirement status, and a collaborator preview.

- [ ] **Step 1: Run the focused and repository gates**

Run:

```bash
pnpm --filter @summonlab/contracts test -- src/campaign.spec.ts
TEST_DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @summonlab/database test:integration -- src/migration.integration.spec.ts src/campaign.integration.spec.ts
pnpm --filter @summonlab/engine test -- src/objectives.spec.ts
pnpm --filter @summonlab/web test:unit -- src/lib/city.spec.ts src/lib/server/city.spec.ts src/lib/server/singleton-village-page.spec.ts
pnpm --filter @summonlab/web test:unit -- src/lib/server/campaign.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web build
pnpm validate:wiki
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 2: Capture desktop and phone evidence from one persisted campaign**

Run the campaign E2E test with `CAPTURE_DIRECT_VILLAGE_SUMMON_DIR` set to `docs/evidence/direct-village-summoning-house`. Capture `/village` before summoning and the open House at 1440 by 1000, then repeat at 390 by 844. Assert `document.documentElement.scrollWidth <= window.innerWidth` on phone and exactly five City destination links in both sizes.

- [ ] **Step 3: Complete the retirement manifest**

Mark each row `migrated`, `preserved evidence`, or `deleted`, add the canonical replacement path, and record the focused test command that proves the disposition. Leave Tower and combat studies explicitly `out of scope for this slice`.

- [ ] **Step 4: Start and verify the collaborator preview**

Run:

```bash
DATABASE_URL="$DATABASE_URL" pnpm dev:app
ss -ltnp | rg ':5173|:4174'
curl -I http://10.110.24.122:5173/
curl -I http://10.110.24.122:5173/village
```

Expected: web listens on `0.0.0.0:5173`, worker listens on `0.0.0.0:4174`, and both HTTP checks return 200 after the singleton campaign exists.

- [ ] **Step 5: Commit evidence and final manifest state**

```bash
git add docs/decisions/2026-09-11-direct-village-summoning-retirement.md docs/evidence/direct-village-summoning-house
git commit -m "test(village): capture direct summoning acceptance"
git push origin HEAD
```

- [ ] **Step 6: Report the exact playtest**

Share `http://10.110.24.122:5173/` and ask the owner to test these decisions:

1. Does Enter Village feel immediate with the map present from the first frame?
2. Does clicking the circle make the Summoning House feel spatially connected to the Village?
3. Does each hero's reveal, dossier, first reply, and return to the map preserve the useful parts of the retired studies without feeling like another app?
