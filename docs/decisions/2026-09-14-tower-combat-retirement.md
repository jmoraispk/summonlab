# Canonical Tower and Combat Retirement

**Status:** Route consolidation and canonical automated combat implemented

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
- Automated combat consumes and settles the authoritative encounter. The preserved turn-based
  adapter is not a player route and remains unmounted until the product decides whether a second
  presentation is worth keeping.

## Completion evidence

| Retired source | Canonical evidence |
| --- | --- |
| Tower Threshold and Mission Lab pages | `apps/web/src/lib/server/tower.spec.ts` proves the first five authored floors project from `@summonlab/content`; `apps/web/src/lib/city.spec.ts` proves both routes are absent |
| Floor One branch shell | `packages/contracts/src/exploration.spec.ts`, `packages/content/src/tower-floor-01-exploration.spec.ts`, and `packages/engine/src/domains/exploration/model.spec.ts` own the selectively ported model |
| Ruined Observatory page | Turn-based playback, board projection, tests, and approved Observatory art remain under `components/tower/combat/turn-based` as unmounted source material; no route or synthetic settlement owns them |
| Ruined Threshold page | Automated simulation, spatial behavior, replay, asset validation, and approved staging moved under `components/tower/combat/automated`; `TowerEncounter.svelte` mounts `RealtimeCombatStage` with the persisted production request |
| Separate combat engines | `tower-encounter.spec.ts` proves the production receipt is deterministically replayed against the active request; the former `resolveTowerEncounter` synthetic shortcut is deleted |
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

Floor selection, exploration, automated combat, loot report, and extraction change server-owned
state while the browser remains on `/tower`. The internal run ID appears only in command URLs.
Historical evidence and the approved Observatory/Threshold raster assets remain; they no longer own
routes.

The route and automated-combat migration are complete. `TowerEncounter.svelte` runs the exact
summoned party and submits the engine's full receipt. The encounter API parses, request-binds, and
deterministically replays that receipt before exploration resumes. The old fixture party remains
test-only, and the old mode button can no longer fabricate a victory.
