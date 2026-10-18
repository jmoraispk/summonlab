# Equipment

Wiki ID: `mechanics.equipment`

Design status: **runtime-v1 catalog plus versioned `engine-v26` readiness integration for combat
profiles and eligibility**. The canonical item classes and material
relationships are intentionally smaller than the imported compendium. The implementation ships 140
Weapon, Armor-piece, Shield, and Staff definitions and a separately hash-bound combat profile for
each. General armor magnitudes, durability behavior, magical active skills, Tool, Accessory, and
later quality rules remain unresolved.

Equipment covers materials, weapons, armor, shields, casting focuses, tools, accessories, and
sets. It is a companion to the progression and skill systems: equipment supplements a build,
enables particular techniques, and exposes tradeoffs without replacing a hero's underlying
capability.

## Approved visual archive

The Equipment wiki opens with all 21 approved complete armor sets, grouped from F through S.
Each set links to its matching Head, Torso, Legs, and Boots artwork. Switch to Individual items
to browse all 147 approved item images by material, rank, or equipment class, with 24 items per
page. The gallery preserves the rules and reference pages below.

The archive covers the 161 approved material-equipment images (140 individual items and 21
complete-set references) plus seven approved Greatsword images. Greatsword artwork approval does
not imply gameplay integration; those seven images are labeled as integration pending. Complete-set
references do not imply implemented set bonuses. Original approved PNG links remain available on
every card.

The gallery reuses the existing 140 runtime detail images. Its 28 additional wiki previews are
source-hash-bound WebP exports: 21 complete sets at 512 × 768 and seven Greatswords at 512 × 512.
Regenerate or verify them with `python3 tools/export-wiki-equipment-gallery.py` or the same command
with `--check`. This export does not alter runtime manifests, item definitions, or approvals.

## Reading the catalog

`R` is rank: F Common, E Uncommon, D Rare, C Epic, B Mythic, A Fabled, and S Legendary. Material
supplies base rank, while craftsmanship may add zero, one, or two ranks, capped at S.

## Complete draft

- [Rarity, craftsmanship, and weight](rarity-and-weight.md)
- [Materials](materials.md)
- [Weapons](weapons.md)
- [Armor and shields](armor-and-shields.md)
- [Staffs, tools, and accessories](focuses-tools-accessories.md)
- [Sets, enchantment, and bound equipment](sets.md)

These owner-revised pages supersede the imported item's breadth while preserving unresolved rules
honestly. Sections labeled runtime-v1 or engine-v26 describe implemented behavior; remaining
numerical and future class rules are still design material.

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
- three Armor classes: Heavy Armor, Light Armor, and Robes, each delivered as a four-item set;
- Shield, Staff, Tool, and Accessory.

The four Armor items are Head, Torso, Legs, and Boots. This produces twenty-two concrete
equippable forms across the complete Equipment stream: six Weapons, twelve Armor items, Shield,
Staff, Tool, and Accessory. The current production baseline covers Weapons, Armor, Shield, and
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

### Engine-v26 readiness combat profiles

Combat mechanics live in `combat-equipment-profiles-v1`, separate from the frozen
`equipment-content-v1` definition/visual catalog. This preserves all existing IDs and the historical
equipment hash while making load, requirements, delivery families, and named resistances auditable.
`engine-v26` readiness-state assembly consumes the profile/evaluator result to enumerate legal skill
actions and project named resistances from the exact equipped instances. `legacy-auto-v1` remains
isolated behind its frozen compatibility projection. The aggregate combat-content binding includes
the combat-skill and combat-equipment-profile catalog hashes; current readiness V2 additionally
binds its hostile-action catalog. A mission attempt stores the resulting exact aggregate and never
consults a later operator default while it runs.

- each equipped item contributes an integer load;
- Strength supplies effective equipment-load tolerance;
- an explicit heavy item may require intrinsic Strength;
- Heavy Armor requires intrinsic Strength 45 and `armor-training`;
- no item has a Vitality requirement;
- Sword and Dagger currently expose `one-handed-blade`, Bow exposes `bow`, Staff exposes
  `staff-focus`, and Shield exposes `shield` for skill delivery;
