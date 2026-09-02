# Fledgling

Wiki ID: `monster.dragon-fledgling`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: planned; Fire: blocked-on-anchor; Earth: blocked-on-anchor; Wind: blocked-on-anchor; Water: blocked-on-anchor. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Dragons (family 05) |
| Canonical form ID | `dragon-fledgling` |
| Tier | T2 — Soldier |
| Primary archetype | Unsteady Draft-Hopper (Soldier) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Fledgling |

Source-draft Dragons are treated as a draconic visual and encounter-production family, not as a universal claim about intelligence, temperament, treasure ownership, or morality. The packet preserves long reptilian anatomy, four limbs plus age-dependent wings, horn and scale growth, territorial hoard materials, and direct silhouette-based maturation while assigning each hostile form a specific arena duty.

## Family visual grammar

- Long neck and tail, deep chest, four clawed limbs, wedge-shaped horned skull, and wings that emerge and expand after the wingless first form.
- Each individual holds one coherent metallic or jewel-tone scale identity with a paler underbelly and bright reflective eyes, rather than changing base identity by affinity.
- Overlapping scales, horn, bone spurs, and leathery wing membrane retain reptilian load paths and readable joints at every tier.
- Horn crowns, spinal ridges, battle scars, torn membrane, and hoard metal fused into old belly scales accumulate as age and territorial history.
- Wingspan and horn crown escalate together from absent wings and horn nubs to storm-front wings and branching imperial antlers, while the ground-to-sky grammar remains recognizable.

**Escalation axis:** Wings and horns mature from absent and unreliable to arena-defining structures, turning a ground pounce into short draft hops, authored flight lanes, hoard-shaped landing control, and a Sovereign circuit through every earlier movement grammar.

**This form's visual delta:** Bright glossy scales, one clean pair of horns, and small leathery membrane wings whose narrow spars and trembling span do not yet look reliable.

## Combat reading

### Battlefield duty

Apply repeatable short-range pressure by converting the Whelp's pounce into a low wing-assisted hop that can clear one obstacle but must land on a visible second claim.

### Teaching goal

Teach takeoff and landing as separate tells: immature wings extend reach but cannot correct midair, so the marked landing claim is the reliable counterplay anchor.

### Signature mechanic

Claim Hop: the Fledgling bats a hoard object to mark its landing, beats its small membrane wings once, and glides on a fixed arc toward it; a bad landing folds one unreliable wing beneath the body before recovery.

### Telegraph

One clean horn pair points at the landing object, glossy scales lift over the deep chest, and both small wings stretch to their full but visibly trembling span.

### Counterplay

Move away from the marked object rather than tracking the body in flight, or displace the claim before landing to force the wing-fold recovery.

### Lower-form interaction

Whelps guard the landing claim and may pounce at players leaving it; drawing them across the fixed glide line makes the Fledgling abort or collide with its own screen.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/dragons/dragon-fledgling/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/dragons/dragon-fledgling/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/dragons/dragon-fledgling/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/dragons/dragon-fledgling/normal-v1.json` |
| Fire | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/dragons/dragon-fledgling/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/dragons/dragon-fledgling/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/dragons/dragon-fledgling/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/dragons/dragon-fledgling/fire-v1.json` |
| Earth | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/dragons/dragon-fledgling/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/dragons/dragon-fledgling/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/dragons/dragon-fledgling/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/dragons/dragon-fledgling/earth-v1.json` |
| Wind | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/dragons/dragon-fledgling/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/dragons/dragon-fledgling/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/dragons/dragon-fledgling/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/dragons/dragon-fledgling/wind-v1.json` |
| Water | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/dragons/dragon-fledgling/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/dragons/dragon-fledgling/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/dragons/dragon-fledgling/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/dragons/dragon-fledgling/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
