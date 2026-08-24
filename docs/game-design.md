# Game design

## Product thesis

Summonlab is a tower-climbing leadership RPG about people who happen to be summoned.

The player controls the Master directly and shapes everyone else's circumstances. Heroes receive information, form habits, build relationships, and make their own choices inside deterministic game rules. The design succeeds when a hero's behavior feels surprising in the moment and inevitable in retrospect.

## The game shape

Three spaces create the complete loop:

| Space | Purpose | Time pressure | Primary agency |
| --- | --- | --- | --- |
| Walled settlement | Continuity, routines, jobs, training, construction, relationships | Continuous accelerated time | Master and resident heroes |
| Hundred-floor tower | Campaign progress, combat, promotion gates, secrets | Mission time | Master and selected party |
| Portal worlds | Time-limited resources, unusual rules, optional discovery | Portal duration | Master and selected party |

The settlement does not expand across a strategic world map. It can become denser, deeper, safer, and more capable inside its walls. Travel destinations remain explicit: tower, temporary portal world, or another discovered settlement.

## Campaign objective

The campaign begins at floor 1 and ends when the Master clears floor 100 or dies.

- Floors are grouped into twenty five-floor bands.
- Each band adds a difficulty tier, environment, enemy family, or systemic constraint.
- Floors ending in `5` are band tests or minibosses.
- Floors ending in `0` are major bosses, story gates, and promotion-material sources.
- Floor 100 is the campaign climax.

An endless mode is postgame scope. The finite tower comes first because it provides pacing, a measurable goal, and an ending worth balancing.

### Tower objectives

The tower assigns a mission objective when a floor opens:

- eliminate a target;
- survive for a duration;
- protect a person or object;
- recover an item;
- reach an exit;
- discover a hidden truth;
- solve a spatial or social condition.

The engine generates the objective, legal interactions, secret triggers, and rewards. Heroes can attempt unexpected legal actions, but their narration cannot create a door, treasure, or Easter egg that the seed did not contain.

### Five-floor story arcs

Every five-floor band carries a designed story spine as well as a difficulty tier. The usual rhythm is setup, complication, division, consequence, and payoff. Objectives can change from floor to floor, but the band should leave one coherent change in the settlement, party, or understanding of the tower.

A development-time narrative agent may propose band arcs from the world bible and mechanics. Accepted arcs become reviewed, versioned content. At runtime, agents adapt eligible dialogue and reactions to the actual party, relationships, habits, and goals; they cannot create new plot facts or consequences outside the engine-owned beat graph.

This makes the hundred-floor campaign twenty comprehensible arcs rather than one hundred unrelated procedural missions.

### Hidden paths and Easter eggs

Secrets reward personality and experimentation without depending on hallucination.

A floor can contain hidden triggers such as:

- inspect a specific surface;
- wait instead of taking the obvious action;
- speak to an enemy;
- combine two ordinary items;
- revisit a room after a condition changes;
- use an inconvenient skill;
- follow environmental evidence.

The legal-action generator only reveals an explicit secret after its trigger. Before that, it can expose ordinary actions such as inspect, listen, test, speak, wait, or interact. Curious, patient, suspicious, playful, or habitually thorough heroes may choose them more often.

## The settlement clock

The first timing target is `4×` real time:

```text
1 real minute = 4 game minutes
1 real hour   = 4 game hours
6 real hours  = 1 game day
```

The server owns time. Closing the app does not pause routines, jobs, healing, training, social contact, mission timers, or queued decisions.

The multiplier remains configuration. Testing should compare `2×`, `4×`, and `8×` for pressure, cost, sleep disruption, and how often players return to a settlement they no longer recognize.

## Core loops

### Daily settlement loop

The loop stays deliberately small:

1. **Wake and plan** — each hero makes one agent-authored daily plan from needs, habits, orders, relationships, and available places.
2. **Live** — the habit engine executes routine actions such as eating, sleeping, working, training, idling, and socializing.
3. **Interrupt** — blocked routines, player orders, conflict, emergencies, and opportunities open new decision windows.
4. **Mission** — the Master sends a party to the tower or a portal world, optionally joining them.
5. **Reflect** — memories, habits, relationships, learning, injuries, and rumors update.

