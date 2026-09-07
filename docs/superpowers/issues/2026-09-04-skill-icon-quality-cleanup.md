# Skill Icon Quality Cleanup

**Date opened:** 2026-09-04
**Status:** In progress; append-only v2 semantic recovery has 24/28 candidate receipts and four bounded generation jobs pending
**Inventory reviewed:** 456 candidate icons across 19 catalog contact sheets
**Design:** [Skill Icon Quality Cleanup Design](../specs/2026-09-04-skill-icon-quality-cleanup-design.md)
**Plan:** [Skill Icon Quality Cleanup Implementation Plan](../plans/2026-09-04-skill-icon-quality-cleanup.md)

## Problem

The mass-production run produced a complete, visually coherent skill catalog, but some finished
icons contain one or more presentation defects:

1. the acting subject or effect crosses or competes with the rarity frame;
2. an individual image contains a malformed, displaced, doubled, or incomplete frame;
3. the art includes a small UI-like semantic glyph such as a heart, cross, chevron, arrow, gauge,
   or badge that should not be part of the painted emblem.

These defects do not invalidate the skill concepts or block publishing the visual catalog. The wiki
must expose the present candidates faithfully while this issue owns later source cleanup.

## Root-cause assessment

The defects are not one alpha-channel problem.

- The mass-production prompts asked the image generator to create the art and rank frame together
  for every skill. Consequently, all 456 frames are generated interpretations rather than a shared
  pixel-identical layer. Small rail, crest, scale, and ornament differences are systemic.
- The seven individually attempted v4 rarity-frame jobs failed normalization; only an F v5
  candidate survives as historical standalone-frame evidence. A later full-size cleanup audit
  found severe magenta aperture speckling and matte residue on its contours, so it is not eligible
  as the canonical F cleanup layer. The approved seven-frame sheet is a visual authority, not seven
  production-ready transparent layers.
- The profile-v3 `charcoal-forged-stone-v5` retry exhausted both provider calls. Its corrected RGB
  source was visually usable but failed the clean-green exterior heuristic, while a direct-alpha
  spike returned painted checker pixels rather than transparency. The owner approved an additive
  revision-6 route: `skill-icon-geometry-role-mask-v1` with
  `summonlab-skill-icon-production-v5`. The new route clears pixels outside geometry-v2 instead of
  rejecting them solely for their color; strict retained-role validation remains mandatory. All v5
  packet/result bytes remain immutable. The follow-up packet-authoring slice created exactly the
  backing-v6 and E/D/C/B/A/S frame-v6 target/assignment pairs without generating images, and
  coordinator-superseded only the six output-free v5 frame jobs. Failed backing-v5 and successful
  F-v5 evidence remain unchanged. E-v6 then normalized successfully but retained visible green
  chroma fringe; its candidate and `revise` result remain immutable attempted evidence. The
  no-spill recovery issues E/D/C/B/A/S-v7 with hard clean edge requirements and supersedes only the
  five output-free D/C/B/A/S-v6 packets. It creates no backing-v7 or F-v6/v7 packet.
- E-v7 also retained a thin visible green trace under profile v4's historical
  `max(foregroundRed, foregroundBlue) + 40` despill ceiling. The additive profile
  `skill-icon-geometry-role-mask-v2` pairs only with `summonlab-skill-icon-production-v6` and changes
  only that ceiling to `max(foregroundRed, foregroundBlue)` after the identical alpha/unmatte
  calculation. Six E/D/C/B/A/S-v8 packets retain the v7 no-spill prompt language. Only the five
  unattempted D/C/B/A/S-v7 packets are superseded; attempted E-v7 and E-v6 remain immutable
  `revise` evidence. There is no backing-v8 or F-v8 packet.
- E-v8 exposed a different artifact: strict green despill turned low-alpha frame-edge pixels bright
  magenta. Its candidate and `revise` result remain immutable. The additive frame-only profile
  `skill-icon-black-matte-geometry-role-mask-v1` pairs only with
  `summonlab-skill-icon-production-v7`, requires an opaque `#000000` matte, and applies the tested
  4–16 alpha/black-unmatte transfer before Lanczos3 resize and inward-only 4×4 geometry-v2 coverage.
  Exactly six E/D/C/B/A/S-v9 packets preserve each rank's material, proportion, crest, geometry, and
  exclusions while changing the matte contract. Only unattempted D/C/B/A/S-v8 are superseded;
  attempted E-v8, E-v7, and E-v6 remain `revise` evidence. There is no backing-v9 or F-v9 packet.
