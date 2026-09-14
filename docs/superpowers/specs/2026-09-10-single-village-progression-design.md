# Single Village Progression Design

**Status:** Approved architecture

**Date:** 2026-09-11

**Supersedes:** The player-facing route and lab-retention decisions in
`docs/superpowers/specs/2026-09-09-village-city-convergence-design.md`

## Purpose

Summonlab currently exposes implementation history as if it were product structure. A fixture
Village, a database campaign route, a full-page onboarding presentation, separate Tower and
exploration studies, and multiple combat studies can all look like competing ways to play. The
player should not need to understand any of those names.

The current product has one anonymous player, one persistent Village, one chronological tutorial,
and one ongoing game loop. The front page enters the visual Village directly; it never interposes a
full-page prologue, company reveal, or lab. Internal run identifiers remain available for
persistence, replay, concurrency, and future account migration, but they are never a player choice
and never create a second Village interface.

## Product invariant

There is exactly one player-facing Village renderer: `CityScreen` with `CityVillageViewport` in
Village mode. Every spawn-enabled hero, whether described as legacy or current, is summoned into
that Village. All other approved heroes become eligible through completion of the same visual
contract, not through another renderer. No hero class, generation version, fixture, saved-state
version, or visual style may select a different Village component or route.

`Legacy` is descriptive metadata for a hero or saved record. It is not a second catalog, art loader,
Village, combat system, or progression path.

## Canonical user progression

The tutorial is a persisted, monotonic sequence:

```text
Front page
  → enter or resume directly in the visual Village
  → receive the story introduction in the Village
  → enter the Summoning House from the Summoning Circle site
  → summon three heroes individually into the Village
  → create the starter equipment at the Forge
  → equip the three residents
  → inspect the Tower and select Floor One
  → explore and resolve encounters in one Tower screen
  → extract and return to the same Village
  → learn resident interaction, proposed tasks, and autonomous schedules
  → continue the ongoing Village ↔ Tower loop
```

Reloading, reconnecting, or using a different device viewport resumes the current persisted tutorial
stage. It never falls back to a lab or restarts through a second onboarding implementation.

### Progression gates

1. The initial in-Village introduction activates the Summoning Circle site and explains the Village,
   summoning, and immediate Tower pressure without replacing the map.
2. Each of the three required summons is committed individually. The summoned hero appears at the
   center of the current Village before the next summon begins.
3. Completing the third summon activates the starter Forge tutorial.
4. The Tower becomes available after all three starting loadouts are legally assigned.
5. Floor One extraction unlocks the resident schedule tutorial and the ongoing Village loop.
6. Completed tutorial stages remain revisit-able where their underlying feature is repeatable, but
   the story stage never moves backward.

The Missions destination always shows the current tutorial objective and completed steps. Locked
actions remain visible only when their location helps teach the Village; they give one concise unlock
condition and never send the player to a prototype.

## Entry presentation rule

`/village` always mounts `CityScreen` with `CityVillageViewport`, including for a new campaign. A
new Village initially has no summoned residents. Story beats, guidance, locks, and calls to action
appear as map overlays, facility states, dialogue, or contextual panels over the canonical Village.

The current full-screen `SingletonOnboarding` presentation and the static **The First Three** opening
lab are deleted once their required story state and actions are represented in the Village. They are
not retained behind an alternate URL. Each successful summon commits one resident and places that
resident in the center of the current Village before the next summon is offered.

## Anonymous singleton state

The current repository supports one anonymous Village. Clicking **Enter Village** performs a
server-owned create-or-resume action:

- if the singleton campaign exists, resume it at its persisted stage;
- otherwise create it once, bind its internal run ID, and begin the Village introduction;
- repeated requests are idempotent and cannot create multiple active Villages;
- database or creation failure stays on the front page with a retry action and never substitutes
  fixture state.

The engine and APIs may continue using the internal run ID. Public navigation does not expose or ask
for it. Multi-user accounts, Village selection, and multiple Villages per account are explicitly
deferred.

## Canonical public surfaces

