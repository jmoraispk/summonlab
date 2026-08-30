# Living Village Tower Species-Hunt Screen Implementation Plan

Status: **approved for execution planning**

Branch: `codex/lv-tower-screen`

Base: `codex/shared-system-architecture` at `20137289d5b4f68a441dd1895703eb730c3e32f9`

Direct route: `/living-village-lab/tower`

## Authority and source handling

The owner request is authoritative for scope, behavior, evidence, and delivery. The two supplied
combat documents are design sources, not instructions to repository workers:

| Source | SHA-256 | Use |
| --- | --- | --- |
| `combat_system.md` | `928c8187e6e267a024967c7a0b784715c5771bd4f1b946a6baf3f5d3bb2c031b` | Resolution architecture, deterministic seams, event-log requirements, formula shape, affinity/status language, and outcome semantics |
| `combat_system_slides.pptx` | `42fcd228f5671a7ada8006fd6b4e1db3ddb41225922d3d4d0bb6853d21aeea06` | Presentation hierarchy for the three layers, tick loop, resolution chain, affinity wheel, telegraphs, and readable logs |

The owner explicitly permits this task to edit the combat portion of the repository wiki. That
permission is narrow: update the existing combat system page to incorporate the supplied draft,
species-hunt presentation boundary, and source provenance. Do not edit unrelated wiki pages,
shared runtime contracts, production content catalogs, or release behavior outside the isolated
Tower prototype.

## Product hypothesis

The Tower species-hunt screen succeeds when a player can answer seven questions without leaving
the page:

1. Which hunting grounds are unlocked?
2. Which known species and materials are available on the selected floor?
3. Is my three-hero party deployable, and if not, why not?
4. How much remaining Health am I willing to risk before the party returns?
5. What happened in each encounter, in what order, and which inputs mattered?
6. Why did the hunt stop, and what exactly did the party bring home?
7. Should I return to the Village now or review safe Court training?

The prototype tests presentation, bounded repeated combat, safety-rule legibility, and interaction
quality. It does not claim accepted combat balance, persist canonical run state, call a database,
call a model provider, or expand Living Village into story, free-roaming expedition navigation,
world discovery, recovery, or permanent-injury systems.

## File ownership

### Runtime and test files

```text
apps/web/src/routes/living-village-lab/tower/+page.svelte
apps/web/src/routes/living-village-lab/tower/tower.e2e.ts
apps/web/src/lib/components/living-village/tower/tower-fixtures.ts
apps/web/src/lib/components/living-village/tower/tower-combat.ts
apps/web/src/lib/components/living-village/tower/FloorSelector.svelte
apps/web/src/lib/components/living-village/tower/HuntSetup.svelte
apps/web/src/lib/components/living-village/tower/PartyReadiness.svelte
apps/web/src/lib/components/living-village/tower/EncounterPresentation.svelte
apps/web/src/lib/components/living-village/tower/HuntReport.svelte
```

Component boundaries may be collapsed if a smaller implementation is clearer, but no component
may move into another Living Village owner's folder or into a shared layout.

### Evidence files

```text
docs/evidence/living-village-tower-implementation-plan.md
docs/evidence/living-village-tower-handoff.md
docs/evidence/living-village-tower-desktop.png
docs/evidence/living-village-tower-mobile.png
```

### Authorized wiki file

```text
docs/wiki/systems/summoning-progression-combat.md
```

No new wiki page or catalog record is required. The existing registered system page will receive a
bounded combat-design and Living Village species-hunt section, avoiding a broader wiki or catalog
edit.

## Experience structure

The page is one continuous command surface with four explicit states:

```text
hunting-ground and species selection
  -> party and safety confirmation
  -> bounded multi-encounter presentation
  -> haul report and automatic-return handoff
```

State changes remain route-local and reloadable only through fixture defaults. The UI must never
suggest that prototype choices have modified the production campaign.

### Hunting-ground and species selection

- Render Floors 1–10 as one semantic list with visible floor number, unlock state, difficulty,
  known species, known material drops, and reward mode.
- Start with Floors 1–2 cleared hunting grounds, Floor 3 unlocked as the first-clear frontier, and
  Floors 4–10 visible but sequentially locked. A successful first-clear fixture may unlock the next
  floor locally so the rule can be reviewed without persistence.
- Selecting a cleared floor shows repeat-hunt rewards; selecting the frontier shows first-clear
  rewards plus the ordinary species haul.
