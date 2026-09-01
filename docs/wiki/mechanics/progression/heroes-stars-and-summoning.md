# Imported heroes, stars, levels, aptitudes, and summoning proposal

Wiki ID: `mechanics.progression.heroes-stars-summoning`

Design status: **authoritative supplied design with explicit tuning gaps**. Hero uniqueness,
eventual access independent of starting rank, premium gems for Advanced summons, cap table,
summoning bands, aptitudes, star-stone promotion, and XP fiction follow the supplied progression
document. Exact values it leaves approximate or unwritten remain tuning work.

Every hero is unique. The source forbids progression from relying on duplicate copies of the same
person.

## Stars are not object rarity

| | Rarity | Stars |
| --- | --- | --- |
| Applies to | Skills, materials, equipment | Heroes |
| Can increase | No | Yes, through nurture |
| Meaning | What an object fundamentally is | Starting endowment and current nurture |
| Gates | No hero category | Level cap and points per level in the source proposal |

Stars do not limit skill rarity: a 1★ hero may learn and master a Legendary skill.

## Authored caps and starting package

The supplied caps are `10, 20, 30, 40, 50, 70, 99`. The source deliberately leaves native 6★ and
7★ starting bands empty because those ranks cannot be summoned:

| Stars | Accepted cap | Draft innate skills | Draft innate aptitudes | Draft base-point band | Draft points/level |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1★ | 10 | 1 | 1 | 5–15 | 3 |
| 2★ | 20 | 2 | 2 | 15–25 | 4 |
| 3★ | 30 | 3 | 3 | 25–35 | 5 |
| 4★ | 40 | 4 | 4 | 35–45 | 6 |
| 5★ | 50 | 5 | 5 | 45–55 | 7 |
| 6★ | 70 | — | — | No native band | 8 |
| 7★ | 99 | — | — | No native band | 9 |

The draft uses the level cap itself as the ascension wall. It separates:

- current-star points per level, whose rate changes immediately after promotion; and
- base attributes, rolled once from native stars and never retroactively improved.

The source proposes no native 6★ or 7★ heroes and calls 5★ the maximum summon. This overrides the
earlier promotion-only-5★ assumption: Advanced summoning may produce an extraordinarily rare native
5★ hero.

## Base-attribute distribution proposal

| Native stars | Total-point band |
| ---: | ---: |
| 1★ | 5–15 |
| 2★ | 15–25 |
| 3★ | 25–35 |
| 4★ | 35–45 |
| 5★ | 45–55 |

The source mentions 65–75 only as a theoretical continuation and explicitly provides no native 6★
or 7★ band. Within each listed band, it proposes a triangular or normal-like distribution centered
at the midpoint, with about two-thirds of summons in the middle third. Thus most 1★ heroes sit near
10 and a 14 is notable. Adjacent bands are intended not to overlap in practice, so a high 1★ still
starts below a low 2★, while every band contains its own exceptional rolls.

Distribution among individual attributes should favor aptitude areas. An unusually high starting
Spirit, for example, hints at a Spirit or affinity aptitude before appraisal.

## Summoning channels

The imported proposal is:

| Channel | Cost | Output | Notes |
| --- | --- | --- | --- |
| Normal | One free daily; otherwise cheap | Mostly 1★, some 2★, small 3★ chance | Baseline roster source |
| Advanced | Gems | At least 3★, possible 4★, very rare 5★ | 5★ intended around one in thousands |

Its hard rules prohibit summoning 6★–7★, make 5★ the Advanced ceiling, allow extremely scarce or
expensive guaranteed 5★ tickets, and make 3★ reliably purchasable through gems. It also proposes
portal upgrades that move Normal odds toward 2★–3★ without changing those bounds.

These authored bands replace the earlier Normal `1★+`, Advanced `2★+`, natural-4★,
promotion-only-5★ model. A later Special entitlement may reuse an authored summon configuration,
but it cannot weaken Advanced's minimum 3★ or make 6★–7★ summonable. Living Village should use one
explicitly versioned Normal configuration and defer portal upgrades because its settlement is static.

## Level and experience proposal

The source says XP comes only from kills and represents absorbed life-energy. A level then grants
player-allocated attribute points, an element-matched attribute bonus, and access thresholds—but no
skills.

It intentionally separates level from mastery: a level-1 hero may be a Master cook, while a veteran
fighter may be unable to cook. Non-combat heroes still advance through skill practice, attribute
training, and Resonance, but combat is the proposed source of level-earned attribute points.

