# Burrowing Worm

Wiki ID: `monster.burrower-burrowing-worm`

[← Canonical monster database](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Burrowers (family 34) |
| Canonical form ID | `burrower-burrowing-worm` |
| Tier | T2 — Soldier |
| Primary archetype | Eruption Soldier |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — burrowing-worm; Retired legacy bridge reframed into canonical fauna |

One segmented subterranean animal lineage built around ground reading, eruption timing, towing, false ridges, and tunnel networks. It is not a miscellaneous bin for unrelated cave creatures.

## Family visual grammar

- Every form retains a limbless segmented body, armored digging front, softer articulated rear, tactile sensory organs, and soil-displacing locomotion.
- Tier is shown through mandible specialization, segment reinforcement, collar structure, tail shape, and tunneling behavior rather than humanoid traits.
- The real underground route and the exposed punish segment always have physical environmental tells.

**Escalation axis:** A single moving ridge becomes a long eruption lane, hookjaw towing specialist, decoy-ridge champion, and persistent tunnel-network sovereign.

**This form's visual delta:** Long annelid body with armored front rings, flexible pale rear segments, broad shovel mandibles, and many short tactile whiskers.

## Combat reading

### Battlefield duty

Cross a long underground lane, erupt beneath a target, and leave rear segments exposed while turning.

### Teaching goal

Teach players to avoid the forecast endpoint and punish the rear instead of attacking the armored head.

### Signature mechanic

Moving-Ridge Eruption: an accelerating ridge ends in a vertical bite while the long rear body remains stranded above ground.

### Telegraph

A widening ridge accelerates and embedded pebbles jump at the eruption endpoint.

### Counterplay

Avoid the endpoint and attack the exposed soft rear segments during the slow turn underground.

### Lower-form interaction

Soil Grubs create short harmless-looking ridges that complicate attention without hiding the Worm's larger stone-displacing route.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/burrowers/burrower-burrowing-worm/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/burrowers/burrower-burrowing-worm/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/burrowers/burrower-burrowing-worm/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/burrowers/burrower-burrowing-worm/normal.0de436f787cf.webp` | `5440aeee43a7d3e8e37c1210cc4927a373de3b9609df06b9724ee9c0c8fe9cfd` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/burrowers/burrower-burrowing-worm/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/burrowers/burrower-burrowing-worm/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/burrowers/burrower-burrowing-worm/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/burrowers/burrower-burrowing-worm/fire.60ac44d1a1c3.webp` | `b6638ac246b89d9a7f821132c1334a3388b71dc177dc49d8d4be5c2fc8d86c95` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/burrowers/burrower-burrowing-worm/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/burrowers/burrower-burrowing-worm/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/burrowers/burrower-burrowing-worm/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/burrowers/burrower-burrowing-worm/earth.645f13883038.webp` | `c444b521d50cb4f70ba4f29c8457e51537361c89db49dcbc7913a30d4b9d949d` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/burrowers/burrower-burrowing-worm/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/burrowers/burrower-burrowing-worm/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/burrowers/burrower-burrowing-worm/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/burrowers/burrower-burrowing-worm/wind.a5dc1ab21f25.webp` | `9f61ba5328ac0ff195d534c7099bebb82d2aeac0c6be18afbf79eb88816b3797` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/burrowers/burrower-burrowing-worm/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/burrowers/burrower-burrowing-worm/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/burrowers/burrower-burrowing-worm/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/burrowers/burrower-burrowing-worm/water.0fe1a713fa95.webp` | `51a09f64a2a658489dd0b941a742cbc8cf35fcb8cf3d90705c68381c114f55d0` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
