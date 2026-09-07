# Four-Attribute and Versioned Combat Modes Design

Status: **accepted; implementation planned**

Date: 2026-09-06

Implementation plans:

- `docs/superpowers/plans/2026-09-06-four-attribute-legacy-combat.md`
- `docs/superpowers/plans/2026-09-06-agent-readiness-combat.md`

## Purpose

Replace the six-attribute proposal with a smaller combat-first capability model, revise the target
combat architecture around deterministic agent-selected intents, and preserve the current automatic
round-based combat as an operator-controlled legacy mode while the agentic readiness mode matures.

This design records the agreed mechanical boundaries before the wiki, contracts, engine, content,
and presentation are changed. It does not yet select final balance constants.

## Player promise

Four attributes should be readable at a glance and should primarily explain combat capability.
Learned competence belongs to skills and practice. Personality, history, relationships, knowledge,
and current condition remain separate human layers rather than being compressed into combat stats.

Heroes choose among engine-supplied legal actions. A deterministic resolver, never a model, decides
movement conflicts, hits, criticals, damage, status, recovery, and death. The owner may choose which
versioned combat mode a release uses; players cannot change combat rules.

## Goals

1. Make `Might`, `Vitality`, `Agility`, and `Spirit` the canonical visible attributes.
2. Give each attribute a narrow, combat-first role without creating a universal best stat.
3. Move learned precision, resistance, morale, and learning differences to their proper systems.
4. Keep Health and Mana as the only universal resource bars.
5. Remove universal poise while preserving room for authored Break mechanics.
6. Add a deterministic, stepped readiness-combat contract with per-hero intent providers.
7. Preserve automatic no-tick combat as an internally selected, versioned legacy mode.
8. Preserve historical replay and make every mode choice explicit in attempt evidence.

## Non-goals

- Final numerical curves, point grants, hit rates, regeneration rates, and affinity multipliers.
- Six derived elements, high-rank affinity inversions, Dominion, or other advanced affinity rules.
- Free-form model-authored combat actions or a generic model referee.
- A player-facing combat-mode selector.
- Full idle-gain and autonomous daily-schedule design; that is the next independent design slice.
- A permanent model process for every hero.
- Rewriting historical events, receipts, seeds, choice logs, or state hashes.

## Canonical attributes

| Attribute | Owns | Does not own |
| --- | --- | --- |
| **Might** | physical damage; carrying capacity; equipment-load tolerance; explicit heavy-equipment requirements | accuracy; critical rate; general mitigation; action cadence |
| **Vitality** | maximum Health; modest natural Health regeneration | armour mitigation; poise; broad physical resistance; status immunity |
| **Agility** | readiness accumulation; movement capability; evasion; a bounded relative-speed contribution to hit contests | learned accuracy; critical rate; unrestricted extra actions |
| **Spirit** | magical damage; maximum Mana; modest saturating Mana regeneration | morale; learning rate; control duration; mental resistance; decision quality |

The old `Might / Vitality / Agility / Dexterity / Intellect / Spirit` vocabulary is retired for new
canonical content. Historical schema fields remain readable under their original rules.

### Why Dexterity is removed

Accuracy, weak-point execution, crafting quality, and gathering competence are learned
capabilities. A specific skill's mastery and authored practice bonuses own them. Agility may modify
a hit contest only through a tightly bounded relative-speed term; it does not become the primary
accuracy stat.

Equipment character replaces finesse scaling. Daggers, swords, bows, and heavy weapons combine
physical coefficient, delivery restrictions, properties, and recovery cost to produce different
cadences while physical damage continues to scale from Might.

### Why Intellect is removed

Magical output moves to Spirit. Lore, appraisal, analysis, recipes, and identification move to
their learned skill families. Model reasoning quality is never varied by an intelligence stat.

## Intrinsic and effective attributes

Progression must distinguish persistent capability from context-specific action modifiers:

```text
base attribute + persistent typed growth = intrinsic attribute

intrinsic attribute
+ modifiers relevant to this action and scope
= effective attribute for this check
```

Level allocation and permanent training change intrinsic attributes through typed receipts.
Equipment, enchantments, food, conditions, and temporary effects declare which checks they modify;
they do not automatically affect every conversion sourced from an attribute. Progression gates and
history consume intrinsic values. Combat resolution consumes the scoped effective values.

Every modifier records its source, scope, stacking rule, cap, duration, and rules version.

## Health, Mana, and regeneration

