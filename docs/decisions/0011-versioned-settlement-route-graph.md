# ADR 0011: Settlement topology is versioned content

Status: accepted on 2026-08-24.

## Context

The Phase 1 proof uses three engine locations for one opening branch, but the living settlement needs
rooms, stations, social spaces, travel time, capacity, access rules, and authored visual paths. If
those facts live only in a canvas, visual movement can accidentally become authoritative. If they
are added directly to the old engine schema, existing `engine-v1` and `engine-v2` histories can lose
byte-stable replay before the topology has been reviewed.

## Decision

- `@summonlab/content` owns immutable settlement definitions. The first definition is
  `hearth-01-v1`, bound to SHA-256
  `83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9`.
- Hearth 01 contains exactly one summoning gate, kitchen, dormitory, training ground, and workshop.
  Every building declares an entrance, three or more interior nodes, required interactions,
  simulation effects, a system id, camera framing, ambient color, and back/mid/front composition
  layers.
- The spatial model is a connected graph of 18 nodes and 17 edges. Edges carry integer game-time
  duration, capacity, direction, access rules, and an authored visual path whose endpoints must
  match the referenced nodes.
- Route planning is deterministic. Equal-cost candidates are ordered by node and edge id; access is
  evaluated from an explicit set of available system ids. Missing or inaccessible nodes return no
  route rather than inventing travel.
- `pnpm validate:settlement-content` verifies the exact hash, schema invariants, five interiors,
  connectivity, and a reserve-power route from the gate to every building entrance.
- `/settlement-lab` is a development-only topology and composition inspector. Its Reserve and All
  systems modes are access previews, not saved run state. Its fully loaded JavaScript is 40.2 KB
  gzip against the shared 700 KB route ceiling.
- The renderer may highlight an authored path, but it cannot commit arrival. `SET-003` will add a
  new engine/content version whose command schedules travel and whose event commits arrival.
- Existing engine schemas and histories remain unchanged. The code-native interior compositions
  are layout evidence for `SET-001`, not approval of the final layered Hearth 01 art in `SET-002`.

## Consequences

The intended five-building settlement can now be reviewed spatially without coupling UI geometry
to game truth or invalidating old replays. System-gated stations such as the dormant forge are
visible but unreachable under the reserve profile, which gives future power choices a concrete
mechanical boundary.

Building state, assignments, authoritative travel, daily routines, offline catch-up, and final
settlement art remain later tasks. Changing the reviewed topology requires a new content version and
hash rather than silently rewriting saved routes.
