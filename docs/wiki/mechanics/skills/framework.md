# Skill Framework

Wiki ID: `skills.framework`

Design status: **draft source import**. This page preserves Parts 4 and 5 of the supplied progression draft. Conflicts with accepted architecture are listed in the [skill index](README.md) and must be resolved before implementation.

## Part 4 — Skills

### 4.1 Two independent axes

| Axis | What it is | How it moves | Belongs to |
|---|---|---|---|
| **Rarity** | What the skill fundamentally is — its power band, its bonus count, its cost efficiency | Fixed at creation. **Never increases.** | The skill |
| **Mastery** | How much of the skill the bearer has realised | Repetition, quality and variety of practice | This hero's relationship with the skill |

**Rarity is real power, immediately.** A Legendary skill is roughly one acquisition in a hundred thousand, with acquisition conditions to match. It is dramatically stronger than a Common skill from the moment it is learned — higher base potency, more promotion bonuses, better cost efficiency, and effects lower tiers simply do not have.

#### The exchange rate

**One mastery tier closes roughly one rarity tier — occasionally two.**

Mastery has three promotions, so a fully mastered skill sits **three to six rarity tiers above its own** in effective power.

| Comparison | Outcome |
|---|---|
| Master Common vs Novice Rare | Common wins comfortably |
| Master Common vs Novice Epic | Common wins |
| Master Common vs Novice Mythic | Roughly even |
| Master Common vs Novice Fabled | Fabled favoured, but not decisively |
| Master Common vs Novice Legendary | Legendary wins |
| Master Common vs Master Legendary | Not a contest |

The rule keeps both axes meaningful. A player's mastered starter skill remains genuinely competitive against most of what drops, but a Legendary in trained hands is beyond reach — which is what makes chasing one worthwhile.

### 4.2 Rarity tiers

Seven tiers, shared with materials and equipment. Rarity never increases for any object.

| Tier | Name | Character | Indicative odds | Approx. count |
|---|---|---|---|---|
| **F** | Common | Anyone can learn it. Taught in a morning. | Routine | ~90 |
| **E** | Uncommon | Standard training. Every soldier has a few. | 1 in 5 | ~70 |
| **D** | Rare | Requires a real teacher or sustained effort. | 1 in 25 | ~55 |
| **C** | Epic | School techniques. Held by named practitioners. | 1 in 150 | ~40 |
| **B** | Mythic | Inherited, looted from something dangerous, or earned by deed. | 1 in 1,000 | ~28 |
| **A** | Fabled | Known by name across a region. Its holder is known too. | 1 in 10,000 | ~15 |
| **S** | Legendary | Existence disputed. One holder, or none. | 1 in 100,000 | ~2 |

**On naming.** Rarity names describe **scarcity and origin**; mastery names describe **the practitioner's command**. The vocabularies must never overlap, which is why *Practiced*, *Refined*, *Adept* and *Seasoned* are unavailable for rarity, and why *Divine* is reserved for off-cycle affinity flavour.

*Alternate set if a less gamey register is wanted:* Common, Uncommon, Scarce, Storied, Ancient, Fabled, Legendary.

### 4.3 Mastery tiers

Four tiers, ten levels each. Forty levels per skill.

| Tier | Levels | Character |
|---|---|---|
| **Novice** | 1–10 | Understood but not owned. Costs more, lands less reliably. |
| **Intermediate** | 1–10 | Reliable. Usable without thinking about it. |
| **Expert** | 1–10 | Adapted to this hero specifically. |
| **Master** | 1–10 | The hero could teach it, and could merge it. |

**Level resets to 1 on promotion.** Promotion concentrates the value — a hero at Intermediate 1 is meaningfully stronger than they were at Novice 10, despite the number going backwards.

**Promotion is automatic** on reaching the threshold. It is not a button, and there is no benefit to withholding it — the bonus is read from practice history up to that moment, and a player who could delay would simply always delay, which is not a decision worth offering.

Promotion grants a large potency step, a permanent attribute grant, and one or more **practice bonuses** (4.6).

### 4.4 Sources of progress

There are three ways to get better at a skill. **All three are available at every mastery tier.** None is a gate; what changes is how much each returns as mastery rises.