- The first full-size deterministic cleanup run exposed F-v5's magenta aperture contamination and
  contour residue. Its 1,368 untracked outputs were discarded. One additive F-v9 packet now uses
  the validated black-matte profile/producer-v7 route, exact ordered Option C, approved-sheet, and
  geometry-guide authority, and the approved blackened-iron/dark-steel identity with sparse
  minimal rivets, no decorative flourishes, and one integrated F crest. F-v5 remains byte-identical
  historical evidence; cleanup finalization now requires F-v9 and cannot fall back to F-v5.
- `repair-skill-icon-mass-exteriors.ts` correctly masks pixels outside the broad outer geometry, but
  it does not restore a canonical frame, protect the frame aperture from subject art, or understand
  semantic glyphs.
- The current mass validator confirms 1024×1024 RGBA, transparent canvas edges, broad alpha bounds,
  hashes, and inventory. It does not compare frame pixels against a per-rank authority and cannot
  classify a heart, chevron, or gauge as unwanted content.
- A complete exterior-alpha scan found no visible pixels outside the accepted outer hex/crest
  envelope in any of the 456 repaired icons. The apparent white tiles in review screenshots are the
  gallery's light checkerboard showing through transparent pixels, not opaque white baked into the
  PNG. Irregular or missing frame material can make that checkerboard especially conspicuous.

## Confirmed frame/composition examples

| Skill | Rank | Finding | Required adjustment |
| --- | --- | --- | --- |
| One Blade, One World | S | Sword and lower-left action trail cross the outer frame | Re-mask art to the inner aperture and composite the exact S frame above it |
| Thousand Li Thrust | B | Spear/action line competes with the frame boundary | Keep the spear and burst inside the protected aperture; restore exact B rails above |
| Piercing Thrust | E | Sword enters through the left rail and the generated rail is irregular | Clip/recompose the icon layer under the exact E frame |
| Blade Throw | E | Lower-left frame run is incomplete and visually displaced | Replace the generated frame with the exact E frame; retain the dagger arc inside |
| Quick Loose | F | Lower frame reads as a doubled/ghosted rail | Replace the generated frame with the exact F frame |
| Fletching | E | Crest seating exposes the checker review ground above it | Use the exact E crest/frame; the wiki itself must use a solid-dark image well |
| Power Draw | E | Crest seating exposes the checker review ground above it | Use the exact E crest/frame; no repaint is required solely for the checker |
| Archery | F | Crest seating exposes the checker review ground above it | Use the exact F crest/frame; no opaque-white cleanup is required |
| Wall of Points | D | Generated outer rails leave conspicuous transparent side runs | Replace with the exact D frame after clipping art to the aperture |
| Rend Armor | E | Frame is usable, but the generated art and semantic overlay approach the lower rail | Recompose under the exact E frame and remove the chevrons |

The review also shows harmless rank-to-rank geometry variation throughout the catalog. Rather than
hand-list every small rail deviation, frame standardization applies deterministically to all 456
icons. The table above is the high-confidence visible regression set for targeted before/after
evidence.

## Confirmed stray-glyph candidates

These are high-confidence UI-like overlays visible in the full catalog review. The acting subject,
tool, material, or magical operation remains; only the small explanatory glyph is removed.

