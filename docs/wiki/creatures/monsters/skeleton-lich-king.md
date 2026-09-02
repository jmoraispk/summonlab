# Lich King

Wiki ID: `monster.skeleton-lich-king`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **planned; no coordinate on this page is approved or runtime art**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Skeletons (family 06) |
| Canonical form ID | `skeleton-lich-king` |
| Tier | T5 — Sovereign |
| Primary archetype | Sepulcher-Court Necromancer (Sovereign) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Lich King |

Source-draft Skeletons are treated as a necromantically animated-remains production family, not as a biological species or evidence about the identity, autonomy, rights, or allegiance of the original dead. The packet preserves humanlike bone gaps, grave goods, socket-fire binding, progressive fusion, and cheap reassembly while assigning each hostile form an explicit battlefield duty.

## Family visual grammar

- Human or humanoid skeletal proportions remain narrow, angular, and defined by empty negative space where flesh and organs would be.
- Bone white or yellowed ivory is paired with rust, black iron, tattered grave-cloth, and one explained necromantic socket-fire accent such as green, blue, or gold.
- Bone, rusted mail, corroded steel, grave-cloth, funerary jewelry, and crowns remain recognizable mortuary materials rather than living anatomy.
- Carved skull runes, bone spurs, fused armor-like mass, grave regalia, and orbiting fragments accumulate as binding power becomes denser.
- Bone density and the intensity and reach of the visible necromantic binding escalate together, but every form preserves gaps, joints, or binding anchors that can be deliberately broken.

**Escalation axis:** Loose bones become mail-bound ranks, a Specialist that levies battlefield fragments, fused spur architecture, and finally a royal sepulcher engine that commands, rebuilds, and promotes the whole skeletal court.

**This form's visual delta:** A skeletal sorcerer-king robed in gold and deep velvet, wearing a jeweled crown, carrying a staff of visibly bound souls, and framed by a slow halo of orbiting bone fragments aligned to four grave seals.

## Combat reading

### Battlefield duty

Command a four-seal boss court that reassembles, equips, levies, and fuses lower skeletons while the royal halo changes orbit to expose one production gap at a time.

### Teaching goal

Test mastery of skull anchors, loaded mail, levy routes, and crown seams by making players interrupt the exact grave seal producing each learned formation before the King can bind it into the next rank.

### Signature mechanic

Royal Ossuary: four independent grave-seal paths surround the throne—the Rattle seal assembles loose bones as Rattlers, the Mail seal equips a separate bone levy as Bonesoldiers, the Helm seal raises armored remains as Bone Knights, and the Crown seal fuses its own guarded ossuary into a Bone Champion. Each path produces or promotes its source-supported form without requiring the previous tier's promotion. The Lich King points its staff of bound souls at one seal, and the halo of orbiting fragments opens a matching gap to feed it. Destroying the exposed seal permanently removes that path and leaves a wider halo gap. After two seals fall, the King descends from the throne and wears the remaining halo fragments as asymmetrical skeletal limbs, cycling their familiar mechanics instead of merely enlarging the Champion.

### Telegraph

The jeweled crown inclines toward one grave seal, souls pull visibly down the staff, and the slow bone halo opens over that same route while lower skeletons turn their socket-fire toward it.

### Counterplay

Follow the halo gap, scatter or intercept the lower form designated for promotion, strike the exposed seal before the staff pulse completes, and use each permanent gap to approach the King during the dismounted phase.

### Lower-form interaction

Independent Rattle, Mail, Helm, and Crown paths produce or promote Rattlers, Bonesoldiers, Bone Knights, and Bone Champions from their own remains without requiring a previous-tier promotion; every destroyed seal permanently removes one production or transformation rule and expands the King's exposed halo gap.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-lich-king/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-lich-king/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-lich-king/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-lich-king/normal-v1.json` |
| Fire | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-lich-king/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-lich-king/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-lich-king/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-lich-king/fire-v1.json` |
| Earth | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-lich-king/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-lich-king/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-lich-king/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-lich-king/earth-v1.json` |
| Wind | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-lich-king/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-lich-king/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-lich-king/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-lich-king/wind-v1.json` |
| Water | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/skeletons/skeleton-lich-king/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/skeletons/skeleton-lich-king/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/skeletons/skeleton-lich-king/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/skeletons/skeleton-lich-king/water-v1.json` |

### Status semantics

- `planned` means the Normal identity-anchor attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means an elemental attempt must wait for accepted Normal anchor evidence before production.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Any future image remains candidate-only until independent review. Runtime promotion is a separate integration decision.
