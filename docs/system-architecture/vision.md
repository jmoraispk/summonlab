# Vision and product rules

## Player fantasy

The player is the Master of a growing settlement built around a summoning gate. The Master does not
need to become the strongest hero or risk the campaign on every tactical round. Their power is
attention, provision, coordination, communication, and control over a few irreversible civic
systems: summoning, construction, expedition authorization, and synthesis.

The emotional loop is:

```text
summon a stranger
→ learn who they are
→ give them a place in the town
→ watch relationships, habits, and competence grow
→ form parties and weigh their own advice
→ send them into danger
→ live with who returns and what the town becomes
```

The Master can inspect and listen to every canonical event in the owned town and connected
expeditions. That omniscience is a player affordance, not shared telepathy. World truth, Master
awareness, and each hero's beliefs are separate projections.

## Product pillars

### People, not units

A hero is never reducible to rarity, combat power, or a portrait. They have a stable identity,
independent choices, needs, habits, knowledge, relationships, work, and a history. Rarity changes
starting capacity, not eventual human worth. A generated person is not a disposable duplicate.

### Authority without puppetry

The Master controls circumstances and exclusive civic actions. Heroes can accept, question,
negotiate, delay, refuse, recommend, warn, and ask. A legal action chosen by an agent is still
validated by the deterministic engine. Personality changes propensity and expression, never engine
legality.

### A town that creates behavior

Buildings are behavioral technology. They add capacity, reduce friction, create schedules, bring
people together, enable skills, and expose new decisions. Expansion should change what heroes can
do and whom they meet, not merely raise passive percentages.

### Preparation matters more than grinding

Tower difficulty tests skill coverage, formation, knowledge, equipment, recovery, and judgment as
well as level. Parties can recommend advancing or preparing. Raw level is guidance, not an entry
lock, and high level cannot erase authored hazards or missing knowledge.

### Authored truth, variable lives

The tower can be randomized, but its rules, geometry, rewards, secrets, and story anchors are
reviewed content. A campaign seed composes compatible envelopes and catalogs into a hash-bound plan.
Runtime story direction selects eligible authored truth and casts living, knowledgeable heroes into
it. It does not invent mechanics through prose.

### Consequences persist

Injury, equipment wear, death, synthesis, promises, discoveries, resource use, construction,
relationships, and story changes enter the event log and survive reload. The player journal makes
those consequences legible without replacing the authoritative record.

### Depth on demand

The town can hold up to 1,000 persistent heroes, but only a small set should demand attention at
once. The player can focus on anyone and find a coherent person; leaders, councils, parties,
petitions, filters, and simulation temperatures prevent the game from becoming an inbox or model
cost simulator.

## World shape

Summonlab has four connected spaces:

| Space | Role | Persistence | Primary pressure |
| --- | --- | --- | --- |
| Hearth settlement | Home, work, training, relationships, construction | Continuous | Time, capacity, needs, trust |
| Hundred-floor tower | Finite campaign objective | Floor and band progress | Escalating authored tests |
| Temporary portal worlds | Resource and rule excursions | Attempt-local until extraction | Deadline, cargo, unusual hazards |
| Neighbor network | Persistent external settlements reached after airship | Long-lived routes and relations | Distance, logistics, diplomacy, discovery |

The summoning gate, tower threshold, portal chamber, synthesis chamber, and airship dock may share
visual motifs, but they are different domain apertures. Each has its own eligibility, transaction,
and receipt.

## Hero model

Keep these layers independent:

| Layer | Examples | Change rate | Owner |
| --- | --- | --- | --- |
| Identity | name, body, face, voice, culture fragments | nearly immutable | Character |
| Visual state | attire, equipment, tattoos, piercings, scars, injury overlays | event-driven | Character + Presentation |
| Personality | trait scores, value, drive, social style, risk tendency | slow | Character cognition |
| Affect | mood, stress, confidence, dominant concern | fast, decaying | Affect |
| Goals | protect party, master a skill, gain leadership, explore | episodic | Goals/agency |
| Habits | cue-bound routines | frequent learning | Simulation |
| Capability | attributes, levels, skills, mastery, promotion | earned | Progression |
| Knowledge | observations, beliefs, memories, rumors | event-derived | Society |
| Relationships | trust, fear, affection, resentment, authority evidence | event-derived | Society |

Body features never derive from personality. Cultural/era visual packs never imply aptitude,
morality, rarity, or obedience. Medieval, nomadic, Viking, contemporary, magitech, desert,
celestial, Gothic, seafaring, eastern mythic, post-apocalyptic, and alien visual languages reuse the
same identity and anatomy rules while providing different content catalogs.

## Progression shape

Target star caps:

| Rank | Level cap | Campaign role |
| ---: | ---: | --- |
| 1★ | 10 | entry and first promotion |
| 2★ | 20 | early tower competency |
| 3★ | 30 | specialist foundation |
| 4★ | 40 | mature early-game build |
| 5★ | 50 | advanced finite-campaign build |
| 6★ | 99 | late-campaign mastery range |
| 7★ | 999 | long-tail mastery and postgame headroom |

This is a capacity curve, not a promise of linear power. Content compares a versioned effective
power/readiness projection, not raw level. Levels above each order-of-magnitude threshold should
provide diminishing direct stats and more build expression, reliability, mastery, or specialization.

Skills are a graph rather than a fully visible tree. Atomic skills can be learned, practiced,
taught, equipped, and fused. Fusion results preserve recognizable mechanics from their inputs and
obey a tier budget, prerequisite rules, costs, incompatibilities, and a content hash. A development
workshop may propose recipes; runtime generation only instantiates validated templates.

## Synthesis thesis

Synthesis is a morally and strategically consequential shortcut:

- it permanently ends one hero;
- it can grant bounded experience, essence, a compatible skill fragment, or affinity reinforcement;
- it cannot transfer personality, memory, relationships, exclusive knowledge, or a complete skill;
- it is never required for promotion;
- repeated use has diminishing returns and social costs;
- a newly summoned feeder must be worth less than the summon resources used to create them;
- over a long horizon, keeping the source hero provides greater total value through work, teaching,
  coverage, relationships, knowledge, and their own growth.

The interface tells the truth about the immediate receipt and permanent loss. It does not announce
the global strategy. The player can discover that retention is stronger by comparing histories,
watching other Hearths fail, and living with second-order effects.

## Failure and stakes

Hero death remains permanent. Synthesis remains permanent. Ordinary tower and portal expeditions no
longer require the Master as a tactical body. A new campaign-loss condition must be designed around
the town Master: likely destruction or severing of the Hearth core, rather than ordinary party
death. Existing mortal-Master runs retain their historical rules.

Failure should create recoverable stories until an explicit campaign terminal event occurs. A
party may retreat, lose equipment, lose a route, bring back trauma, or fail a deadline without
silently ending the entire run.

## Product guardrails

- No model, renderer, or client directly mutates game state.
- No subsystem grants its own reward for consuming another subsystem's state.
- No personality inference from body, culture, gender, rarity, or visual style.
- No secret becomes known without an evidence path.
- No generated prose creates geometry, combat effects, rewards, or historical facts.
- No premium spend occurs without an idempotent receipt containing odds and pity versions.
- No synthesis is hidden behind generic inventory-cleanup language.
- No 1,000-agent claim is accepted without a deterministic scale benchmark.