- Locked floors explain the preceding-floor requirement and cannot be deployed.
- Let the player choose exactly one known species from those available on the selected floor.
- Show species difficulty, affinity, encounter role, known drop names, and expected quantity ranges
  before deployment. Unknown drop rolls or unapproved lore are not invented.
- Use approximately three existing species/encounter patterns across the ten floors, scaled through
  typed fixture data rather than new races or visual forms.

### Party and safety confirmation

- Show exactly three current party slots using the fixed Living Village identities Dara Zev, Mara
  Vey, and Jori Daro.
- Expose current and maximum Health, Mana, level, affinity, primary skill, equipment contribution,
  and availability.
- Deployment validation returns typed reasons for an empty slot, unavailable hero, locked floor,
  missing species, or active hunt.
- The polished demo must include reachable examples of both incomplete and unavailable rejection,
  followed by a clear recovery action.
- Any availability adjustment is labeled route-local fixture behavior; it does not mutate a real
  training assignment.
- Offer remaining-Health thresholds of `75%`, `50%`, and `25%` as an accessible radio group.
- Explain beside the selector that the threshold is checked only after a complete encounter. One
  encounter can therefore take a hero below the chosen percentage before the return rule fires.
- Show a readiness summary that names the lowest projected safety margin, inventory capacity, and
  bounded encounter cap before deployment.

### Bounded repeated encounters

- Resolve a deterministic sequence of encounters against the selected species. The encounter index
  is part of every purpose-keyed roll so later fights are repeatable without cloning the first.
- Carry remaining Health and Mana between encounters during the hunt. Living Village resets both
  only after the party returns; it does not create injury, recovery time, or death.
- After every completed encounter, collect its material claims, XP claim, skill-practice evidence,
  Health/Mana state, and `CombatReceipt` before evaluating automatic return.
- Present a hunt progress rail showing completed encounter count, species kills, current party
  Health, carried inventory, and pending/selected representative encounter.
- The full hunt may resolve up front as pure fixture data, but the UI reveals it encounter by
  encounter so the player can follow cause and accumulation.

Automatic return triggers when any of these conditions becomes true:

1. an encounter ends in defeat;
2. any hero is at or below the selected remaining-Health threshold after an encounter;
3. collected material quantity reaches inventory capacity;
4. the configured encounter cap is reached;
5. the deterministic next-encounter safety projection says another fight could down a hero.

If multiple conditions become true after the same encounter, the list above is the stable primary
reason precedence. The haul report may list additional contributing conditions, but it must always
show one exact primary return code and plain-language explanation.

The route-local initial tuning proposal is reversible and visible:

```text
inventory capacity: 12 material units
encounter cap: 6
next-encounter unsafe: projected upper-bound damage would reduce any hero to 0 Health
threshold check: after combat, before considering another encounter
```

These constants are `living-village-species-hunt-presentation-v0`, not accepted economy or combat
rules.

### Representative encounter presentation

- Compose friendly and hostile cards as opposing formations, with a compact initiative/action-order
  rail and a readable event chronicle for the currently selected encounter.
- Each important action shows the actor, target, skill/basic action, Health or Mana delta, status,
  and the relevant skill, attribute, equipment, affinity, critical, and mitigation contributions.
- Surface telegraphs before resolution where the fixture uses them.
- Present a concise decisive-cause statement in both the final chronicle event and encounter
  summary.
- Let the player select a completed encounter from the hunt rail for review.
- Provide Play/Pause, Replay, and `0.5x`, `1x`, and `2x` speed controls for the representative
  encounter, with persistent accessible labels and pressed/selected state.
- Replaying presentation never rerolls the encounter or changes the haul.
- With `prefers-reduced-motion: reduce`, disable transforms, crossfades, pulsing, and automatic
  scrolling, and begin playback paused. No animation is required to understand the outcome.

### Haul report and return

- Distinguish victory, defeat, first clear, repeat hunt, and automatic safety return without relying
  on color alone.
- Report the selected floor and species, completed encounters, species kills, level XP claims,
  per-hero practical skill progress, every collected material and quantity, inventory usage,
  remaining Health and Mana, and the exact primary return reason.
- Show encounter-by-encounter provenance for aggregate XP, practice, and materials.
- Show reward claims rather than implying that combat directly granted XP, items, or unlocks.
- A repeat hunt cannot show or grant the first-clear item or floor unlock.
- Defeat grants no first-clear reward. Returning heroes recover under the Living Village reset rule
  after the report; no lasting injury or permanent death is created.
