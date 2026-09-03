# Scarlord

Wiki ID: `monster.troll-scarlord`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: planned; Earth: planned; Wind: planned; Water: planned. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Trolls (family 04) |
| Canonical form ID | `troll-scarlord` |
| Tier | T4 — Champion |
| Primary archetype | Scar-Shed Bog Bastion (Champion) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Scarlord |

Source-draft Trolls are treated as a regenerative body-horror production family, not as a claim that all cave, bridge, or bog dwellers share this physiology or hostility. The packet preserves their stooped long-armed anatomy, wet rubbery hide, visible mishealing, embedded debris, and accumulated scar history while giving each hostile form a bounded encounter role.

## Family visual grammar

- Tall, stooped, potbellied humanoid silhouette with a small head on a thick neck and disproportionately long arms hanging past the knees.
- Bog green, liver-brown, sallow grey, bruise purple, and wet glistening highlights keep living hide distinct from mud and scavenged rags.
- Rubbery skin, scar tissue, bark-hard callus, mud, rope, and half-swallowed equipment remain visibly bodily rather than worn as deliberate finery.
- Healed-over piercings, embedded bones, lodged weapons, misplaced limbs, stray jaws, and layered scars record prior injury as readable construction history.
- Escalation adds accumulated misregrowth rather than simple size: open gashes become knots, alternate organs, defensive scar architecture, and finally a walking archive of incompatible healing.

**Escalation axis:** Regeneration becomes increasingly visible and strategically wrong, progressing from one unstable wound cycle to lodged-injury pressure, player-steerable mutation, shed scar terrain, and a Sovereign that replays and produces its whole wound history.

**This form's visual delta:** A bloated mass of overlapping regrowth with bark-hard scar plating across the chest, mismatched limbs of different sizes, and visible wet layers beneath plates ready to shed.

## Combat reading

### Battlefield duty

Build temporary healing territory by tearing off overlapping chest plates as cover and regrowth beds, then using mismatched limbs to patrol the seams between them.

### Teaching goal

Teach space-control prioritization: the Scarlord's old scars make lower Trolls recover safely, but every shed plate exposes a fresh soft layer and creates a seam players can exploit.

### Signature mechanic

Palimpsest Plates: the Scarlord peels one bark-hard chest plate and slams it into the bog. Trolls touching its wet inner face regenerate without exposing their usual bud, while the Scarlord loses armor at the matching chest quadrant. Two adjacent plates can overlap into a covered healing pocket, but striking their bright wet seam collapses both.

### Telegraph

Mismatched arms hook beneath a cracked chest plate, dark fluid beads around its edge, and nearby Trolls turn their open wounds toward the glistening inner surface.

### Counterplay

Attack the newly soft chest quadrant, strike the wet overlap before lower forms enter, or force the Scarlord to place plates apart so they cannot form a protected pocket.

### Lower-form interaction

Scrags close Bad Closure against a plate, Bog Trolls anchor enemies at its edge, and Mutant Trolls feed buds without exposing the feeder scar; destroying the plate restores every familiar interruption window.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scarlord/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scarlord/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scarlord/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scarlord/normal-v1.json` |
| Fire | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scarlord/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scarlord/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scarlord/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scarlord/fire-v1.json` |
| Earth | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scarlord/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scarlord/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scarlord/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scarlord/earth-v1.json` |
| Wind | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scarlord/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scarlord/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scarlord/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scarlord/wind-v1.json` |
| Water | `planned` | `planned` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scarlord/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scarlord/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scarlord/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scarlord/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