| Skill | Unwanted glyph |
| --- | --- |
| Blade Dance | Up/down arrows |
| Hamstring | Detached foot/boot badge |
| Assassin's Certainty | Broken-heart badge |
| Severed Thread | Crossed medical symbol |
| Hewing Blow | Red circular gauge |
| Rend Armor | Three stacked chevrons |
| Berserk Swing | Lower-left circular gauge |
| Reaping Arc | Lower-left circular gauge |
| Red Harvest | Red medical cross |
| Heartseeker | Detached checkmark/target badge |
| Low Kick | Down arrow |
| Joint Lock | Prohibition badge |
| Warmth | Detached snowflake and shield glyphs |
| Ashfall | Detached elemental/alchemical glyph row |
| Still Depths | Shield, drop, and information glyphs |
| Soothe | Detached shield badge |
| Sustained Weave | Detached plus/element glyphs |
| Ore Sense | Corner eye badge |
| Weaponsmithing | Green upgrade arrows |
| Fuel Craft | Three upgrade arrows |
| Tempering | Curved upgrade arrow |
| Living Metal | Curved upgrade arrow |
| Cooking | Smiling-face/heart badge |
| Preserving | Infinity badge |
| Restorative Broth | Heart/plus glyphs |
| Comfort | Heart/plus glyphs |
| Taming | Small medallion badge |
| The Earth Provides | Circular-arrow badge |

The following images contain symbolic language that may be the central subject rather than a stray
overlay and therefore need owner review before any edit: Warding, Shield Sigil, Cleanse, Imbuing,
Sigil Binding, Tide Sense, Languages, Read Surface, Mental Fortress, and Ancient Script.

## Remediation design

### Phase 1: establish seven canonical frame layers

Generate standalone revision-9 F, E, D, C, B, A, and S frame candidates through the normalized
reference-asset pipeline. Every frame target binds the selected seven-frame sheet as shape
authority, Option C as material and ornament authority, and `geometry-v2.json` plus its
provider-space guide as registration authority. Preserve the integrated crest and letter. Validate
that the central aperture and exterior are transparent and that each rail is continuous.

The selected sheet is generation guidance, never a crop or trace source. This follows the current
production contract and avoids attributing extracted pixels to an independently generated frame.

When a profile-v3 revision is terminally blocked only by dirty pixels outside the authorized role
geometry, issue a new revision using the exact geometry-first/producer-v5 tuple. Do not rewrite or
relabel the failed v5 evidence. Geometry-first retains the canonical `caBX`, assigned-sRGB,
geometry-v2/guide-v2, and fixed-output provenance gates; it is not a manual masking exception.

The canonical production inventory is now exactly backing-v6 and F/E/D/C/B/A/S-v9. The six
unattempted E/D/C/B/A/S v5 frame packets and the five unattempted D/C/B/A/S packets at each of v6,
v7, and v8 have authority-bound `superseded` results. Attempted E-v6, E-v7, and E-v8 remain
`revise` evidence, failed backing-v5 is not superseded, and no backing-v7/v8/v9 or F-v6/v7/v8
packet exists. F-v5 remains immutable but is superseded only as cleanup authority by the additive
F-v9 packet. Revision 9 uses the exact frame-only black-matte profile/producer-v7 tuple; prior
profiles and evidence remain immutable.

### Phase 2: recompose all candidates

For every current icon:

1. retain the current painted content only inside a rank-independent inner aperture mask;
2. mask the top crest exclusion from the painted content;
3. place the standard charcoal backing beneath the content;
4. composite the exact rank frame above the content;
5. preserve 1024×1024 RGBA and transparent exterior pixels;
6. produce versioned candidates and receipts rather than overwriting mass-production evidence.

This removes generated frame variation and guarantees that subject art cannot render over the frame.
If clipping materially damages a subject, that skill moves to the targeted regeneration queue rather
than receiving a manual smear or patch.

### Phase 3: revise semantic-glyph candidates

Regenerate or inpaint only the icon layer for the confirmed glyph list with the existing motif-family
reference and a hard exclusion for badges, arrows, gauges, hearts, crosses, corner symbols, or
explanatory UI. Run the result through the same backing/frame composition from Phase 2.

The revision protocol is now implemented. Exactly 28 immutable packets bind the cleanup manifest,
canonical semantic fields, exact prompt, ordered purpose-limited reference hashes, original source,
current candidate/result, rank-specific backing/frame authorities, two-attempt ceiling, and four
collision-free output paths. The cleanup persister retains provider bytes exactly, masks only the
revised interior, recomposes with the bound layers, and publishes provider/interior/composite/result
as one create-only transaction with owned rollback. Packets now bind the built-in generator's native
`1254×1254` RGB profile-v3 envelope and exact caBX removal, assigned-sRGB decoding, Lanczos3
`1024×1024` resize, geometry mask, encoder, and Sharp/libvips authority while keeping exact provider
bytes and pathless hashes. Held directory descriptors prevent parent-path redirection; canonical
named parents are reauthenticated after each publication and before success; atomic rollback
quarantine preserves foreign replacements and fails closed. Both protocol suites run in the central
skill-icon/CI test command. Task 6 generated packet JSON only; raster production and human visual
inspection remain in Task 7.

