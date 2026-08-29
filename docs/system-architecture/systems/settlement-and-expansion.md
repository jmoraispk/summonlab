# Settlement and base expansion

Status: **fixed Hearth proof complete; runtime construction and territory expansion are new**

Primary owner: settlement topology, facilities, construction, and capability unlocks

## Player promise

The settlement becomes a physical record of the Master's priorities. Space, facilities, staffing,
power, and routes change how heroes live and what the company can attempt.

## Owns

- immutable sector, building-class, facility, and module definitions;
- runtime sector/facility instances, topology overlays, capacity, condition, power, and assignments;
- construction project lifecycle and labor schedule;
- capabilities granted by completed facilities;
- population space and local territory expansion.

## Does not own

- hero intention, personality, or skill progress;
- resource balances;
- mission state or neighbor routes;
- synthesis mechanics even when it hosts the chamber;
- arrival inferred from renderer animation.

## Territory model

Keep Hearth a bounded home rather than a conquest map, while allowing meaningful space growth:

- reclaim sealed or ruined districts inside/beside the original walls;
- build vertical terraces and wall towers;
- excavate underground chambers;
- stabilize fold-space annexes;
- attach aerial platforms and the eventual air dock.

Each expansion is an authored sector definition plus a runtime unlock/instance. It adds a versioned
route overlay and capacities without changing `hearth-01-v1` bytes. The player chooses among a small
set of spatial opportunities rather than drawing arbitrary buildings on a freeform grid.

## Building grammar

Use a few extensible classes:

| Class | Examples | Primary behavior |
| --- | --- | --- |
| Habitat | dormitory, private quarters, guest house | sleep, privacy, population |
| Production | kitchen, forge, alchemy, farms | resources, tools, maintenance |
| Training/research | grounds, library, academy | practice, teaching, discovery |
| Recovery/social/civic | infirmary, hall, council, shrine | healing, meetings, legitimacy |
| Transit/ritual/defense | gate, portal, synthesis, shipyard, walls | system access, travel, security |

Modules specialize a class. A facility changes affordances, friction, schedules, capacity, social
contact, and available legal actions. Passive bonuses are supporting effects, not its sole purpose.

Settlement systems should create legible motivational loops:

```text
clear objective → accessible place/tool/mentor → appropriately difficult practice
→ visible feedback and social recognition → recovery → stronger habit and new goal
```

Poor systems can produce boredom, congestion, overwork, purposeless idling, avoidance, resentment,
or status competition. Those are causal signals and design problems, not random flavor or an excuse
to overwrite hero autonomy.

## Construction lifecycle

```text
proposed → funded → building → complete
                       ├→ paused
                       └→ damaged → repair
```

Funding reserves resources atomically. Building reserves a lot/sector capacity, creates scheduled
labor demand, and can pause safely. Completion emits a capability grant. Hero assignments affect
speed and learning through typed work receipts; Settlement never writes skill XP itself.

## Interfaces

Consumes:

- economy reservations and item refs;
- hero availability/assignment, labor capability, and scheduled time;
- authored sector/facility/module definitions.

Publishes:

- route/occupancy/affordance projections;
- construction and facility lifecycle events;
- capability grants such as advanced training, synthesis, portal operation, shipbuilding, or
  neighbor expedition;
- work completion claims for Progression.

## Invariants

- Content definitions are immutable and hash-bound.
- Runtime expansion uses instances/overlays, not silent content mutation.
- Resources, lots, heroes, and construction jobs cannot be double-reserved.
- The server owns travel, capacity, assignments, power, and completion.
- A completed building changes at least one meaningful affordance or capacity.
- All sectors remain navigable and accessible under their declared rules.

## Roadmap

1. Define generic construction project, facility instance, module, and capability contracts.
2. Upgrade one existing facility and prove changed hero behavior/progression.
3. Add one authored expansion sector: sealed district, terrace, or underground.
4. Add facility condition, damage, repair, and staffing depth.
5. Add shipyard and aerial dock modules.
6. Add larger councils/delegation and population services for 1,000 residents.

## Feedback ledger

| Date | Status | Feedback | Consequence |
| --- | --- | --- | --- |
| 2026-08-29 | accepted | Provide ways to increase territory space and a few ways to build. | Discrete sectors plus five building classes/modules, not a giant kind enum. |
| 2026-08-29 | accepted | Base expansion connects to later flying-ship exploration. | Shipyard/air dock grants the neighbor-expedition capability. |
| 2026-08-29 | accepted | The player should design systems that make agents train and act toward clear objectives. | Facilities, schedules, mentorship, feedback, recovery, and norms must affect voluntary behavior. |

## Open decisions

- Which first expansion fantasy is strongest: reclaiming ruins, vertical terraces, or underground?
- How much construction placement freedom should exist within an authored sector?
- What non-death event, if any, should end a campaign for the nonphysical Master?

## Existing foundations

Start with ADRs 0011–0019, `hearth-01-v1`, settlement contracts, authoritative travel/facility
operations, living projections, and the First Ember capability choice.
