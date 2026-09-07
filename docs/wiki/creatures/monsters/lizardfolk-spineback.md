# Spineback

Wiki ID: `monster.lizardfolk-spineback`

[← Lizardfolk family](families/lizardfolk.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Lizardfolk (family 16) |
| Canonical form ID | `lizardfolk-spineback` |
| Tier | T3 — Specialist |
| Primary archetype | Dorsal-Gate Specialist (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-03.md) — Spineback |

Source-draft Lizardfolk are treated as a reptilian visual and encounter-production family, not as an accepted biological people or a universal statement about culture, technology, intelligence, social rank, personhood, habitat, or hostility. Source swamp and tribal imagery becomes explicit equipment and arena grammar rather than essentialized identity.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Lizardfolk family page](families/lizardfolk.md).

**Escalation axis:** Crest height, dorsal spines, natural plating, tail weaponization, and control of marked hunting ground grow from a lean scout to a sovereign back-sail war court.

**This form's visual delta:** Heavy dorsal spines, thick chest plate-scales, alligator jaw, and twin obsidian blades create a spatial-control silhouette rather than a larger Warrior.

## Combat reading

### Battlefield duty

Qualitatively pivot the encounter by turning heavy dorsal spines into a one-way mobile gate that partitions the battlefield while twin blades threaten its open hinge.

### Teaching goal

Teach that natural plating now edits space: follow which spine row lowers and attack through that temporary gate.

### Signature mechanic

Spine Gate: the Spineback crouches and fans alternate dorsal spines into a barrier, leaving one visibly lowered segment as a passage; twin obsidian blades cover only the alligator-jaw side of that passage.

### Telegraph

Heavy dorsal spines rise in sequence, chest plate-scales lock, the alligator jaw opens toward one side, and one spine segment remains flat.

### Counterplay

Pass through the flat segment from the side opposite the jaw, strike its exposed root, or force the Specialist to turn and collapse the gate.

### Lower-form interaction

Warriors brace the closed spine segments and Scouts stab through gaps; breaking the lowered root folds the barrier and removes their protected lanes.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `candidate-only` | v2 | `assets/enemies/experiments/family-affinity-v1/targets/lizardfolk/lizardfolk-spineback/normal/target-v2.json` | `assets/enemies/experiments/family-affinity-v1/assignments/lizardfolk/lizardfolk-spineback/normal/assignment-v2.json` | `assets/enemies/experiments/family-affinity-v1/candidates/lizardfolk/lizardfolk-spineback/normal-v2.png` | `assets/enemies/experiments/family-affinity-v1/results/lizardfolk/lizardfolk-spineback/normal-v2.json` |
| Fire | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/lizardfolk/lizardfolk-spineback/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/lizardfolk/lizardfolk-spineback/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/lizardfolk/lizardfolk-spineback/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/lizardfolk/lizardfolk-spineback/fire-v1.json` |
| Earth | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/lizardfolk/lizardfolk-spineback/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/lizardfolk/lizardfolk-spineback/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/lizardfolk/lizardfolk-spineback/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/lizardfolk/lizardfolk-spineback/earth-v1.json` |
| Wind | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/lizardfolk/lizardfolk-spineback/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/lizardfolk/lizardfolk-spineback/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/lizardfolk/lizardfolk-spineback/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/lizardfolk/lizardfolk-spineback/wind-v1.json` |
| Water | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/lizardfolk/lizardfolk-spineback/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/lizardfolk/lizardfolk-spineback/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/lizardfolk/lizardfolk-spineback/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/lizardfolk/lizardfolk-spineback/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
