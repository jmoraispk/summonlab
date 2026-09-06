# Skill Icon Quality Cleanup Design

**Date:** 2026-09-04
**Status:** In implementation; geometry-first shared-layer route approved
**Issue:** [Skill Icon Quality Cleanup](../issues/2026-09-04-skill-icon-quality-cleanup.md)

## Goal

Produce a reversible, reviewable replacement candidate for every one of the 456 existing skill
icons so that all ranks use canonical frame geometry, artwork cannot cover the frame or crest, and
confirmed UI-like glyphs are removed without changing the accepted skill concepts or motif-family
language.

## Accepted visual contract

- Every final icon remains a `1024×1024` RGBA PNG.
- The exterior of the point-up regular hexagon and integrated top crest is transparent.
- The rank crest and its uppercase `F`, `E`, `D`, `C`, `B`, `A`, or `S` letter are permanent parts of
  the frame.
- Every icon of one rank uses the same canonical frame pixels and registration.
- The universal backing remains quiet charcoal forged stone.
- F through A remain concrete-first. The acting weapon, body, element, magical operation, craft
  tool, material, ingredient, creature, document, or result remains readable.
- S may be more abstract only where the existing visual specification already permits it.
- Skill names, mastery, level, type, labels, captions, logos, watermarks, and explanatory UI glyphs
  are never painted into the icon.
- Existing `full-catalog-v1` source images, prompts, provider sources, results, and hashes are
  immutable evidence. Cleanup creates a new namespace and never overwrites them.

## Frozen inputs

The cleanup run binds these exact starting authorities:

| Authority | Path | SHA-256 |
| --- | --- | --- |
| Mass-production manifest | `assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json` | `7103c8d6c7ac006dcc4c332875ac4b44213d239079219363f9056b78bd3506bf` |
| Canonical skill catalog | `assets/wiki/skills/icon-production-v1/catalog.json` | `71add63ae46e6e0b68d807bb5bca6060b101213682fc8e1c9037ad1fe3744aaf` |
| Motif map | `assets/wiki/skills/icon-production-v1/motif-map.json` | `d9b82036326ebd35dc8689875c0bab3ae638ed31de64d4b4c8ded5a96428f1c7` |
| Visual specifications | `assets/wiki/skills/icon-production-v1/visual-specs.json` | `08d2b4018644f9d3b5166c41cf71768207fb9ffe821b2d83fde05707037b0514` |
| Selected seven-frame shape sheet | `assets/wiki/skills/icon-production-v1/mass-production-v1/references/approved-seven-frame-sheet.png` | `4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266` |
| Option C material authority | `assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png` | `66af9144bc4cb5d8bb1420c5a07cfe9652c7ccbccf17519da938b21298b929ce` |
| Geometry | `assets/wiki/skills/icon-production-v1/geometry-v2.json` | `6ffaaa99a2e19c7589bcb2f7975268117db199abd45752fd164567cb5042fcab` |
| Provider-space guide | `assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png` | `8f1c01435f3e32de07560b154d9e3becba3ca2a38773ca74c3115d66ba28094e` |

If any bound authority changes, the cleanup exporter fails rather than silently adopting new
content.

## Architecture

### 1. Canonical shared layers

The approved seven-frame sheet is generation guidance, not a crop source. The original cleanup
design reused the then-technically-valid F revision-5 frame candidate and created later standalone
candidates for E, D, C, B, A, S, and the charcoal backing through the normalized reference-asset
pipeline. New frame targets bind both the selected shape sheet and Option C material authority.

The seven frames and backing are generated as one batch. The cleanup run may use their exact hashes
to build review candidates, but they remain candidates and are not called approved masters before
the final owner decision.

The failed `charcoal-forged-stone-v5` profile-v3 result and every revision-5 packet remain immutable
evidence. Higher-revision frame/backing retries may use the additive
`skill-icon-geometry-role-mask-v1` + `summonlab-skill-icon-production-v5` tuple. It retains the
profile-v3 `caBX`, assigned-sRGB, geometry-v2, chroma, resize, and encoder authorities, but treats
provider pixels outside the authorized role mask as disposable input instead of requiring a clean
green exterior. The mask clears those pixels deterministically, then the retained 1024×1024 RGBA
layer must still pass strict role-aware alpha, backing-coverage, or frame-registration inspection.
No revision-6 packet or image is part of the profile implementation itself.
The subsequent packet-authoring slice issues exactly `charcoal-forged-stone-v6` and
`rarity-frame-{e,d,c,b,a,s}-v6`. It records coordinator-authenticated `superseded` results for only
the six output-free revision-5 frame packets. The failed backing-v5 result and successful F-v5
candidate/result remain terminal evidence and are not superseded.

