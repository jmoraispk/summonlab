# Living Village Tower Exploration Handoff

Status: **implementation evidence for coordinator review**

Branch: `codex/lv-tower-screen`

Direct URL: `http://localhost:5173/living-village-lab/tower`

## Delivered slice

The isolated route combines:

- Floors 1–10 with two cleared hunting grounds, one first-clear frontier, sequential locks,
  difficulty, known species, material previews, and first-clear/repeat reward differences;
- an illustrated known-monster pool using existing Goblin Skirmisher, Grey Wolf, and Ember Wisp
  review art, with no player-authored species target;
- Dara Zev, Mara Vey, and Jori Daro as one three-slot party, with incomplete and unavailable typed
  rejection states;
- `75%`, `50%`, and `25%` per-hero remaining-Health choices with the post-encounter limitation
  stated beside the control;
- deterministic repeated encounters with carried Health/Mana, capacity, encounter-cap, and
  next-encounter safety checks;
- representative encounter selection, initiative/action order, Health/Mana changes, statuses,
  contribution breakdowns, decisive cause, Play/Pause, Replay, and `0.5x`/`1x`/`2x` controls;
- a complete haul containing species kills, per-hero level XP, practical skill-use evidence, every
  material and quantity, remaining resources, exact return code, receipt IDs, and haul hash;
- primary **Return to Village** and secondary **Review safe Court training** route-local handoffs;
- reduced-motion behavior and deliberate desktop, 390x844, and narrow/zoom-safe composition;
- three bounded game screens—Prepare, Explore, and Haul—with persistent step navigation and command
  bars instead of one continuously expanding page.

## Accepted review decision

The initial long-form dashboard composition was rejected in playtest review. The revised route
keeps only one task state on screen at a time. A later simplification review removed both explicit
species targeting and the separate Party screen: Prepare now contains floor, Health threshold,
party, and one deployment action. Party membership is represented by three explicit filled slots
and high-contrast selected-card banners. Health and Mana use numeric values plus bars. The Health
thresholds stay inside one three-part control at phone width. Encounter selection and
Play/Pause/Replay/Speed controls remain at the top of a bounded combat viewport, while **View haul**
remains in the persistent command bar.

The route has no page server, API request, database access, model-provider access, persistence, or
production mutation. Existing tower and monster review images are imported as clearly labeled
screen fixtures. No race, visual, contract, shared layout, navigation, or content catalog was
created or promoted.

## Presentation fixture

Fixture version: `living-village-species-hunt-presentation-v0`

```text
seed: tower-hunt-seed-0317
inventory capacity: 12 material units
encounter cap: 6
threshold check: after each complete encounter
unsafe-next check: visible upper-bound damage could reduce a hero to 0 Health
```

Random-looking values derive from:

```text
hash(huntSeed, encounterIndex, tick, actorId, purpose, sequence)
```

The default Floor 3 / `50%` exploration derives each encounter from Ember Wisp and Goblin
Skirmisher using the supplied seed and returns at the Health threshold. A `25%` exploration reaches
inventory capacity first. This makes the threshold an observable risk/reward choice while
preserving a bounded fixture.

Return reason precedence is defeat, Health threshold, inventory capacity, encounter cap, then
unsafe next encounter. Unit coverage exercises every return family.

## Proposed `CombatReceipt`

This proposal is implemented only as a route-local type:

```text
schemaVersion · receiptId · requestId · huntId · encounterIndex · attemptId
fixtureStatus · rulesVersion · seedPurposeRef
floorRef { floorId, definitionVersion, contentHash }
encounterRef { encounterId, speciesId, definitionVersion, contentHash }
partySnapshotRef { partyId, revision, snapshotHash, heroIds[] }
startedAtTick · endedAtTick · outcome
choiceLog[] · events[]
perUnit[] {
  unitId · initiativeOrder[] · damageDealt · damageTaken
  manaSpent · manaRecovered · statusesApplied[] · skillUses[] · downed
}
finalResources[] { unitId, health, mana }
decisiveCause { code, summary, supportingEventIds[] }
progressionClaims[]
materialClaims[] { claimId, materialId, quantity, sourceUnitId, sourceEventId }
inputStateHash · outputStateHash · traceHash
```

