# Stone Giant

Wiki ID: `monster.giant-stone-giant`

[← Giants family](families/giants.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Giants (family 03) |
| Canonical form ID | `giant-stone-giant` |
| Tier | T3 — Specialist |
| Primary archetype | Chain-Megalith Orbit Controller (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Stone Giant |

Source-draft Giants are treated as a scale-and-landscape production family rather than a claim that all enormous humanoids share one species, culture, or allegiance. The packet preserves humanlike heavy anatomy, progressive geology, rough mountain materials, and landscape scale while assigning encounter roles through committed weight and terrain displacement.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Giants family page](families/giants.md).

**Escalation axis:** Each tier expands both physical scale and the amount of lived-in geology across the body, converting a readable tree-club commitment into slope control, chained-megalith orbit, watershed command, and finally an arena that is itself a walking range.

**This form's visual delta:** House-sized, with boulder-scale arm ridges, a cliff-face brow, carved skin runes, and a megalith suspended from an iron chain whose pivot hardware remains fully visible.

## Combat reading

### Battlefield duty

Replace simple linear sweeps with a moving circular exclusion zone, using a chained megalith to divide the arena and pull displaced terrain into a deliberate orbit.

### Teaching goal

Teach the qualitative Specialist pivot: read chain geometry, move through the quiet center rather than away from raw size, and punish the fixed pivot when the megalith changes orbit.

### Signature mechanic

Megalith Orbit: the Stone Giant anchors the chain around a boulder-ridged forearm and walks a measured circle, swinging the megalith through a wide outer ring while the space beside its cliff-face brow remains calm. Reversing direction requires the Giant to plant the megalith, step across the chain, and expose the anchor wrist.

### Telegraph

Iron chain rises link by gate-sized link, the megalith scrapes a bright circular track, and runes along one forearm align toward the intended orbit before the first swing.

### Counterplay

Enter the calm inner radius, cross behind the planted megalith during reversal, and strike or bind the exposed wrist anchor before the chain lifts into the opposite orbit.

### Lower-form interaction

Hill Giants roll boulders into the outer orbit and Brutes sweep them loose, expanding the ring only while the Stone Giant maintains its anchor; breaking the wrist pivot returns those attacks to independent lanes.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `candidate-only` | v2 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-stone-giant/normal/target-v2.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-stone-giant/normal/assignment-v2.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-stone-giant/normal-v2.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-stone-giant/normal-v2.json` |
| Fire | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-stone-giant/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-stone-giant/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-stone-giant/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-stone-giant/fire-v1.json` |
| Earth | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-stone-giant/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-stone-giant/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-stone-giant/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-stone-giant/earth-v1.json` |
| Wind | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-stone-giant/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-stone-giant/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-stone-giant/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-stone-giant/wind-v1.json` |
| Water | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-stone-giant/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-stone-giant/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-stone-giant/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-stone-giant/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
