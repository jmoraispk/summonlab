# Warchief

Wiki ID: `monster.orc-warchief`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: blocked-on-anchor; Earth: blocked-on-anchor; Wind: blocked-on-anchor; Water: blocked-on-anchor. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Orcs (family 02) |
| Canonical form ID | `orc-warchief` |
| Tier | T4 — Champion |
| Primary archetype | Skull-Totem Line Commander (Champion) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Warchief |

Source-draft Orcs are treated as a visual and encounter-production family, not as proof of universal culture, allegiance, morality, or personhood. This packet preserves their top-heavy anatomy, tusks, battle marks, heavy equipment, and visible status language while assigning each hostile form a specific authored combat duty.

## Family visual grammar

- Tall, broad, top-heavy humanoid silhouette with a thick neck, wide shoulders, heavy jaw, forward lean, and lower tusks rising past the lip.
- Grey-green or ash-grey skin is framed by blood red, black, dark iron, bone white, and readable red or white war paint.
- Boiled leather, fur, riveted iron, bone, and crude steel remain thick, weighty, and practical rather than elegant or finely matched.
- Scars, paint, tusk rings, piercings, skull trophies, spiked pauldrons, and clan totems communicate earned encounter rank without becoming a biological claim.
- Tusk length, muscle mass, posture, and carried trophies escalate together, but every form retains committed heavy motion and exposed recovery as the family combat grammar.

**Escalation axis:** Tusks lengthen and curve higher as muscle, scars, iron, trophies, and command authority accumulate; rising forms turn committed heavy attacks into rhythmic pursuit, formation control, and finally an arena-wide trial of standards.

**This form's visual delta:** Towering and thick as a door, with iron-capped tusks, plate over fur, one greataxe in each hand, and a skull totem rising from a harness across the broad back.

## Combat reading

### Battlefield duty

Plant and rotate a clan front around a skull totem, ordering committed attacks into complementary lanes while guarding the command point with paired greataxes.

### Teaching goal

Teach commander prioritization: lower Orcs lose their coordinated recoveries when the totem falls, but the Warchief's fixed two-axe answer makes a frontal assault on it a deliberate trap.

### Signature mechanic

Totem Turn: the Warchief rotates the skull totem toward one arena quarter, causing Grunts to shoulder-test inward, Warriors to breach across them, and Berserkers to begin Bloodbeat along the painted boundary; the Warchief then locks both greataxes into a slow crossing guard that cannot pivot away from that quarter.

### Telegraph

The gate-sized iron rings on its tusks strike together, the skull totem tips toward a painted quarter, and every nearby Orc turns its marked shoulder or scar lattice along the same boundary.

### Counterplay

Move against the indicated rotation, bait the fixed crossing guard into empty space, then cut the totem lashings from the rear; without it, lower forms resume local tells and no longer cover one another's recoveries.

### Lower-form interaction

The totem assigns lanes to Grunts, Warriors, and Berserkers and shortens their exposed resets only while they face its selected quarter; its loss breaks the formation into independent attacks.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warchief/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warchief/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warchief/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warchief/normal-v1.json` |
| Fire | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warchief/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warchief/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warchief/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warchief/fire-v1.json` |
| Earth | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warchief/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warchief/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warchief/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warchief/earth-v1.json` |
| Wind | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warchief/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warchief/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warchief/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warchief/wind-v1.json` |
| Water | `blocked-on-anchor` | `blocked-on-anchor` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warchief/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warchief/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warchief/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warchief/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