The route-local `HuntFixtureResult` aggregates the floor species pool, encounter receipt IDs,
per-species kill counts, selected threshold, capacity, cap, completed encounters, XP/practical-use
claims, material haul, final resources, primary/contributing return reasons, first-clear/unlock
proposals, training-eligible hero IDs, state hashes, and haul hash. It is not a request to add a
shared contract.

## Browser evidence

- [Desktop floor-exploration receipt chain](living-village-tower-desktop.png)
- [390x844 remaining-Health and return composition](living-village-tower-mobile.png)
- [390x844 Prepare floor and possible encounters](living-village-tower-mobile-ground.png)
- [390x844 Prepare party condition and resource bars](living-village-tower-mobile-party.png)
- [390x844 bounded Explore playback](living-village-tower-mobile-hunt.png)

The desktop capture is `1440x1000`; the phone capture is exactly `390x844`.

## Focused acceptance evidence

The route-local Playwright journey proves:

1. direct load and zero `/api/` requests;
2. floor selection and first-clear/repeat reward changes;
3. illustrated floor-monster, affinity, and drop previews without a target-selection control;
4. threshold selection and its post-encounter warning;
5. unavailable and incomplete deployment rejection with focus transfer;
6. deterministic multi-encounter replay across page reload;
7. initiative, contribution, status, Health/Mana, and decisive-cause presentation;
8. exact material haul, XP, practical skill uses, remaining Health, and return reason;
9. primary Village return and preselected secondary Court-training review;
10. reduced-motion paused start and no horizontal overflow at `390x844`.

## Validation record

| Gate | Command | Result |
| --- | --- | --- |
| Wiki | `pnpm validate:wiki` | passed; 57 pages and 19 asset references validated |
| Web typecheck | `pnpm --filter @summonlab/web typecheck` | passed; 0 errors and 0 warnings |
| Web lint | `pnpm --filter @summonlab/web lint` | passed |
| Fixture unit test | `pnpm --filter @summonlab/web exec vitest run src/lib/components/living-village/tower/tower-combat.spec.ts` | passed; 4 tests |
| Focused Playwright | `LV_TOWER_BASE_URL=http://127.0.0.1:4188 pnpm --filter @summonlab/web exec playwright test src/routes/living-village-lab/tower/tower.e2e.ts` | passed; 2 tests including 390x844 reduced motion |
| Production build | `pnpm --filter @summonlab/web build` | passed |
| Diff | `git diff --check` | passed |

The repository's default Playwright port (`4173`) was already owned by another worktree's preview
server during this run, so the focused journey used this worktree's isolated server on `4188`.
The shared Playwright configuration was not changed.

## Three useful review actions

1. Switch between Floor 1 and Floor 3. Decide whether the illustrated possible encounters, known
   drops, difficulty, and first-clear/repeat value explain the floor without a hunt order.
2. Explore Floor 3 at `75%`, reload, then explore it at `25%`. Decide whether post-encounter threshold
   timing, accumulated Health, and exact automatic-return reasons communicate the safety tradeoff.
3. Replay encounters 1 and 6 at `1x` and `2x`, inspect the haul, then choose **Return to Village**.
   Decide whether combat explanation, repeated-hunt pacing, material accounting, and the primary
   handoff feel like one coherent loop.

## Unresolved product questions

- Confirm that thresholds should use each hero's own maximum Health rather than one party-wide
  average.
- Confirm that `next-encounter-unsafe` should remain the conservative upper-bound damage check.
- Confirm that risk remains the primary displayed reason when Health threshold and capacity become
  true simultaneously.
- Decide whether practical progress remains limited to recorded skill users or gains a smaller
  participation component later.
- Decide whether reduced-motion playback needs a dedicated next-event control in addition to
  paused Play/Replay.
- Select and promote the eventual Living Village runtime monster trio through the normal visual
  review process; this route intentionally leaves all plates at their existing status.
