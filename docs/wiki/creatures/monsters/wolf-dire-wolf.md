# Dire Wolf

Wiki ID: `monster.wolf-dire-wolf`

[← Wolves family](families/wolves.md) · [Monster bestiary](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Wolves (family 31) |
| Canonical form ID | `wolf-dire-wolf` |
| Tier | T2 — Soldier |
| Primary archetype | Hamstring Pursuer |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — dire-wolf; Owner-approved fauna expansion |

A natural lupine expedition family built around pack geometry, pursuit, and coordinated prey selection. It remains distinct from transformed humanoid Werebeasts.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Wolves family page](families/wolves.md).

**Escalation axis:** Opportunistic flanking becomes alternating pursuit, directional pack timing, marked-prey command, and finally an arena-scale hunt circle controlled by an apex Greatwolf.

**This form's visual delta:** Heavier chest and jaws, darker coarse coat, old flank scars, and a lower pursuit posture while remaining fully lupine.

## Combat reading

### Battlefield duty

Alternate pursuit with a packmate and slow isolated prey with a committed rear-leg bite.

### Teaching goal

Teach players to break two-sided pursuit geometry instead of retreating in a straight line.

### Signature mechanic

Alternating Hamstring: only the Wolf on the prey's rear quarter attacks while its partner widens for the next exchange.

### Telegraph

Its head flattens beside the shoulder as the partner visibly widens formation.

### Counterplay

Break their angle with terrain or stagger the committed biter before the partner completes the swap.

### Lower-form interaction

Grey Wolves probe the opposite flank and create the turn that lets the Dire Wolf claim the rear quarter.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-dire-wolf/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-dire-wolf/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-dire-wolf/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-dire-wolf/normal.50a326c2e19a.webp` | `d8b297c683c8c37655773e2b25d0b346f609d2a9de072cc7208ef2b13187b601` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-dire-wolf/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-dire-wolf/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-dire-wolf/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-dire-wolf/fire.ac4e439ce480.webp` | `66b0b53f3169a47a5bc16d8747fbb7c26731b13d60930c176cd9c9005fbec860` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-dire-wolf/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-dire-wolf/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-dire-wolf/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-dire-wolf/earth.907f15d9e5bc.webp` | `385cd7928c9c807ea91cff6a15154e8c7f82c26cc6b2165e28e286470b276127` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-dire-wolf/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-dire-wolf/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-dire-wolf/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-dire-wolf/wind.71fd6899f126.webp` | `5078f3fb3a8a8180df6319717279a6a2e801f653daa5770e0572dc6dfc2292c3` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-dire-wolf/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-dire-wolf/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-dire-wolf/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-dire-wolf/water.93c2197da358.webp` | `1f4233d1ac5dfb69df99d8b380be452f8c4ad49e02ec3621779f29d2ffcf8175` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
