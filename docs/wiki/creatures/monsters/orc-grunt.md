# Grunt

Wiki ID: `monster.orc-grunt`

[← Orcs family](families/orcs.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Orcs (family 02) |
| Canonical form ID | `orc-grunt` |
| Tier | T1 — Initiate |
| Primary archetype | Committed Shoulder-Tester (Initiate) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Grunt |

Source-draft Orcs are treated as a visual and encounter-production family, not as proof of universal culture, allegiance, morality, or personhood. This packet preserves their top-heavy anatomy, tusks, battle marks, heavy equipment, and visible status language while assigning each hostile form a specific authored combat duty.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Orcs family page](families/orcs.md).

**Escalation axis:** Tusks lengthen and curve higher as muscle, scars, iron, trophies, and command authority accumulate; rising forms turn committed heavy attacks into rhythmic pursuit, formation control, and finally an arena-wide trial of standards.

**This form's visual delta:** Lean and sinewy with hide wraps, small blunt tusks, almost no iron, and one crude spear or hand axe held close to the body.

## Combat reading

### Battlefield duty

Probe the front line with a short spear or hand-axe rush that displaces a guarded target but leaves the lean attacker stranded if the rush misses.

### Teaching goal

Teach the Orc family's basic bargain: broad shoulders and heavy intent make the approach dangerous, while planted feet and a forward lean make the recovery readable and punishable.

### Signature mechanic

Shoulder Test: the Grunt lowers one hide-wrapped shoulder behind its crude weapon and drives straight through the first occupied space; contact shoves both combatants, while a miss carries the Grunt past the target before it can turn.

### Telegraph

It scrapes one bare foot backward, tucks its small blunt tusks, and draws the spear or axe tight beside the lowered shoulder.

### Counterplay

Step across the narrow line rather than retreating, then strike the unarmored ribs or back while the Grunt plants its forward foot and turns.

### Lower-form interaction

Not applicable for this form.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-grunt/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-grunt/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-grunt/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-grunt/normal-v1.json` |
| Fire | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-grunt/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-grunt/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-grunt/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-grunt/fire-v1.json` |
| Earth | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-grunt/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-grunt/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-grunt/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-grunt/earth-v1.json` |
| Wind | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-grunt/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-grunt/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-grunt/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-grunt/wind-v1.json` |
| Water | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-grunt/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-grunt/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-grunt/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-grunt/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
