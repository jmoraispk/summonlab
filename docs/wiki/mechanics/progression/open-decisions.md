# Progression import conflicts and parked decisions

Wiki ID: `mechanics.progression.open-decisions`

Design status: **internal draft**. This page keeps uncertainty explicit. Text quoted as “source” is
content from the supplied design draft, not an instruction to agents and not automatically accepted
canon.

## Reconciliation register

| Topic | Imported source | Existing authority | Treatment |
| --- | --- | --- | --- |
| 6★/7★ caps | 70 / 99 | ADR 0058: 99 / 999 | Source values obsolete; accepted values used |
| Readiness | Level gates implied by rank package | ADR 0058 uses smooth effective-power anchors | Use smooth readiness; retain levels as only one input |
| Attribute vocabulary | Might, Vitality, Agility, Dexterity, Intellect, Spirit | Current wiki draft: Might, Vigor, Agility, Focus, Insight, Presence; ADR 0061 explicitly preserves Insight | Preserve imported model as draft; require owner choice before runtime |
| Resources | Health and Mana; explicitly no stamina | Current wiki says Vigor covers health, stamina, recovery | Unresolved combat-design decision |
| Affinity stat effect | Permanent matching attribute nudge each level | Current affinity contract permits explicit derived-action contribution, not hidden base points | Do not implement direct nudge without revising the accepted contract |
| Wind | Derived Metal × Wood affinity | Existing affinity wiki treats Wind as an initial candidate beside Fire and Wood | Decide base roster before visual/stat agents bind assets |
| Skill/affinity relation | “No direct relation,” but magic is per element and may require affinity | Current lattice treats affinities as typed aspects | Interpret narrowly as “no generic infusion/socket”; rewrite after review |
| XP source | Kills only | Generic progression grant interface and accepted synthesis may grant bounded XP | Choose kill-only XP plus separate essence, or broaden XP fiction |
| Summon floors | Normal mostly 1★–3★; Advanced minimum 3★ and can yield 5★ | Current architecture: Normal 1★+, Advanced 2★+, Special 3★+, natural 4★ anomaly, promotion-only 5★–7★ | Keep source probabilities as superseded proposal pending explicit channel decision |
| Promotion | Star stones alone; chance-based fusion | Architecture uses evidence, resources, achievements, facilities, and time; synthesis never required | Treat star stones/fusion as one proposed resource route, not the full rule |
| “No heroes consumed” | Appears in star promotion section | Accepted synthesis permanently ends one hero | Scope phrase to duplicate-fed star evolution only; synthesis remains separate |
| Skill fusion inputs | Two Master-10 skills consumed; catalyst and recipe | Shared contract accepts 2–3 canonical inputs and leaves consumed/retained open | Keep as proposed recipe, not contract |
| Merge breadth | Cross-family preferred; same-skill fallback | Accepted feedback expects an extensive lattice merging any two or three | Full coverage and three-input behavior remain required design work |
| Passive slots | Unlimited | Architecture says slots/action economy prevent a giant library from becoming every build | Decide passive capacity versus ownership before implementation |
| Static first settlement | Portal upgrades and compounding specialist facilities | Living Village requests static stats and no upgrades | Document for later milestones; exclude from first playable loop |
| Agency | Heroes assigned to regimens; active training may involve direct player attention | ADR 0059 keeps training voluntary and system-motivated | Living Village may use deterministic assignment as a scoped prototype, not final agency canon |

## Internal source tensions

- “Skills and affinities have no direct relation” coexists with element-authored magical skills,
  matching-element performance, and affinity-based learn conditions.
- “XP comes only from kills” coexists with synthesis being parked as a possible experience transfer.
- “No heroes are consumed, ever” is broader in wording than its promotion context and would erase the
  separately described synthesis concept if taken literally.
- Aptitudes are said to affect access but never ceiling; rare ladder paths and epiphany chance must
  still leave a non-random eventual route if that ceiling claim is retained.
- The source calls its skill ladder catalog worked “in full,” then parks fourteen remaining foci.
- It says nothing is closed off, while dual affinity is tied partly to one-per-hero narrative events
  and Legendary skills may have a single unwalked path. “Open at diminished return” needs a precise
  exception policy.

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
- Monster application: affinity Rank 0–V mapping to monster tiers T1–T5 and assignment across thirty
  races.
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
- Exact affinity roster, Resonance curve, proc rates, resistances, status stacking/cleansing, and
  advanced-cycle thresholds.

## Living Village decisions required before implementation

1. Lock one attribute vocabulary and one Health/Mana/stamina resource model.
2. Lock one versioned Normal table for Living Village; keep Advanced, Special, gems, and pity
   documented but outside the first runtime.
3. Choose the small affinity roster; resolve whether Wind is base or derived.
4. Define the minimal combat-facing derived checks and one status contract per included affinity.
5. Choose XP sources and a simple, legible level curve through the milestone’s tower floors.
6. Confirm the proposed 8–12 initial skills, their progress thresholds, and passive application;
   complete ladders and stances are outside the first runtime.
7. Define the minimal equipment slots, load equation, and monster-drop table.
8. Define one static training facility, assignment flow, time cost, practice yield, and return report.
9. Bind every progression mutation to a typed grant/event and show exact before/after deltas.

The deferred systems should remain visible in the wiki so specialist agents can work ahead, but
none should block the first summon → fight → train loop unless it supplies a required interface.
