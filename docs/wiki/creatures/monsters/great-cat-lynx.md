# Lynx

Wiki ID: `monster.great-cat-lynx`

[← Canonical monster database](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Great Cats (family 35) |
| Canonical form ID | `great-cat-lynx` |
| Tier | T2 — Soldier |
| Primary archetype | High-Ground Soldier |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — Owner-approved fauna expansion |

A natural feline expedition family centered on concealment, facing, isolation, explosive pounces, and hunting-territory control.

## Family visual grammar

- Every form retains a four-legged feline body, flexible spine, retractile claws, whiskered muzzle, mobile ears, and expressive tail.
- Species variation remains feline and is communicated by coat pattern, limb proportion, mane, canine length, and hunting posture rather than equipment.
- Eye line, tail stillness, shoulder compression, cover disturbance, and landing posture preserve readable attack direction.

**Escalation axis:** A simple cover pounce becomes high-ground hunting, sightline isolation, saber-tooth pinning, and finally an apex territory hunt that assigns every lower form a role.

**This form's visual delta:** Larger compact cat with long hind legs, short tail, broad facial ruff, and oversized snowshoe paws.

## Combat reading

### Battlefield duty

Bound between raised perches and attack whichever target presents the longest exposed back.

### Teaching goal

Teach players to rotate facing vertically and contest predictable landing cones.

### Signature mechanic

Perch Exchange: the Lynx uses two visible perches and must complete one grounded pause after each attack.

### Telegraph

Ear tufts flatten and the selected perch sheds dust toward its landing cone.

### Counterplay

Rotate toward the perch or vacate the cone, then punish the grounded pause.

### Lower-form interaction

Wildcats pressure low cover while the Lynx controls the high angle, but both share punishable landings.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-lynx/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-lynx/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-lynx/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-lynx/normal.494d254071ad.webp` | `65b182a4cf01d32c2b8372eac475fadfbc19be4cda50696e0ecd3a5e66fa779f` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-lynx/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-lynx/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-lynx/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-lynx/fire.6c4f0a362ff1.webp` | `676b3be882f34d9d9e46d91de1b05803982dd2493bef1628807690f21e67c611` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-lynx/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-lynx/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-lynx/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-lynx/earth.9370439bd481.webp` | `28ee142d9a9f305204313441373beb8b5ac8c650f63e32fa76b003dbbdef2586` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-lynx/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-lynx/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-lynx/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-lynx/wind.b03f716235d8.webp` | `d99839c65c83616d581ecb06619ac21f574816ffaef62e030a360ebbdd7fa02e` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-lynx/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-lynx/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-lynx/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-lynx/water.5a0d73e4ac98.webp` | `051b76932f04a55c12e97d5b6e30db7e6f4ca7a7b75d0b47f9e1c3fe6ce88baf` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