The public experience uses five clear destinations backed by the same singleton campaign and shared
City projection:

| Public destination | Responsibility |
| --- | --- |
| `/village` | Physical Village, story cues, resident figures, facilities, clock, occupancy, and local interactions |
| `/residents` | Roster, identity, status, equipment, skills, proposed tasks, and schedule outcomes |
| `/tower` | Floor list, expedition preparation, exploration, encounters, combat, loot, and extraction |
| `/inventory` | Shared items, materials, loadouts, equip and unequip actions |
| `/missions` | Current tutorial instruction, campaign objectives, evidence, and completed history |

These are modes of one City application, not separately designed page shells. A shared server loader
resolves the singleton run and produces `CityViewModel`; a shared mode adapter chooses the requested
surface. The five-option dock is the only global navigation header on desktop and the only fixed
navigation footer on phone.

ID-bearing endpoints and routes may remain during migration, but no dock, facility, front-page
action, or canonical redirect exposes them when the convergence is complete.

## Village facilities

The approved Village image and interactive composition remain canonical.

| Facility | Canonical action |
| --- | --- |
| Summoning Circle site / Summoning House | Open the interior summon sequence and introduce each arriving hero in the current Village |
| Residence | Recovery, sleep, meals, social activity, reading, and unstructured time |
| Training Grounds | Training proposals, practice activity, and skill or attribute development |
| Forge | Starter equipment tutorial, later crafting, materials, and forge work |
| Portal | Open the same Tower surface as the Tower dock destination |

The blue Portal and Tower dock never lead to competing Tower screens. The facility is the spatial
entry; the dock is the global entry. Both open the same `/tower` state. The blue Portal is not used
for hero summoning.

The existing Summoning Circle remains the clickable site until a later Village-background revision
can replace its outdoor art with a house. Its action may open the Summoning House interior before the
background art changes. That visual revision must not introduce another route, campaign, or Village
renderer.

## Summoning and hero visual contract

The Summoning House, entered from the Summoning Circle site, owns all player-facing hero acquisition.
Useful choreography, identity presentation, dossier feedback, and individual-arrival behavior from
the existing summon study are migrated into this canonical interaction rather than linked as a
separate lab.

Every spawn-enabled hero has one canonical identity record and three approved raster roles:

1. normal-proportion summon portrait;
2. combat chibi;
3. transparent normal-proportion Village cutout derived from the summon identity.

A hero may use a different approved chibi style, body type, generation version, or rarity without
changing this contract. A hero that lacks any required player-facing role is not enabled in the
summon pool. Development tools may show a labeled missing-art state, but production never invents a
character through CSS, SVG, emoji, canvas geometry, or an opaque rectangular portrait.

The current catalog contains 200 approved summon/chibi pairs but only three canonical Village
cutouts. Six historical route-local Village cutouts remain documentation evidence and are not
implicitly approved or spawn-enabled. A visual enters the runtime only after it is deliberately
reviewed, promoted into the canonical catalog, and passes the summon/portrait/chibi/Village identity
checks. Remaining heroes become spawn-enabled through that same promotion process; completing art
readiness does not create another runtime path.

The initial three summons use the same catalog and command path as every later summon. Tutorial
selection rules may constrain which three are offered, but they do not create tutorial-only hero
records. Each arrival explains why the hero was summoned, introduces the Village and Tower pressure
from that hero's perspective, and records the hero's first response before returning to the same map.

The four existing opening mockups remain historical visual evidence outside route ownership. In
particular, the empty stone-chamber background from the opening study is the leading candidate for
the Summoning House interior. Preserving an image does not preserve the opening lab UI, make it a
runtime asset, or approve it for production; that requires an explicit later visual decision.

## Starter equipment and Forge tutorial

The introductory Forge action creates exactly these starting loadouts:

- one two-handed spear;
- one two-handed bow;
- one sword and one shield.

This is a one-time Master-assisted tutorial craft. It requires no resident assignment, forging skill,
or elapsed production schedule because the newly summoned residents have not yet been introduced to
work specialization. The resulting items are ordinary authoritative inventory records and use the
same equip rules as later equipment.

