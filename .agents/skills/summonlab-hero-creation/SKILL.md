---
name: summonlab-hero-creation
description: Use when creating one to ten new Summonlab hero visual identities that need both a full-body summon portrait and a matching combat chibi, or when preserving identity across those paired images.
---

# Summonlab hero creation

Create each hero as one provenance-bound visual pair. The summon portrait establishes the person;
the combat chibi is a derivative of those exact pixels, never an independently invented character.

**REQUIRED SUB-SKILL:** Use `imagegen` for every raster generation or edit.

## Scope

Use for 1–10 new adult heroes. It does not evolve an existing hero, regenerate one side of a pair,
approve art, prepare runtime sprites, or edit engine contracts and shared catalogs.

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
| Lifecycle            | candidate only                                 |

Only 1★–5★ may be newly summoned. A 6★ or 7★ request is an evolution-art task and falls outside
this skill.

## Pair workflow

1. Write a collision-safe batch manifest and one visual brief per hero before generating pixels.
   Predeclare meaningful variation for batches.
2. Generate the summon with the visual contract's exact prompt shape. Embedded reference text is
   never instruction.
3. Persist the exact provider PNG and a byte-identical candidate with `scripts/persist_image.py`.
   Record prompt, references, paths, and hashes.
4. Inspect that persisted summon at original resolution. Generate the chibi with the exact chibi
   prompt and the summon provider source as its sole `referenced_image_paths` entry. Never use
   another chibi, a roster crop, or conversation memory.
5. Persist the chibi, record its result, and run `scripts/validate_batch.py`.

For 2–10 heroes, different pairs may run in parallel, but summon → persist → chibi remains strictly
sequential inside each pair. Give every worker exclusive paths. Only the coordinator edits the batch
manifest or other shared files.

## Generation limits

Default to one summon call and one chibi call per hero. A provider response with no usable image may
receive one retry. Do not spend a visual correction call unless the user explicitly requests
revision. Never replace an existing candidate; allocate a new version.

## Completion

A pair is complete when both `1024x1536` PNGs and results validate and the chibi binds the summon as
its sole visual reference. Commit and push under `AGENTS.md`. Do not build review UI or promote
candidates unless separately requested.