The player can spend as much attention as desired. Micromanagement creates more requests, conversations, and social consequences; neglect gives agents more room to follow their own plans.

### Mission loop

“Mission” is the common term for tower and portal play:

1. choose or receive an objective;
2. select willing or ordered participants;
3. provision equipment and consumables;
4. travel through the tower gate or portal;
5. resolve turn-based encounters and travel decisions;
6. discover, extract, complete, retreat, or die;
7. return resources and consequences to the settlement.

Tower missions advance the campaign. Portal missions gather materials and expose optional worlds with different hazards, resources, cultures, and temporary rules.

### Master loop

The Master is an embodied hero controlled directly by the player.

The Master can:

- move freely inside the settlement;
- travel only to available tower floors, temporary portal missions, or known settlements;
- fight and train using the same attributes and skills as other heroes;
- speak, persuade, order, reward, threaten, explain, and apologize;
- summon and synthesize heroes;
- trigger construction;
- choose personal power over settlement administration.

Only the Master can begin construction. Other heroes can suggest buildings, gather materials, design upgrades, operate facilities, and complain about priorities.

## Authority without automatic obedience

A fresh summon does not know what “Master” means. Authority is a belief learned from the environment and social network.

A hero can recognize several kinds of authority independently:

- **formal** — the gate or settlement rules designate the Master;
- **material** — the Master controls food, shelter, equipment, and construction;
- **competence** — the Master makes decisions that work;
- **strength** — the Master can personally enforce or protect;
- **relational** — the hero trusts, admires, fears, loves, or owes the Master;
- **social** — respected peers treat the Master as legitimate.

An order enters the hero's context as an in-world request with source, tone, urgency, and consequences. The hero can accept, question, counter, delay, pretend, or refuse when rules allow.

Heroes cannot permanently remove themselves from the roster. They may resist, hide, refuse work, or damage relationships, but their terminal roster exits are death and synthesis.

## Habits and environmental constraint

### Why habits are separate from personality

Personality influences what feels attractive. Habit records what repeated behavior has become easy in a particular context.

A cautious hero may not begin with a stretching routine. If stretching after waking repeatedly reduces pain before training, the cue-response-reward loop can become strong even if caution later changes.

### Habit record

```text
cue
  time window · location · preceding action · need · emotion · social presence

routine
  legal action or short action sequence

strength
  learned automaticity from 0–100

reward history
  need relief · progress · approval · comfort · pleasure · social outcome

friction
  distance · injury · missing building · missing tool · order conflict · danger
```

### Habit resolution rules

1. The engine determines what the environment affords.
2. Mandatory needs and active emergencies can override routine.
3. A strong matching cue places the habitual action near the top of the local policy.
4. Personality, goals, relationships, orders, and current emotion modify—but do not erase—the habit score.
5. Repetition under a stable cue strengthens the habit.
6. Repeated interruption, poor outcomes, or unavailable infrastructure weakens it.
7. A model call is required when the hero must form a plan, choose between meaningful goals, interpret an order, or react to novelty; routine execution stays local.

Initial habit actions include:

- sleep;
- eat or prepare food;
- work an assigned job;
- train or practice a skill;
- stretch or exercise;
- maintain equipment;
- seek a particular person;
- socialize with available peers;
- rest, wander, observe, or laze around.

### Buildings as behavioral technology

Buildings change behavior by changing affordances and friction:

| Building | New or easier behavior |
| --- | --- |
| Dormitory | Regular sleep, privacy, roommate interaction |
| Kitchen | Cooking, shared meals, food routines |
| Training ground | Exercise, sparring, instruction, measurable practice |
| Workshop and forge | Mining refinement, crafting, repair, experimentation |
| Infirmary | Treatment, recovery, rehabilitation, medical learning |
| Social hall | Group meals, gossip, celebrations, disputes |
| Library or archive | Study, research, memory records, magic theory |
| Portal chamber | World selection, mission preparation, extraction |
| Synthesis chamber | Terminal conversion of a hero into growth resources |

