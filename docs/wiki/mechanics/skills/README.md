# Skills

Wiki ID: `skills.index`

Design status: **draft source import**. The supplied framework and all supplied catalog rows are
preserved here, but they are not yet accepted balance or executable content.

Skills define what a hero can do. Rarity describes the skill's fixed power/scarcity band; mastery
describes one hero's realized command of that skill. The catalog spans combat, magic, craft, and
life disciplines so a hero's value is not reducible to direct combat power.

The skill tree begins with three player-facing domains: **Martial**, **Magical**, and **Craft**.
Each domain supports two paths. A universal skill can branch directly from its domain; a specialized
skill passes through a family and subfamily first. In compact form: **domain → universal skill** or
**domain → family → subfamily → skill**. The supplied catalog currently contains a populated
Universal Martial set; the equivalent Magical and Craft lanes remain deliberately reserved rather
than being filled with invented source material.

This section is a companion to the larger progression system. The [framework](framework.md)
preserves the supplied skill rules; the grouped catalog pages preserve every supplied skill row.

## Reading the catalog

`R` is rarity: **F** Common, **E** Uncommon, **D** Rare, **C** Epic, **B** Mythic, **A** Fabled,
and **S** Legendary. `T` is type: **A**ctive, **P**assive, **St**ance, or **C**raft.

`Requires` records the principal learning path. The source says most Rare and higher skills have
alternative paths, but those paths have not yet been authored in the catalog tables. Requirements
such as “threshold,” “deed,” “rare catalyst,” and “composite condition” are therefore design
shorthand, not executable predicates.

## Catalog navigation

- [Universal Martial](martial-universal.md)
- [Blade: Sword, Dagger, Greatsword, Paired Blades](martial-blade.md)
- [Haft and Fist: Spear, Axe, Hammer, Unarmed, Grappling](martial-haft-and-fist.md)
- [Hunt, Guard, and Motion](martial-hunt-guard-motion.md)
- [Evocation: Fire, Water, Wood, Earth, Metal](magical-evocation.md)
- [Ward, Enchantment, Restoration, and Mind](magical-disciplines.md)
- [Craft and Life: Forging, Alchemy, Cooking, Gathering, Beast, Lore](craft-and-life.md)
- [Minimum Living Village subset](living-village.md)

## Supplied taxonomy

| Sector | Families and supplied subfamilies |
| --- | --- |
| Universal | Universal Martial |
| Martial — Blade | Sword, Dagger, Greatsword, Paired Blades |
| Martial — Haft | Spear, Axe, Hammer |
| Martial — Fist | Unarmed, Grappling |
| Martial — Hunt | Bow, Crossbow, Thrown, Tracking |
| Martial — Guard | Shield, Protection |
| Martial — Motion | Motion |
| Magical | Fire, Water, Wood, Earth, and Metal Evocation; Ward; Enchantment; Restoration; Mind |
| Craft and Life | Forging, Alchemy, Cooking, Gathering, Beast, Lore |

The framework uses the hierarchy **sector → family → subfamily → skill**. Its intended structural
rules are one foundation entry per subfamily, universal techniques outside weapon ladders, and
branching at Rare and above. The Evocation ladders currently open with Active foundations rather
than the “foundation passive” required by the framework, so the more general rule should probably
be “one foundation skill” unless those five entries change type.

## Source-integrity audit

The source's catalog contains exactly **520** parsed skill rows across **32** titled sections.

| Sector | Supplied summary | Audited rows |
| --- | ---: | ---: |
| Universal | 16 | 16 |
| Martial — Blade | 86 | 86 |
| Martial — Haft | 46 | **44** |
| Martial — Fist | 30 | 30 |
| Martial — Hunt | 54 | 54 |
| Martial — Guard | 32 | 32 |
| Martial — Motion | 18 | 18 |
| Magical | 155 | **160** |
| Craft and Life | 84 | **80** |
| **Total** | **~521** | **520** |

The exact audited rarity distribution is F 126, E 112, D 109, C 79, B 55, A 25, and S 14. The
exact type distribution is Active 281, Passive 141, Stance 38, and Craft 60.

The supplied statement that Legendary skills occur in nine subfamilies is inconsistent with the
tables. Fourteen sections contain an S entry: Sword, Dagger, Unarmed, Bow, Shield, Motion, all five
Evocation elements, Restoration, Mind, and Forging. The prose list omits Forging and itself names
thirteen sections rather than nine.

`Great Renewal` also appears twice: Wood Evocation #16 and Restoration #14 have different
requirements and effects. They require distinct stable skill IDs even if the shared display name is
intentional.

## Source authority and remaining decisions

- The source's Might, Vitality, Agility, Dexterity, Intellect, and Spirit vocabulary is
  authoritative. New executable thresholds must migrate together rather than mix old and new IDs.
- Wood, Fire, Earth, Metal, and Water are the five base affinities; Wind is derived from Metal ×
  Wood. Element statuses and rank numerics still require combat integration.
- The source says skills and affinities have no direct relation while also authoring magical skills
  per element. The architecture models affinity as a typed skill aspect and permits bounded fusion.
  “No slotting or arbitrary infusion” can remain true, but the content relation needs one canonical
  formulation.
- The source merge rule is authoritative: two Master-10 inputs are consumed, a recipe and catalyst
  are required, and the result begins at Novice 1. Exact recipe coverage and balance remain work.
- The source allows unlimited passives and one active stance. Combat must balance passive effects
  without inventing a conflicting equipped-passive cap.
- The framework's approximate rarity counts (about 90/70/55/40/28/15/2 from F through S) differ
  sharply from this catalog's 126/112/109/79/55/25/14. Clarify whether the former was a target for
  the complete game or only an early estimate.
- The source's “remaining” polearm and greatsword variants are ambiguous because Spear already
  covers polearms and Greatsword already has a ladder. Core family lists also mention Gauntlet,
  Ambush, Defence, and Poise foci absent from this compendium.

## Runtime work still required

The prose effects intentionally lack exact mana costs, cooldowns, ranges, target shapes, durations,
scaling, status definitions, immunity rules, and boss exceptions. Absolutes such as “cannot,”
“permanently,” “everything,” and “ceases” are fantasy descriptions until bounded operators exist.
All action counters and requirements need stable event IDs, while every status term—Burn, Ensnare,
Weight, Rend, Chill, bleed, poison, blind, daze, stagger, root, and others—needs one versioned status
catalog.

The source remains valuable as the complete authored design inventory. Runtime agents may select
from accepted definitions; they may not turn these descriptions into unreviewed mechanics.

## Supplied extension notes

The source says remaining Haft foci (polearm variants), Blade greatsword variants, and
subfamily-specific merge recipes are still to be authored. Its theoretical apex is a named but
effectively unobtainable skill inheriting from every family, intended as orientation rather than a
normal acquisition goal.
