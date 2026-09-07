# Cave Bear

Wiki ID: `monster.bear-cave-bear`

[← Bears family](families/bears.md) · [Monster bestiary](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Bears (family 32) |
| Canonical form ID | `bear-cave-bear` |
| Tier | T2 — Soldier |
| Primary archetype | Maul-Line Soldier |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — cave-bear; Owner-approved fauna expansion |

A natural ursine expedition family built around mass, committed attacks, grappling, and territorial control.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Bears family page](families/bears.md).

**Escalation axis:** A simple committed swipe becomes frontal maul pressure, an asymmetric hook-and-drag specialist, terrain-breaking dominance, and finally den-scale territorial command.

**This form's visual delta:** Massive cave-adapted bear with high shoulders, dense dark coat, worn claws, and pale muzzle scars.

## Combat reading

### Battlefield duty

Advance behind crossed forelegs, absorb frontal pressure, then open into a two-paw maul.

### Teaching goal

Teach players to disengage from guarded frontal mass and seek a rear-quarter angle.

### Signature mechanic

Crossed Maul: protected advance ends when both forearms open into a fixed two-swipe sequence.

### Telegraph

The forearms cross, claws scrape, and its chest expands before opening.

### Counterplay

Attack from the rear quarter or disengage until the second swipe exhausts and exposes the chest.

### Lower-form interaction

Scrub Bears pressure the exposed side while the Cave Bear's crossed advance fixes attention.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-cave-bear/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-cave-bear/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-cave-bear/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-cave-bear/normal.4322dc2f0fe1.webp` | `3c6dae9cf09790aad3f306a8429858679ff77a945d8c02af3e5c86ec419bf7f1` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-cave-bear/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-cave-bear/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-cave-bear/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-cave-bear/fire.338acf5a67d6.webp` | `11f84b4c1d6950d72c7ecfb00e6ee1fb921e419a90f0fff553a435bf3195ee7d` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-cave-bear/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-cave-bear/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-cave-bear/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-cave-bear/earth.acbba8f69504.webp` | `9c3c71cd86203857ddbbeba4e17dded2ad6192adedd86a3361d821734cc15b78` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-cave-bear/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-cave-bear/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-cave-bear/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-cave-bear/wind.30f7f8937538.webp` | `c6e614eeebdb01925c3a99ee2c54ecf2adad786c4be41c306b35c13e81226a88` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/bears/bear-cave-bear/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/bears/bear-cave-bear/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/bears/bear-cave-bear/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/bears/bear-cave-bear/water.15f43cc2b4b9.webp` | `8ccf8efd43b1ef452a22ccf4c11659a0fe56b47bc44e85b6650103973d42364d` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
