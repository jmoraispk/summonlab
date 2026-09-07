# Raider

Wiki ID: `monster.goblin-raider`

[← Goblins family](families/goblins.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

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

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Goblins family page](families/goblins.md).

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
| Normal | `planned` | `candidate-only` | v2 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/normal/target-v2.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/normal/assignment-v2.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/normal-v2.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/normal-v2.json` |
| Fire | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/fire-v1.json` |
| Earth | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/earth-v1.json` |
| Wind | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/wind-v1.json` |
| Water | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-raider/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-raider/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-raider/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-raider/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
