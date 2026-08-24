# ADR 0022: Decision context is derived and holder-owned

Status: accepted on 2026-08-24.

## Context

An independently called model needs enough current context to act like one persistent person, but an
engine snapshot contains authoritative facts that the hero cannot know. Passing a full snapshot or
run log would create roster-wide telepathy, reveal secrets, and make behavior impossible to audit.
Passing an informal prompt assembled at call sites would make retrieval, redaction, and legal-action
scope inconsistent.

The engine stores a manifest hash rather than full appearance/identity bytes, while proof
persistence stores the generated manifest. The packet boundary must join those sources without
silently trusting either one.

## Decision

- `hero-decision-packet-v1` is a pure projection. It takes one exact `engine-v8` snapshot, the hero
  ID, the decision kind, and a manifest whose canonical SHA-256 must match the engine hero.
- Assembly rejects a stale state hash, a mismatched identity, a non-active hero, legacy knowledge
  schemas, and a state where that hero has no legal decision boundary.
- The packet records run version, cursor, game time, state hash, packet/context/response versions,
  deterministic packet ID, packet hash, legal actions, and legal-action hash.
- Only the hero's implemented self state, owned items, co-located visible people, holder-specific
  beliefs, relevant directed relationships/authority, witnessed promises/directives, and current
  legal affordances are projected. The run seed, hidden story state, settlement-wide resource
  ledger, other manifests, private cognition, and render-only manifest fields are omitted.
- An unfamiliar co-located adult is not labeled Master until this hero holds a witnessed
  `claims-master-role` belief.
- `hero-memory-v1` draws candidates only from observations owned by this hero. It scores explicit
  salience, recency, present-subject overlap, location relevance, and addressed/overheard speech.
  Total score, components, and short reasons are inspectable; ties use newest time and then stable
  memory ID.
- Retrieval is bounded by both maximum items and maximum characters. Exact communication is
  eligible only if its communicative act resolves through a witness record to the hero's own
  observation.
- The summon page may show the current player-owned packet projection. Persistence/retention of raw
  packets and provider results belongs to the later decision-job and inspector slices.

## Consequences

The same snapshot and identity produce byte-equal packets regardless of record insertion order.
Later random, scripted, and model policies can share one input and can be rejected against the same
legal-action hash. A bug report can name a packet hash and source cursor before provider integration
exists.

This slice does not call a model, apply a policy, create a decision job, persist packet text, or let
the model write memory. Those capabilities must consume this boundary rather than reconstructing
their own prompt context.
