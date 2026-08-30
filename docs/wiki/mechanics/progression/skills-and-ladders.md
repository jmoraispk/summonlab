# Imported skill, mastery, ladder, and merging proposal

Wiki ID: `mechanics.progression.skills-ladders`

Design status: **draft**. The supplied `skill_compendium.md` is the companion catalog; this page
preserves the complete framework imported from `progression_system.md`.

## Rarity and mastery are independent

| Axis | Meaning | Movement | Owner |
| --- | --- | --- | --- |
| Rarity | The skill’s fixed power band, bonus count, and cost efficiency | Never changes | Skill definition |
| Mastery | How fully this bearer has realized the skill | Practice quality, variety, and repetition | Hero-skill relationship |

Rarity supplies immediate real power. The draft’s exchange rate says one mastery tier closes roughly
one rarity tier and occasionally two; three mastery promotions can therefore move effective power
about three to six rarity steps.

| Comparison | Draft expected result |
| --- | --- |
| Master Common vs Novice Rare | Common wins comfortably |
| Master Common vs Novice Epic | Common wins |
| Master Common vs Novice Mythic | Roughly even |
| Master Common vs Novice Fabled | Fabled favored, but not decisively |
| Master Common vs Novice Legendary | Legendary wins |
| Master Common vs Master Legendary | Not a contest |

This preserves the relevance of a mastered starter while leaving trained Legendary skills truly
exceptional.

## Seven rarity tiers

The same fixed scale is proposed for skills, materials, and equipment.

| Tier | Name | Character | Indicative odds | Approximate skill count |
| --- | --- | --- | ---: | ---: |
| F | Common | Anyone can learn; taught in a morning | Routine | 90 |
| E | Uncommon | Standard training; soldiers know several | 1 in 5 | 70 |
| D | Rare | Real teacher or sustained effort | 1 in 25 | 55 |
| C | Epic | School technique held by named practitioners | 1 in 150 | 40 |
| B | Mythic | Inherited, dangerous loot, or deed-earned | 1 in 1,000 | 28 |
| A | Fabled | Holder and skill known across a region | 1 in 10,000 | 15 |
| S | Legendary | Existence disputed; one holder or none | 1 in 100,000 | 2 |

Rarity words describe scarcity and origin; mastery words describe practitioner command, so their
vocabularies must not overlap. The source reserves Divine for off-cycle affinity flavor and offers
an alternate less-gamey set: Common, Uncommon, Scarce, Storied, Ancient, Fabled, Legendary.

## Forty mastery levels

| Tier | Internal levels | Character |
| --- | ---: | --- |
| Novice | 1–10 | Understood but not owned; costlier and less reliable |
| Intermediate | 1–10 | Reliable and habitual |
| Expert | 1–10 | Adapted to the individual bearer |
| Master | 1–10 | Teachable and merge-ready |

The displayed level resets to 1 after each automatic promotion. Intermediate 1 is still a large
step above Novice 10. Withholding promotion offers no advantage because bonuses are computed from
the practice history at the threshold. Each promotion grants a large potency step, a permanent
attribute grant, and rarity-dependent practice bonuses.

## Three progress sources

Every source remains available at every tier; only its return changes.

| Source | Meaning | Novice | Intermediate | Expert | Master |
| --- | --- | --- | --- | --- | --- | --- |
| Focused practice | Solo drills against air, posts, rocks, and forms | High | Moderate | Low | Very low |
| Guidance | Training under a higher-mastery holder of this exact skill | High | High | High | Moderate |
| Pressure | Combat, sparring, and genuine stakes | High | High | Very high | Very high |

Solo practice is proposed as never worthless and never sufficient in practical time: a hero can
technically grind to Master, but the diminishing return becomes extreme. Battle experience remains
qualitatively important. Guidance requires a living higher-mastery holder of the exact skill. A
teacher receives only a small progress trickle, slightly higher in sparring than instruction, making
masters a scarce settlement resource.

## Practice equation

Every skill repetition and attribute-training action uses:

```text
yield = base(action) × quality × variety × aptitude × D(repetitions) × M(mastery)
```

| Term | Function |
| --- | --- |
| base | Intrinsic action value; a full form is worth more than a raw swing |
| quality | Resistance, stakes, or guidance in this repetition |
| variety | Novelty relative to prior contexts |
| aptitude | Talent for the attribute, family, or learning mode |
| D(repetitions) | Decay from accumulated repetitions of this action |
| M(mastery) | Decay from current tier in this skill |

The two decays are separate. The ten-thousandth swing is worth less than the tenth, and the first
Intermediate swing is worth less than the first Novice swing. `D` should decay gently enough that
raw repetition remains the most available route for a long time; variety and guidance interrupt
that repetition rather than creating an optimal rotation.

