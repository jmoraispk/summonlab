# 0069 — Skill icons are concrete-first at normal display size

**Status:** Accepted

**Date:** 2026-09-03

## Context

An abstract precision-cut experiment made the S-rank `One Blade, One World` concept clearer, but
made lower-rarity Blade skills feel detached from the weapon and action they represent. The existing
production documents also treated a 96-pixel thumbnail as a mandatory recognition gate even though
the intended interface can present skill icons at approximately 300–400 pixels.

## Decision

- Skill artwork is concrete-first. From F through A, an action retains the weapon, body, element,
  magical operation, craft tool, material, ingredient, creature, document, or result that performs
  or embodies it.
- Blade cut motifs from F through A show a visible blade making the cut. Abstract slashes, fractures,
  and displaced planes may support the composition but cannot replace the blade.
- An S skill may use a primarily abstract composition when it communicates the named pinnacle outcome
  more clearly. The exception is owner-approved per skill and must retain recognizable motif-family
  ancestry; S does not automatically mean abstract.
- Every rarity frame permanently includes its own crest and F–S letter.
- The current frame-shape authority is the owner-selected seven-empty-frame RGB reference with
  SHA-256 `4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266`. Its checkerboard is
  depicted rather than transparent, so implementation reconstructs the frames against shared
  regular geometry instead of promoting enlarged crops.
- Retained skill-art and frame masters remain 1024×1024. Required owner review uses the full master
  and a 384×384 composite representing the intended 300–400-pixel display range.
- A 96-pixel thumbnail is optional diagnostic evidence for new skill art, never an approval gate.
  Historical 96-pixel packets and evidence remain immutable.
- Multi-skill families establish their grammar with calibration plates, then receive one independent
  full-resolution generation per skill. Calibration plates are never cropped into masters.

## Consequences

All 456 current skills can use the existing complete 124-family motif map without sacrificing
individual resolution. Visual specifications must identify a concrete anchor and may declare an
`abstract-pinnacle` mode only for an explicitly approved S skill. New review tooling needs an
additive 384-pixel profile rather than rewriting historical 96-pixel evidence. Production remains
gated by approval of the reset frame authority, provider normalization, and the three-domain pilot
before the full generation budget is released.
