# Equipment

Wiki ID: `mechanics.equipment`

Design status: **owner-approved runtime-v1 foundation**. The canonical item classes and material
relationships are intentionally smaller than the imported compendium. The first implementation
ships the 140 Weapon, Armour-piece, Shield, and Staff definitions; detailed combat benefits,
durability, Tool, Accessory, and later quality rules remain unresolved.

Equipment covers materials, weapons, armour, shields, casting focuses, tools, accessories, and
sets. It is a companion to the progression and skill systems: equipment supplements a build,
enables particular techniques, and exposes tradeoffs without replacing a hero's underlying
capability.

## Reading the catalog

`R` is rank: F Common, E Uncommon, D Rare, C Epic, B Mythic, A Fabled, and S Legendary. Material
supplies base rank, while craftsmanship may add zero, one, or two ranks, capped at S.

## Complete draft

- [Rarity, craftsmanship, and weight](rarity-and-weight.md)
- [Materials](materials.md)
- [Weapons](weapons.md)
- [Armour and shields](armour-and-shields.md)
- [Staffs, tools, and accessories](focuses-tools-accessories.md)
- [Sets, enchantment, and bound equipment](sets.md)

These owner-revised pages supersede the imported item's breadth while preserving unresolved rules
honestly. Sections labeled runtime-v1 describe implemented behavior; remaining numerical and future
class rules are still design material.

## Craft output streams

Only three Craft families produce item catalogs:

| Craft family | Single output stream |
| --- | --- |
| **Forging** | Equipment |
| **Alchemy** | Potion |
| **Cooking** | Food |

Forging is deliberately the broad durable-item craft. Alchemy recipes change what a Potion does
without creating coating, bomb, antidote, or elixir item classes. Cooking recipes change what Food
does without creating ration, meal, broth, or feast item classes.

Gathering supplies materials and ingredients, including animal-handling outcomes, while Knowledge
produces information. They do not receive item classes merely for symmetry.

The Equipment stream contains thirteen canonical classes:

- six Weapons: Sword, Dagger, Spear, Bow, Axe, and Mace;
- three Armour classes: Heavy Armour, Light Armour, and Robes, each delivered as a four-item set;
- Shield, Staff, Tool, and Accessory.

The four Armour items are Head, Torso, Legs, and Boots. This produces twenty-two concrete
equippable forms across the complete Equipment stream: six Weapons, twelve Armour items, Shield,
Staff, Tool, and Accessory. The current production baseline covers Weapons, Armour, Shield, and
Staff; Tool and Accessory remain documented for later work.

## Implemented runtime-v1 slice

The complete catalog remains available to content, mechanics, and visual workers. Engine-v24 and
the phone workshop now prove:

```text
forge or receive an authored-drop item
→ inspect its readable properties
→ equip it in a legal slot
→ preserve the item and loadout through reload and strict replay
```

### Current runtime rules

- 140 stable, hash-bound item definitions and definition-backed item instances;
- company inventory plus main-hand, off-hand, Head, Torso, Legs, and Boots equip legality;
- one normalized rank-bearing material lot per Standard recipe;
- deterministic, idempotent workshop start/completion and persisted loadout changes;
- one bounded authored drop using the same definition catalog and item factory as Forging;
- lazy card/detail visuals resolved from the separate Equipment runtime manifest.

The engine stores durability fields, but wear, repair, detailed protection/damage effects,
enchantment, sets, monster crafting, bound items, storage magic, field tools, Potions, and Food are
outside this slice.

### Seeded demonstration pool

The catalog contains every retained rank and material. The current playable fixture deliberately
seeds only bounded material lots and starter inventory so the workshop can demonstrate the complete
contract without claiming a Gathering economy.

| Need | Candidate items |
| --- | --- |
| Weapons | Sword, Dagger, Spear, Bow, Axe, Mace |
| Defence | Head, Torso, Legs, and Boots for each of Heavy Armour, Light Armour, and Robes; Shield |
| Magical equipment | Staff |
| Seeded material lots | A bounded fixture selected from the canonical materials |

