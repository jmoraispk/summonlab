# Warrior

Wiki ID: `monster.orc-warrior`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **planned; no coordinate on this page is approved or runtime art**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Orcs (family 02) |
| Canonical form ID | `orc-warrior` |
| Tier | T2 — Soldier |
| Primary archetype | Warpaint Breach Soldier (Soldier) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Warrior |

Source-draft Orcs are treated as a visual and encounter-production family, not as proof of universal culture, allegiance, morality, or personhood. This packet preserves their top-heavy anatomy, tusks, battle marks, heavy equipment, and visible status language while assigning each hostile form a specific authored combat duty.

## Family visual grammar

- Tall, broad, top-heavy humanoid silhouette with a thick neck, wide shoulders, heavy jaw, forward lean, and lower tusks rising past the lip.
- Grey-green or ash-grey skin is framed by blood red, black, dark iron, bone white, and readable red or white war paint.
- Boiled leather, fur, riveted iron, bone, and crude steel remain thick, weighty, and practical rather than elegant or finely matched.
- Scars, paint, tusk rings, piercings, skull trophies, spiked pauldrons, and clan totems communicate earned encounter rank without becoming a biological claim.
- Tusk length, muscle mass, posture, and carried trophies escalate together, but every form retains committed heavy motion and exposed recovery as the family combat grammar.

**Escalation axis:** Tusks lengthen and curve higher as muscle, scars, iron, trophies, and command authority accumulate; rising forms turn committed heavy attacks into rhythmic pursuit, formation control, and finally an arena-wide trial of standards.

**This form's visual delta:** Broad-shouldered with red war paint across the eyes, iron-banded leather, a heavy axe, first ritual scars, and tusks that rise clearly above the lower lip.

## Combat reading

### Battlefield duty

Maintain reliable line pressure by using an iron-banded shoulder check to open a guard, then occupying the breach with a controlled heavy-axe follow-through.

### Teaching goal

Teach players to read paint and stance as a two-beat sequence: the red eye-band signals the advancing shoulder, while the first scars and axe angle reveal which side will be exposed afterward.

### Signature mechanic

Red-Line Breach: the Warrior smears fresh paint down one axe cheek, checks forward behind iron-banded leather, then sweeps toward the painted side; the second beat occurs only if the shoulder makes contact.

### Telegraph

It drags two fingers through the red band across its eyes, marks one axe cheek, and turns the matching shoulder forward.

### Counterplay

Dodge to the unpainted side or stop the shoulder before contact; either response cancels the sweep and exposes the Warrior's underarm while the heavy axe resets.

### Lower-form interaction

A Warrior can stop beside an overextended Grunt and use the Grunt's spear line as the edge of its breach, but separating their lanes prevents the paired shove-and-sweep.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/normal-v1.json` |
| Fire | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/fire-v1.json` |
| Earth | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/earth-v1.json` |
| Wind | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/wind-v1.json` |
| Water | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-warrior/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-warrior/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/orcs/orc-warrior/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/orcs/orc-warrior/water-v1.json` |

### Status semantics

- `planned` means the Normal identity-anchor attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means an elemental attempt must wait for accepted Normal anchor evidence before production.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Any future image remains candidate-only until independent review. Runtime promotion is a separate integration decision.