| Source | What it is | Novice | Intermediate | Expert | Master |
|---|---|---|---|---|---|
| **Focused practice** | Drilling alone — forms, repetitions, a practice post, a rock | High | Moderate | Low | Very low |
| **Guidance** | Training under someone of higher mastery in that skill | High | High | High | Moderate |
| **Pressure** | Real combat, real sparring, genuine stakes | High | High | Very high | Very high |

**Solo practice is never worthless, and never sufficient.** A hero *can* grind alone all the way to Master — the returns simply become so thin that it takes an absurd amount of time. This is intentional. Nothing in the system is locked; the slow road stays open, because there is always a harder trick to drill alone.

But the experience of battle is not replaceable by any amount of solo repetition, and the highest returns at Expert and Master come from pressure. A hero who has only ever trained will be a technically excellent, badly outmatched combatant.

**Guidance requires a living teacher of higher mastery in that specific skill.** The teacher gains almost nothing from teaching — a small trickle, slightly more when sparring rather than instructing. This makes masters a genuine resource rather than a renewable one, and gives a settlement of skilled heroes compounding value.

### 4.5 The practice model

The engine underneath both skills and attribute training.

#### The progress equation

Every repetition yields:

**yield = base(action) × quality × variety × aptitude × D(repetitions) × M(mastery)**

| Term | What it does |
|---|---|
| **base** | The action's intrinsic worth. Swinging a sword is worth less than executing a full form. |
| **quality** | The circumstances of this repetition — resistance, stakes, guidance |
| **variety** | How novel this context is relative to what the hero has already done |
| **aptitude** | The hero's innate talent for this attribute, family, or learning mode |
| **D(repetitions)** | Decays with the hero's accumulated repetitions **of that action** |
| **M(mastery)** | Decays with the hero's **current mastery tier** in that skill |

**The two decay terms are separate, and both matter.**

`D` means the ten-thousandth swing is worth less than the tenth. `M` means a repetition performed at Intermediate is worth less than the same repetition performed at Novice — basic drills teach a novice a great deal and teach an intermediate practitioner comparatively little, which is simply true.

**Repetition number one always yields more at Novice than at Intermediate.** This is the rule that makes the innate-skill case come out correctly (4.7).

Decay on `D` should be gentle. In practice, raw repetition remains the fastest available route for a long time, because quality and variety are hard to arrange and repetition is not. The optimal strategy is not a rotation — it is repetition, punctuated by variety and guidance when they can be obtained.

#### Quality multipliers

| Circumstance | Effect |
|---|---|
| Against no resistance — air, a post, a rock | Baseline |
| Against a static but real target | Slight increase |
| Against a moving or resisting target | Moderate increase |
| Alongside a partner drilling the same discipline | Moderate increase |
| In a spar with a peer | High increase |
| Against an opponent using the same discipline | High increase |
| Under a mentor giving correction | Very high |
| Under genuine threat of death | Highest |

#### Variety

A separate multiplier tracking how many *distinct* contexts the action has been performed in — different terrain, weather, opponent type, weapon, time of day, while injured, while outnumbered. Novel contexts restore a portion of the decayed repetition yield and grant a one-time novelty bonus.

Variety is deliberately harder to obtain than repetition. It is the difference between a competent practitioner and a dangerous one.

#### Visible yield

**The yield of every action is shown.** A swing reads as +10, +1, or +0.1 depending on accumulated repetitions, current mastery, circumstance and novelty. Players should be able to watch the curve flatten and decide for themselves when to seek a mentor, a harder opponent, or an unfamiliar place.

### 4.6 Practice bonuses

**Promotion bonuses are awarded automatically**, read from how the skill was actually practised. No menu, no choice. Two heroes holding the same skill diverge because they trained differently.

| Practice profile | Bonus | Effect |
|---|---|---|
| High raw repetition | **Economy** | Reduced mana cost |
| Rapid successive use | **Timing** | Reduced wind-up and cast time |
| Used while below a health threshold, or outnumbered | **Composure** | Potency rises as the hero's health falls |
| Used against armoured or resistant targets | **Penetration** | Ignores a portion of mitigation |
| High proportion of weak-point and critical hits | **Keenness** | Increased critical rate and critical damage |
| Practised across many distinct contexts | **Adaptability** | Reduced penalty in unfamiliar conditions; broader valid targets |
| Long solo repetition with no opponent | **Consistency** | Reduced variance; lower failure and fumble chance |
| Held or channelled for extended periods | **Endurance** | Longer duration; cheaper stance upkeep |
| Cast immediately after another skill | **Flow** | Reduced cooldown when chained |
| Substantial mentored practice | **Insight** | An additional bonus, and faster future progression on this skill |
| Used against a wide range of opponent types | **Discernment** | Bonus damage against the type most often faced |
| Repeated charged or held-then-released use | **Capacity** | Unlocks or improves a charge mechanic on the skill |

