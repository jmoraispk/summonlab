# Canonical Tower Travel and Automated Combat Design

**Status:** Approved in conversation on 2026-09-14; implementation pending

**Governing specification:**
`docs/superpowers/specs/2026-09-10-single-village-progression-design.md`

**Extends:** `docs/superpowers/specs/2026-09-07-exploration-combat-contract-design.md`

## Purpose

Complete the useful interaction and presentation work that was preserved during Tower consolidation
but was not connected to the canonical `/tower` experience. The player must be able to click a
revealed destination, watch the summoned company travel there by a safe deterministic route, enter
an encounter deliberately, and watch that same company fight in automated mode.

This work does not restore a lab route or create another exploration or combat system. Floor
selection, exploration, both combat modes, receipt settlement, and extraction remain states inside
the singleton campaign's `/tower` destination.

## Current gap

The current exploration screen exposes only adjacent legal steps even though the engine already
contains an incomplete multi-step travel planner. The map contains no party artwork and the move
endpoint accepts only one adjacent destination. Reaching a distant tile therefore requires repeated
direction-button clicks.

The current encounter projection persists only a request ID and request hash. `TowerEncounter`
changes a background and immediately asks the server for a synthetic victory receipt. It never
mounts `RealtimeCombatStage`, and it does not provide the complete party, enemy, battlefield,
policy, and artwork request that the preserved automated runtime requires. Consequently, selecting
**Automated** resolves state without showing heroes fighting.

The prior retirement record described the preserved renderer as if it were already integrated. It
was moved under canonical source ownership, but only its background was mounted. This design makes
the integration requirement explicit.

## Product invariants

- `/tower` is the only player-facing Tower and combat route.
- The active exploration attempt owns the party, position, fog, interactions, and encounter
  lifecycle.
- One frozen encounter request powers turn-based and automated presentation. Changing presentation
  cannot create a second encounter or change its result, claims, or receipt identity.
- The heroes shown on the map and battlefield are the heroes summoned in the current singleton
  campaign.
- Player-facing hero figures always use approved raster combat chibis. An unrelated fixture hero is
  never substituted for missing art.
- Refreshing during travel or combat resumes authoritative state rather than returning to a lab or
  inventing a replacement encounter.
- The Asha, Toma, and Nessa rat study remains test data and historical evidence. It is not a
  production party.

## Click-to-travel behavior

### Destination eligibility

Every revealed, walkable tile is a map button. A hidden tile, wall, or unreachable tile is not a
legal destination. The current tile remains focusable as the party's position but does not issue a
move command.

An unresolved encounter tile is an intentional-combat destination. Clicking it means the player
wants to approach and start that encounter. Clicking any other destination means the player wants a
safe route and must not accidentally enter combat.

### Danger zones

An unresolved encounter tile and every tile touching it by an edge or corner form its danger zone.
For an ordinary destination, the planner treats the entire danger zone as blocked. If no route
exists without entering a danger zone, the click does not move the party and the map explains that
the company must engage or choose another destination.

For an intentional encounter destination, the encounter tile is the endpoint. The planner may use
the minimum required part of that encounter's danger zone only for the final approach. Other
unresolved encounter tiles and their danger zones remain blocked. This exception prevents a narrow
corridor from making a deliberately selected encounter unreachable.

### Route ordering

The planner selects routes in this order:

1. obey walkability, reveal, interaction, and danger-zone rules;
2. minimize the number of orthogonal tile steps;
3. among equally short routes, minimize direction changes so the route is as straight as possible;
4. break any remaining tie by a fixed north, east, south, west ordering.

This produces deterministic paths for persistence, tests, and later agent-controlled travel.

### Interaction interruption

Travel stops on the first unresolved interaction along the selected route. Loot, discovery, and
objective interactions settle before another move can begin. An encounter changes the attempt to
`encounter` at that exact tile. The server response identifies both the requested destination and
the actual stopping tile so the client never implies that the company travelled farther than it
did.

### Command and persistence

The move command carries `attemptId`, `expectedVersion`, and `destinationTileId`. The server plans
and validates the complete route against authoritative floor and attempt state, applies its steps
in order, and commits the resulting state atomically. The state version advances once per applied
tile, preserving equivalence with adjacent movement and exact optimistic-concurrency checks.

The response includes the accepted path and stopping reason. The client animates the accepted path
and then refreshes the City projection. A rejected or stale command leaves the party at the last
authoritative tile and displays a retryable message.

## Exploration party presentation

The map projects the three active party members as a compact group inside the current tile. Their
figures use the current campaign heroes' approved `combat-chibi` runtime assets, never Village
cutouts or opaque summon portraits.

After an accepted route, the party group moves between returned tile centers in order. The visual
motion does not predict or mutate state. With reduced motion enabled, the group advances without
interpolation while preserving the accepted path and final position. Keyboard activation and
screen-reader labels expose the same destinations, route result, and encounter intent as pointer
input.

## Canonical encounter request

When travel reaches an unresolved encounter, the server creates one complete
`ExplorationEncounterRequest` from:

- the persisted exploration attempt and its party hero IDs;
- frozen current Health, Mana, equipment, capability, actions, and availability for those heroes;
- approved runtime `combat-chibi` bindings for those exact heroes;
- the floor interaction's authored duty slot and deterministic enemy instances;
- the selected battlefield, combat rules, policy, entropy, limits, and content bindings.

The request is validated and hashed before the attempt enters encounter state. The complete request
is persisted as JSON alongside its request ID and hash so reload uses the exact same inputs. The
database rejects a stored payload whose computed hash or identity disagrees with the encounter
binding.

