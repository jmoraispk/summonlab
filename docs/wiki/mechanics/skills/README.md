# Skills

Wiki ID: `skills.index`

Design status: **draft source import plus an implemented, separately hash-bound
`combat-skills-v1` starter catalog**. The consolidated taxonomy preserves the authored catalog
through an auditable migration ledger, but its broader balance and runtime behavior are not yet
accepted.

Skills define what a hero can do. Rarity describes a skill's fixed power and scarcity band;
mastery describes one hero's realized command of that skill. The catalog spans combat, magic,
craft, and life disciplines so a hero's value is not reducible to direct combat power.

The canonical ownership path is **Domain → Family → Skill**. Every skill belongs to exactly one
family, and that family owns aptitude and progression. Optional labels narrow compatibility or
affinity without creating another progression level.

## Reading the catalog

`R` is rarity: **F** Common, **E** Uncommon, **D** Rare, **C** Epic, **B** Mythic, **A** Fabled,
and **S** Legendary. `T` is type: **A**ctive, **P**assive, **St**ance, or **C**raft.

`Requires` records the principal learning path. Requirements such as “threshold,” “deed,” “rare
catalyst,” and “composite condition” are design shorthand, not executable predicates.

Rows that retain Dexterity, Intellect, or poise wording are rendered from immutable
imported/migration evidence, not active mechanics.
[ADR 0072](../../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md)
supersedes those requirements: new definitions use the four combat attributes only where they own
the gate, learned mastery/evidence for precision or knowledge, and explicit authored Break mechanics.

The authored label namespaces are:

- `Equipment`, which identifies a compatible concrete Martial tool;
- `Element`, which identifies a concrete active Elemental affinity or the `Attuned` compatibility
  label inherited by another Magical family.

An omitted label means family membership is sufficient. It does not create a hidden neutral or
universal category. `Two Blades` is a skill in Blade, while its two-weapon loadout is a requirement.

## Catalog navigation

- [Visual catalog](visual-catalog.md)

### Martial

- [Blade](martial-blade.md)
- [Polearm](martial-polearm.md)
- [Ranged](martial-ranged.md)
- [Shield](martial-shield.md)
- [Body](martial-body.md)

### Magical

- [Elemental](magical-elemental.md)
- [Ward](magical-disciplines.md#ward)
- [Enchantment](magical-disciplines.md#enchantment)
- [Restoration](magical-disciplines.md#restoration)
- [Mind](magical-disciplines.md#mind)

### Craft

- [Forging](craft-and-life.md#forging)
- [Alchemy](craft-and-life.md#alchemy)
- [Cooking](craft-and-life.md#cooking)
- [Gathering](craft-and-life.md#gathering)
- [Knowledge](craft-and-life.md#knowledge)

See also the [minimum Living Village subset](living-village.md), the complete
[skill framework](framework.md), and the accepted
[skill rarity-frame specification](../../art/skill-rarity-frames.md).

## Canonical taxonomy

| Domain | Families |
| --- | --- |
| Martial | Blade, Polearm, Ranged, Shield, Body |
| Magical | Elemental, Ward, Enchantment, Restoration, Mind |
| Craft | Forging, Alchemy, Cooking, Gathering, Knowledge |

Fire, Water, Wind, and Earth are the active Element labels. Fire, Water, and Earth currently have
published Elemental ladders. Wind is active but its skill ladder is not published yet. Wood and
Metal legacy ladders are deleted; neither is renamed or folded into Earth. Ward and
Enchantment use `Element: Attuned` only where a definition inherits the hero's current affinity.
Other neutral Magical skills omit the label.

## Source-integrity audit

The legacy compendium contained 520 rows. The v2 migration ledger records the disposition of every
row; the consolidated target count is derived by validation and may be lower because approved
merges and deletions are intentional.

Every migrated target row must trace to at least one legacy row. Retained definitions preserve
rarity, type, requirements, and effects unless the ledger explicitly records a replacement.
Owner-approved additions authored after migration instead bind their complete canonical fields and
decision source in `net-new-v1.json`; they never fabricate legacy lineage. Unpublished future
rewrites are not emitted as migration targets. Deleted and merged definitions remain recoverable
through Git history and their ledger rationale.

`Great Renewal` remains a Restoration skill. Its deleted legacy Elemental source row is retained
only in migration provenance and does not publish a second current skill.

## Source authority and remaining decisions

- Might, Vitality, Agility, and Spirit are the authoritative combat-attribute vocabulary. Imported
  precision/comprehension thresholds require a later catalog migration to learned skill/evidence
  requirements; they must never become executable under their old names.
- Fire, Earth, Wind, and Water are the active base affinities. Element statuses and rank numerics
  still require combat integration.
- Affinity is a learning or compatibility requirement for magical definitions. Element labels
  identify which affinity powers or parameterizes a skill; they are not equipment slots.
- The merge rule remains two Master-10 inputs consumed with a recipe and catalyst, producing a
  distinct Novice-1 result. Exact recipe coverage and balance remain work.
- Passives remain unlimited and only one active stance may be held. Combat must not invent a
  conflicting equipped-passive cap.
- Future equipment labels should be added only when authored definitions support them; family
  symmetry is not a reason to invent more content.

## Runtime work still required

The current `combat-skills-v1` catalog ships only Basic Sword Strike and Basic Bow Shot. It binds
each definition's delivery and damage tags plus authored mastery accuracy/reliability steps. Those
catalog bytes and `combat-equipment-profiles-v1` contribute separate hashes to the aggregate combat
binding stored on new attempts.

The prose effects intentionally lack exact mana costs, cooldowns, ranges, target shapes, durations,
scaling, status definitions, immunity rules, and boss exceptions. Absolutes such as “cannot,”
“permanently,” and “everything” remain fantasy descriptions until bounded operators exist. All
action counters and requirements need stable event IDs, while every status term—Burn, Ensnare,
Weight, Rend, Chill, bleed, poison, blind, daze, stagger, root, and others—needs one versioned status
catalog.

The source remains valuable as authored design inventory. Runtime agents may select from accepted
definitions; they may not turn these descriptions into unreviewed mechanics.