**A natural arc emerges.** Early promotions tend to fall to Economy, Consistency and Timing, because a young hero mostly drills. Later promotions tend to Composure, Penetration and Discernment, because a veteran mostly fights. The same skill therefore reads differently on a hero raised in a training hall and a hero raised in the tower — without anyone choosing.

**Rarity determines how many bonuses a promotion grants.**

| Rarity | Bonuses per promotion |
|---|---|
| F–E | 1 |
| D–C | 2 |
| B–A | 3 |
| S | 4, and may award a bonus unavailable to lower tiers |

Bonuses are inherited through merging.

### 4.7 Innate skills

A hero summoned with an innate skill may begin above Novice — a 5★ might arrive with a skill already at Intermediate.

**Innate skills save time once and a half, not twice.** They save it fully in the levels skipped. They save it *partially* in repetitions: the hero has accumulated none, so `D` is at its most generous — but `M` is already reduced by the higher mastery tier, so those first repetitions are worth less than they would have been to someone who started at Novice.

The practical picture: a hero born at Intermediate still gains real value from basic drills, because they have never done them. They gain less than a novice doing the same drills. Both facts are true simultaneously, and the two decay terms are what produce that.

### 4.8 Learn conditions

Every skill declares what is required to learn it. Conditions compose, and higher rarity means *more* conditions rather than merely stricter ones.

| Condition type | Example |
|---|---|
| **Attribute threshold** | Dexterity above a value |
| **Prerequisite skill at mastery** | Fireball at Expert or higher |
| **Action repetition** | Ten thousand sword swings; a hundred successful parries; a thousand potions brewed |
| **Affinity** | Holds Fire at Rank II or higher — magical skills only |
| **Source** | A specific teacher, school, manual, or location |
| **Deed** | Has defeated a class of opponent, survived a named event, or crossed a place |
| **Material** | Consumes a rare component on learning |
| **Composite** | All of the above, bound together |

**Action repetition is a first-class condition.** The system already tracks every repetition, so gating on it costs nothing extra, and it is the most honest gate available — it cannot be bought, only done.

#### Composite conditions and multiple paths

Two things are true at once, and both matter:

**A single path may bundle several requirements.** A Fabled sword technique might require Dexterity above a threshold, *and* Swordsmanship at Expert, *and* fifty thousand accumulated sword swings, *and* the manual, *and* having survived a named opponent. Each element alone is achievable; the conjunction is what makes it rare.

**A skill may have several independent paths, each with its own bundle.** The paths are alternatives — satisfying any one of them is sufficient — and they need not resemble each other.

*Example — a Mythic counter technique:*

| Path | Requirements |
|---|---|
| **The taught path** | Parry at Master, *and* a living teacher who holds the skill, *and* a period of guided training |
| **The bloody path** | Parry at Master, *and* 5,000 successful parries, *and* having parried a named boss's signature attack |
| **The scholar's path** | Parry at Expert, *and* Intellect above a high threshold, *and* the recovered treatise, *and* a rare catalyst |

This is the single most useful authoring tool in the system. It lets one skill be reachable by a mentored hero, a veteran, and a scholar without any of them feeling like they took the wrong route — and it means a settlement full of teachers, a long climb, and a library are each genuinely viable strategies rather than one being correct.

**Rarer skills tend to have fewer paths, and harder ones.** A Common skill has one trivial path. A Legendary skill may have exactly one, and it may be a path nobody has walked yet.

### 4.9 Vertical progression within a line

**This is the primary route to higher-rarity skills, and it does not involve merging.**

Rarity never increases — but a higher-rarity skill can name a lower one as a learn condition. Mastering Fireball does not turn Fireball into Fire Meteor. It grants the *right to learn* Fire Meteor, which was always a Mythic skill and always will be.

Each family may therefore contain one or more **skill graphs**: prerequisite chains climbing in rarity, each gated on the mastery of what came before, plus attributes, plus repetitions, plus whatever deed or source the tier demands. Part 5 works several of these out in full.

Progression up a ladder comes from:

