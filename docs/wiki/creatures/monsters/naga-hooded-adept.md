# Hooded Adept

Wiki ID: `monster.naga-hooded-adept`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Nagas (family 15) |
| Canonical form ID | `naga-hooded-adept` |
| Tier | T3 — Specialist |
| Primary archetype | Four-Hand Script Specialist (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-03.md) — Hooded Adept |

Source-draft Nagas are treated as a serpentine visual and encounter-production family, not as an accepted people or a universal statement about culture, antiquity, intelligence, religion, guardianship, sacred water, treasure, or forbidden knowledge. Temple imagery supplies authored mechanisms while the packet leaves taxonomy, belief, and personhood unresolved.

## Family visual grammar

- A humanoid torso rises from a long coiled serpent body; the T1–T2 forms have two arms and no hood, while hood and additional arms begin only at T3.
- Emerald, jade, deep teal, gold, bronze, ivory, and jewel-toned scale patterns remain the family palette.
- Scale, gold, gemstone inlay, silk sash, and temple stone remain separate readable materials rather than a seamless magical body.
- Arm bands, gold scale bands, jeweled brow pieces, sacred script, and later hood crests communicate rank.
- Coil direction, weapon-bearing hands, hood angle where present, and exposed scale seams preserve attack and counterplay readability.

**Escalation axis:** Coil length, scale ornament, temple mechanism authority, hood complexity from T3 onward, and hand count grow from a mobile two-armed skirmisher to a sovereign relic court.

**This form's visual delta:** First broad cobra hood, four arms, jeweled scale inlay along the spine, and silk sash create the decisive Specialist pivot.

## Combat reading

### Battlefield duty

Qualitatively pivot the fight by using the first hood and second arm pair to reorder three marked coil segments into a temporary movement rule.

### Teaching goal

Teach that added anatomy changes the mechanic: follow which of four hands owns each glyph, not merely the brighter scale pattern.

### Signature mechanic

Three-Glyph Coil: the upper hands reveal the broad cobra hood and place Start and End glyphs while the lower hands rotate one jeweled spine segment between them; crossing the segments out of order tightens the surrounding coil, but striking the hand holding the middle glyph breaks the rule.

### Telegraph

The first broad hood fans open, four hands separate into upper and lower pairs, and three jeweled scale inlays brighten in a readable sequence.

### Counterplay

Read the hand-owned order, cross Start-middle-End, or interrupt the lower hand carrying the middle glyph before the coil closes.

### Lower-form interaction

Serpentling shots travel from Start and Coilguards hold End; breaking the middle glyph also releases those lower forms from the scripted route.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `candidate-only` | v2 | `assets/enemies/experiments/family-affinity-v1/targets/nagas/naga-hooded-adept/normal/target-v2.json` | `assets/enemies/experiments/family-affinity-v1/assignments/nagas/naga-hooded-adept/normal/assignment-v2.json` | `assets/enemies/experiments/family-affinity-v1/candidates/nagas/naga-hooded-adept/normal-v2.png` | `assets/enemies/experiments/family-affinity-v1/results/nagas/naga-hooded-adept/normal-v2.json` |
| Fire | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/nagas/naga-hooded-adept/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/nagas/naga-hooded-adept/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/nagas/naga-hooded-adept/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/nagas/naga-hooded-adept/fire-v1.json` |
| Earth | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/nagas/naga-hooded-adept/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/nagas/naga-hooded-adept/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/nagas/naga-hooded-adept/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/nagas/naga-hooded-adept/earth-v1.json` |
| Wind | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/nagas/naga-hooded-adept/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/nagas/naga-hooded-adept/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/nagas/naga-hooded-adept/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/nagas/naga-hooded-adept/wind-v1.json` |
| Water | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/nagas/naga-hooded-adept/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/nagas/naga-hooded-adept/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/nagas/naga-hooded-adept/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/nagas/naga-hooded-adept/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
