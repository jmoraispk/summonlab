# Rot Brute

Wiki ID: `monster.rotwalker-rot-brute`

[← Rotwalkers family](families/rotwalkers.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Rotwalkers (family 07) |
| Canonical form ID | `rotwalker-rot-brute` |
| Tier | T3 — Specialist |
| Primary archetype | Open-Rib Plague Pump (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-02.md) — Rot Brute |

Source-draft Rotwalkers are treated as plague-animated human or humanoid corpses, not as a biological people or a claim about the identity, agency, morality, or allegiance of the deceased. Their family identity comes from wet opened remains, wrong-jointed posture, visible death wounds, and an animating rot that reverses decay into increasingly coordinated cohesion.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Rotwalkers family page](families/rotwalkers.md).

**Escalation axis:** The animating plague turns loose, death-marked remains into faster tendon systems, bone-bladed pressure, coordinated composite bodies, and a cathedral-like corpse sovereign that manufactures cohesion while preserving breakable seams.

**This form's visual delta:** A muscle-corded, bloated corpse with bone burst through both forearms as natural blades, a ribcage cracked open around a visible plague sac, and reinforced legs built to brace the pumping action.

## Combat reading

### Battlefield duty

Qualitatively pivot the floor into route control by pumping infected matter through existing corpse trails, turning familiar Shambler falls and Ghoul anchors into timed eruption lines.

### Teaching goal

Teach players to read an arena network rather than only a body: sever a marked trail, jam the open rib pump, or use a clean lane before the Brute pressurizes it.

### Signature mechanic

Ribcage Peristalsis: the bloated Brute plants both forearm bone blades and opens its cracked ribs like pump handles. One visible wet trail leading to a Shambler or Ghoul pulses from corpse to corpse, then erupts in a sequence of short grasping hands. Only one network can be charged; breaking any bright tendon junction stops the eruption and vents the Brute's belly.

### Telegraph

Forearm blades lock into the ground, the cracked ribcage spreads around a swollen central sac, and one chain of wet footprints and corpse seams begins pulsing toward the selected lane.

### Counterplay

Leave the pulsing route, sever one exposed tendon junction between bodies, or strike the swollen sac through the open ribs before the third pulse; the planted blades prevent the Brute from turning during the cast.

### Lower-form interaction

Shambler fall lanes and Ghoul anchor routes become links in the chosen pump network; disrupting either lower form breaks that link and shortens the eruption instead of merely damaging the Brute.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `candidate-only` | v2 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-rot-brute/normal/target-v2.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-rot-brute/normal/assignment-v2.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-rot-brute/normal-v2.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-rot-brute/normal-v2.json` |
| Fire | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-rot-brute/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-rot-brute/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-rot-brute/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-rot-brute/fire-v1.json` |
| Earth | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-rot-brute/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-rot-brute/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-rot-brute/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-rot-brute/earth-v1.json` |
| Wind | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-rot-brute/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-rot-brute/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-rot-brute/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-rot-brute/wind-v1.json` |
| Water | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/rotwalkers/rotwalker-rot-brute/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/rotwalkers/rotwalker-rot-brute/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/rotwalkers/rotwalker-rot-brute/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/rotwalkers/rotwalker-rot-brute/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
