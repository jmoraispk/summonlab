# War Tusker

Wiki ID: `monster.boar-war-tusker`

[← Canonical monster database](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Boars (family 33) |
| Canonical form ID | `boar-war-tusker` |
| Tier | T4 — Champion |
| Primary archetype | Formation-Breaker Champion |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — Owner-approved fauna expansion |

A natural suid expedition family centered on predictable charge lanes, bracing, displacement, and route creation.

## Family visual grammar

- Every form keeps a low four-legged boar body, cloven hooves, mobile snout, raised bristles, short tail, and visible tusk roots.
- Tier escalation uses tusk geometry, neck mass, shoulder callus, scars, and bristle profile rather than humanoid equipment.
- Charge direction remains readable through hoof placement, lowered head angle, tusk contact, dust, and the alignment of the spine.

**Escalation axis:** A short straight charge becomes a braced line-breaker, curved furrow specialist, formation-opening champion, and three-lane sovereign stampede.

**This form's visual delta:** Towering scarred boar with splayed paired tusks, chipped forehead shield, heavy neck folds, and a low lateral brace.

## Combat reading

### Battlefield duty

Hook barriers, rotate them into new lanes, and signal lesser Boars to charge through the opening.

### Teaching goal

Teach players to protect or release movable cover before the Boar family weaponizes it.

### Signature mechanic

Tusker's Gate: one tusk hooks a barrier while the neck rotates it, creating a new family charge route.

### Telegraph

The neck twists beneath the hooked object and the free tusk points down the intended lane.

### Counterplay

Release or destroy the object, or stagger the planted rear leg before the rotation locks.

### Lower-form interaction

Lower Boars immediately use the opened route, but collide or scatter if the gate is released before their charge.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-war-tusker/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-war-tusker/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-war-tusker/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-war-tusker/normal.a57d21c84c2a.webp` | `61526369db8b15b7d38493194e977cf2b4e441b9ea472ee81151830fb1cc1eac` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-war-tusker/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-war-tusker/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-war-tusker/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-war-tusker/fire.c5f6432075a2.webp` | `4a8282681098c8ac50b4e52214788af837069769f331ad88eb40c825de05cc9f` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-war-tusker/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-war-tusker/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-war-tusker/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-war-tusker/earth.a9474d65935c.webp` | `fe2c8fcf0e647ff8cd731d3259024f09ec8d1a2fb08764ee5373070a9d5549eb` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-war-tusker/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-war-tusker/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-war-tusker/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-war-tusker/wind.9a6dec20ce12.webp` | `2ae7a05aa6b5c40764283c7e4a39010eb1772e6b4c039c26464363e5bf41086d` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-war-tusker/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-war-tusker/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-war-tusker/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-war-tusker/water.1b5b48f5acc8.webp` | `eae8ee3a99e1a5f62057e90af5594dbcff5499894bdc1cc24fe0dd67d0d9ee2a` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
