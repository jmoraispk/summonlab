# Attributes

Wiki ID: `mechanics.attributes`

Attributes are broad capabilities used by heroes and mechanically comparable creatures. They affect
checks, learning, action outcomes, and derived projections; they do not determine intelligence,
morality, obedience, social worth, personality, or the value of a life.

## Authoritative shared vocabulary

The supplied [progression design](progression/attributes-and-training.md) defines six attributes:
`Might`, `Vitality`, `Agility`, `Dexterity`, `Intellect`, and `Spirit`. Under ADR 0063 this model
supersedes the earlier `Might / Vigor / Agility / Focus / Insight / Presence` proposal. Historical
engine content keeps its old IDs; new Living Village content must use or explicitly migrate to the
authored vocabulary as one versioned change.

| Attribute | Mechanical territory | Example use |
| --- | --- | --- |
| Might | force, leverage, carrying, melee power | lifting, mining, breaking guard |
| Vitality | health, mitigation, poise, physical resistance | enduring harm and resisting bodily status |
| Agility | speed, balance, reaction, evasion | moving first and escaping danger |
| Dexterity | accuracy, control, weak-point execution, crafting precision | landing a shot or making a fine object |
| Intellect | magical output, analysis, comprehension, learning | understanding a recipe or spell |
| Spirit | mana, mental endurance, control stability, mental resistance | sustaining magic or resisting fear |

The earlier vocabulary remains partially represented by the current prototype engine. Exact numeric
ranges, growth curves, and combat formulas still require progression-v2 implementation, but the
names and mechanical territories above are no longer an open choice.

## Attribute rules

- Base attributes belong to progression/capability state and change only through typed growth.
- Skills turn attributes into specific competence. High Might does not automatically grant sword
  mastery; high Insight does not grant knowledge the actor never observed.
- Context selects the relevant attribute or combination. The same task must not silently change its
  formula by UI surface.
- Injuries, needs, equipment, environment, and affect modify derived checks through explicit
  contributions. Affinity additionally supplies the authored permanent matching-attribute nudge at
  level gain.
- Every modifier names source, duration/scope, stacking rule, cap, and content version.
- Player-facing readiness explains important contributions without pretending one total is the
  whole person.

## Affinity interaction

An [affinity](affinities/README.md) improves matching actions and, under the supplied progression
design, contributes a modest permanent nudge to its matching attribute on level gain. The grant is
explicit in the progression receipt; it is never a hidden projection-only bonus.

This distinction makes balance and identity clearer:

```text
base attribute
+ learned skill and mastery
+ matching affinity expression and recorded level-grant nudge
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
- How should size/physiology remain distinct from Might and Vitality?
- Which modifiers should be visible exactly and which should use descriptive bands?

## References

- [Game-design attribute proposal](../../game-design.md#attributes-and-skills)
- [Progression and skills architecture](../../system-architecture/systems/progression-and-skills.md)
- [Every person can contribute](../principles/every-person-contributes.md)
