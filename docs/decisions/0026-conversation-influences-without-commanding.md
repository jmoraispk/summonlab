# ADR 0026: Conversation influences without commanding

Status: accepted on 2026-08-24.

## Context

Free text is essential to the relationship between the Master and a summoned hero, but it cannot be
trusted as an engine action or a source of world facts. A hero also needs room to accept, negotiate,
defer, or refuse an order according to their own personality, needs, relationship, and view of the
Master. The result must survive offline processing and strict replay without requiring a model call.

## Decision

- New runs use `engine-v9` with `society-v3`. `master.converse` records one exact, witnessed
  `say`, `ask`, or `order` turn as `social.conversation.turn.recorded`.
- Free text is canonical speech, never a command. An order also carries one engine-owned intent:
  train, rest, eat, work, or prepare for the tower. The event does not start an activity, move a
  hero, spend a resource, or otherwise bypass normal legality.
- The prototype resolves orders from six inspectable score groups: authority, relationship,
  personality, value/drive alignment, current needs, and tone. Thresholds produce accepted,
  negotiated, deferred, or refused. The initial exact reply uses the hero's social style and the
  public score reason; a model may later render richer prose without changing the authoritative
  outcome.
- Accepted and negotiated orders become witnessed decision preferences with weights 24 and 12.
  The next decision packet derives these preferences from the conversation event and shows their
  exact text, event provenance, intent terms, and weight. Refused and deferred orders remain in
  memory but add no action preference.
- A preference changes policy scoring only when its intent terms match an already legal action. It
  cannot create an action, target, cost, fact, or state transition.
- Relationship and authority evidence use the target hero's actual communication observation.
  Private/open delivery continues to use the co-location and availability rules from ADR 0021.
- Replay recomputes the communication, response, outcome score, social evidence, and complete
  `society-v3` projection. Immutable v1–v8 histories keep their original schemas and hashes.

## Consequences

The player can speak naturally and immediately see both the hero's voice and the limits of their
authority. Two heroes can answer the same order differently, while later behavior remains traceable
to a witnessed preference rather than hidden prompt magic. The zero-cost path is fully local and
deterministic; richer model-authored dialogue, longer-lived directive lifecycle, and evaluation are
separate later work.
