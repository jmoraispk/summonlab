# Blob

Wiki ID: `monster.slime-blob`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: planned; Earth: planned; Wind: planned; Water: planned. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Slimes (family 19) |
| Canonical form ID | `slime-blob` |
| Tier | T2 — Soldier |
| Primary archetype | Debris-Roll Soldier (Soldier) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-04.md) — Blob |

Source-draft Slimes are treated as an amorphous visual and encounter-production family, not as accepted claims about biology, cognition, feeding, agency, personhood, or universal hostility. Engulfing and digestion are encounter proposals; the packet preserves gravity-led jelly, visible contents, and a core weak point while humanoid structure begins only at T3.

## Family visual grammar

- Rounded, drooping, gravity-obeying jelly with surface-tension edges and a readable internal core remains the family silhouette.
- Translucent blue, acid green, amber, or violet is chosen per individual, with suspended debris and a brighter but bounded core.
- Viscous flow, drip trails, swallowed objects, crystalline cores, and later crust plates remain spatially coherent.
- Internal structure emerges by tier: pseudopod, debris-bearing blob, humanoid crust frame, suspended skeleton, then a multicore tide.

**Escalation axis:** Internal structure and battlefield coordination emerge from formlessness, culminating in a multicore sovereign that redistributes its own mass through lesser slimes.

**This form's visual delta:** Knee-high cloudy blob with coins, small bones, a slow drip trail, and no humanoid structure.

## Combat reading

### Battlefield duty

Repeat lane pressure by rolling swallowed debris toward its leading edge.

### Teaching goal

Teach players to read internal contents as the next impact side.

### Signature mechanic

Debris Roll: coins and bones gather ahead of the core before the knee-high mass surges.

### Telegraph

Cloudy jelly clears along one edge while coins and bones tumble toward it.

### Counterplay

Cross behind the debris line and hit the core through the newly clear rear wall.

### Lower-form interaction

Its wake gives Droplets a faster Core Hop, but crossing behind the Blob denies both lanes.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/slimes/slime-blob/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/slimes/slime-blob/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/slimes/slime-blob/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/slimes/slime-blob/normal-v1.json` |
| Fire | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/slimes/slime-blob/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/slimes/slime-blob/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/slimes/slime-blob/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/slimes/slime-blob/fire-v1.json` |
| Earth | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/slimes/slime-blob/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/slimes/slime-blob/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/slimes/slime-blob/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/slimes/slime-blob/earth-v1.json` |
| Wind | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/slimes/slime-blob/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/slimes/slime-blob/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/slimes/slime-blob/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/slimes/slime-blob/wind-v1.json` |
| Water | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/slimes/slime-blob/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/slimes/slime-blob/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/slimes/slime-blob/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/slimes/slime-blob/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
