# Attribute-System Research

Wiki ID: `research.attribute-systems`

This internal notebook collects attribute systems encountered during game research. Entries record
what a source says before comparing it with Summonlab, so inspiration and project decisions do not
silently become one another.

This page is evidence, not canon. Summonlab's accepted four-attribute direction remains `Strength`,
`Vitality`, `Agility`, and `Spirit` as defined by the
[four-attribute design](../../superpowers/specs/2026-09-06-attributes-and-combat-modes-design.md).
The public [Attributes](../mechanics/attributes.md) page still describes the earlier six-attribute
draft and requires a separate convergence update.

## Comparison questions

Each example should help answer these questions:

1. What distinct player decisions does each attribute create?
2. Which territories are innate capacity, learned skill, equipment, or current condition instead?
3. Does an attribute govern a resource bar, a derived statistic, or both?
4. Does one attribute collect too many desirable outcomes and become an automatic investment?
5. Would removing an attribute erase a meaningful build, or only move its effects elsewhere?

The current investigation is especially interested in two boundaries:

- **Dexterity:** whether accuracy, fine control, weak-point execution, and crafting precision create
  a useful cross-system identity, or are better expressed through specific skill mastery.
- **Endurance / Stamina:** whether sustained physical effort needs a persistent attribute, a spendable
  combat resource, skill-specific costs, or temporary fatigue and condition state.

## Loop Bound

### Source record

- **Captured:** 2026-09-12
- **Material:** user-supplied screenshot of a text summary headed “The core stat attributes in the
  Loop Bound universe.”
- **Attribution confidence:** unverified secondary capture; no author, publication, rules edition,
  or public source URL was supplied.
- **Interpretation rule:** the table below paraphrases only the supplied capture. It is not a claim
  that the list is complete or that the labels are implemented exactly this way in a released game.

### Reported system

The source presents five attribute categories. Two category labels use paired terms rather than
establishing whether each term is a separate statistic.

| Reported category | Territory assigned by the source |
| --- | --- |
| Agility | Movement speed, reflexes, attack speed, evasion, and dodging fast attacks |
| Strength | Physical force, melee damage, carrying capacity, and heavy physical skills |
| Vitality | Maximum Health and general physical durability or defence |
| Endurance / Stamina | Lung capacity, sustained effort, exhaustion resistance, and prolonged fighting |
| Intelligence / Willpower | Mana, spell potency, processing speed, and resistance to psychic or status debuffs |

### Comparison with Summonlab's four-attribute direction

| Loop Bound territory | Closest Summonlab owner | Research signal |
| --- | --- | --- |
| Strength | Strength | Strong direct overlap: force, physical damage, carrying, and heavy equipment or actions |
| Vitality | Vitality plus armour/equipment | Both associate Vitality with Health; Loop Bound also gives it broad defence that Summonlab deliberately assigns to armour and named resistances |
| Agility | Agility plus action rules | Strong overlap in movement, evasion, and speed; the example does not use Dexterity to own accuracy or precision |
| Endurance / Stamina | Current condition, action costs, skills, and recovery rules | Exposes a sustained-effort fantasy absent from the base four, but does not by itself show that a permanent attribute or universal bar is needed |
| Intelligence / Willpower | Spirit plus learned skills and explicit resistances | The source bundles magical output, cognition, resource capacity, and resistance; Summonlab intentionally separates learned knowledge and decision quality from combat attributes |

### What this example contributes

- A five-category model can make prolonged exertion explicit without adding Dexterity.
- Its Agility territory is already broad, but it does not also claim accuracy, critical rate,
  weak-point execution, or fine crafting. This preserves space for those outcomes to live in skills.
- Separating Vitality from Endurance distinguishes surviving damage from continuing to exert oneself.
  That distinction is thematically legible even if Summonlab eventually models endurance as
  condition rather than an attribute.
- The combined Intelligence / Willpower category demonstrates the compression cost of a smaller
  attribute list: magical power, cognition, mana, and resistance become one investment unless other
  systems limit the coupling.

### Questions to carry forward

- Which recurring Summonlab actions would produce meaningfully different outcomes from Dexterity
  after skill mastery, equipment, and Agility are already accounted for?
- Does long-duration exploration, hauling, forced marching, labour, or repeated combat need a shared
  exhaustion model outside Health and Mana?
- If fatigue exists, should characters differ through a base attribute, learned endurance skills,
  physiology, equipment, current needs, or some combination?
- Can an Endurance attribute avoid becoming “Vitality again,” and can a stamina bar avoid becoming
  “Mana for physical actions”?

## Overgeared (Satisfy)

### Source record

- **Captured:** 2026-09-12
- **Material:** three user-supplied screenshots concerning the stat system in the *Overgeared*
  manhwa's game, Satisfy. One is a six-year-old r/Overgeared question and community reply; two are
  synthesized summaries displaying source chips without preserving the underlying URLs.