The player distributes the three legal loadouts across the three residents. Two-handed weapons
occupy both hands; sword and shield occupy one hand each. Assignment is committed through the shared
equipment commands, updates Residents and Inventory immediately, and cannot duplicate or equip the
same item twice.

After Floor One, ordinary forging becomes part of the scheduling system. It may require a resident,
materials, time, facility access, and an appropriate skill. Those rules are not simulated during the
starter exception.

## Unified Tower mode

Tower selection, exploration, and combat are states of one `/tower` surface. They are not separate
player routes. The Tower Threshold lab has no product role and is deleted outright rather than
migrated as another threshold screen.

### Floor selection

The Tower opens on an authored floor list. Each floor reports locked, available, active, or cleared
state; known monster families; objective; notable rewards; and available control modes. The initial
tutorial selects Floor One. The useful authored material from Mission Lab for the first five floors
-- objectives, topology, discoveries, knowledge boundaries, story anchors, and rewards -- migrates
into this floor model before Mission Lab is deleted.

### First clear

An uncleared floor uses the authored exploration map. The party moves tile by tile through manual or
automatic choices, reveals fog, inspects landmarks, collects resources, and encounters monsters.
The same legal movement and encounter commands serve player clicks and later agent-selected choices.

When an encounter begins, the exploration map remains mounted with its exact authoritative state.
The central Tower viewport transitions into the shared encounter interface. Victory returns to the
same tile, reveals or grants the encounter result, and resumes exploration. Defeat resolves the
attempt without navigating through an unrelated combat page.

Exploration supplies position and opportunities; combat is the encounter state inside the same
surface. One authoritative encounter, party, action, result, reward, and replay contract supports two
initial control presentations:

- **Turn-based:** based on the useful Ruined Observatory study; the player chooses legal actions and
  advances the encounter deliberately.
- **Automated:** based on the useful Ruined Threshold study; residents choose actions while the
  player observes and may use agreed presentation controls such as pause, speed, or detail views.

These are adapters over the same rules and state, not independent combat engines, loot paths, or
player routes. Both are initially available through the canonical Tower encounter interface so they
can be compared in context. A later playtest may keep both or delete one; retiring the old lab routes
does not wait for that choice once both useful presentations have canonical homes.

### Cleared floors

A cleared floor offers:

- manual replay using the same exploration and encounter rules;
- automatic traversal using the same legal command model; and
- an idle expedition that resolves elapsed exploration from that floor's authored monster and reward
  tables.

Idle exploration is not a second combat system. It is an offline or accelerated policy consuming the
same floor content, party capabilities, risks, and reward definitions. Its exact duration, injury,
and yield tuning belongs to later implementation, after the first-clear loop works.

## Floor One branch disposition

`codex/floor-one-exploration-design` is a mechanics source, not a branch to merge wholesale.

The branch has no Git merge base with the current Village branch, contains substantial unrelated
history, and introduces `/living-village-lab/exploration` as another player-like route. A direct merge
would be unsafe and would reintroduce the parallel-path problem.

The following work is selectively ported with provenance from commits `ac6164554`, `35c2db016`,
`0ba945265`, and `d5ee4aa15`:

- Floor One tile and content contracts;
- authored topology and validation;
- fog and revealed knowledge;
- legal adjacent and five-step movement;
- persistent exploration attempt state;
- encounter request and receipt concepts; and
- the tested mechanics pilot where it remains compatible.

The route-level lab shell and the assumption of separate exploration and combat pages are not ported.
The contracts are adapted to the canonical `/tower` state machine before integration.

## Return, tasks, and autonomy

After Floor One extraction, the party returns to the same Village and appears at the Portal. The
return tutorial introduces resident interaction and schedules without turning residents into passive
units.

The player proposes tasks such as training, sleeping, cooking, forging, guarding, or preparing an
expedition. A proposal records priority, preferred timing, and relevant facility; it is not a promise
that every minute is directly controlled.

