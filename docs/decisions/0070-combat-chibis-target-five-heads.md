# 0070 — Combat chibis target five anatomical heads

**Status:** Accepted

**Date:** 2026-09-04

## Context

The approved 200-hero one-star roster has paired summon portraits and combat chibis, but most of the
chibis exaggerate the head, arms, hands, torso width, or body mass beyond the corresponding summon
identity. Direct comparison of three different heroes rendered at nominal 4.0, 4.5, and 5.0-head
targets established that the 5.0-head direction best preserves personality while reading as a
stylized combat character rather than a realistic miniature.

Image generation is stochastic. A numeric phrase in a prompt is an art-direction target, not a
guaranteed measurement, so production needs both a canonical target and an explicit review gate.

## Decision

- New standard combat chibis target **5.0 anatomical heads tall** from the top of the skull to the
  soles of the feet.
- One anatomical head is measured from skull crown to chin. Hair, hats, horns, and other silhouette
  extensions do not increase the head unit.
- The selected summon portrait is the sole identity, anatomy, body-mass, wardrobe, palette,
  hairstyle, accessory, and marking authority for regeneration. The earlier chibi is
  comparison-only and must not be supplied as a generation reference.
- The target remains a cinematic semi-realistic painted combat chibi: compact and readable, but not
  baby-like, super-deformed, photoreal, or cel-anime.
- Regenerated images remain versioned candidates. This decision does not approve, promote, or bind
  them to runtime catalogs.

## Consequences

The Heroes team will regenerate all 200 combat chibis from their selected summon anchors using one
shared prompt contract, exact source hashes, collision-safe output paths, and bounded provider use.
The run has no pilot checkpoint or owner-review workflow: it produces the entire structurally
validated candidate set continuously.

The earlier chibis remain immutable evidence. A future exception may deliberately use another body
ratio for a nonhuman or strongly stylized combatant, but it requires an explicit hero-specific
decision rather than accidental model drift.
