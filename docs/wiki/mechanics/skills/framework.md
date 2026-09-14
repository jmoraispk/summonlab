# Skill Framework

Wiki ID: `skills.framework`

Design status: **versioned combat-skill delivery, legality, and mastery progression are integrated
with `engine-v26` readiness combat; the larger rarity and skill-ladder catalog remains staged
design**.

Skills are learned competence. Attributes supply broad physical or magical capability; skills own
the technique, legal delivery method, authored accuracy and reliability, cost, effects, and
refinements.

## Rarity and mastery are separate

Rarity belongs to a skill definition and does not increase through use. Mastery belongs to one
hero's relationship with that exact skill and improves through validated practice evidence.
Mastering a Common skill does not change its rarity, and finding a rare skill does not grant mastery.

Common skills remain useful because their authored effects, compatibility, reliability, costs, and
passive benefits continue to matter. A higher-rarity replacement is not automatically legal or
well-practised.

The current `combat-skill-v1` contract represents mastery on a `0..100` scale. Each skill publishes
monotonic authored steps containing:

- the minimum mastery for the step;
- accuracy in basis points;
- reliability in basis points;
- optional named refinement unlocks.

Mastery does not automatically improve damage, critical chance, Mana efficiency, resistance, and
action cadence together. A skill gains only the fields its definition authors. The first catalog
ships Basic Sword Strike and Basic Bow Shot with novice, trained, and mastered calibration steps.
Readiness missions currently consume the selected step's authored accuracy; reliability remains a
versioned catalog field but does not yet affect readiness resolution. Authenticated skill-practice
claims can advance persisted mastery and therefore the accuracy step used by later attempts.

## Delivery and equipment training

An active combat skill declares one or more equipment-family delivery tags. A learned skill records
the family tags with which that hero has actually practised it. Legal-action enumeration requires
one tag shared by all three sets:

```text
equipped family tags
∩ skill delivery tags
∩ hero's trained delivery tags
≠ empty
```

The versioned vocabulary is `unarmed`, `one-handed-blade`, `two-handed-blade`, `bow`,
`staff-focus`, and `shield`. Tags bind a technique to a family, never to one exact item instance.
Moving a technique to a related family requires authored familiarization or mastery rules; a new
sword of the same family does not erase training.

`engine-v26` readiness-state assembly uses the shipped loadout evaluator, so an overloaded,
unproficient, or delivery-incompatible loadout exposes no active skill action. `legacy-auto-v1`
continues through its frozen compatibility runner. The current content profiles bind Sword and Dagger to
`one-handed-blade`, Bow to `bow`, Staff to `staff-focus`, and Shield to `shield`. Other family
bindings remain content work rather than inferred compatibility.

## Accuracy, evasion, and criticals

Skill mastery is the primary source of learned accuracy. The target hit contest is:

```text
authored skill accuracy versus defender evasion
+ a bounded relative-Agility term
+ explicit positional or condition modifiers
```

The readiness resolver applies a clamped relative-Agility term plus explicit positional or condition
modifiers. Mastery remains the primary accuracy source; the balance gate limits the relative-Agility
effect in peer comparisons.

In `agent-readiness-v1`, hit/miss and critical rolls use stable purpose-keyed engine
randomness. Shipped `legacy-auto-v1` retains its frozen sequential entropy. Critical opportunity
belongs to the skill, target state, positioning, and explicit practice bonuses—not to a base
attribute.

## Practice and learning

Practice gain is evidence-driven. The canonical calculation composes:

```text
base practice evidence
× bounded cognitive factor for comprehension-heavy evidence only
× relevant domain aptitude
× teaching quality
× facility quality
× motivation and current condition
× variety
× repetition decay
```

The hidden cognitive factor stays within `0.90..1.10` and does not affect ordinary non-comprehension
practice. Domain aptitude is independent and currently distinguishes martial, magical, crafting,
survival, and social learning. Neither value changes model reasoning or the quality of a hero's
decisions.

The player should learn about aptitude through observed progress and mentors rather than an exposed
IQ number. The full profile and its invertible internal cognitive receipt factor must remain outside
player-facing projections.

Focused practice, guidance, pressure, repetition decay, and variety remain useful authoring concepts,
but exact schedules and yields are not yet the idle-gain system. A hero should not automatically
train for every available hour merely because it is optimal.

Resolved readiness skill uses produce bounded, idempotent practice evidence for that exact skill.
The common combat-result claim path commits it with the attempt's other consequences, so retries
cannot grant it twice and retreat does not erase practice that actually occurred.

## Resistances and Break mechanics

Skills may author `cut`, `pierce`, `impact`, `burn`, `frost`, `shock`, or `arcane` resistance grants.
Only passive skills can act as passive-skill resistance sources. The engine converts equipment,
passive-skill, and physiology sources into deterministic typed receipts, preserves the source ID,
applies the stricter authored/global cap, and then combines matching tags up to 75%.

There is no universal poise field. A particular skill may explicitly own a visible `breakMeter`,
with a maximum and recovery rate, but absence of that field means no Break mechanic exists.

## Learn conditions

Future skills may compose multiple explicit learn paths. Supported design inputs include:

| Condition | Example |
| --- | --- |
| Prerequisite skill | Basic Sword Strike at the authored mastery |
| Practice evidence | A count of validated uses or successful parries |
| Affinity | Holds the required future affinity rank |
| Source | A teacher, school, manual, or location |
| Deed | Survived a named encounter or completed a trial |
| Material | Consumes an authored component |

Combat attributes scale the execution of actions in their owned scopes; they do not gate learning or
change practice rate. Lore, scholarship, precision, crafting, and other learned capabilities use
skills, mastery, and evidence rather than intelligence, dexterity, or another combat-attribute
threshold.

## Domains and families

The larger skill catalog retains these progression homes:

| Domain | Families |
| --- | --- |
| **Martial** | Blade, Polearm, Ranged, Shield, Body |
| **Magical** | Elemental, Ward, Enchantment, Restoration, Mind |
| **Craft** | Forging, Alchemy, Cooking, Gathering, Knowledge |

Every skill has one family as its progression home. Compatibility and affinity are labels or
requirements, not duplicate progression ownership. The full authored catalog and migration status
live in the [skill index](README.md).

## Deferred ladder design

The broader design may still use skill rarity F through S, mastery promotions, mentorship,
epiphanies, prerequisite ladders, and merging. Those systems require their own versioned contracts
and balance evidence. They must not overwrite the simpler shipped rule: per-skill mastery improves
only explicitly authored fields, and equipment compatibility is a three-way tag intersection.

## References

- [Attributes](../attributes.md)
- [Attributes and training](../progression/attributes-and-training.md)
- [Equipment](../equipment/README.md)
- [Four-attribute implementation plan](../../../superpowers/plans/2026-09-06-four-attribute-legacy-combat.md)
