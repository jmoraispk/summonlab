# Overgeared — Equipment Mechanics

Wiki ID: `research.overgeared.equipment-mechanics`

Research status: **user-supplied secondary synthesis; not Summonlab canon**.

This component page preserves the supplied mechanics analysis as research evidence. Its
interpretations and design observations are claims from that source, not accepted Summonlab
mechanics or implementation instructions. See the parent
[attribute-system research entry](../attribute-systems.md#overgeared-satisfy) and the companion
[equipment catalogue](equipment-catalogue.md).

How Overgeared equipment works: the property taxonomy, and worked item sheets
illustrating each part of it. Numbers come from the Overgeared wiki and cited
chapter snippets; where a figure is ambiguous in the source it is marked
*(uncertain)*.

Companion page: [Equipment catalogue](equipment-catalogue.md) for the full inventory, slot counts,
and rating distribution.

Reference gathered for Summonlab design comparison, September 2026.

---

## Part 1 — The property taxonomy

Every Overgeared equipment item is assembled from the same fifteen slots. This
list is the useful artefact; the individual sheets below are illustrations of it.

| # | Property | Role in combat |
|---|---|---|
| 1 | **Rating** | normal → rare → epic → unique → legendary → myth. Sets the budget for everything else. |
| 2 | **Durability** | Degrades in use, needs repair. A soft tax on being overgeared. |
| 3 | **Attack power** | Flat number added to the wearer's attack power. Sometimes a **range** (min~max) rather than a point value. |
| 4 | **Defense** | Flat number reducing incoming damage through a non-linear curve. |
| 5 | **Stat bonuses** | Flat additions to primary or special stats (+agility, +intelligence, +dignity). |
| 6 | **Derived-stat bonuses** | Flat health, mana, defense — bypassing the attribute layer entirely. |
| 7 | **Percentage modifiers** | Attack speed, accuracy, firing speed, healing effectiveness, damage resistances. |
| 8 | **Attached skills** | The item grants an active skill while equipped. Lost when unequipped. |
| 9 | **Proc effects** | Low-probability triggers on hit, on damage taken, on durability loss. |
| 10 | **Drawback options** | Deliberate negatives: mana cost per swing, poor trajectory, fragility, ammunition restrictions. |
| 11 | **Requirements** | Level + stat minimums + **weapon mastery rank** + occasionally a named-person or class condition. |
| 12 | **Weight** | Consumes carry capacity, which is derived from Strength. |
| 13 | **Set membership** | Extra bonuses at 2/3/4 pieces. |
| 14 | **Growth** | Item accumulates experience and rises one rating tier. |
| 15 | **Meta options** | Effects outside combat resolution — bonus mastery experience, improved craft outcomes. |

**The design observation:** slots 3–7 are the *numeric* layer and are boring but
load-bearing. Slots 8–10 are the *identity* layer and are what make a weapon
memorable. Slots 11 and 15 are what make weapons class-defining without a class
system.

---

## Part 2 — Item sheets

### Ideal Dagger

| Field | Value |
|---|---|
| Rating | Unique |
| Slot | Weapon (dagger) |
| Requirements | Level 180+, 450+ Agility, Advanced Dagger Mastery |
| Attached skills | **Quick Movements**, **Wind Blast** |
| Quick Movements | Doubles Agility and adds +30% evasion for 1 minute. 80 mana, 100s cooldown |
| Notable | Gains its power from an option package rather than raw attack power |

**Why it matters.** The defining assassin weapon in the series, and its identity
is almost entirely in slot 8. Doubling Agility for a minute is a burst-window
item skill — the wearer becomes a different character for 60 seconds. Note that
Grid explicitly judged these options *non-transferable* to a heavy sword: the
same option on a greatsword would not produce the same effect. Option-to-weapon
fitness is a real constraint in this system.

---

### Dagger of Bewitchment

| Field | Value |
|---|---|
| Rating | Not confirmed (competition-tier craft) |
| Slot | Weapon (dagger) |
| Requirements | Level 100+, 200+ Agility, 30+ Strength, Intermediate Dagger Mastery |
| Attack power | High for its tier |
| Drawback | Low durability — fragile |
| Signature option | **Bewitchment**: target enters a non-resistant state for 3 seconds |

**Why it matters.** A clean three-term design: high damage, low durability,
one control option. The 3-second no-resist window is a *setup* effect — it makes
the dagger a support-assassin tool rather than a damage-race weapon. Also note
the requirement shape: high Agility, *trivial* Strength (30). The stat floor is
what says "this is a rogue weapon," not a separate finesse attribute.

---

### Thunder Bow

| Field | Value |
|---|---|
| Rating | Unique |
| Slot | Weapon (bow) |
| Durability | 490 |
| Attack power | 370 ~ 601 (a range, not a point value) |
| Requirements | Level 300+, 2,000+ Agility, Advanced Bow Mastery level 5+ |
| Modifier | +10% firing speed |
| Attached skill | **Penetrating Flash** |
| Drawbacks | Cannot load arrows; consumes 100 mana per attack |

**Why it matters.** The most instructive sheet in the set. It has a damage
*range* (variance baked into the weapon), a hard resource cost per basic attack
(100 mana per shot makes it unusable for most archers), and an ammunition
restriction. Three separate drawbacks against a very high attack power. This is
how Overgeared makes a weapon feel *specific* rather than just numerically better.

---

### Spiral Quick Fire Bow

| Field | Value |
|---|---|
| Rating | Not confirmed |
| Slot | Weapon (bow) |
| Requirements | Level 300+, Advanced Bow Mastery level 2+ |
| Ramping option | Each arrow fired increases firing speed by 1%, capped at +50% |
| Drawback | Arrow trajectory is difficult to control |
| Meta option | Hitting the intended target grants bonus Bow Mastery experience |

**Why it matters.** Two mechanics worth stealing. First, the **ramp**: a
within-encounter stacking bonus with a hard cap, which rewards sustained
engagement rather than burst. Second, the **meta option** in slot 15 — the weapon
accelerates the wearer's own mastery progression. That is a training item
disguised as a weapon, and it is a very good fit for offline progression.

---

### Gale Spear

| Field | Value |
|---|---|
| Rating | Unique |
| Slot | Weapon (spear) |
| Requirements | Level 240+, 750+ Strength, 400+ Agility, Advanced Spear Mastery level 2+ |
| Characteristic | Very light — explicitly framed as both advantage and drawback |

**Why it matters.** The **dual stat requirement** is the point. Daggers gate on
Agility with a token Strength floor; greatswords gate on Strength; spears demand
both. Weapon class identity is expressed as a *stat ratio requirement*, which is
how Overgeared gets ranger/assassin/warrior separation out of four attributes.

---

### Sword of Self-transcendence

| Field | Value |
|---|---|
| Rating | Legendary |
| Slot | Weapon (sword) |
| Durability | 365 |
| Attack power | 356 |
| Modifiers | Attack speed +6%, Accuracy +10%, Attack and defense rate +10% |
| Flat bonus | +200 damage on each attack |
| Attached skill | **Perfect State of Self-transcendence** |
| Skill effect | All stats doubled for 2 minutes, resists all abnormal conditions — but the wearer cannot be controlled for the duration |
| Requirements | Level 160+, 950+ Strength, Advanced Sword Mastery lv2+ |

**Why it matters.** The most completely published item block in the series, and
the best single example of the taxonomy in action: a flat attack power term, an
interval modifier, two percentage modifiers, a flat post-multiplier bonus, and a
granted skill — five distinct budget classes on one sword.

The **+200 flat damage per attack** is the subtle one: applied after the
percentage layer, it is enormous on a fast weapon and negligible on a slow one.
Any system with both flat-per-hit damage and variable attack speed has this
hidden interaction.

The granted skill is the drawback masterclass. Doubling *all* stats for two
minutes with full status immunity is an extraordinary spike, and the price is not
a resource — it is **loss of control of the character**. No mana cost could have
balanced that effect; a behavioural cost could.

---

### Failure

| Field | Value |
|---|---|
| Rating | Legendary |
| Slot | Weapon (greatsword) |
| Requirements | Level 300+, **5,000+ Strength**, Advanced Sword Mastery level 8+ |
| Notes | Grid's fifth legendary craft; first item he designed himself |

**Why it matters.** Compare the Strength floor here (5,000) with the Dagger of
Bewitchment's (30). That is a ~167× spread on the same attribute across two
weapon classes. The requirement table is doing enormous identity work.

---

### Daoist Woodcutting Axe

| Field | Value |
|---|---|
| Rating | Legendary |
| Slot | Weapon (axe) |
| Durability | 1,000 |
| Attack power | ~310 *(uncertain — source digit ambiguity)* |
| Weight | ~410 *(uncertain)* |
| Proc | Emits strong flames each time durability is lost |
| Conditional | Cuts and influences white phosphorus trees specifically |
| Requirements | Daoist |

**Why it matters.** The flame proc keys off **durability loss** — an unusual
trigger that turns a maintenance cost into an offensive resource. Also note the
*environmentally conditional* option: it interacts with one specific material in
the world. Situational options like this are cheap to author and make a world
feel responsive.

---

### Special Jaffa Arrow

| Field | Value |
|---|---|
| Rating | Epic |
| Slot | Consumable / improvised weapon |
| Signature option | Ignores part or all of the target's defense |
| Flexibility | Usable as a spear as well as an arrow |

**Why it matters.** Defense penetration as an item property rather than an
attribute. Given that defense is non-linear, penetration is disproportionately
valuable against high-defense targets — this is an anti-tank tool, not a
general damage increase.

---

### Dainsleif (Reproduction)

| Field | Value |
|---|---|
| Rating | Unique |
| Slot | Weapon (greatsword) |
| Signature | Notably strong against multiple opponents |
| Attached skill | **Golden Flash** |

**Why it matters.** "Strong against many opponents" is a **target-count
conditional** — the weapon's value depends on encounter shape rather than enemy
type. Maps almost directly onto a Swarming defensive profile.

---

### Holy Light Armor

| Field | Value |
|---|---|
| Rating | Legendary (later raised by +1 tier via a craft effect) |
| Slot | Chest |
| Material | Adamantium |
| Options | High chance to resist dark magic; **healing effectiveness +300%**; increased physical attack resistance |
| Requirements | Originally name-locked to a specific person |
| Set | Holy Light Set |

**Why it matters.** The +300% healing multiplier is the interesting term — a
defensive item that multiplies an *ally's* output rather than reducing incoming
damage. That makes it a team-composition item. Also note the name-lock: a
requirement that no player can satisfy by building toward it.

---

### Holy Light Gloves

| Field | Value |
|---|---|
| Rating | Legendary (set piece) |
| Slot | Hands |
| Options | Increased attack speed; increased accuracy |
| Proc | Low chance to activate **5 Joint Attacks** |

**Why it matters.** Gloves carry attack speed and accuracy — the two things
Dexterity would own in a five-attribute system. They are on the *gear*, not on
an attribute.

---

### Holy Light Crown

| Field | Value |
|---|---|
| Rating | Legendary (set piece) |
| Slot | Head |
| Options | +Intelligence, +Dignity |

**Why it matters.** A piece that grants a **special stat** (Dignity) alongside a
primary. Gear is one of the routes by which unallocatable stats accumulate.

---

### Holy Light Set (3 pieces)

| Field | Value |
|---|---|
| Pieces | Armor + Gloves + Crown |
| 3-piece bonus | +500 Defense, +6,000 Health |

**Why it matters.** The set bonus is pure flat derived stats — no new mechanics,
just a large numeric reward for completing the collection. Cheap to author,
strong pull on acquisition behaviour.

---

### Alex's Quick Gloves

| Field | Value |
|---|---|
| Slot | Hands |
| Effect | Roughly **halves** the basic attack interval |

**Why it matters.** This is the single most powerful gear effect in the reference
set, because it multiplies the number of attacks rather than the damage of each.
At 2,876 Agility, Grid's base attack interval is 0.8s; with these gloves it is
0.4s, roughly two basic attacks per second. One glove slot is worth about 2,876
points of Agility. Worth staring at before deciding how much power gear carries.

---

### Perfect Divine Shield

| Field | Value |
|---|---|
| Rating | Legendary |
| Slot | Off-hand |
| Options | Weakens dark-aligned spells; grants light-based abilities |

**Why it matters.** An explicitly **element-countering** defensive item. The
affinity system reaches gear, not just skills.

---

### Iyarugt

| Field | Value |
|---|---|
| Rating | Legendary (growth), ego item |
| Slot | Weapon (one-handed sword) |
| Requirements | A person the sword chooses |
| Crit option | Critical strike inflicts bleeding for 3s; bleed damage scales with attack power |
| 3-combo option | Bleed maximises; damage to target +200% for 1 second |
| 5-combo option | Target's thinking destroyed for 0.3s, opening the linked skill *Hell Sword* |
| Growth | Bleed extends to 5s, window becomes +300% for 2s, and *Sword Demon's Senses* is added (extreme evasion for 5s) |
| Experience | Accumulates from combat; PvP gain comparable to PvE |

**Why it matters.** Two things at once.

**The conditional layer.** None of Iyarugt's options touch the damage equation.
They key off *crit* and *combo count* — events the engine already tracks. This is
where weapon identity can live at essentially zero balance cost, and it is far
richer than another +N attack power.

**Growth as retention.** The weapon levels, and its option *values* improve rather
than being replaced. This is the answer to "how does a crafted item stay relevant
across 200 levels" without rebuying gear — directly relevant to a long tower
climb and to making a crafted item worth becoming attached to.

---

### Unknown Master Blacksmith's Hammer

| Field | Value |
|---|---|
| Type | Crafting tool (occupies a weapon slot) |
| Effect | Raises the chance of producing a higher-rated item |

**Why it matters.** A slot 15 item: it has no combat function at all, and exists
purely to bias craft outcomes. Establishes that gear slots are a *shared* budget
between combat and production roles.

---

## Part 3 — What the sheets show collectively

**Weapons carry identity through options, not through attack power.** The attack
power numbers are unremarkable and roughly tier-consistent. What distinguishes
the Thunder Bow from any other bow is: mana per shot, no arrows, a granted skill,
+10% firing speed, and a damage range. Five options, three of them negative.

**Drawbacks are as common as bonuses on high-tier items.** Fragility, mana taxes,
ammunition restrictions, control difficulty. High rating means *more options*,
not *strictly better options*. This is what keeps low-tier gear situationally
alive.

**Requirements are the class system.** Level + stat floors + mastery rank, in
every single weapon sheet. No weapon is gated by a "Ranger" tag.

**Attack speed lives on gear.** Agility sets a baseline attack interval, but a
single glove slot can halve it. The multiplicative term is on the item.

**Set bonuses and growth handle retention.** Sets reward completion; growth items
reward keeping one weapon. Both are counters to gear churn.
