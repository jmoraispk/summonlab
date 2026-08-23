# Game design

## Product thesis

Summonlab is a leadership RPG about autonomous people. The player can shape conditions, make requests, and build relationships, but cannot directly author a hero's every choice.

The fun should come from three layers interacting:

1. **Systems** create a real problem with legal possibilities and consequences.
2. **Characters** interpret that problem through ability, personality, memory, and relationships.
3. **Leadership** lets the player influence those characters without replacing their agency.

The project succeeds when the player says, “Of course *this* hero did that,” while still being surprised that it happened.

## Candidate game shapes

| Concept | Agent freedom | Prototype cost | Strength | Risk |
| --- | --- | --- | --- | --- |
| Frontier settlement | Very high | Medium | Daily life, politics, building, and emergent relationships | Too many simultaneous systems |
| Expedition company | High | Low | Bounded missions, clear replays, strong party identity | Hub can feel like a menu |
| Endless tower | Medium | Low | Closest to the summoning fantasy and easiest to simulate | Choices may collapse into combat tactics |
| Generational colony | Very high | Very high | Genetics, inheritance, culture, and long-term evolution | Scope overwhelms the agent experiment |

### Recommendation: settlement plus expeditions

Use a frontier settlement as the long-term game and expeditions as the unit of play. The settlement creates continuity and social life. Expeditions create bounded contexts, legal actions, victory conditions, and replayable stories.

Prototype the expedition loop first, then make its survivors residents of a tiny settlement. This preserves the ambitious fantasy without requiring a colony simulator on day one.

## Working world premise: the Unclaimed March

The player becomes Warden of Hearthgate, a ruined keep surrounding an ancient summoning gate. Beyond its walls lies the Unclaimed March, a region abandoned after a network of beacon fortresses failed. A breach now twists wildlife, produces monsters, and gives organized factions room to expand.

The campaign objective is concrete:

1. make Hearthgate self-sustaining;
2. reclaim the roads and nearby settlements;
3. restore the fallen beacons;
4. learn what opened the breach;
5. decide whether to close, control, or transform it.

The gate summons fully realized people, not disposable copies. They arrive with a generated history, values, skills, and expectations. Becoming the Warden does not make the player their owner. Heroes can negotiate service, refuse an order, desert, become loyal, or eventually seek leadership themselves.

### Monster design

Early monsters can be deterministic or scripted to keep agent costs focused on heroes. They should still behave like an ecology rather than random bags of hit points:

- beasts compete for territory and food;
- goblin bands scout, steal, bargain, raid, and retreat;
- corrupted creatures spread the breach into nearby terrain;
- intelligent faction leaders may gain their own agent policies later.

Goblins become more interesting when fighting is only one possible relationship. A settlement might repel one clan, trade with another, and accidentally empower a third.

## Player verbs

The player can:

- summon and recruit;
- speak, listen, persuade, promise, and negotiate;
- declare settlement priorities and policies;
- appoint heroes to authority;
- offer assignments and request volunteers;
- allocate equipment, supplies, housing, and training;
- build and upgrade the settlement;
- choose what information to reveal;
- intervene in disputes;
- accept the consequences when a hero says no.

The player does not select a combat move for every hero or silently rewrite a hero's personality.

## Core loops

### The daily settlement loop

1. **Morning state** — resources, injuries, threats, and unfinished promises update.
2. **Council** — the player communicates priorities; heroes react and propose alternatives.
3. **Commitment** — heroes accept, refuse, negotiate, or volunteer for work.
4. **Activity** — local tasks resolve cheaply; important scenes become explicit turns.
5. **Crisis** — an expedition, raid, dispute, discovery, or opportunity demands attention.
6. **Evening** — memories consolidate, relationships change, and progression resolves.

### The expedition loop

1. choose an objective and provision a party;
2. let heroes negotiate roles and approach;
3. reveal a room, encounter, or dilemma;
4. assemble one independent decision packet per acting hero;
5. validate and resolve choices in initiative order;
6. update injuries, supplies, trust, goals, and memories;
7. return, retreat, succeed, or lose the party.

### Tactical combat

Combat should be turn-based and legible. The engine supplies typed legal actions such as move, strike, defend, assist, use skill, use item, speak, interact, flee, or wait. A hero chooses among them based on the mission, personality, current relationships, and local situation.

Freeform intent can influence action selection and dialogue, but damage, movement, targeting, line of sight, status effects, and resource costs remain deterministic.

## Character generation

### Stable identity

Each hero begins with a reproducible `characterSeed` that expands into several independent layers:

| Layer | Examples | Changes over time? |
| --- | --- | --- |
| Physiology | Height, frame, face, skin, hair, eyes, age, handedness | Slowly or never |
| Heritage | Family origins and inherited appearance ranges | No |
| Culture | Language, customs, naming, education, social expectations | Through exposure |
| Temperament | Big Five-style continuous traits and baseline affect | Slowly |
| Values | Loyalty, achievement, care, tradition, autonomy, power | Through major events |
| Drives | Ambitions, needs, fears, curiosities, unfinished business | Yes |
| Social style | Attachment, trust, conflict, humor, leadership | Through relationships |
| Capabilities | Aptitudes, training, profession, skills, injuries | Yes |
| Personal history | Family, work, formative events, secrets, obligations | Reinterpreted, not replaced |