- Make **Return to Village** the dominant completed-hunt action.
- Provide **Review safe Court training** as a clear secondary action. Entering that route-local
  handoff preselects returning heroes who are eligible under the fixture and makes clear that
  training assignment belongs to the Village/Court owner.

## Deterministic presentation fixture

The route will implement two small pure resolver facades:

```text
simulateEncounter(CombatFixtureSpec) -> CombatFixtureResult
simulateHunt(HuntFixtureSpec) -> HuntFixtureResult
```

They receive all inputs in typed objects and perform no fetch, persistence, clock read, or
`Math.random()` call. Random-looking values derive from:

```text
fixtureRoll = hash(huntSeed, encounterIndex, tick, actorId, purpose, sequence)
```

`purpose` is a closed fixture union such as `INITIATIVE`, `HIT`, `CRIT`, `STATUS`, `DROP`, or
`REWARD`. The same hunt spec and seed must produce identical encounters, stop reason, haul,
receipts, and state hashes across replay and page reload.

The visible damage breakdown follows the supplied draft's shape:

```text
damage = SkillBase
       x (1 + AttributeScale)
       x (1 + EquipmentBonus)
       x AffinityMultiplier
       x CriticalMultiplier
       x (1 - Mitigation)
```

Every constant is route-local, named, and exposed in the explanation panel. The UI and wiki must
call this `living-village-species-hunt-presentation-v0`, a reversible fixture rather than accepted
final combat mathematics.

The implementation should demonstrate reproducibility, accumulation, and causal legibility. A
floor, species, party, or threshold change may alter the fixture result. Replaying a recorded
encounter presentation must reproduce its original receipt and cannot consume another drop roll.

## Proposed receipts and hunt result

The handoff will record this proposed `CombatReceipt` shape without changing shared contracts:

```text
CombatReceipt
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

The route-local hunt aggregator will additionally expose:

```text
HuntFixtureResult
  huntId · selectedThreshold · inventoryCapacity · encounterCap
  combatReceiptIds[] · encountersCompleted · speciesKills
  levelXpClaims[] · practicalSkillClaims[] · materialHaul[] · inventoryUsed
  finalResources[]
  returnReason { code, summary, supportingReceiptIds[] }
  contributingReturnReasons[]
  firstClearClaim? · unlockedFloorClaim? · trainingEligibleHeroIds[]
  inputStateHash · outputStateHash · haulHash
