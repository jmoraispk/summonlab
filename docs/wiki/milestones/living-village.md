# Living Village

Wiki ID: `milestone.living-village`

Design status: **draft for owner review**

The Living Village is the smallest visually convincing, genuinely playable Summonlab loop. It
tests whether summoning people, preparing them, resolving a tower fight, and developing them
afterward is satisfying before agentic society, settlement construction, campaign story, or broad
world exploration are introduced.

This page defines runtime scope. The complete [progression](../mechanics/progression/README.md),
[skill](../mechanics/skills/README.md), [equipment](../mechanics/equipment/README.md), and
[monster](../creatures/monster-races/README.md) drafts remain in the wiki as the expansion source;
they are not all Living Village implementation requirements. The
[Living Village release matrix](../roadmap/living-village-v1.md) is the authority for whether a
documented capability is `on`, `off`, a `placeholder`, or still a `decision` in this release.

## Product question

Can this loop sustain repeated play through meaningful, visible changes to heroes?

```text
summon
→ inspect and equip
→ choose a party and floor
→ resolve combat
→ receive rewards and progression
→ assign training
→ observe improvement
→ repeat
```

The first complete loop should take no more than about ten minutes. It should be obvious why the
party won or lost and what useful action the player can take next.

## The minimum village

One authored, static Hearth scene contains three functional destinations:

| Destination | Living Village function | Explicitly absent |
| --- | --- | --- |
| Summoning Gate | Acquire heroes and present their persistent identities | construction, portal upgrades, dialogue |
| Training Court | Assign one attribute or owned skill as a training focus | mentors, schedules, motivation, autonomous choices |
| Tower Threshold | Select a floor, prepare one party, and begin combat | travel, navigation, story choices, expedition decisions |

A dormitory, kitchen, or workshop may be visible to make the settlement believable, but they are
not interactive systems in this milestone. The settlement has fixed stats, capacity, layout, and
lighting states. It cannot be constructed, expanded, staffed, damaged, or upgraded.

Heroes have only three operational availability states: `idle`, `training`, and `deployed`. A hero
cannot occupy two states at once.

## Three navigational surfaces

Summoning reveals, combat playback, and reports are states or overlays within the primary surfaces,
not permanent top-level destinations.

### 1. Village

- Presents the static Hearth and the three active destinations.
- Shows the active party, current training assignments, summon availability, and highest floor.
- Opens the Summoning Gate and Training Court without taking the player through an administrative
  maze.
- Returns from combat with **Train returning heroes** as the primary next action.

### 2. Roster / Hero

- Combines a roster list and the selected hero sheet.
- Shows persistent visual identity, stars, level and XP, six attributes, affinity, skills,
  equipment, and availability.
- Supports equip/unequip, training assignment, and add/remove from party.
- Assigning training takes at most: select hero, select focus, confirm.

### 3. Tower

- Combines floor selection, party confirmation, combat presentation, and the result state.
- Shows sequential unlocks and permits replay of cleared floors.
- Explains the decisive combat inputs instead of showing only a win/loss power total.
- Returns directly to the Village or the preselected training flow.

Shortest post-combat path:

```text
Tower result
→ Train returning heroes
→ eligible heroes already selected
→ choose attribute or skill focus
→ confirm
→ Village
```

## Minimum runtime breadth

These are reviewable content budgets, not permanent catalog limits.

| Area | Runtime target | Full wiki material |
| --- | --- | --- |
| Heroes | exactly six visually finished adult human identities filling the proposed roster | broader procedural human visual catalog remains parallel work |
| Summoning | one Normal channel; deterministic receipt; enough starting access to form a party | Advanced, gems, pity, portal upgrades, and 4★–5★ odds documented but deferred |
| Progression | 1★ and levels 1–10; six attributes; XP and training deltas | all seven star caps and late progression documented |
| Affinity | one base affinity or Unaligned per actor; only effects required by the combat slice | ranks III–V, dual, derived, advanced cycles, and off-cycle affinities deferred |
| Skills | 8–12 definitions across representative martial, magical, and support disciplines | complete draft compendium remains available and addressable by ID |
| Equipment | 12–20 definitions; weapon, armour, accessory; equip/unequip, rarity, weight, modifiers | complete materials/items/sets/crafting catalog documented |
| Monsters | three distinct races in one approved low-tier visual form each; floor-scaled combat variants; one separately approved boss treatment | all 30 visual-progression race seeds available for art production |
| Tower | Floors 1–10; about three encounter patterns with monotonically scaled definitions | story envelopes, randomized geography, secrets, and full 100-floor campaign deferred |
| Combat | seeded deterministic resolution with an understandable action/result trace | final formula waits for the combat-system draft |
| Rewards | visible mission, training, progression, and daily-return benefits; exact cadence remains a fixture decision | full engagement model, Advanced/Special access, milestone cadence, pity, and economy tuning documented separately |

