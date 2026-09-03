# Cutter

Wiki ID: `monster.goblin-cutter`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: planned; Earth: planned; Wind: planned; Water: planned. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Goblins (family 01) |
| Canonical form ID | `goblin-cutter` |
| Tier | T2 — Soldier |
| Primary archetype | Scrap-Line Bully (Soldier) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Cutter |

Source-draft Goblins are treated as a visual and encounter-production family, not as an accepted universal taxonomy. The packet preserves their short, wiry scavenger identity and violent loot hierarchy while expressing combat behavior as readable encounter roles.

## Family visual grammar

- Short, hunched, long-armed humanoid silhouette with an oversized head and pointed ears, disproportionately large hands and feet, hooked nose, and crowded crooked teeth.
- Sickly green or grey-green skin against muddy browns, rust-orange, dull iron, and sparse accents of stolen gold.
- Every carried object reads as stolen, scavenged, or crudely repaired: rags, patched leather, cracked wood, rusted scrap metal, bone, and rope rather than purpose-built matching equipment.
- Loot is the status language: mismatched helmets, coin necklaces, teeth, rings, captured banners, and trophies accumulate with rank.
- Posture and finish communicate hierarchy, from a knock-kneed cringing crouch to an upright swagger amid increasingly prestigious plunder.

**Escalation axis:** Scrap becomes treasure, and posture straightens from a cringing crouch to an upright swagger; rising forms turn stolen equipment into increasingly organized mob control, battlefield infrastructure, and finally a royal loot-production system.

**This form's visual delta:** Adds a stolen helmet three sizes too big, mismatched leather scraps, a notched cleaver, and a small coin pouch while remaining hunched and visibly under-armored.

## Combat reading

### Battlefield duty

Hold a messy front line by pinning one target in place while Runts crowd the exposed sides.

### Teaching goal

Teach the repeatable Goblin formation: the best-equipped bully fixes attention while weaker bodies make the formation dangerous.

### Signature mechanic

Bully's Hook: the Cutter catches clothing or guard with the notch in its cleaver and leans back, slowing the target while any adjacent Runt gains Mob Nerve from the protected position.

### Telegraph

It drops its oversized helmet over its eyes, turns the cleaver notch inward, and plants one foot before the hook.

### Counterplay

Sidestep the narrow hook, strike during the helmet-blind recovery, or push the Cutter away from its Runts to collapse both the pin and their Mob Nerve.

### Lower-form interaction

Shelters Runts behind its leather-scrap side and deliberately holds hooked targets where their stick jabs can reach.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-cutter/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-cutter/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-cutter/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-cutter/normal-v1.json` |
| Fire | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-cutter/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-cutter/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-cutter/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-cutter/fire-v1.json` |
| Earth | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-cutter/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-cutter/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-cutter/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-cutter/earth-v1.json` |
| Wind | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-cutter/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-cutter/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-cutter/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-cutter/wind-v1.json` |
| Water | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-cutter/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-cutter/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-cutter/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-cutter/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
