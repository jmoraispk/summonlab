# Armor and shields

Wiki ID: `mechanics.equipment.armor-shields`

Design status: **runtime-v1 visuals/definitions and engine-v26 readiness integration for
load/resistance profiles and eligibility are implemented**.

Runtime-v1 implements all four pieces for every retained Armor material and a metal Shield at every
rank. The 21 complete-set images are approved continuity references only; the 84 individual Armor
pieces are the equippable definitions. Engine-v26 binds load, delivery families, and named
resistance grants and consumes the eligibility result when assembling readiness combat. General
armor-point magnitudes, over-tolerance penalty curves, magical support
values, and set convenience actions remain deferred.

Armor uses three classes. The rank-bearing material determines the class; named cuts, cultural
styles, coverage details, and monster-derived appearances do not create more mechanical classes.

| Armor class | Rank-bearing material | Identity | Natural users |
| --- | --- | --- | --- |
| **Heavy Armor** | Metal | Highest physical protection and weight | Martial |
| **Light Armor** | Hide or scale | Mobile protection at moderate weight | Martial and Craft |
| **Robes** | Cloth or fiber | Lowest physical weight and strongest magical support | Magical and Craft |

These are natural fits, not Domain locks. Eligibility comes from total-load tolerance plus explicit
item requirements, not the hero's Domain.

## Engine-v26 readiness combat profile

| Armor class | Load by Head / Torso / Legs / Boots | Requirement | Named resistance per piece |
| --- | --- | --- | --- |
| **Heavy Armor** | `12 / 28 / 22 / 10` | intrinsic Strength 45 and `armor-training` | Cut 800 bp (authored cap 1,500); Impact 600 bp (authored cap 1,200) |
| **Light Armor** | `6 / 14 / 11 / 5` | none | Pierce 400 bp (authored cap 1,000) |
| **Robes** | `2 / 4 / 3 / 2` | none | Arcane 300 bp (authored cap 900) |

When the pure evaluator is called, total equipped load is compared with scoped effective
equipment-load Strength. Explicit item requirements read intrinsic Strength, so a temporary load bonus
cannot satisfy Heavy Armor's Strength gate. Vitality is never an armor requirement. Readiness combat
enforces this boundary; the frozen legacy runner continues to use its own compatibility behavior.

Equipment, passive-skill, and physiology grants become deterministic typed resistance receipts.
Matching tags stack additively under the stricter authored/global cap, with a 7,500-basis-point
global ceiling. These named grants are not general armor mitigation.

General mitigation uses `max(0, armor - penetration)` and the versioned armor curve, capped at
7,499 basis points. No production equipment profile assigns a general armor magnitude yet; the
numbers exercised by the balance harness are explicitly benchmark candidates.

There is no universal poise. A particular shield, stance, boss, or skill may later author a visible
Break meter, but no current Armor class receives one implicitly.

Each Armor class is authored as one visually consistent set and equipped as four separate items:

| Item | Includes |
| --- | --- |
| **Head** | Helmet, hat, hood, or another class-appropriate head covering |
| **Torso** | Primary upper-body protection or robe body, including any attached sleeves |
| **Legs** | Pants, skirt, robe lower, or leg protection |
| **Boots** | Boots, shoes, greaves, or another class-appropriate foot treatment |

Vambraces, gloves, belts, and cloaks may appear as construction details but are not separate item
slots in this scope.

## Required set-production sequence

Anything authored as a set must establish the complete matching set before its pieces are produced:

1. create one image showing the full set together;
2. use that accepted set image as the consistency source;
3. create four separate item images in order: Head, Torso, Legs, and Boots.

The complete-set image is required visual-production evidence, not a fifth equippable item. The
four item images must preserve the accepted set's material, silhouette language, palette, trim,
fastenings, wear, and ornament. Weapons are independent items and do not need to match an Armor
set unless a later named set explicitly includes them.

This rule applies to Heavy Armor, Light Armor, and Robes at every retained material rank. It also
applies to any later named or monster-derived equipment explicitly presented as a set.

### Full-set visual anchor

All full-set sources use one consistent moderate three-quarter view and facing direction. Coarse
Hide is the composition reference: the set appears empty and self-supported, with subtle cavity
shading inside openings. A visible mannequin, body, or black void figure is not part of the asset.

The Head item must be present and readable in every full-set source. Camera consistency applies
across material ranks: sets do not alternate between straight-on, opposite-facing, and strongly
rotated views. Each source must also retain its class silhouette—mobile Light Armor, protective
Heavy Armor, or cloth-led Robes—before its four separated items can be produced.

## Shields

Shield is one equipment class with metal as its rank-bearing material. Size and shape may change
its appearance, weight, and authored properties without producing separate Buckler, Round Shield,
Kite Shield, Tower Shield, Pavise, or Aegis classes.

A Shield occupies one hand and therefore cannot be combined with a two-handed Weapon, Bow, or
Staff. It may accompany a one-handed Sword, Dagger, Axe, or Mace.

## Rank

The armor or shield design and selected material set the combined crafting difficulty. The
material supplies base rank, and Forging craftsmanship adds `+0`, `+1`, or `+2`, capped at S, as
defined in [Equipment rarity and craftsmanship](rarity-and-weight.md).

## Open implementation questions

- Author and balance general armor-point magnitudes and magical-support values for the three
  classes without changing the named resistance receipts above in place.
- Define whether the four Armor items divide protection evenly or use slot-specific values.
- Define the exact over-tolerance penalties and Shield benefits without multiplying classes.
- Define how later monster materials bind to Light Armor without creating a separate class for
  every creature.