The recommended monster option is **three distinct low-tier races**, because it tests silhouette,
damage-role, and encounter readability better than one family. Bestiary T1–T5 labels are visual
progression proposals, not combat tiers: Floors 1–10 may scale stats and duties without changing a
race's approved visual form. Any visible tier evolution or boss transformation requires a separate
content decision.

## Proposed `living-village-v1` fixture

LV-1 should freeze these reversible product assumptions so UI, content, mechanics, and visual work
target the same game:

| Rule | Proposed first fixture |
| --- | --- |
| Party | exactly three heroes; edited canonically on Roster/Hero, with a Tower shortcut |
| Roster | six hero slots; every person/manifest is unique |
| Starting summons | three free seeded Normal pulls, all 1★ for this ruleset |
| Later summons | one Normal token on first clear of Floors 3, 6, and 9; no premium purchase |
| Training | three fixed Court slots; one explicit training block; exact grant is a versioned tuning value |
| Equipment slots | main hand, off hand, body, accessory |
| Inventory | shared owned-item drawer inside Roster/Hero with compare, equip, and unequip |
| First-clear rewards | per-hero progression claims plus one authored item; listed before deployment |
| Replay rewards | combat practice only; no first-clear item, unlock, or summon token |
| Daily return | placeholder until the proposed gem amount, Special-summon cadence, and missed-day policy are accepted |
| Return state | Health and Mana reset; no lasting injury, recovery timer, death, or equipment wear |
| Save | one run snapshot plus deterministic command/event history |

Exact XP amounts, training yield, floor enemy stats, and item stats remain tuning fixtures, but their
fields, owners, and units must be locked in LV-1. If review changes any assumption, version the
fixture rather than letting each worker choose independently.

Disabled capabilities remain fully documented. An `off` skill—such as Alchemy or Beast
Taming—cannot be assigned at summon, appear in a reward, enter the training selector, be proposed by
a policy, or pass command validation in this release.

## Rules retained from the supplied drafts

The first implementation should preserve these seams even when it implements only their lower
range:

- heroes, skills, equipment, and monsters are referenced by immutable, versioned IDs;
- hero stars and object rarity are different concepts;
- object and skill rarity does not increase after creation;
- skills and attributes are separate growth tracks;
- equipment weight connects gear choices to hero capability;
- a skill has a definition while each hero owns separate mastery state;
- heroes and mechanically comparable monsters share attribute and affinity meanings;
- the supplied star caps remain `10, 20, 30, 40, 50, 70, 99` for `1★` through `7★`.

ADR 0063 makes the supplied progression, skill, equipment, and monster documents authoritative over
earlier conversational conflicts. Kill-only XP, the six-attribute vocabulary, affinity formulas,
unlimited passives, consumed-input skill merging, star-stone promotion, and summoning bands
therefore guide future implementation. Values the sources themselves mark approximate, unfinished,
or contradictory remain visible tuning and convergence work.

## Training

- Select one idle hero and either one attribute or one owned skill.
- The Training Court has fixed capacity, duration, and yield.
- Training produces a typed progression claim; it does not directly rewrite the hero record.
- Yield preview and completion show the exact change.
- Training completes through an explicit **Advance training block** action. Combat does not secretly
  advance training, and a roster with all three party members training can always complete the
  block instead of becoming deadlocked.
- Mentoring, active versus passive regimens, novelty, pressure, practice-profile bonuses, food,
  fatigue, and settlement upgrades remain documented future depth.

## Tower and combat boundary

Floors 1–10 are immutable content definitions. Clearing a floor unlocks the next; cleared floors
may be replayed for combat practice but not first-clear items, unlocks, or summon tokens. A floor
selects an encounter definition and submits a frozen party snapshot to a versioned
`CombatResolver`.

The initial resolver may be mathematical, but it must return a seeded trace containing enough
detail to visualize and explain:

- initiative and action order;
- skill and basic-action use;
- Health and Mana changes where applicable;
- attribute, skill, affinity, and equipment contributions;
- status applications required by the selected content;
- defeat, victory, and reward claims.

Combat reports outcomes; it does not directly grant XP, items, or unlocks. Progression, inventory,
and tower ownership validate and commit their own claims. Until the combat rules and stakes are
accepted, defeat returns the party without permanent death or lasting injury and grants no
first-clear reward. Return resets Health and Mana so the milestone does not accidentally acquire a
recovery subsystem.

Before combat implementation begins, LV-1 must resolve five blocking rules: the attribute
vocabulary, XP attribution, whether affinity participates in the first resolver, exact defeat
behavior, and the typed first-clear/replay reward fields. The combat draft may answer these; until
then they remain explicit blockers rather than local worker choices.

## Minimum contracts

| Contract | Owns or communicates |
| --- | --- |
| `HeroInstance` | identity reference and life/availability state |
| `HeroPresentationState` | the same recognizable person on every surface |
| `ProgressionProfile` | stars, cap, level, XP, attributes, affinity, skill ownership |
| `SkillDefinition` / `HeroSkillState` | immutable skill rules / per-hero mastery |
| `EquipmentDefinition` / `ItemInstance` / `Loadout` | catalog rule / owned copy / equipped state |
| `MonsterDefinition` | combat traits plus a binding to its wiki and visual manifest |
| `FloorDefinition` / `EncounterDefinition` | unlock/reward data / selected enemies and conditions |
| `TrainingDefinition` / `TrainingAssignment` | fixed training rule / reserved hero and focus |
| `PartySnapshot` | immutable participants and prepared state for one attempt |
| `CombatRequest` / `CombatReceipt` | resolver input / seeded result and explanatory trace |
| `SummonReceipt` | channel, entropy, result, and created hero reference |
| `RewardClaim` | proposed XP, mastery, item, currency, or unlock delta |
| `RunSnapshot` | reloadable canonical milestone state and content versions |

Minimum causal events:

```text
hero.summoned
hero.equipment.changed
training.assigned
training.completed
party.deployed
combat.resolved
reward.claimed
floor.unlocked
progression.changed
```

## Ownership rules

- Summoning creates a hero and a summon receipt; it does not render the hero.
- Tower creates an encounter request; it does not resolve combat.
- Combat produces an outcome and claims; it does not mutate progression or inventory.
- Progression validates XP, levels, attributes, affinity, and skill-practice claims.
- Inventory validates item grants and loadouts.
- Training produces a claim against a reserved hero; it does not own progression.
- Presentation consumes canonical projections and never commits gameplay consequences.

## Explicit exclusions

- personality, moods, requests, dialogue, relationships, beliefs, knowledge propagation, and model
  calls;
- autonomous behavior, schedules, social simulation, and the 1,000-agent scale model;
- construction, expansion, staffing, repair, food, upkeep, or other settlement management;
- multiple parties, expedition navigation, portals, neighbor exploration, and mounts;
- tower story, procedural geography, discoveries, secrets, or randomized campaigns;
- synthesis and hero sacrifice;
- promotion above 1★ during the playable slice and runtime levels above 10;
- skill merging, mentorship, complete ladders, advanced mastery, and practice-profile bonuses;
- crafting, enchanting, item sets, durability, repairs, and per-hero cargo;
- premium purchases, monetization, and a production economy;
- permanent death or injury until combat stakes are deliberately accepted.

## Playable acceptance test

A fresh player can:

1. Start a run and summon enough visually distinct heroes to form one party.
2. Inspect each hero, understand their mechanical differences, and equip them.
3. Deploy to Floor 1 and watch an understandable deterministic result.
4. Return to the same Hearth with rewards and progression persisted.
5. Assign returning heroes to training through the short post-combat path.
6. Observe that training or an equipment change materially changes a replayed combat result.
7. Clear and sequentially unlock Floors 1–10.
8. Reload at any point and recover the same canonical state.

Quality gates:

- the same hero is recognizable in summon, roster, Village, training, and combat;
- the same monster, skill, and equipment IDs bind wiki text, visual assets, UI, and resolution;
- identical initial seed plus commands produce identical receipts and state hashes;
- no hero can train and deploy simultaneously;
- failure names decisive causes and recommends at least one useful next action;
- desktop and phone layouts preserve the same decisions and readable result information.

## Four delivery checkpoints

