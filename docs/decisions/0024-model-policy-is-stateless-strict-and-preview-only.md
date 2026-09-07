# ADR 0024: Model policy is stateless, strict, and preview-only

Status: accepted on 2026-08-24.

## Context

The two zero-cost policies prove the legal-action/result boundary but cannot provide the
personality interpretation that motivates Summonlab. Provider integration introduces new failure
modes: prompt injection through quoted player speech, conversation-state leakage, unbounded cost,
schema-valid but illegal selections, provider refusals, partial output, and results that become
stale before application. The model must remain a replaceable policy rather than another game
authority.

ADR 0023 prohibited network access at the whole `@summonlab/policies` package boundary. That is too
broad once the planned provider policy arrives. This decision narrows the invariant to exports and
implementations: the root random/scripted export remains provider-free and deterministic, while a
separate server-only subpath may own an explicitly injected provider transport.

## Decision

- `@summonlab/policies/openai` implements `OpenAIModelPolicy` with the official OpenAI TypeScript
  SDK. The zero-cost root export does not import or initialize the SDK.
- Every call verifies `hero-decision-packet-v1` and its legal-action hash before transport use. The
  canonical packet is the only dynamic input.
- `hero-model-prompt-v1` says packet strings are quoted game data, limits knowledge to the packet,
  makes directives best-effort influence, forbids private chain-of-thought, and reiterates that only
  the engine resolves actions.
- Requests are independent foreground Responses calls: `store: false`, no conversation,
  no `previous_response_id`, standard service tier, low verbosity, configurable bounded output,
  and configurable low-cost reasoning effort. The default candidate remains `gpt-5-nano`.
- `summonlab_hero_decision` is a strict JSON Schema matching the existing Zod response contract.
  Parsed output is validated again against the packet's exact action, target, and memory sets.
- `model-policy-v1` results use the shared packet/legal/state envelope and canonical result hash.
  The trace stores prompt/schema versions, requested and resolved models, response ID, service
  tier, token usage, request/output hashes, and selected action. It does not store reasoning text.
- The adapter classifies timeout, provider failure, refusal, incomplete response, missing output,
  malformed JSON, invalid schema, and illegal decision. It never retries or falls back internally;
  the durable `AGT-006` job state machine owns those transitions.
- The only application integration in this slice is a development-only manual preview endpoint.
  It requires `POLICY_MODE=model`, a local key, explicit click/cost acknowledgment, and a matching
  current packet hash. It returns a read-only result and cannot apply state.

## Consequences

Routine scripted development, CI, and browser tests spend nothing and require no key. Fake
transports exercise provider success and failure paths deterministically. A keyed local playtest can
judge whether the cheapest candidate preserves Mara's personality and knowledge boundary without
prematurely coupling model latency or failure to authoritative state.

This slice does not persist jobs, retry calls, estimate per-model price, apply results, or prove a
model quality threshold. Those remain explicit `AGT-006` and `AGT-009` work rather than hidden
behavior inside the adapter.
