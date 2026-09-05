# Crown Serpent

Wiki ID: `monster.serpent-crown-serpent`

[← Canonical monster database](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Serpents (family 36) |
| Canonical form ID | `serpent-crown-serpent` |
| Tier | T5 — Sovereign |
| Primary archetype | Living-Coil Sovereign |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — Owner-approved fauna expansion |

A natural limbless snake family centered on fixed strike range, constriction, venom lanes, buried reach, and living coil control. It remains distinct from sapient humanoid Nagas.

## Family visual grammar

- Every form remains limbless with a continuous scaled body, snake skull, jaw hinge, belly scutes, forked tongue, and species-appropriate tail.
- Tier escalation uses body proportion, hood, fangs, horns, crown scales, muscle distribution, and coil behavior rather than arms or equipment.
- Strike range, head anchor, venom direction, emergence point, and loosened coil remain visually traceable.

**Escalation axis:** A fixed one-length strike becomes anchored constriction, a two-lane venom specialist, buried alternating reach, and finally a sovereign whose body coils become arena terrain.

**This form's visual delta:** Colossal plausible snake with crown-like occipital scales, long patterned body, four recognizable scar bands, and no humanoid torso.

## Combat reading

### Battlefield duty

Encircle the arena in layered body coils and assign lower Serpents to the gaps between them.

### Teaching goal

Test fixed reach, head-anchor disruption, venom lanes, and buried emergence while treating the boss body as readable terrain.

### Signature mechanic

Crown Coil: one crown scale lifts for each tightening body ring; the lower Serpent guarding that gap defines how it closes.

### Telegraph

Crown scales lift in the order of the next constriction and the corresponding lower Serpent becomes still.

### Counterplay

Remove or displace the still guard, cross the loosened coil, and strike the lifted crown scale before tightening resumes.

### Lower-form interaction

Adder supplies the fixed strike gap, Constrictor the anchored ring, Cobra the venom lane, and Horned Viper the buried opening; losing one permanently loosens its coil.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/serpents/serpent-crown-serpent/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/serpents/serpent-crown-serpent/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/serpents/serpent-crown-serpent/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/serpents/serpent-crown-serpent/normal.e4860843fde7.webp` | `4289bab28cc9079e8c11fcdfe27cbd8c87db85aea951b94a624ccdfc51b5aca8` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/serpents/serpent-crown-serpent/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/serpents/serpent-crown-serpent/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/serpents/serpent-crown-serpent/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/serpents/serpent-crown-serpent/fire.1a390c8fee95.webp` | `66020e863c55d9048cd3c342a99b907b0bff8dd29681d2559473a208048bf477` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/serpents/serpent-crown-serpent/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/serpents/serpent-crown-serpent/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/serpents/serpent-crown-serpent/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/serpents/serpent-crown-serpent/earth.99868ef33334.webp` | `9ddfa618e129180a69eaaaebd8d1eb71e4b36d050f5dac40ea3124af3b251e18` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/serpents/serpent-crown-serpent/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/serpents/serpent-crown-serpent/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/serpents/serpent-crown-serpent/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/serpents/serpent-crown-serpent/wind.d0b674f289d5.webp` | `2ba56793798576f71e97718f15255814a86223f0cd10b15583b8d0c19cfac662` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/serpents/serpent-crown-serpent/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/serpents/serpent-crown-serpent/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/serpents/serpent-crown-serpent/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/serpents/serpent-crown-serpent/water.842e93db40e5.webp` | `3ac23ce11ad693a813099888811a4e6e65ca44e5e027b67c1d7d6bbeab73b06e` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