- Heavy Armor supplies authored Cut and Impact resistance grants, Light Armor supplies Pierce,
  and Robes supply Arcane;
- resistance grants become deterministic source receipts and combine only for matching damage tags;
- optional Break meters must be authored by the content that owns them; there is no universal
  poise resource.

General physical mitigation belongs to armor points after penetration and is capped at 7,499
basis points by `combat-rules-v1`. The current equipment profiles intentionally do **not** assign
general armor-point magnitudes, so the benchmark armor values in the balance harness are promotion
candidates rather than production item stats.

The engine stores durability fields, but wear, repair, general armor magnitudes, magical active
equipment effects, enchantment, sets, monster crafting, bound items, storage magic, field tools,
Potions, and Food are outside this slice.

### Seeded demonstration pool

The catalog contains every retained rank and material. The current playable fixture deliberately
seeds only bounded material lots and starter inventory so the workshop can demonstrate the complete
contract without claiming a Gathering economy.

| Need | Candidate items |
| --- | --- |
| Weapons | Sword, Dagger, Spear, Bow, Axe, Mace |
| Defense | Head, Torso, Legs, and Boots for each of Heavy Armor, Light Armor, and Robes; Shield |
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
remain Shields; visually different Bows remain Bows. Armor has the stronger consistency rule:
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

The full canonical material ladder has seven materials in each of four families. Every Armor
material requires five images in a fixed sequence: one complete-set consistency image followed by
four separate item images for Head, Torso, Legs, and Boots. The complete set is production evidence;
the four pieces are the item images.

| Material family | Images per material | Materials | Images |
| --- | ---: | ---: | ---: |
| Metal | five Weapons + Shield + five-image Heavy Armor sequence | 7 | 77 |
| Wood | Bow + Staff | 7 | 14 |
| Hide or scale | five-image Light Armor sequence | 7 | 35 |
| Cloth or fiber | five-image Robes sequence | 7 | 35 |
| **Total** |  | **28** | **161** |

Equivalently, each rank contributes 23 images across its four materials, and seven ranks contribute
`23 × 7 = 161` images. The total consists of 140 isolated equipment images and 21 complete-set
consistency images.

This budget assumes one image per Weapon class and material, with no additional image for
craftsmanship grades or one-handed/two-handed use. It excludes Tools, Accessories, named sets, and
monster-derived equipment. A reduced prototype Weapon selection subtracts one image per omitted
Weapon at every included material rank; it does not reduce the five-image requirement for an
included Armor set.

All 161 entries are owner-approved sources. The 140 isolated items each have deterministic card and
detail runtime derivatives; the 21 full-set images remain approved continuity references and never
become inventory items.

### Retained visual authority

The [approved source catalog](../../../../assets/equipment/approved/material-equipment-v1/manifest.json)
is the sole retained full-resolution authority for the accepted 161-image material ladder. Its
manifest and approval receipts preserve the historical v3 candidate paths, hashes, and checkpoint
decisions. The duplicate candidate and revision rasters are retired; all retained Equipment PNG
masters and visual references are stored through Git LFS. The 280 optimized runtime WebPs remain
ordinary Git files.

The separate
[Greatsword source catalog](../../../../assets/equipment/approved/two-handed-greatsword-v1/manifest.json)
contains seven owner-approved, source-only masters across the metal rank ladder. These bring the
approved Equipment source total to 168 without changing the current 140 definitions or 280 runtime
derivatives.

The [rank-first v3 production record](../../../../assets/equipment/experiments/material-equipment-v3/README.md)
retains its compact manifest, targets, assignments, prompts, results, checkpoints, selections,
receipts, and accepted direction boards. Generated contact sheets, review galleries, thumbnails,
and the duplicate source rasters are intentionally absent. The superseded v1 and v2 planning runs
and their one-time production tooling were retired on 2026-09-07.

Accepted material-vs-class and rank-first calibration boards remain as visual-production guidance.
The completed two-handed Greatsword campaign retains its compact provenance and accepted direction
board; its seven duplicate candidate rasters and generated review artifacts were retired after
source promotion.

## Source authority and remaining decisions