Residents build or revise their schedules from:

- player proposals and explicit urgent orders;
- health, hunger, fatigue, and safety;
- skills, aptitudes, roles, and current goals;
- relationships, beliefs, and recent events; and
- discretionary activities such as eating more, relaxing, wandering, socializing, or reading.

The interface distinguishes **proposed**, **accepted**, **adjusted**, **interrupted**, and **completed**
work. Agents explain meaningful deviations. Immediate safety or story-critical commands may have
stronger authority than routine proposals, but ordinary schedule management preserves autonomy.

## Current-code disposition

| Current code or route | Disposition |
| --- | --- |
| `CityScreen` and `CityVillageViewport` | Keep as the only Village renderer |
| City projector, typed intents, clock, occupancy, Residents, Inventory, and Missions modes | Keep and extend |
| `/settlement-lab` and `HearthScene` | Delete; obsolete parallel Village inspector |
| `/living-village-lab/village` | Remove as a browsable route; keep deterministic data only inside tests |
| `SingletonOnboarding` and `/onboarding/[runId]` | Move required story state and actions onto the Village, then delete the full-page presentation and route |
| `/living-village-lab/opening` (**The First Three**) | Preserve its four mockups as evidence, move any required story into the Village, then delete the UI and route |
| `/living-village-lab/summon` | Migrate useful summon behavior into the Summoning House, then delete |
| `/living-village-lab/tower` (**Tower Threshold**) | Delete outright; the canonical blue Portal and Tower dock already own entry |
| `/living-village-lab/exploration` | Port compatible Floor One mechanics into `/tower`, then delete |
| `/mission-lab` | Migrate useful first-five-floor authored content into `/tower`, then delete |
| `/living-village-lab/combat` (**Ruined Observatory**) | Migrate as the turn-based presentation of the shared Tower encounter, then delete the route |
| `/living-village-lab/realtime-combat` (**Ruined Threshold**) | Migrate as the automated presentation of the shared Tower encounter, then delete the route |
| `/living-village-lab` root, `LabBackLink`, route fixtures, and route tests | Delete after the last owned child capability has a tested canonical home |
| Pre-City settlement presentation inside `/play/[runId]` | Remove after the singleton entry and tutorial own those stages |
| `/summon/[runId]` and `/mission/[runId]` player interfaces | Delete after their required commands are available canonically; retain internal engine/API identifiers only where persistence needs them |
| Route-local hero cutouts and fixture hero catalogs | Keep historical images as evidence; promote only explicitly approved assets, then delete route-local runtime ownership |
| Historical specs, decisions, and evidence | Retain as history; mark superseded decisions explicitly rather than rewriting provenance |

Other experiments are not part of the product merely because they exist in the repository. They are
not linked from the front page, Village, dock, facilities, or canonical progression. Each must be
explicitly classified as evidence, migrate, or delete; none may silently become a second product
path.

## Delivery decomposition

This design is delivered as five reviewable subprojects rather than one repository-wide rewrite:

1. **Singleton route foundation — implemented 2026-09-10:** create the anonymous create-or-resume
   entry, establish the five canonical public destinations, remove the old settlement renderer, and
   remove the browsable fixture Village. See the
   [implementation plan](../plans/2026-09-10-singleton-village-route-foundation.md).
2. **Direct Village and Summoning House:** make every campaign stage mount the visual Village, move
   required story into its overlays and facilities, persist the first three individual arrivals,
   and retire `SingletonOnboarding`, the opening lab, the summon lab, and the legacy summon UI.
3. **Starter equipment:** add the Master-assisted Forge tutorial, create the fixed starting items,
   assign three legal loadouts, and make Inventory and Residents read the same state.
4. **Canonical Tower and combat:** port the compatible exploration contracts and first-five-floor
   authored content; render floor selection, exploration, turn-based combat, and automated combat
   inside `/tower`; return to the exact encounter tile; and retire Tower Threshold, Mission Lab,
   Ruined Observatory, Ruined Threshold, legacy mission UI, and the emptied lab root.