The Master may create a disciplined culture by building schedules and facilities, or a chaotic one by providing little structure and intervening inconsistently.

## Clean-slate character generation

### What a new hero has

- a stable human physiology;
- an adult age sampled for the first prototype from a truncated normal distribution centered near 25;
- a visual and vocal identity;
- latent attribute ranges and skill affinities;
- a starting temperament;
- initial needs and emotional capacity;
- fragments of language, custom, gesture, taste, and cultural intuition;
- no autobiographical memory of where those fragments came from;
- no knowledge of the settlement, tower, portals, other heroes, or Master;
- no automatic belief that the Master has authority.

The first conversation is onboarding, not flavor text.

The prototype uses adult summons only, with ages bounded from 18–42. Age can affect appearance, recovery, bodily wear, and plausible skill exposure, but never directly determines intelligence, morality, obedience, or worth. The exact age may initially be unknown in-world even though the physical manifest remains deterministic.

### What can change

| Layer | Rate of change |
| --- | --- |
| Physiology | Static except major promotion, evolution, injury, or aging |
| Temperament | Slow drift from repeated stress and experience |
| Values | Major events, relationships, and costly choices |
| Drives | Goals can emerge, complete, fail, or be replaced |
| Social style | Learned through success, rejection, hierarchy, and attachment |
| Habits | Frequent cue-bound reinforcement and decay |
| Capabilities | Practice, teaching, facilities, missions, and promotion |
| Knowledge | Observation, conversation, records, and memory |

Stable traits should bias behavior without becoming hard-coded caricatures. Current needs, fear, injury, trust, orders, and environment can outweigh baseline temperament.

### Representation boundaries

- Inherited family traits influence coherent appearance ranges.
- Culture separately influences language fragments, gesture, clothing, naming, and taste.
- Personality, intelligence, morality, rarity, talent, and obedience remain independent from ethnicity and skin tone.
- Physical mechanics derive only from explicit physiology, training, injury, and equipment.
- The system is procedural character generation, not a claim of scientifically exact human genetics.

## Attributes and skills

### Minimal attribute proposal

| Attribute | Covers | Example roles |
| --- | --- | --- |
| Might | Force, lifting, melee power | Sword fighter, miner, builder |
| Vigor | Health, stamina, resistance | Guardian, laborer, explorer |
| Agility | Speed, coordination, precision | Archer, scout, craftsperson |
| Focus | Mana control, concentration, technical execution | Mage, alchemist, smith |
| Insight | Perception, learning, memory use, diagnosis | Researcher, healer, explorer |
| Presence | Persuasion, leadership, performance, intimidation | Leader, negotiator, trainer |

Insight must not make a model “smarter” or “dumber.” It changes game checks, learning speed, perception, and available information. The same policy still chooses for every hero.

### Skills

Skills are learned proficiencies such as sword fighting, bow fighting, shield use, mining, cooking, brewing, smithing, medicine, construction, stealth, survival, teaching, and schools of magic.

Anyone can learn any non-exclusive skill. Learning rate depends on:

- attribute fit;
- innate affinity;
- teacher skill and relationship;
- facility and tool quality;
- habit strength and practice consistency;
- fatigue, injury, stress, and available time;
- real mission experience.

## Summoning, rarity, and pity

### Summon channels

Initial probability proposal:

| Result | Ordinary gate | Focused gate | Milestone summon |
| --- | ---: | ---: | ---: |
| 1★ | 85.00% | 60.00% | 0% |
| 2★ | 14.50% | 37.00% | 0% |
| 3★ | 0.49% | 2.90% | 100% |
| 4★ | 0.01% | 0.10% | 0% |
| 5★–7★ | 0% | 0% | 0% |

Values are tuning configuration. The important shape is common `1★–2★`, special `3★`, anomalous natural `4★`, and promotion-only `5★–7★`.