### LV-1 — Scope and content spine

Freeze this page, register the complete source drafts, resolve conflicts visibly, define initial IDs,
and choose the runtime monster/skill/equipment subset. Exit when every implementation or art worker
can receive a bounded wiki packet without verbal context.

### LV-2 — Static Village and prepared roster

Deliver the static Hearth, starter hero manifests, summon receipt, Roster/Hero surface, loadouts,
Training Court assignment, initial content fixtures, and the three primary navigation routes. Exit
when a player can summon, inspect, equip, and assign training with no combat placeholder hidden as
production behavior.

### LV-3 — Deterministic tower loop

First deliver **one complete Floor-1 loop**: three heroes, one encounter, the initial skill and
equipment subset, combat, reward, training, persistence, and final presentation bindings. Only
after that fixture passes should content scale to Floors 2–10. Exit LV-3 when all ten floors use the
proven adapter, the complete loop replays from seed, and one player decision visibly changes a later
outcome.

### LV-4 — Visual integration and playtest candidate

Bind approved hero, monster, skill-effect, equipment, Village, and combat presentation assets;
polish the result-to-training route; validate desktop/phone accessibility and performance; and ship
the ten-minute playtest path. Exit only after the acceptance test above passes as one run.

## Parallel work packets

One owner controls each shared contract or catalog. Content and visual workers may proceed against
fixtures before runtime math is final.

| Lane | Collision-safe output | Depends on | LV-1 decision |
| --- | --- | --- | --- |
| Product/integration | this scope, contracts, fixtures, acceptance replay | owner feedback | approve exclusions and screens |
| Hero visuals | one manifest-bound identity per owned asset folder | presentation schema | approve six starter identity briefs |
| Monster text/stats | definition candidates and stat variants, not shared race-page edits | taxonomy, combat fields | choose three races and separate visual form from combat scale |
| Monster visuals | one selected-race asset manifest per owned folder | monster visual constants | choose one approved form per runtime race |
| Skill mechanics | definitions and initial runtime subset | progression and combat contracts | choose 8–12 representative skills |
| Skill visuals | one effect/icon family per owned folder | skill visual brief and IDs | select visible actives/statuses |
| Equipment mechanics | definitions and starter/drop subset | inventory and combat contracts | choose 12–20 items |
| Equipment visuals | icons plus hero-compatible presentation bindings | equipment and hero manifests | choose slots and overlay strategy |
| Tower/content | Floors 1–10 and encounter fixtures | monster/combat/reward contracts | set encounter and reward curve |
| UI flow | three surfaces and focused states | projections and visual assets | approve navigation model |
| Combat | versioned resolver behind fixed request/receipt | forthcoming combat draft | accept placeholder behavior |
| Validation | catalog, link, fixture, replay, visual and accessibility gates | all manifests/contracts | declare pass/fail evidence |

Three simultaneous visual agents—monster, skill-effect, and equipment—are a practical starting
point. Keep hero identity and cross-surface integration with a fourth visual owner if capacity
allows; otherwise that lane is more important than producing broad equipment art.

For the first asset packets, use this reduced presentation target:

- heroes: one approved identity anchor **per hero**, with summon/roster portrait crops and one
  compact combat figure derived from each;
- monsters: one transparent-background combat figure and one wiki plate for each selected race;
- equipment: inventory icons only—no worn-on-body regeneration or modular armour overlays yet;
- skills: icons for all twelve initial definitions and combat VFX only for the visible Active skills;
- environments: one static Hearth scene and one reusable tower-combat backdrop.

Each packet must specify pixel dimensions, camera/view, background or alpha, naming, content IDs,
and its collision-safe asset/manifest-fragment directory before generation. Visual agents own only
those directories and fragments. One integrator owns `catalog.json`, shared indexes, runtime subset
manifests, and promotion of assets onto wiki/runtime pages.

At the current collaboration limit, this task can run **16 additional agents concurrently** besides
the coordinating agent. That is a capacity ceiling, not a recommendation to use all slots. For
Living Village, roughly 8–12 bounded lanes are enough, with only 3–4 visual lanes active at once and
one integration owner controlling shared files.

## Decisions requested

1. Approve or revise the three-surface navigation model.
2. Choose the three low-tier monster races; visual tiers will remain separate from floor scaling.
3. Approve no permanent death/injury until combat rules arrive.
4. Decide whether Advanced summoning and gems are required for the first playtest or only documented.
