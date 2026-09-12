# Overgeared — Item Property Sheets

Wiki ID: `research.overgeared.item-properties`

Research status: **user-supplied secondary synthesis; not Summonlab canon**.

This component page preserves the supplied item-property survey as research evidence. Its
coverage claims, interpretations, recommendations, and phrases such as “worth copying” are claims
from that source, not accepted Summonlab mechanics or implementation instructions. See the parent
[attribute-system research entry](../attribute-systems.md#overgeared-satisfy), the companion
[equipment catalogue](equipment-catalogue.md), and the companion
[equipment mechanics reference](equipment-mechanics.md).

Every property, on every item whose properties could be verified. Built as
brainstorming material for Summonlab equipment design.

**Coverage, stated plainly.** The wiki returns HTTP 402 to automated fetching,
including from the uploaded page's own links, so the ~134 individual item pages
cannot be opened. Everything below was harvested through the search index, which
surfaces each page's stat block but only for pages that happen to rank. **This
file covers 44 items in full.** The remaining ~90 are named in
`overgeared_grid_inventory.md` with rating and chapter but no properties, and
that gap cannot be closed without manual access.

What the 44 do give you is almost certainly the **complete property vocabulary** —
after the first twenty items, new mechanic *types* stopped appearing. Section 1
is that vocabulary, and it is the part worth designing against.

Flavour text is paraphrased throughout; mechanical values are quoted as data.

---

# 1. The complete property vocabulary

Every distinct mechanic type found across the 44 items. This is the brainstorming
surface — 38 mechanic types, most of which cost nothing in a damage equation.

## 1.1 Flat numeric

| Type | Examples found |
|---|---|
| Attack power, point value | 356, 695, 780 |
| Attack power, **range** | 370~601, 780~1,516, 41,508~??? |
| Durability, finite | 150, 350, 365, 490, 731 |
| Durability, **none** | Ruler's Cloak |
| Durability, **infinite** | Defying the Natural Order, some of Grid's boots |
| Defense | 15, 95, 130, 200 |
| Magic resistance | 200 |
| Health | +1,000, +3,000, +6,000 |
| Attribute | Intelligence +200, all stats +30 |
| Weight | 190, 410, 4,900 |

## 1.2 Percentage modifiers

Attack speed (+6%, +40%, **−6%**), movement speed (+8%, +10%), accuracy (+10%),
attack and defense rate (+10%), firing speed (+10%), skill power (+20%, +460%),
skill cooldown (−20%), skill usage speed (+65%), hit rate (+50%), healing
effectiveness (+300%), damage reduction (10%, 15%, 20%), defense penetration
(20%, 85% neutralisation), elemental damage riders (+50% lightning, +30% shadow),
specific resistances (black magic +10%, poison +10%).

**Note the negatives.** The Doppelganger's Greatsword carries −6% attack speed.
High rating does not mean strictly-better numbers.

## 1.3 Conditional — the largest family

| Condition type | Example |
|---|---|
| **Terrain** | +10% defense in canyons; +20% wide-area skill power in canyons |
| **Light level** | +80% attack power in dark places; +10/15/20% defense in dark places |
| **Target category** | Bonus damage vs great demons, archangels, gods, dragons; bonus vs monsters generally |
| **Target rank** | −10% enemy defense against great demons below rank 22 |
| **Enemy count** | Stronger against many opponents |
| **Climate** | Resistance varies with climate (Lantier's Cloak) |
| **Hit count** | Every fifth hit on one target is an automatic critical |
| **Combo window** | Linking a skill within 0.5 s of 3 Joint Attacks adds damage |
| **Stacking on repeat hits** | +10% attack power per hit on the same target, capped at +100% |
| **Ramping on use** | +1% firing speed per arrow, capped at +50% |
| **Own durability loss** | Emits flame each time durability drops; reflects damage per durability threshold |
| **Own health threshold** | Skill triggers when wearer drops below 10% health |
| **Wearer identity** | Effect applies only when the user is Grid |

## 1.4 Probabilistic

Low chance to nullify a physical attack entirely · 10% chance to block physical
attacks · low chance the cloak becomes bats on being hit · chance to trigger a
named skill on attack or on being hit · certain probability of casting a full
spell (Disintegrate, Meteor) on attack · high probability of a status effect
(blindness, burning) per attack · chance of hiding the weapon so the target fails
to perceive the attack · **30%/25%/20% chance that a dash skill fails** (a
probabilistic *drawback* that shrinks as the item's rating rises).

## 1.5 Resource and cooldown gating

Mana per basic attack (100) · mana per summon (1,500) · charge accumulation (one
dart per 20 s, max 3) · effect cooldowns (10 min, 60 min, 24 h) · summon re-use
lockout (24 h) · durability-fix window with recovery on a 24-hour cooldown.

## 1.6 Granted skills and abilities

Active skills (Fly, Quick Movements, Wind Blast, Penetrating Flash, Golden Flash,
Charge Command, Military Command) · passive skills (Immobile Fortress, Moving
Fortress, Impregnable, Divine Sword Unity) · **granted mastery ranks** (a God
Hand carries Advanced Blacksmith's Craftsmanship and mastered Advanced Weapons
and Shield Mastery) · **magic binding slots** — Twilight can hold up to three
magics or skills of any rating, with a failure chance.

## 1.7 Summons

Summon a named NPC ally · summon gated behind the item *growing* to a higher
rating · summoned ally that is not obliged to obey · summon that permanently ends
when the bound entity is freed.

## 1.8 Transformation and physical form

Item splits into two usable pieces with separate attack powers (930 / 1,480) ·
armour that evolves into a different, higher item · shape changes based on intent
· item combination into a new named item · an item whose form is a mechanism
(knobs that separate the blade).

## 1.9 Drawbacks, and they are real

| Drawback | Item |
|---|---|
| Cannot load arrows | Thunder Bow |
| 100 mana per basic attack | Thunder Bow |
| Trajectory hard to control | Spiral Quick Fire Bow |
| −6% attack speed | Doppelganger's Greatsword |
| Dash skills fail 20–30% of the time | Grid's Boots |
| Cannot move while the skill is active | Valhalla of Strong Trust |
| Wearer cannot be controlled for 2 minutes | Sword of Self-transcendence |
| **Wearer is driven to kill and becomes a reckless murderer** | Slaughterer's Eye Patch |
| Attracts monsters; offends other people | Malacus' Cloak |
| Permanently destroyed if durability hits zero | Valhalla of Infinite Affection |
| Low durability / fragile | Dagger of Bewitchment |
| Requires a stat the wearer cannot train | Mjolnir (3,500 dexterity) |

## 1.10 Requirements

Level · attribute minimums · **mastery skill at a named rank** · class · race ·
named individual · a title held · "chosen by the item" · profession (Daoist) ·
a specific technique at a specific level (Assassin Throwing Technique 7+).

## 1.11 Social, economic and meta

Item acquisition rate up · mastery experience on a successful hit · improved craft
outcome probability · commands that strengthen an army · influence over soldiers ·
marital status affecting stats through a **seven-state emotion track** · items
that attract monsters deliberately for farming.

---

# 2. Item sheets

## 2.1 Swords

### Defying the Natural Order
Only One · Durability **infinite** · Attack power **41,508~???**
- Attack skill usage speed +65%
- Attack skill power +460%
- Absolute hit rate +50%
- High probability of blindness or burning on every attack
- 85% chance to neutralise the target's defensive skills, magic and powers
- Bonus attack power vs great demons, archangels, gods, dragons
- +80% attack power in dark places
- Always hidden; target likely fails to perceive the attack
- Chance to cast Disintegrate on attack
- Chance to cast Meteor on attack
- Divine Sword Unity always active — **only when the user is Grid**

> The open-ended upper bound on attack power (`~???`) is a mechanic in itself.

### Twilight
Myth (Growth) · +1 · Conditions: Grid, Dragon Slayer, or Dragon Knight
- 85% chance to neutralise defensive skills, magic and powers
- Bonus attack power vs great demons, archangels, gods, dragons
- +80% attack power in dark places
- In bright places, normal probability of hiding the weapon; if hidden, target
  likely fails to perceive the attack
- **Can bind up to three magics or skills, no rating restriction, with a chance
  of failure**

> The binding slots are the standout: a weapon as a socket for the wearer's own
> abilities, with risk attached.

### Sword of Self-transcendence
Legendary · Durability 365 · Attack power 356
- Attack speed +6% · Accuracy +10% · Attack and defense rate +10%
- +200 flat damage per attack
- Grants Perfect State of Self-transcendence: all stats doubled for 2 minutes and
  immunity to all abnormal conditions — **wearer cannot be controlled for the
  duration**
- Requires level 160+, 950+ strength, Advanced Sword Mastery lv2+

### Doppelganger's Greatsword
Legendary · Durability 731 · Attack power **780~1,516**
- **Attack speed −6%**
- Ignores 20% of enemy defense
- Attack skill power +20%
- Requires level 320+, 2,010+ strength, Advanced Sword Mastery lv2+

> A copy of a legendary smith's work — resembling it in appearance only. The
> "counterfeit" concept is expressed as a wide damage range and a speed penalty.

### Grid's Greatsword (production method)
Legendary
- Every fifth hit on the same target is an **unconditional critical**
- Linking a skill within 0.5 s of 3 Joint Attacks adds damage
- Requires level 300+, 2,800+ strength, Advanced Sword Mastery lv5+

### Sword Ghost
Legendary · +7 · Higher durability and attack power than Mjolnir
- **Separates into two pieces: 930 attack power and 1,480 attack power**
- +10% attack power accumulating per hit on the same target, capped at +100%
- Mechanism: two knobs, one mid-blade, one at the base

### Efficient Hunting Sword
Unique · ×2 · +7
- Additional damage to monsters
- **Item acquisition rate increased**
- Requires level 300+, Advanced Sword Mastery lv3, 2,000 strength, 1,000 agility

> At +7 it reportedly out-hunted a +9 Iyarugt and a +9 Failure. Specialisation
> beating raw tier.

### Iyarugt
Legendary (Growth) · ego · Conditions: a person the sword chooses
- Critical strike causes bleeding for 3 s; bleed damage scales with attack power
- At 3 combos the bleed maximises: +200% damage to the target for 1 s
- At 5 combos the target's thinking is destroyed for 0.3 s, opening Hell Sword
- On growth: bleed extends to 5 s, window becomes +300% for 2 s, and Sword
  Demon's Senses is added (extreme evasion for 5 s)
- Gains experience from PvE and PvP at comparable rates

### Blue Dragon Sword Breaker
Legendary · Durability 350 · Attack power 695
- Attack speed +40%
- +50% lightning damage
- +30% shadow damage
- Emits a magnetic field with high probability of **attracting sword-type weapons**
- A pulled sword loses durability

> An anti-weapon weapon. The counter target is an equipment *class*, not a
> monster type.

### Failure
Legendary · +9 · Requires level 300+, **5,000+ strength**, Advanced Sword Mastery lv8+

### Dainsleif (Reproduction)
Unique · +8 · Strong against multiple opponents · Grants Golden Flash

### Mamon's Greatsword
Epic · Early-game; its attack power alone let a very low-level character hunt
level-20 monsters

## 2.2 Daggers

### Ideal Dagger
Unique · +8 · Requires level 180+, 450+ agility, Advanced Dagger Mastery
- Grants Quick Movements: evasion +30% and **agility doubled** for 1 minute;
  80 mana, 100 s cooldown
- Grants Wind Blast

### Dagger of Bewitchment
Requires level 100+, 200+ agility, **30+ strength**, Intermediate Dagger Mastery
- High attack power, **low durability**
- Bewitchment: target enters a non-resistant state for 3 seconds

## 2.3 Bows

### Thunder Bow
Unique · Durability 490 · Attack power **370~601**
- **Cannot load arrows**
- **100 mana consumed per attack**
- Firing speed +10%
- Grants Penetrating Flash
- Requires level 300+, 2,000+ agility, Advanced Bow Mastery lv5+

### Spiral Quick Fire Bow
- +1% firing speed per arrow fired, capped at +50%
- Arrow trajectory difficult to control
- **Bonus Bow Mastery experience on hitting the intended target**
- Requires level 300+, Advanced Bow Mastery lv2+

## 2.4 Hammers, axes, spears

### Mjolnir – Human World Version
Legendary · ×3 · +7 · Weight **4,900**
- Target struck is rigid for 0.3 s
- Hits from other Mjolnirs cause 0.1 s stiffness; alternating Mjolnirs can chain
  stiffness indefinitely
- Enhanced version: 100% accuracy, Magic Detection (Enhanced), accuracy bonus
  raised to 50%
- Requires level 350+, 3,000+ strength, **3,500+ dexterity**

### Daoist Woodcutting Axe
Legendary · Durability 1,000
- **Emits strong flames each time durability is lost**
- Cuts and influences white phosphorus trees specifically
- Requires: Daoist

### Gale Spear
Unique · Very light, framed as both advantage and drawback
- Requires level 240+, 750+ strength, 400+ agility, Advanced Spear Mastery lv2+

## 2.5 Armour

### Valhalla of Infinite Affection
Secret · +3 · Conditions: Grid
- Covered in poison
- Grants **Moving Fortress**: triggers when wearer's health drops below 10%
  (toggleable). Converts the armour's durability to defense at 1 durability =
  2 defense. Immunity to all conditions including physical statuses. Lasts one
  minute, after which current durability is set to 30 and then restored by a
  third of maximum. **If durability reaches zero the item is permanently
  destroyed.**
- Grants **Impregnable**: deals half of all damage received in the last five
  minutes across a 50-metre radius
- Can become Myth rated depending on the wearer's actions
- Can be evolved from Holy Light Armor

> The best single item in the set. A defensive skill that spends the item itself
> as its resource, with permanent destruction as the failure state.

### Valhalla of Strong Trust
Myth · Made for a vampire, from strengthened Black Iron and Blue Orichalcum
- Defense increases in the dark
- Defense increases against multiple enemies
- Boosted blood absorption
- Grants **Immobile Fortress**: reflects damage each time armour durability falls
  by a threshold — **wearer cannot move while active**

### Holy Light Armor
Legendary (Set) · Adamantium · Originally name-locked
- High chance to resist dark magic
- **Healing effectiveness +300%**
- Increased physical attack resistance
- Later dyed for fire resistance; seven Pavranium blades fitted as a tail

### Three Layers
Legendary · Defense superior to the Holy Light Set, though with worse options and
durability · Carries a Sword Breaker skill

### Mengel's Plate Armor
Rare · Strength +10 · Negated damage from low-level monsters at low character level

## 2.6 Cloaks

### Fenrir's Cloak
Epic (Growth)
- Reduces damage from **all** attack types by 15%
- Resistance always applies, regardless of climate
- Low probability that part of the cloak turns into bats when hit. Durability and
  options are unaffected. Bats attack perceived enemies, deal **500 fixed damage
  each**, disturb the target's vision, and **restore the wearer's health by 100%
  of damage dealt**. Tested at 31 bats — up to 15,000 fixed damage and an equal
  heal.
- Higher rating increases both bat probability and bat count
- At legendary: can summon Vampire Marquis Fenrir

### Lantier's Cloak
Legendary · +4 · Requires level 320+
- Reduces stab, cut and throwing damage by 20%
- Resistance scales with **climate**
- **10% probability of blocking a physical attack outright**
- Outer layer puri minotaur leather, lining chameleon lord leather; because the
  chameleon layer is inward-facing, the stealth and sight-disruption effects
  explicitly **do not** apply

> Two cloaks with opposite designs — narrow-but-deep mitigation with a block
> proc, versus broad-but-shallow mitigation with a lifesteal proc. A clean
> template for parallel items at different ratings.

### Ruler's Cloak
Legendary · **Durability: none**
- Grants Charge Command, Military Command, and a third command skill
- Reward for being the first user to create a knights division

### Malacus' Cloak
Unique · Durability 81 · Defense 15 · Requires level 200+
- **Intelligence +200**
- Bloody smell: the wearer attracts beasts and monsters and offends other people

> Used deliberately to pull monsters for grinding. A drawback repurposed as a
> farming tool.

### Hooded Zip-Up
Unique · Built for invisibility; also increases wind resistance and speed

## 2.7 Boots, gloves, shoulders

### Braham's Boots
Unique · Durability 150 · Defense 130 · Requires level 240+
- Movement speed +10%
- **Skill cooldown −20%**
- Grants **Fly**

### Grid's Boots
Unique · Heavy boots built to support greatsword use, at the cost of evasion
- **Dash skills fail 30% / 25% / 20% of the time** (improves with rating)
- Defense +10% / +15% / +20% **in dark places** (improves with rating)

> Note the pattern: rating improves the drawback *and* the conditional together.
> A single rating axis moving two numbers in the same direction.

### Alex's Quick Gloves
Legendary · +4 · Roughly **halves the basic attack interval** (0.8 s → 0.4 s)

### Holy Light Gloves
Legendary (Set) · Attack speed and accuracy up · Low chance to trigger 5 Joint
Attacks

### The Best Gauntlets
Epic · Built for speed · Chance of attacking twice in a single attack

### Adventurer's Boots
Epic · Built for speed

### Tiramet's Shoulderguards
Unique · Defense 95 · Health +3,000 · Weight 190 · Requires level 320+
- **Low chance of nullifying a physical attack entirely**

## 2.8 Shields

### Amethyst Shield
Epic · Durability 200 · Defense 200 · Magic resistance 200
- Explicitly described as unremarkable in performance
- **Combines with the Red Mirror and Stone of Life to summon a high-ranking great
  demon**

> A mediocre combat item that is a key crafting component. Two separate value
> axes on one object.

### Perfect Divine Shield
Legendary · Weakens dark-aligned spells · Grants light-based abilities

### Divine Shield
Rare

## 2.9 Accessories

### Doran's Ring
Unique · Durability 10
- Health +1,000 · Black magic resistance +10% · Poison resistance +10%
- Poison or curse is cleared immediately on being applied (60 min cooldown)
- **50% of damage received is instantly recovered** (10 min cooldown)

### Ring of Pledge
Unique · Marriage ring
- While with the spouse: movement speed +8%, **all stats +30**
- Effect varies across a **seven-state emotion track** — happiness, joy,
  contentment, normal, dissatisfaction, depression, hate — driven by the spouse's
  liking

> An item whose numbers are driven by a relationship state that lives outside the
> item entirely.

### Elfin Stone's Ring
Epic (Growth)
- Healing / life steal that **applies to skills as well as attacks**
- At legendary: can summon Vampire Earl Elfin Stone — who is **not obliged to obey**

### Tiramet's Belt
Epic (Growth)
- Reduces damage taken by 10%
- At legendary: summons Vampire Viscount Tiramet for **1,500 mana**; if Tiramet
  dies, 24-hour lockout
- **Lost the summon permanently once Tiramet was freed from the belt**

### Kenen's Dart Belt
Unique
- Charges one dart every 20 seconds, up to 3 stored
- **Dart type is random**, with different effects per type — poison, smokescreen,
  explosion
- Requires Assassin Throwing Technique level 7+

### Arube's Ring
Unique · Lets the wearer twist up to five strands of silver thread into a desired
shape · Explicitly **less useful to those with high dexterity**

### Slaughterer's Eye Patch
Unique
- Reveals vital points on any lifeform
- **An item with a grudge: the wearer is dominated by the impulse to kill and
  becomes a reckless murderer**

### Holy Light Crown
Legendary (Set) · Intelligence and Dignity up

### Holy Light Set (3 pieces)
Defense +500 · Health +6,000

## 2.10 Ego items and tools

### God Hand (Item 3)
Legendary (Growth) · ego
- **Item skills activate without consuming resources**; buff skills affect the owner
- Carries Advanced Blacksmith's Craftsmanship
- Carries mastered Advanced Weapons Mastery and Shield Mastery
- High probability of triggering Crush on attack
- Chance of triggering Reconstruction when hit
- Defense +10% in canyon terrain
- Wide-area skill power +20% in canyon terrain
- Target's defense and magic resistance −10% vs great demons below rank 22
- On receiving destroying damage, durability is **fixed for at least 5 seconds**,
  then recovers 10% (24 h cooldown)

> The richest single sheet in the set: ten properties spanning resources,
> masteries, procs, terrain, target rank and a death-save.

### Unknown Master Blacksmith's Hammer
Epic · Raises the probability of producing a higher-rated item · No combat function

### Special Jaffa Arrow
Epic · Ignores part or all of target defense · Usable as a spear

---

# 3. What to take from this

**Conditionals outnumber flat numbers roughly two to one**, and they cost nothing
in the damage equation. Terrain, light level, target category, target rank, enemy
count, hit count, combo state, own durability, own health, wearer identity — all
key off state a tick-based engine already tracks. This is where Summonlab
equipment identity should live.

**Every strong item has a real drawback.** Not a lower number — an actual cost:
cannot load arrows, cannot move, cannot be controlled, dash fails one time in
four, becomes a murderer. Ratings buy *more properties*, not strictly better
ones, which is what keeps low-tier gear situationally alive and makes an item
feel like a decision.

**Items spend themselves.** Moving Fortress converts durability into defense and
permanently destroys the armour at zero. The Daoist axe emits flame as durability
drops. Immobile Fortress reflects damage per durability threshold. Durability is
not a repair tax here — it is **a resource the item can burn**. That reframing is
free and it makes maintenance interesting.

**Growth items gate their best effect behind the growth.** Three separate vampire
accessories summon their bound NPC only at legendary. The item is not merely
stronger when grown; it becomes a different object. Worth copying directly given
the long tower climb.

**Drawbacks improve with rating alongside the bonus.** Grid's Boots move dash
failure 30% → 25% → 20% while dark-place defense moves +10% → +15% → +20%. One
rating axis, two numbers, same direction. Cheap and elegant.

**Some items have two unrelated value axes.** The Amethyst Shield is a poor shield
and a required summoning reagent. A crafting hammer occupies a weapon slot and
does nothing in combat. Slot cost versus non-combat value is a real decision.

**Paired items make better design than a single ladder.** Fenrir's Cloak and
Lantier's Cloak solve the same problem oppositely — broad shallow mitigation with
a lifesteal proc versus narrow deep mitigation with a block proc, at different
ratings, with the lower-rated one arguably better. Designing items in opposed
pairs produces more interesting choices than designing them in tiers.

**The requirement line is where class identity lives.** Level, attribute floors,
mastery rank, class, race, profession, a named person, a held title, or the item's
own choice. Summonlab already has ranked skills; `requires: Archery, Advanced 5`
does the same work with no new system.
