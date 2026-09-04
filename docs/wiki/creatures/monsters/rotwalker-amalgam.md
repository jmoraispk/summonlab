# Amalgam

Wiki ID: `monster.rotwalker-amalgam`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Rotwalkers (family 07) |
| Canonical form ID | `rotwalker-amalgam` |
| Tier | T4 — Champion |
| Primary archetype | Many-Body Gait Architect (Champion) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-02.md) — Amalgam |

Source-draft Rotwalkers are treated as plague-animated human or humanoid corpses, not as a biological people or a claim about the identity, agency, morality, or allegiance of the deceased. Their family identity comes from wet opened remains, wrong-jointed posture, visible death wounds, and an animating rot that reverses decay into increasingly coordinated cohesion.

## Family visual grammar

- A recognizably human but wrong silhouette retains dislocated shoulders, a dragging or mismatched gait, a hanging jaw, and a head or torso held at an impossible angle.
- Grey-green and bruise-purple flesh, dried-blood brown, bile yellow, and dirty linen white remain bodily and funerary rather than elemental colors.
- Rotting flesh, exposed sinew, wet bone, grave dirt, torn burial clothing, and the visible marks or embedded tools of death preserve each corpse's material history.
- Every form is wet and partly open, with readable seams at tendons, ribs, sutures, or fused bodies that explain both animation and counterplay.
- Escalation reverses decay into coordination: sagging fragments become corded muscle, reinforced bone, cooperative corpse anatomy, and finally a plague court built from many still-legible bodies.

**Escalation axis:** The animating plague turns loose, death-marked remains into faster tendon systems, bone-bladed pressure, coordinated composite bodies, and a cathedral-like corpse sovereign that manufactures cohesion while preserving breakable seams.

**This form's visual delta:** A hulking but legible fusion of multiple corpses with two torsos, several heads folded into the mass, extra arms assigned to different grips, and thick stitched seams connecting every borrowed anatomy.

## Combat reading

### Battlefield duty

Rebuild the arena's movement lanes by assigning different fused torsos and extra arms to pull, brace, carry, or redirect lower Rotwalkers around its hulking mass.

### Teaching goal

Teach composite dismantling: the Amalgam is not one health sponge, because each visible corpse suture carries one duty and cutting it removes a specific lane or support action.

### Signature mechanic

Borrowed Gaits: three folded heads call in sequence while their attached torsos act. The dragging torso sweeps a Shambler into a new fall lane, the hooked torso catches a Ghoul anchor, and the open-rib torso relays a Rot Brute pulse through the Amalgam. Each action loads a different stitched waist seam, and a severed seam permanently removes that gait.

### Telegraph

One folded head lifts and bites its own stitching, the matching pair of extra arms spreads, and a wet load line becomes visible from that torso to its lower-form partner.

### Counterplay

Identify the raised head, avoid its inherited lane, then attack the matching loaded waist suture; every severed torso reduces the Amalgam's command sequence and leaves an unguarded side.

### Lower-form interaction

Separate torsos reposition Shamblers, complete Ghoul anchor lines, and relay Rot Brute pumps; severing the responsible torso removes only that interaction for the rest of the encounter.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-amalgam/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-amalgam/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-amalgam/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-amalgam/normal-v1.json` |
| Fire | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-amalgam/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-amalgam/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-amalgam/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-amalgam/fire-v1.json` |
| Earth | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-amalgam/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-amalgam/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-amalgam/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-amalgam/earth-v1.json` |
| Wind | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-amalgam/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-amalgam/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-amalgam/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-amalgam/wind-v1.json` |
| Water | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-amalgam/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-amalgam/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-amalgam/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-amalgam/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
