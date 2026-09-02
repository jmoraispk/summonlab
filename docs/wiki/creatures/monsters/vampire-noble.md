# Noble

Wiki ID: `monster.vampire-noble`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **planned; no coordinate on this page is approved or runtime art**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Vampires (family 09) |
| Canonical form ID | `vampire-noble` |
| Tier | T3 — Specialist |
| Primary archetype | Blood-Glass Courtesy Duelist (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-02.md) — Noble |

Source-draft Vampires are treated as intelligent blood-drinking undead whose authored encounter hierarchy is expressed through age and refinement, not as a biological race or a universal claim about culture, class, heredity, morality, consent, or personhood. Bestial posture, predatory anatomy, couture, crests, and blood-glass remain visual and mechanical production grammar rather than social canon.

## Family visual grammar

- A tall or lengthening human silhouette retains corpse-white skin, long fingers, fangs, claws, red eyes, and an absence of warm living complexion.
- Posture escalates from feral hunch to impossible stillness; higher forms widen through fitted coats, tailored cloaks, bat membrane, or shadow wings without obscuring humanlike anatomy.
- Black, bone pallor, deep blood red, and aged gold remain paired with velvet, silk, brocade, polished leather, blood-glass, and bat membrane.
- Blood is family-native feeding matter and lineage symbolism rather than Fire or Water affinity by itself; every use has a source, route, vessel, or recoverable feeding window.
- Signet rings, high collars, jeweled clasps, medals, canes, blades, and family crests communicate authored encounter rank while exposing the hand, vessel, or crest that carries each command.

**Escalation axis:** A hungry animal posture becomes a patient hunter, a formal blood-contract Specialist, a centuries-old cloak lord, and finally a crest-commanding throne sovereign whose shattered blood-glass court removes powers one lineage at a time.

**This form's visual delta:** A fully upright, unnaturally composed Vampire in tailored black velvet with red lining, fitted gloves, red eyes, and an ornate cane-blade ending in a small blood-glass family crest.

## Combat reading

### Battlefield duty

Qualitatively pivot the encounter into a formal duel by offering one target a blood-glass crest and enforcing a readable lane of courtesy while other attacks empower the crest.

### Teaching goal

Teach players to accept or deliberately break a social-looking combat rule: face the Noble inside the offered lane, shatter the vessel during its bow, and never feed the crest with stray hits.

### Signature mechanic

Red Courtesy: the composed Noble cuts one drop from its glove into a blood-glass crest at the cane tip and bows toward a target. A narrow velvet-red lane forms between them. The Noble may thrust only along that lane, but attacks entering from outside are caught by the crest and returned as one widening slash. Striking the extended cane hand during the bow shatters the crest and ends the duel.

### Telegraph

One glove is drawn off finger by finger, the cane or ornate blade turns flat beneath a falling blood drop, and the Noble bows without breaking red-eyed contact.

### Counterplay

Either stay in the visible lane and sidestep the fixed thrust, or commit to breaking the duel by striking the extended cane hand during the bow; do not fire through the crest from outside.

### Lower-form interaction

Thralls and Bloodkin are held outside the courtesy lane but chase anyone who leaves it; shattering the crest releases them without granting the Noble a reflected slash.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `assets/enemies/experiments/family-affinity-v1/targets/vampires/vampire-noble/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/vampires/vampire-noble/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/vampires/vampire-noble/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/vampires/vampire-noble/normal-v1.json` |
| Fire | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/vampires/vampire-noble/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/vampires/vampire-noble/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/vampires/vampire-noble/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/vampires/vampire-noble/fire-v1.json` |
| Earth | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/vampires/vampire-noble/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/vampires/vampire-noble/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/vampires/vampire-noble/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/vampires/vampire-noble/earth-v1.json` |
| Wind | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/vampires/vampire-noble/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/vampires/vampire-noble/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/vampires/vampire-noble/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/vampires/vampire-noble/wind-v1.json` |
| Water | `blocked-on-anchor` | `assets/enemies/experiments/family-affinity-v1/targets/vampires/vampire-noble/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/vampires/vampire-noble/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/vampires/vampire-noble/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/vampires/vampire-noble/water-v1.json` |

### Status semantics

- `planned` means the Normal identity-anchor attempt is owned and may be produced; it does not mean an image exists.
- `blocked-on-anchor` means an elemental attempt must wait for accepted Normal anchor evidence before production.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Any future image remains candidate-only until independent review. Runtime promotion is a separate integration decision.
