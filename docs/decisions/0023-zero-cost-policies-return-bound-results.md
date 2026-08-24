# ADR 0023: Zero-cost policies return bound results

Status: accepted on 2026-08-24.

## Context

`hero-decision-packet-v1` establishes what one hero can know and which actions the engine currently
allows, but a policy consumer can still become an authority leak if it accepts altered packets,
invents targets, cites unavailable memories, or returns only an untraceable action ID. Random and
scripted policies are needed before provider integration so simulation, fallback, and evaluation
have a zero-cost reference implementation across every decision kind.

The earlier summon proof has destination-specific policy logic in the character generator. That
logic predates the holder-owned packet and cannot be the long-term agency seam: it receives a
character draft instead of current world knowledge, has no legal-action hash, and produces a
proof-specific shape.

## Decision

- `@summonlab/policies` is a pure package outside the deterministic engine and character generator.
  It may read contracts and hashing/packet verification helpers, but it may not query a database,
  network, wall clock, or ambient random source.
- Every policy receives one complete `HeroDecisionPacket`, validates its packet hash and recomputed
  legal-action hash, requires canonical sorted unique actions, and rejects selected targets or
  memory candidates outside that packet.
- `RandomPolicy` requires an explicit non-empty seed. `random-policy-v1` hashes policy version,
  seed, packet hash, and legal-action hash into one reproducible unsigned draw; its trace stores the
  seed hash, draw, canonical candidates, and selected index without exposing the seed.
- `ScriptedPolicy` uses `scripted-policy-v1` for all four current decision kinds. It scores only
  legal action text/tags and packet-visible needs, physiology-independent mind traits, capabilities,
  holder-owned authority, and witnessed active directives. Contributions and totals are explicit;
  equal totals resolve by action ID.
- Both return `hero-policy-result-v1`: the decision, policy version, packet/legal/state references,
  trace, and canonical result hash. Intent, spoken text, goal proposals, and memory candidates are
  bounded proposals, not state mutations.
- `hero-decision-preview-v1` evaluates both baselines against exactly one packet. The summon page
  may show this read-only comparison; it does not apply either result.
- The existing proof-specific choice path remains untouched until the job/application layer can
  reject stale results atomically. `AGT-006` owns that migration rather than allowing a preview
  endpoint to race authoritative state.

## Consequences

The same packet and random seed produce byte-equal results. Scripted behavior can vary with values,
drives, habits, needs, authority evidence, and witnessed direction without seeing hidden world
truth. Every policy result names the exact packet and legal boundary that produced it, giving the
future provider adapter, fallback ladder, job store, replay inspector, and evaluation corpus one
shared output contract.

This slice does not call OpenAI, persist a decision job, retry work, accept a stale completion, or
apply a preview result. The provider adapter must conform to the same decision validation and result
binding rather than gaining a parallel path to game state.