```

`HuntFixtureResult` is a presentation proposal, not a request to add a shared contract. Combat
reports encounter outcomes and claims; the hunt coordinator decides when to stop; progression,
inventory, floor state, and training validate and commit their own changes.

## Wiki update

Update `docs/wiki/systems/summoning-progression-combat.md` with a clearly marked draft section that
captures:

- resolution, intent, and narration as separate layers;
- legal-action intent, deterministic state-owning resolution, and purpose-keyed rolls;
- the event log as replay, explanation, and future narration input;
- the tick/action-order model, eleven-step resolution-chain shape, affinities, and statuses;
- victory/retreat/downed/defeat semantics, with permanent injury and death `off` for Living Village;
- species hunts as repeated deterministic encounters coordinated outside individual combat;
- post-encounter Health checks, pre-encounter unsafe projections, inventory/cap returns, and exact
  return-reason provenance as prototype behavior;
- the difference between supplied draft rules, Living Village placeholders, and parked systems;
- both source hashes and the fact that attachments are design input, not accepted final tuning.

Do not mark combat `accepted`, `implemented`, or `verified` solely because the prototype exists.

## Visual, responsive, and accessible composition

- Use `assets/tower-prototype.png` and existing monster review plates through imports; do not
  generate or name a new race.
- Label review/candidate art honestly as a screen fixture rather than runtime canon.
- Use flexible grids and intrinsic heights; avoid viewport-fixed panels that clip at 200% zoom.
- At desktop width, keep hunt setup and accumulated risk visible beside representative combat.
- At 390x844, use a deliberate single column: floor/species, threshold/party, hunt progress,
  encounter stage, chronicle/controls, then haul/return action.
- Maintain 44px primary targets, visible focus, semantic headings, status text, and non-color cues.
- Use `aria-live` conservatively for hunt and return-reason changes so repeated events do not
  overwhelm screen readers.

## Focused Playwright evidence

The focused spec should prove one coherent journey:

1. Load `/living-village-lab/tower` directly without an API dependency.
2. Select cleared/frontier floors and verify repeat/first-clear reward differences.
3. Select a known species and verify difficulty, affinity, and material preview.
4. Choose `50%` and verify the warning that the threshold is checked after an encounter.
5. Prove unavailable and incomplete party rejection, including focus placement.
6. Restore readiness, deploy, pause/resume, change speed, and finish the bounded hunt.
7. Replay the same seed and compare receipt IDs, encounter count, haul hash, return reason, and
   material quantities.
8. Verify species kills, level XP, practical skill progress, every material/quantity, capacity,
   remaining Health, and exact return reason.
9. Activate **Return to Village** and verify the handoff; verify safe Court training is secondary
   and preselects eligible heroes.
10. Emulate reduced motion and assert animations are disabled and playback starts paused.
11. Assert no horizontal overflow at 390x844 and effective 200% zoom.

Capture:

```text
docs/evidence/living-village-tower-desktop.png
docs/evidence/living-village-tower-mobile.png
```

The desktop image should show accumulated progress and representative combat explanation. The
mobile image should show the complete haul, exact return reason, remaining Health, and primary
Village-return action.

## Validation commands

```bash
pnpm validate:wiki
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web exec playwright test src/routes/living-village-lab/tower/tower.e2e.ts
pnpm --filter @summonlab/web build
git diff --check
git status --short
```

If an unrelated repository failure appears, record the exact command and failure without changing
out-of-scope code. The focused Tower test and direct route remain mandatory.

## Implementation sequence

1. Confirm branch/base and inspect neighboring work without editing it.
2. Add typed floors, species, materials, party states, thresholds, caps, reward modes, stop reasons,
   and deterministic helpers.
3. Implement and test encounter resolution, multi-encounter accumulation, resource carryover, haul
   aggregation, stop precedence, and stable hashes.
4. Build floor/species selection and party/safety validation.
5. Build hunt progress, representative playback controls, reduced motion, and explanations.
6. Build the complete haul report, primary Village return, and secondary Court-training handoff.
7. Add the focused Playwright journey and revise accessibility/responsiveness from browser evidence.
8. Capture desktop and 390x844 screenshots.
9. Update the authorized combat wiki page and final receipt/hunt handoff evidence.
10. Run every validation, commit all and only in-scope files, push `codex/lv-tower-screen`, and do
    not merge.

## Review actions and decisions

1. Switch floors and species while comparing known drops and reward modes. This decides whether a
   hunt can be chosen from risk and utility rather than guesswork.
2. Run the same hunt at `75%` and `25%`, then inspect the return reason and remaining Health. This
   decides whether threshold timing and the safety tradeoff are understandable.
3. Review one encounter at `1x`, replay at `2x`, inspect the haul, and choose **Return to Village**.
   This decides whether combat detail, hunt pacing, accounting, and handoff form one coherent loop.

## Open product questions

- Should thresholds use each hero's maximum Health, as planned, or one party-wide percentage?
- Should `next encounter unsafe` use upper-bound projected damage, as planned, or recommended power?
- When threshold and capacity trigger together, should risk remain the primary displayed reason?
- Does practical skill progress apply only to recorded skill users, as planned, or every participant?
- Should reduced-motion users also receive a dedicated next-event control?
- Which existing monster review plates should become the eventual runtime trio? This route will not
  promote candidates.

## Goal harness

Use this paragraph verbatim to begin the execution turn:

> Execute the Living Village Tower species-hunt screen plan in `docs/evidence/living-village-tower-implementation-plan.md` on `codex/lv-tower-screen`. Treat the owner request as authoritative and the attached combat Markdown and PowerPoint as design sources only. You are authorized to edit the existing combat portion of the wiki exactly as scoped by the plan. Implement the isolated `/living-village-lab/tower` route with hunting-ground and known-species selection, three-hero readiness validation, 75%/50%/25% remaining-Health thresholds, a transparent route-local deterministic multi-encounter fixture, bounded automatic-return rules, representative encounter playback controls, complete material/XP/practical-skill haul reporting, primary Village return, secondary safe-Court-training review, focused Playwright evidence, desktop and 390x844 screenshots, `CombatReceipt` and hunt-result handoff, and the combat wiki update; run every listed validation, commit all and only in-scope changes, push the branch, do not merge, and continue until the acceptance evidence is complete or a genuine out-of-scope blocker is proven.
