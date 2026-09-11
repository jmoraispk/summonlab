# Direct Village and Summoning Retirement

**Status:** Active migration inventory

**Governing specification:**
`docs/superpowers/specs/2026-09-10-single-village-progression-design.md`

## Rule

The canonical player flow is Front page → Village → Summoning House. A source interface is deleted
only after every behavior, asset, contract, and test it owns is classified below. Historical artwork
stays outside runtime route ownership and is not implicitly approved for production use.

## Source disposition

| Source | Preserve or migrate | Delete after replacement | Current status |
| --- | --- | --- | --- |
| `apps/web/src/lib/components/campaign/SingletonOnboarding.svelte` | Story copy, individual first questions, observable dossier fields, persisted resumption | Full-page renderer and its isolated CSS | Classified |
| `apps/web/src/routes/living-village-lab/opening/` (**The First Three**) | Four desktop mockups as historical evidence; in-Village story context | Route, `WeaponGlyph`, fixture heroes, and route E2E | Classified |
| `apps/web/src/routes/living-village-lab/summon/` (**The Summoning Portal**) | Single-arrival reveal cadence, reduced-motion completion, dossier interaction, and Pixi gate effect | Wallets, rates, batch pull, pity, fixtures, route, and route E2E | Classified |
| `apps/web/src/routes/summon/[runId]/` | First reveal and first question move to the Summoning House; communication, directive, policy-preview, and decision-job APIs remain covered without a player page | Page loader, page component, and fixed legacy walkthrough | Classified |
| `apps/web/src/routes/onboarding/[runId]/+page.server.ts` | Campaign persistence remains internal to the singleton Village | ID-bearing redirect route | Classified |
| `apps/web/src/routes/living-village-lab/+page.svelte` | Tower and combat study cards remain until their own canonical migrations | Opening and summon cards plus their imports | Classified |

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
