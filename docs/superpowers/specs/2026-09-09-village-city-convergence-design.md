# Village City convergence design

**Status:** Implemented; live database campaign E2E pending local Docker availability

**Date:** 2026-09-09

**Scope:** Converge the fixture-driven Living Village lab and database-backed campaign Village into
one player-facing City screen, retain the strongest interactions and authoritative projections, and
retire the competing renderers.

## Purpose

Summonlab currently has two independently implemented Village experiences. The visual lab is the
stronger interaction and composition prototype, while the campaign Village owns real saved state,
time, residents, assignments, and global navigation. Because the two screens evolved separately,
visual and interaction changes can land in one without reaching the other. This is the source of the
repeated sense that the Village moves backward and forward between revisions.

The visual lab becomes the canonical City experience. The campaign supplies that screen with real
state and commits its actions. The old campaign renderer and the standalone Village lab renderer are
retired after parity is proven. There is one City interface, not two products that resemble one
another.

## Clarification

There is no dog requirement. The earlier mention of a dog was a misunderstanding of `dock`. The
approved carry-forward is the five-option navigation dock.

## Accepted product decisions

1. The fixture-driven visual lab supplies the canonical City composition and interaction model.
2. The database-backed campaign remains the only source of persistent player state; it does not own a
   separate Village layout.
3. The final player-facing route is `/play/[runId]`. The lab URL is retained only as a no-database
   review harness around the same `CityScreen`; it owns no renderer or gameplay behavior.
4. Tests may construct a frozen sample City projection directly, but that sample does not own separate
   components, commands, navigation, or gameplay rules.
5. Desktop shows the five global modes across the top. Phone fixes the same five modes to the bottom
   safe area: `Village`, `Residents`, `Tower`, `Inventory`, and `Missions`.
6. The Village world exposes exactly five physical labels: `Summoning Circle`, `Residence`, `Training
   Grounds`, `Forge`, and `Portal`.
7. The compact occupancy ledger preserves the authoritative engine-space counts the owner liked:
   `Dorm`, `Kitchen`, `Gate`, `Training`, and `Forge`. These are operational spaces and may be more
   granular than the five physical world labels.
8. Approved transparent Village cutouts remain the only player-facing hero art in the City.
9. Selecting a resident in the ribbon or in the world opens the same quick view. The quick view keeps
   useful actions and a `Details` action. Opening full details replaces the quick view; the two never
   stack.
10. Pan, zoom, fit, and reset behavior from the visual lab remain available without changing
    authoritative resident positions.
11. A client interaction may preview focus, selection, camera, or an uncommitted destination. Changes
    to assignments, activities, travel, mission state, or inventory must use an authoritative command.
12. The next environment revision preserves the accepted Village except for a circular upper-left
    outer wall, a slightly forward Summoning Circle, matching local paths and vegetation, and the
    shorter `Portal` presentation label.

## Current split and disposition

| Current element | What is worth keeping | What is retired or corrected |
| --- | --- | --- |
| Living Village lab | Scene-first composition, resident ribbon, pan and zoom, world selection, quick actions, details drawer, strong phone behavior | Fixed hero identity types, local gameplay simulation, hardcoded runtime asset filename, separate route-level shell |
| Campaign Village | Real residents and approved cutouts, authoritative time and state, event cues, five-mode dock, operational occupancy and assignment counts | Competing `LivingHearthScene` layout, passive facility controls, detached roster ledger, legacy content below the Village home |
| Campaign database | Persistent save, simulation clock, assignments, building state, missions, equipment, event cursor | No presentation responsibility |
| Lab fixtures | Fast deterministic state for component and browser tests | No public gameplay route, no local rules that compete with the engine, no duplicated screen implementation |

## Chosen architecture: one screen, one projection, authoritative commands

The City is one shared Svelte screen with a serializable view model and typed intent callbacks.

```text
campaign database and engine
        ↓
server-side City projector
        ↓
CityViewModel
        ↓
CityScreen.svelte
        ├── global mode dock
        ├── map clock and resident ribbon
        ├── interactive Village viewport
        ├── resident quick view / details sheet
        ├── operational occupancy ledger
        └── Residents / Tower / Inventory / Missions surfaces
        ↓
typed player intent
        ↓
existing authoritative command endpoint
```

