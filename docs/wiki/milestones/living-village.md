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
→ inspect and equip in the Village
→ assign targeted Court training or a species hunt
→ watch heroes travel to their activity
→ resolve training or bounded repeat combat
→ receive progression and a material haul
→ watch heroes return
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
| Tower Threshold | Select a hunting ground and species, prepare one party and threshold, and depart | travel, navigation, story choices, expedition decisions |

A dormitory, kitchen, or workshop may be visible to make the settlement believable, but they are
not interactive systems in this milestone. The settlement has fixed stats, capacity, layout, and
lighting states. It cannot be constructed, expanded, staffed, damaged, or upgraded.

Heroes have only three operational availability states: `idle`, `training`, and `deployed`. A hero
cannot occupy two states at once. Walking, arriving, departing, and returning are presentation
phases for a transition between those canonical states rather than new simulation systems.

## Three focused surfaces

Village and Roster are one persistent world surface. Detailed sheets, summoning reveals, combat
playback, and reports are focused states or overlays rather than a collection of administrative
destinations.

### 1. Village and heroes

- Presents the static Hearth, the three active destinations, and the six visible heroes.
- Selecting a hero in the world opens a compact anchored popover; a roster ribbon finds or focuses
  the same hero when overlap, zoom, or accessibility makes direct selection difficult.
- Shows identity, Health, activity, party state, and primary orders in the popover. Attributes,
  skills, equipment, and comparisons expand into a drawer without navigating to a separate screen.
- Shows the active party, current training and hunt assignments, summon availability, highest floor,
  and material summary.
- Opens the Summoning Gate and Training Court without taking the player through an administrative
  maze.
- Turns an accepted order into visible motion toward the Court or Tower Threshold, followed by a
  readable training, departure, or return animation.

### 2. Tower hunts

- Combines unlocked floor/hunting-ground selection, target species, party confirmation, a
  remaining-Health return threshold, representative combat playback, and a material haul report.
- Runs bounded deterministic encounters until any hero reaches the threshold after an encounter,
  the next encounter is unsafe, inventory capacity is reached, or another explicit cap fires.
- Explains that the threshold is a retreat rule, not invulnerability; one encounter can cross it.
- Reports kills, level XP, practical skill progress, materials, remaining Health, and the exact
  return reason.
- Returns the party visibly to the same Village surface.

### 3. Summoning Portal

- Presents currencies, banner selection, featured hero, guarantee progress, rates, and printed
  costs in one focused composition.
- Presents **Summon ×1** and the intended broader **Summon ×10 + 1 bonus** offer.
- Uses the fixed six identities for the Living Village presentation lab. Batch results do not create
  durable duplicates until the duplicate/synthesis rule is accepted.
- Returns the summoned identity to the Village as a persistent visible person.

Shortest local-training path:

```text
Village hero popover
→ Train at Court
→ choose attribute or skill focus
→ confirm
→ watch hero walk and begin
```

## Minimum runtime breadth

These are reviewable content budgets, not permanent catalog limits.

| Area | Runtime target | Full wiki material |
| --- | --- | --- |
| Heroes | exactly Dara Zev, Mara Vey, Jori Daro, Kira Toren, Iven Orra, and Remy Nahl | broader procedural human generation is deferred until after the prototype |
| Summoning | one Normal channel; deterministic receipt; enough starting access to form a party | Advanced, gems, pity, portal upgrades, and 4★–5★ odds documented but deferred |
| Progression | immutable 1★ and levels 1–10; Strength, Agility, Vitality, Magic; XP and training deltas | all seven immutable ratings and late progression documented |
| Affinity | every 1★ hero is Unaligned; an authored monster fixture may use a base affinity only if the first resolver explicitly enables it | ten total affinities, the T1–T5 affinity-rank mapping, and the rule that monsters below T3 are mostly Unaligned remain documented; hero awakening, affinity ranks, dual affinities, advanced states, Dominion, and off-cycle affinities deferred |
| Skills | 8–12 definitions across representative martial, magical, and support disciplines | complete draft compendium remains available and addressable by ID |
| Equipment | 12–20 definitions; weapon, armour, accessory; equip/unequip, rarity, weight, modifiers | complete materials/items/sets/crafting catalog documented |
| Materials | typed drops from the three runtime species; shared Village inventory; at least one visible use or fixed exchange before shipping | full gathering, recipes, crafting quality, and economy remain deferred |
| Monsters | three distinct races in one approved low-tier visual form each; floor-scaled combat variants; one separately approved boss treatment | all 30 visual-progression race seeds available for art production |
| Tower | Floors 1–10; known species hunts; about three encounter patterns with monotonically scaled definitions | story envelopes, randomized geography, secrets, and full 100-floor campaign deferred |
| Combat | shipped operator-owned `legacy-auto-v1` automatic resolution with an understandable action/result trace | `agent-readiness-v1` V2 is implemented and mechanically qualified for internal operator evaluation; broader hostile tactics, full product balance, and owner promotion remain |
| Rewards | visible hunt, material, training, progression, and daily-return benefits; exact cadence remains a fixture decision | full engagement model, Advanced/Special access, milestone cadence, pity, and economy tuning documented separately |

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
| Party | exactly three heroes; edited in the Village hero drawer, with a Tower shortcut |
| Roster | six fixed unique hero IDs: Dara, Mara, Jori, Kira, Iven, and Remy; no other face may enter this ruleset |
| Starting summons | three free seeded Normal reveals of Dara, Mara, and Jori, all 1★ for this ruleset; order may vary, identity set may not |
| Later summons | Floor 3 reveals Kira, Floor 6 reveals Iven, and Floor 9 reveals Remy; no random pool or premium purchase |
| Training | three fixed Court slots; one explicit training block; exact grant is a versioned tuning value |
| Species hunt | one party chooses an unlocked species and remaining-Health return threshold; threshold is checked after each encounter |
| Equipment slots | main hand, off hand, body, accessory |
| Inventory | shared owned-item and material drawer inside the Village hero surface with compare, equip, and unequip |
| First-clear rewards | per-hero progression claims plus one authored item; listed before deployment |
| Repeat-hunt rewards | level XP, practical skill progress, and species materials; no first-clear item, unlock, or summon token |
| Daily return | placeholder until the proposed gem amount, Special-summon cadence, and missed-day policy are accepted |
| Return state | Health and Mana reset; no lasting injury, recovery timer, death, or equipment wear |
| Save | one run snapshot plus deterministic command/event history |

