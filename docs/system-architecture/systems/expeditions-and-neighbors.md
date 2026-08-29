# Parties, missions, portals, and neighbors

Status: **single Master-led attempt proven; persistent parties and Masterless concurrency are new**

Primary owner: company parties, expedition runtime, destinations, vehicles, and mounts

## Player promise

Heroes form recognizable teams, assess their own readiness, and travel without making the player a
disposable combatant. The Master prepares, authorizes, advises, observes through the town's bond,
and lives with the outcome. Later, an airship turns a closed survival town into a network of
persistent neighbors.

## Owns

- persistent Party membership, leadership, roles, doctrine, formation, and revision;
- hero/asset reservations and expedition attempt registry;
- tower, portal, and neighbor attempt-local positions, objectives, harm, discoveries, cargo, retreat,
  extraction, and terminal outcomes;
- destination registry, route knowledge, neighbor relation receipts;
- vehicle and mount deployment capabilities.

Party and expedition may become separate packages. This brief defines their seam.

## Does not own

- permanent XP/currency grants;
- story facts beyond attempt outcomes;
- hero personality, private beliefs, or visual identity;
- construction of the shipyard or facility capability;
- another settlement's internal state.

## Masterless mission model

The town Master is not a normal party member. A hero leader coordinates the party. The Master can
send scoped directives, approve preparation, authorize retreat, and use explicit limited portal/tower
interventions if later designed. The player may have broad tactical telemetry, but each hero policy
still receives only holder-owned context.

Existing mortal-Master attempts remain valid historical rules. New mission content declares a
ruleset that permits or requires hero-only deployment.

## Multiple parties

A persistent party is revisioned. An expedition reserves one exact revision and loadout. A hero,
mount, vehicle, or unique item cannot be reserved twice. One run may have several attempts at
different destinations. A frontier lease serializes a first clear; repeat known floors and other
destinations can proceed concurrently.

Leaders are representatives, not telepaths. They can aggregate concerns and open party-scoped
petitions, but private beliefs do not automatically become party knowledge.

## Destination families

- **Tower:** finite global frontier, repeatable known floors where content permits, holder-specific
  secrets, five-floor bands.
- **Portal:** temporary opening, attempt-local cargo, deadline and extraction pressure.
- **Neighbor:** persistent route and relationship, reached after airship capability, supports
  social encounters, trade, knowledge, specialists, and missions.

## Airship

The airship is a vehicle asset with crew/cargo capacity, range, condition, modules, fuel/provision
requirements, and dock location. The settlement builds/services it; expedition reserves and travels
it. Commissioning the required ship/dock combination unlocks `neighbor-expedition`.

One settlement never writes another's state. Outcomes return treaty, trade, recruit, route,
knowledge, and story receipts.

## Mounts

Mounts are first-class non-hero entities with stable visual manifest, health, stamina, temperament,
needs, bond/training, tack/armor, location, and capability tags. Non-sapient mounts use deterministic
animal policies. The first slice supports ride, carry, and evacuate; later mounts can add terrain,
combat, flying, breeding, or intelligent-agent behavior.

## Interfaces

Consumes:

- party revisions, hero willingness/availability, capability snapshots, equipment reservations;
- destination/mission content, story plan binding, vehicle/mount capability;
- Master directives and observed time.

Publishes:

- attempt and reservation events;
- harm, death, discovery, witness, retreat, and extraction receipts;
- typed reward/cargo claims;
- party history/readiness inputs, destination discovery, and neighbor relation results.

## Invariants

- No asset or hero is active in two expeditions.
- Active attempt truth binds exact content and party revisions.
- First-clear advancement cannot double-commit.
- Attempt-local cargo becomes owned only on valid extraction.
- Harm, death, equipment wear, and witnesses persist.
- Master operational awareness does not leak into hero context.
- Vehicle/mount condition and location are authoritative, not animation.

## Roadmap

1. Define Party, readiness, reservation, mission registry, and Masterless mission-v2 contracts.
2. Replay Floor 1 with a hero leader and remote Master direction.
3. Add multiple idle parties, then concurrent repeat-floor/portal attempts.
4. Integrate leader recommendations and holder-specific reports.
5. Build one airship and one neighbor round trip.
6. Add one ground mount, then broaden destinations, vehicles, and mounts.

## Feedback ledger

| Date | Status | Feedback | Consequence |
| --- | --- | --- | --- |
| 2026-08-29 | accepted | The player is town Master, not a hero whose death risks the run. | New hero-only party ruleset; preserve legacy mortal-Master replays. |
| 2026-08-29 | accepted | Multiple parties arrive later. | Party is persistent; attempt is a revision-bound snapshot; mission state becomes a registry. |
| 2026-08-29 | accepted | Neighbor exploration unlocks after a flying ship or similar. | Ship/dock grants a capability consumed by persistent neighbor expeditions. |
| 2026-08-29 | accepted | Animal mounts would be valuable. | First-class mount assets share reservation/presentation seams, not hero progression by default. |

## Open decisions

- How directly can the Master intervene during a remote expedition?
- Can two parties enter different tower floors simultaneously, and can repeat attempts alter the
  active frontier?
- Is the first airship player-designed through modules or an authored landmark with upgrades?

## Existing foundations

Start with ADRs 0030–0040, 0042–0046; mission contracts; tower band/portal content; attempt-local
cargo, persistent aftermath, and player-journal proofs. Current `masterRequired: true` contracts are
legacy inputs, not targets.
