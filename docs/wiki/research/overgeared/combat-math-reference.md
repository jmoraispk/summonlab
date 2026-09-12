# Combat Math Reference — The Overgeared Model

Wiki ID: `research.overgeared.combat-math-reference`

Research status: **user-supplied secondary synthesis; not Summonlab canon**.

This component page preserves the supplied reconstruction as research evidence. Its formulas,
adaptation notes, recommendations, and open items are claims from that source, not accepted
Summonlab mechanics or implementation instructions. References to the unsupplied
`attribute_adjustments_v2.md` companion are retained as source provenance rather than actionable
project links. See the parent
[attribute-system research entry](../attribute-systems.md#overgeared-satisfy), the companion
[equipment catalogue](equipment-catalogue.md), and the companion
[equipment mechanics reference](equipment-mechanics.md).

The damage equation as Overgeared uses it, worked through with numbers, followed
by notes on adapting it to Summonlab's tick-based engine.

The novel never published a complete formula. What follows reconstructs the model
from stated per-point coefficients and stated skill multipliers. The *shape* is
reliable. The constants are illustrative and should be tuned. Where the source
contradicts itself, it is flagged.

---

## 1. The four stats

Satisfy has four allocatable stats: **Strength, Stamina, Agility, Intelligence**.
A level 1 character starts with 6 strength, 7 stamina, 4 agility, and 5
intelligence. Points are spent freely on level-up. The four main stats grow with
levels at thresholds of 100, 200, 300 and so on.

Everything else — Dexterity, Persistence, Composure, Indomitable, Dignity,
Insight, Courage, Political Power, Good Luck, Willpower, Deity — is a **special
stat** that cannot receive free points.

### Awakenings — how the ladder works

Every 100 levels a character undergoes a **stat awakening**. Nothing about the
equations changes. Only the *conversion rate* from a stat point to its derived
values steps up, and the effect is described as larger at each higher tier.

The wiki's own caveat matters: chapters 136 and 229 gave one table through the
fourth awakening; chapters 292, 295 and 849 give different third- and
fourth-awakening figures; the author appears to have revised the formula around
chapter 300, and revised the third awakening again at chapter 959. Tiers marked
*unknown* below were never published cleanly, not omitted here.

### Strength → attack power, health, carry weight

| Tier | Trigger | Attack power / pt | Health / pt | Weight limit / pt |
|---|---|---|---|---|
| Basic | Level 1–99 | 0.1 | 3 | +20 |
| 1st awakening | Level 100 | 0.2 | 5 | +30 |
| 2nd awakening | Level 200 | 0.3 | 5 | +40 |
| 3rd awakening | Level 300 | 0.7 *(derived)* | 7 | +50 |
| 4th awakening | Level 400 | 0.8 | 9 | — |

*Revision history:* the third-awakening attack power was 0.6 in chapters 295 and
849 before being revised to 0.7 at chapter 959. Chapters 136 and 229 gave the
original table; the author appears to have changed it around chapter 300.

**Shape of the curve.** Attack power runs 0.1 → 0.2 → 0.3 → 0.7 → 0.8. The first
three steps are a flat arithmetic progression, then the third awakening more than
doubles it. Health meanwhile runs 3 → 5 → 5 → 7 → 9, barely moving, and stalls
completely at the second awakening.

So the ladder is not a uniform escalator. **Attack power multiplies 8× across the
documented tiers while health multiplies 3×**, and the big offensive jump lands
at level 300 rather than being spread evenly. That is a deliberate pacing choice —
the power spike is placed where the story needed one.

### Stamina → health, defense

| Tier | Trigger | Health / pt | Defense / pt | Health regen / 100 pts |
|---|---|---|---|---|
| Basic | Level 1–99 | *unpublished* | *unpublished* | 2 |
| 1st awakening | Level 100 | — | 0.2 | 2 |
| 2nd awakening | Level 200 | 20 | — | 2 |
| 3rd awakening | Level 300 | 25 | 0.9 | 2 |
| 4th awakening | Level 400 | 30 | 1.2 | 2 |

The early tiers publish only one of the two values each — the first awakening
states defense, the second states health. The wiki also notes that the chapter 3
and chapter 15 status windows are mutually inconsistent, so the basic tier could
not be solved.

**The regeneration column is the important one.** Health Recovery Rate derives
from stamina at 2 points per 100, and that base value does **not** rise from a
stat awakening, nor from any "all stats +N" effect. It can only be raised through
items and skills.

Regeneration is deliberately excluded from the stat-inflation spiral, so it stays
a gear-and-skill dimension forever. Worth stealing outright.

**And a mechanic worth more than the table itself.** A contract — the Twilight Orc
contract with Teruchan — multiplies the *stamina coefficient* by 1.8. Health per
point goes from 30 to 54, and defense per point from 1.2 to 2.1.

That is not a flat stat bonus and not a percentage on the derived value. It is a
**multiplier on the conversion rate itself**, sitting between the attribute and
its outputs. It scales with everything the hero has already invested, and it
reads as a change in *what the hero is* rather than what they are carrying.

This is the single most portable idea in the stat pages, and §5 returns to it.

### Agility → action frequency, evasion, movement

| Tier | Trigger | Effect |
|---|---|---|
| All documented tiers | — | Every 1,000 points: attack speed +0.1 |
| At 3,000 points | Threshold | Maximum movement speed +30 |
| System cap | — | 6 basic attacks per second |

No awakening ladder was published for Agility. What exists is a linear rule plus
one threshold. Every 1,000 agility improves the general attack interval by 0.1
seconds: at 2,876 agility the base interval is 0.8s, at 3,000 it is 0.7s, implying
a zero-agility interval of roughly 1.08s.

**Movement is grounded in real units.** A player's maximum movement speed is
normally 100 metres in five seconds — 20 m/s — and it is possible to exceed that.
At 3,000 agility the maximum rises by 30.

This is the only place in the system where a stat maps onto a physical quantity
the reader can picture, and it is why Agility reads as more concrete than the
other three. §5 proposes doing the same thing deliberately.

Agility does not contribute to attack power at normal levels.

Crit is not an attribute. **Bow Mastery raises critical hit probability in
proportion to agility** while a bow is equipped. Sword Mastery does not. The same
attribute produces different derived stats depending on which mastery holds it.

### Intelligence → mana pool, magic power, spell access

| Tier | Trigger | Magic power / pt | Mana / pt |
|---|---|---|---|
| Basic | Level 1–99 | *unpublished* | 3 |
| 1st awakening | Level 100 | 0.5 | *unpublished* |
| 2nd awakening | Level 200 | 2.0 | 6 |
| 3rd awakening | Level 300 | **1.2** | 6 *(unchanged)* |

**Two anomalies, and the wiki flags both.** Magic power *drops* from 2.0 at the
second awakening to 1.2 at the third — the ladder goes backwards. And mana per
point is identical at the second and third awakenings, so the pool stops growing
with the tier. The wiki's own note says the author is not tracking his formula
and hopes for clarification.

Treat Intelligence's table as evidence of what happens when a stat ladder is
maintained by narrative convenience rather than by a spreadsheet. It is the
strongest single argument against adopting awakenings without a fixed, published,
terminating table.

The plateau does have a defensible reading: once the stat stops paying, magicians
are pushed toward Mana Core expansion instead. Two axes, one role.

Two mechanics beyond the pool:

### Special stats feed the same pools — and awaken differently

| Tier | Trigger | Attack power / pt | Defense / pt |
|---|---|---|---|
| Base | — | 0.1 | 0.1 |
| Enhanced | **Courage reaches 1,200 points** | 0.2 | 0.2 |

Courage is the clearest published special-stat table, and note the trigger: it
awakens on **the stat's own value**, not on character level. Two different
awakening mechanisms coexist in the same system — level-gated for the four
primaries, threshold-gated for the special stats.

Threshold-gated is the better mechanic for Summonlab. It rewards commitment to a
stat rather than the passage of time, and it cannot silently invalidate a build
the way a level threshold can, because the player chooses when to cross it.

Courage is explicitly framed as a way for a non-combat class to overcome its
weakness, and as modest compared to an awakened Strength or Stamina stat.

So the hidden layer is not cosmetic — it contributes to the same attack power and
defense totals as the allocatable stats, just at a worse rate, accumulated
through deeds instead of points.

### Sanity check against a real status window

At level 412, Grid shows Strength 3,850, Stamina 2,422, Agility 3,900,
Intelligence 2,896, Dexterity 5,742, with Health 330,682 and Mana 70,020.

Run the published coefficients: stamina at 30 health per point gives ~72,700, and
strength at 7 per point adds ~27,000 — roughly 100,000 against an actual 330,682.
Intelligence at 6 mana per point gives ~17,400 against an actual 70,020.

**The documented rates do not reconstruct the late-game numbers.** The awakening
ladder clearly continues past what the wiki records, and titles and gear
contribute heavily. Use the coefficients for shape, never for balance.

### Resources

Health, stamina and mana are standard and available to everyone. Special
resources — Fighting Energy, Sword Energy, Qi and similar — must be unlocked and
are class-restricted. Skills that run on a specific resource are noted as
substantially stronger than skills of comparable tier running on a standard one.

That is a clean way to express class power without touching the attribute sheet:
**the resource is the class budget.**

---

## 2. The equation

Every term gets its own name. Nothing is reassigned, so each line can be read
once, top to bottom.

### Variable glossary

| Variable | Meaning | Source |
|---|---|---|
| `STR`, `AGI`, `VIT`, `MANA` | The hero's attribute values | Allocation + gear + titles |
| `str_rate` | Attack power gained per Strength point at the current awakening tier | Awakening table |
| `ATK_attr` | Attack power contributed by attributes | `STR × str_rate` |
| `ATK_special` | Attack power contributed by special / hidden stats | `Σ (stat × its own rate)` |
| `ATK_gear` | Flat attack power printed on weapon and armour | Item blocks |
| `ATK_base` | Everything additive, before any multiplier | Sum of the three above |
| `MOD_atk` | Combined percentage multiplier on attack power | `1 + Σ (mastery%, buff%, item%)` |
| `ATK_total` | **Final attack power.** The number a skill multiplies | `ATK_base × MOD_atk` |
| `SKILL_pct` | The skill's stated percentage of attack power | Skill block |
| `DMG_flat` | Flat per-attack damage added *after* multipliers | Item options |
| `DMG_raw` | Damage before the target is considered | — |
| `DEF_target` | Target's defense stat plus class resistance | Target sheet |
| `K` | Tuning constant setting how much defense is "a lot" | Chosen by designer |
| `MIT` | Mitigation multiplier, between 0 and 1 | `K ÷ (K + DEF_target)` |
| `CRIT_mult` | Critical multiplier, or 1 on a normal hit | Crit tables |
| `DMG_final` | Damage actually dealt by one hit | — |
| `INT_base` | Attack interval in seconds from Agility alone | Agility rule |
| `MOD_speed` | Combined attack-speed multiplier from gear and buffs | `1 + Σ speed%` |
| `INT_actual` | Attack interval after gear, floored by the system cap | — |
| `DPS` | Damage per second | `DMG_final ÷ INT_actual` |

### The equations

**Attack power — built once, never overwritten:**

```
ATK_attr    = STR × str_rate
ATK_special = Σ (special_stat × special_rate)
ATK_gear    = Σ (weapon_AP + flat_item_AP)

ATK_base    = ATK_attr + ATK_special + ATK_gear
MOD_atk     = 1 + Σ (mastery_pct + buff_pct + item_pct)

ATK_total   = ATK_base × MOD_atk
```

**One hit:**

```
DMG_raw     = (ATK_total × SKILL_pct) + DMG_flat
MIT         = K ÷ (K + DEF_target)
DMG_final   = DMG_raw × MIT × CRIT_mult
```

**Throughput:**

```
INT_base    = 1.08 − (AGI ÷ 1000) × 0.1
MOD_speed   = 1 + Σ attack_speed_pct
INT_actual  = max( INT_base ÷ MOD_speed , 0.167 )

DPS         = DMG_final ÷ INT_actual
```

The `0.167` floor is the six-attacks-per-second system cap. The `1.08` is derived
from the two published data points, not stated directly.

### Notes on three terms

**`SKILL_pct` is the largest term in the system.**

| Skill class | `SKILL_pct` |
|---|---|
| First-advancement AOE | 50–70% |
| AOE above level 200 | 70–90% |
| Legendary AOE | above 100% |
| Grid's "Kill" finisher | **1,500%** |

Low-rated skills instead deal **fixed damage** — they ignore `ATK_total`
entirely and output a constant. The higher a skill's rating, the less often its
damage is fixed. A weak skill therefore has a hard ceiling by construction and
cannot be rescued by a strong hero.

**`DMG_flat` sits outside the multiplier chain,** which is why it needs its own
name. It is added after `MOD_atk` and after `SKILL_pct`, so its value depends
entirely on how often you swing rather than how hard.

**`MIT` has diminishing returns by construction.** A 50% damage-reduction effect
composes with `MIT` rather than replacing it, which is why such effects do more
than halve incoming damage. Defense penetration reduces `DEF_target` before `MIT`
is computed, so it is worth disproportionately more against high-defense targets.

---

## 3. Worked examples

Constants used: `str_rate = 0.7` (third awakening), `K = 1000`, `CRIT_mult = 1`.

**Hero:** `STR 1,000` · `VIT/Stamina 400` · `AGI 2,000` · Advanced Sword Mastery (+8%)
**Weapon:** greatsword, 400 AP
**Armour:** +100 flat AP
**Target:** `DEF_target = 500`

### Example A — one basic attack

```
ATK_attr    = 1,000 × 0.7              =   700
ATK_special = 0                        =     0
ATK_gear    = 400 + 100                =   500
                                         ─────
ATK_base                               = 1,200
MOD_atk     = 1 + 0.08                 =  1.08
ATK_total   = 1,200 × 1.08             = 1,296

SKILL_pct   = 100%  (basic attack)
DMG_flat    = 0
DMG_raw     = 1,296 × 1.00 + 0         = 1,296

MIT         = 1000 ÷ (1000 + 500)      = 0.667
DMG_final   = 1,296 × 0.667 × 1        =   864

INT_base    = 1.08 − (2000÷1000)×0.1   =  0.88s
MOD_speed   = 1
INT_actual  = 0.88s
DPS         = 864 ÷ 0.88               =   982
```

Defensively, from the same sheet: health = `400 × 30` + `1,000 × 7` = **19,000**.
Defense = `400 × 1.2` = **480**. Health regeneration = `(400 ÷ 100) × 2` = **8/sec**,
and raising Stamina further will not improve that rate.

### Example B — the same hero, different skills

Only `SKILL_pct` changes. `ATK_total` is computed once and reused.

| Skill | `SKILL_pct` | `DMG_raw` | `DMG_final` |
|---|---|---|---|
| Basic attack | 100% | 1,296 | 864 |
| Mid-tier AOE | 70% | 907 | 605 *(per target)* |
| Legendary AOE | 120% | 1,555 | 1,037 *(per target)* |
| Kill finisher | 1,500% | 19,440 | **12,960** |

Against three targets the mid-tier AOE delivers `605 × 3 = 1,815` — more than
double a basic attack, at no resource cost. The finisher is 15× a basic attack
but costs 1,200 mana and half the hero's remaining stamina.

**Encounter shape decides which skill wins, not skill tier.**

### Example C — why attack-speed gear is not comparable to attack-power gear

Two upgrades competing for the same slot.

**Upgrade 1 — weapon with +200 AP.** Changes `ATK_gear`:

```
ATK_gear    = 600 + 100                =   700
ATK_base                               = 1,400
ATK_total   = 1,400 × 1.08             = 1,512
DMG_final   = 1,512 × 0.667            = 1,008
INT_actual  = 0.88s
DPS         = 1,008 ÷ 0.88             = 1,145      (+16.6%)
```

**Upgrade 2 — gloves that halve the interval.** Changes only `MOD_speed`:

```
ATK_total   unchanged                  = 1,296
DMG_final   unchanged                  =   864
MOD_speed   = 2.0
INT_actual  = 0.88 ÷ 2.0               =  0.44s
DPS         = 864 ÷ 0.44               = 1,964      (+100%)
```

Same slot, six times the gain. **`ATK_gear` is additive; `MOD_speed` is
multiplicative on the whole chain.** Anything touching `MOD_speed` belongs to a
separate budget class from anything touching `ATK_gear`.

This is also the full argument for keeping Agility out of `ATK_attr`. Agility
already divides into `DPS` through `INT_actual`. If it also fed `ATK_total`, it
would appear twice in the same expression and every build would raise it first.

### Example D — a real legendary weapon, fully decomposed

The Sword of Self-transcendence is the most completely published item block in
the series, and it touches five different variables at once:

| Item line | Variable affected |
|---|---|
| Attack power 356 | `ATK_gear` |
| Attack speed +6% | `MOD_speed` |
| Accuracy +10% | hit chance *(outside this equation)* |
| Attack and defense rate +10% | `MOD_atk` |
| +200 damage per attack | `DMG_flat` |
| Grants *Perfect State of Self-transcendence* | skill grant |

```
ATK_attr    = 1,000 × 0.7              =   700
ATK_gear    = 356 + 100                =   456
ATK_base                               = 1,156
MOD_atk     = 1 + 0.08 + 0.10          =  1.18
ATK_total   = 1,156 × 1.18             = 1,364

DMG_flat    = 200
DMG_raw     = 1,364 × 1.00 + 200       = 1,564
DMG_final   = 1,564 × 0.667            = 1,043

MOD_speed   = 1.06
INT_actual  = 0.88 ÷ 1.06              =  0.83s
DPS         = 1,043 ÷ 0.83             = 1,257
```

Two things to notice.

**`DMG_flat` is 13% of this hit but would be 40%+ on a dagger.** Because it lands
after every multiplier, its relative value scales inversely with `ATK_total` and
directly with attack frequency. Flat per-hit damage on a fast weapon is a
different item than the same line on a slow one. Either exclude `DMG_flat` from
the affix table or price it against `INT_actual`.

**The granted skill's cost is behavioural, not numeric.** All stats double for two
minutes with immunity to every abnormal condition — and the wearer cannot be
controlled for the duration. No mana price could have balanced a `× 2` on every
attribute; a loss-of-control price can.

### Example E — the conditional layer, which touches none of these variables

Iyarugt's options key off events the engine already tracks:

- Critical strike → bleeding for 3s, damage proportional to `ATK_total`
- 3 combos → bleed maximises, damage to target +200% for 1 second
- 5 combos → target's thinking destroyed for 0.3s, opening a linked skill
- On growth → bleed extends to 5s, window becomes +300% for 2s

None of that appears in `ATK_base`, `MOD_atk`, or `SKILL_pct`. It is a separate
layer keyed on crit and combo count, and it costs nothing in the core math.
**This is where weapon identity should live.**

---

## 4. How ranger and assassin identity is produced without Dexterity

Dexterity exists in Satisfy but is unallocatable. Class identity comes from three
places instead.

**1. Stat *ratio* requirements on weapons.**

| Weapon | Level | Strength | Agility | Mastery |
|---|---|---|---|---|
| Dagger of Bewitchment | 100 | 30 | 200 | Intermediate Dagger |
| Ideal Dagger | 180 | — | 450 | Advanced Dagger |
| Sword of Self-transcendence | 160 | 950 | — | Advanced Sword lv2 |
| Gale Spear | 240 | 750 | 400 | Advanced Spear lv2 |
| Thunder Bow | 300 | — | 2,000 | Advanced Bow lv5 |
| Failure (greatsword) | 300 | 5,000 | — | Advanced Sword lv8 |

A greatsword demands 5,000 Strength; a dagger demands 30. No separate finesse
attribute is needed to express that.

**2. Weapon mastery rank is the real gate.** Every weapon requires a named mastery
at a specific rank — "Advanced Bow Mastery level 5," "Advanced Sword Mastery
level 8." The mastery is the class.

Summonlab already has this. The Martial domain's skills are ranked, so a weapon
can read `requires: Archery, Advanced 5` with no new system at all. That single
line does more identity work than a fifth attribute would, and it costs nothing
in monster stat blocks or affix tables. It also gives gear a second progression
axis that is *earned through use* rather than allocated — which is the part of
the Overgeared hidden-stat layer that is worth keeping once the legendary-class
crafting loop is discarded.

**3. Masteries convert attributes differently.** Bow Mastery grants +4% attack
power and hit rate and turns agility into crit chance. Sword Mastery raises
attack power and attack speed. A generalist Weapons Mastery works with any weapon
but gives less than a specialist at equal investment.

**The one exception worth knowing:** Mjolnir – Human World Version requires level
350+, 3,000+ strength and **3,500+ dexterity**, and the wiki explains this
directly — the design was optimised for Grid himself, who has enormous dexterity
from crafting achievements. It is a deliberately unbuildable requirement, closer
to a name-lock than a stat gate. The rule holds: dexterity does not gate
obtainable gear.

**Conclusion for Summonlab.** Dexterity is not needed for ranger/assassin
identity. Proficiency rank plus asymmetric stat floors plus mastery-specific
conversions do the whole job — and accuracy and crit are already on the skill
track, which is exactly the mechanism this relies on.

- **Assassin** — dagger mastery, negligible strength floor, options built around
  setup (a 3-second no-resist window) and burst (doubled agility for 60s)
- **Ranger** — bow mastery, agility→crit conversion, options built around
  sustained fire (ramping firing speed capped at +50%) and per-shot resource cost

Different mastery, different option pool, different stat floor. Four attributes.

---

## 5. Adapting to Summonlab

### Direct translations

| Overgeared | Summonlab |
|---|---|
| Strength → attack power | Strength → attack power, same linear conversion |
| Stamina → health + defense | Vitality → health + mitigation |
| Intelligence → mana pool + magic power | Mana → mana pool + magical damage |
| Agility → attack interval | Agility → action points per tick |
| Basic attack cap of 6/sec | Hard cap on actions per tick |
| Skill multiplier | Skill grade × rank |
| Fixed-damage low-tier skills | Already aligned: low-grade skills need a ceiling |
| Weapon mastery rank gating | Already aligned: proficiency track gates equipment |
| Defense curve `K/(K+D)` | Vitality-derived mitigation, same curve |
| Special resources as class budget | Maps onto the Martial / Magical / Craft domains |

### Mechanics worth adopting directly

**Regeneration excluded from stat scaling.** Health Recovery Rate derives from
Stamina but does not benefit from awakenings or "all stats +N" effects. Porting
this means Vitality gives the pool while regeneration stays a gear-and-skill
dimension — which keeps healing relevant across the whole tower climb instead of
being trivialised by late-game stat inflation.

**Spell access as a hard gate, not a penalty.** A spell whose Mana requirement is
unmet does not fire at all. Cleaner than a scaling failure chance, and it makes
the attribute floor legible.

**Two axes for casters.** Intelligence plus Mana Core expansion. The equivalent
would be Mana as the attribute and a separate cultivation-style core depth that
gates which skill grades a hero can learn. Fits the xianxia framing exactly.

**Conditional option layers.** Iyarugt's combo-keyed effects cost nothing in the
core equation. Most weapon identity should live here.

**Coefficient multipliers as a power source.** The Twilight Orc contract multiplies
the stamina *coefficient* by 1.8, not the stat and not the derived value. Summonlab
already has aptitudes; expressing an aptitude as a multiplier on an attribute's
conversion coefficient is strictly more interesting than expressing it as a growth
rate, because it changes what the hero *is* rather than how fast they get there,
and it stays meaningful at every point on the curve. See
`attribute_adjustments_v2.md` §4.

**Physical grounding for Agility.** Overgeared states movement speed in metres per
second, which is why Agility reads as more concrete than its three siblings.
Summonlab can do the same and get world-map travel times out of it for free. See
`attribute_adjustments_v2.md` §5.

**Flat post-multiplier damage as its own budget class.** The +200 per attack on
the Sword of Self-transcendence behaves completely differently on a fast weapon
than a slow one. Either exclude it or price it against attack interval.

### Changes required

**No stamina.** The Kill finisher's cost model doesn't port. Substitute a poise
cost or a long cooldown — the intent is that a finisher must be paid for with
something other than mana, so a high-mana hero can't spam it. Note also that
Overgeared uses Stamina for *both* the health/defense stat and the labour
resource; Summonlab's Vitality takes the stat role and has no labour resource, so
gathering and crafting need a different pacing limiter (time, or settlement
capacity).

**Ticks, not seconds.** `dps` becomes damage per tick and the interval becomes
action points accumulated per tick. Example C survives intact: anything granting
extra actions per tick is multiplicative and needs its own budget.

**Weapon scaling channel replaces the Dexterity question.** A bow reads
`scaling: STR` with a low coefficient and a high crit conversion via Archery
rank; a greatsword reads `scaling: STR` with a high coefficient and no crit
conversion. One field on the weapon, one conversion table on the proficiency
track.

**Gear budget.** Overgeared is deliberately gear-skewed — the premise is that
items substitute for level, and item-above-requirement penalties are mild
(roughly a 20% ability drop for rare, 30% for epic, with half of item effects
applied). That skew is wrong where attachment is to a specific procedural hero.
Suggested split: gear contributes flat attack power additively and owns most
*option* variety; the attribute and skill layers own the multipliers. Craft
classes then matter through option quality and through the rationed
interval-affecting items, not through raw damage share.

### Open items

- Choose `K` for the defense curve
- Decide whether weapon attack power is a point value or a range — the range
  version gives per-hit variance without a global randomness term and reads well
  in a tick log
- Decide the budget class for action-economy gear and how rare it is
- Decide whether flat post-multiplier damage exists at all
- Decide whether special resources (a Martial energy gauge, say) are adopted as
  the class-power budget

### Documented but not adopted: stat awakenings

Full per-stat tables are in §1. In summary: `str_rate` moves 0.1 → 0.2 → 0.7
across the documented tiers while health per point moves only 3 → 6 → 7, the mana
rate plateaus at 6 from the second awakening onward, and Agility has no published
ladder at all.

Note also that the special stats use a **different trigger**: Courage awakens when
the stat itself reaches 1,200 points, not at a character level. Threshold-gating
is the better of the two mechanisms — the player chooses when to cross it, so it
cannot silently invalidate a build.

**The appeal:** the equation never changes shape, only a constant, so the event is
enormous without adding complexity. Crossing a threshold becomes an occasion.

**The risks:** a build optimal before the threshold can be wrong after it with no
warning; the author revised these coefficients repeatedly across chapters; and as
shown in §1, the published ladder does not reconstruct the late-game totals,
which means the real curve kept escalating past the documented tiers. If adopted,
the rate table must be visible to the player *before* the threshold is crossed,
and the ladder must terminate at a known tier.
