# Skill Icon Inner-Frame Acceptance Design

## Context

The V10 audit found 23 clear skill icons whose generated artwork contained a baked inner frame and
five borderline icons that were intentionally deferred. V11 regenerated the 23 clear failures as
frameless artwork. V12 retained those exact accepted provider sources, centered each at 90% scale,
verified full aperture coverage, and applied the complete canonical rarity frame as the final layer.
The owner approved the V12 appearance on 2026-09-06 and asked to lock it in.

The V12 candidates are review evidence. The original cleanup composites and receipts are immutable
historical outputs, so replacing them in place would break their hashes and provenance. Acceptance
therefore needs an additive selection layer.

## Requirements

- Accept exactly the 23 owner-approved V12 candidates.
- Preserve the exact V12 candidate bytes; promotion must not recompress or recompose them.
- Leave the five V10 borderline targets untouched.
- Leave all other cleanup composites untouched.
- Retain the V10, V11, and V12 evidence and the original cleanup composites byte-for-byte.
- Fail closed if any V10/V12 report, baseline composite, selected candidate, or accepted copy drifts.
- Give downstream coordinators one validated resolver for the active composite path and hash.
- Correct the agentic workflow so individual generation produces frameless artwork and deterministic
  coordinator assembly owns scale, masking, backing, and final-frame composition.

## Chosen architecture

Create one immutable accepted overlay at:

`assets/wiki/skills/icon-production-v1/quality-cleanup-v1/accepted-overlays/inner-frame-v1/`

It contains a manifest plus 23 exact byte copies under `composites/`. The manifest binds:

- the raw V10 audit report and its five deferred borderline target IDs;
- the raw V12 review report and its owner-approved 90% assembly policy;
- the frozen cleanup manifest;
- every target ID, original composite path/hash, V12 candidate path/hash, and accepted path/hash;
- scope counts of 456 catalog skills, 23 accepted overrides, 433 unchanged targets, and five
  borderline targets included in the unchanged set;
- the literal decision `accepted`, reviewer role `owner`, and date `2026-09-06`.

The accepted copies are deliberately separate from review evidence. They make the promotion
boundary explicit while retaining byte equality with the approved candidate. The original
`quality-cleanup-v1/composites/*.png` files and their result receipts remain untouched.

A repository helper validates the complete manifest and exposes a resolver. A target listed in the
overlay resolves to its accepted copy; every other target resolves to its original cleanup
composite. The active overlay is selected by a source-code constant, so a future overlay cannot
become active merely by appearing on disk.

## Rejected alternatives

### Overwrite the 23 existing composites and receipts

This is the shortest implementation but invalidates immutable result hashes and erases the exact
before/after boundary. It is rejected as a quick fix.

### Publish the entire 456-icon cleanup selection now

The broader cleanup-selection workflow also controls shared reference promotion and wiki derivative
publication. That exceeds this approval, which is specifically for the 23 inner-frame corrections.
The accepted overlay remains a valid input to that later full-catalog selection.

### Regenerate the 23 images again

The owner approved the exact V12 pixels. Another generation pass would introduce unnecessary visual
variance and new provider provenance. It is rejected.

## Acceptance and resolver contract

The implementation exports:

```ts
const ACTIVE_SKILL_ICON_INNER_FRAME_OVERLAY_PATH: string;

loadSkillIconInnerFrameAcceptance(options: {
  repositoryRoot: string;
}): Promise<ValidatedSkillIconInnerFrameAcceptance>;

resolveAcceptedSkillIconComposite(options: {
  targetId: string;
  baselinePath: string;
  baselineHash: string;
  acceptance: ValidatedSkillIconInnerFrameAcceptance;
}): { path: string; contentHash: string; source: 'baseline' | 'inner-frame-v1' };
```

Loading validates raw authority hashes, exact target sets, all declared raster hashes, exact
candidate-to-accepted byte equality, baseline bindings, V12 inspection gates, the 90% scale, the
`frame-opening-v3` profile, and `frameIsFinalLayer: true`. Resolution rejects an overlay record whose
baseline path/hash does not match the caller's canonical cleanup record.

The CLI supports only `--write` and `--check`. Write mode uses create-only publication and refuses
any existing non-identical output. Check mode re-derives the complete manifest and all 23 accepted
bytes without writing.

## Agentic skill corrections

Two repository skills own different halves of the workflow:

1. `summonlab-skill-icon-production` remains generation-only. It must request and inspect a genuinely
   frameless artwork layer with centered subject matter and enough breathing room for deterministic
   composition. It must not resize, mask, composite, or promote the returned provider image.
2. `summonlab-skill-creation` owns orchestration. Its current instruction to give individual jobs an
   approved frame and retain complete frame ornaments is removed. Individual jobs receive content,
   geometry, family, and parent authorities—not a frame-content request. After generation, the
   coordinator centers the exact accepted artwork at 90% (`922x922` on a `1024x1024` canvas at
   `(51,51)`), verifies that it covers the complete aperture, extracts the aperture interior, adds
   the canonical backing, and applies the complete canonical frame last with
   `compositionProfile: 'frame-opening-v3'`.

The coordinator must reject incomplete aperture coverage, baked frame traces, exterior opacity,
backing-only components, layer-hash mismatch, non-exact recomposition, protected-band mismatch, or
any composition where the frame is not the final layer. A different scale requires a new explicit
owner-reviewed authority; it is never guessed per target.

Family reference sheets may continue to show complete framed tiles for lineage review. They are
reference-only and never authorize a producer to generate or crop a frame into an individual
artwork layer.

## Testing

- Contract tests reject missing, extra, duplicated, stale, or wrongly ordered acceptance records.
- Publication tests prove exact byte equality, create-only behavior, and zero writes in check mode.
- Resolver tests prove exactly 23 overrides and 433 baseline resolutions, including all five
  borderline targets resolving to baseline.
- Composition assertions bind all 23 records to scale `0.9`, `frame-opening-v3`, final-frame order,
  complete aperture coverage, exact composition, protected-band equality, transparent exterior,
  and zero backing-only components.
- Agentic-skill tests reject the old framed-individual workflow and require the producer/coordinator
  ownership split.
- Baseline and forward agent evaluations exercise both skills with a new individual icon request.

## Non-goals

- Regenerating or visually revising the five borderline targets.
- Modifying the 23 approved source images or V12 candidate images.
- Replacing historical cleanup composites or receipts.
- Publishing the broader 456-icon cleanup selection or wiki derivatives.
- Changing canonical frame pixels, backing pixels, geometry, or other skill icons.

## Definition of done

- One immutable accepted overlay contains exactly 23 V12-identical composites.
- The validated resolver selects those 23 and preserves the other 433 baseline records.
- All five borderline targets demonstrably remain on their baseline composites.
- Both relevant agentic skills encode the frameless-producer/final-frame-coordinator workflow.
- Focused tests, Python skill tests, skill-icon typecheck, overlay `--check`, formatting, and diff
  checks pass.
- The completed commit is pushed with a clean working tree.
