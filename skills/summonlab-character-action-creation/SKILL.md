---
name: summonlab-character-action-creation
description: Use when a Summonlab character action does not already have an explicit known motion contract and its gameplay intent, acting limb or delivery mechanism, five ordered beats, contacts, or ending must be defined before animation production.
---

# Summonlab character action creation

Define one playable action before animation production. The approved action brief is authority for
the later clip; it is not an image prompt or a pose exploration exercise.

## Workflow

1. Inspect the existing mechanics, character identity/equipment authority, prerequisite state, and
   requested gameplay outcome. Reuse a saved known motion contract when one exists.
2. Propose exactly one coherent five-beat action brief using
   [action-contract.md](references/action-contract.md). Resolve one action verb, acting limb or
   delivery mechanism, contact sequence, and ending; do not offer incompatible actions as frames.
3. Obtain owner approval for that brief. Do not generate raster frames or use pose variations to
   discover the action before approval.
4. Hand the approved brief to `summonlab-character-animations`. That skill may execute its visual
   presentation, but may not redesign the action, contact, acting limb, or terminal state.

## Boundary

This skill defines motion intent and its evidence. It does not generate sprites, edit atlases, choose
image tooling, or approve artwork.
