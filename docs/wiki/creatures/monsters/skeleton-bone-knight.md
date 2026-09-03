# Bone Knight

Wiki ID: `monster.skeleton-bone-knight`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: blocked-on-anchor; Earth: blocked-on-anchor; Wind: blocked-on-anchor; Water: blocked-on-anchor. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Skeletons (family 06) |
| Canonical form ID | `skeleton-bone-knight` |
| Tier | T3 — Specialist |
| Primary archetype | Ossuary-Levy Interceptor (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Bone Knight |

Source-draft Skeletons are treated as a necromantically animated-remains production family, not as a biological species or evidence about the identity, autonomy, rights, or allegiance of the original dead. The packet preserves humanlike bone gaps, grave goods, socket-fire binding, progressive fusion, and cheap reassembly while assigning each hostile form an explicit battlefield duty.

## Family visual grammar

- Human or humanoid skeletal proportions remain narrow, angular, and defined by empty negative space where flesh and organs would be.
- Bone white or yellowed ivory is paired with rust, black iron, tattered grave-cloth, and one explained necromantic socket-fire accent such as green, blue, or gold.
- Bone, rusted mail, corroded steel, grave-cloth, funerary jewelry, and crowns remain recognizable mortuary materials rather than living anatomy.
- Carved skull runes, bone spurs, fused armor-like mass, grave regalia, and orbiting fragments accumulate as binding power becomes denser.
- Bone density and the intensity and reach of the visible necromantic binding escalate together, but every form preserves gaps, joints, or binding anchors that can be deliberately broken.

**Escalation axis:** Loose bones become mail-bound ranks, a Specialist that levies battlefield fragments, fused spur architecture, and finally a royal sepulcher engine that commands, rebuilds, and promotes the whole skeletal court.

**This form's visual delta:** Thickened reinforced bone, a plated ribcage that can open along one seam, a corroded knightly weapon, and a helm fused permanently to the skull around bright socket flame.

## Combat reading

### Battlefield duty

Change the encounter economy by claiming scattered bones from either side of the battlefield, forging them into one temporary intercepting limb, lance, or plated-rib barrier.

### Teaching goal

Teach the qualitative Specialist pivot: loose bones are now a contested resource, and controlling the visible levy route matters more than attacking the Knight's thickened frame head-on.

### Signature mechanic

Bone Levy: the fused helm marks one loose bone pile with a socket-fire line, and the plated ribcage opens to receive it. Arm bones produce a long intercepting lance, ribs produce a forward cage barrier, and skulls produce a second lookout mounted on the shoulder. Only one levy can be active; striking the moving pile or the bright rib seam before it locks denies the construction and leaves the chest open.

### Telegraph

The bright socket flame narrows toward one bone pile, the helm turns without the shoulders, and the plated ribcage spreads along a clearly lit central seam.

### Counterplay

Move or destroy the marked pile, cross the light line before the fragments reach the chest, or strike the bright rib seam during intake; once built, attack from the side the chosen bone structure cannot cover.

### Lower-form interaction

The Knight can levy a scattered Rattler or broken Bonesoldier into its chosen structure, preventing that lower form from reassembling; denying the levy leaves those bones available to disrupt or bait later pulls.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `candidate-only` | v2 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-knight/normal/target-v2.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-knight/normal/assignment-v2.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-knight/normal-v2.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-knight/normal-v2.json` |
| Fire | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-knight/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-knight/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-knight/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-knight/fire-v1.json` |
| Earth | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-knight/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-knight/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-knight/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-knight/earth-v1.json` |
| Wind | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-knight/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-knight/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-knight/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-knight/wind-v1.json` |
| Water | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-bone-knight/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-bone-knight/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-bone-knight/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-bone-knight/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
