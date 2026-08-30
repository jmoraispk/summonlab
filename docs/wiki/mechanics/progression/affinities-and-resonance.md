# Imported affinity and resonance proposal

Wiki ID: `mechanics.progression.affinities-resonance`

Design status: **draft**. Heroes and monsters sharing typed affinity semantics is accepted. The
five-element roster, cycles, ranks, derived affinities, and values on this page are imported
proposals pending combat simulation. In particular, the current wiki treats Wind as an initial
affinity candidate, while this source makes Wind a derived Metal × Wood affinity.

## Bearer-level affinity

The source defines affinity as a bodily and spiritual property of a bearer with its own progression
track and Resonance stat. It applies at hero or monster level, not through skill infusion, sockets,
or elemental slots.

| Sector | Proposed relationship |
| --- | --- |
| Martial | Techniques are element-neutral, but the bearer’s affinity colors damage and invokes cycles/statuses |
| Magical | Skills are authored per element; the matching element works fully and off-element magic is heavily weakened or unavailable |
| Craft and life | Usually unaffected, with narrow cases such as a Fire smith or Water alchemist |

Every element should cover offense, defense, and utility; Water, for example, may use bullets,
pressure lances, or a drowning grasp instead of being only support.

**Resonance** measures realization of an element. It governs proc chance, status potency, rank
progression, and dual-affinity stability. It increases through use, aligned training, leyline nodes,
and rare materials. The proposal says level never raises Resonance and Resonance does not appear on
the base attribute sheet.

The source nevertheless proposes one direct attribute nudge on each level:

| Affinity | Attribute | Rationale |
| --- | --- | --- |
| Wood | Agility | Growth, reach, motion |
| Fire | Might | Expansion, force |
| Earth | Vitality | Stability, endurance |
| Metal | Dexterity | Severance, precision |
| Water | Spirit | Depth, patience, flow |

No affinity nudges Intellect because comprehension is not elemental. This direct permanent bonus
conflicts with the current affinity contract, which permits only explicit context-bound derived
contributions; it must not be implemented without resolving that contract.

## Five-element roster

The proposed foundation is Wu Xing, chosen because it supplies generating and overcoming cycles.

| Affinity | Color | Season | Direction | Climate | Guardian | Temperament vocabulary |
| --- | --- | --- | --- | --- | --- | --- |
| Wood 木 | Cyan-green | Spring | East | Wind | Azure Dragon | Growth, reach, entanglement |
| Fire 火 | Vermilion | Summer | South | Heat | Vermilion Bird | Expansion, aggression, consumption |
| Earth 土 | Ochre-gold | Late summer | Center | Damp | Yellow Qilin | Stability, endurance, weight |
| Metal 金 | White-silver | Autumn | West | Dryness | White Tiger | Severance, precision, contraction |
| Water 水 | Deep blue-black | Winter | North | Cold | Black Tortoise | Flow, depth, patience |

These words describe material behavior, never personality, race, morality, culture, rarity, or
worth. Star rank does not affect which element a hero can possess or whether Rank V is reachable.

| Affinity | Proposed status | Behavior |
| --- | --- | --- |
| Wood | Ensnare | Slows, roots, reduces evasion, and spreads nearby |
| Fire | Burn | Damage over time; stacks intensity rather than duration |
| Earth | Weight | Lowers poise and action speed and increases stagger received |
| Metal | Rend | Bleed and armor shred that punishes movement |
| Water | Chill | Lowers attack speed and mana regeneration and escalates toward freeze |

## Unaligned and off-cycle states

**Unaligned/Formless** is a real state rather than null: the default before awakening and for most
low-tier monsters. It deals no elemental damage, triggers no affinity status, and has no cycle bonus,
penalty, feeding, or counter. Its advantage is neutrality against unknown or mixed opposition; its
cost is losing the upper affinity system and most elemental magic.

**Void** and **Radiance** are proposed off-cycle affinities for endgame antagonists. They retain
elemental identity, procs, and rank progression but have no overcoming relation. Unaligned is
neutral by absence; off-cycle is neutral by exemption.

## Generating and overcoming cycles

- Generating/feeding: Wood → Fire → Earth → Metal → Water → Wood.
- Overcoming/conquering: Wood → Earth → Water → Fire → Metal → Wood.

The mnemonic is: Wood feeds Fire; Fire’s ash makes Earth; Earth bears Metal; Metal condenses Water;
Water grows Wood. Roots break Earth; Earth dams Water; Water quenches Fire; Fire melts Metal; Metal
cuts Wood.

