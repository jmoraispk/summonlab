# Sabercat

Wiki ID: `monster.great-cat-sabercat`

[← Canonical monster database](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Great Cats (family 35) |
| Canonical form ID | `great-cat-sabercat` |
| Tier | T4 — Champion |
| Primary archetype | Pinning Champion |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — Owner-approved fauna expansion |

A natural feline expedition family centered on concealment, facing, isolation, explosive pounces, and hunting-territory control.

## Family visual grammar

- Every form retains a four-legged feline body, flexible spine, retractile claws, whiskered muzzle, mobile ears, and expressive tail.
- Species variation remains feline and is communicated by coat pattern, limb proportion, mane, canine length, and hunting posture rather than equipment.
- Eye line, tail stillness, shoulder compression, cover disturbance, and landing posture preserve readable attack direction.

**Escalation axis:** A simple cover pounce becomes high-ground hunting, sightline isolation, saber-tooth pinning, and finally an apex territory hunt that assigns every lower form a role.

**This form's visual delta:** Heavy forequarters, paired saber canines, short powerful tail, scarred shoulders, and a low spring-loaded stance.

## Combat reading

### Battlefield duty

Commit both long canines to a ground pin that gives lesser Cats safer approach angles.

### Teaching goal

Teach players to exploit a champion's strongest weapon as a temporary anchor and weak point.

### Signature mechanic

Twin-Canine Pin: both sabers plant beside the target and cannot withdraw until the Sabercat resets its forequarters.

### Telegraph

Its jaws open fully, forepaws widen, and heavy shoulders rise before the leap.

### Counterplay

Dodge inside the leap and punish the planted canines or exposed ribs before withdrawal.

### Lower-form interaction

Wildcats and Lynxes use the pin's open sides while the Panther holds the direct rescue line.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-sabercat/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-sabercat/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-sabercat/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-sabercat/normal.726cdd3ed481.webp` | `e4bdd5868b3902311d4bc6faba52d9b75ab8f3c6bc8600aab63606d276347090` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-sabercat/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-sabercat/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-sabercat/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-sabercat/fire.faff8dac020f.webp` | `a2d496e0c6bdba69008ab700aca577a797cfa43f9c83b6aceeee92d98641ebf2` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-sabercat/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-sabercat/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-sabercat/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-sabercat/earth.1ca533c477ef.webp` | `b6be8a6c80f847dc4ad2f607ba02262a1698b2a6a5eaba5bbb3dc92a64a36075` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-sabercat/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-sabercat/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-sabercat/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-sabercat/wind.1208bbc9d75b.webp` | `152d542dfd0df6b56a5cf48f2fd08897a985bc823ccf57d5191130b0e44b9879` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/great-cats/great-cat-sabercat/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/great-cats/great-cat-sabercat/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/great-cats/great-cat-sabercat/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/great-cats/great-cat-sabercat/water.a1831872cad4.webp` | `f456f844f0e3b9fc5c34279823a145213d2359509ad0a425cb1680f22adad669` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