The fixture emphasizes Common equipment while the content and visual catalogs retain all F–S
definitions.

### Runtime catalog boundary

All 140 implemented definitions resolve to approved card/detail visuals. Only the definitions
needed by the current workshop or inventory are loaded into the phone view; this lazy presentation
boundary does not reduce the authoritative catalog.

## Ownership and interfaces

- Progression/combat owns derived use of scaling attributes, skill compatibility, and combat
  effects.
- Economy/item ledger owns item instances, ownership, and reservations.
- Presentation consumes equipment references and approved visual bindings.
- Expedition consumes an exact reserved loadout and publishes wear/loss outcomes if those mechanics
  are adopted.
- The prototype exposes bounded Standard Forging from seeded material lots without requiring a
  full Gathering economy, settlement upgrades, or equippable Tools.
- Creature content supplies monster materials and named-creature signature components.

## Visual-production sequence

Equipment visual work follows this owner-directed sequence:

1. simplify and review the canonical material vocabulary;
2. establish the equipment theory that maps item construction, material, craftsmanship, rarity,
   wear, and role to visible differences;
3. prepare candidate equipment coverage for every retained canonical material;
4. in parallel, let the creature-content owner define candidate item drops for every monster
   without promoting them into the Equipment catalog;
5. after that dependency is reviewed, create Equipment-owned candidates for selected monster-drop
   materials.

Material studies, equipment candidates, approved sources, and runtime exports remain separate.
Creature-drop definitions are an input to later Equipment work, not permission for either owner to
edit the other domain's shared catalogs.

### Material-readable variation

Consistency locks presentation, not exact geometry. Items in one class keep a comparable camera,
framing, pose, and normalized footprint, while each material must contribute a visible construction
idea and silhouette cue. A palette or texture swap alone is not enough. The class must remain
recognizable at phone-thumbnail size, but its blade, guard, head, limbs, body, cutouts, proportions,
or ornament may change to express the material and rank.

This variation does not create more mechanical item classes. Round, square, or hero-shaped Shields
remain Shields; visually different Bows remain Bows. Armour has the stronger consistency rule:
every full set and its four separated pieces must match each other, while sets made from different
materials should be visibly distinct rather than reusing one cut.

Cross-rank readability is the primary visual review axis. Each class is first designed and judged as
an ordered seven-rank progression so silhouette ambition rises clearly from F through S. Material
coherence remains important but secondary: the same material should share its palette, finish, and
construction vocabulary across classes without forcing identical shapes.

The owner-provided [weapon inspiration references](../../../../assets/equipment/references/2026-09-02-owner-weapon-inspiration/README.md)
are reference-only and must not be copied or promoted. They illustrate the desired range of
silhouette ambition. The v2 root run remains review evidence rather than an approved direction.

### Material coverage and image budget

The full canonical material ladder has seven materials in each of four families. Every Armour
material requires five images in a fixed sequence: one complete-set consistency image followed by
four separate item images for Head, Torso, Legs, and Boots. The complete set is production evidence;
the four pieces are the item images.

| Material family | Images per material | Materials | Images |
| --- | ---: | ---: | ---: |
| Metal | five Weapons + Shield + five-image Heavy Armour sequence | 7 | 77 |
| Wood | Bow + Staff | 7 | 14 |
| Hide or scale | five-image Light Armour sequence | 7 | 35 |
| Cloth or fibre | five-image Robes sequence | 7 | 35 |
| **Total** |  | **28** | **161** |

Equivalently, each rank contributes 23 images across its four materials, and seven ranks contribute
`23 × 7 = 161` images. The total consists of 140 isolated equipment images and 21 complete-set
consistency images.

This budget assumes one image per Weapon class and material, with no additional image for
craftsmanship grades or one-handed/two-handed use. It excludes Tools, Accessories, named sets, and
monster-derived equipment. A reduced prototype Weapon selection subtracts one image per omitted
Weapon at every included material rank; it does not reduce the five-image requirement for an
included Armour set.