Health and Mana remain the only universal bars. There is no stamina or universal poise bar.

Vitality increases maximum Health and contributes modestly to natural recovery. Out-of-combat
recovery is meaningfully faster than combat recovery. Natural combat regeneration:

- uses a strongly bounded conversion;
- pauses for an authored recovery delay after taking damage;
- cannot revive a downed hero;
- cannot repair injuries;
- remains weaker than dedicated healing skills, consumables, and safe rest.

The balance harness must reject any curve where passive regeneration can outpace sustained peer
damage or create indefinite combat without an explicit defensive engine.

Spirit increases magical damage and maximum Mana. It may make a modest, saturating contribution to
Mana regeneration, but equipment, stances, passives, and skill effects remain the stronger ways to
specialize in regeneration. Low-cost martial skills use Mana without forcing ordinary martial
heroes to make Spirit a primary investment.

## Learning differences outside the attribute sheet

Learning does not scale from Spirit. Practice gain composes several explicit influences:

```text
base practice evidence
× small cognitive-learning factor when the domain requires comprehension
× relevant domain aptitude
× teaching and facility quality
× motivation and current condition
× practice variety
× repetition decay
```

The cognitive-learning factor is an initially hidden, bounded part of the character manifest. Its
initial balance band may change comprehension-heavy practice gain by no more than ten percent in
either direction. It never changes model quality, legal-action quality, human worth, or eventual
access. Domain aptitudes distinguish magical theory, martial technique, crafting, survival, social
practice, and other families more strongly than the general factor does.

The player sees evidence-based observations from practice and mentors rather than an exposed IQ
number. No single hidden value makes one hero the fastest learner in every domain.

## Progression and affinity

The old six-stat point budget is not copied unchanged. Balance work starts from one freely allocated
point per level. If persisted six-stat allocations require a compatibility conversion, two-thirds
of the old total is the initial migration hypothesis rather than a new-growth rule. Promotion of
either budget requires benchmark simulation at levels 10, 40, 70, and 99.

The four base affinities retain a small thematic association:

| Affinity | Matching attribute |
| --- | --- |
| Fire | Might |
| Earth | Vitality |
| Wind | Agility |
| Water | Spirit |

The first tuning candidate caps the affinity nudge at ten percent of the matching attribute's
contribution, not ten percent final damage or durability. The harness must demonstrate credible
Fire casters, Water martial heroes, and other off-association builds before promotion.

## Damage and defense

The initial target retains physical and magical action types. Might scales physical magnitude;
Spirit scales magical magnitude. Skill-specific base effect, compatible equipment, affinity, and
the defender's applicable mitigation complete the action calculation.

Vitality does not supply universal mitigation. General physical mitigation belongs to armour:

```text
effective armour = max(0, armour - penetration)
armour reduction = effective armour / (effective armour + versioned balance constant)
```

Attacker level is not an armour-penetration term. Stronger attackers overcome armour through
explicit skills, equipment, penetration, positioning, statuses, or other visible sources.

Named resistances such as Cut or Burn belong to passive skills, equipment, affinity, physiology,
and temporary effects. Each resistance declares its damage/status tags, conversion, stacking rule,
and cap. No base attribute grants blanket physical or mental resistance.

### Armour eligibility

Vitality is not an armour requirement because that would combine Health, regeneration, and access
to mitigation in one investment. Might supplies load tolerance and may satisfy an explicit heavy
equipment requirement. Armour Training supplies learned proficiency. Items may add other authored
requirements without making Vitality the universal tank gate.

### Poise and Break

Universal poise is removed. Heavy weapons retain identity through physical magnitude, penetration,
knockback, recovery cost, and authored stagger effects. A particular boss, shield, stance, or skill
may add a visible Break meter later; that meter belongs to the content mechanic and is not a hidden
second Health bar shared by every unit.

## Accuracy, evasion, and criticals

Skill mastery is per-skill accumulated competence. It primarily improves reliability and accuracy
and unlocks authored refinements. It does not automatically improve damage, accuracy, critical
chance, Mana efficiency, and action cadence together. Common skills remain useful through their
effects, compatibility, reliability, cost, and passive benefits.

The structural hit contest is:

```text
skill accuracy versus defender evasion
+ a small bounded modifier from relative attacker/defender Agility
+ explicit flank, surround, unaware, and other positional modifiers
```

