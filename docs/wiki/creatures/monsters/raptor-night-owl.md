# Night Owl

Wiki ID: `monster.raptor-night-owl`

[← Canonical monster database](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Raptors (family 38) |
| Canonical form ID | `raptor-night-owl` |
| Tier | T3 — Specialist |
| Primary archetype | Silent-Drop Specialist |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — Owner-approved fauna expansion |

A natural bird-of-prey family centered on vertical tracking, attack shadows, landing windows, carry threats, and airspace control. It remains distinct from humanoid Harpies.

## Family visual grammar

- Every form retains an avian body with two wings, two taloned legs, hooked beak, feathered tail, and species-appropriate head rather than humanoid arms or torso.
- Tier escalation uses wingspan, feather structure, facial disc, talon mass, scars, and flight behavior rather than worn equipment.
- Shadow shape, tail fan, primary-feather angle, talon extension, perch choice, and landing route keep aerial attacks readable.

**Escalation axis:** A single shadow dive becomes alternating perch attacks, silent movement-triggered drops, carry-off pressure, and finally a sovereign that divides the arena into flight bands.

**This form's visual delta:** Large owl with broad facial disc, fringed silent feathers, rotating head, short tail, and wide gripping feet.

## Combat reading

### Battlefield duty

Track movement rather than position and drop onto the last target that sprinted.

### Teaching goal

Introduce a qualitative specialist that changes safe movement cadence instead of merely adding another dive.

### Signature mechanic

Last Motion Drop: the Owl fixes on the most recent sprint and descends silently onto that endpoint.

### Telegraph

Its facial disc narrows and airborne dust stops moving beneath its approach.

### Counterplay

Walk or hold still until the drop commits, then punish the open talons at ground contact.

### Lower-form interaction

Kite shadows encourage premature movement and Hawk passes alternate facing before the Owl selects the last sprint.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/raptors/raptor-night-owl/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/raptors/raptor-night-owl/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/raptors/raptor-night-owl/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/raptors/raptor-night-owl/normal.0bc0e3cd1040.webp` | `9bd260dd4dbb9f68ec0761fad7fe67cc92429a319bdf4ecd0956537affc7a5c0` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/raptors/raptor-night-owl/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/raptors/raptor-night-owl/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/raptors/raptor-night-owl/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/raptors/raptor-night-owl/fire.fd863883d7ab.webp` | `1bbe26d27cf567f7431268cc9374ee948f9a2fe4c55ca518d010d6a740952eda` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/raptors/raptor-night-owl/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/raptors/raptor-night-owl/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/raptors/raptor-night-owl/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/raptors/raptor-night-owl/earth.1d42e20e91a2.webp` | `9dcd3f10ec29366126160bee9d4e37712a2e54eb444a7fa05d6d1885f05a2381` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/raptors/raptor-night-owl/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/raptors/raptor-night-owl/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/raptors/raptor-night-owl/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/raptors/raptor-night-owl/wind.4cc913d5dc26.webp` | `5ab904428421cbe0b349555610a25b12c4aa2adfdce0a0e3ca34bac3b19cc952` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/raptors/raptor-night-owl/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/raptors/raptor-night-owl/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/raptors/raptor-night-owl/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/raptors/raptor-night-owl/water.d2c9b833d7ea.webp` | `9252cf04ee6a840dd9fb7e88f528c30b804f0d9a0475f57d2295588426fba287` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