Floor One keeps its authored goblin duties. The first integration uses the approved Ruined
Threshold battlefield and available approved goblin raster presentation. It does not silently
change the encounter to the rat fixture. Multiple instances may share an approved enemy appearance
when the duty definition calls for a group.

## Automated combat presentation

Selecting **Automated** mounts the preserved PixiJS autonomous runtime inside `TowerEncounter` with
the persisted canonical request. The current campaign heroes enter the battlefield, choose targets,
move, attack, receive hits, and reach a terminal result while the player watches. The existing pause,
speed, status detail, and reduced-motion behaviors are retained where they consume the same session.

The automated stage continues to use one PixiJS `Application`, a private ticker, verified asset
loading, bounded simulation ticks, and explicit teardown when the encounter is left or replaced.
Initialization failure produces a visible unavailable state and does not fabricate victory or
defeat.

### Static motion fallback

All summon-enabled heroes have approved combat chibis, but not all have authored motion sheets.
The combat presentation contract therefore distinguishes a required approved combat raster from an
optional approved motion pack. When a matching motion pack exists, the stage uses its idle,
advance, attack, hit, and down clips. Otherwise it animates the approved chibi as a whole sprite for
movement, attack anticipation, impact, hit reaction, and defeat. This fallback never changes the
hero's artwork or combat mechanics.

Enemy motion follows the same rule: use a matching approved motion pack when available and the
approved enemy raster with whole-sprite motion otherwise. A participant without any approved combat
raster makes the encounter unavailable with a named missing-art error.

### Receipt settlement

The automated runtime produces the existing bounded `ExplorationCombatReceipt`. The encounter API
validates the receipt against the persisted request, request hash, terminal trace, active attempt,
and expected version before settling exploration. A valid receipt clears the active encounter and
resumes on the same tile after the battlefield finishes presenting the result. Duplicate submission
is idempotent. A mismatched or nonterminal receipt cannot advance exploration.

Turn-based combat consumes the same persisted request and submits the same receipt contract. This
slice may retain the current minimal turn-based controls, but it may not use the former synthetic
server victory shortcut after the shared receipt endpoint becomes authoritative.

## Component and ownership changes

- `@summonlab/engine/exploration` owns deterministic safe-path planning and multi-step state
  application.
- `@summonlab/contracts` owns the accepted-route response and the explicit optional-motion
  presentation contract.
- `@summonlab/database` owns atomic travel persistence and the complete active encounter request.
- the Tower move endpoint validates and executes requested travel; it does not accept a client path.
- the Tower encounter endpoint validates and settles a combat receipt; it does not invent a result.
- `TowerExplorationMap` owns accessible destination input and accepted-route animation.
- `TowerEncounter` owns presentation selection and mounts the canonical turn-based or automated
  adapter.
- `RealtimeCombatStage` remains the automated presentation and simulation owner; its fixture
  defaults are removed from production entry.

No component or API redirects to `living-village-lab`, `mission-lab`, or a run-ID combat page.

## Error handling

- An unreachable ordinary tile reports **No safe route to this tile** and leaves state unchanged.
- A stale exploration version reports that the party position changed and refreshes the projection.
- A missing or hash-mismatched encounter request blocks combat and preserves the active encounter
  for diagnosis or retry.
- A missing approved combat raster names the participant and does not render a procedural stand-in.
- Asset-load or WebGL initialization failure offers retry and may use PixiJS's supported renderer
  fallback, but cannot auto-resolve the fight.
- Navigating away destroys the ticker, renderer resources, object URLs, subscriptions, and decoded
  textures owned by that stage.

## Test strategy

### Engine tests

- ordinary destinations avoid encounter tiles and all edge- or corner-touching danger tiles;
- a safe route is shortest first and fewest-turns second;
- clicking an encounter permits only its required final approach;
- unrelated encounter danger zones remain blocked;
- travel stops at the first unresolved interaction;
- multi-step application matches repeated legal single steps and version advancement.

### Contract and database tests

- accepted-route and optional-motion payloads are strict and hash-bound;
- full active encounter requests persist and reload unchanged;
- request identity or hash drift is rejected;
- multi-step travel is atomic under optimistic concurrency;
- receipt settlement is terminal, request-bound, and idempotent.

### Web and PixiJS tests

- revealed reachable cells are actionable while walls and hidden cells are not;
- the map passes only the clicked destination and animates only the server-returned path;
- the three current campaign hero chibis appear on the map and automated battlefield;
- a missing motion pack uses whole-sprite motion without substituting fixture art;
- automated completion submits its receipt and resumes the exact encounter tile;
- refresh during an encounter restores the same request and party;
- initialization and teardown release the ticker and decoded assets.

### End-to-end acceptance

One canonical campaign test summons three heroes, opens `/tower`, clicks a distant safe tile, observes
party movement, deliberately clicks the first enemy, chooses **Automated**, observes all three named
heroes on the battlefield, waits for a terminal result, refreshes, and confirms exploration resumes
from the exact encounter tile. A second assertion confirms that no lab or fixture route is used.

## Completion criteria

This slice is complete when:

1. a player can navigate the revealed map by clicking destinations instead of repeating adjacent
   direction controls;
2. ordinary travel never enters an unresolved encounter or its danger zone;
3. clicking an encounter deliberately reaches and starts it;
4. the current summoned heroes visibly travel and fight with approved combat chibis;
5. automated combat visibly runs to a validated receipt rather than a synthetic button result;
6. reload preserves the exact exploration attempt and encounter request;
7. the canonical `/tower` path passes focused, integration, type, lint, format, and end-to-end
   validation with no player-facing lab route restored.
