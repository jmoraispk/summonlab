<div align="center">

<img src="assets/agent-summoning-concept.png" alt="A summoner watches an autonomous agent hero emerge through a gate surrounded by possible actions" width="100%">

# summonlab

**A hero-summoning game where every hero is an agent.**

Give them a mission. Earn their trust. Watch them decide what happens next.

_Status: concept and prototyping._

</div>

## A game where heroes are people

Summonlab explores a difficult game-design question: **how much freedom can we give an agent while still having a fair, legible game?**

The player summons a roster of heroes with distinct bodies, talents, values, personalities, memories, and relationships. These heroes are not units waiting for direct orders. They interpret the situation, speak to one another, choose their own actions, and may accept, negotiate, or refuse what the player asks of them.

The game supplies the world and its rules. The player supplies leadership and intent. The heroes supply agency.

## Working direction: a frontier settlement RPG

The strongest concept so far places the player in charge of a ruined settlement on a monster-held frontier. The long-term objective is to reclaim the surrounding regions, restore a chain of ancient beacons, and close the breach that keeps producing monsters.

The settlement gives heroes somewhere to live rather than merely somewhere to wait between battles. They can train, work, argue, form friendships, hold grudges, volunteer for missions, and challenge the player's priorities. Expeditions beyond the walls turn those relationships into bounded tactical and narrative decisions.

A day might look like this:

1. **Council** — announce a priority, ask for volunteers, and hear objections.
2. **Prepare** — build, equip, research, summon, and assign scarce resources.
3. **Act** — heroes work around the settlement or depart on expeditions.
4. **Respond** — resolve discoveries, disputes, injuries, raids, and opportunities.
5. **Reflect** — relationships change, memories consolidate, and heroes reconsider their goals.

The player leads through conversation, policy, resources, appointments, and persuasion—not a cursor that directly moves every hero.

## How agency stays playable

<div align="center">

<img src="assets/hero.svg" alt="summonlab — Hero summoning game, where every hero is an agent" width="72%">

</div>

The load-bearing rule is simple:

> **An agent may choose what happens next. It may never mutate game state directly.**

```text
mission + world state
        │
        ▼
  deterministic engine ──► legal moves + hero context
        ▲                              │
        │                              ▼
  validated action ◄──────────── hero policy
        │
        └──► event log / replay / memory
```

The authoritative engine owns state, rules, costs, randomness, and consequences. A hero policy receives a deliberately assembled turn packet and returns a structured choice. The engine validates that choice before applying it.

Every model request can therefore be independent. Summonlab—not the model provider—owns the hero's memories, relationships, prompt version, context budget, and view of the world.

## Summoning, rarity, and pity

Summoning should feel exciting without making the system opaque or cruel:

- each banner has visible soft-pity and hard-pity counters;
- guarantees update transactionally on the server and survive reconnects;
- banners feature generation themes such as a vocation, origin, skill family, or resonance—not a duplicate named hero;
- missing a featured theme can guarantee that the next high-rarity result is a new hero matching it;
- rarity represents unusual starting aptitude, not a hero's humanity or ultimate ceiling;
- every summoned identity is unique, so the design does not need personality clones disguised as duplicates.

The first prototype should use earned in-game currency only. Exact thresholds remain configuration and balance questions, not engine constants.

## Human first, not human only

The first character generator will focus on humans so we can learn whether personality and continuity actually work before multiplying the content problem.

A hero seed can determine physical traits such as height, build, facial structure, skin tone, hair, eyes, age, and handedness. Heritage, culture, gender, physicality, personality, and ability remain separate dimensions. Ethnicity or ancestry must never imply intelligence, morality, rarity, or temperament.

Personality begins with continuous traits rather than a single archetype: temperament, values, motivations, fears, attachment and conflict styles, risk tolerance, moral boundaries, and stress responses. Experiences may change opinions and behavior without rewriting the hero into a different person after every scene.

Later species—whether goblins, elves, constructs, or monsters—can share the same identity, memory, relationship, vocation, and evolution systems while supplying a different physiology template.

## A common evolution path

Every hero should be able to become important. A common progression model can separate:

- **level** — competence earned through practice;
- **vocation** — the work or combat role a hero chooses and develops;
- **conviction** — a value, vow, or ambition tested by story events;
- **bond** — relationships that unlock cooperation and change decisions;
- **ascension** — star growth earned through meaningful achievements rather than duplicates.

This lets a low-rarity recruit eventually stand beside a rare summon while preserving different beginnings and stories.

## Conversation is a game system

Talking to heroes should not be decorative dialogue. The player can request, persuade, bargain, reassure, threaten, apologize, or reveal information. Trust, time pressure, personality, relationships, and the request itself determine whether a hero accepts, counters, delays, or refuses.

Conversation still resolves through game rules. Repeating a request consumes time and patience; promises become remembered commitments; lies can be discovered; rank may create compliance without loyalty. The model writes a brief player-facing intent and the human response, while the engine owns the mechanical result.

## First playable slice

The first slice should test the risky idea, not simulate an entire kingdom:

- one small settlement with three useful buildings;
- three summoned human heroes with inspectable personality seeds;
- one council conversation and one contested assignment;
- one short ruin expedition with combat and a non-combat dilemma;
- one goblin raid whose outcome depends on earlier preparation;
- a complete seeded replay of contexts, choices, dialogue, and state transitions.

If those three heroes feel meaningfully different across repeated runs, the concept has earned a larger world.

## Project documents

- [Game design](docs/game-design.md) — concept options, world premise, game loops, character generation, pity, progression, and persuasion.
- [Architecture and platform](docs/architecture.md) — deterministic engine, stateless agent turns, memory ownership, persistence, cost controls, and web deployment.
- [Visual direction](docs/visual-direction.md) — art language, procedural characters, animation layers, summoning sequences, and screen concepts.

## Inspiration

Summonlab uses the familiar language of hero summoning and rarity, but its central inspiration is the manga *Pick Me Up, Infinite Gacha*: a world where summoned heroes have interiority, risk, and a life beyond being pieces on a board.

This is an independent experimental project and is not affiliated with or endorsed by the manga, its creators, publishers, or any game franchise.