- **Practice** — mastering the prerequisite and accumulating the repetitions
- **Mentorship** — a holder of the higher skill willing to teach it
- **Epiphany** — the skill crystallising unprompted during use under pressure
- **Discovery** — manuals, ruins, boss drops, inherited techniques

**Aptitude drives epiphany.** A hero with a family aptitude has a meaningfully higher chance of an epiphany in that family, and therefore a meaningfully better chance of ever holding its rarest skills. This is the mechanism by which aptitudes translate into access rather than merely speed.

### 4.10 Skill families

Skills are not confined to combat.

#### Martial

| Family | Scope and optional labels |
|---|---|
| **Blade** | Cutting, thrusting, and coordinated blade techniques; optional Sword, Dagger, or Greatsword labels |
| **Polearm** | Long-shafted melee technique; optional Spear, Halberd, Glaive, or Polehammer labels |
| **Ranged** | Bow, crossbow, and sling technique, narrowed by equipment labels |
| **Shield** | Blocking, interception, formation defense, and ally cover |
| **Body** | Unarmed combat, grappling, movement, endurance, awareness, mounted movement, and commanding several companions in combat |

#### Magical

| Family | Scope and optional labels |
|---|---|
| **Elemental** | Fire, Earth, Wind, and Water magic, identified by Element labels |
| **Ward** | Barriers, dispelling, and defensive magic |
| **Enchantment** | Buffs on self or others; imbuing objects. Consumes components. |
| **Restoration** | Healing, curing, revival |
| **Mind** | Control, perception, illusion, deception |

#### Craft and life

| Family | Scope and optional labels |
|---|---|
| **Forging** | Weapons, armour, tools |
| **Alchemy** | Potions, poisons, reagents |
| **Cooking** | Food, duration buffs, morale |
| **Gathering** | Harvesting, mining, foraging, skinning, animal handling, taming, and breeding |
| **Knowledge** | Literacy, identification, appraisal, cartography, language, research, teaching, and specialist understanding |

**Craft families are not decorative.** A master smith determines what the martial families have to work with; an alchemist gates what a party survives; a cook keeps a roster functioning. A hero may be level 1 and a Master cook and be genuinely valuable.

### 4.11 Merging

Merging is **one** route to rare skills, not the main one, and it does not raise any skill's rarity — it consumes two skills and produces a *different* skill that was always of that rarity.

**Merging is for combining unlike things.** It works well across families and poorly within a line. Two basic fire skills do not merge into a meteor; a meteor is earned by climbing its prerequisite chain. But Blade plus Elemental genuinely produces something neither parent could reach alone.

**Requirements.** Both inputs at Master 10. A recipe must exist. A catalyst material is consumed, and its rarity contributes to the result. Both inputs are consumed.

| Example pairing | Character | Result |
|---|---|---|
| Blade + Body | Natural | Mobile strikes, closing techniques |
| Blade + Elemental | Natural | Elemental weapon arts |
| Forging + Enchantment | Natural | Imbued equipment creation |
| Alchemy + Restoration | Natural | Superior healing craft |
| Cooking + Enchantment | Unexpected | Food granting lasting buffs |
| Gathering + Body | Unexpected | Mounted and companion combat |
| Ranged + Knowledge | Unexpected | Impossible shots guided by recovered knowledge |
| Shield + Mind | Volatile | Defenses that turn an attacker's intent |
| Forging + Blade | Volatile | Techniques usable only with a weapon the hero made |
| Same skill, two copies | Fallback | A refined variant; guarantees a route for a hero with no partner |

**Inheritance.** The result carries at minimum the combined effects of both parents, plus accumulated practice bonuses where compatible, plus an emergent property belonging to neither. It begins at Novice 1 — the real cost. Given how long mastery takes, merging is a late-game act, which is precisely why it cannot be the primary route to rare skills.

**The apex.** At the theoretical top sits a skill inheriting from every family. It should be named in the setting, referenced, and remain effectively unobtainable. Its function is orientation, not acquisition.

### 4.12 Skill types

| Type | Cost | Constraint | Role |
|---|---|---|---|
| **Active** | Mana per use | Cooldown | Moment-to-moment decisions |
| **Passive** | None | **No slot limit** | Build identity, permanent bonuses |
| **Stance** | Continuous mana drain | **Only one active at a time** | Build-defining commitment |
| **Craft** | Time, materials | Facility or tool required | Production, outside combat |

