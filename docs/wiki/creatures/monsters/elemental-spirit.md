# Elemental Spirit

Wiki ID: `monster.elemental-spirit`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **planned; no coordinate on this page is approved or runtime art**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Elementals (family 21) |
| Canonical form ID | `elemental-spirit` |
| Tier | T2 — Soldier |
| Primary archetype | Tether-Reach Soldier (Soldier) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-04.md) — Flame Spirit |

Source-draft Elementals are treated as magical entities whose temporary bodies take on unaffiliated spell-matter or one of the four base affinities. This is a visual and encounter-production family, not an accepted claim about origin, life, cognition, agency, personhood, summoning, or hostility. A flame-like outer contour describes shape and motion only; it does not imply Fire affinity.

## Family visual grammar

- Every form is organized around one readable binding seed or core, with no flesh, worn armor, ordinary clothing, handheld weapon, or fixed face.
- The T1 Wisp is a small asymmetric teardrop or flame-like shape without limbs; T2–T5 develop a legless hovering upper body with exactly two coherent arm channels and a tapering lower body.
- Affinity substance forms the complete load-bearing body, limbs, mantle, and directional wake rather than appearing as a colored exterior aura or decorative overlay.
- Form coherence, core structure, and spatial control progress from one wandering Wisp to a four-facet Sovereign while the active telegraph and exposed counterplay remain readable.

**Escalation axis:** Form coherence, core complexity, and control over shaped affinity substance rise from one drifting teardrop to a sovereign that transforms the arena through four learned binding patterns.

**This form's visual delta:** Human-sized faceless hovering torso with exactly two tapering arms, one central seed-core, and a legless lower body dissolving into a continuous tail.

## Combat reading

### Battlefield duty

Apply repeatable mid-range pressure with one committed arm channel.

### Teaching goal

Teach that the extended arm remains committed while the opposite side of the single core is exposed.

### Signature mechanic

Tether Reach: one arm channel lengthens across a marked lane while the compact torso and opposite arm hold the binding core in place.

### Telegraph

The legless upper body narrows, one arm thins into a taut tether, and the core shifts visibly away from it.

### Counterplay

Cross behind the extending tether and strike the exposed side of the core before the arm retracts.

### Lower-form interaction

Wisps drift toward the tether endpoint; crossing behind the committed arm separates them from the Spirit.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-spirit/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-spirit/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-spirit/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-spirit/normal-v1.json` |
| Fire | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-spirit/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-spirit/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-spirit/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-spirit/fire-v1.json` |
| Earth | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-spirit/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-spirit/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-spirit/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-spirit/earth-v1.json` |
| Wind | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-spirit/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-spirit/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-spirit/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-spirit/wind-v1.json` |
| Water | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-spirit/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-spirit/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-spirit/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-spirit/water-v1.json` |

### Status semantics

- `planned` means the Normal identity-anchor attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means an elemental attempt must wait for accepted Normal anchor evidence before production.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Any future image remains candidate-only until independent review. Runtime promotion is a separate integration decision.
