# Mutant Troll

Wiki ID: `monster.troll-mutant-troll`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **planned; no coordinate on this page is approved or runtime art**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Trolls (family 04) |
| Canonical form ID | `troll-mutant-troll` |
| Tier | T3 — Specialist |
| Primary archetype | Misgrowth-Choice Controller (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Mutant Troll |

Source-draft Trolls are treated as a regenerative body-horror production family, not as a claim that all cave, bridge, or bog dwellers share this physiology or hostility. The packet preserves their stooped long-armed anatomy, wet rubbery hide, visible mishealing, embedded debris, and accumulated scar history while giving each hostile form a bounded encounter role.

## Family visual grammar

- Tall, stooped, potbellied humanoid silhouette with a small head on a thick neck and disproportionately long arms hanging past the knees.
- Bog green, liver-brown, sallow grey, bruise purple, and wet glistening highlights keep living hide distinct from mud and scavenged rags.
- Rubbery skin, scar tissue, bark-hard callus, mud, rope, and half-swallowed equipment remain visibly bodily rather than worn as deliberate finery.
- Healed-over piercings, embedded bones, lodged weapons, misplaced limbs, stray jaws, and layered scars record prior injury as readable construction history.
- Escalation adds accumulated misregrowth rather than simple size: open gashes become knots, alternate organs, defensive scar architecture, and finally a walking archive of incompatible healing.

**Escalation axis:** Regeneration becomes increasingly visible and strategically wrong, progressing from one unstable wound cycle to lodged-injury pressure, player-steerable mutation, shed scar terrain, and a Sovereign that replays and produces its whole wound history.

**This form's visual delta:** Deliberately asymmetric with three visibly incomplete, inert motifs: a budded extra arm folded against one side, a sealed second-jaw seam in the neck, and short outward rib sprouts not yet knitted into armor. A pale feeder-scar path links them; only the selected bud swells and completes its motif during Wrong-Part Fork.

## Combat reading

### Battlefield duty

Change the encounter by presenting three incompatible regrowth paths—grasping arm, biting neck jaw, or rib barricade—and forcing the player to choose which mutation the Troll completes.

### Teaching goal

Teach the qualitative Specialist pivot: Troll regeneration is now steerable encounter state, and reading which wound is fed allows the player to trade one known hazard for interrupting a worse one.

### Signature mechanic

Wrong-Part Fork: after taking a knee, the Mutant pushes healing mass toward one of three visible buds. The shoulder bud completes an extra grappling arm, the neck seam opens the second jaw into a short denial cone, and the outward ribs knit into a stationary chest-high barrier. Striking the active bud cancels that mutation but diverts the remaining mass to the next clockwise bud, which completes faster; breaking the pale feeder scar stops the fork entirely.

### Telegraph

A thick pulse travels around the asymmetric torso, one bud turns pale and swells, and the extra arm, neck jaw, or outward ribs twitch before their distinct form locks in.

### Counterplay

Identify the active bud, decide whether its known zone is tolerable, and if not strike it before completion; after one diversion, cut the visibly stretched feeder scar rather than chasing every bud.

### Lower-form interaction

Bog Troll anchors can hold targets inside the jaw cone and Scrags shelter behind the rib barrier, but either lower form can also block the feeder scar and become leverage for interrupting the mutation path.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-mutant-troll/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-mutant-troll/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-mutant-troll/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-mutant-troll/normal-v1.json` |
| Fire | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-mutant-troll/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-mutant-troll/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-mutant-troll/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-mutant-troll/fire-v1.json` |
| Earth | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-mutant-troll/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-mutant-troll/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-mutant-troll/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-mutant-troll/earth-v1.json` |
| Wind | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-mutant-troll/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-mutant-troll/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-mutant-troll/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-mutant-troll/wind-v1.json` |
| Water | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-mutant-troll/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-mutant-troll/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-mutant-troll/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-mutant-troll/water-v1.json` |

### Status semantics

- `planned` means the Normal identity-anchor attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means an elemental attempt must wait for accepted Normal anchor evidence before production.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Any future image remains candidate-only until independent review. Runtime promotion is a separate integration decision.