| Attacker relationship to defender | Damage | Proc chance | Status duration | Additional consequence |
| --- | --- | --- | --- | --- |
| Overcomes | Increased | Increased | Extended | Defender resistance reduced |
| Is overcome by | Reduced | Reduced | Shortened | Procs may fail outright |
| Feeds | Heavily reduced | Suppressed | — | Defender recovers mana |
| Is fed by | Neutral | Neutral | Neutral | Attacker recovers mana on hit |
| Same affinity | Heavily reduced | Suppressed | — | Defender converts damage into mana |
| Either unaligned | Neutral | — | — | No relationship |
| Either off-cycle | Neutral | Unmodified | Unmodified | Procs resolve without a cycle modifier |

Feeding is intentionally the one relationship where attacking is actively counterproductive.

## Advanced cycles and ranks

**Overacting** occurs when attacker Resonance vastly exceeds defender Resonance and amplifies an
overcoming relation; the source unlocks it at Rank IV. **Insulting** reverses the overcoming relation
when the defender’s Resonance vastly exceeds the attacker’s; it unlocks at Rank V. Neither interacts
with unaligned combatants.

| Rank | Name | Proposed unlock | Visual signature |
| ---: | --- | --- | --- |
| 0 | Unaligned | No affinity or procs | None |
| I | Dormant | Elemental damage and basic matching magic; no proc | Faint color tint |
| II | Awakened | Base status proc | Clear color and particle trail |
| III | Attuned | Environmental interaction and dual-affinity eligibility | Persistent low aura; material appears on body |
| IV | Resonant | Overacting, area proc components, spreading statuses | Standing aura and local weather shift |
| V | Sovereign | Insulting/reversal | Environment manifests the element at rest |

The source maps affinity Ranks I–V directly to monster tiers T1–T5, with Rank 0 unaligned. Exact
visual language must still follow the existing rule against indiscriminate full-body recolors.

## Ten derived affinities

Every pair is proposed to produce one closed, derived affinity after a dual-affinity bearer
stabilizes it.

### Harmonious generating pairs

| Derived | Parents | Color | Character | Status |
| --- | --- | --- | --- | --- |
| Wildfire | Wood → Fire | Orange-green | Spreading consumption | Burn jumps between targets |
| Ash | Fire → Earth | Gray-red | Smothering, decay, fertile ruin | Smother blinds and suppresses mana regeneration |
| Crystal | Earth → Metal | Amber-white | Hardening, refraction, permanence | Petrify escalates poise loss into immobility |
| Ice | Metal → Water | Pale blue-white | Contraction, stillness, brittleness | Freeze stops action and increases stagger |
| Bloom | Water → Wood | Jade-teal | Growth, restoration, overgrowth | Verdure heals allies and entangles enemies |

### Volatile overcoming pairs

| Derived | Parents | Color | Character | Status |
| --- | --- | --- | --- | --- |
| Wind | Metal × Wood | Pale gray-cyan | A severing gale, motion made edge | Lacerate scales cutting damage with target movement |
| Blight | Wood × Earth | Sickly violet-green | Rot, corruption, stone-splitting roots | Poison stacks degeneration that ignores armor |
| Mire | Earth × Water | Brown-black | Silt, mud, drowning ground | Sink heavily slows and prevents dashes/leaps |
| Steam | Water × Fire | White-gray | Scalding vapor, obscurement, pressure | Scald damages over time and lowers accuracy |
| Lightning | Fire × Metal | Violet-white | Forge discharge, plasma, instantaneity | Shock interrupts casts and chains |

Wind remains Wood’s climate in the base Wu Xing table. As a derived affinity it represents Metal’s
severing edge applied to Wood’s motion, avoiding a sixth base element that would break the wheel.

## Dual affinity

Dual affinity is proposed as a defining rarity rather than a selectable build option.

- Acquisition: bloodline awakening, a paired-leyline trial, a rare material, or a one-per-hero
  narrative event; never a purchase.
- Requirements: both parents at Rank III or higher and Resonance above a volatility-scaled threshold.
- Stability: generating pairs begin stable; overcoming pairs impose persistent drain or backlash
  until Resonance is sufficient.
- Behavior: the bearer retains both parents, gains the derived element, can cast all three, and uses
  whichever parent is more favorable for cycle evaluation.

## Living Village subset

Use only a small reviewed base-affinity roster, one typed status each, a deterministic resolver, and
clear action/equipment tags. Defer advanced cycles, Ranks III–V, dual/derived affinities, Void,
Radiance, environmental changes, and mana-conversion relationships until basic combat is settled.