#### Semantic revision correction (Task 7A)

The original Task 7 v1 completion claim is retracted. Review found aperture clipping in 23 v1
candidate compositions, two terminal v1 `revise` receipts, renderer substitution of non-candidate
receipts, and no independently auditable v1 call/timing telemetry. V1 evidence remains immutable;
no timing or generator identity is retroactively asserted.

Revision-v2 binds every predecessor packet/result/provider/interior/composite hash. Twenty-one
targets use the exact authenticated `1254×1254` RGB provider recovery (`caBX` removal, sRGB,
one Lanczos3 `696×696` inset at `(164,192)`, then the existing aperture/backing/frame). Still
Depths, Warmth, and Red Harvest use byte-for-byte identity adoption. The 24 current-run receipts
are candidate-v2, record current timing/tool provenance and zero generator calls, and have
1024px/384px review sheets under `review/v2-recovery/`. Taming, Rend Armour, Living Metal, and
Ore Sense are deliberately unresolved generation-v2 packets; their strengthened prompts require
complete limbs/equipment inside the safe area. The semantic finalizer and final review renderer
accept only the highest valid `candidate` per target and fail closed until all 28 are present.

#### Semantic revision correction (Task 7A round 2)

The preceding v2 recovery statement is retained as historical progress, not current selection
authority. V2 receipts are immutable but lack a separately published post-core completion audit, so
they cannot independently establish core-publication order. Their review sheet named
`deterministic-v2-1024.png` contains 512px cells; it is now explicitly labelled scaled legacy
evidence rather than an original-size inspection artifact.

Round 2 preserves every v1/v2 byte and appends 24 V3 deterministic recoveries. The 21 inset lanes
repeat the exact bound transform from the V2 provider and the three passed lanes use explicit V2
identity adoption. Every V3 candidate has a result plus an append-only completion audit created only
after the provider, interior, composite, and result are published and re-read. The audit records
truthful core start/completion timestamps and all core hashes without claiming its own publication
completion. No image-generation call occurred.

The protocol now accepts any integer revision `>=2` with exact immediate-predecessor chaining and
versioned paths. The finalizer independently re-derives artifacts and the 384px render, recomputes
the transaction digest, validates packet/result/audit/source/tool/geometry/backing/frame/findings,
and chooses only the highest audited terminal receipt. A newer missing, `revise`, or `failed` receipt
blocks fallback. The V3 review uses six true-original `1024×1024` cell pages and a separately
versioned compact-caption 384px sheet. The four V2 generation packets remain intentionally pending;
their hardened persistence path accepts native RGB caBX source bytes only with exact source/call
hashes and attempt records, but it was not invoked to generate a raster in this task.

### Phase 4: add missing automated gates

- Pixel-compare the protected frame band of every composed candidate to its rank frame.
- Require zero icon-layer alpha in the frame band and crest exclusion before composition.
- Require zero final alpha outside the outer envelope.
- Generate before/after sheets for the ten confirmed frame examples and all semantic-glyph revisions.
- Keep semantic review human-readable; do not claim that color or shape heuristics can prove the
  absence of every meaningful symbol.

## Definition of done

- Seven canonical, transparent, hash-bound rank frames exist and match the approved sheet.
- All 456 skill candidates are recomposed with an exact per-rank frame and protected aperture.
- The ten confirmed frame/composition regressions pass before/after review.
- Every confirmed stray-glyph candidate is revised or explicitly owner-accepted unchanged.
- The symbolic-language review list receives an explicit keep/remove decision.
- Structural, hash, inventory, and zero-write checks pass.
- The wiki derivative exporter is rerun from the corrected candidate manifest without hand-editing
  browser assets.
