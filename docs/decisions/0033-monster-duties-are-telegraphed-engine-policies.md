# ADR 0033: Monster duties are telegraphed engine policies

Status: accepted on 2026-08-24.

## Context

`engine-v12` resolved independent party actions but left monster actions empty. Rendering enemies or
damage only in the browser would create a second combat authority, while asking a model to control
routine goblins would add cost and nondeterminism without useful agency. Players also need to see
what deterministic enemies intend before committing a Master action. Floor 05 will need a stronger
Foundry Warden, but its reusable mechanics should be fixed before that floor is authored.

## Decision

- New runs use `engine-v13` and `mission-turn-v2`. Existing v1–v12 state and event schemas remain
  immutable and replay under their original rules.
- Mission attempts bind the immutable `monster-policies-v1` catalog by version and SHA-256. Floor
  packages reference policy ids and duty slots; they do not execute enemy mutations.
- Deployment draws only the package-declared goblin count purposes and creates stable monster ids,
  authored duty nodes, vitality, alert state, and initial public threat intents.
- Chain watchers guard the Chain Court. Ember haulers protect the cradle, raise an alarm when first
  challenged, and pursue a visible carrier only along open authored edges. They never infer a
  concealed route from authoritative truth the party has not exposed.
- Threat intent is derived from the current canonical state and shown before the player commits.
  Each round verifies that telegraph, ranks party and monster actors in one seeded initiative
  ledger, and records movement, alarm, strikes, defenses, vitality, guard, and superseded actions.
- Combat uses bounded mission guard for this slice. Guard can become exposed, but injury,
  permadeath, and Master game-over integration remain `MIS-008` and `MIS-009` rather than being
  partially simulated.
- The Foundry Warden policy is versioned now with furnace-linked armor, a furnace surge, and
  cooling-control defense. Floor 05 placement, topology, and confrontation content remain
  `MIS-005`.
- `mission.round.resolved` stores every threat, ranked action, effect, entropy draw, and resulting
  mission state. Strict replay re-derives the policy result and rejects telegraph, effect, or state
  drift.

## Consequences

Floor 01 goblins now act without model calls or client authority, their intentions are readable
before commitment, and attacks share the same replayable sequence as hero choices. The tactical
board can render active enemies, mission guard, declared threats, and resolved effects directly
from server state. The deliberately nonlethal guard boundary keeps this slice honest until the
later aftermath and death tasks connect combat to persistent bodies.
