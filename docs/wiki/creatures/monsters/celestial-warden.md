# Warden

Wiki ID: `monster.celestial-warden`

[← Celestials family](families/celestials.md) · [Monster bestiary](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: candidate-only; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Celestials (family 12) |
| Canonical form ID | `celestial-warden` |
| Tier | T3 — Specialist |
| Primary archetype | Four-Wing Axis Adjudicator (Specialist) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-02.md) — Warden |

Source-draft Celestials are treated as winged beings manifested through light and geometric order for authored encounters, not as a biological people or a universal claim about religion, holiness, goodness, authority, moral worth, personhood, or cosmic law. Their light, sunlight colors, halos, and luminous bodies are family-native non-affinity materials and symbols; elemental variants require distinct construction beyond radiance.

## Family context

Shared visual constants and the complete T1–T5 comparison live on the [Celestials family page](families/celestials.md).

**Escalation axis:** A two-wing Messenger draws one line, a Guardian braces it, a four-wing Warden rotates intersecting axes, a six-wing Archon composes those geometries, and an orrery Seraph commands and sheds entire ordered rings as the arena simplifies.

**This form's visual delta:** A composed four-winged humanoid in ornate gold armor, with upper and lower feather pairs, two independently rotating halo rings, and sacred script drifting in ordered bands around both arms.

## Combat reading

### Battlefield duty

Qualitatively pivot the floor into intersecting-axis control by rotating two halo rings with separate wing pairs, creating one forbidden crossing and one deliberately safe quadrant.

### Teaching goal

Teach players to read coupled geometry: match each wing pair to its ring, enter the quadrant where scripts disagree, and strike the stalled bearing before the axes realign.

### Signature mechanic

Double Injunction: the upper wing pair rotates the outer halo ring and a line of script clockwise; the lower pair rotates the inner ring counterclockwise. Their projected axes sweep the arena, and where matching script meets becomes a damaging lock. Where unlike glyphs cross, both rings stall and reveal the central gold bearing as a safe attack window.

### Telegraph

Four wings separate into upper and lower pairs, two halo rings turn in opposite directions, and script drifts from the arms to mark both projected axes before they move.

### Counterplay

Track unlike glyphs rather than brightness, move into their crossing, and strike the exposed central bearing while both wing pairs pause; staying between matching glyphs triggers the lock.

### Lower-form interaction

Messenger lines and Guardian diameters can be assigned to one rotating axis, but entering the unlike-glyph quadrant interrupts those lower formations with the Warden's stalled rings.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `candidate-only` | v2 | `assets/enemies/experiments/family-affinity-v1/targets/celestials/celestial-warden/normal/target-v2.json` | `assets/enemies/experiments/family-affinity-v1/assignments/celestials/celestial-warden/normal/assignment-v2.json` | `assets/enemies/experiments/family-affinity-v1/candidates/celestials/celestial-warden/normal-v2.png` | `assets/enemies/experiments/family-affinity-v1/results/celestials/celestial-warden/normal-v2.json` |
| Fire | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/celestials/celestial-warden/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/celestials/celestial-warden/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/celestials/celestial-warden/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/celestials/celestial-warden/fire-v1.json` |
| Earth | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/celestials/celestial-warden/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/celestials/celestial-warden/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/celestials/celestial-warden/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/celestials/celestial-warden/earth-v1.json` |
| Wind | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/celestials/celestial-warden/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/celestials/celestial-warden/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/celestials/celestial-warden/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/celestials/celestial-warden/wind-v1.json` |
| Water | `planned-provisional-anchor` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/celestials/celestial-warden/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/celestials/celestial-warden/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/celestials/celestial-warden/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/celestials/celestial-warden/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
