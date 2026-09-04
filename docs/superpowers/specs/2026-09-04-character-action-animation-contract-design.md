# Character Action and Animation Contract Design

**Status:** Approved in conversation; awaiting review of this written specification

**Date:** 2026-09-04

## Purpose

Separate motion design from raster animation production so a Summonlab character clip cannot become
five attractive but mechanically unrelated poses. Classical actions with an established motion
sequence should use a saved reference directly. Character-specific or otherwise undefined actions
must first receive an explicit five-beat action contract, which the animation workflow then executes
without redesigning the action during image generation.

The first proof is a corrected five-frame run for Toma. His current candidate leaves the same leg on
the ground through four of five frames, so it fails as a run cycle even though the individual poses
are visually plausible.

## Approved decisions

- Create a repository skill named `summonlab-character-action-creation`.
- Use “character” rather than “hero” so the contract also applies to enemies, bosses, quadrupeds, and
  other actors.
- Keep action definition and animation production as separate responsibilities.
- Treat five frames as the current project default and required format for newly defined actions.
- Let known actions use saved, explicit motion contracts without invoking action creation.
- Require undefined or character-specific actions to pass through action creation before animation.
- Add classical human running as a saved reference with objective foot-support rules.
- Correct Toma by producing a new immutable candidate version rather than overwriting v3.

## Skill boundary

```text
requested clip
  -> classify action
       -> known action: load its saved motion contract
       -> undefined action: summonlab-character-action-creation
                              -> approved five-beat action contract
  -> summonlab-character-animations
  -> raster candidate, assembly, validation, provenance
```

### `summonlab-character-action-creation`

This skill defines what a character does. It does not generate sprites, choose image tooling, edit
atlases, or declare art approved.

Its output is one action contract containing:

- character and action name;
- gameplay intent and readable action verb;
- motion sentence;
- starting pose and prerequisite state;
- exactly five ordered beats;
- acting limb, weapon, or delivery mechanism;
- target direction and contact beat;
- foot, paw, hand, or body-support contacts;
- center-of-mass progression;
- equipment and identity constraints;
- loop seam or terminal state;
- explicitly forbidden alternative actions.

The skill presents this compact contract for owner approval before animation production begins. Once
approved, the five beats are input authority for the animation skill. The animation workflow may
clarify visual execution but may not substitute a different action, acting limb, contact, or ending.

No global action database is introduced in this slice. A newly designed action is preserved with the
asset's production provenance. A future action may be promoted into the known-action reference only
after it is deliberately accepted as reusable.

### `summonlab-character-animations`

This skill defines how an approved action becomes a coherent clip. Its intake gains a required action
classification:

1. If the action is known and has a saved contract, cite that contract and copy its beats into the
   clip brief.
2. If the action is undefined, character-specific, or mechanically ambiguous, stop and invoke
   `summonlab-character-action-creation` first.
3. Do not use image generation to discover the action by producing pose variations.

The existing clip brief gains the action authority and support/contact sequence. Review must compare
the resulting strip to both the approved beats and the visual reference before runtime playback.

## Known-action reference

Add an original repository-owned reference for a classical five-frame human run. It will be a
deterministic labeled diagram rather than a copied photograph or third-party game asset. The diagram
shows the ground line, planted foot, travel direction, center-of-mass arc, and loop seam for:

1. **Contact A:** left foot reaches and accepts weight; right leg trails.
2. **Compression A:** left knee loads and the center of mass reaches its low point.
3. **Airborne passing:** neither foot is planted; right knee passes forward.
4. **Contact B:** right foot lands ahead in a silhouette clearly distinct from frame 1.
5. **Recovery B:** weight moves over the right foot while the left leg advances toward frame 1.

For this five-frame form, a run candidate fails when:

- the same foot is planted in more than two consecutive frames;
- frame 3 does not read as an airborne or unambiguously transitioning passing pose;
- frame 4 does not visibly switch support to the opposite foot;
- frames 1 and 4 use substantially the same leg silhouette;
- the apparent cycle was produced by reordering or duplicating poses;
- the loop seam does not carry recovery B naturally into contact A.

The reference expresses motion mechanics, not Toma's body proportions or costume. Heavy characters
may shorten the stride and airborne interval, but they may not remove the support-leg alternation.

## Toma v4 correction

Toma's v4 work is limited to the run row. Identity, three-quarter camera, shield side, mace side,
scale, lighting, cell geometry, idle, attack, hit, and down clips remain locked to the accepted source
unless a tool makes exact preservation impossible, in which case deterministic row replacement is
used.

The v4 run follows the known classical contract:

```text
left contact -> left compression -> airborne passing -> right contact -> right recovery -> loop
```

The shield and mace lag the torso consistently without changing hands or hiding both legs. Toma's
weight reads through a shorter stride, modest vertical lift, and delayed equipment motion rather than
through a one-legged shuffle. The result remains a review candidate until owner acceptance.

## Repository changes

- Add `skills/summonlab-character-action-creation/SKILL.md` and its agent metadata.
- Add a focused action-contract reference under that skill.
- Add the classical running diagram and machine-readable textual contact sequence under
  `skills/summonlab-character-animations/references/`.
- Revise `summonlab-character-animations` to route known and undefined actions correctly.
- Add a new Toma source, manifest, runtime atlas, metadata, and provenance revision without modifying
  v1-v3.
- Point the combat study at v4 only after the new artifact passes build and validation.

## Validation

Skill validation must confirm required frontmatter, trigger clarity, the known/undefined routing rule,
the five-beat action contract, and valid relative reference links. A scenario test should demonstrate
that an undefined attack routes to action creation while classical running does not.

Toma validation must include:

- source-resolution contact-sheet inspection against the five support states;
- explicit support labels `left, left, none, right, right` in production evidence;
- rejection of duplicate/reordered run cells;
- builder and manifest validation;
- at least three loops at the declared gameplay frame rate;
- playback from idle into run and from run into the next combat state;
- gameplay-scale inspection in 2D, 2.5D, and 2.5D V2;
- repository type, format, focused test, and artifact-control checks.

## Non-goals

- Create a universal choreography database or finalize every possible action.
- Change combat simulation semantics, attack timing, target selection, or navigation.
- Reanimate Toma's other clips or the other characters in this slice.
- Increase the runtime frame count beyond the current five-frame contract.
- Promote generated raster art to approved status without owner review.

## Acceptance criteria

- An agent can determine from the animation skill whether it needs an action-definition prerequisite.
- An undefined action produces one approved, mechanically complete five-beat contract before pixels.
- A known classical run has a durable visual and textual reference with explicit support alternation.
- Toma visibly lands on both feet across one loop and never plants either foot for more than two
  consecutive frames.
- Toma retains his established identity, equipment handedness, camera, registration, and gameplay
  scale.
- Historical source and runtime versions remain immutable and all new evidence is versioned and
  reproducible.
