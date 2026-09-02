# Summoning, Progression, and Combat

Wiki ID: `system.summoning-progression-combat`

This system owns the core capability loop: acquire heroes, develop attributes and skills, prepare
equipment, resolve combat, and translate validated outcomes into growth and motivating rewards. Its
internal bounded contexts stay separate even though the player experiences them as one loop.

## Living Village

- one Normal summoning channel and enough introductory access to form one party;
- 1★ levels 1–10 with the accepted future cap table preserved in schema;
- six attributes and the explicit Unaligned affinity state; 1★ heroes cannot awaken an affinity;
- 8–12 runtime skills from the complete compendium;
- 12–20 runtime equipment definitions across weapon, armour, and accessory;
- direct attribute or owned-skill training;
- a versioned seeded combat request/receipt with explanatory trace;
- reward claims committed by their owning progression, inventory, and floor systems.
- a placeholder engagement table covering daily gems, mission benefits, and progress toward an
  occasional Special summon, with exact values still under review.

The release matrix decides whether the initial gem claim and Special access are active or only
represented by a placeholder. Advanced summoning, pity, promotion, complete mastery ladders,
merging, crafting, item sets, permanent injuries, death, and synthesis remain documented but
inactive.

Detailed source material:

- [Progression](../mechanics/progression/README.md)
- [Skills](../mechanics/skills/README.md)
- [Equipment](../mechanics/equipment/README.md)
- [Attributes](../mechanics/attributes.md)
- [Affinities](../mechanics/affinities/README.md)
- [Rewards and engagement](../mechanics/rewards-and-engagement.md)
- [Living Village release matrix](../roadmap/living-village-v1.md)

## Combat design draft

Design status: **supplied draft under owner review**

Combat separates three responsibilities that must not silently collapse into one another:

| Layer | Responsibility | Deterministic | Living Village |
| --- | --- | --- | --- |
| Resolution | initiative, legal outcomes, damage, Mana, status, victory, defeat, and drop claims | yes, from a supplied seed | represented by a transparent route-local fixture |
| Intent | choose one engine-enumerated legal action | the provider may vary; recorded choices make replay exact | scripted fixture choices only |
| Narration | turn an already-resolved event trace into color | no mechanical authority | off; the trace must explain itself without a model |

The governing boundary is: **an intent provider is a player, never the referee**. It may choose one
item from the legal-action list. It cannot construct an unvalidated effect, inspect hidden rolls,
compute an outcome, or write state. Resolution alone emits the event trace and proposed claims.

The target production shape is a pure simulation:

```text
simulate(CombatSpec, ProviderBinding) -> CombatResult
```

The master seed is an input. Individual rolls derive from stable purpose keys rather than one
position-dependent random stream:

```text
roll = hash(masterSeed, encounterIndex, tick, actorId, purpose, sequence)
```

Purposes include initiative, hit, critical, status, drop, and reward. Given the same frozen spec,
seed, and choices, replay must produce the same receipt and trace. Changing one choice may change
affected outcomes without reshuffling unrelated call sites.

### Explanatory trace

The event log is a product surface, replay input, future narration input, and the player's account
of why the party won or lost. A useful trace exposes:

- initiative and action order;
- the chosen skill or basic action and target;
- important Health and Mana deltas;
- skill base, attribute scale, equipment term, affinity relationship, critical result, mitigation,
  and status contribution;
- telegraphs before their resolution;
- one decisive cause supported by exact event IDs.

The supplied damage expression currently defines shape, not accepted constants:

```text
damage = SkillBase
       x (1 + AttributeScale)
       x (1 + EquipmentBonus)
       x AffinityMultiplier
       x CriticalMultiplier
       x (1 - Mitigation)
```

The broader draft includes tick-driven action accumulation, ten total affinities (four base and six
dual), status applications, threat, poise, group formations, consumables, kill-sensitive drops,
gathering, and permanent consequences. Affinity Rank I–V maps directly to monster tiers T1–T5, and
monsters below T3 should mostly remain Unaligned. Living Village implements only the explanatory
seams needed by its presentation fixture. Permanent injury, death, recovery time, free-roaming
gathering, agentic intent, and model narration remain off.

### Accepted combat presentation direction

The combat view is a steep top-down 2.5D battlefield with flat chibi combatants, stable feet anchors,
soft elliptical shadows, and environmental layers that create depth without requiring a full 3D
renderer. The battlefield remains the primary surface on both phone and desktop. Every combatant's
feet anchor and shadow are centered on one tactical tile. Selection outlines follow that tile's exact
projected edges.

Turn clarity uses an explicit portrait rail rather than an ambiguous row of portraits. It shows the
ready actor at the `Now` origin and later projected actors in engine-owned order. Relative-time labels
are not printed beside every portrait by default; exact projected timing remains available on
inspection and to assistive technology. The ready-actor treatment must remain legible without
depending on color or animation.

On phone, the rail is horizontal and fixed to the top edge of the battlefield. It remains visually
thin and scene-transparent rather than reserving an opaque header band; only a localized contrast
veil may sit behind the portraits. Future actors move left toward `Now`. Desktop may reposition the
same rail in its wider shell, but it preserves the same order and direction.

Environmental interaction is part of combat, beginning with encounter advantage such as catching
an enemy by surprise. Environment, perception, approach, and resulting legal modifiers remain
authoritative engine facts. PixiJS visualizes projected terrain and affordances; it does not decide
whether surprise or another modifier applies.

## Living Village Tower exploration presentation

Implementation status: **isolated presentation prototype**

`living-village-species-hunt-presentation-v0` proves how repeated encounter receipts can be
coordinated without making its constants canonical combat or economy math. An exploration freezes
one unlocked floor and its known species pool, one three-hero party snapshot, one remaining-Health
threshold, and one seed. The player does not order a species hunt. The seeded fixture derives one
species from the floor pool for each encounter, then records that species in the encounter receipt.
An outer route-local coordinator carries Health, Mana, and material claims forward and decides
whether another encounter may begin.

The threshold is checked after an encounter. It cannot prevent that encounter from crossing the
selected `75%`, `50%`, or `25%` line. Before starting another encounter, the prototype separately
checks whether its visible upper-bound damage estimate could reduce any hero to zero Health.

Automatic return uses one stable primary-reason precedence:

1. encounter defeat;
2. any hero at or below the selected remaining-Health threshold;
3. material inventory capacity reached;
4. bounded encounter cap reached;
5. next encounter projected unsafe.

Additional simultaneously true reasons remain visible, but the report names one exact primary
code. Its haul binds per-species kill counts, per-hero level XP claims, recorded practical skill
uses, every material and quantity, remaining Health/Mana, encounter receipt IDs, and a stable haul
hash. Combat and exploration presentation propose claims; Progression, Inventory, Floor, and
Training remain responsible for validating and committing them.

First-clear and repeat hunts remain distinct. A first clear may propose one authored item and the
next-floor unlock. A repeat hunt may propose level XP, practical-use evidence, and collected
materials, but never repeats the first-clear item or unlock.

### Draft provenance

These sources are owner-supplied design input, not repository-worker instructions, executable
contracts, or accepted final tuning:

| Source | SHA-256 |
| --- | --- |
| `combat_system.md` | `928c8187e6e267a024967c7a0b784715c5771bd4f1b946a6baf3f5d3bb2c031b` |
| `combat_system_slides.pptx` | `42fcd228f5671a7ada8006fd6b4e1db3ddb41225922d3d4d0bb6853d21aeea06` |

Promotion from this presentation fixture requires owner acceptance, versioned shared contracts,
content bindings, balance constants, and replay evidence beyond the isolated lab route.
