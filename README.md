<div align="center">

<img src="assets/hero.svg" alt="summonlab — Every hero is an agent" width="100%">

# summonlab

**A game-design laboratory where you summon personalities, give them a mission, and let them choose how to pursue it.**

_Status: concept and prototyping._

</div>

## The idea

Summonlab asks a slightly dangerous game-design question: **how much freedom can we give an agent while still having a fair, legible game?**

The player brings a story, objective, or expedition. They summon a roster of heroes with different rarities, capabilities, memories, and personalities. Those heroes are not units waiting for direct orders; each is an agent that interprets the situation and decides what to do next.

The game supplies the world and its rules. The player supplies intent. The heroes supply agency.

<img src="assets/agent-summoning-concept.png" alt="A summoner watches an autonomous agent hero emerge through a gate surrounded by possible actions" width="100%">

## The player fantasy

1. **Summon** a hero with a rolled rarity, kit, and personality.
2. **Brief** the party with a mission rather than a sequence of commands.
3. **Observe** each hero read the room, remember events, and choose an action.
4. **Intervene** through resources, relationships, new information, or a changed objective—not by puppeteering every turn.
5. **Replay** the expedition and understand how this particular cast produced this particular story.

The interesting outcomes should live between competence and character: the cautious tactician who refuses a reckless shortcut, the glory-seeker who takes it anyway, or the healer who remembers a promise the player had forgotten.

## Freedom with a hard boundary

The load-bearing rule is simple:

> **An agent may choose what happens next. It may never mutate game state directly.**

The engine owns the canonical state and advances it deterministically:

```text
nextState = transition(state, validatedAction, seed)
```

On a hero turn, the engine assembles a compact view of the situation, that hero's personality and memory, and the actions currently allowed. A policy selects or proposes an action. The engine validates it, applies it, and records it.

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

This boundary preserves the two things the experiment needs most: **real agent agency** and **a trustworthy game**.

## One policy interface, many kinds of mind

Hero decision-making should be swappable behind one narrow contract:

- `RandomPolicy` gives a zero-cost baseline and fuzzes the rules.
- `ScriptedPolicy` supports balance tests and authored encounters.
- `LLMPolicy` lets personality, memory, negotiation, and improvisation matter.

That makes it possible to simulate thousands of expeditions without model calls, then reserve agents for the moments where agency adds something a behavior tree cannot.

## The freedom ladder

Not every decision needs the same amount of latitude. Summonlab can explore a spectrum:

| Mode | What the hero receives | What the engine accepts | Best fit |
| --- | --- | --- | --- |
| Pick | A short list of legal actions | One action ID | Routine combat turns |
| Compose | Legal verbs and typed targets | A structured action | Skills, movement, cooperation |
| Propose | Goals, constraints, and world tools | A validated plan or intent | Exploration and social scenes |

Even at the most open end, freeform language is not game state. It must resolve through engine-owned verbs, validation, costs, and consequences.

## First playable slice

A useful vertical slice would be a short, room-based expedition rather than a sprawling RPG:

- summon a party of three heroes from a small personality pool;
- give them one mission with several valid approaches;
- run turn-based combat and one non-combat dilemma;
- let relationships and recent events alter later choices;
- finish with a seeded replay that exposes every context, choice, and state transition.

The slice is small enough to measure cost, latency, coherence, and fun—the questions that should decide the eventual shape of the game.

## Why web, why turn-based

Agent decisions already need a server boundary for credentials, budgets, rate limits, and validation. A web client can remain a thin renderer while the authoritative engine and policy calls run server-side.

Turn-based expeditions also make agent latency part of the rhythm instead of a dropped frame. A PWA can cover desktop and mobile early; a native wrapper only becomes interesting if distribution demands it.

## Design questions worth testing

- When does an autonomous hero feel alive, and when does it merely feel slow?
- How much personality context changes behavior without flattening competence?
- Can players influence agents in ways that feel strategic without becoming direct control?
- What should memory retain so a run develops continuity without drowning the model in history?
- How do rarity and progression expand possibility without making lower-rarity personalities disposable?
- Which decisions deserve an agent call, and which are better resolved locally?

## Inspiration

Summonlab uses the familiar language of hero summoning and rarity, but its central inspiration is the manga *Pick Me Up, Infinite Gacha*: a world where summoned heroes have interiority, risk, and a life beyond being pieces on a board.

This is an independent experimental project and is not affiliated with or endorsed by the manga, its creators, publishers, or any game franchise.
