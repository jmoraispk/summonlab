# Living Village parallel production plan

Wiki ID: `roadmap.living-village-parallel-plan`

Design status: **draft for owner review**

This is the execution map for producing the three-screen Living Village prototype in parallel. It
turns the [Living Village milestone](../milestones/living-village.md) and
[v1 release matrix](living-village-v1.md) into bounded worker assignments. The fixed prototype
roster is **Dara Zev, Mara Vey, Jori Daro, Kira Toren, Iven Orra, and Remy Nahl**. No lane may add,
generate, reroll, or replace a face.

## Recommended team shape

Use **one integration owner plus thirteen focused workers**. The twelve production workers can
begin as soon as the integration owner publishes the first interface packet; the QA owner can
scaffold immediately and starts full verification when the first screen labs render. If fewer
workers are available, merge the two hero-derivative lanes, combine mechanics fixtures with the
combat adapter, and combine the skill and equipment visual lanes. Do not merge integration
ownership into a production lane.

| Owner | Independent assignment | Primary output | Starts when |
| --- | --- | --- | --- |
| 0. Integration and contracts | Freeze view models, fixture IDs, asset dimensions, capability flags, and promotion rules; compose reviewed work | versioned interface packet and integrated build | immediately |
| 1. Village surface | Build Hearth navigation, zoom/pan, fit/reset, touch and keyboard controls, and Gate/Court/Tower hotspots | isolated Village screen lab | interface packet exists |
| 2. Roster / Hero surface | Polish fixed-six roster, hero sheet, equipment, party, and short training flow across desktop and phone | isolated Roster/Hero screen lab | projection fixtures exist |
| 3. Tower surface | Polish floor selection, party confirmation, combat playback/report, and return-to-training state | isolated Tower screen lab | tower and combat receipt fixtures exist |
| 4. Summon experience | Compare three summon presentations with skip, reduced motion, timing, and sound hooks | isolated summon lab plus recommendation | fixed summon presentation model exists |
| 5. Loop mechanics | Implement deterministic fixed-six acquisition, party/training/reward fixtures, idempotency, and rejection cases | engine fixtures and tests | IDs and commands are frozen |
| 6. Tower/combat adapter | Implement Floor 1 first behind `CombatRequest`/`CombatReceipt`, then provide the Floors 2–10 scaling seam | resolver adapter and deterministic traces | combat fields are frozen |
| 7. Hero derivatives A | Finish Dara, Mara, and Jori portrait crops, summon crops, and compact combat figures | owned asset packet and manifest fragment | dimensions and anchors are frozen |
| 8. Hero derivatives B | Finish Kira, Iven, and Remy portrait crops, summon crops, and compact combat figures | owned asset packet and manifest fragment | dimensions and anchors are frozen |
| 9. Village and environment visuals | Produce one layered Hearth scene for useful zoom ranges, hotspot states, and depth treatment | environment packet and layer manifest | Village camera brief exists |
| 10. Monsters and tower visuals | Produce the three selected runtime monsters, one boss treatment, and one reusable tower backdrop | owned enemy/environment packets | race IDs and camera brief exist |
| 11. Skill and VFX visuals | Produce icons for the initial twelve skills and VFX elements only for visible active skills, summon, and combat states | owned icon/VFX packet and manifest fragment | skill IDs and effect profiles exist |
| 12. Equipment and UI objects | Produce inventory icons for the selected starter/drop items and shared object-frame treatments | owned equipment packet and manifest fragment | item IDs and icon profile exist |
| 13. QA and playtest | Verify keyboard, phone, 200% browser zoom, reduced motion, determinism, performance, visual regression, and the ten-minute loop | automated checks and evidence report | can scaffold immediately; verifies every gate |

This recommended shape uses fourteen concurrent agents in total and leaves three slots of the
current seventeen-agent capacity for short audits or a temporarily split visual packet. Avoid
keeping those extra slots full until the first Floor-1 loop is integrated; additional permanent
lanes would mostly compete for shared files or create art that has no proven runtime use.

## The three screen contracts

Each screen worker develops against fixtures in an isolated lab route. Only the integration owner
moves reviewed components into shared navigation or production routes.

| Screen | Consumes | Produces | Must prove |
| --- | --- | --- | --- |
| Village | `VillageViewModel`, current roster summary, destination state | destination intent, camera state, selected return action | the whole Hearth is understandable; zoom never hides recovery; all three destinations are reachable without precision clicking |
| Roster / Hero | `HeroRosterProjection`, `TrainingPreview`, item and party projections | selection, equip, party, and training intents | the six identities remain recognizable; training takes select hero → select focus → confirm |
| Tower | `TowerViewModel`, `CombatReceipt`, reward and unlock projections | floor selection, deployment, playback, result, and return intents | a player can explain the result and reach **Train returning heroes** directly |

The summon sequence is an overlay or focused state reached from the Village, not a fourth permanent
top-level screen. It consumes one `SummonPresentationModel` containing the summon receipt, fixed
hero ID, portrait/figure bindings, revealed mechanics, and already-owned rejection state.

