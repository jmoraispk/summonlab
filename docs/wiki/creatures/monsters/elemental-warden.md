# Elemental Warden

Wiki ID: `monster.elemental-warden`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **planned; no coordinate on this page is approved or runtime art**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Elementals (family 21) |
| Canonical form ID | `elemental-warden` |
| Tier | T3 — Specialist |
| Primary archetype | Twin-Conduit Specialist (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-04.md) — Blaze Warden |

Source-draft Elementals are treated as magical entities whose temporary bodies take on unaffiliated spell-matter or one of the four base affinities. This is a visual and encounter-production family, not an accepted claim about origin, life, cognition, agency, personhood, summoning, or hostility. A flame-like outer contour describes shape and motion only; it does not imply Fire affinity.

## Family visual grammar

- Every form is organized around one readable binding seed or core, with no flesh, worn armor, ordinary clothing, handheld weapon, or fixed face.
- The T1 Wisp is a small asymmetric teardrop or flame-like shape without limbs; T2–T5 develop a legless hovering upper body with exactly two coherent arm channels and a tapering lower body.
- Affinity substance forms the complete load-bearing body, limbs, mantle, and directional wake rather than appearing as a colored exterior aura or decorative overlay.
- Form coherence, core structure, and spatial control progress from one wandering Wisp to a four-facet Sovereign while the active telegraph and exposed counterplay remain readable.

**Escalation axis:** Form coherence, core complexity, and control over shaped affinity substance rise from one drifting teardrop to a sovereign that transforms the arena through four learned binding patterns.

**This form's visual delta:** Fully coherent hovering upper body with exactly two strong arm conduits, a divided ring core, broad shoulders, and a narrow tapering lower body.

## Combat reading

### Battlefield duty

Qualitatively pivot into a lane controller whose two arm channels alternate between sweep and guard.

### Teaching goal

Teach that the attacking conduit fixes one lane while the opposite guard leaves one edge of the ring core exposed.

### Signature mechanic

Twin Conduit: one arm becomes a sweeping affinity channel while the other compacts into a guard; the two roles reverse after every sweep.

### Telegraph

One conduit straightens toward the marked lane, the opposite arm folds inward, and one side of the ring core becomes visible.

### Counterplay

Enter behind the sweeping conduit and strike the exposed ring edge before the two arms reverse.

### Lower-form interaction

Elemental Spirits hold the guarded lane with Tether Reach; interrupting their tether opens the Warden's core flank.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-warden/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-warden/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-warden/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-warden/normal-v1.json` |
| Fire | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-warden/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-warden/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-warden/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-warden/fire-v1.json` |
| Earth | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-warden/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-warden/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-warden/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-warden/earth-v1.json` |
| Wind | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-warden/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-warden/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-warden/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-warden/wind-v1.json` |
| Water | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-warden/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-warden/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/elementals/elemental-warden/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-warden/water-v1.json` |

### Status semantics

- `planned` means the Normal identity-anchor attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means an elemental attempt must wait for accepted Normal anchor evidence before production.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Any future image remains candidate-only until independent review. Runtime promotion is a separate integration decision.
