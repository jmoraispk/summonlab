# ADR 0021: Communication is canonical and witness-bounded

Status: accepted on 2026-08-24.

## Context

Clean-slate heroes need explanations, but free text cannot be allowed to mutate truth or broadcast
knowledge to the roster. Later agent turns also need the player’s exact words and an inspectable
answer to who actually heard them. Prompt-only dialogue would lose both replay integrity and social
causality.

## Decision

- New runs use `engine-v8` with `society-v2`. Immutable v1–v7 histories retain their schemas and do
  not receive communication backfill.
- A communicative act stores speaker, intended audience, exact text, kind, structured topic,
  optional tone, private/open delivery, location, time, actual witnesses, and source event.
- The onboarding slice allows the Master to `explain`, `tell`, or `ask` an available co-located
  hero. Agent-authored responses and order outcomes are not part of `AGT-002`.
- Private delivery has no bystanders. Open delivery includes only active heroes at the Master’s
  location who are not traveling, performing an activity, or following a routine.
- Every actual witness receives a holder-specific communication observation. Questions about hero
  memory create no claim or belief.
- Explanations and statements map their selected topic to one engine-owned structured claim. Exact
  prose remains canonical context, but cannot introduce facts. Told beliefs cite the act’s event,
  the holder’s observation, the Master as source, and chain depth one.
- `social.communicative.act.recorded` persists the bounded post-event `society-v2` projection. The
  reducer recomputes the act, witness set, observations, and beliefs and rejects divergence.
- The summon page provides the first conversation checkpoint before route choice. The replay page
  exposes exact words and the complete event → observation → belief chain.

## Consequences

The player can start teaching a hero immediately without granting omniscient lore or trusting free
text as state. Open speech will naturally gain social consequences as more co-located heroes exist,
while private speech stays private. Later context packets can quote exactly what a hero witnessed;
later policies can respond, refuse, or reinterpret it without changing the historical act.

The initial topic vocabulary is intentionally narrow: Master role, summoning situation, tower
mission, and a question about the hero’s memory. Expanding it requires a new structured claim and
tests, not merely a prompt change.
