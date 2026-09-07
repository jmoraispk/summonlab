# Tunnel Boar

Wiki ID: `monster.boar-tunnel-boar`

[← Boars family](families/boars.md) · [Monster bestiary](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Boars (family 33) |
| Canonical form ID | `boar-tunnel-boar` |
| Tier | T2 — Soldier |
| Primary archetype | Brace-and-Charge Soldier |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — tunnel-boar; Owner-approved fauna expansion |

A natural suid expedition family centered on predictable charge lanes, bracing, displacement, and route creation.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Boars family page](families/boars.md).

**Escalation axis:** A short straight charge becomes a braced line-breaker, curved furrow specialist, formation-opening champion, and three-lane sovereign stampede.

**This form's visual delta:** Thick-necked cave boar with worn forehead, longer tusks, mud-packed coat, and reinforced shoulder callus.

## Combat reading

### Battlefield duty

Brace inside narrow ground and drive targets out of cover with a long committed charge.

### Teaching goal

Teach players to turn a dangerous lane into a collision by reading the full brace.

### Signature mechanic

Tunnel Brace: both hind legs lock before a long charge that gains power in narrow terrain but cannot evade obstacles.

### Telegraph

Both hind hooves settle and dust funnels backward along the future lane.

### Counterplay

Leave the lane or make the Boar collide with solid terrain, exposing its stunned forehead and flank.

### Lower-form interaction

Bristle Hogs make short probes that encourage the target to enter the Tunnel Boar's longer lane.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-tunnel-boar/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-tunnel-boar/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-tunnel-boar/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-tunnel-boar/normal.bbd47667ec38.webp` | `8ece47dfed5b60f992e2b097251127008436617191887115506ae8dc2971f563` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-tunnel-boar/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-tunnel-boar/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-tunnel-boar/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-tunnel-boar/fire.a6e10aaf4b66.webp` | `285c3ffce63b4679237152811e5c94c9ac9607a3575be28813ea181b60afca46` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-tunnel-boar/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-tunnel-boar/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-tunnel-boar/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-tunnel-boar/earth.a3415b8a200d.webp` | `f69dccf777cdcef3ce5cfce823c74a971981928677e284bec6ef481ef2088fbd` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-tunnel-boar/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-tunnel-boar/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-tunnel-boar/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-tunnel-boar/wind.3941d59826d7.webp` | `a9cf9faa5359df11780e0549457ca7fe896358369f5c4ba1b4d1a160fa287e83` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-tunnel-boar/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-tunnel-boar/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-tunnel-boar/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-tunnel-boar/water.3d75d1a53d95.webp` | `b6c26ca897fe83c65e1c3583562a9e944c13106052fdac588a5843cd5b6dfa75` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
