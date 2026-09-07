# Berserker

Wiki ID: `monster.orc-berserker`

[← Orcs family](families/orcs.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Orcs (family 02) |
| Canonical form ID | `orc-berserker` |
| Tier | T3 — Specialist |
| Primary archetype | Scar-Rhythm Pursuer (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Berserker |

Source-draft Orcs are treated as a visual and encounter-production family, not as proof of universal culture, allegiance, morality, or personhood. This packet preserves their top-heavy anatomy, tusks, battle marks, heavy equipment, and visible status language while assigning each hostile form a specific authored combat duty.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Orcs family page](families/orcs.md).

**Escalation axis:** Tusks lengthen and curve higher as muscle, scars, iron, trophies, and command authority accumulate; rising forms turn committed heavy attacks into rhythmic pursuit, formation control, and finally an arena-wide trial of standards.

**This form's visual delta:** Slab-muscled and intentionally asymmetric in motion, with tusks curling past the cheekbones, spiked pauldrons, twin cleavers, and a prominent scar lattice that reads as a sequence map across the chest.

## Combat reading

### Battlefield duty

Turn a stable front into a moving tempo hazard by chaining alternating twin-cleaver lanes and forcing the player to interrupt cadence rather than merely retreat from a tougher attacker.

### Teaching goal

Teach the qualitative Specialist pivot: the Berserker's threat comes from an authored left-right rhythm encoded in its scar lattice and pauldrons, and breaking that rhythm is safer than outrunning it.

### Signature mechanic

Scar-Lattice Bloodbeat: each cleaver strike follows the next diagonal of the chest scar lattice, alternating sides and widening the pursuit arc; completing three beats triggers a crossed finishing chop, but a clean interruption or a miss resets the sequence and leaves both arms spread.

### Telegraph

One spiked pauldron rolls forward, the matching cleaver taps a bright scar intersection, and the chest expands on a clearly countable beat before each diagonal advance.

### Counterplay

Cross behind the pauldron that just moved, force one beat to miss against open space or terrain, or interrupt on the visible scar tap; the reset exposes the unplated scar lattice before the cleavers can recross.

### Lower-form interaction

Grunts and Warriors try to hold targets inside the next marked diagonal, but their bodies also block the Berserker's widening route and can be used to force a sequence-breaking miss.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-berserker/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-berserker/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-berserker/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-berserker/normal-v1.json` |
| Fire | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-berserker/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-berserker/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-berserker/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-berserker/fire-v1.json` |
| Earth | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-berserker/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-berserker/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-berserker/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-berserker/earth-v1.json` |
| Wind | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-berserker/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-berserker/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-berserker/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-berserker/wind-v1.json` |
| Water | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-berserker/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-berserker/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-berserker/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-berserker/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