This kill-only XP rule is authoritative. Generic progression grants may still carry skill,
attribute, affinity, or other growth, while synthesis must use essence or another non-XP resource
unless the source design is deliberately revised later.

## Aptitudes

A hero is proposed to begin with as many innate aptitudes as native stars. Aptitudes change rate and
access, never the ultimate ceiling.

| Aptitude type | Proposed effect |
| --- | --- |
| Attribute | Matching training yields more and decays more slowly |
| Family | Matching skill progress is faster and epiphanies much likelier |
| Learning mode | Solo practice, guidance, or pressure yields more |
| Variety | Novelty is stronger and contexts distinguish more readily |
| Affinity | Resonance and its track progress faster |

Aptitude rarity is magnitude, not category: every category can produce weak or exceptional talent.
This allows a 1★ hero with one enormous aptitude to remain an exciting summon.

### Awakening and discovery

Every star gained above native rank makes one chance-based latent-aptitude awakening roll. A native
1★ nurtured to 6★ therefore gets five rolls and might end with three or four total aptitudes,
occasionally more or none beyond the initial one.

Aptitudes begin hidden and become known by:

- observed outperformance during sufficient play;
- immediate appraisal through Knowledge skill, a rare consumable, or an appraiser;
- recognition by a mentor in the matching discipline.

Because promotion may awaken aptitudes, looking at an opposing 5★ does not reveal whether it was
summoned or nurtured; only demonstrated capability does.

## Star stones and promotion

The draft proposes tier-matched star stones on the shared rarity scale. Promotion to `n` stars
consumes stones of tier `n`; it never consumes duplicate heroes. Three lower stones may be gambled
for the next tier:

| Fusion | Success chance |
| --- | --- |
| 3 × 1★ → 2★ | Very high |
| 3 × 2★ → 3★ | High |
| 3 × 3★ → 4★ | Moderate |
| 3 × 4★ → 5★ | Low |
| 3 × 5★ → 6★ | Very low |
| 3 × 6★ → 7★ | Extremely low |

Failure consumes every input and returns nothing. Directly obtained stones are therefore more
valuable than fused ones. Stones may come from content or premium purchase, making fusion a floor
rather than the only route.

The source’s “no heroes are consumed” phrase applies to star promotion and duplicate-fed evolution;
it does not erase the separately described terminal-hero synthesis mechanic. Star stones are the
authored promotion requirement; tower evidence, achievements, facilities, or time may affect stone
acquisition but are not additional promotion gates unless the design is revised explicitly.

## Native versus nurtured 5★ thought experiment

The draft gives native high stars five permanent advantages:

1. higher one-time base attributes;
2. higher points-per-level during early levels;
3. more innate skills with higher initial mastery;
4. more innate aptitudes;
5. better rare-skill access through aptitude-driven epiphany.

Holding time and experience perfectly equal, it expects a native 5★ to defeat a native 1★ later
nurtured to 5★. In play, however, those histories are not equal. The early 1★ joins the whole climb,
while a rare 5★ often arrives late into already-understood content.

| Practice term | Nurtured early 1★ | Late native 5★ |
| --- | --- | --- |
| Repetitions | Enormous across the climb | Modest |
| Variety | Every biome, enemy, and condition | Narrow late slice |
| Quality | Low-stakes drills through near-deaths | Mostly high-stakes fights |
| Practice bonuses | Many and diverse, especially Adaptability/Discernment | Few and narrow |
| Skills | Numerous and deep | Fewer and shallower |
| Merge candidates | Several at Master 10 | Rare |
| Aptitudes | One innate plus up to four awakened | Five innate |

Adaptability and Discernment are the proposed visible signature of lived campaign breadth: they
cannot be bought and require doing the varied climb. The draft predicts the native 5★ wins a familiar
controlled contest through raw attributes, while the veteran can win unfamiliar, pressured
encounters through history.

The middle remains meaningful: a 3★ is proposed as a substantially stronger start than a 1★ through
roughly double base points, three skills and aptitudes, and five rather than three points per level.
The intended thesis is not that stars are cosmetic, but that investment can substitute for luck at
the cost of time. None of these capability comparisons measures dignity or human worth.

## Living Village subset

Implement a small deterministic summon table with disclosed version/odds, accepted caps through the
milestone’s reachable ranks, visible starting packages, one XP source, cap behavior, and inspectable
growth deltas. Defer pity variants, tickets, portal upgrades, latent awakening, late-rank promotion,
stone fusion, and advanced appraisal until the core summon–fight–train loop is playable.
