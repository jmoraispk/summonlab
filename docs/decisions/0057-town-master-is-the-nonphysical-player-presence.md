# 0057 — Town Master is the nonphysical player presence

**Status:** Accepted

**Date:** 2026-08-29

## Context

The implemented prototype models the Master as an embodied hero who must join missions, takes harm,
and ends the run on death. The owner instead wants the player to act as the town Master: an
omniscient entity able to communicate with everyone and coherently receive information about
everything that happens. Making that entity an ordinary combatant creates the unwanted risk that
the player dies merely by participating in the game.

## Decision

- In the target ruleset, the Town Master is the nonphysical player presence. It is not a hero,
  resident, party member, target, or entity with body, health, injury, location, training, or death.
- The Master can inspect and listen to every canonical event in the owned settlement and connected
  expeditions. Interface filters may manage attention but do not impose fictional ignorance.
- Master awareness and hero knowledge remain separate. A hero still receives only observations,
  beliefs, memories, relationships, and speech with a valid holder/provenance path.
- Heroes lead and populate ordinary expedition parties. The Master may authorize, direct, converse,
  observe, and use later explicitly defined systemic interventions without occupying a mission
  slot.
- If the target game needs a terminal campaign failure, it describes loss or abandonment of the
  Hearth/campaign rather than death of the nonphysical Master.
- Existing embodied and mortal-Master event streams keep their original contracts and replay
  behavior. A new ruleset supersedes them for new campaigns rather than reinterpreting history.

## Consequences

Multiple parties and concurrent expeditions no longer create several simultaneous player bodies.
The interface can explain comprehensive operational information diegetically, while clean-slate
heroes, secrets, testimony, rumor, and disagreements continue to depend on holder-specific evidence.
Mission deployment, Master timing/fallback, game-over, campaign shell, and presentation contracts
need versioned replacements or adapters before the new ruleset is integrated.
