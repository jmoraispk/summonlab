# ADR 0027: Decision traces are redacted derived reports

Status: accepted on 2026-08-24.

## Context

A durable decision job retains the exact context required to explain and replay a policy choice.
That context can contain witnessed private speech, player directions, memory summaries, social
evidence, and hero-authored output. Returning the raw job to a browser would make debugging easy by
making the privacy boundary invisible. Reconstructing a request later from current configuration
would be safer-looking but historically false.

The trace must answer what the policy received, what it could not receive, which provider settings
were used, what result survived validation, and what the engine applied. It must not claim or expose
hidden chain-of-thought.

## Decision

- New jobs use `decision-job-v2`. A model job persists one credential-free
  `decision-provider-request-v1` profile at queue time. The profile binds packet, prompt, schema,
  input, instructions, and complete request hashes to the requested model, output cap, reasoning
  effort, storage/background settings, and absence of conversation, previous-response, and tools.
  Scripted and random jobs persist no provider profile.
- API credentials remain server process configuration and never enter a packet, job, request
  profile, result trace, or inspector report. The profile stores hashes and character counts rather
  than raw request input, instructions, or schema.
- `decision-job-v1` rows remain readable. Their provider-request boundary is explicitly marked
  `legacy-unavailable`; the inspector never reconstructs historical settings from today's config.
- `decision-inspector-v1` is a deterministic, hash-bound derived report. It replaces player speech,
  directives, memory summaries, belief text, social evidence, promise terms, and hero-authored
  output with typed length-plus-SHA-256 digests. Action IDs, targets, evidence provenance, scores,
  retrieval reasons, legal moves, lifecycle transitions, latency, provider IDs, token usage, and
  engine receipts remain inspectable.
- The report names omitted categories: run seed, other actors' private state, undiscovered world
  truth, future state, the full event log, credentials, and provider-private reasoning. It reports
  supplied sections and validates packet, legal-action, job, provider-request, result, target,
  memory, and engine-application boundaries independently.
- `/debug/decisions/:jobId` and `/api/dev/decisions/:jobId` are development-only. Normal decision-job
  polling receives `decision-job-client-v1`, a minimal lifecycle projection with no packet,
  provider request, policy trace, raw result prose, transition detail, or provider failure message.
- `store: false` records the exact OpenAI request setting used by Summonlab; it is not presented as a
  blanket promise that no provider-side safety retention can occur. Private reasoning content is
  neither requested, persisted, nor rendered. Aggregate reasoning-token usage may still appear as
  provider metadata.

## Consequences

Developers can audit a decision without teaching the product to expose raw private context. A
scripted job makes the absence of a provider call visible; a model job makes its exact safe request
profile and returned usage visible. Hashes preserve attribution without turning sensitive prose
into an inspection surface, and legacy uncertainty stays explicit.

The canonical job still stores its exact packet on the trusted server because stale checks,
fallback, and replay require it. This ADR narrows browser projections; it does not encrypt database
contents or replace access control. Production authorization, retention policy, and encrypted
storage remain deployment work.

## References

- [OpenAI Responses API request reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