The supplied vocabulary and rules win earlier conversational alternatives. Genuine internal gaps
remain preserved rather than silently normalized:

- Equipment uses the four combat attributes. Strength alone owns load tolerance and explicit heavy-item
  requirements; learned Armor Training owns armor proficiency. Precision and crafting quality
  belong to learned skills rather than additional attributes.
- A material supplies base rank. Item and material difficulty set the required Forging level;
  Standard work keeps the base rank, Fine work adds one rank, and Masterwork adds two, capped at S.
  The exact difficulty values and benefit table remain to be authored.
- Weight tolerance uses scoped effective Strength. A permanent Strength gate reads intrinsic Strength, and
  Vitality never grants equipment eligibility.
- An item's rarity is fixed forever, while Living Metal grows with its wielder. Growth can be
  compatible with fixed rarity, but the mutable stats/properties need an explicit boundary.
- Clarify whether material/monster is one source axis while enchantment and binding are independent
  overlays rather than additional item classes.
- Armor uses four items—Head, Torso, Legs, and Boots—authored from one consistent full-set source.
  Accessory begins with one slot. Exact inventory and loadout representation still requires an
  executable contract.
- The six-weapon hand model is accepted in prose: a two-handed item occupies both hands, Shield
  requires one free hand, and Dual Wield permits only one-handed Swords and Daggers. Exact combat
  tradeoffs remain open.
- General armor magnitude, detailed weapon damage, magical active skills, penetration content,
  statuses, Mana effects, affinity application, and granted-skill effects remain later
  combat/content work. Readiness/evasion, named resistance receipts, family delivery tags, load,
  Strength requirements, and Armor Training are implemented for the readiness slice.
- Monster materials taken from sapient peoples require source, consent, death, personhood, and
  social-consequence rules; a species label must never itself imply a harvestable enemy resource.
- The source does not define acquisition: summon loadouts, tower drops, settlement stock, crafting,
  rewards, and recovery after defeat remain open.

## Change notes

- 2026-09-07 — Greatsword source promotion — Promoted all seven exact reviewed Greatsword sources
  into a dedicated approved catalog, retained compact provenance and the accepted direction board,
  and retired duplicate candidates and generated review artifacts without changing runtime or
  gameplay content.
- 2026-09-07 — source retirement — Retained the 161 approved masters, 280 runtime derivatives,
  compact v3 provenance, accepted direction/calibration boards, and review-pending Greatsword
  campaign; retired superseded v1/v2 campaigns, duplicate v3 rasters/review galleries, and obsolete
  producer tooling; moved every retained Equipment PNG to Git LFS.
- 2026-09-03 — v3 candidate closeout — Accepted all 77 roots and 84 Armor pieces, reconciled 11
  directions and 60 audit sheets, and created a 161-entry proposal-only promotion list without
  modifying approved or runtime assets.
- 2026-09-02 — v2 root activation — Materialized 77 root packet pairs and activated one immutable,
  root-only, 16-worker Equipment run; all 84 Armor pieces remain review-gated.
- 2026-09-02 — v2 profile acceptance — Recorded the owner's profile-only acceptance and added the
  isolated v2 execution-record schemas and in-memory packet renderer without materializing packets
  or authorizing a run or image generation.
- 2026-09-02 — v2 planning — Prepared a collision-safe 161-target manifest, inert allocation plan,
  and approval-candidate visual profile with hash-bound class pose and Armor camera references.
- 2026-09-02 — owner material lock — Locked Bronze, Ash, and Hard Leather; deferred double-bit Axes
  as later variants.
- 2026-09-02 — owner visual review — Made within-class weapon pose and full-set Armor camera,
  empty-interior, and Head-item consistency explicit; recorded v2 revision feedback without
  mutating v1 evidence.
- 2026-09-02 — root production — Completed all 77 root jobs with 76 reviewable images; retained 84
  Armor-piece jobs behind full-set human-review gates.
- 2026-09-01 — production planning — Bound all 161 material targets into one resumable Equipment
  run with 77 initially ready jobs, 21 human-review gates, and 84 dependent Armor-piece jobs.
- 2026-09-01 — owner revision — Split each Armor class into Head, Torso, Legs, and Boots; required
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
