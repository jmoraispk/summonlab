# Grey Wolf

Wiki ID: `monster.wolf-grey-wolf`

[← Wolves family](families/wolves.md) · [Monster bestiary](README.md)

Design status: **accepted canonical form**

Visual-production status: **Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Wolves (family 31) |
| Canonical form ID | `wolf-grey-wolf` |
| Tier | T1 — Initiate |
| Primary archetype | Flank-Probe Initiate |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](../../../superpowers/specs/2026-09-04-fauna-family-expansion-design.md) — grey-wolf; Owner-approved fauna expansion |

A natural lupine expedition family built around pack geometry, pursuit, and coordinated prey selection. It remains distinct from transformed humanoid Werebeasts.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Wolves family page](families/wolves.md).

**Escalation axis:** Opportunistic flanking becomes alternating pursuit, directional pack timing, marked-prey command, and finally an arena-scale hunt circle controlled by an apex Greatwolf.

**This form's visual delta:** Lean ordinary wolf with a grey coat, long legs, intact ears, light rib visibility, and no equipment.

## Combat reading

### Battlefield duty

Circle toward an exposed side and commit to one tripping bite when the target turns away.

### Teaching goal

Teach players to track facing and deny a simple flank before learning full pack coordination.

### Signature mechanic

Cross-Step Trip: the Grey Wolf crosses its outside forepaw inward before lunging at the target's rear leg.

### Telegraph

Its shoulders drop and the outside forepaw crosses inward while its gaze fixes on the exposed leg.

### Counterplay

Face the Wolf or step across its approach, then punish the missed bite during the low recovery.

### Lower-form interaction

Not applicable for this form.

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-grey-wolf/normal/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-grey-wolf/normal-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-grey-wolf/normal.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-grey-wolf/normal.7419af6fb1df.webp` | `27dd5fe2058e1e9748467392231ed983c3054901ad167b3214d1d54118fccd07` |
| Fire | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-grey-wolf/fire/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-grey-wolf/fire-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-grey-wolf/fire.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-grey-wolf/fire.5cf13629ccb8.webp` | `9da699ce238479d33b8d306fa315105f6f8d0df08b4ce04bcfd8967ca7776cfe` |
| Earth | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-grey-wolf/earth/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-grey-wolf/earth-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-grey-wolf/earth.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-grey-wolf/earth.755f99aaa4df.webp` | `c8f336ed330262a4ea23f2dfac3835b1314385c651100977be9270efa1b1fc36` |
| Wind | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-grey-wolf/wind/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-grey-wolf/wind-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-grey-wolf/wind.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-grey-wolf/wind.b0d3e87c1ece.webp` | `ded78af590bfdfaa3d5418f1d37a91b354c26103ce9e91ad6b68639de4a7439a` |
| Water | `runtime` | v1 | `assets/enemies/experiments/fauna-family-v1/targets/wolves/wolf-grey-wolf/water/target-v1.json` | `assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-grey-wolf/water-v1.png` | `assets/enemies/approved/fauna-family-v1/sources/wolves/wolf-grey-wolf/water.png` | `apps/web/static/runtime/enemies/fauna-family-v1/wolves/wolf-grey-wolf/water.f0db7a51a7cc.webp` | `86516f0f205f22cc672261502b942c395581270f9d927bfa5a0f9dbd0faa72ec` |

### State semantics

- `runtime` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under `assets/enemies/experiments/fauna-family-v1`.
- Approved sources live separately under `assets/enemies/approved/fauna-family-v1` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
