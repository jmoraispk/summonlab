# ADR 0020: Social cognition is holder-specific and event-derived

Status: accepted on 2026-08-24.

## Context

The First Ember records an immediate hero response, but a response alone cannot support later
conversation, trust, refusal, rumor, or remembered promises. Those mechanics need to distinguish
world truth from what a particular hero actually observed and believes. Fresh summons are clean
slates: silently copying the full run state into every mind would make social behavior omniscient
and erase the value of explanation and communication.

Authority also cannot be a hidden obedience score. A hero may respect the Master’s strength while
distrusting their provision, or accept a competent decision without believing the Master is
legitimate. Those differences must remain inspectable and causal.

## Decision

- New runs use `engine-v7` with a bounded `society-v1` aggregate. Immutable v1–v6 histories keep
  their original schemas and receive no retroactive social records.
- Observations belong to one hero and cite the authoritative source event. Bootstrap creates one
  direct awakening observation for the summoned hero.
- Beliefs belong to one hero and cite both a source event and the observation through which the
  belief was learned. Provenance records whether knowledge was experienced, observed, told,
  inferred, or recorded, along with source and chain depth.
- Awakening grants only safe direct knowledge: the hero believes they awakened at the summoning gate
  and that an unfamiliar adult was present. It grants no tower rules, Master legitimacy, prior-death
  history, roster knowledge, or settlement-wide telepathy.
- Relationships are directed and track trust, respect, fear, affection, resentment, and debt.
- A hero’s view of Master authority separately tracks competence, provision, trust, legitimacy,
  fear, strength, and consistency. The engine exposes evidence and human-readable standing rather
  than a scalar obedience score.
- Promises are explicit records with promisor, promisees, witnesses, terms, status, source event,
  and terminal resolution fields. The First Ember rationale creates one active founding-priority
  promise witnessed by the participating heroes.
- The `settlement.first.ember.committed` event persists the exact post-event social projection. Its
  reducer recomputes and compares that projection during replay, preventing later tuning from
  silently rewriting historical consequences.
- Normal play receives a bounded projection: held-belief count, latest observation, relationship
  language, authority standing, and active promise terms. The development replay inspector exposes
  raw observations, provenance, evidence, and dimension values.
- `AGT-001` does not implement dialogue, general witness propagation, rumor, memory retrieval, or
  model calls. Those remain separate Phase 5 boundaries.

## Consequences

The first summon begins socially uncertain without being empty of sensory knowledge. The First
Ember now creates durable, replayable consequences that later conversation can reference, and a
mismatched explanation becomes explicit negative consistency evidence. Player-facing language can
stay legible while the replay lab preserves enough detail to diagnose why two heroes differ.

The current social event stores a bounded post-event aggregate because the prototype has one direct
social transition. Later communication work must preserve these provenance rules and payload bounds
as the graph grows; it cannot replace them with prompt-only memory or roster-wide knowledge.