Exact XP amounts, training yield, floor enemy stats, and item stats remain tuning fixtures, but their
fields, owners, and units must be locked in LV-1. If review changes any assumption, version the
fixture rather than letting each worker choose independently.

Disabled capabilities remain fully documented. An `off` skill—such as Alchemy, Animal Handling, or
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
earlier conversational conflicts, but [ADR 0072](../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md)
supersedes its six-attribute and combat-mode rules. Strength, Agility, Vitality, and Magic are the
current combat attributes; Health and Mana are the only universal resource bars. ADR 0063's
unrelated decisions—such as kill-only XP, unlimited passives, consumed-input skill merging,
star-stone promotion, and summoning bands—continue to guide future implementation. Values the
sources themselves mark approximate, unfinished, or contradictory remain visible tuning and
convergence work.

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

Court training is safe and targeted. Tower hunting is a separate progression activity: kills may
grant level XP and practical skill progress under the supplied progression rules, while the target
species produces a typed material haul. Materials can be stored before crafting is enabled, but a
shipping reward loop must give at least one selected material a visible immediate use or fixed
exchange rather than asking the player to accumulate unusable stock.

## Species hunts and automatic return

- Select one unlocked floor/hunting ground, one known species, one available three-hero party, and
  a remaining-Health threshold.
- Resolve seeded encounters individually. After each encounter, stop if any hero is at or below the
  threshold, the next encounter is predicted unsafe, capacity is full, or the encounter cap fires.
- The return threshold does not interrupt an enemy action and does not guarantee that Health cannot
  cross below it. The setup screen must communicate this risk.
- A hunt receipt records each encounter, kills by species, XP/practice claims, materials, remaining
  Health, and an enumerated return reason.
- During Living Village, returning to the Hearth resets Health and Mana and creates no permanent
  injury or death. The threshold controls trip length, risk, and haul—not a recovery simulation.

## Tower and combat boundary

Floors 1–10 are immutable content definitions. Clearing a floor unlocks the next; cleared floors
become repeatable hunting grounds. Repeat hunts may grant kill XP, practical skill progress, and
species materials, but not first-clear items, floor unlocks, or summon tokens. A hunt selects a
known species and bounded encounter sequence, then submits frozen party snapshots to a versioned
`CombatResolver` one encounter at a time.

The initial resolver may be mathematical, but it must return a seeded trace containing enough
detail to visualize and explain:

- readiness/action order (or legacy initiative where that historical mode uses it);
- skill and basic-action use;
- Health and Mana changes where applicable;
- attribute, skill, affinity, and equipment contributions;
- status applications required by the selected content;
- defeat, victory, and reward claims.

Combat reports outcomes; it does not directly grant XP, items, or unlocks. Progression, inventory,
and tower ownership validate and commit their own claims. Living Village defeat returns the party
without permanent death or lasting injury and grants no first-clear reward. Return resets Health
and Mana so the milestone does not accidentally acquire a recovery subsystem.

[ADR 0072](../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md) resolves the
attribute/resource vocabulary and release-mode authority. Remaining Living Village decisions are
XP attribution, whether affinity participates in its resolver, typed first-clear and repeat-hunt
rewards, material drop fields, and the safety estimator used before another encounter. Implemented
readiness timing, hit/miss, critical, collision rules, durable cohorts, and hostile strikes remain an
operator-evaluation path. They do not block or replace the shipped legacy automatic default; the
current V2 tuple passes its mechanical qualification gates, while broader hostile tactics, full
product balance, and explicit owner promotion remain outstanding.

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
| `HuntOrder` / `HuntReceipt` | species, party, threshold and caps / encounters, haul and exact return reason |
| `PartySnapshot` | immutable participants and prepared state for one attempt |
| `CombatRequest` / `CombatReceipt` | resolver input / seeded result and explanatory trace |
| `SummonReceipt` | channel, entropy, result, and activated pre-authored hero reference |
| `RewardClaim` | proposed XP, mastery, item, currency, or unlock delta |
| `RunSnapshot` | reloadable canonical milestone state and content versions |