| Circumstance | Relative quality |
| --- | --- |
| No resistance—air, post, rock | Baseline |
| Static real target | Slight increase |
| Moving/resisting target | Moderate increase |
| Partner drilling the same discipline | Moderate increase |
| Peer spar | High increase |
| Opponent using the same discipline | High increase |
| Mentor correcting | Very high |
| Genuine threat of death | Highest |

Variety tracks distinct terrain, weather, opponent type, weapon, time, injury state, and being
outnumbered. Novel contexts restore some decayed repetition yield and add a one-time novelty bonus.
It should be harder to acquire than repetition and distinguish competence from danger.

Every action’s yield is proposed as visible—for example `+10`, `+1`, or `+0.1`—so the player can see
the curve flatten and decide whether to seek a teacher, harder opposition, or a new context.

## Practice-derived promotion bonuses

Promotions automatically read the actual practice profile; they offer no selection menu.

| Practice profile | Bonus | Effect |
| --- | --- | --- |
| High raw repetition | Economy | Lower mana cost |
| Rapid successive use | Timing | Lower wind-up/cast time |
| Low-health or outnumbered use | Composure | Potency rises as Health falls |
| Armored/resistant targets | Penetration | Ignores some mitigation |
| Weak-point and critical success | Keenness | Higher critical rate and damage |
| Many distinct contexts | Adaptability | Lower unfamiliarity penalty and broader targets |
| Long solo repetition | Consistency | Lower variance, failure, and fumble chance |
| Extended hold/channel | Endurance | Longer duration and cheaper stance upkeep |
| Immediate chaining | Flow | Lower cooldown in a chain |
| Substantial mentoring | Insight | Extra bonus and faster later progression |
| Many opponent types | Discernment | Bonus against the most-practiced type |
| Charged/held release | Capacity | Unlocks or improves a charge mechanic |

Early promotions naturally favor Economy, Consistency, and Timing because young heroes drill;
later ones favor Composure, Penetration, and Discernment because veterans fight. Two bearers of the
same skill therefore diverge without direct bonus selection.

| Rarity | Bonuses per promotion |
| --- | ---: |
| F–E | 1 |
| D–C | 2 |
| B–A | 3 |
| S | 4, including possible exclusive bonuses |

Compatible bonuses are inherited by a merged result.

## Innate skills

A summoned hero may start above Novice; a 5★ might arrive at Intermediate. This saves all skipped
mastery levels but only part of the skipped repetition history. `D` starts generous because the hero
has no repetitions, while `M` is already reduced by the higher tier. Basic drills still help, but
less than they help a true Novice.

## Learning conditions and multiple paths

Every skill declares composable conditions. Higher rarity generally means more conditions rather
than only larger thresholds.

| Condition | Example |
| --- | --- |
| Attribute | Dexterity exceeds a threshold |
| Prerequisite mastery | Fireball at Expert or higher |
| Repetitions | 10,000 sword swings, 100 parries, or 1,000 potions |
| Affinity | Fire Rank II or higher, for magical skills only |
| Source | Teacher, school, manual, or location |
| Deed | Defeat a class, survive an event, or cross a place |
| Material | Consume a rare component |
| Composite | A conjunction of several conditions |

Tracked repetitions are first-class conditions because they cannot simply be bought. One path can
require many conditions, while a skill can offer multiple independent alternative paths.

Example Mythic counter technique:

| Path | Requirements |
| --- | --- |
| Taught | Parry at Master + living holder + guided training period |
| Bloody | Parry at Master + 5,000 successful parries + parry a named boss signature |
| Scholar’s | Parry at Expert + high Intellect + recovered treatise + rare catalyst |

This lets mentorship, veteran experience, and scholarship all remain valid strategies. Rarer skills
tend to have fewer and harder paths; a Legendary may have one path nobody has yet walked.

## Vertical ladder progression

The primary route to higher rarity is learning a different skill higher in a line, not changing the
rarity of an existing one. Mastering Fireball can qualify a hero to learn the always-Mythic Fire
Meteor. Ladder advancement combines:

- practice and repetition requirements;
- mentorship from a higher-skill holder;
- an aptitude-driven epiphany under pressure;
- discovery through manuals, ruins, boss drops, or inheritance.

Family aptitude materially raises the chance of rare epiphanies and therefore affects access as
well as speed.

## Sectors, families, and foci

### Martial

| Family | Foci |
| --- | --- |
| Blade | Sword, dagger, greatsword, paired blades |
| Haft | Spear, axe, polearm, hammer |
| Fist | Unarmed, grappling, gauntlet |
| Hunt | Bow, crossbow, thrown, tracking, ambush |
| Guard | Shield, defense, poise, protection |
| Motion | Movement, evasion, positioning, traversal |

### Magical

| Family | Foci |
| --- | --- |
| Evocation | Offensive magic authored per element |
| Ward | Barriers, dispelling, and defense per element |
| Enchantment | Self/ally buffs and component-consuming object imbuing |
| Restoration | Healing, curing, revival |
| Mind | Control, perception, illusion, deception |

### Craft and life