The campaign route loads and renders `CityViewModel`. Tests render the same `CityScreen` from a frozen
projection. A fixture is therefore comparable to a saved screenshot of state: it is test input, not a
second application architecture.

### City view model

The view model contains only information required by the City presentation:

- run ID, day, time, phase, event cursor, and state hash;
- current global mode and its five navigation destinations;
- the content-owned scene definition and runtime image binding;
- residents in authoritative order, including approved cutout and portrait bindings, current node,
  physical facility, activity, readiness, social summary, and available intents;
- five physical facility projections with scene bounds, labels, power state, and aggregate status;
- five operational occupancy rows for Dorm, Kitchen, Gate, Training, and Forge, including current
  occupancy and assignment capacity;
- current objectives, shared inventory summary, Tower availability, and event cue when those modes
  need them.

The projector owns translation from legacy engine building IDs to player-facing facilities. For
example, Residence contains both the kitchen and dormitory operational spaces, while Summoning Circle
contains the gate operational space. The visual component does not reproduce those mappings.

### Commands and local interaction

Camera motion, selected resident, selected facility, quick-view visibility, and detail-sheet visibility
are local interface state. Everything that changes the world is submitted as a typed City intent with
the current expected version.

- `Court training` assigns the resident to the training ground through the existing settlement command
  path.
- `Rest` assigns the resident to the dormitory through the existing settlement command path.
- Facility assignment choices may expose Kitchen, Gate, Training, Forge, or Dorm where the engine
  supports them, even though the map uses the five higher-level physical labels.
- `Tower` or `Portal` opens the Tower mode. A hunt or expedition is offered only when its mission
  preparation command exists; the City never preserves the lab's fake local hunt as gameplay.
- `Details` opens the shared resident sheet without issuing a world command.

On a successful command, the route refreshes or consumes the new authoritative projection. It does not
optimistically move a resident into a building. A rejected or stale command leaves the resident in
place and presents a concise reason beside the attempted action.

## Canonical City composition

### Desktop

The five-option dock is the City shell's only header. The dominant Village panorama begins directly
beneath it, with no resident directory or camera toolbar consuming a second row. Resident discovery
belongs to the Residents destination; in-world figures remain directly selectable for quick actions.
Day and game time appear as a small clock over the map's upper-left corner, and compact camera controls
float at the upper-right. World facility labels remain visible while their authored anchors are on
screen; labels outside a cropped phone view reappear when the player pans to their facilities. Resident
quick view opens over a bounded part of the scene; full details use one side sheet and replace it.

The operational occupancy ledger remains a compact overlay near a scene edge. It always reports the
five engine spaces in this order: Dorm, Kitchen, Gate, Training, Forge. Each row shows current people
and assignment capacity. It is information, not a second set of navigation controls.

### Phone

The City fills the space above the fixed five-option bottom dock. Camera controls use a compact two-by-two
map overlay instead of introducing a header row. The Residents destination owns the resident directory,
while in-world figures still open quick actions. Quick view rises as a bounded bottom sheet above the
dock; full details replace it. Facility controls, hero targets, and dock controls retain non-overlapping
touch targets of at least 44 by 44 CSS pixels.

## Facility language

The player-facing world names are:

1. Summoning Circle
2. Residence
3. Training Grounds
4. Forge
5. Portal

`Portal` replaces the longer displayed `Tower Portal`. The internal facility ID may remain
`tower-portal` so saved references, scene validation, and Tower routing remain stable. `Tower` remains
the global mode name.

The engine's operational names remain visible only where their granularity is useful: Dorm, Kitchen,
Gate, Training, and Forge in the occupancy ledger and assignment actions. This preserves truthful
simulation detail without restoring Kitchen and Dorm as separate buildings in the environment.

## Environment revision

The next source image is a new versioned candidate derived from the accepted threshold environment.
The edit is deliberately narrow:

- curve the upper-left outer wall so its silhouette mirrors the circular right side;
- move the Summoning Circle slightly toward the foreground to create room for that curve;
- adjust only the Circle's short branch path, nearby vegetation, lamps, and retaining stones required
  by the move;
- preserve the Portal, Residence, Training Grounds, Forge, center road, camera, lighting, palette,
  mountains, facility scale, and hero-free/UI-free base plate;