## Summon experiments

The summon owner should prototype all three variants against the same fixed receipt so the choice
is about experience rather than content:

1. **Gate ignition** — Hearth gate charges in layers, silhouette crosses the threshold, identity
   resolves, then the mechanical card appears.
2. **Constellation assembly** — affinity and skill marks gather into a human outline before the
   persistent portrait resolves.
3. **Immediate identity** — a fast portrait-first reveal with restrained parallax and information
   staged afterward; optimized for repeat summons.

Every version needs a skip path, a reduced-motion version, no unskippable wait after identity is
known, and a defined duration to first recognizable face. The review output is a comparison capture
and one recommended default—not three production animations. Because Living Village contains only
six unique acquisitions, novelty should come from pacing and identity detail rather than fake
rarity spectacle or duplicate-roll logic.

## Shared interfaces to freeze first

The integration owner publishes one compact packet before lane work begins:

- `VillageViewModel`: destination availability, summary counters, return emphasis, and camera
  bounds;
- `HeroRosterProjection`: fixed identity, progression, skills, equipment, party, training, and
  availability;
- `SummonPresentationModel`: receipt ID, hero ID, presentation assets, reveal facts, and state;
- `TowerViewModel`: floor states, party eligibility, reward preview, and current attempt;
- `CombatRequest` / `CombatReceipt`: frozen party input and deterministic explanatory trace;
- `TrainingPreview`: eligible targets, focus choices, exact projected delta, and rejection reason;
- asset profiles for portrait, summon portrait, compact figure, monster figure, icon, VFX element,
  Hearth layers, and tower backdrop.

Workers may request changes through a proposed contract fragment. They do not independently edit a
shared contract, content catalog, wiki catalog, runtime allowlist, or production route.

## Collision-safe ownership

Give every agent a written packet with exactly six fields: objective, owned paths, read-only
dependencies, required inputs, acceptance evidence, and forbidden edits.

- Screen workers own separate lab-route and component folders. They may read shared styles and
  fixtures but do not change navigation, global CSS, or another screen's files.
- Mechanics workers own separate engine or content domains and their tests. They do not encode
  presentation timing or choose visual assets.
- Visual workers own named asset work directories and manifest **fragments**. They never promote
  files into shared catalogs or silently replace an approved anchor.
- The integration owner alone owns shared contracts, capability manifests, catalog indexes,
  production composition, and cross-lane conflict resolution.
- The QA owner may add tests and evidence but reports product defects to the owning lane instead of
  rewriting that lane's implementation.

## Integration sequence

### Gate 0 — contracts and fixtures

Freeze the six hero IDs, initial skill/equipment/monster subset, screen projections, commands,
receipt schemas, asset dimensions, and reduced-motion policy. All screen labs can now run on static
fixtures while mechanics and visual production proceed.

### Gate 1 — separate screen reviews

Review Village zoom and hotspots, Roster/Hero decision density, Tower result comprehension, and the
three summon experiments independently. A screen must pass desktop, phone, keyboard, and 200%
browser zoom before production integration.

### Gate 2 — one real Floor-1 loop

Integrate exactly three starting heroes, one summon presentation, one party, one encounter, one
reward, and one training block. Do not multiply floors or assets until deterministic replay and the
short result-to-training path pass.

### Gate 3 — complete fixed-six arc

Add Kira at Floor 3, Iven at Floor 6, and Remy at Floor 9; apply the proven encounter adapter through
Floor 10; bind the three selected monsters and boss treatment. No new faces enter the pool.

### Gate 4 — playtest candidate

Promote reviewed visuals, settle the default summon animation, tune zoom and responsive behavior,
run performance/accessibility/visual regression checks, and complete the ten-minute acceptance
path from fresh run through improved retry.

## Parallel dependency map

```text
integration packet
├── Village lab ───────────────┐
├── Roster/Hero lab ───────────┤
├── Tower lab ─────────────────┤
├── summon experiments ────────┤
├── loop mechanics ────────────┼── one Floor-1 loop ── fixed-six Floors 1–10 ── playtest
├── combat adapter ────────────┤
├── hero derivatives A/B ──────┤
├── Village visuals ───────────┤
├── monster/tower visuals ─────┤
├── skill and equipment art ───┤
└── QA and playtest ───────────┘
```

The safe unit of parallelism is an independently reviewable packet, not a feature name. Village
zoom, a summon animation, or one hero derivative set can be accepted or rejected without forcing
another lane to rebase or reinterpret the game rules.

## Agent kickoff template

```text
Objective: <one reviewable outcome>
Owned paths: <exclusive files/directories>
Read-only dependencies: <contracts, fixtures, references>
Required inputs: <IDs, dimensions, view model version>
Acceptance evidence: <tests, captures, timings, interaction checklist>
Forbidden edits: shared catalogs/contracts/routes; other agents' owned paths
Return: implementation + evidence + unresolved decisions; do not self-promote shared assets
```

The integration owner should record every accepted decision back into the milestone, release
matrix, or owning system page. The plan is coordination scaffolding; it must not become a second
source of truth for game rules.