All 161 entries are owner-approved sources. The 140 isolated items each have deterministic card and
detail runtime derivatives; the 21 full-set images remain approved continuity references and never
become inventory items.

The historical v1
[material production manifest](../../../../assets/equipment/experiments/material-equipment-v1/manifest.json)
expanded this budget into explicit targets. Its
[allocation plan](../../../../assets/equipment/experiments/material-equipment-v1/allocation-plan.json)
mapped all 161 targets into a dependency-aware run with 77 root jobs and 84 Armour-piece jobs gated
four at a time behind 21 full-set reviews. The adjacent
[production notes](../../../../assets/equipment/experiments/material-equipment-v1/README.md) preserve
that run's execution and provenance boundary.

### V3 candidate-production completion

The [rank-first v3 production](../../../../assets/equipment/experiments/material-equipment-v3/README.md)
completed owner-reviewed candidate closeout on 2026-09-03. It produced and accepted 77 roots and 84
individual Armour pieces across all 28 materials. The 21 full Armour sets remain consistency
evidence; the resulting equipment library therefore contains 140 isolated item images and 21
complete-set evidence images.

The [final Armour gallery](../../../../assets/equipment/experiments/material-equipment-v3/reviews/checkpoint-3-final/index.html),
[candidate closeout](../../../../assets/equipment/experiments/material-equipment-v3/runs/material-equipment-v3-run-001/candidate-closeout-v1.json),
and [proposal-only promotion list](../../../../assets/equipment/experiments/material-equipment-v3/reviews/proposed-promotions/candidate-promotion-v1.json)
preserve the exact selected paths, hashes, attempts, and owner decisions. The immutable candidates
were subsequently copied byte-for-byte into the
[approved source catalog](../../../../assets/equipment/approved/material-equipment-v1/manifest.json),
then exported into the checked Equipment runtime catalog and bound to 140 content definitions.

### Historical V2 planning state

The owner-locked [v2 planning package](../../../../assets/equipment/experiments/material-equipment-v2/README.md)
retains the same 161-target and full-set-first structure under a collision-safe new namespace. Its
manifest uses Bronze, Ash, and Hard Leather; its approval-candidate visual profile binds every
Equipment class to a hash-checked pose or camera reference, locks the standard single-bit Axe, uses
an 8% framing target with a 5% hard minimum, and requires empty self-supporting Armour sets.

The owner has accepted the v2 visual profile through a canonical-hash and reference-byte-bound
receipt whose scope is visual-profile-only. Additive v2 schemas now define the future target,
assignment, result, Armour-review, and contract-readiness records. Its deterministic renderer has
materialized the 77 root target/assignment pairs with class-scoped references. The immutable
`material-equipment-v2-run-001` activation authorizes only those roots at concurrency 16, backed by
byte- and PNG-metadata-verifying exclusive persistence. The 84 Armour pieces remain gated and
unmaterialized. Candidates and results remain review evidence rather than approved or runtime
assets; the v1/shared runner remains separate.

The v2 root run is complete: all 77 attempts have verified results and terminal receipts. Producer
triage recorded 37 **pass** (`candidate`), 33 **check** (`revise`), and 7 **no image** (`failed`),
for 70 reviewable PNGs. The no-image targets are Bronze Mace, Bronze Shield, Coarse Hide Light
Armour full set, Iron Axe, Blacksteel Heavy Armour full set, Heartwood Staff, and Sunsteel Sword.
These are immutable single-call outcomes, not approval decisions. No full Armour set has been human
accepted, so all 84 piece images remain locked and absent.

The [rank-first full-production plan](../../../superpowers/plans/2026-09-02-equipment-rank-first-full-production.md)
is complete through owner-reviewed candidate closeout. It used class progression direction first,
dedicated individual renders second, material-cohort review as a secondary check, and Armour pieces
only after accepted full-set sources. The earlier material-first draft is superseded.

### Historical v1 root-production review state

