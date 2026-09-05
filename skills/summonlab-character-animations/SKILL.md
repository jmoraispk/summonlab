---
name: summonlab-character-animations
description: Use when adding or revising a Summonlab character spritesheet clip, especially when an idle, run cycle, quadruped gait, attack, hit reaction, or defeat looks attractive frame-by-frame but moves incorrectly in sequence.
metadata:
  short-description: Author coherent character animation clips
---

# Summonlab character animations

Produce one coherent animation clip for one existing character. Continuity is the product: attractive
individual poses do not compensate for a broken sequence.

**REQUIRED SUB-SKILL:** Use `imagegen` when generating or editing raster frames.

Read [clip-contracts.md](references/clip-contracts.md) before planning idle, locomotion, attack, hit,
or defeat frames.

For a known action, also read [known-actions.md](references/known-actions.md). Its saved beats are
motion authority, not optional pose inspiration.

## Clip brief

Resolve the repository contract and write this brief before pixels:

```text
Character / clip:
Action authority:
Gameplay intent:
Starting pose / prerequisite state:
Motion sentence:
Frame beats (left to right):
Acting limb / delivery:
Target direction / contact beat:
Support/contact sequence:
Contacts / center of mass:
Loop seam or terminal state:
Accepted source path / version / SHA-256 / approval record:
Equipment / identity constraints:
Camera / anchor / scale locks:
Directions / mirror policy / source regions:
Allowed effects:
Forbidden alternatives:
Forbidden visual changes:
Runtime contract:
Output paths and next version:
```

Bind the canonical identity reference and exact accepted source; never infer authority from a filename
or timestamp. Before image generation, follow this routing contract:

```action-routing
known-referenced.authority=saved-known-action
known-referenced.action-creation=bypass
known-referenced.pixel-work=allow-after-clip-brief
undefined-ambiguous.authority=summonlab-character-action-creation
undefined-ambiguous.action-creation=invoke
undefined-ambiguous.pixel-work=refuse-until-approved-brief
```

An undefined action must route through action creation before pixels. Do not use image generation or
pose variations to discover an action. Copy every approved contract field into the clip brief,
including its starting state, five beats, contacts, acting limb, target direction/contact beat,
identity/equipment constraints, and ending, without redesigning them.

One attack clip gets one action verb and one delivery mechanism. A slash row cannot also contain a
pounce or ground slam. A defeat clip progresses monotonically toward rest. A loop must explain the
last-to-first transition as carefully as every internal transition.

## Workflow

1. Inspect the canonical reference, accepted source, approval record, runtime atlas, manifest, builder,
   and provenance. Compare each direction's current frames in sequence before proposing a correction.
2. Plan every frame using the relevant clip contract. Track the same limbs, joints, equipment, center
   of mass, contact points, and secondary motion from frame to frame.
3. Generate or edit each manifest-required direction of the clip as one temporal unit with the same
   references. Change no unrelated clip. An explicitly scoped single-direction result cannot replace
   a complete multidirectional clip. Preserve the accepted source immutably and write a new version.
   Prefer replacement strips plus deterministic sheet assembly when the tooling supports it.
4. Do not claim pixel-perfect masking or untouched pixels unless the tool guarantees it. Otherwise
   compare every supposedly unchanged region against the accepted source.
5. Review each direction strip side-by-side at source resolution against every acceptance gate in the
   reference. Reject any failed gate; prompt intent is not evidence.
6. Run the repository's builder and validators. Inspect the clip at gameplay scale and real FPS,
   including the loop seam or terminal hold. Play it from its preceding state and verify that the
   runtime state machine reaches every authored beat. Playback state for a shared atlas must remain
   instance-local so intentional phase offsets are possible.
7. Record references, source, exact prompt, generation/edit mode, hashes, runtime outputs, builder and
   validator results, visual result, and remaining limitations in provenance. Report `candidate`,
   never `approved`, until the owner accepts it.

## Correction rule

Make one targeted correction for a local defect while preserving passing traits. Regenerate the clip
when its temporal concept is wrong across multiple frames; repeated cell-by-cell patching usually
creates more identity and registration drift. Never silently replace an accepted source or broaden a
one-clip request into a whole animation pack.

## Common mistakes

- Calling five variations of the same leading leg a run cycle.
- Letting pose diversity substitute for anatomical progression.
- Generating cells independently so hands, gear, scale, or camera drift.
- Mixing attack alternatives in one row.
- Adding damage props during defeat without an authored entry and resting path.
- Reviewing only the sheet and skipping playback at the declared FPS.