The attempted E-v6 frame normalized successfully but retained visible green chroma fringe, so its
candidate and `revise` result remain immutable attempted evidence. The recovery inventory issues
exactly `rarity-frame-{e,d,c,b,a,s}-v7` with the same structural-v2 geometry-first tuple and a new
no-spill prompt invariant requiring hard clean material edges against the green matte. Only the five
output-free D/C/B/A/S-v6 packets receive coordinator-authenticated `superseded` results bound to
their exact v7 target and assignment bytes. E-v6 is never superseded. Cleanup composition therefore
temporarily targeted backing-v6, F-v5, and E/D/C/B/A/S-v7.

The attempted E-v7 frame also retained a thin visible green trace, so its candidate and `revise`
result remain immutable. The additive successor route is exactly
`skill-icon-geometry-role-mask-v2` + `summonlab-skill-icon-production-v6`. It retains profile v4's
1254 RGB `caBX`/assigned-sRGB envelope, geometry-v2/guide-v2 authority, alpha/unmatte calculation,
geometry-first mask clearing, contamination/checker gates, role validation, resize, and encoding.
Only its post-unmatte green ceiling changes, from `max(foregroundRed, foregroundBlue) + 40` to
`max(foregroundRed, foregroundBlue)`. The recovery inventory issues exactly
`rarity-frame-{e,d,c,b,a,s}-v8` with the v7 no-spill prompt invariant unchanged. Only the five
output-free D/C/B/A/S-v7 packets are coordinator-superseded against their matching v8 bytes;
attempted E-v7 and E-v6 are not superseded. Cleanup composition now uses backing-v6, F-v5, and
E/D/C/B/A/S-v8. No backing-v8 or F-v8 packet exists.

The attempted E-v8 source proved that strict green despill is not a safe extraction route for this
frame family: low-alpha edge pixels became bright magenta. Its candidate and `revise` result remain
immutable. The additive replacement is exactly
`skill-icon-black-matte-geometry-role-mask-v1` + `summonlab-skill-icon-production-v7`, valid only for
structural-v2 rarity frames. It retains the 1254 RGB `caBX`/assigned-sRGB envelope and
geometry-v2/guide-v2 authority, but requires an opaque `#000000` matte. For each source pixel,
`q=max(R,G,B)`: values through 4 become transparent black, values from 16 stay opaque source RGB,
and values 5–15 use `round(255*(q-4)/12)` alpha with per-channel black unmatting. After Lanczos3
resize, the frame union uses inward-only 4×4 coverage for center-inside pixels; the aperture and
exterior remain exactly transparent. Black-matte validation rejects contaminated required-transparent
regions and structured/checker content while retaining the strict frame gates and fixed encoder.
The recovery inventory issues exactly `rarity-frame-{e,d,c,b,a,s}-v9` with prompt wording that
changes only the matte while preserving material, proportion, crest, geometry, and exclusions.
Only output-free D/C/B/A/S-v8 are coordinator-superseded against their exact v9 authorities;
attempted E-v8, E-v7, and E-v6 are not superseded. Cleanup composition now uses backing-v6, F-v5,
and E/D/C/B/A/S-v9. No backing-v9 or F-v9 packet exists, and every earlier profile remains
byte-stable.

The first full-size materialization audit subsequently disqualified F-v5: its aperture contains
severe magenta speckling and its contours retain matte residue. All 1,368 untracked deterministic
outputs from that audit were discarded. The canonical cleanup authority now uses backing-v6 and
F/E/D/C/B/A/S-v9. F-v9 is an ordinary structural-v2 packet on the same exact black-matte
profile/producer-v7 tuple and ordered Option C, approved-sheet, and geometry-guide authorities as
the other v9 frames. Its approved identity is blackened iron/dark steel, sparse minimal rivets, no
decorative flourishes, and one integrated F crest; its aperture and exterior contain no icon,
backing, or foreground. F-v5 remains byte-identical immutable audit evidence and is not deleted,
overwritten, or relabeled.

### 2. Deterministic whole-catalog recomposition

Every current mass-production image is converted into a `legacy-interior` migration layer by
retaining only pixels inside the protected inner aperture and clearing the medallion exclusion and
frame band. The compositor then applies this order:

1. canonical charcoal backing;
2. masked legacy interior or a revised artwork layer;
3. canonical rank frame.

This operation runs for all 456 skills, not only the visibly defective examples. Therefore a given
rank has one frame everywhere and artwork can no longer render over it. A loss report records the
number and bounds of pixels removed from each source. High-loss icons and the ten confirmed
composition examples are always included in before/after evidence.