Minimum causal events:

```text
hero.summoned
hero.equipment.changed
training.assigned
training.completed
hero.activity.phase.changed
hunt.started
hunt.returned
party.deployed
combat.resolved
reward.claimed
floor.unlocked
progression.changed
```

## Ownership rules

- Summoning activates one not-yet-owned identity from the fixed six and creates a receipt; it does
  not generate or render a new person.
- Tower validates a hunt order and creates each encounter request; it does not resolve combat.
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
- generated faces, identity rerolls, duplicate heroes, replacement identities, or roster expansion;
- permanent death or injury until combat stakes are deliberately accepted.

## Playable acceptance test

A fresh player can:

1. Start a run and summon enough visually distinct heroes to form one party.
2. Select each hero in the Village, understand their mechanical differences, and equip them without
   navigating to a separate roster screen.
3. Assign one hero to targeted Court training and watch them walk there and begin.
4. Send one party to hunt a known Floor-1 species with a chosen remaining-Health threshold.
5. Watch an understandable deterministic result and automatic return.
6. Return to the same Hearth with XP, skill practice, materials, and the return reason persisted.
7. Observe that training, equipment, species, or threshold changes a later hunt outcome or haul.
8. Clear and sequentially unlock Floors 1–10.
9. Reload at any point and recover the same canonical state.

Quality gates:

- the same hero is recognizable in summon, Village popover/drawer, movement, training, and combat;
- the same monster, skill, and equipment IDs bind wiki text, visual assets, UI, and resolution;
- identical initial seed plus commands produce identical receipts and state hashes;
- no hero can train and deploy simultaneously;
- failure names decisive causes and recommends at least one useful next action;
- desktop and phone layouts preserve the same decisions and readable result information.

## Four delivery checkpoints

### LV-1 — Scope and content spine

Freeze this page and the named six-hero roster, register the complete source drafts, resolve
conflicts visibly, define initial IDs, and choose the runtime monster/skill/equipment subset. Exit
when every implementation or art worker can receive a bounded wiki packet without verbal context.

### LV-2 — Static Village and prepared roster

Deliver the static Hearth, starter hero manifests, summon receipt, unified Village/hero surface,
loadouts, Training Court assignment, hero movement/activity presentation, and the three focused
surfaces. Exit when a player can summon, inspect, equip, issue training, and watch a hero reach the
Court with no combat placeholder hidden as production behavior.

### LV-3 — Deterministic tower loop

First deliver **one complete Floor-1 hunt loop**: three heroes, one target species, one return
threshold, bounded encounters, the initial skill/equipment subset, material haul, return movement,
Court training, persistence, and final presentation bindings. Only after that fixture passes should
content scale to Floors 2–10. Exit LV-3 when all ten floors use the proven adapter, the complete
loop replays from seed, and one player decision visibly changes a later outcome.

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
| Hero visuals | derivatives and continuity for the fixed six existing identities; no new face generation | presentation schema and fixed roster table | finish candidate packets without redesigning identities |
| Monster text/stats | definition candidates and stat variants, not shared race-page edits | taxonomy, combat fields | choose three races and separate visual form from combat scale |
| Monster visuals | one selected-race asset manifest per owned folder | monster visual constants | choose one approved form per runtime race |
| Skill mechanics | definitions and initial runtime subset | progression and combat contracts | choose 8–12 representative skills |
| Skill visuals | one effect/icon family per owned folder | skill visual brief and IDs | select visible actives/statuses |
| Equipment mechanics | definitions and starter/drop subset | inventory and combat contracts | choose 12–20 items |
| Equipment visuals | icons plus hero-compatible presentation bindings | equipment and hero manifests | choose slots and overlay strategy |
| Tower/content | Floors 1–10 and encounter fixtures | monster/combat/reward contracts | set encounter and reward curve |
| UI flow | three surfaces and focused states | projections and visual assets | approve navigation model |
| Combat | versioned resolver behind fixed request/receipt | shipped legacy default plus implemented readiness evaluation path | qualify readiness V2 without exposing a player mode selector or implying promotion |
| Validation | catalog, link, fixture, replay, visual and accessibility gates | all manifests/contracts | declare pass/fail evidence |

Three simultaneous visual agents—monster, skill-effect, and equipment—are a practical starting
point. A fourth visual owner may finish cross-surface derivatives for the fixed six, but must not
create more hero faces. That integration lane is more important than producing broad equipment art.

For the first asset packets, use this reduced presentation target:

- heroes: use only the six named existing anchors; finish approval where needed, then derive
  summon/roster portrait crops and one compact combat figure from each;
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
3. Approve no permanent death/injury in the Living Village slice; later readiness consequences stay
   separately versioned.
4. Decide whether the first playtest omits gems or labels them as future currency while Advanced and
   Special summoning remain off.
