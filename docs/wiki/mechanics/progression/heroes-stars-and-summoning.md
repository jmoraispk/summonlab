# Heroes, stars, levels, learning profiles, and summoning

Wiki ID: `mechanics.progression.heroes-stars-summoning`

Design status: **authoritative for retained star, summoning, promotion, and XP rules; attribute and
learning mechanics superseded by ADR 0072**. Hero uniqueness, eventual access independent of
starting rank, premium gems for Advanced summons, cap table, summoning bands, star-stone promotion,
and XP fiction follow the supplied progression document. The
[four-attribute decision](../../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md)
owns combat attributes, learning profiles, and level-allocation mechanics.

Every hero is unique. The source forbids progression from relying on duplicate copies of the same
person.

## Stars are not object rarity

| | Rarity | Stars |
| --- | --- | --- |
| Applies to | Skills, materials, equipment | Heroes |
| Can increase | No | Yes, through nurture |
| Meaning | What an object fundamentally is | Starting endowment and current nurture |
| Gates | No hero category | Level cap and affinity eligibility; not learning access or the attribute-point rate |

Stars do not limit skill rarity: a 1★ hero may learn and master a Legendary skill.

## Authored caps and retained starting package

The supplied caps are `10, 20, 30, 40, 50, 70, 99`. The source deliberately leaves native 6★ and
7★ starting bands empty because those ranks cannot be summoned:

| Stars | Accepted cap | Draft innate skills | Native summon status |
| ---: | ---: | ---: | --- |
| 1★ | 10 | 1 | summonable |
| 2★ | 20 | 2 | summonable |
| 3★ | 30 | 3 | summonable |
| 4★ | 40 | 4 | summonable |
| 5★ | 50 | 5 | maximum summon |
| 6★ | 70 | — | promotion only |
| 7★ | 99 | — | promotion only |

The level cap remains the ascension wall. The imported base-point bands, star-count aptitude
bundles, and star-scaled packages of three through nine attribute points per level are superseded.
For new `engine-v26` progression, every gained level grants exactly one freely allocated intrinsic
point in Might, Vitality, Agility, or Spirit, regardless of star rank.

The source proposes no native 6★ or 7★ heroes and calls 5★ the maximum summon. This overrides the
earlier promotion-only-5★ assumption: Advanced summoning may produce an extraordinarily rare native
5★ hero.

## Combat attributes and hidden learning

New `character-v2` / `engine-v26` heroes carry two independent capability layers:

- four visible intrinsic combat attributes—Might, Vitality, Agility, and Spirit—generated on the
  versioned `1..100` scale without a star-based point budget; and
- a hidden learning profile containing one bounded cognitive score plus independent martial,
  magical, crafting, survival, and social domain scores.

Combat attributes scale combat capability; they do not gate learning or set practice rate. Stars do
not determine, count, grant, or awaken learning-profile scores. The learning profile affects rate of
validated practice only, never model reasoning, decision quality, human worth, eventual access, or
skill ceiling. Its exact fields are omitted from player-facing projections; players discover
relative strengths through observed practice and mentor feedback.

The imported Attribute, Family, Learning mode, Variety, and Affinity aptitude categories are
historical source material, not current mechanics. Any future change to the shipped learning profile
or its relationship to stars requires a new versioned decision rather than reviving that package.

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

The source says XP comes only from kills and represents absorbed life-energy. Under ADR 0072, each
gained level grants exactly one freely allocated intrinsic combat-attribute point. It grants no
automatic element-matched point, learning-profile score, or skill.

It intentionally separates level from mastery: a level-1 hero may be a Master cook, while a veteran
fighter may be unable to cook. Non-combat heroes still advance through skill practice, attribute
training, and affinity-rank progress, but combat is the proposed source of level-earned attribute
points.

This kill-only XP rule is authoritative. Generic progression grants may still carry skill,
attribute, affinity, or other growth, while synthesis must use essence or another non-XP resource
unless the source design is deliberately revised later.

## Affinity eligibility and awakening

Affinity eligibility keys off **current stars**, so nurturing a low-native-star hero can open the
same affinity gate as summoning at that rating.

| Current stars | Affinity eligibility |
| ---: | --- |
| 1–2★ | None; the hero remains unaligned at this rating |
| 3★ | May awaken one base affinity |
| 4–7★ | May awaken one base affinity or, rarely, a dual affinity |

Eligible heroes roll affinity awakening at level-up and star promotion. Awakening is not
purchasable, craftable, or guaranteed by accumulated play. Duals can also arise through the bounded
routes listed in [Affinities](affinities.md#awakening), but both parents must reach Rank III before
the pair can be held.

### Learning-profile discovery

Star promotion does not grant or awaken a learning-profile score. Hidden learning tendencies become
legible only through evidence such as:

- observed outperformance during sufficient play;
- immediate appraisal through Knowledge skill, a rare consumable, or an appraiser;
- recognition by a mentor in the matching discipline.

Looking at an opposing 5★ does not reveal its hidden learning profile; only demonstrated practice
provides evidence.

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

## Native versus nurtured 5★

The retained source rules distinguish a native high-star hero through immediate level-cap headroom
and the drafted larger innate-skill package. They do not grant star-scaled combat-attribute budgets,
multi-point level packages, learning-profile bundles, or aptitude-gated rare-skill access.

Native stars alone no longer predict the winner. A native 5★ may arrive with the drafted broader
starting-skill package, while a native 1★ nurtured to 5★ owns the practice and history accumulated
through the climb. Current combat attributes and hidden learning are independent of native stars.

| Practice term | Nurtured early 1★ | Late native 5★ |
| --- | --- | --- |
| Repetitions | Enormous across the climb | Modest |
| Variety | Every biome, enemy, and condition | Narrow late slice |
| Quality | Low-stakes drills through near-deaths | Mostly high-stakes fights |
| Practice bonuses | Many and diverse, especially Adaptability/Discernment | Few and narrow |
| Skills | Numerous and deep | Fewer and shallower |
| Merge candidates | Several at Master 10 | Rare |
| Hidden learning | Independent of stars | Independent of stars |

Adaptability and Discernment remain imported, unshipped promotion-bonus candidates for representing
lived campaign breadth. Current rules compare actual skills, mastery, combat attributes, equipment,
and history; they do not infer a raw-stat advantage from native stars.

The middle remains meaningful: a 3★ begins with more level-cap headroom and the drafted three-skill
package rather than a larger attribute or learning bundle. The intended thesis is not that stars are
cosmetic, but that investment can substitute for starting rank at the cost of time. None of these
capability comparisons measures dignity or human worth.

## Living Village subset

Implement a small deterministic summon table with disclosed version/odds, accepted caps through the
milestone’s reachable ranks, visible starting skill packages, hidden star-independent learning
profiles, one intrinsic combat-attribute point per gained level, one XP source, cap behavior, and
inspectable growth deltas. Defer pity variants, tickets, portal upgrades, late-rank promotion, stone
fusion, and advanced learning-profile observation until the core summon–fight–train loop is playable.