The checkerboard seen in earlier screenshots is treated correctly as review-page transparency,
not assumed to be opaque white. The output well uses solid charcoal, while image validation still
checks for opaque near-white contamination.

### 3. Confirmed semantic cleanup

The 28 high-confidence stray-glyph skills receive targeted image revisions after deterministic
recomposition. Each revision binds the current skill, motif-family sheet, original provider source,
current candidate, exact prompt, and output hash. The prompt preserves the main subject and removes
only detached explanatory badges, arrows, gauges, hearts, crosses, chevrons, or corner symbols.

The revised provider image is never promoted directly. It is reduced to the protected interior and
passes through the same backing-and-frame compositor as every other icon.

The ten symbolic-language skills remain in a separate decision lane because their symbols may be
the central magical or knowledge subject. They are displayed at full size in the final review with
`keep` and `remove` decisions; the system never guesses that a meaningful sigil is UI debris.

### 4. One end-of-run review boundary

There are no per-rank, per-family, or spend checkpoints inside the batch. Production is resumable
and collision-safe, so completed artifacts are retained if execution stops.

The only owner boundary is the completed review package containing:

- the seven canonical frames and backing;
- all 456 before/after icon pairs through paginated contact sheets;
- dedicated evidence for the ten confirmed frame/composition examples;
- dedicated evidence for all 28 confirmed semantic revisions;
- the ten symbolic-language decisions.

Acceptance then promotes the shared reference assets, records the cleanup selection manifest, and
refreshes the wiki derivatives atomically. Rejection leaves the existing wiki and mass-production
manifest untouched.

## Artifact model

Cleanup-owned artifacts live under:

`assets/wiki/skills/icon-production-v1/quality-cleanup-v1/`

The namespace contains:

- `manifest.json`: frozen authorities, inventory, per-skill disposition, hashes, and completion;
- `findings.json`: machine-readable confirmed and review-required defects;
- `interiors/`: deterministic legacy-interior migration layers;
- `provider-sources/`: exact sources for targeted semantic revisions;
- `revisions/`: normalized revised interior candidates and receipts;
- `composites/`: final cleanup candidates, one per canonical skill;
- `results/`: source/output/provenance records;
- `review/`: shared-layer, before/after, focused-defect, and symbolic-decision sheets.

The active wiki continues to consume `mass-production-v1` until an accepted cleanup selection
record points the derivative exporter at `quality-cleanup-v1`.

## Validation gates

Automated validation requires:

1. exact `456 = 258 Martial + 124 Magical + 74 Craft` coverage;
2. no missing, extra, duplicate, or renamed skill target;
3. all bound authority hashes unchanged;
4. seven distinct canonical frame hashes plus one backing hash;
5. `1024×1024` RGBA for every retained layer and composite;
6. zero alpha outside the geometry-v2 outer frame/crest envelope;
7. zero legacy/revised artwork alpha in the protected frame band and crest exclusion;
8. exact deterministic reproduction of every composite from its three bound layer hashes;
9. identical protected frame-band pixels for every icon sharing a rank;
10. no opaque near-white connected component in the exterior or frame band;
11. every confirmed semantic finding resolved by a revised candidate or an explicit owner decision;
12. every symbolic-language finding resolved by an explicit `keep` or `remove` decision;
13. zero-write `--check` runs for the cleanup manifest, review evidence, wiki derivatives, and wiki
    catalog;
14. unchanged historical mass-production bytes and hashes;
15. unchanged revision-5 targets, assignments, candidates, and results when the geometry-first
    contract is introduced.

Shape heuristics do not claim to prove that an image contains no semantic glyph. Human-readable
findings and final owner decisions remain required for that category.

## Failure and rollback

- No output path is replaced in place; revisions allocate new paths.
- A failed reference or semantic generation writes a terminal result and leaves the remaining run
  resumable.
- A clipped or materially damaged subject moves from deterministic recomposition to targeted
  revision; it is not patched with an untracked manual paint operation.
- Before acceptance, rollback is simply discarding the cleanup namespace.
- After acceptance, the prior selected manifest and content-addressed wiki derivatives remain in Git
  history, so reverting the selection commit restores the former catalog.

## Definition of done

- Eight shared-layer candidates exist and pass their role-aware geometry checks.
- All 456 cleanup composites exist with complete provenance and deterministic hashes.
- The 28 confirmed stray-glyph skills have revised candidates or explicit accepted-unchanged owner
  decisions.
- The ten symbolic-language skills have explicit keep/remove decisions.
- Focused and whole-catalog review evidence is complete.
- One owner review accepts the shared layers and selected skill candidates.
- The accepted cleanup selection is promoted and the wiki derivative set is rebuilt without
  hand-editing generated browser assets.
- The permanent wiki still reports 456 skills and all repository validation passes.
