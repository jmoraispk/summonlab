# Bone Champion

Wiki ID: `monster.skeleton-bone-champion`

[← Skeletons family](families/skeletons.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Skeletons (family 06) |
| Canonical form ID | `skeleton-bone-champion` |
| Tier | T4 — Champion |
| Primary archetype | Spur-Crown Formation Architect (Champion) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Bone Champion |

Source-draft Skeletons are treated as a necromantically animated-remains production family, not as a biological species or evidence about the identity, autonomy, rights, or allegiance of the original dead. The packet preserves humanlike bone gaps, grave goods, socket-fire binding, progressive fusion, and cheap reassembly while assigning each hostile form an explicit battlefield duty.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Skeletons family page](families/skeletons.md).

**Escalation axis:** Loose bones become mail-bound ranks, a Specialist that levies battlefield fragments, fused spur architecture, and finally a royal sepulcher engine that commands, rebuilds, and promotes the whole skeletal court.

**This form's visual delta:** Bones fused into a solid armor-like mass while preserving joint gaps, with a horned skull and long bone spurs rising from the shoulders like a crown and matching seams at the hips.

## Combat reading

### Battlefield duty

Fuse scattered remains into crown-shaped barricades that extend shield lines, define levy channels, and command lower skeletons through a deliberately breakable arena formation.

### Teaching goal

Teach formation dismantling: the Champion's fused mass is least vulnerable at the center, while every new spur wall creates an outer binding seam that can collapse the whole structure.

### Signature mechanic

Crownwork: the Champion plants one shoulder spur, draws loose bones into a curving wall, and completes it with the opposite spur to form a crown point. Bonesoldiers lock shields into the wall, Bone Knights levy through its interior channel, and Rattlers reform behind it. The Champion must keep one horned side turned toward each completed point, exposing the unfused hip seam on the opposite side.

### Telegraph

Shoulder spurs rise like crown tines, one horn on the skull aligns with a bone pile, and a bright binding line traces the planned curve across the floor before fragments move.

### Counterplay

Cross the planned curve before it closes, break the outermost shoulder-spur seam, or attack the hip opposite the Champion's turned horn; one broken crown point opens every lower-form route attached to it.

### Lower-form interaction

Rattlers reform behind crownwork, Bonesoldiers extend it with shield braces, and Bone Knights draw levy fragments through it; breaking one spur point removes protection and interrupts every attached interaction.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-champion/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-champion/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-champion/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-champion/normal-v1.json` |
| Fire | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-champion/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-champion/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-champion/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-champion/fire-v1.json` |
| Earth | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-champion/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-champion/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-champion/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-champion/earth-v1.json` |
| Wind | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-champion/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-champion/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-champion/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-champion/wind-v1.json` |
| Water | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-champion/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-champion/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-champion/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-champion/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