Relative Agility may shift the result modestly but never replaces mastery as the main source of
accuracy. Initial experience targets are 65-70% for a novice against an ordinary peer, about 80%
for a trained peer matchup, and 90-95% for mastery against an ordinary peer. Exact scales and clamps
come from simulation rather than being frozen in this design.

Criticals and misses use seeded engine randomness. Critical opportunity comes from the skill's
authored behavior, target state, and explicit practice bonuses. Target conditions such as flanked,
unaware, or staggered may create a strong critical opportunity without making critical chance a
base attribute.

## Equipment compatibility

Skill definitions declare compatible equipment-family delivery tags. A hero's learned-skill state
records the compatible family or families with which the skill has been practiced. Legal-action
enumeration requires an intersection between the equipped item tags, skill delivery tags, and the
hero's trained tags.

Tags describe families such as one-handed blade, two-handed blade, bow, staff/focus, shield, or
unarmed. They do not bind a learned technique to one exact item instance. Transfer to a related
family requires authored familiarization or mastery rules rather than silent universal access.

## Combat architecture

Combat keeps three authority layers:

| Layer | Responsibility | Mechanical authority |
| --- | --- | --- |
| Intent provider | select one legal action, target/destination, and allowed fallback | none beyond the validated selection |
| Combat Resolver | time, arbitration, movement, hit, critical, damage, status, downing, and outcome | complete and deterministic |
| Narration | present already-resolved events | none |

A model is never the referee. A model cannot create effects, inspect hidden rolls, write state, or
declare harm/death. Narration is optional; the factual event trace must stand alone.

The engine exposes a stepped contract instead of pretending a nondeterministic provider is part of
a pure function:

```text
advanceUntilDecision(state) -> DecisionWindow | CombatResult
applyChoiceBatch(state, validated choices) -> state + events
```

Provider orchestration lives outside the deterministic resolver. Replay supplies the recorded
choice batches instead of calling providers.

### Randomness

Agent-readiness derives every roll from stable purpose keys rather than consuming one sequential
stream:

```text
roll = hash(
  master seed,
  attempt ID,
  tick,
  actor ID,
  action-instance ID,
  target ID when applicable,
  purpose,
  sequence
)
```

Purposes distinguish readiness ties, hits, criticals, status, target fallback, drops, and rewards.
Action-instance and target identity prevent one actor's area action or same-tick batch from
colliding with another roll key. The sequence is local to the named purpose and is never inferred
from unordered collection iteration. Providers cannot observe the seed or roll values. Recorded
choices plus the frozen specification reproduce the same trace without provider calls.

Historical modes retain their existing entropy order and purpose strings exactly.

## Operator-controlled combat modes

Combat mode is selected by an owner-controlled release configuration, not by a player preference.
The supported mode ID is materialized into an attempt when that attempt begins and participates in
its content bindings, hashes, receipts, replay, and observability.

Changing the release default affects only future attempts. An active attempt cannot switch modes.
Internal development and test tools may explicitly override the configured default; player routes
and APIs may not.

This allows a beta release to default to automatic combat while agent-readiness remains under
internal evaluation. Promotion of agent-readiness to the release default requires recorded replay,
performance, behavior, and balance evidence.

### `legacy-auto-v1`

The current automatic round/batch mode remains available and may be the configured release default.
It calls no hero model. A seeded scripted/random policy selects from legal actions, and the existing
versioned resolver produces the result.

Historical attempts retain their stored legacy aptitude fields and original rules. New
four-attribute state consumed by an active legacy runner uses an explicit compatibility projection:

```text
legacy might   <- Might
legacy finesse <- Agility
legacy insight <- Spirit
legacy resolve <- Vitality
```

The projection is mode-local, versioned, and absent from player-facing character sheets. It exists
only to keep no-tick automatic combat available during migration. Any balance or behavior change
creates a new legacy mode/rules version rather than mutating historical resolution.

### `agent-readiness-v1`

The target tactical mode uses one-tick readiness cohorts, actor-specific decision views, concurrent
intent requests, and deterministic ordered resolution. It consumes the canonical four attributes
directly.

Legacy automatic and agent-readiness may produce different tactical outcomes. They still emit a
common outer result and typed claims so progression, inventory, expedition, aftermath, and replay
do not require mode-specific ownership violations.

## Readiness and action cadence

Readiness windows are logical simulation cohorts, not wall-clock API batching delays:

```text
window T = every active actor that becomes ready on simulation tick T
```

The engine does not widen a window to collect more model calls. API latency does not advance
simulation time. The exact tick duration and readiness curve are versioned tuning constants.