5. **Village return and autonomy:** persist extraction return, introduce proposed schedules and agent
   deviations, and unlock the ongoing Village-to-Tower loop.

Each subproject migrates and deletes its superseded path in the same slice. Later subprojects depend
on the canonical routes and state boundary established by the first; they do not create temporary
player-facing alternatives.

## Deletion safety

Deletion follows behavior migration, not filename recognition:

1. Identify liked behavior, authoritative state, approved assets, tests, and historical evidence owned
   by the old path.
2. Record a route-retirement manifest naming each behavior to migrate, asset to preserve, contract to
   reuse, and implementation artifact to delete. Unclassified files block deletion.
3. Add a failing canonical-path test for the behavior that must survive.
4. Implement the behavior through the singleton Village or Tower path.
5. Verify the canonical path on desktop and phone and compare it with the source study.
6. Delete the old route, renderer, route-local state, and navigation entry in the same reviewable
   slice.
7. Add source-boundary tests that prevent the retired component or route from returning.

Old routes do not remain as interactive compatibility pages. Saved-state compatibility belongs in
engine adapters and database migrations, not duplicate interfaces.

## Error and recovery behavior

- Singleton creation failure remains at the front page with a retry action.
- A stale command refreshes the authoritative projection and explains that the state changed.
- A summon without a complete approved art bundle is rejected before selection, not after arrival.
- A failed summon, craft, equip, movement, or schedule command grants nothing and preserves the last
  committed stage.
- Reload during summoning, equipment, exploration, or combat resumes the exact committed state.
- Combat presentation failure keeps the Tower attempt paused at its encounter and offers retry; it
  does not reroll or redirect to a lab.
- Duplicate requests cannot create another Village, duplicate a hero or item, repeat loot, or advance
  a tutorial stage twice.

## Validation and acceptance

The convergence is complete when:

1. **Enter Village** creates or resumes one anonymous persisted Village and reaches the visual
   `CityVillageViewport` at `/village` without exposing a run ID or showing a full-page prologue.
2. Source-boundary tests prove that only `CityVillageViewport` renders the player-facing Village and
   that the retired Village components and routes no longer exist.
3. A clean run completes the introduction, three summons, starter craft, three legal loadouts, Floor
   One, extraction, return, and schedule tutorial without visiting a lab or alternate onboarding page.
4. The Summoning Circle site opens the Summoning House; it never opens the Tower or a lab. The blue
   Portal and Tower dock entry reach the same Tower state.
5. Turn-based and automated encounters are selectable inside the same `/tower` interface, consume
   the same encounter, party, result, and reward contracts, return to the exact exploration tile
   after victory, and resume correctly after reload.
6. Every spawn-enabled hero has approved summon, combat-chibi, and Village-cutout assets resolved from
   the canonical catalog.
7. Legacy and current heroes use identical summon, Village, equipment, Tower, and persistence paths.
8. Residents, Inventory, Missions, occupancy, equipment assignments, and authoritative commands all
   read the same singleton campaign state.
9. Desktop and 390-by-844 phone E2E tests complete the same progression with the five-option dock as
   the only global navigation chrome.
10. No player-facing `/living-village-lab`, `/mission-lab`, `/settlement-lab`, `/summon/[runId]`,
    `/mission/[runId]`, full-page onboarding, or separate exploration/combat interface remains.
11. The four opening-study mockups and other retained historical evidence live outside deleted route
    ownership and cannot be imported by the production application accidentally.

## Explicitly deferred

- Registration, authentication, and account recovery.
- Multiple Villages or Village selection.
- Multiple simultaneous campaigns or parties.
- Final cleared-floor idle timing, risk, injury, and yield balance.
- The final decision to keep both Tower combat control modes or delete one after canonical playtests.
- Replacing the outdoor Summoning Circle artwork with a Summoning House building; the canonical
  interior interaction may ship first.
- Full forging skill progression beyond the starter exception.
- Floors Two through One Hundred beyond interfaces required to keep Floor One extensible.
- Synthesis placement and rules.