Run `material-equipment-v1-run-001` is activated and its root phase is complete. All 77 root jobs
have verified provenance results and terminal journal evidence: 16 are machine-checklist
`candidate`, 60 are `revise`, and one is `failed`. There are 76 reviewable PNGs because the failed
Ash Staff call returned no usable image.

These states are not approval decisions. Read `candidate` as **pass**, `revise` as **check**, and
`failed` as **no image**. Most check states in this run are strict framing-margin flags. The
[root review packet](../../../../assets/equipment/experiments/material-equipment-v1/review-packets/material-equipment-v1-run-001/README.md)
contains the rank sheets, exact totals, and the owner-feedback brief for a separately versioned v2.

The 84 Armour-piece jobs remain gated and unproduced. No full-set source has been accepted through
the gate, and no candidate has been approved or promoted to runtime.

```text
profile candidate → exact owner acceptance → 77 root packets
zero-write readiness → immutable activation → claim up to 16
worker generation → result verification → terminal journal event
human full-set receipt → four child packets → continued claims
candidate review remains separate from approval and runtime promotion
```

#### Historical operator reference

The commands below document the v1 workflow. They are retained for audit and recovery; the
one-time profile acceptance and activation commands must not be rerun against existing artifacts.
Read-only checks still create no run or image state:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-image-profile.ts --check
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts check-root-packets
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts report-readiness
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts simulate --available-worker-slots 16
```

The profile candidate’s deterministic write command is
`corepack pnpm tsx tools/export-equipment-image-profile.ts`; its one-time exact owner-acceptance
command is recorded in the
[Equipment-local production notes](../../../../assets/equipment/experiments/material-equipment-v1/README.md)
and must not overwrite the existing exclusive acceptance.

The following block records the activation boundary used by v1. Do not rerun it against the
existing run ID:

```bash
EQUIPMENT_RUN_ID=material-equipment-v1-run-001
EQUIPMENT_RUN_CREATED_AT=2026-09-02T01:00:00.000Z
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts activate-run \
    --run-id "$EQUIPMENT_RUN_ID" --created-at "$EQUIPMENT_RUN_CREATED_AT" \
    --activated-at 2026-09-02T01:00:01.000Z --activated-by owner
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts claim-next \
    --run-id "$EQUIPMENT_RUN_ID" --available-worker-slots 16 \
    --epoch-id equipment-epoch-001 --actor root-orchestrator \
    --requested-at 2026-09-02T01:01:00.000Z --recorded-at 2026-09-02T01:01:01.000Z
```

For each exact returned claim, validate the packet, render its byte-exact prompt, record start,
persist only the exact generated source, persist and verify the result, then record terminal:

```bash
EQUIPMENT_TARGET_PATH='replace-with-claim-target-path'
EQUIPMENT_ASSIGNMENT_PATH='replace-with-claim-assignment-path'
EQUIPMENT_TARGET_ID='replace-with-claim-target-id'
EQUIPMENT_WORKER_ID='replace-with-claim-worker-id'
EQUIPMENT_CLAIM_ID='replace-with-claim-id'
EQUIPMENT_CANDIDATE_PATH='replace-with-assignment-candidate-path'
EQUIPMENT_RESULT_PATH='replace-with-assignment-result-path'
EQUIPMENT_RESULT_CANONICAL_SHA256='replace-with-verified-result-canonical-sha256'
EQUIPMENT_SOURCE_IMAGE=/absolute/path/to/exact-imagegen-output.png
EQUIPMENT_RESULT_JSON=/absolute/path/to/worker-result.json
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts validate-packet \
    --target "$EQUIPMENT_TARGET_PATH" --assignment "$EQUIPMENT_ASSIGNMENT_PATH"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts render-prompt \
    --target "$EQUIPMENT_TARGET_PATH"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts record-start \
    --run-id "$EQUIPMENT_RUN_ID" --event-id start-001 --actor root-orchestrator \
    --requested-at 2026-09-02T01:02:00.000Z --recorded-at 2026-09-02T01:02:01.000Z \
    --claim-id "$EQUIPMENT_CLAIM_ID" --target-id "$EQUIPMENT_TARGET_ID" \
    --worker-id "$EQUIPMENT_WORKER_ID"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/persist-equipment-image-production-output.ts \
    --workspace-root "$PWD" --source "$EQUIPMENT_SOURCE_IMAGE" \
    --destination "$EQUIPMENT_CANDIDATE_PATH" --width 1024 --height 1024 \
    --media-type image/png
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts persist-result \
    --target "$EQUIPMENT_TARGET_PATH" --assignment "$EQUIPMENT_ASSIGNMENT_PATH" \
    < "$EQUIPMENT_RESULT_JSON"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts verify-result \
    --target "$EQUIPMENT_TARGET_PATH" --assignment "$EQUIPMENT_ASSIGNMENT_PATH" \
    --result "$EQUIPMENT_RESULT_PATH"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts record-terminal \
    --run-id "$EQUIPMENT_RUN_ID" --event-id terminal-001 --actor root-orchestrator \
    --requested-at 2026-09-02T01:10:00.000Z --recorded-at 2026-09-02T01:10:01.000Z \
    --target-id "$EQUIPMENT_TARGET_ID" --worker-id "$EQUIPMENT_WORKER_ID" \
    --status candidate --result-canonical-sha256 "$EQUIPMENT_RESULT_CANONICAL_SHA256"