Agility controls how quickly an actor reaches readiness. Once ready, the actor chooses an action;
the action's cost becomes recovery before the actor may act again. This avoids requiring a skill
choice before knowing when the actor becomes eligible to choose. Explicit channeled or wind-up
skills may schedule a future activation later, but are not required by the first implementation.

There is no independent Initiative stat in this mode. First action timing emerges from readiness,
Agility, surprise, and preparation. Equal-time resolution does not give Agility a second full
priority benefit.

## Frozen truth and actor views

Every actor in readiness window `T` binds to one canonical `CombatWindowSnapshot` containing tick,
positions, resources, conditions, cooldowns, terrain, visible telegraphs, rules version, and state
hash. Each receives an `ActorDecisionView` derived from that truth and filtered through the actor's
perception, knowledge, personal state, skills, relationships, doctrine, Master directions, and
legal actions.

The canonical snapshot is identical across the cohort. Actor views and legal actions differ. The
master seed and hidden rolls appear in no actor view.

Each provider response binds:

```text
window snapshot hash
actor view hash
legal-action-set hash
action ID
target or destination
allowed fallback selection
optional public intent
```

One API request is assembled when a logical hero needs to choose. Hero identity and memory remain
engine-owned state; no permanent model session is required. Structured fields alone affect play.
Free-form prose may supply a public statement but never an effect or private chain of thought.

## Deterministic batch arbitration

All ready actors choose from the same frozen tick before any cohort choice mutates state. The Combat
Resolver then orders the validated choices by:

1. exact unrounded readiness time where meaningful;
2. explicit authored reaction/interrupt priority where supported;
3. a stable seeded tie-break.

Each choice is revalidated against the updated resolution state when its turn arrives. Earlier
choices may change positions, down a target, claim an object, or otherwise supersede a later choice.
The later action follows its authored and selected fallback; a model is not re-queried during
arbitration.

Spatial actions distinguish entity targets from fixed-tile targets. An entity-relative flank may
recalculate valid flank tiles around the target's resolved position. A fixed-tile move remains
committed to that tile. If two actions claim the same tile, the earlier resolved action succeeds and
the later action follows its collision policy.

Every action definition names applicable policies for invalid targets, occupied destinations,
retargeting, cancellation, and readiness/Mana refunds. The event trace records the original intent,
the conflicting event, the applied fallback, and the final outcome.

Same-window actors do not see one another's unresolved choices. Coordination initially comes from
prior conversation, doctrine, formation, roles, telegraphs, and earlier events. A second model round
for public pre-commit coordination is deferred because it increases latency and cost.

## Time bounds and safety

Agent-readiness uses ticks rather than universal rounds. Two limits remain distinct:

- authored encounter deadlines are visible gameplay mechanics used only by content that needs them;
- engine safety budgets bound ticks, events, provider retries, and no-progress cycles.

An engine safety limit produces a typed stalemate, forced-retreat, or diagnostic result according
to the attempt contract. It never masquerades as an authored player failure.

Automatic legacy combat retains the round semantics bound to its own rules version.

## Outcome, claims, and permanent loss

Combat emits proposed, idempotent claims rather than directly mutating progression or inventory.
The common outer result includes outcome, final combat-local resources, harm/recovery evidence,
skill-practice evidence, loot/extraction claims, decisive events, rules/mode bindings, and replay
hashes.

Skill-use practice survives retreat because practice occurred even when the objective failed.
Objective XP and unsecured loot remain subject to mission and extraction rules.

A hero at zero Health becomes Downed. Victory or safe extraction immediately removes Downed from a
recovered hero and restores only the minimum safe Health required to leave that state; it does not
fully heal them or erase injuries. A downed hero who is not recovered before a failed extraction is
lost permanently under an explicit engine rule.

A model never declares a hero dead. An intent-provider choice may contribute causally to loss, but
the resolver alone applies the visible, versioned consequence. Permanent loss cannot ship for a
mode until its trace can identify the exact choice, tick/round, rule, and recovery failure.

## Master authority

Before combat, the Master may set doctrine, formation, roles, protected targets, forbidden tactics,
and retreat thresholds. During combat, bounded legal directions may focus a target, prioritize a
rescue, rally, hold ground, or disengage. Retreat and rescue remain available whenever the engine
can legally perform them.

Heroes still select exact legal actions unless an authored Master action explicitly owns the
choice. Directions influence future decision views and never bypass combat validation.

