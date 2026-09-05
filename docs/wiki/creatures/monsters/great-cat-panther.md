# Panther

Wiki ID: `monster.great-cat-panther`

[← Canonical monster database](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Great Cats (family 35) |
| Canonical form ID | `great-cat-panther` |
| Tier | T3 — Specialist |
| Primary archetype | Sightline Specialist |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — Owner-approved fauna expansion |

A natural feline expedition family centered on concealment, facing, isolation, explosive pounces, and hunting-territory control.

## Family visual grammar

- Every form retains a four-legged feline body, flexible spine, retractile claws, whiskered muzzle, mobile ears, and expressive tail.
- Species variation remains feline and is communicated by coat pattern, limb proportion, mane, canine length, and hunting posture rather than equipment.
- Eye line, tail stillness, shoulder compression, cover disturbance, and landing posture preserve readable attack direction.

**Escalation axis:** A simple cover pounce becomes high-ground hunting, sightline isolation, saber-tooth pinning, and finally an apex territory hunt that assigns every lower form a role.

**This form's visual delta:** Long low black cat with faint rosettes, reflective eyes, flexible shoulders, and an uninterrupted predatory silhouette.

## Combat reading

### Battlefield duty

Move through connected dark cover and isolate one target by threatening allies who cross its marked line.

### Teaching goal

Introduce a positioning specialist whose still eye line controls movement without magical disappearance.

### Signature mechanic

Unbroken Gaze: the Panther marks a line between its visible eyes and prey, then strikes the first other target to cross it.

### Telegraph

Shoulder rosettes vanish sequentially into cover while the reflective eyes remain fixed and visible.

### Counterplay

Flood the line with a deliberate feint or attack the still eye position before moving the isolated target.

### Lower-form interaction

Wildcats occupy nearby low cover and Lynxes threaten the elevated route around the marked line.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-panther/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-panther/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-panther/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-panther/normal.bd7ad156e360.webp` | `bd01fd2ee1a88042af97b38757a1c2314fe91c6a2801e69cf76cfb39bf39a0d9` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-panther/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-panther/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-panther/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-panther/fire.7b60c8f1bed8.webp` | `46626f21d8d21ddfa5357836965f72b25fbde49207f989f794df8872e5bb55b2` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-panther/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-panther/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-panther/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-panther/earth.03f7a691d530.webp` | `a189b3e7d5a20a57e82f76d8a926d0bfe10398a6674ba35cf7590425bf7edae1` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-panther/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-panther/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-panther/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-panther/wind.e37e9ad8659d.webp` | `1bf7fd119dd2ab29bcd028832170615dd6d41844e9cd9b67d0be22bad42f338b` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-panther/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-panther/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-panther/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-panther/water.0401d8a76dbf.webp` | `53a79633869a20d57134b83606260185a3a3e002f6eecfd07522e551fac790ec` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
