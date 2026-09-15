# Direct Village and Summoning Retirement

**Status:** Completed for the opening and summoning interfaces

**Governing specification:**
`docs/superpowers/specs/2026-09-10-single-village-progression-design.md`

## Rule

The canonical player flow is Front page → Village → Summoning House. A source interface is deleted
only after every behavior, asset, contract, and test it owns is classified below. Historical artwork
stays outside runtime route ownership and is not implicitly approved for production use.

## Source disposition

| Source | Disposition | Canonical replacement | Focused proof |
| --- | --- | --- | --- |
| `apps/web/src/lib/components/campaign/SingletonOnboarding.svelte` | Behavior migrated; renderer deleted | `/village` through `SingletonCampaign.svelte` and `SummoningHouse.svelte` | `pnpm --filter @summonlab/web test:e2e -- src/routes/campaign.e2e.ts` |
| `apps/web/src/routes/living-village-lab/opening/` (**The First Three**) | Mockups preserved as evidence; route, fixtures, helper, and E2E deleted | `/village` opening objective and in-place first-company progression | `pnpm --filter @summonlab/web exec vitest run src/lib/city.spec.ts` |
| `apps/web/src/routes/living-village-lab/summon/` (**The Summoning Portal**) | Reveal/dossier/Pixi behavior migrated; economy and route deleted | `apps/web/src/lib/components/summoning/` opened from the Village circle | `pnpm --filter @summonlab/web test:e2e -- src/routes/campaign.e2e.ts` |
| `apps/web/src/routes/summon/[runId]/` | Useful mechanics retained behind APIs; player page and walkthrough deleted | Summoning House plus Residents-facing mechanics later | `pnpm --filter @summonlab/web test:e2e -- src/routes/proof.e2e.ts` |
| `apps/web/src/routes/onboarding/[runId]/+page.server.ts` | Redirect deleted; persistence retained | Singleton `/village` loader | `pnpm --filter @summonlab/web exec vitest run src/lib/server/singleton-village-page.spec.ts` |
| `apps/web/src/routes/living-village-lab/+page.svelte` | Opening and summon cards deleted; Tower/combat study cards retained | Canonical `/village`; Tower/combat remain explicitly out of scope below | `pnpm --filter @summonlab/web test:e2e -- src/routes/living-village-lab/index.e2e.ts` |

## Preserved evidence

These files are retained exactly where they are. They are evidence, not runtime imports:

- `docs/design-proposals/living-village-ui/mockups/opening-master-connection-desktop.png`
- `docs/design-proposals/living-village-ui/mockups/opening-three-arrivals-desktop.png`
- `docs/design-proposals/living-village-ui/mockups/opening-weapon-assignment-desktop.png`
- `docs/design-proposals/living-village-ui/mockups/opening-first-tower-objective-desktop.png`
- `docs/evidence/living-village-lab-cutouts-v1/`
- `docs/evidence/living-village-summon-desktop.png`
- `docs/evidence/living-village-summon-animation-gate.png`
- `docs/evidence/living-village-summon-animation-constellation.png`
- `docs/evidence/living-village-summon-animation-identity.png`
- `docs/evidence/living-village-summon-single-result.png`
- `docs/evidence/living-village-summon-dossier.png`
- `docs/evidence/living-village-summon-batch-result.png`
- `docs/evidence/living-village-summon-connected-spend.png`
- `docs/evidence/living-village-summon-mobile.png`
- `docs/evidence/living-village-summon-mobile-lock.png`

The empty stone-chamber mockup is the leading candidate for a future Summoning House interior image.
It remains evidence until a separate explicit visual approval promotes it.

## Retained non-UI mechanics

Deleting `/summon/[runId]` does not delete these APIs or their engine/database contracts:

- `POST /api/runs/[runId]/communications`
- `POST /api/runs/[runId]/conversations`
- `POST /api/runs/[runId]/directives`
- `GET /api/runs/[runId]/decision-preview`
- `/api/runs/[runId]/decision-jobs/*`
- `/debug/decisions/[jobId]`
- authoritative replay, social cognition, and witness records

The canonical Summoning House uses the conversation command for each first reply. The remaining
mechanics stay available to debug/replay tooling and may later surface through Residents without
restoring a summon page.

## Out of scope for this retirement slice

- `apps/web/src/routes/living-village-lab/tower/` (**The Tower Threshold**)
- `apps/web/src/routes/living-village-lab/combat/` (**The Ruined Observatory**)
- `apps/web/src/routes/living-village-lab/realtime-combat/` (**The Ruined Threshold**)
- `apps/web/src/routes/mission-lab/`

Their dispositions are approved by the governing specification but require the canonical Tower and
combat slice before deletion.

## Acceptance evidence

The final canonical flow was captured from one persisted campaign at desktop and phone sizes in
`docs/evidence/direct-village-summoning-house/`. The acceptance run verifies five City destination
links at both sizes, no horizontal phone overflow, in-place House entry, three individual persisted
summons, reload resumption, first replies, and return to the Village.
