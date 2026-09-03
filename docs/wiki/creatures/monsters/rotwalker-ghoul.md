# Ghoul

Wiki ID: `monster.rotwalker-ghoul`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: planned; Earth: planned; Wind: planned; Water: planned. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Rotwalkers (family 07) |
| Canonical form ID | `rotwalker-ghoul` |
| Tier | T2 — Soldier |
| Primary archetype | Sinew-Hook Pursuit Soldier (Soldier) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-02.md) — Ghoul |

Source-draft Rotwalkers are treated as plague-animated human or humanoid corpses, not as a biological people or a claim about the identity, agency, morality, or allegiance of the deceased. Their family identity comes from wet opened remains, wrong-jointed posture, visible death wounds, and an animating rot that reverses decay into increasingly coordinated cohesion.

## Family visual grammar

- A recognizably human but wrong silhouette retains dislocated shoulders, a dragging or mismatched gait, a hanging jaw, and a head or torso held at an impossible angle.
- Grey-green and bruise-purple flesh, dried-blood brown, bile yellow, and dirty linen white remain bodily and funerary rather than elemental colors.
- Rotting flesh, exposed sinew, wet bone, grave dirt, torn burial clothing, and the visible marks or embedded tools of death preserve each corpse's material history.
- Every form is wet and partly open, with readable seams at tendons, ribs, sutures, or fused bodies that explain both animation and counterplay.
- Escalation reverses decay into coordination: sagging fragments become corded muscle, reinforced bone, cooperative corpse anatomy, and finally a plague court built from many still-legible bodies.

**Escalation axis:** The animating plague turns loose, death-marked remains into faster tendon systems, bone-bladed pressure, coordinated composite bodies, and a cathedral-like corpse sovereign that manufactures cohesion while preserving breakable seams.

**This form's visual delta:** A fresher, faster corpse with taut posture, exposed sinew running along the arms, hooked claw-hands, a clenched jaw, and burial clothes tight enough to reveal the loaded tendon route.

## Combat reading

### Battlefield duty

Apply reliable pursuit by hooking one claw into terrain or a fallen body and using exposed arm sinew to slingshot through a short, fixed chase lane.

### Teaching goal

Teach the mature rot grammar: faster movement is built from visible tendon tension, so cutting the anchor line or crossing behind the hooked hand defeats the rush.

### Signature mechanic

Carrion Draw: the Ghoul plants a hooked hand, cords the exposed sinew along both arms, and reels its fresher body into a jaw-first rush; a Shambler lying in the lane becomes an optional anchor that lengthens the pull but does not change its direction.

### Telegraph

One claw bites into floor, wall, or corpse, the arm sinew rises like cables, and the clenched jaw points straight down the chosen lane.

### Counterplay

Break or displace the hooked hand, cross behind the planted shoulder, or interrupt the exposed tendon before the body releases; the Ghoul overshoots if its anchor vanishes late.

### Lower-form interaction

A fallen or recovering Shambler can serve as a longer Carrion Draw anchor; moving the Shambler changes or shortens the Ghoul's fixed rush without empowering the Shambler itself.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-ghoul/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-ghoul/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-ghoul/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-ghoul/normal-v1.json` |
| Fire | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-ghoul/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-ghoul/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-ghoul/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-ghoul/fire-v1.json` |
| Earth | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-ghoul/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-ghoul/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-ghoul/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-ghoul/earth-v1.json` |
| Wind | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-ghoul/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-ghoul/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-ghoul/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-ghoul/wind-v1.json` |
| Water | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-ghoul/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-ghoul/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-ghoul/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-ghoul/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