| Family | Foci |
| --- | --- |
| Forging | Weapons, armor, tools |
| Alchemy | Potions, poisons, reagents |
| Cooking | Food, duration buffs, morale |
| Gathering | Harvesting, mining, foraging, skinning |
| Beast | Taming, riding, handling, breeding |
| Lore | Identification, appraisal, cartography, language |

Craft skill is structurally useful: smiths set equipment possibilities, alchemists help parties
survive, cooks support roster function, and a level-1 Master cook remains genuinely valuable.

## Merging

Merging is proposed as a late-game cross-family route rather than the main rarity ladder. It consumes
two different skills to produce a different fixed-rarity skill.

Draft requirements: both parents at Master 10, an authored recipe, and a consumed catalyst whose
rarity contributes to the result. Both input skills are consumed. The result begins at Novice 1.

| Pair | Character | Result direction |
| --- | --- | --- |
| Blade + Motion | Natural | Mobile strikes and closing |
| Blade + Evocation | Natural | Elemental weapon arts |
| Forging + Enchantment | Natural | Imbued-equipment creation |
| Alchemy + Restoration | Natural | Superior healing craft |
| Cooking + Enchantment | Unexpected | Lasting-buff food |
| Beast + Motion | Unexpected | Mounted combat |
| Hunt + Lore | Unexpected | Tracking the impossible |
| Guard + Mind | Volatile | Wards that turn attacker intent |
| Forging + Blade | Volatile | Techniques restricted to a self-made weapon |
| Two copies of the same skill | Fallback | Refined variant for a hero with no partner |

The result inherits at least both parent effects, compatible practice bonuses, and one emergent
property. The theoretical apex inherits from every family, is named in lore, and remains effectively
unobtainable as an orientation point.

This two-input/consumed-input proposal is not accepted canon. The architecture supports canonical
sorted input sets of two or three and deliberately leaves consumed versus retained inputs open.

## Skill types

| Type | Cost | Constraint | Role |
| --- | --- | --- | --- |
| Active | Mana per use | Cooldown | Moment decisions |
| Passive | None | Source proposes no slot limit | Build identity and permanent bonuses |
| Stance | Continuous mana drain | Exactly one active stance | Build-defining commitment |
| Craft | Time and materials | Facility or tool | Outside-combat production |

The source argues that acquisition conditions, especially mentorship and repetitions, constrain
unlimited passive ownership. The shared architecture instead requires slot/action-economy controls
to prevent a giant library from becoming every build simultaneously, so passive capacity remains a
conflict for review. One-stance exclusivity is compatible with that goal.

## Acquisition routes

| Route | Typical rarity | Role |
| --- | --- | --- |
| Innate summon skill | F–C | More/higher mastery with more native stars |
| Manuals and scrolls | F–C | Main consumable economy |
| Teachers and schools | E–B | Learning plus high-yield guidance |
| Ladder progression | E–S | Main high-rarity route |
| Epiphany | D–A | Pressure event scaled by aptitude |
| Monster materials | D–A | Creature-flavored teaching drops |
| Trial and boss reward | B–S | Named techniques from named opponents |
| Merging | C–S | Cross-family late game |

## Ladder structure and shape

| Level | Term | Example |
| --- | --- | --- |
| Sector | Broadest grouping | Martial |
| Family | Discipline | Blade |
| Subfamily | Specific focus and its ladder | Sword |

Three structural rules:

1. Every subfamily begins with one Common foundation passive such as Swordsmanship, Knifework, or
   Shield Use. It grants a small flat focus bonus and forms the single root for all descendants.
2. Universal Martial techniques such as parrying, feinting, footwork, and disarming sit outside
   weapon ladders, can be learned from any weapon foundation, and work with any held weapon.
3. Rarity D and above branches into alternatives sharing prerequisites so heroes diverge.

| Rarity | Major subfamily (~28) | Standard (~16) | Minor (~12) |
| --- | ---: | ---: | ---: |
| F | 7 | 4 | 3 |
| E | 6 | 4 | 3 |
| D | 5 | 3 | 2 |
| C | 4 | 2 | 2 |
| B | 3 | 2 | 1 |
| A | 2 | 1 | 1 |
| S | 1 | 0 | 0 |

Not every subfamily reaches Legendary. A non-Legendary line can still contribute through merging
or a shared capstone.

Every catalog entry needs fixed rarity, skill type, requirements, and effect. The complete intended
coverage is 17 Martial subfamilies plus Universal Martial, 13 Magical subfamilies, and six Craft and
Life subfamilies. The companion compendium owns the worked entries; the source says fourteen foci
still required full ladder treatment when written.

## Living Village subset

Ship one or two complete small ladders, visible practice yield, automatic mastery promotion, one
active/passive/stance ruleset, and a bounded training-versus-combat comparison. Defer merging,
epiphanies, high-rarity routes, teaching networks, rare composite conditions, and the full catalog
until the core resolver and user flow are proven.