```

A human-accepted full-set receipt creates exactly four child packet pairs and unlocks continued
claims. This accepts consistency-source evidence only; it does not approve the candidate or promote
anything to runtime:

```bash
EQUIPMENT_GATE_ID='replace-with-gate-id'
EQUIPMENT_CANDIDATE_SHA256='replace-with-human-inspected-candidate-sha256'
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts review-armour-source \
    --run-id "$EQUIPMENT_RUN_ID" --gate-id "$EQUIPMENT_GATE_ID" --reviewer owner \
    --reviewed-at 2026-09-02T01:20:00.000Z \
    --accept-candidate-sha256 "$EQUIPMENT_CANDIDATE_SHA256"
```

Crash reconciliation is read-only until explicitly acknowledged. It blocks partial output, never
time-reaps a started worker, verifies a complete immutable pair before a terminal append, and
requires exact target, worker, reason, acknowledgement, and append identity for operator-confirmed
failure. Terminal append authorization must copy both the exact status and exact canonical result
SHA-256 from the prior dry response; locked re-verification rejects drift without an append. Dry,
terminal-append, and operator-confirmed-failure modes are complete and mutually exclusive. Report
remains zero-write:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts reconcile \
    --run-id "$EQUIPMENT_RUN_ID" --target-id "$EQUIPMENT_TARGET_ID" \
    --worker-id "$EQUIPMENT_WORKER_ID" \
    --observed-at 2026-09-02T01:30:00.000Z
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts reconcile \
    --run-id "$EQUIPMENT_RUN_ID" --target-id "$EQUIPMENT_TARGET_ID" \
    --worker-id "$EQUIPMENT_WORKER_ID" \
    --observed-at 2026-09-02T01:30:00.000Z --event-id reconcile-terminal-001 \
    --actor root-orchestrator --requested-at 2026-09-02T01:30:00.000Z \
    --recorded-at 2026-09-02T01:30:01.000Z --acknowledge-terminal yes \
    --expected-terminal-status candidate \
    --expected-result-canonical-sha256 "$EQUIPMENT_RESULT_CANONICAL_SHA256"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts report \
    --run-id "$EQUIPMENT_RUN_ID" --created-at "$EQUIPMENT_RUN_CREATED_AT" \
    --generated-at 2026-09-02T01:31:00.000Z
```

The Equipment-local production notes contain the exact candidate persistence, result persistence,
rejection, pause/resume, and operator-confirmed failure variants. Candidate review, source approval,
and runtime promotion remain distinct later decisions.

## Source authority and remaining decisions