- **Attribution confidence:** mixed, unverified secondary material. The community reply is an
  anecdotal interpretation, while the synthesized summaries cannot be traced to their cited pages
  from the captures alone.
- **Interpretation rule:** the sections below preserve agreement and disagreement between the
  captures. Exact formulas and story claims are research leads, not verified rules.

### Reported primary system

The synthesized summary identifies four freely allocated primary combat stats and says their
returns change every 100 levels through Stat Awakening.

| Reported attribute | Territory assigned by the source |
| --- | --- |
| Strength | Physical attack power, maximum Health contribution, and carrying limits |
| Stamina | Physical defence, maximum Health, and physical endurance |
| Agility | Movement speed, attack speed, dodge rate, and physical accuracy; may become a primary damage route for swift classes |
| Intelligence | Magical attack power, maximum Mana, and magic resistance |

The summary gives example pre- and post-awakening conversions for Strength and Stamina. Because the
screenshots do not preserve their linked sources, the exact numbers are intentionally omitted here
until they can be checked against a primary or attributable reference.

### Dexterity as a special production stat

The third capture describes Dexterity outside the four primary combat stats:

- production classes unlock it instead of receiving it through ordinary free-point allocation;
- manual crafting practice raises it;
- it represents hand-eye coordination and fine motor control;
- higher Dexterity reportedly improves the chance of producing higher-tier gear and reduces the
  physical time required for complex crafting;
- the story reportedly lets sufficiently developed physical mastery carry into real-world motor
  ability.

This is materially different from making Dexterity a universal combat stat. It behaves more like an
earned production capability whose availability, growth method, and benefits are bound to practiced
work.

### Community account of damage scaling

The r/Overgeared reply makes several additional claims:

- Strength directly adds attack power, with more attack power per point after later awakenings;
- Stamina contributes a smaller amount of attack power;
- equipment adds to attack power before skill damage is applied;
- before level 400, Agility affects speed and hit rate but not base attack power;
- a later one-to-one “golden ratio” between Strength and Agility reportedly unlocks extra attack
  power and special basic-attack behavior.

That account conflicts with the synthesized summary's broader statement that Agility is a primary
damage-scaling stat for assassins and archers. The difference may reflect class rules, level bands,
later story mechanics, or an inaccurate source. This notebook leaves the conflict open.

### Comparison with Summonlab's four-attribute direction

| Overgeared territory | Closest Summonlab owner | Research signal |
| --- | --- | --- |
| Strength | Strength plus Vitality | Overgeared appears to couple physical output, Health, and carrying; Summonlab separates Health into Vitality to reduce the value concentrated in Strength |
| Stamina | Vitality plus condition/recovery rules | The capture uses Stamina as a persistent defensive stat, not clearly as a spendable action bar; its overlap with Vitality is stronger than with a universal stamina resource |
| Agility | Agility plus skill/class rules | Speed, evasion, accuracy, and conditional damage show how one stat can accumulate both reliability and throughput; the disagreement between sources reinforces the need for explicit level and class scopes |
| Intelligence | Spirit plus learned skills and named resistance | Magical output and Mana map toward Spirit, while Summonlab keeps knowledge and blanket resistance outside the base combat attribute |
| Special Dexterity | Craft mastery or a production-specific capability | The example supports precision as something unlocked and raised through relevant practice rather than a universal freely allocated base stat |

### What this example contributes

- “Stamina” can name constitution and defence without implying a stamina bar. Attribute name,
  persistent capacity, and spendable resource are separate design decisions.
- Stat Awakening creates visible progression eras, but changing per-point conversions at fixed level
  thresholds can make allocation timing and old build advice difficult to read.
- Dexterity can support a strong character fantasy without competing for one of the universal combat
  slots. Its identity comes from exclusive access, practice-led growth, and production outcomes.
- Strength/Agility ratios demonstrate a third option beyond independent stats or derived totals:
  authored relationships between investments can unlock techniques. Such rules need visible
  thresholds and cannot rely on community discovery alone in Summonlab.

### Questions to carry forward

- Would a production-only Dexterity track add more than existing craft-family mastery and domain
  aptitude, or would it duplicate them under a familiar RPG label?
- Is there a useful distinction between Vitality as injury tolerance and Stamina as sustained labour
  if neither creates a spendable combat bar?
- Should any paired attribute investment unlock techniques, or should all such thresholds belong to
  named skills and equipment?
- If attribute returns change by progression tier, how can a character sheet explain the current
  conversion without hiding future breakpoints?

## Entry template

Future examples should add:

1. source name, capture date, URL or artifact description, and attribution confidence;
2. a neutral account of its attributes and assigned territories;
3. a comparison with Summonlab's current model;
4. the useful design signal, including any coupling or redundancy;
5. questions the example raises without treating it as a recommendation.
