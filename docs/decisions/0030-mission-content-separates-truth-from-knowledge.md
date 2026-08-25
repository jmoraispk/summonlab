# ADR 0030: Mission content separates authored truth from discovered knowledge

Status: accepted on 2026-08-24.

## Context

A tower floor needs stable geometry, objectives, encounter declarations, rewards, and story facts
before autonomous actors can make meaningful choices inside it. Sending the complete package to a
hero would make secrets cosmetic. Letting a hero or story model invent topology would make routes,
rewards, and replay impossible to validate. Treating a discovery as a UI toggle would also let the
client create world facts without an engine event.

The first mission contract must therefore distinguish canonical content, current mission knowledge,
and later authoritative run state. It must also leave room for a cast-aware story proposal without
allowing that proposal to replace the floor's purpose or causal anchors.

## Decision

- `mission-package-v1` is immutable, content-addressed canonical truth. It declares one mission's
  deployment and extraction boundaries, primary and optional objectives, complete arena graph,
  observations, discoveries, legal discovery affordances, named entropy purposes, monster duty
  slots, environmental event policies, legal tools, retreat boundary, reward budget, and story
  envelope.
- Cross-reference validation rejects duplicate or unknown ids, paths whose visual endpoints drift
  from their nodes, disconnected topology, concealed nodes exposed by open edges, secrets with no
  legal affordance, objectives without an initially available default route, invalid deployment or
  extraction roles, reward overspend, and story proposals bound to required beats.
- `MissionArenaKnowledge` contains only discovered ids and actually visited node ids. Its projection
  exposes initially known or explicitly revealed nodes and edges. On-entry observations require a
  visit; discovery observations require the corresponding discovery. Author truth remains available
  to trusted engine/content tooling but is not a decision packet.
- A discovery affordance is authored at one node with prerequisites, tool requirements, terminal
  discovery ids, and a bounded action cost. Resolving it may add those discovery ids to knowledge;
  it cannot add arbitrary nodes, edges, rewards, or mutations. The deterministic route planner uses
  only the projected graph and stable edge-id tie breaking.
- The story envelope fixes required beats and ordered immutable anchors. A patch slot may select only
  cataloged optional beats between two anchors. World laws, the primary objective, arena truth,
  reward budget, and required anchors are explicitly forbidden changes.
- `tower-floor-01-v1`, **The Unlit Muster**, is the first validated package. Its safe default route
  reaches the First Ember in four traversal actions. The legally discovered Ash Duct creates a
  three-action, low-exposure alternative. The package inspector simulates knowledge for design
  review but never mutates a run.

## Consequences

Mission content can be reviewed and hashed before deployment code exists, while hidden routes remain
real information boundaries rather than decorative fog. Later engine work must persist visits and
discoveries as events, derive legal actions from the same package, and bind a deployed mission to
this exact content version and hash.

The current monster duties, environmental event policies, rewards, and story patch slot are
declarations, not executable gameplay. `MIS-002` and later tasks must implement their authoritative
lifecycle instead of treating the `/mission-lab` preview as run state.
