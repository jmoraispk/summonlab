# Bonesoldier

Wiki ID: `monster.skeleton-bonesoldier`

[← Skeletons family](families/skeletons.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Skeletons (family 06) |
| Canonical form ID | `skeleton-bonesoldier` |
| Tier | T2 — Soldier |
| Primary archetype | Mail-Bound Shield Soldier (Soldier) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Bonesoldier |

Source-draft Skeletons are treated as a necromantically animated-remains production family, not as a biological species or evidence about the identity, autonomy, rights, or allegiance of the original dead. The packet preserves humanlike bone gaps, grave goods, socket-fire binding, progressive fusion, and cheap reassembly while assigning each hostile form an explicit battlefield duty.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Skeletons family page](families/skeletons.md).

**Escalation axis:** Loose bones become mail-bound ranks, a Specialist that levies battlefield fragments, fused spur architecture, and finally a royal sepulcher engine that commands, rebuilds, and promotes the whole skeletal court.

**This form's visual delta:** A complete skeleton bound together in rusted mail, with a corroded weapon, shield strapped directly to the forearm, and weak ember light contained inside the eye sockets.

## Combat reading

### Battlefield duty

Hold a repeatable narrow front by tensioning rusted mail between spine and forearm shield, protecting loose skeletons while exposing the strapped arm after a committed block.

### Teaching goal

Teach that stronger binding is equipment-mediated: read which mail section carries the load, then break or bypass it rather than striking the shielded bone mass.

### Signature mechanic

Grave-Line Brace: the Bonesoldier twists its torso until rusted mail pulls taut from spine to shield forearm, catching one frontal attack and keeping adjacent Rattler bones inside its binding shadow; the twist leaves the sword shoulder open and the shield strap fully loaded.

### Telegraph

Weak ember light passes from the sockets into one mail row, the strapped shield turns edge-on, and the spine rotates until the corroded links sing under tension.

### Counterplay

Attack from the open sword-shoulder side, cut the bright loaded mail row, or displace the forearm shield so the strap tears when the torso completes its twist.

### Lower-form interaction

Rattler fragments inside the shield-side binding shadow reform faster and cannot be kicked outward, but cutting the loaded mail scatters both the Soldier and any half-raised Rattler pile it covers.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bonesoldier/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bonesoldier/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bonesoldier/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bonesoldier/normal-v1.json` |
| Fire | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bonesoldier/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bonesoldier/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bonesoldier/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bonesoldier/fire-v1.json` |
| Earth | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bonesoldier/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bonesoldier/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bonesoldier/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bonesoldier/earth-v1.json` |
| Wind | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bonesoldier/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bonesoldier/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bonesoldier/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bonesoldier/wind-v1.json` |
| Water | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bonesoldier/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bonesoldier/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bonesoldier/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bonesoldier/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
