# Warrior

Wiki ID: `monster.orc-warrior`

[← Orcs family](families/orcs.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Orcs (family 02) |
| Canonical form ID | `orc-warrior` |
| Tier | T2 — Soldier |
| Primary archetype | Warpaint Breach Soldier (Soldier) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Warrior |

Source-draft Orcs are treated as a visual and encounter-production family, not as proof of universal culture, allegiance, morality, or personhood. This packet preserves their top-heavy anatomy, tusks, battle marks, heavy equipment, and visible status language while assigning each hostile form a specific authored combat duty.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Orcs family page](families/orcs.md).

**Escalation axis:** Tusks lengthen and curve higher as muscle, scars, iron, trophies, and command authority accumulate; rising forms turn committed heavy attacks into rhythmic pursuit, formation control, and finally an arena-wide trial of standards.

**This form's visual delta:** Broad-shouldered with red war paint across the eyes, iron-banded leather, a heavy axe, first ritual scars, and tusks that rise clearly above the lower lip.

## Combat reading

### Battlefield duty

Maintain reliable line pressure by using an iron-banded shoulder check to open a guard, then occupying the breach with a controlled heavy-axe follow-through.

### Teaching goal

Teach players to read paint and stance as a two-beat sequence: the red eye-band signals the advancing shoulder, while the first scars and axe angle reveal which side will be exposed afterward.

### Signature mechanic

Red-Line Breach: the Warrior smears fresh paint down one axe cheek, checks forward behind iron-banded leather, then sweeps toward the painted side; the second beat occurs only if the shoulder makes contact.

### Telegraph

It drags two fingers through the red band across its eyes, marks one axe cheek, and turns the matching shoulder forward.

### Counterplay

Dodge to the unpainted side or stop the shoulder before contact; either response cancels the sweep and exposes the Warrior's underarm while the heavy axe resets.

### Lower-form interaction

A Warrior can stop beside an overextended Grunt and use the Grunt's spear line as the edge of its breach, but separating their lanes prevents the paired shove-and-sweep.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/normal-v1.json` |
| Fire | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/fire-v1.json` |
| Earth | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/earth-v1.json` |
| Wind | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/wind-v1.json` |
| Water | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
