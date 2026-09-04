# Scrag

Wiki ID: `monster.troll-scrag`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only. Candidate and review evidence only; no coordinate on this page is runtime art.**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | Trolls (family 04) |
| Canonical form ID | `troll-scrag` |
| Tier | T1 — Initiate |
| Primary archetype | Open-Wound Rebounder (Initiate) |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](../monster-races/generator-bestiary-01.md) — Scrag |

Source-draft Trolls are treated as a regenerative body-horror production family, not as a claim that all cave, bridge, or bog dwellers share this physiology or hostility. The packet preserves their stooped long-armed anatomy, wet rubbery hide, visible mishealing, embedded debris, and accumulated scar history while giving each hostile form a bounded encounter role.

## Family visual grammar

- Tall, stooped, potbellied humanoid silhouette with a small head on a thick neck and disproportionately long arms hanging past the knees.
- Bog green, liver-brown, sallow grey, bruise purple, and wet glistening highlights keep living hide distinct from mud and scavenged rags.
- Rubbery skin, scar tissue, bark-hard callus, mud, rope, and half-swallowed equipment remain visibly bodily rather than worn as deliberate finery.
- Healed-over piercings, embedded bones, lodged weapons, misplaced limbs, stray jaws, and layered scars record prior injury as readable construction history.
- Escalation adds accumulated misregrowth rather than simple size: open gashes become knots, alternate organs, defensive scar architecture, and finally a walking archive of incompatible healing.

**Escalation axis:** Regeneration becomes increasingly visible and strategically wrong, progressing from one unstable wound cycle to lodged-injury pressure, player-steerable mutation, shed scar terrain, and a Sovereign that replays and produces its whole wound history.

**This form's visual delta:** Gangly, warty, and mud-caked with a small head, long bare arms, scavenged rags, and several half-healing gashes that never all close at once.

## Combat reading

### Battlefield duty

Probe close space with long-arm swipes while one visibly open gash cycles between collapse and rapid regrowth, creating a simple interrupt-or-withdraw decision.

### Teaching goal

Teach the family's foundational regeneration rule: the dangerous recovery is announced by a pale wound bud, and striking that bud matters more than trading into already healed mass.

### Signature mechanic

Bad Closure: after a committed swipe, one half-healing gash contracts into a pale bud that will restore the arm's next attack and seal some damage; interruption at the bud stops the closure and makes the arm hang slack for one cycle.

### Telegraph

The mud-caked Scrag hunches over one always-open gash, whose rim pales and draws inward while the long attacking hand goes limp.

### Counterplay

Step outside the preceding swipe, then strike the pale bud before the gash seals; missing that window lets the Scrag rebound immediately with the restored arm.

### Lower-form interaction

Not applicable for this form.

## Five-coordinate candidate-production matrix

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | `planned` | `approved-review` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scrag/normal/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scrag/normal/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scrag/normal-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scrag/normal-v1.json` |
| Fire | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scrag/fire/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scrag/fire/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scrag/fire-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scrag/fire-v1.json` |
| Earth | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scrag/earth/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scrag/earth/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scrag/earth-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scrag/earth-v1.json` |
| Wind | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scrag/wind/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scrag/wind/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scrag/wind-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scrag/wind-v1.json` |
| Water | `planned` | `candidate-only` | v1 | `assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-scrag/water/target-v1.json` | `assets/enemies/experiments/family-affinity-v1/assignments/trolls/troll-scrag/water/assignment-v1.json` | `assets/enemies/experiments/family-affinity-v1/candidates/trolls/troll-scrag/water-v1.png` | `assets/enemies/experiments/family-affinity-v1/results/trolls/troll-scrag/water-v1.json` |

### Status semantics

- `planned` means the active attempt is owned and may be produced; it does not mean an image exists.
- `planned-provisional-anchor` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- `blocked-on-anchor` means the active attempt must wait for accepted Normal anchor evidence before production.
- `candidate-only` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- `approved-review` means the immutable review evidence accepted the candidate; it is not runtime art.
- `revision-required` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
