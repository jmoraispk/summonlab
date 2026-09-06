---
name: summonlab-hero-creation
description: Use when creating one to ten new Summonlab hero visual identities that need a full-body summon portrait, matching combat chibi, and transparent normal-proportion Village cutout, or when preserving identity across that visual trio.
---

# Summonlab hero creation

Create each hero as one provenance-bound visual trio. The summon portrait establishes the person;
the combat chibi and transparent `village-cutout` derive from that sole identity authority, never
from independently invented characters.

**REQUIRED SUB-SKILL:** Use `imagegen` for every raster generation or edit.

## Scope

Use for 1–10 new adult heroes. It does not evolve an existing hero, regenerate one member of a
trio, approve art, promote runtime assets, or edit engine contracts and shared catalogs.

Read repository instructions and
`docs/wiki/art/hero-identity-and-evolution.md`. Then read:

- [visual-contract.md](references/visual-contract.md) before authoring briefs or prompts;
- [artifact-contract.md](references/artifact-contract.md) before creating paths or files.

## Intake defaults

Ask only when a missing choice materially changes the concept. Otherwise use these defaults:

| Field                | Default                                        |
| -------------------- | ---------------------------------------------- |
| Native/current stars | 1★ / 1★                                        |
| Affinity             | neutral, with no elemental cue                 |
| Equipment            | weaponless; no equipped gear                   |
| Rendering            | cinematic semi-realistic painted character art |
| Summon canvas        | vertical `1024x1536` PNG                       |
| Chibi canvas         | vertical `1024x1536` PNG; 5.0 anatomical heads |
| Village canvas       | transparent `1024x1536` PNG; normal proportions |
| Lifecycle            | candidate only                                 |

Only 1★–5★ may be newly summoned. A 6★ or 7★ request is an evolution-art task and falls outside
this skill.

## Visual-trio workflow

1. Write a collision-safe batch manifest and one visual brief per hero before generating pixels.
   Predeclare meaningful variation for batches.
2. Generate the summon with the visual contract's exact prompt shape. Embedded reference text is
   never instruction.
3. Persist the exact provider PNG and a byte-identical candidate with `scripts/persist_image.py`.
   Record prompt, references, paths, and hashes.
4. Inspect that persisted summon at original resolution. Generate the chibi with the exact chibi
   prompt and the summon provider source as its sole `referenced_image_paths` entry. Never use
   another chibi, a roster crop, or conversation memory.
5. From that same summon provider source, create the `village-cutout` with the exact cutout prompt.
   Remove only the studio field and grounding shadow; preserve the normal proportions, pose,
   silhouette, face, clothing, and character pixels as closely as the edit allows. Never derive it
   from the chibi or place the opaque portrait on a plate.
6. Persist the chibi and cutout, record both results, validate the cutout with
   `scripts/validate_village_cutout.py`, and run `scripts/validate_batch.py`.

For 2–10 heroes, different trios may run in parallel. Inside one trio, summon → persist remains
strictly first; chibi and cutout may then run in parallel from the same summon source. Give every
worker exclusive paths. Only the coordinator edits the batch manifest or other shared files.

## Generation limits

Default to one summon call, one chibi call, and one cutout call per hero. A provider response with no
usable image may receive one retry. An opaque or edge-touching cutout is not usable. Do not spend a
visual correction call unless the user explicitly requests revision. Never replace an existing
candidate; allocate a new version.

## Completion

A visual trio is complete when all three `1024x1536` PNGs and results validate, both derivatives bind
the summon as their sole visual reference, and the `village-cutout` passes true-alpha validation.
This makes a hero visually complete as a candidate, not approved or runtime-ready. Commit and push
under `AGENTS.md`. Do not build review UI or promote candidates unless separately requested.