**Passives are unlimited.** A hero may hold as many as they can acquire — and acquiring them is the constraint, since passives tend to carry heavy repetition and mentorship conditions. A very good instructor can shortcut years of it, which is another reason a settlement full of masters compounds.

**Stances remain limited to one.** That constraint converts a stat choice into a real decision.

### 4.13 Acquisition

| Route | Typical rarity | Notes |
|---|---|---|
| Innate at summon | F–C | Scales with star count. Often begins above Novice. |
| Manuals and scrolls | F–C | The main economy; consumed on learning |
| Teachers and schools | E–B | Also the highest-yield route through Guidance |
| **Ladder progression** | E–S | Mastering the prerequisite and meeting the conditions. **The main route to high rarity.** |
| **Epiphany** | D–A | Crystallises during use under pressure. Chance scales with aptitude. |
| Monster materials | D–A | Rare drops teaching a skill flavoured by the creature |
| Trial and boss rewards | B–S | Named techniques from named opponents |
| Merging | C–S | Cross-family combination; late-game |

---

## Part 5 — Skill Ladders

A **ladder** is a prerequisite chain of skills climbing in rarity. A family may contain several
chains, and labels can distinguish compatible equipment or elements without owning progression.

**The full catalogue lives in the companion [skill wiki](README.md).** This part defines the framework it is built on.

### 5.1 Structure

| Level | Meaning | Example |
| --- | --- | --- |
| Domain | Broad source of practice | Martial |
| Family | The skill's single aptitude and progression home | Blade |
| Skill | One learnable definition | Measured Cut |
| Optional label | Compatibility or affinity metadata | Equipment: Sword |

#### The structural rules

**1. Family membership owns progression.** Every skill has exactly one family, and family aptitude
governs its practice and epiphany. Broad techniques such as Parry and Footwork belong to Body even
when their effects permit compatible Blade, Polearm, or Shield equipment.

**2. Labels narrow compatibility, never ownership.** `Equipment: Sword` and `Element: Fire` are
filterable metadata. A missing label means family membership is sufficient; it does not create a
hidden category. Loadout conditions such as using two compatible Blade weapons belong in
`Requires`, not in a label.

**3. Prerequisites preserve authored chains.** Foundation skills remain learnable roots where the
catalog defines them. Rarity D and above may branch into parallel options drawing on a shared
prerequisite, so two heroes who mastered Fireball need not have the same mid-game.

### 5.2 Ladder shape

The rarity distribution within a ladder is a pyramid, weighted heavily toward the bottom. A hero will hold many skills from the same family over a long career, so the lower tiers need real breadth.

| Rarity | Major ladder (~28) | Standard ladder (~16) | Minor ladder (~12) |
|---|---|---|---|
| **F** Common | 7 | 4 | 3 |
| **E** Uncommon | 6 | 4 | 3 |
| **D** Rare | 5 | 3 | 2 |
| **C** Epic | 4 | 2 | 2 |
| **B** Mythic | 3 | 2 | 1 |
| **A** Fabled | 2 | 1 | 1 |
| **S** Legendary | 1 | 0 | 0 |

**Not every ladder reaches Legendary.** Only a handful do, which is what makes those lines the ones players talk about. A ladder without a Legendary skill can still contribute to one through merging or through a shared capstone.

### 5.3 Ladder entry format

| Field | Purpose |
|---|---|
| **Rarity** | Fixed at creation |
| **Type** | Active, passive, stance or craft |
| **Requires** | Prerequisite mastery, attributes, repetitions, source, deed. Multiple independent paths where appropriate (4.8) |
| **Effect** | What it does |

### 5.4 The mastery arc within a ladder

Early promotions on any ladder tend to yield **Economy**, **Consistency** and **Timing**, because a young hero mostly drills. Later promotions tend to **Composure**, **Penetration** and **Discernment**, because a veteran mostly fights.

The same skill therefore reads differently on a hero raised in a training hall and a hero raised in the tower, without anyone choosing.

### 5.5 Coverage

| Domain | Families |
| --- | --- |
| **Martial** | Blade, Polearm, Ranged, Shield, Body |
| **Magical** | Elemental, Ward, Enchantment, Restoration, Mind |
| **Craft** | Forging, Alchemy, Cooking, Gathering, Knowledge |

See the [skill wiki](README.md) for the full ladders.

---
