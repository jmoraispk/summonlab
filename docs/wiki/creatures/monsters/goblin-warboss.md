# Warboss

Wiki ID: `monster.goblin-warboss`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: blocked-on-anchor; Earth: blocked-on-anchor; Wind: blocked-on-anchor; Water: blocked-on-anchor. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Goblins (family 01) |
| Canonical form ID | `goblin-warboss` |
| Tier | T4 — Champion |
| Primary archetype | Banner-Rally Enforcer (Champion) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Warboss |

Source-draft Goblins are treated as a visual and encounter-production family, not as an accepted universal taxonomy. The packet preserves their short, wiry scavenger identity and violent loot hierarchy while expressing combat behavior as readable encounter roles.

## Family visual grammar

- Short, hunched, long-armed humanoid silhouette with an oversized head and pointed ears, disproportionately large hands and feet, hooked nose, and crowded crooked teeth.
- Sickly green or grey-green skin against muddy browns, rust-orange, dull iron, and sparse accents of stolen gold.
- Every carried object reads as stolen, scavenged, or crudely repaired: rags, patched leather, cracked wood, rusted scrap metal, bone, and rope rather than purpose-built matching equipment.
- Loot is the status language: mismatched helmets, coin necklaces, teeth, rings, captured banners, and trophies accumulate with rank.
- Posture and finish communicate hierarchy, from a knock-kneed cringing crouch to an upright swagger amid increasingly prestigious plunder.

**Escalation axis:** Scrap becomes treasure, and posture straightens from a cringing crouch to an upright swagger; rising forms turn stolen equipment into increasingly organized mob control, battlefield infrastructure, and finally a royal loot-production system.

**This form's visual delta:** Hulking for a Goblin and openly swaggering, with gold teeth, a knight's oversized chestplate, the best stolen weapon in the mob, and a dragging banner stacked with enemy helms.

## Combat reading

### Battlefield duty

Claim and patrol a rally zone, combining mob nerve, pins, and door cover into an organized push while personally punishing anyone who attacks the formation head-on.

### Teaching goal

Teach commander prioritization: lower forms become an army only while the Warboss's trophy standard defines a rally zone, but the hulking champion guards that standard with committed sweeps.

### Signature mechanic

Helm-Tree Rally: the Warboss plants its banner of enemy helms, straightening nearby Goblins and letting their formation mechanics persist at greater spacing; it answers attacks on the banner with a slow, armor-weighted cleave that cannot turn once committed.

### Telegraph

The stolen helms clatter down the pole, nearby Goblins snap upright, and the Warboss flashes its gold teeth before hauling the chestplate and weapon into a fixed sweeping stance.

### Counterplay

Bait the fixed cleave away from the pole, attack from its trailing side, then topple the banner or pull lower forms beyond its marked trophy radius before they reform.

### Lower-form interaction

Runts retain Mob Nerve across the rally zone, Cutters pin intruders at its edge, and Raiders angle their planted doors toward the banner; removing the banner returns every interaction to its shorter, local form.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-warboss/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-warboss/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-warboss/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-warboss/normal-v1.json` |
| Fire | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-warboss/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-warboss/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-warboss/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-warboss/fire-v1.json` |
| Earth | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-warboss/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-warboss/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-warboss/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-warboss/earth-v1.json` |
| Wind | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-warboss/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-warboss/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-warboss/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-warboss/wind-v1.json` |
| Water | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-warboss/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-warboss/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-warboss/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-warboss/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
