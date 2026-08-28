# 0055 — Owner feedback centers the game on summoning

**Status:** Accepted

**Date:** 2026-08-27

## Context

The first owner playthrough reached Hearth and the prototype Floor 01 return but stopped before the
full checklist. The experience exposed its systems before establishing a believable summoning,
clear player purpose, or contextual relationship with the summoned people. Simplified procedural
rigs replaced the expected realistic character presentation, an automatic walk separated summoning
from the settlement, and the First Ember choice appeared without a visible mission or return.

The owner liked the Hearth background and the legibility of different people occupying the gate and
training areas. That spatial foundation should remain.

## Decision

- Realistic, polished character identities are required on player-facing character and conversation
  surfaces. Deterministic rigs remain useful for small positional animation, not as the primary
  portrait experience.
- Pre-generate manifest-bound anchors for the default company now. A later on-demand pipeline must
  bind output to the immutable manifest, preserve identity across variants, cache approved results,
  expose generation state honestly, and retain a polished fallback when generation is unavailable.
- Consolidate the opening around the summoning gate: establish the goal, explicitly summon three
  heroes, show their arrival, then let the player select each person to inspect skills, personality,
  and first conversation.
- Remove the automatic Hearth walking interlude. Entering the settlement should preserve context
  from the gate and the player's explicit first direction.
- Returning from a mission should be visible at the portal. A hero who wants to speak should have a
  subtle non-textual signal that opens contextual chat, where the player may issue an order and the
  agent may obey, refuse, question, or request an explanation.
- Do not present the First Ember as an abstract button-and-bonus choice. Establish what it is, show
  how it was recovered, and connect the permanent settlement decision to the returning people and
  their reactions.
- Add settlement pan and zoom, selectable inhabitants, and live activity feedback. Concurrent
  actions may train multiple relevant skills, and experience gains should be visible without
  becoming canonical animation state.

## Consequences

- The current owner session remains stopped with release-blocking findings; generating portraits is
  a corrective slice, not proof that the full experience is ready.
- The next playable slice should end at a coherent gate-to-Hearth interaction before expanding the
  mission surface.
- Right-click may be an additional desktop affordance, but ordinary click/tap remains required so
  the same character inspection works on phones.
- Camera controls and activity telemetry build on the approved Hearth map instead of replacing it.
