# Heroes, personality, society, and visuals

Status: **core identity/society foundations proven; affect, goals, petitions, and scale are new**

Primary owner: hero cognition and cross-surface identity

## Player promise

Every hero is a stable, recognizable person whose behavior changes for understandable reasons. The
Master can focus on any resident, see what they are doing, talk to them, and receive requests or
recommendations without controlling their inner life.

## Owns

- immutable manifest and stable personality inputs;
- mutable affect and durable goal lifecycle;
- observations, beliefs, memories, relationships, promises, authority, and communication;
- typed hero petitions and Master response history;
- one `HeroPresentationState` across all visual surfaces.

Implementation may keep these in several domain packages. This brief owns their product contract,
not a single giant aggregate.

## Does not own

- legal mission/building/progression choices;
- body mechanics inferred from personality;
- omniscient hero knowledge;
- art pixels as canonical game state;
- a model-authored mutation of mood, goal, memory, or relationship.

## Cognition layers

Stable personality covers trait scores, value, drive, social style, stress response, and risk or
leadership tendencies. Slow state covers convictions, loyalties, aspirations, and long goals. Fast
affect covers bounded valence, arousal, stress, confidence, social need, and a dominant concern.
Mood decays or recovers deterministically from source events and time.

A model can select an allowed expression or propose a typed goal. The engine decides whether the
goal is adopted and applies affect deltas. Presentation derives expression, gaze, gesture, and
posture from canonical affect without writing it back.

## Requests and recommendations

Petitions include requests, recommendations, warnings, and reports. Legal triggers come from the
owning system; personality changes propensity and framing.

Examples:

- a leader recommends Floor 71 with evidence about skills, injuries, gear, and known pressure;
- a cautious member recommends training on Floor 70;
- a reserved hero asks a leader or friend to raise an equipment concern;
- a specialist requests a workshop module, teacher, rest, reassignment, or conversation.

The Master may acknowledge, ask, accept, decline, defer, or counter. Responses become social
evidence. Accepting submits an ordinary command to the owning domain.

For 1,000 heroes, leaders/councils aggregate duplicates, material-change thresholds suppress repeat
petitions, and the inbox clusters low-urgency items. High level can improve evidence quality and
social weight but is not the permission to speak.

## Motivation and purpose

Motivation is a derived, inspectable interaction among goals, perceived progress, challenge fit,
autonomy, social belonging, leadership, facility access, fatigue, stress, and expected reward. It is
not a hidden obedience or productivity score.

Heroes may train hard when they understand a credible objective, see progress, trust the plan, have
appropriate challenge and recovery, identify with their party, or learn from a respected mentor.
They may idle, avoid training, or become bored when purpose is missing, work is under- or
over-challenging, feedback is absent, facilities are blocked, fatigue is high, or the surrounding
culture rewards something else. Petitions and conversations should surface those causes so the
Master can redesign the system rather than directly toggle behavior.

## Visual identity

The canonical manifest separates body/face/voice, attire/culture packs, durable marks, and render
assets. Tattoos, piercings, scars, hair, clothing, equipment, injury, and evolution have explicit
slots. Cultural and technological packs change clothing, materials, gesture vocabulary,
architecture, and props without implying phenotype, personality, aptitude, or rarity.

Realistic approved portraits anchor summon, roster, dialogue, and high-value scenes. Small
approved authored small-scale assets preserve silhouette, hair, palette, signature attire, equipment, and gait in
the base and missions. The same presentation state feeds training, synthesis, story, and memorials.

## Interfaces

Consumes:

- source events, occupancy/witness references, scheduled time, legal actions, and presentation
  overlay inputs from progression/equipment/injury;
- party role/readiness and domain options for petitions.

Publishes:

- holder-owned decision context;
- affect/goal/petition/communication/social events;
- ranked Master inbox;
- cross-surface hero presentation state.

## Invariants

- World truth, Master awareness, and hero belief are different projections.
- A private fact has a holder/provenance path.
- Stable body/culture dimensions never derive personality or moral value.
- A policy never sees another hero's private state without evidence.
- A model-selected proposal is not canonical until validated and accepted.
- Every visible hero uses the same manifest and lifecycle overlays.
- Cold simulation reduces resolution frequency, not identity or permanence.

## Roadmap

1. Define affect, goal, petition, witness-set, and presentation-state contracts.
2. Prove one hero request and full Master response lifecycle in Hearth.
3. Add leader readiness recommendation with holder-specific evidence.
4. Add tattoos, piercings, scars, and culture/attire pack separation to visual manifests.
5. Implement hot/warm/cold context and petition prioritization.
6. Pass the 1,000-hero social/evidence benchmark and cross-surface recognition gates.

## Feedback ledger

| Date | Status | Feedback | Consequence |
| --- | --- | --- | --- |
| 2026-08-29 | accepted | Body features belong to visuals; personality supplies agent context and mood. | Separate manifest/presentation from cognition/affect contracts. |
| 2026-08-29 | accepted | Higher-level leaders often suggest floors, but any personality may request things. | Typed petitions use leadership/experience as evidence and personality as propensity. |
| 2026-08-29 | accepted | Realistic people, varied eras/cultures, tattoos and piercings are allowed. | Extend explicit visual slots and content packs; retain identity locks. |
| 2026-08-29 | accepted | Support up to 1,000 agents without daily interaction from all. | Use hot/warm/cold simulation and clustered attention. |
| 2026-08-29 | accepted | The game is fundamentally about designing systems that motivate agents toward useful goals. | Make purpose, challenge, feedback, mentorship, schedules, and social norms causal; preserve boredom and idleness as real outcomes. |
| 2026-08-29 | accepted | Unequal starting talent never removes a person's worthwhile place; systems should find useful work and develop unique contribution. | Preserve intrinsic dignity, revisable roles, growth, preferences, and quiet institutional value without a player-facing IQ, any worth stat, or permanent caste. |

## Open decisions

- How visible should numerical mood be versus expressive cues and explanations?

## Existing foundations

Start with ADRs 0002, 0005, 0015, 0020–0029, 0041, 0048, 0055; character/social/visual
contracts; decision packets; the [personhood principle](../../wiki/principles/every-person-contributes.md);
and the current art bible and recognition audits.
