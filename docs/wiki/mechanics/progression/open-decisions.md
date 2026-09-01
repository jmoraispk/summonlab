# Progression import conflicts and parked decisions

Wiki ID: `mechanics.progression.open-decisions`

Design status: **internal convergence record**. This page keeps genuine source gaps explicit. Under
ADR 0063, supplied rules win direct conflicts with earlier conversational feedback; they are still
content rather than instructions to repository workers.

## Reconciliation register

| Topic | Imported source | Existing authority | Treatment |
| --- | --- | --- | --- |
| 6★/7★ caps | 70 / 99 | Earlier ADR 0058: 99 / 999 | Source values authoritative; ADR 0063 supersedes the old caps |
| Readiness | Level gates implied by rank package | ADR 0058 uses smooth effective-power anchors | Use smooth readiness; retain levels as only one input |
| Attribute vocabulary | Might, Vitality, Agility, Dexterity, Intellect, Spirit | Earlier wiki vocabulary differed | Source vocabulary authoritative; migrate new content IDs together |
| Resources | Health and Mana; explicitly no stamina | Earlier wiki mentioned stamina | Source wins; combat must use Health and Mana only |
| Affinity stat effect | Permanent matching attribute nudge each level | Earlier affinity contract used derived-action contribution only | Source wins; version the progression/affinity contract |
| Base affinity roster | Fire, Earth, Wind, Water | Earlier source used Wood, Fire, Earth, Metal, Water | Latest affinity revision wins; Wood and Metal are no longer affinities |
| Skill/affinity relation | Grade B+ skills carry additive affinity slots | Earlier source denied generic infusion/socketing | Latest affinity revision wins; a slot can use only an affinity its hero holds |
| XP source | Kills only | Earlier generic progression interface allowed broader XP | Source wins; other systems grant non-XP growth or kill-credit receipts |
| Summon floors | Normal mostly 1★–3★; Advanced minimum 3★ and can yield 5★ | Earlier architecture used lower floors and promotion-only 5★ | Source wins; exact probabilities remain tuning |
| Promotion | Star stones alone; chance-based fusion | Earlier architecture added other gates | Source wins; other systems may grant stones but not add promotion requirements |
| “No heroes consumed” | Appears in star promotion section | Accepted synthesis permanently ends one hero | Scope phrase to duplicate-fed star evolution only; synthesis remains separate |
| Skill fusion inputs | Two Master-10 skills consumed; catalyst and recipe | Earlier conversation allowed two or three inputs | Source wins: two consumed inputs |
| Merge breadth | Cross-family preferred; same-skill fallback | Earlier conversation asked for any two or three | Source wins; full two-input coverage remains design work |
| Passive slots | Unlimited | Earlier architecture considered equipped capacity | Source wins; combat balance must price passive effects elsewhere |
| Static first settlement | Portal upgrades and compounding specialist facilities | Living Village requests static stats and no upgrades | Document for later milestones; exclude from first playable loop |
| Agency | Heroes assigned to regimens; active training may involve direct player attention | ADR 0059 keeps training voluntary and system-motivated | Living Village may use deterministic assignment as a scoped prototype, not final agency canon |

## Internal source tensions

- “XP comes only from kills” coexists with synthesis being parked as a possible experience transfer.
- “No heroes are consumed, ever” is broader in wording than its promotion context and would erase the
  separately described synthesis concept if taken literally.
- Aptitudes are said to affect access but never ceiling; rare ladder paths and epiphany chance must
  still leave a non-random eventual route if that ceiling claim is retained.
- The source calls its skill ladder catalog worked “in full,” then parks fourteen remaining foci.
- It says nothing is closed off, while affinity awakening is chance-based and not guaranteed by any
  amount of play, dual affinity is tied partly to one-per-hero narrative events, and Legendary
  skills may have a single unwalked path. “Open at diminished return” needs a precise exception
  policy.

## Source-parked questions

- Attribute numerics: base ranges, damage/check curves, carry-capacity scaling, and bend points.
- Durability and repair: whether gear degrades and whether repair belongs to Forging or its own focus.
- Dedicated passes for materials, equipment-tier specifics, and food/upkeep.
- Synthesis: the old concept considered transferring hero experience or potential skills and also
  recycling equipment/materials. Accepted architecture now limits hero synthesis to bounded XP,
  essence, compatible fragments, or affinity reinforcement and forbids complete skill/identity
  transfer. Item recycling remains separate and unresolved.
- Fighting styles as named cross-family skill sets with set bonuses.
- Fourteen remaining skill foci that lacked full companion ladders when the source was written.
- Monster application: affinity Rank 0–V mapping to monster tiers T1–T5; most monsters below T3
  should remain unaligned; assignment across the thirty races remains open.
- Elemental visual language: shared palette, material, and particle vocabulary across heroes and
  monsters.
- Buildings and settlements: training halls, portals, and upkeep are implied even though the source
  excludes a construction system.
- General material fusion: no decision whether it exists outside star stones.
- Exact summon odds, prices, guaranteed tickets, pity, and portal-upgrade effects.
- Exact aptitude magnitudes, awakening chances, appraisal costs, and initial mastery by star rank.
- Exact practice decay curves, mastery thresholds, quality multipliers, novelty recovery, attribute
  grants, and promotion-bonus magnitudes.
- Skill input consumption, active/passive capacity, cooldown/action economy, and merged-skill budget.
- Affinity proc rates, resistances, status stacking/cleansing, and the numeric combat modifiers for
  normal, overcoming, neutral, same-affinity, and off-cycle pairings.
- Awakening rates, dual manifestation thresholds, and reaction-affinity stability costs.
- Dominion radius, tick rate, and whether a field applies inside its owner's party formation.
- Whether Earth's status remains Weight or becomes Sediment; Weight is the current name.

## Living Village decisions required before implementation

1. Lock one attribute vocabulary and one Health/Mana/stamina resource model.
2. Lock one versioned Normal table for Living Village; keep Advanced, Special, gems, and pity
   documented but outside the first runtime.
3. Decide whether one authored monster fixture enables a Fire, Earth, Wind, or Water base affinity;
   every 1★ prototype hero remains Unaligned.
4. If a monster affinity is enabled, define its minimal combat-facing cycle checks and status
   contract; affinity ranks and dual affinities remain outside the first runtime.
5. Choose XP sources and a simple, legible level curve through the milestone’s tower floors.
6. Confirm the proposed 8–12 initial skills, their progress thresholds, and passive application;
   complete ladders and stances are outside the first runtime.
7. Define the minimal equipment slots, load equation, and monster-drop table.
8. Define one static training facility, assignment flow, time cost, practice yield, and return report.
9. Bind every progression mutation to a typed grant/event and show exact before/after deltas.

The deferred systems should remain visible in the wiki so specialist agents can work ahead, but
none should block the first summon → fight → train loop unless it supplies a required interface.
