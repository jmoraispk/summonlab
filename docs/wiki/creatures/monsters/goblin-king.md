# Goblin King

Wiki ID: `monster.goblin-king`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: blocked-on-anchor; Earth: blocked-on-anchor; Wind: blocked-on-anchor; Water: blocked-on-anchor. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Goblins (family 01) |
| Canonical form ID | `goblin-king` |
| Tier | T5 — Sovereign |
| Primary archetype | Warren Lootworks Monarch (Sovereign) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Goblin King |

Source-draft Goblins are treated as a visual and encounter-production family, not as an accepted universal taxonomy. The packet preserves their short, wiry scavenger identity and violent loot hierarchy while expressing combat behavior as readable encounter roles.

## Family visual grammar

- Short, hunched, long-armed humanoid silhouette with an oversized head and pointed ears, disproportionately large hands and feet, hooked nose, and crowded crooked teeth.
- Sickly green or grey-green skin against muddy browns, rust-orange, dull iron, and sparse accents of stolen gold.
- Every carried object reads as stolen, scavenged, or crudely repaired: rags, patched leather, cracked wood, rusted scrap metal, bone, and rope rather than purpose-built matching equipment.
- Loot is the status language: mismatched helmets, coin necklaces, teeth, rings, captured banners, and trophies accumulate with rank.
- Posture and finish communicate hierarchy, from a knock-kneed cringing crouch to an upright swagger amid increasingly prestigious plunder.

**Escalation axis:** Scrap becomes treasure, and posture straightens from a cringing crouch to an upright swagger; rising forms turn stolen equipment into increasingly organized mob control, battlefield infrastructure, and finally a royal loot-production system.

**This form's visual delta:** Sits upright on a welded throne of recognizable stolen loot above a coin dais, wearing a crown made from fused crowns, a cloak stitched from captured flags, and rings on every finger; the throne's crude winch, chute, and door press extend the treasure silhouette into a working war machine.

## Combat reading

### Battlefield duty

Operate a command-and-production boss encounter that converts carried battlefield scrap into reinforcements, promotions, and repaired formation tools while issuing role-specific orders from the royal dais.

### Teaching goal

Test mastery of the whole family by making the player read which production station and decree is coming, sever its supply chain, and dismantle lower-form formations before confronting the dismounted King.

### Signature mechanic

Royal Lootworks: the welded throne-dais has three exposed stations fueled by scrap that Cutters deliver. At each command beat the King points to one station: the cage winch brings fresh Runts from a warren hatch, the armory chute outfits a surviving Runt as a Cutter, or the door press repairs a Raider's broken Claimed Door. Between cycles, a captured-flag decree orders Runts to rush, Cutters to collect, Raiders to barricade, and any Warboss to defend the active station. Destroyed stations stay disabled and loss of all three forces the King off the throne.

### Telegraph

The King rises beneath the crown of fused crowns, points a ring-heavy hand, and yanks one captured flag; the selected station's stolen bell rings while its gears visibly spool and the matching lower forms shout and turn toward their ordered route.

### Counterplay

Intercept scrap-carrying Cutters, cut the bright drive rope before the bell finishes, destroy the exposed selected station, or lure its defenders away; each broken station removes one production option, and an empty dais makes the dismounted King fight without replacement troops or repaired doors.

### Lower-form interaction

Cutters carry dropped scrap to power the throne; Runts arrive through the cage winch and can be outfitted into Cutters; Raiders receive repaired door shields and execute barricade decrees; a Warboss rallies defenders around whichever station the King has activated.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `candidate-only` | v2 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-king/normal/target-v2.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-king/normal/assignment-v2.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-king/normal-v2.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-king/normal-v2.json` |
| Fire | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-king/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-king/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-king/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-king/fire-v1.json` |
| Earth | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-king/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-king/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-king/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-king/earth-v1.json` |
| Wind | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-king/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-king/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-king/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-king/wind-v1.json` |
| Water | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-king/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-king/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-king/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-king/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
