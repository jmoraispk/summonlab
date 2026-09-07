# Hill Giant

Wiki ID: `monster.giant-hill-giant`

[← Giants family](families/giants.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Giants (family 03) |
| Canonical form ID | `giant-hill-giant` |
| Tier | T2 — Soldier |
| Primary archetype | Slope-Roll Pressure Soldier (Soldier) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Hill Giant |

Source-draft Giants are treated as a scale-and-landscape production family rather than a claim that all enormous humanoids share one species, culture, or allegiance. The packet preserves humanlike heavy anatomy, progressive geology, rough mountain materials, and landscape scale while assigning encounter roles through committed weight and terrain displacement.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Giants family page](families/giants.md).

**Escalation axis:** Each tier expands both physical scale and the amount of lived-in geology across the body, converting a readable tree-club commitment into slope control, chained-megalith orbit, watershed command, and finally an arena that is itself a walking range.

**This form's visual delta:** Four times human height, with moss on the shoulders, first stone plates along the back, a thick rope belt, and several boulders carried in oversized rope cradles.

## Combat reading

### Battlefield duty

Apply repeatable ranged pressure by hauling and releasing rope-cradled boulders down selected lanes, then occupying the new low ground behind them.

### Teaching goal

Teach that Giant terrain attacks have visible load paths: the rope belt, shoulder moss, and first back plates show where the boulder is tied and which slope will carry it.

### Signature mechanic

Hill Roll: the Giant unhooks one boulder from its rope belt, braces it against a forming back plate, and releases it along the lower of two visible slopes; the empty rope loop then drags behind and can be stepped on during retrieval.

### Telegraph

Moss sheds from one shoulder, the corresponding rope loop pulls taut, and the Giant tests the ground with a broad foot before turning the boulder downhill.

### Counterplay

Move to higher ground or behind the dropped tree cover, then pin or cut the empty dragging loop before the Giant retrieves another boulder.

### Lower-form interaction

A Brute can knock a stalled boulder into a new line with Timber Fall, but the same trunk can wedge the roll if the player draws the two attacks together.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-hill-giant/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-hill-giant/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-hill-giant/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-hill-giant/normal-v1.json` |
| Fire | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-hill-giant/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-hill-giant/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-hill-giant/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-hill-giant/fire-v1.json` |
| Earth | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-hill-giant/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-hill-giant/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-hill-giant/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-hill-giant/earth-v1.json` |
| Wind | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-hill-giant/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-hill-giant/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-hill-giant/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-hill-giant/wind-v1.json` |
| Water | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/giants/giant-hill-giant/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/giants/giant-hill-giant/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-hill-giant/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/giants/giant-hill-giant/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
