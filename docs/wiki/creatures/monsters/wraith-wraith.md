# Wraith

Wiki ID: `monster.wraith-wraith`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **planned; no coordinate on this page is approved or runtime art**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Wraiths (family 08) |
| Canonical form ID | `wraith-wraith` |
| Tier | T3 — Specialist |
| Primary archetype | Orbit-Blade Boundary Hunter (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-02.md) — Wraith |

Source-draft Wraiths are treated as hostile incorporeal dead-person spirits for encounter production, not as a biological species or a universal statement about the dead, memory, autonomy, morality, or afterlife. Cold light, frost, and chill are family-native signs of deathly condensation in the source and remain explicitly non-affinity unless an authored elemental construction changes material and behavior.

## Family visual grammar

- A hooded or robed humanoid upper body becomes progressively defined while the lower body always trails into smoke or cold vapor without visible feet.
- Black, charcoal, deep indigo, and ash grey carry one cold eye accent in pale blue, white, or sickly green; this family-native cold light is not an elemental affinity by itself.
- Smoke, tattered shroud-cloth, cold vapor, rusted chain, and hollow armor preserve incorporeality through negative space and incomplete edges.
- Chains, funeral shrouds, spectral crowns, and localized rings of source-native frost become anchors that explain when and where an otherwise incorporeal form can be opposed.
- Escalation condenses a faint outline into a sharply defined regal silhouette while retaining a vapor tail, empty interior, and one readable anchor for every phase-through action.

**Escalation axis:** A barely held mist learns to drag anchors, weaponize the boundary between wall and room, spread a crowned cloak territory, and finally command a court through hollow regalia whose seals can be permanently opened.

**This form's visual delta:** A clearly defined robed and hooded figure with fully visible skeletal hands, a spectral blade with a solid-looking hilt, and three rusted chains orbiting the body above a vapor tail.

## Combat reading

### Battlefield duty

Qualitatively pivot the floor into boundary prediction by orbiting several chains around a fully defined spectral blade and choosing one contacted surface as the blade's remote emergence edge.

### Teaching goal

Teach players to watch the moving chain orbit, identify which surface it has claimed, and attack the exposed blade hilt while the striking edge exists elsewhere.

### Signature mechanic

Borrowed Edge: three orbiting chains sweep the room until one link touches a wall, pillar, or shield. The Wraith passes only the spectral blade through that marked boundary, causing its edge to emerge along the entire touched line while the robed body and hilt remain fixed. Severing the contacting chain or striking the hilt collapses the remote edge.

### Telegraph

The visible skeletal hands reverse their grip, one orbiting chain stops against a surface, and cold light runs from the fixed link through the blade hilt before the remote edge appears.

### Counterplay

Leave the marked boundary, sever the motionless contacting link, or close on the stationary hilt while the blade is committed elsewhere; the other two chains continue orbiting but cannot strike.

### Lower-form interaction

Haunts can route their Funeral Drag along the claimed boundary and Shades condense at its corners; breaking the fixed Wraith chain interrupts those routes as well as the remote blade.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `assets/enemies/experiments/family-affinity-v1/targets/wraiths/wraith-wraith/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/wraiths/wraith-wraith/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/wraiths/wraith-wraith/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/wraiths/wraith-wraith/normal-v1.json` |
| Fire | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/wraiths/wraith-wraith/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/wraiths/wraith-wraith/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/wraiths/wraith-wraith/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/wraiths/wraith-wraith/fire-v1.json` |
| Earth | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/wraiths/wraith-wraith/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/wraiths/wraith-wraith/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/wraiths/wraith-wraith/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/wraiths/wraith-wraith/earth-v1.json` |
| Wind | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/wraiths/wraith-wraith/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/wraiths/wraith-wraith/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/wraiths/wraith-wraith/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/wraiths/wraith-wraith/wind-v1.json` |
| Water | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/wraiths/wraith-wraith/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/wraiths/wraith-wraith/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/wraiths/wraith-wraith/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/wraiths/wraith-wraith/water-v1.json` |

### Status semantics

- `planned` means the Normal identity-anchor attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means an elemental attempt must wait for accepted Normal anchor evidence before production.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Any future image remains candidate-only until independent review. Runtime promotion is a separate integration decision.