## Wiki and architecture propagation

The implementation must revise the canonical sources rather than adding a disconnected appendix:

- `docs/wiki/mechanics/attributes.md` for the four-attribute vocabulary and scoped modifiers;
- `docs/wiki/mechanics/progression/attributes-and-training.md` for allocation, training, and
  learning aptitude;
- `docs/wiki/mechanics/progression/affinities.md` and base-affinity pages for modest matching nudges;
- `docs/wiki/mechanics/skills/framework.md` and affected skill-family pages for mastery accuracy,
  equipment delivery, resistances, and removed prerequisites;
- equipment pages for load, armour mitigation, penetration, resistance, and delivery tags;
- `docs/wiki/systems/summoning-progression-combat.md` for the two versioned modes, stepped resolver,
  claims, downing, and mode ownership;
- system architecture, integration contracts, roadmap, and relevant ADRs for configuration,
  replay, provider, and aggregate boundaries;
- older top-level proposals only where they incorrectly present superseded rules as current canon.

The wiki must label deferred advanced affinity and free-form improvisation mechanics accurately.
It must not imply that players can select the release combat mode.

## Runtime ownership

The target implementation keeps responsibilities isolated:

```text
release configuration
  -> materializes combatModeId on attempt

progression
  -> canonical intrinsic attributes and mastery snapshots

combat-mode runner
  -> legacy automatic runner | agent-readiness stepped runner

intent orchestration
  -> scripted/random provider | hero model provider | recorded replay choices

Combat Resolver
  -> validated deterministic state transitions and trace

process managers
  -> progression, inventory, expedition, aftermath, and recovery claims
```

Mode runners share contracts and deterministic primitives where the semantics are truly identical.
They do not accumulate scattered `if legacy` branches inside one resolver. Historical reducers and
entropy purposes remain frozen behind explicit version guards.

## Compatibility and migration

1. Snapshot all existing mission state, event, action, entropy, hash, and replay behavior before
   adding the new modes.
2. Preserve every historical schema and reducer under its original discriminator.
3. Introduce canonical four-attribute state through a new schema version and typed migration event
   or bootstrap path; do not reinterpret old event bytes.
4. Add the versioned legacy compatibility projection for new four-attribute snapshots.
5. Materialize `combatModeId`, mode rules version, and content bindings at attempt creation.
6. Reject unknown, disabled, player-supplied, or mid-attempt mode changes.
7. Keep internal overrides auditable and unavailable from player routes.
8. Promote agent-readiness only after its required evidence is recorded.

## Failure handling

- An invalid model choice is rejected before resolution and receives a bounded retry or the
  attempt's deterministic fallback policy.
- A response whose snapshot, actor-view, or legal-action hash is stale cannot mutate state.
- Provider timeout and unavailability use an explicit scripted fallback and are recorded.
- A same-window collision uses authored fallback rules and never opens an unbounded re-query loop.
- A missing historical ruleset fails replay explicitly rather than silently using current rules.
- A disabled combat mode cannot start a new attempt but remains loadable for historical replay.
- Duplicate claims return the original receipt and never grant progression or loot twice.

## Verification and promotion gates

The implementation plan must include tests and fixtures for:

- four-attribute parsing, migration, intrinsic/effective scoping, and legacy projection;
- regeneration bounds, post-damage delay, and inability to revive or repair injuries;
- armour, penetration, named resistance, and absence of Vitality mitigation;
- mastery-led accuracy, bounded relative Agility, target conditions, misses, and criticals;
- equipment-family compatibility and learned delivery tags;
- one-tick readiness cohorts, differing actor views, hash binding, and concurrent provider results;
- same-tile movement, moving-target flank, target death, cancellation, retargeting, and refunds;
- provider timeout, malformed output, stale output, deterministic fallback, and retry ceilings;
- exact replay from recorded choice batches without model calls;
- immutable historical legacy replay and operator-only mode selection;
- mode locking across release-default changes and active attempts;
- common progression/inventory claims, retreat practice, downing, rescue, recovery, and loss;
- safety budgets that terminate no-progress combat without fabricating an authored defeat;
- benchmark builds and encounter simulations at levels 10, 40, 70, and 99;
- target hit-rate, regeneration, action-cadence, affinity-nudge, and cross-mode balance evidence.

Agent-readiness may become the release default only when these gates pass and owner review accepts
its behavior. Until then, the operator-controlled configuration may continue selecting legacy
automatic combat for beta releases.
