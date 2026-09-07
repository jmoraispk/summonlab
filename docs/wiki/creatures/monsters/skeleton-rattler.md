# Rattler

Wiki ID: `monster.skeleton-rattler`

[← Skeletons family](families/skeletons.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Skeletons (family 06) |
| Canonical form ID | `skeleton-rattler` |
| Tier | T1 — Initiate |
| Primary archetype | Scatter-and-Reform Initiate (Initiate) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Rattler |

Source-draft Skeletons are treated as a necromantically animated-remains production family, not as a biological species or evidence about the identity, autonomy, rights, or allegiance of the original dead. The packet preserves humanlike bone gaps, grave goods, socket-fire binding, progressive fusion, and cheap reassembly while assigning each hostile form an explicit battlefield duty.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Skeletons family page](families/skeletons.md).

**Escalation axis:** Loose bones become mail-bound ranks, a Specialist that levies battlefield fragments, fused spur architecture, and finally a royal sepulcher engine that commands, rebuilds, and promotes the whole skeletal court.

**This form's visual delta:** A loose, gap-toothed humanlike frame that appears ready to fall apart, with dull socket pinpoints, a rusted shortsword, incomplete hands, and no binding armor.

## Combat reading

### Battlefield duty

Probe target selection with brittle shortsword pressure, then turn one strong hit into a short reassembly puzzle centered on the loose skull.

### Teaching goal

Teach the family's binding rule: scattering the body creates safety only temporarily, while disabling the dim socket anchor prevents the bones from rattling back together.

### Signature mechanic

Loose Muster: a strong interruption scatters the Rattler into a skull, ribcage, and limb piles; dull socket pinpoints travel down visible rune scratches and pull the nearest pieces back unless the skull is displaced or struck before the ribs stand.

### Telegraph

Gap teeth chatter, the frame visibly loosens at every joint, and the dull socket pinpoints draw thin lines toward the nearest dropped bones.

### Counterplay

Scatter it away from other bone piles, then kick or strike the skull before the ribcage rises; destroying ordinary limb fragments alone only delays the same reassembly.

### Lower-form interaction

Not applicable for this form.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-rattler/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-rattler/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-rattler/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-rattler/normal-v1.json` |
| Fire | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-rattler/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-rattler/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-rattler/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-rattler/fire-v1.json` |
| Earth | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-rattler/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-rattler/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-rattler/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-rattler/earth-v1.json` |
| Wind | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-rattler/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-rattler/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-rattler/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-rattler/wind-v1.json` |
| Water | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-rattler/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-rattler/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-rattler/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-rattler/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
