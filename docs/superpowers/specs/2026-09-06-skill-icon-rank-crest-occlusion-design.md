# Skill icon rank-crest occlusion design

**Status:** Proposed — direction approved; written specification awaiting owner review

**Date:** 2026-09-06

**Owner:** Skills visual production

## Purpose

Prevent skill artwork from appearing through transparent or partially transparent pixels inside a
rarity crest, including the repaired lower point of the S crest, without hardcoded colors,
asset-specific paint patches, or changes to accepted historical geometry and frame evidence.

The result must preserve the accepted frame pixels while making layer ownership explicit: visual
alpha describes how the frame looks, while an independent semantic occlusion mask describes where
skill artwork is forbidden.

## Root cause

The current cleanup compositor derives the artwork opening by flood-filling zero-alpha pixels from
the frame center. That treats frame alpha as both appearance and semantic ownership. This assumption
fails when black-matte extraction produces zero or partial alpha for dark material inside a crest.

The S badge-tip review demonstrates the failure:

- the isolated repaired frame looks complete against a dark preview surface;
- its inner tip contains 27 fully transparent and 435 partially transparent pixels;
- those pixels are connected to or blended with the central opening;
- bright waterfall artwork therefore becomes visible inside the assembled crest.

The existing `geometry-v2.json` medallion authority is also a shared rectangle ending at output row
219. Every v9 rank frame has central crest material on row 219 and no central crest material on row
220, proving that the current mask can clip a provider-rendered lower crest point. Extending that
rectangle downward would create a rectangular artwork void around narrower or pointed crests and is
not acceptable.

## Rejected approaches

### Hardcoded dark-bronze triangle

Drawing a sampled dark triangle beneath the S frame would be deterministic for one exact image but
would bind composition to one rank, position, shape, palette, and revision. It would not solve the
same ambiguity for other frames and would fail when a crest moves or its material changes.

### Alpha or topology inference

Morphological closing, flood-fill heuristics, or alpha thresholds cannot reliably distinguish a
deliberately dark frame detail from a true opening. This is the ambiguity that caused the defect.
Increasing the closing radius would also risk reviving the dark backing artifacts removed by the
outline cleanup.

### Editing geometry v2 in place

`geometry-v2.json` is raw-byte hash authority for existing targets, results, normalization
evidence, and candidates. Editing it would invalidate historical provenance and make earlier output
irreproducible.

## Accepted design

### 1. Add immutable geometry v3

Create append-only `geometry-v3.json`. It retains v2 canvas, center, aperture, outer envelope,
inner-aperture scale, safe zones, runtime sizes, and recognition size unchanged.

It replaces the shared rectangular crest assumption with two rank-keyed maps:

- `rarityCrestEnvelopeByRank` authorizes visible frame material, including the complete decorative
  perimeter and lower point;
- `rarityCrestOcclusionByRank` reserves the solid crest face where artwork must never appear.

Each map contains one normalized polygon for every rank `F`, `E`, `D`, `C`, `B`, `A`, and `S`.
Each pair:

- allows the envelope to cover the complete integrated crest and its ornaments;
- covers the complete solid crest face and lower point with the occlusion polygon;
- requires the occlusion polygon to be wholly contained by the envelope;
- keeps the occlusion inside the decorative perimeter so adjacent artwork is not unnecessarily
  hidden;
- is independent of frame RGBA values;
- uses at least three and at most twenty normalized points;
- must fit within the canvas and the v3 rarity-frame role envelope.

Geometry v2 and its guide remain byte-identical and continue to govern all historical v9 and older
packets.

Generate one provider-space guide per rank,
`references/geometry-guide-v3-<rank>.png`. A future rarity-frame packet binds only its matching rank
guide and the raw v3 geometry hash. These guides are registration authorities, never image content.

### 2. Add a versioned frame-normalization tuple

Add the strict tuple:

- profile: `skill-icon-black-matte-geometry-role-mask-v2`;
- producer: `summonlab-skill-icon-production-v8`;
- geometry: `skill-icon-geometry-v3`;
- role: `rarity-frame` only;
- required rank: the packet's exact `F`–`S` rarity.

The new profile retains v1 black-matte transfer, caBX handling, assigned-sRGB decoding, Lanczos3
resize, transparent-RGB canonicalization, and fixed PNG encoding. Its only image-semantic change is
the v3 rarity-frame role union: the common frame annulus plus that rank's
`rarityCrestEnvelopeByRank` polygon.

The profile fails closed when the rank is absent, differs from the packet, lacks an occlusion
polygon, binds the wrong guide, or uses any v1/v2 geometry authority. No existing profile is
reinterpreted.

### 3. Separate artwork opening from frame alpha

Add the cleanup composition profile `rank-crest-occlusion-v4`. It requires geometry v3 and an exact
rank alongside backing, interior, and frame.

Composition order remains:

1. canonical charcoal backing;
2. skill artwork clipped to the center opening minus the rank's crest-occlusion polygon;
3. canonical rarity frame.

The compositor retains canonical backing beneath the crest-occlusion polygon even where frame alpha
is zero or partial. It does not synthesize a crest color. The frame remains responsible for visible
material and the backing supplies a stable neutral surface beneath intentional gaps and antialiasing.

Outside the explicit crest polygon, the existing center-connected frame opening and v3 enclosed-seam
rules remain unchanged. Detached backing remains transparent. This isolates the correction from the
previously accepted outline cleanup.

### 4. Make inspection semantic

The composite inspector receives the same rank, geometry v3 bytes/hash, and composition profile. It
independently reconstructs the expected composite and requires:

- exact layer hashes and exact composite bytes;
- zero artwork alpha inside the rank crest-occlusion polygon;
- protected crest pixels invariant across empty, bright-white, and saturated-blue interior canaries;
- canonical backing retained only where authorized beneath the crest or in existing enclosed seams;
- no backing-only component outside those authorized regions;
- transparent exterior and unchanged central-aperture behavior;
- no edits to frame pixels.

Reports record the profile, rank, geometry path/hash, selected polygon hash, frame hash, backing
hash, interior hash, composite hash, and the protected-region findings.

## S-rank migration and review

The current V6 badge-tip source and review frame remain append-only, explicitly non-promotable
review evidence. They are not relabeled as an ordinary production execution because the imagegen
source did not originate from a v8 packet and does not satisfy the required provider envelope.

After the v3/v8 contracts and compositor exist:

1. issue a new ordinary S rarity-frame packet on the v8 tuple;
2. produce and persist a complete S frame through the authorized workflow;
3. assemble `Where All Rivers End` with `rank-crest-occlusion-v4`;
4. render full-size and 96-pixel before/after evidence;
5. require owner approval before promotion or whole-catalog adoption.

No other rank is silently regenerated or promoted. The recorded seven-rank boundary audit is used to
prioritize B and C after S, followed by the less visible F, E, D, and A cases. Each rank uses its own
occlusion polygon and review evidence.

## Contract and code boundaries

Implementation changes are limited to:

- the skill-icon geometry, target, assignment, result, and normalization schemas;
- geometry and rank-guide exporters;
- black-matte normalizer dispatch and evidence;
- cleanup interior extraction, composition, and inspection;
- append-only S packet/output/review artifacts;
- production-skill documentation describing the v8 tuple.

Historical targets, assignments, results, candidates, geometry files, guides, reviews, and selected
wiki derivatives remain unchanged.

## Validation strategy

### Geometry and contract tests

- v3 requires exactly seven envelope polygons and seven occlusion polygons and rejects missing,
  extra, out-of-range, non-contained, or otherwise self-inconsistent entries.
- v8 accepts only black-matte profile v2, geometry v3, the matching rank guide, and a rarity frame.
- every mixed old/new tuple fails.
- v1/v2 geometry hashes and all historical v9 evidence remain valid.

### Normalization tests

- provider material in an authorized rank crest point survives normalization below row 219.
- identical material outside the selected rank polygon is removed.
- aperture, exterior, matte thresholds, decoder provenance, and encoder bytes remain unchanged.
- selecting the wrong rank changes no authority silently and fails before persistence.

### Composition tests

- a frame with transparent and partial-alpha pixels inside its crest produces identical protected
  pixels over transparent, bright-white, and saturated-blue interiors.
- artwork remains visible immediately outside the rank polygon.
- canonical backing is retained beneath the crest but not in exterior-connected or detached gaps.
- existing one- and two-pixel enclosed-seam behavior remains unchanged.
- the assembled S point has no blue artwork leakage at full size or 96 pixels.

### Repository verification

- focused normalization, persistence, composition, inspection, exporter, and promotion tests pass;
- the skill-icon production TypeScript project passes strict typechecking;
- render and check commands reproduce byte-identical review outputs;
- format and diff checks pass;
- the current branch is committed and pushed with a clean worktree.

## Failure behavior

- Missing or mismatched v3 rank authority fails before image generation or persistence.
- A provider frame outside its rank envelope produces a terminal failed/revise result; the mask is
  never widened ad hoc.
- A composite that varies inside the protected crest across canary interiors is rejected.
- Failed S production leaves V6 review evidence and all active wiki assets unchanged.
- Owner rejection does not authorize reusing the review source as production provenance.

## Definition of done

- Geometry v3 and all seven rank guides are immutable, hash-bound authorities.
- The profile-v2/producer-v8 tuple is enforced end to end.
- Artwork and frame alpha have independent semantic responsibilities.
- The S crest point remains visually complete without artwork leakage over contrasting interiors.
- The accepted outline cleanup and detached-backing behavior remain unchanged.
- No historical packet, result, candidate, or geometry authority is invalidated.
- S has explicit owner-reviewed evidence before any promotion or broader rank rollout.
