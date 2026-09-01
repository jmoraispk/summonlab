# Attributes and training

Wiki ID: `mechanics.progression.attributes-training`

Design status: **authoritative vocabulary with open tuning**. Might, Vitality, Agility, Dexterity,
Intellect, and Spirit are the accepted six attributes. Their numeric curves and the broader training
proposal remain subject to review.

## Three pillars and six attributes

The source begins with a warrior’s fable: a warrior needs strength to deliver and endure a blow,
speed so attack and defense arrive in time, and control so a strike lands only where intended. It
then adds understanding, which the fable omits and a pure fighter can afford to neglect.

| Axis | Physical | Mental |
| --- | --- | --- |
| Power—what is put out | Might | Intellect |
| Resilience—what is absorbed and sustained | Vitality | Spirit |
| Execution—how the act lands | Agility (how fast) | Dexterity (how exactly) |

| Attribute | Pillar | Proposed territory | Failure without it |
| --- | --- | --- | --- |
| Might | Strength | Physical damage, stagger force, carry capacity, equipment-weight tolerance, forceful interaction, heavy-weapon scaling | A blow connects but moves nothing |
| Vitality | Strength | Health, mitigation, poise, physical-status resistance | Death on the first mistake |
| Agility | Speed | Attack and movement speed, evasion, initiative, action economy | Acting last and being hit first |
| Dexterity | Control | Accuracy, critical rate, weak-point targeting, technique execution, crafting precision, finesse-weapon scaling | Real damage delivered unreliably |
| Intellect | Understanding | Magical magnitude, learning, analysis, identification, recipe comprehension | Unable to learn what is shown |
| Spirit | Control | Mana and regeneration, channel stability, control duration, mental resistance, stance upkeep | Running dry or losing a technique halfway |

Might mirrors Intellect as physical and mental output. Vitality mirrors Spirit as bodily and mental
endurance. Agility is the fist arriving quickly; Dexterity is its arriving at the intended point;
stopping it there is Spirit.

## Resources

The source proposes exactly two bars and explicitly rejects stamina:

| Bar | Driven by | Spent on | Restored by |
| --- | --- | --- | --- |
| Health | Vitality | Damage taken | Slow out-of-combat recovery, skills, consumables |
| Mana | Spirit | Every martial or magical skill | Continuous Spirit-scaled regeneration |

Internal energy treats a perfect sword cut and flame magic as techniques drawing on one resource.
Basic attacks, movement, and dodging cost nothing; pacing comes from mana, cooldowns, and poise. The
source argues that a stamina bar duplicates mana and creates the undesirable state of being unable
to dodge after choosing correctly.

## Three defenses

| Route | Attribute | Mechanism |
| --- | --- | --- |
| Absorb | Vitality | Larger Health pool, mitigation, and poise |
| Avoid | Agility | Evasion, movement, and acting first |
| Resist | Spirit | Mental resistance, shorter control effects, and channel stability |

Equipment also supplies mitigation, allowing a low-Vitality build to remain viable rather than only
fragile.

## Derived-stat map

| Derived stat | Primary | Support |
| --- | --- | --- |
| Health pool | Vitality | — |
| Mana pool | Spirit | — |
| Mana regeneration | Spirit | Intellect |
| Physical damage | Might | Dexterity |
| Magical damage | Intellect | Spirit |
| Critical rate | Dexterity | Agility |
| Critical damage | Might | Dexterity |
| Accuracy | Dexterity | Agility |
| Attack speed | Agility | Dexterity |
| Movement speed | Agility | — |
| Evasion | Agility | Dexterity |
| Initiative | Agility | Intellect |
| Armour/mitigation | Vitality | Might |
| Poise | Vitality | Might |
| Physical-status resistance | Vitality | Spirit |
| Mental-status resistance | Spirit | Intellect |
| Control duration inflicted | Spirit | Intellect |
| Channel stability | Spirit | Vitality |
| Learning rate | Intellect | Dexterity |
| Stance-upkeep efficiency | Spirit | Vitality |
| Carry capacity | Might | Vitality |
| Weight tolerance | Might | Vitality |
| Gathering yield | Dexterity | Intellect |
| Crafting quality | Dexterity | Intellect |

## Allocation and ceilings

- Level-earned attribute points are fully player allocated.
- Respec is available only through a rare item.
- The source proposes no hard or soft attribute ceiling.
- A level-10 hero can therefore become extremely trained while having little combat experience.
- Steep repetition decay is the natural brake: this route costs far more time and resources and
  does not also supply skills, affinity ranks, or battle-earned practice bonuses.
- Diminishing returns preserve readable specialist builds without an arbitrary wall.

## Training outside levels

Attribute practice costs time and actions rather than points. It is the non-kill route through which
a civic or other non-combat hero can become formidable.

| Attribute | Example training actions |
| --- | --- |
| Might | Weighted labor, forge work, hauling, wrestling, breaking stone, marching in armor |
| Vitality | Long marches, climate exposure, watch duty, hit-taking sparring, hard work in bad conditions |
| Agility | Footwork, obstacle traversal, climbing, dance, sprint intervals, dodge practice |
| Dexterity | Target practice, calligraphy, whittling, lockpicking, blade forms, instruments, fine crafting |
| Intellect | Reading, scholarly study, puzzles, star charts, alchemy, deciphering, recipe development |
| Spirit | Meditation, breathing forms, vigil, ritual, stillness at a leyline node |

One action can train two attributes: fine crafting may train Dexterity and Intellect, while marching
in armor trains Might and Vitality. This keeps the world from looking like a menu. Attribute
training uses the same repetition × quality × variety × aptitude practice model as skills and shows
the same yield.

## Passive and active modes

Most heroes are assigned to passive regimens between missions. Yield is steady and low, making it
the intended default for rosters of hundreds. Active training uses direct attention, a mentor, or a
dedicated facility for substantially higher yield, and some quality states—especially correction
from a mentor—exist only there. Limited active slots force an investment choice.

The strategic premise is that training halls, resident masters, and heroes teaching one another
compound into a long-term settlement advantage distinct from speed-climbing.

## Living Village subset

The milestone can begin with one static training facility, passive assignment, visible time cost,
one or two approved training actions per accepted attribute, and displayed yield. Mentorship,
active-slot optimization, cross-attribute actions, respec items, and uncapped long-run training can
remain deferred until the attribute vocabulary and numeric curves are accepted.