Traits should produce tendencies, not scripts. High caution can make a hero prepare carefully without forcing them to reject every risk. Courage, loyalty, desperation, and a promise to a friend may outweigh it in a specific scene.

### Physicality, heritage, and representation

The first generator should model humans with broad visual variety while avoiding false biological claims.

- Use fictional regional heritage and family traits to generate coherent appearance ranges.
- Keep culture separate from inherited physical traits.
- Keep personality, intelligence, morality, rarity, and talent independent from ethnicity and skin tone.
- Derive physical modifiers only from explicit physiological variables such as height, frame, age, conditioning, injury, and training.
- Treat sex characteristics, gender identity, presentation, and social role as related but separate fields.
- Describe the system as procedural character generation, not a scientifically accurate genetics simulator.

For the initial prototype, physical variation can affect portrait construction and a small number of transparent mechanics such as reach, carry capacity, or movement profile. It should not create hidden “better ancestry” outcomes.

### Personality representation

Store numeric or categorical traits as game data, then translate them into a short behavioral character card for the policy. A useful initial model includes:

- five continuous temperament dimensions;
- six to ten ranked values;
- two major motivations and one fear;
- risk, empathy, trust, and conflict tendencies;
- one moral boundary and one possible compromise;
- a stress response;
- a current emotional state;
- relationship-specific trust, affection, respect, fear, and resentment.

The policy should receive both stable identity and current state. “Patient by nature, frightened right now” is more lifelike than changing the stable personality whenever the mood changes.

## Summoning and pity

### Rarity

Use a one-to-five-star starting rarity. Rarity can influence initial aptitude budget, unusual skills, or gate resonance. It must not determine personality depth, moral value, maximum star rank, or whether a character deserves narrative attention.

Every summoned character is procedurally unique. The system therefore does not need exact hero duplicates. Repeated archetypes remain different people.

A banner features generation tags rather than a named individual: for example, a vocation aptitude, regional origin, skill family, or unusual gate resonance. A featured result is still a new person; it simply guarantees that the generated hero matches at least one advertised tag.

### Pity state

Pity belongs to the authoritative account state and updates in the same transaction as a summon:

```text
banner family
pulls since 4★+
pulls since 5★
soft-pity progress
featured guarantee
lifetime summons
last summon receipt
```

Illustrative prototype defaults:

- at least 4★ every 10 summons;
- 5★ soft pity begins at 40;
- 5★ hard pity at 50;
- missing the advertised generation theme guarantees that the next 5★ matches it;
- pity carries between banners in the same family;
- the UI shows the counters and guarantee state before every summon.

These are tuning values stored in banner configuration. They are not hard-coded rules. The prototype should use earned currency and avoid monetization until the game is independently fun and its ethical boundaries are explicit.

## Progression and common evolution

All playable species should eventually implement the same progression contract:

1. **Level** improves learned competence.
2. **Vocation** develops the role the character practices.
3. **Conviction** emerges from an ambition, value, or vow tested by events.
4. **Bond** unlocks cooperation built through actual relationships.
5. **Ascension** increases star rank after meaningful achievements.
6. **Legacy** leaves a permanent mark on the settlement or future roster.

A low-rarity recruit can ascend to the same final star rank as a rare summon. The rare hero begins with more or stranger possibilities; the common hero's advantage is that the player watched those possibilities grow.

Future species add a physiology and cultural template without replacing this progression contract. A human scout, goblin diplomat, and awakened construct can all form bonds, choose vocations, develop convictions, and ascend.

## Conversation and influence

Conversation is an action system, not an unrestricted chat window glued to the side of the game.

An influence scene has:

- a concrete request or topic;
- a speaker and audience;
- time and location;
- relevant facts and secrets;
- trust, authority, leverage, and urgency;
- remembered promises and previous attempts;
- a bounded result: accept, counter, delay, refuse, deceive, or end the conversation.

The agent writes a brief player-facing intent and the hero's spoken response. The engine applies the result and costs. Repeating a request can reduce patience. A threat can create compliance and resentment. A kept promise can improve future trust. A hero may agree to the goal but propose a different plan.

Player text is in-world speech, never a hidden system prompt. Attempts to tell a hero to ignore the rules remain dialogue that the character can interpret; they cannot alter the policy instructions or engine state.

## First vertical slice

### Content

- Hearthgate with a gate, hall, workshop, and palisade;
- three generated human heroes;
- four broad vocation kits;
- one council scene;
- one contested assignment;
- a three-room ruin expedition;
- one social dilemma;
- one goblin raid;
- one ascension opportunity;
- complete replay and context inspection.

### Questions it must answer

- Can players distinguish the three personalities from behavior alone?
- Do heroes make competent choices often enough to remain trusted?
- Does refusal create strategy and drama rather than irritation?
- Can the engine explain why an action was legal and why it resolved as it did?
- How many model calls and tokens does one satisfying expedition consume?
- Does context management preserve continuity across independent requests?

## Open design decisions

- Is death permanent, recoverable, or configurable?
- Are summons drawn from possible histories, created by the gate, or transported from real places?
- Can a hero permanently leave the settlement?
- How much authority can heroes gain over construction and policy?
- When do monsters become recruitable or agent-controlled?
- Should the campaign be authored, procedural, or a hybrid?
- Does the player have an embodied character who can travel, or only lead from Hearthgate?