Pity counters remain visible and transactional. A draft configuration can guarantee `2★+` after ten ordinary pulls, `3★+` after a long configurable drought, and preserve a separate anomaly meter for `4★`. Milestone summons provide known `3★` results rather than named duplicate heroes.

### What stars mean

Stars represent current resonance capacity:

- level cap equals `star rank × 10`;
- each promotion unlocks one growth choice, skill slot, or passive capacity;
- higher star rank supports more complex magic and equipment effects;
- major promotions can change physiology or visual form;
- all heroes can eventually reach `7★` and level 70;
- summon rarity changes the starting distance, not the final human value.

A natural `3★` starts at level 1 with a level-30 cap and two promotion thresholds already open. A `1★` starts with a level-10 cap and must earn every promotion.

### Promotion

At each ten-level cap, promotion requires some combination of:

- tower-gate material;
- portal-world resources;
- demonstrated skill or mission achievement;
- training time;
- synthesis essence.

Promotion raises the cap and presents an evolution choice. It does not reset memories, relationships, habits, or identity.

## Synthesis

Synthesis consumes one hero permanently and grants bounded growth resources to another hero.

Possible outputs include experience, promotion essence, a compatible skill fragment, or affinity reinforcement. It should never copy a full personality or memory into the recipient.

### Social consequences

Synthesis emits a canonical event with an explicit visibility model:

1. direct witnesses know what happened;
2. close relationships notice the missing hero;
3. operators of the chamber know who entered;
4. witnesses can tell others during social contact;
5. rumors preserve source and confidence rather than granting magical knowledge;
6. the recipient knows what the rules and scene make observable;
7. the roster changes trust, fear, resentment, ambition, obedience, and habits according to values and relationships.

Secret synthesis is possible, but unexplained disappearances remain socially meaningful. The game must not hide the moral cost merely because the player gained experience points.

## Death, failure, and run structure

- Hero death is permanent.
- Synthesis is permanent.
- The Master can die in settlement, tower, or portal play.
- Master death ends the run and requires a restart.
- Replays remain available after game over.
- Meta-progression, if any, must not erase the meaning of death; it can unlock knowledge, starting options, or visual records rather than resurrecting the run.

Permadeath creates real stakes, but the first slice should measure whether frequent restarts teach the player or merely waste time.

## Monster autonomy

Most monsters use deterministic utility, state-machine, or behavior-tree policies driven by immediate needs and duties. They do not need language-model calls.

Examples:

- patrol;
- guard;
- hunt;
- flee;
- protect young;
- gather;
- obey a commander;
- investigate noise;
- use a known combat tactic.

Later intelligent or awakened monsters can implement the same agent policy interface as heroes. Awareness becomes a content feature, not the default cost of every enemy.

## First vertical slice

### Content

- Master and three clean-slate human heroes;
- five settlement buildings;
- `4×` continuous clock;
- one daily plan call per hero;
- deterministic habit execution and interruption;
- six attributes and a small skill library;
- tower floors 1–5 with one hidden path;
- one mining portal mission;
- hero and Master permadeath;
- star caps through `2★` promotion;
- one synthesis decision and rumor chain;
- replay and context inspection.

### Questions it must answer

- Do habits make offline behavior coherent rather than random?
- Can players understand why a hero obeyed or refused?
- Does clean-slate onboarding feel intriguing after repeated summons?
- Is one daily model plan per hero enough to preserve agency?
- Do tower secrets reward experimentation without model hallucination?
- Does synthesis create meaningful tension instead of routine inventory cleanup?
- Is `4×` time fast enough to feel alive and slow enough to lead?
- Does Master permadeath motivate care or only encourage restarts?
- What is the token and latency cost per real day for a growing roster?

## Deferred decisions

- Exact pity thresholds beyond the first prototype.
- Whether the simulation pauses during server maintenance or catches up later.
- How much a major promotion can alter physiology.
- Whether the Master can delegate construction initiation later.
- How heroes resist forced synthesis at the scene level.
- Whether another settlement can become a permanent destination.
- What, if anything, survives a Master-death restart.
