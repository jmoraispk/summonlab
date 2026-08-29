# Attributes

Wiki ID: `mechanics.attributes`

Attributes are broad capabilities used by heroes and mechanically comparable creatures. They affect
checks, learning, action outcomes, and derived projections; they do not determine intelligence,
morality, obedience, social worth, personality, or the value of a life.

## Current shared vocabulary

| Attribute | Mechanical territory | Example use |
| --- | --- | --- |
| Might | force, leverage, carrying, melee power | lifting, mining, breaking guard |
| Vigor | health, stamina, recovery, physical resistance | enduring fatigue, resisting harm |
| Agility | speed, coordination, balance, precision | movement, aiming, tool control |
| Focus | concentration, mana control, technical execution | channeling, crafting, maintaining effects |
| Insight | perception, learning, evidence use, diagnosis | noticing tells, studying, medicine |
| Presence | persuasion, leadership, performance, intimidation | rallying, negotiating, teaching attention |

This six-attribute model is an accepted design direction but only partially represented by the
current prototype engine. Exact ranges, growth curves, and combat formulas remain progression-v2
work.

## Attribute rules

- Base attributes belong to progression/capability state and change only through typed growth.
- Skills turn attributes into specific competence. High Might does not automatically grant sword
  mastery; high Insight does not grant knowledge the actor never observed.
- Context selects the relevant attribute or combination. The same task must not silently change its
  formula by UI surface.
- Injuries, needs, equipment, environment, affect, and affinities modify derived checks through
  explicit contributions rather than rewriting the base value.
- Every modifier names source, duration/scope, stacking rule, cap, and content version.
- Player-facing readiness explains important contributions without pretending one total is the
  whole person.

## Affinity interaction

An [affinity](affinities/README.md) can improve how an attribute is expressed in a matching action.
For example, an affinity might contribute to derived force, speed, resistance, or control when the
action carries its tag. It does not permanently add hidden points to Might or Agility merely because
the character possesses the affinity.

This distinction makes balance and identity clearer:

```text
base attribute
+ learned skill and mastery
+ matching affinity expression
+ equipment/environment/party support
- injury/fatigue/resistance
= derived action check
```

## Monsters and heroes

Heroes and monsters use the same meanings for comparable attributes. Creature physiology can expose
different actions or scale, and deterministic monster policies can use fewer cognitive systems, but
“strength,” “speed,” or “resistance” cannot mean unrelated things depending on which side acts.

## Open questions

- What numeric range should base attributes use?
- Which checks combine two attributes, and how are ties explained?
- How should size/physiology remain distinct from Might and Vigor?
- Which modifiers should be visible exactly and which should use descriptive bands?

## References

- [Game-design attribute proposal](../../game-design.md#attributes-and-skills)
- [Progression and skills architecture](../../system-architecture/systems/progression-and-skills.md)
- [Every person can contribute](../principles/every-person-contributes.md)