- bake no residents, labels, icons, dock, or operational counts into the raster.

The candidate is reviewed at desktop and phone scene scale before its content-addressed WebP replaces
the current runtime binding. Scene bounds, label anchors, and affected route-node projections are
updated to the actual pixels rather than moved speculatively.

## Migration and retirement sequence

1. Define `CityViewModel` and projection tests around one existing arrived campaign.
2. Extract the lab's camera, resident selection, quick view, and details behavior into shared City
   components without changing their visible behavior.
3. Mount the five-mode dock, time plaque, approved campaign residents, and five-row operational
   occupancy ledger in the shared City shell.
4. Replace lab-only hero IDs and local order mutations with view-model residents and typed intents.
5. Wire supported intents to existing authoritative assignment and activity commands. Keep unsupported
   Tower actions unavailable rather than simulating them locally.
6. Replace the Village branch of `/play/[runId]` with the shared City screen and verify desktop and
   phone parity.
7. Remove `LivingHearthScene` and any superseded campaign-only Village projection code once no route
   imports them.
8. Keep `/living-village-lab/village` only as a deterministic review harness for environments without a
   local database. It imports the exact shared City component, implements no gameplay rules, and is not
   a player-facing product alternative.
9. Generate and promote the narrowly revised environment candidate, then recapture the canonical City
   evidence.

Deletion happens only after the shared City passes the migrated tests. No liked interaction is removed
first and promised for later.

## Broader duplication boundary

The same prototype/production split exists around Opening versus Onboarding, lab Summon versus campaign
Summon, lab Tower versus campaign Tower, and lab combat studies versus the mission route. This design
does not combine all of them in one risky rewrite.

Village is the first convergence seam because it owns the application shell. After it lands, Summon and
Tower should adopt the shared shell and the same `projection → component → intent` boundary. Opening
and combat remain separate until their gameplay contracts are reviewed; their current experiments are
not silently promoted merely because their visuals are attractive.

## Rejected alternatives

### Keep two Village renderers with adapters

This retains the source of drift. Sharing a view model is insufficient if two component trees can
continue making independent layout and interaction decisions.

### Promote the campaign renderer and copy lab interactions into it

The campaign renderer is the weaker visual foundation and contains legacy page structure the owner no
longer wants. Copying interactions into it would preserve the wrong composition and duplicate more
code during migration.

### Require a live database for every visual test

This produces one runtime path but makes layout work, screenshots, component tests, and failure
diagnosis depend on external infrastructure. Frozen projected state is acceptable as test input as long
as it renders the same component and cannot implement gameplay rules.

### Converge Village, Summon, Tower, Opening, and combat together

This is a large cross-game rewrite without a stable review boundary. It would make regressions hard to
attribute and could discard useful prototypes before their authoritative replacements exist.

## Testing and evidence

Projection tests prove that one campaign snapshot yields the correct five facilities, five operational
occupancy rows, resident order, approved art bindings, available intents, dock routes, time, and state
cursor.

Shared component tests use a frozen projection and cover selection, quick view, mutually exclusive
details, camera controls, facility focus, all five dock modes, and rejected-command feedback. They do
not contain a second assignment or mission reducer.

Campaign browser coverage creates an arrived campaign and verifies:

- the canonical City is the only Village renderer;
- approved residents appear at authoritative nodes;
- Dorm, Kitchen, Gate, Training, and Forge counts match the projection;
- training and rest actions commit authoritative commands and update the subsequent projection;
- unsupported Tower actions cannot mutate state;
- desktop uses the top dock and phone uses the bottom dock;
- five physical facility controls and five global dock controls coexist without collisions;
- pan, zoom, resident quick view, details, keyboard operation, reduced motion, and 390 by 844 phone
  layout remain usable.

Visual evidence includes clean desktop and phone City captures, a resident quick view, resident details,
the occupancy ledger, and the environment revision at fitted scene scale.

## Completion criteria

The implementation is complete when `/play/[runId]` renders the visual lab's approved composition with
campaign-authoritative residents, time, occupancy, and commands; the five-option responsive dock and
five world facilities are simultaneously present; the old campaign Village renderer has no remaining
route imports; the lab URL is only a thin shared-screen review harness; and migrated tests preserve
every liked interaction. Release validation still requires the database-backed campaign E2E.
