# Raider

Wiki ID: `monster.goblin-raider`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: planned; Fire: blocked-on-anchor; Earth: blocked-on-anchor; Wind: blocked-on-anchor; Water: blocked-on-anchor. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Goblins (family 01) |
| Canonical form ID | `goblin-raider` |
| Tier | T3 — Specialist |
| Primary archetype | Door-Shield Breacher (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Raider |

Source-draft Goblins are treated as a visual and encounter-production family, not as an accepted universal taxonomy. The packet preserves their short, wiry scavenger identity and violent loot hierarchy while expressing combat behavior as readable encounter roles.

## Family visual grammar

- Short, hunched, long-armed humanoid silhouette with an oversized head and pointed ears, disproportionately large hands and feet, hooked nose, and crowded crooked teeth.
- Sickly green or grey-green skin against muddy browns, rust-orange, dull iron, and sparse accents of stolen gold.
- Every carried object reads as stolen, scavenged, or crudely repaired: rags, patched leather, cracked wood, rusted scrap metal, bone, and rope rather than purpose-built matching equipment.
- Loot is the status language: mismatched helmets, coin necklaces, teeth, rings, captured banners, and trophies accumulate with rank.
- Posture and finish communicate hierarchy, from a knock-kneed cringing crouch to an upright swagger amid increasingly prestigious plunder.

**Escalation axis:** Scrap becomes treasure, and posture straightens from a cringing crouch to an upright swagger; rising forms turn stolen equipment into increasingly organized mob control, battlefield infrastructure, and finally a royal loot-production system.

**This form's visual delta:** Stands nearly upright in riveted plate scavenged from three different armies, carrying a real sword and a full door shield with exposed hinges, rope handles, and crude viewing slot.

## Combat reading

### Battlefield duty

Change the shape of the encounter by carrying mobile cover into a firing lane, then planting it as a temporary barricade that creates a Goblin advance route.

### Teaching goal

Teach the qualitative Specialist pivot: the first nearly upright, well-equipped Goblin is dangerous because it edits space and formation access, not because it is merely tougher.

### Signature mechanic

Claimed Door: the Raider braces its scavenged door shield through incoming fire, then slams the lower edge into the ground to create one-way cover for smaller Goblins; planting commits the shield and leaves the sword arm and back exposed.

### Telegraph

It turns the door broadside, peers through a hacked eye slot, and drags a bright rope brace taut before the ground-slam.

### Counterplay

Interrupt before the rope locks, flank the exposed sword side after planting, cut the visible brace to topple the door, or force the Raider away so the claimed lane no longer advances with it.

### Lower-form interaction

Runts and Cutters stream behind the planted door; a Cutter can hold its brace while the Raider leaves cover to flank, making the brace carrier a readable way to collapse the formation.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/normal-v1.json` |
| Fire | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/fire-v1.json` |
| Earth | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/earth-v1.json` |
| Wind | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/wind-v1.json` |
| Water | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
