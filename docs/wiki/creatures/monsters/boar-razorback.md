# Razorback

Wiki ID: `monster.boar-razorback`

[← Boars family](families/boars.md) · [Monster bestiary](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Boars (family 33) |
| Canonical form ID | `boar-razorback` |
| Tier | T3 — Specialist |
| Primary archetype | Furrow-Cutting Specialist |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — Owner-approved fauna expansion |

A natural suid expedition family centered on predictable charge lanes, bracing, displacement, and route creation.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Boars family page](families/boars.md).

**Escalation axis:** A short straight charge becomes a braced line-breaker, curved furrow specialist, formation-opening champion, and three-lane sovereign stampede.

**This form's visual delta:** Tall sail-like bristle ridge, asymmetric plow tusk, and visibly overbuilt shoulder on the cutting side.

## Combat reading

### Battlefield duty

Cut a curved furrow whose route controls the next charge and throws debris outward.

### Teaching goal

Introduce a specialist whose charge can curve but must first draw its complete route into the ground.

### Signature mechanic

Plow Curve: the inside tusk remains buried while the Razorback scores a visible curved path for its next charge.

### Telegraph

The inside tusk stays in the soil and back bristles ripple along the future curve.

### Counterplay

Cross the furrow before launch or strike the rooted outside leg while the curve is being cut.

### Lower-form interaction

Bristle Hogs rush across the outside edge while Tunnel Boars threaten the straight escape from the curve.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-razorback/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-razorback/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-razorback/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-razorback/normal.7c0dcc04880e.webp` | `b6476d9728f1c278d1719f35db422bc502d750c2f98df8c4e5663ed3fbd9063e` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-razorback/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-razorback/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-razorback/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-razorback/fire.bc72c451bce5.webp` | `f72d40fa537b381336b5850b8ed065b74238c9d5027a91fda55b7ae10e703844` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-razorback/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-razorback/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-razorback/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-razorback/earth.c74429a98c96.webp` | `1d8310a8699dde79cafe37fa5ef5ab36f36312049d96352ceef0e866715d0f9f` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-razorback/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-razorback/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-razorback/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-razorback/wind.fcddc5d8ee9d.webp` | `c011f8cc6430be858c84234cba84ca1822956f058ebca1b40255dd4ff2bbfac6` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/boars/boar-razorback/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/boars/boar-razorback/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/boars/boar-razorback/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/boars/boar-razorback/water.ea9e91b3a7fd.webp` | `96f570f7ade71af99a05f0b02a21d191dadafdb4fc6471aef5baf584dfa85f98` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
