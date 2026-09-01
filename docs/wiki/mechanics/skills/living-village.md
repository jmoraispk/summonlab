# Living Village Skill Subset

Wiki ID: `skills.living-village`

Design status: **milestone proposal**. This page separates an initial twelve-skill runtime from a
larger Common-tier expansion pool; neither replaces the complete [skill compendium](README.md).
The [Living Village release matrix](../../roadmap/living-village-v1.md) is authoritative for which
documented skill IDs are actually enabled.

The first playable village needs enough skills to make summoning, party composition, combat, and
training visibly different without implementing the entire consolidated catalog.

## Initial runtime selection

Start with exactly twelve definitions across five possible roles. Basic movement and basic attacks
remain legal actions rather than skills.

| Role | Initial definitions |
| --- | --- |
| Melee attacker | Swordsmanship, Measured Cut |
| Defender | Shield Use, Raise Shield, Shield Bash |
| Ranged attacker | Archery, Aimed Shot |
| Fire caster | Ember, Spark |
| Healer | Mending, Close Wound |
| Shared movement identity | Footwork |

This selection tests passives, weapon actives, protection, range, magic, Mana, damage, and healing
without requiring every affinity or skill family. The combat specification may replace individual
choices before IDs are accepted, but it should keep the 8–12 definition budget.

Every role package must satisfy its own learn conditions. Foundation skills start at Novice 1;
dependent Common skills may then start at Novice 1 because that prerequisite is met. The Fire
package requires Fire Rank I. The healer package requires an explicitly selected Rank-I affinity
and the authored Intellect threshold. Other starter roles may be
Unaligned. Summoning never waives a requirement merely because a package wants the skill.

## Common-tier expansion pool

All names bind to their full definitions on the linked catalog pages.

| Role | Family / label | Included skills |
| --- | --- | --- |
| Shared martial basics | [Body](martial-body.md) | Footing, Grip, Basic Block, Recovery |
| Melee attacker | [Blade](martial-blade.md) | Swordsmanship, Measured Cut, Overhead Chop, Horizontal Slash, Cross Guard |
| Ranged attacker | [Ranged](martial-ranged.md) | Archery, Aimed Shot, Quick Loose, Steady Stance |
| Defender | [Shield](martial-shield.md) | Shield Use, Raise Shield, Shield Bash, Brace, Cover |
| Shared movement | [Body](martial-body.md) | Footwork, Dash, Roll |
| Fire caster | [Elemental](magical-elemental.md) · `Element: Fire` | Ember, Spark, Warmth, Ignite |
| Water caster | [Elemental](magical-elemental.md) · `Element: Water` | Draw Water, Water Bullet, Cold Touch, Flow |
| Earth caster | [Elemental](magical-elemental.md) · `Element: Earth` | Stoneshape, Stone Shard, Harden, Tremor |
| Wind caster | [Elemental](magical-elemental.md) · `Element: Wind` | Wind family rewrite pending; see the Elemental family page |
| Healer | [Restoration](magical-disciplines.md#restoration) | Mending, Close Wound, Soothe, Field Care |

Counting the retained named definitions above yields a **37-definition expansion pool**: 23 Active
and 14 Passive, all Common. It preserves the Fire, Water, and Earth caster ladders while the Wind
family rewrite remains unpublished. It is not the minimum runtime and must not all be implemented
merely because concept art exists. It deliberately excludes Craft and
Stance skills, higher rarity, alternate learning paths, teaching, merging, and skill loss.

## Minimum playable rules

1. A summoned hero receives one role package containing its foundation plus a small legal action
   set. Initial summoning cannot roll outside the twelve selected definitions; later Living Village
   content may draw from the 37-definition expansion pool after explicit promotion.
2. Known skills have stable IDs and a Novice progress value. Training raises that value through a
   versioned grant; combat can also grant pressure practice.
3. Each combat action names its skill, attacker, target or target shape, mana cost if any, and
   deterministic outcome inputs. Basic movement and basic attacks remain available even at zero
   mana.
4. Passives are applied automatically. The slice has no stance selector, crafting queue, fusion
   screen, teacher assignment, manuals, epiphanies, or alternate learn paths.
5. Party building must explain the broad function of each skill—damage, guard, movement, control,
   or recovery—without requiring the player to infer it from the animation.
6. Training shows current progress, projected time/yield, the practiced skill, and resulting combat
   change. It must never silently train a different skill because an animation looks similar.
7. Visual effects consume the same skill/action/status IDs as combat. A flame, root, shield impact,
   or heal cannot imply a mechanic the resolver did not emit.

## Deliberately deferred

- every Uncommon through Legendary skill;
- Dagger- and Greatsword-labeled Blade skills, Polearm, Crossbow-labeled Ranged skills, Ward,
  Enchantment, Mind, and all Craft ladders;
- mastery promotion bonuses and permanent attribute awards;
- multiple acquisition paths, manuals, mentorship, epiphany, monster-material skills, and trials;
- skill merging, catalysts, consumption, inherited practice bonuses, and the apex skill;
- exact elemental cycle and status formulas, pending the combat specification;
- final mana costs, cooldowns, ranges, scaling, and target counts.

Deferred definitions remain canonical design inventory and can be assigned to visual workers, but
their art should be labeled concept art rather than Living Village runtime content. `Off` skills
must not be rolled during summoning, offered as rewards or training choices, selected by policy, or
accepted by runtime commands.

## Milestone proof

The subset is sufficient when repeated runs can expose each broad role, the player can form a party,
preview why it is strong or weak, resolve a floor encounter, inspect which skills were used, train a
chosen skill, and observe a repeatable change in a later encounter. The introductory roster needs
one legal party, not every role simultaneously. That proves the loop before adding catalog breadth.
