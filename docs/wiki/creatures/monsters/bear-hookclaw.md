# Hookclaw

Wiki ID: `monster.bear-hookclaw`

[← Canonical monster database](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Bears (family 32) |
| Canonical form ID | `bear-hookclaw` |
| Tier | T3 — Specialist |
| Primary archetype | Grapple Specialist |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — Owner-approved fauna expansion |

A natural ursine expedition family built around mass, committed attacks, grappling, and territorial control.

## Family visual grammar

- Every form retains a four-legged ursine body, plantigrade paws, compact tail, broad muzzle, dense coat, and weight-bearing shoulder hump.
- Escalation uses coat condition, scars, claw specialization, posture, and environmental interaction rather than humanoid equipment.
- Raised shoulders, planted hind legs, open chest, and exposed inner wrists preserve readable commitment and recovery windows.

**Escalation axis:** A simple committed swipe becomes frontal maul pressure, an asymmetric hook-and-drag specialist, terrain-breaking dominance, and finally den-scale territorial command.

**This form's visual delta:** Asymmetric bear with one enlarged hook claw, thickened wrist, lower pulling stance, and matching shoulder overdevelopment.

## Combat reading

### Battlefield duty

Hook a limb, shield, or obstacle and drag it sideways to break defensive formations.

### Teaching goal

Introduce an asymmetric specialist whose dangerous side and planted recovery side must be read separately.

### Signature mechanic

Hook and Haul: one enlarged curved claw catches the target while the opposite hind foot becomes a visible towing anchor.

### Telegraph

The hooked forepaw turns palm-up and the opposite hind foot digs deeply into the ground.

### Counterplay

Dodge toward the planted foot or strike the exposed inner wrist before the sideways drag begins.

### Lower-form interaction

Cave Bears block the obvious retreat while Scrub Bears harry targets displaced by the drag.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-hookclaw/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-hookclaw/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-hookclaw/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-hookclaw/normal.d9efad92bd87.webp` | `982d8aab6591404c40d3f1403edd08dd9feac7cca58da519564c5a2f9237fdb8` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-hookclaw/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-hookclaw/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-hookclaw/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-hookclaw/fire.1b0da43ff8cd.webp` | `4459b0d8e9b14dd55e3728e1c599a9f8451dd6d772b0531f45b75db6486ef713` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-hookclaw/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-hookclaw/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-hookclaw/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-hookclaw/earth.bcb73370ad2d.webp` | `941f0c90cf9cf5d26a1e65e78e3ce068cb18ac2d7bba2cbe988f843336e8fa0a` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-hookclaw/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-hookclaw/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-hookclaw/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-hookclaw/wind.877918c20f7a.webp` | `383fb7fda1ce9613e60e3dbb8bbbafdc172d5886378688f53c026dd0ea84ec58` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-hookclaw/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-hookclaw/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-hookclaw/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-hookclaw/water.91182e7f85e6.webp` | `f149ae3b06a68bff2201fe06be833af380d48805c3171e16d1bbe254926f9cae` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
