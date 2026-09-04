# Skill Icon Quality Cleanup

**Date opened:** 2026-09-04
**Status:** Open; non-blocking for the wiki visual catalog
**Inventory reviewed:** 456 candidate icons across 19 catalog contact sheets

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
  candidate survives as a standalone frame. The approved seven-frame sheet is a visual authority,
  not seven production-ready transparent layers.
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
| Rend Armour | E | Frame is usable, but the generated art and semantic overlay approach the lower rail | Recompose under the exact E frame and remove the chevrons |

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
| Rend Armour | Three stacked chevrons |
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

Extract F, E, D, C, B, A, and S from
`mass-production-v1/references/approved-seven-frame-sheet.png`, remove the baked checkerboard through
the existing keyed normalization, register every frame to `geometry-v2.json`, and save one
1024×1024 RGBA frame per rank. Preserve the integrated crest and letter. Validate that the central
aperture and exterior are transparent and that each rail is continuous.

This extraction is deterministic image processing of owner-approved pixels, not a new generative
interpretation.

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