The supplied vocabulary and rules win earlier conversational alternatives. Genuine internal gaps
remain preserved rather than silently normalized:

- Equipment uses the progression vocabulary for Dexterity, Vitality, Intellect, and affinity rank.
  New runtime IDs must use the same current names.
- A material supplies base rank. Item and material difficulty set the required Forging level;
  Standard work keeps the base rank, Fine work adds one rank, and Masterwork adds two, capped at S.
  The exact difficulty values and benefit table remain to be authored.
- Weight tolerance uses Might supported by Vitality as authored.
- An item's rarity is fixed forever, while Living Metal grows with its wielder. Growth can be
  compatible with fixed rarity, but the mutable stats/properties need an explicit boundary.
- Clarify whether material/monster is one source axis while enchantment and binding are independent
  overlays rather than additional item classes.
- Armour uses four items—Head, Torso, Legs, and Boots—authored from one consistent full-set source.
  Accessory begins with one slot. Exact inventory and loadout representation still requires an
  executable contract.
- The six-weapon hand model is accepted in prose: a two-handed item occupies both hands, Shield
  requires one free hand, and Dual Wield permits only one-handed Swords and Daggers. Exact combat
  tradeoffs remain open.
- Damage, mitigation, poise, penetration, bleed, Rend, initiative, evasion, attack speed, mana,
  affinity, and granted-skill effects await the combat and status contracts.
- Monster materials taken from sapient peoples require source, consent, death, personhood, and
  social-consequence rules; a species label must never itself imply a harvestable enemy resource.
- The source does not define acquisition: summon loadouts, tower drops, settlement stock, crafting,
  rewards, and recovery after defeat remain open.

## Change notes

- 2026-09-03 — v3 candidate closeout — Accepted all 77 roots and 84 Armour pieces, reconciled 11
  directions and 60 audit sheets, and created a 161-entry proposal-only promotion list without
  modifying approved or runtime assets.
- 2026-09-02 — v2 root activation — Materialized 77 root packet pairs and activated one immutable,
  root-only, 16-worker Equipment run; all 84 Armour pieces remain review-gated.
- 2026-09-02 — v2 profile acceptance — Recorded the owner's profile-only acceptance and added the
  isolated v2 execution-record schemas and in-memory packet renderer without materializing packets
  or authorizing a run or image generation.
- 2026-09-02 — v2 planning — Prepared a collision-safe 161-target manifest, inert allocation plan,
  and approval-candidate visual profile with hash-bound class pose and Armour camera references.
- 2026-09-02 — owner material lock — Locked Bronze, Ash, and Hard Leather; deferred double-bit Axes
  as later variants.
- 2026-09-02 — owner visual review — Made within-class weapon pose and full-set Armour camera,
  empty-interior, and Head-item consistency explicit; recorded v2 revision feedback without
  mutating v1 evidence.
- 2026-09-02 — root production — Completed all 77 root jobs with 76 reviewable images; retained 84
  Armour-piece jobs behind full-set human-review gates.
- 2026-09-01 — production planning — Bound all 161 material targets into one resumable Equipment
  run with 77 initially ready jobs, 21 human-review gates, and 84 dependent Armour-piece jobs.
- 2026-09-01 — owner revision — Split each Armour class into Head, Torso, Legs, and Boots; required
  full-set-first visual production; established 161 candidate images across the canonical material
  ladder.
- 2026-09-01 — owner revision — Reduced crafted outputs to Equipment, Potion, and Food; reduced
  Equipment to thirteen classes and Weapons to Sword, Dagger, Spear, Bow, Axe, and Mace.
- 2026-09-01 — owner revision — Simplified each material family to one material per rank and
  accepted material-plus-craftsmanship as the finished-item rank rule.
- 2026-09-01 — owner revision — Removed three rejected metals from the material vocabulary and
  recorded the Equipment visual-production sequence.
- 2026-08-29 — draft — Imported the complete owner-supplied equipment compendium and identified a
  bounded Living Village candidate subset.
