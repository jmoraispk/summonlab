# Canonical Tower and Combat Retirement

**Status:** Route consolidation implemented; combat presentation integration pending

**Decision date:** 2026-09-14

**Governing specification:** `docs/superpowers/specs/2026-09-10-single-village-progression-design.md`

## Player route boundary

The anonymous player has one application shell and five destinations:

```text
/
└── /village
    ├── /residents
    ├── /tower
    ├── /inventory
    └── /missions
```

Floor selection, exploration, encounters, combat, loot, and extraction are states inside `/tower`.
Internal APIs may use the singleton campaign run ID, but no player page asks for or exposes it.

## Migration and deletion ledger

| Source | Classification | Canonical owner | Deletion condition |
| --- | --- | --- | --- |
| `VillageTowerPanel.svelte` | migrate then delete | `components/tower/TowerScreen.svelte` | Canonical floor list is tested |
| `/living-village-lab/tower` (Tower Threshold) | delete outright | None | Canonical `/tower` entry exists |
| `/mission-lab` | migrate then delete | `@summonlab/content` plus canonical Tower projection | Floors 1–5 expose authored objectives, topology, knowledge, story, and rewards |
| Floor One branch route shell | delete outright | None | Compatible domain mechanics are selectively ported |
| Floor One branch contracts/content/engine model | migrate then delete source ownership | `@summonlab/contracts`, `@summonlab/content`, `@summonlab/engine` | Current-branch package tests pass |
| `/living-village-lab/combat` (Ruined Observatory) | migrate then delete | Tower turn-based encounter adapter | Shared encounter conformance tests pass |
| `/living-village-lab/realtime-combat` (Ruined Threshold) | migrate then delete | Tower automated encounter adapter | Shared encounter conformance tests pass |
| `/mission/[runId]` | migrate then delete | `/tower`, `/missions`, and internal typed APIs | Required command and objective coverage is canonical |
| `/living-village-lab` root and `LabBackLink.svelte` | delete outright after children | None | Last lab child is retired |
| Route-only fixtures and E2E tests | migrate then delete | Canonical package, component, API, and E2E tests | Equivalent behavior assertions pass |
| Historical screenshots, mockups, specifications, and decision records | retain as historical evidence | `docs/` and evidence catalogs | Never imported by production runtime |

## Development-only route audit

These routes are not player progression. Each must remain gated by `devRoutesEnabled`, have a named
engineering purpose, and have no link from the front page, City dock, Village facilities, tutorial,
or Tower. Obsolete entries are deleted instead of redirected.

| Route family | Current purpose | Disposition |
| --- | --- | --- |
| `/debug/decisions/[jobId]` | Inspect bounded decision jobs and observable policy output | retain as internal diagnostic |
| `/debug/evaluations` | Inspect evaluation runs and rubric output | retain as internal diagnostic |
| `/playtest-moderation`, `/playtest-release`, `/playtest-report` | Prepare and review moderated playtest evidence | retain as internal tooling |
| `/story-workshop` | Inspect authored story patch proposals | retain as internal tooling |
| `/design-reference` | Historical visual comparison gallery | audit imports and delete if evidence pages cover it |
| `/forge/enemies*`, `/foundry-trials` | Asset and strategy production review | retain only while current production workflows reference them |
| `/first-band-archive`, `/story-*`, `/synthesis`, `/aftermath`, `/iron-moon`, `/last-command`, `/master-*` | Historical development slices and diagnostics | audit individually; never expose as alternate play paths |

## Preserved interaction value

- Mission Lab contributes authored floor names, objectives, topology, knowledge boundaries,
  discoveries, story anchors, and reward contracts—not its page shell.
- Ruined Observatory contributes initiative, legal-action selection, focus/movement/impact/settle
  presentation, and the combat feed—not its proxy encounter ownership.
- Ruined Threshold contributes autonomous action playback, pause, speed, detail, replay verification,
  and approved 2.5D staging—not its fixture encounter ownership.
- Both combat presentations consume and settle the same authoritative encounter. Their outputs may
  not diverge in actions, result, rewards, or replay hash.

## Completion evidence

| Retired source | Canonical evidence |
| --- | --- |
| Tower Threshold and Mission Lab pages | `apps/web/src/lib/server/tower.spec.ts` proves the first five authored floors project from `@summonlab/content`; `apps/web/src/lib/city.spec.ts` proves both routes are absent |
| Floor One branch shell | `packages/contracts/src/exploration.spec.ts`, `packages/content/src/tower-floor-01-exploration.spec.ts`, and `packages/engine/src/domains/exploration/model.spec.ts` own the selectively ported model |
| Ruined Observatory page | Turn-based playback, board projection, and tests moved under `components/tower/combat/turn-based`; its approved battlefield is bound in `TowerEncounter.svelte`, while the full adapter remains to be mounted |
| Ruined Threshold page | Automated simulation, spatial, animation, replay, asset validation, and tests moved under `components/tower/combat/automated`; its approved battlefield is bound in `TowerEncounter.svelte`, while `RealtimeCombatStage` remains to be mounted |
| Separate combat engines | `tower-encounter.spec.ts` currently proves that both placeholder choices produce the same synthetic receipt hash; the canonical request and validated receipt integration is specified in `docs/superpowers/specs/2026-09-14-canonical-tower-travel-and-automated-combat-design.md` |
| Legacy mission page | Typed Tower start, move, encounter, and extraction endpoints plus `exploration.integration.spec.ts`; page route deleted |
| Lab root and route fixtures | `tower-screen.spec.ts` and the canonical campaign E2E own the surviving journey assertions; all lab route trees are deleted |

The player path is now:

```text
Before
/ → /village
   ├─ /living-village-lab/{tower,combat,realtime-combat}
   ├─ /mission-lab
   └─ /mission/[runId]

After
/ → /village → /tower → /village
   ├─ /residents
   ├─ /inventory
   └─ /missions
```

Floor selection, exploration, both combat choices, loot report, and extraction change server-owned
state while the browser remains on `/tower`. The internal run ID appears only in command URLs.
Historical evidence and the approved Observatory/Threshold raster assets remain; they no longer own
routes.

The route retirement is complete, but the combat migration is not. Until the follow-up design is
implemented, `TowerEncounter.svelte` changes backgrounds and asks the server for a synthetic result;
it does not mount the preserved turn-based or automated combat stage.
