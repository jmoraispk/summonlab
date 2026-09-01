# Hero Rarity Frames Design

**Status:** Owner-approved visual direction; candidate production authorized on 2026-08-31.

## Scope

Create a collision-safe Heroes-only review packet for seven portrait card frames. The packet is a
visual candidate and must not be added to a shared runtime catalog until the owner approves it and
the root orchestrator agrees to the integration.

## Canonical visual language

Every rank uses one coherent high-fantasy dragon-frame family: charcoal iron, warm antique and
ivory gold, deep navy/cobalt enamel, sapphire gems, restrained electric-blue energy, and warm gold
stars. Rarity changes geometry, ornament density, dragon anatomy, and the behavior of light. It does
not introduce purple, red, rainbow, silver-star, white-star, or other rank-specific color systems.

All frames are bilateral, 1024 by 1536 portrait compositions with the complete outer silhouette
inside the canvas and a large unoccupied portrait opening. The off-white interior is a review
surface, not a hero image. There is no text, rank label, hero, logo, or watermark in the frame art.

## Rank progression

1. **Forged iron:** rectilinear charcoal frame, bronze-gold pinline, scale engraving, restrained
   corner blocks, no creature anatomy or magic.
2. **Horned iron:** the same dark foundation gains curved horn or wing cues and a sharper central
   crest, but remains predominantly charcoal.
3. **Gilded wing:** navy enamel, gold rails, wing-like corners, scale pattern, and small sapphire
   crests establish the noble family without complete dragons.
4. **Dragon heraldry:** paired inward-facing dragon heads and lower claws appear; blue energy stays
   restrained.
5. **Dragon guardians:** full paired dragon bodies descend along the rails; mouths remain closed;
   gold, claws, and sapphire accents become more prominent.
6. **Elder dragons:** the bodies, wings, scales, and lower mass become fuller and more ceremonial;
   mouths remain closed and power remains controlled.
7. **Awakened dragons:** both mouths open in a roar, the head pose becomes active, and sapphire-blue
   energy intensifies without changing the established palette.

## Immutable bottom tray

Every frame reserves the same horizontal star-safe area. On the 1024 by 1536 canvas, the usable
tray is centered, spans at least 760 pixels, and keeps the vertical band from y=1322 through y=1450
clear. Border ornament may surround the tray, but claws, tails, gems, flame, crests, scrollwork, and
other decoration cannot enter this band. The tray background remains dark navy or charcoal so warm
gold stars retain contrast.

## Canonical stars

All ranks use one identical five-point star layer based on the owner-approved stars visible in the
second and fifth reference frames. The star has broad, friendly points, a crisp silhouette, warm
yellow-gold upper facets, darker amber lower facets, a thin dark-gold edge, and a restrained glow.
It always points upward and never changes color.

The canonical star is rendered once with transparency. Every displayed copy reuses those exact
bytes at 88 by 88 pixels. Rows use a 12-pixel gap, a shared y position of 1348, and horizontal
centering. Counts are exactly one through seven; a generator is never asked to redraw or count the
stars independently.

## Asset state and review

All outputs live under `assets/heroes/visuals/rarity-frames-v1/` and remain `candidate`. The packet
stores source references, exact prompts, generated-source identifiers, dimensions, hashes, and
inspection notes. The existing hero visual catalogs and all runtime catalogs remain untouched.

Owner review must decide:

- whether the horizontal tray reads as one stable component across all seven ranks;
- whether the stars match the preferred second/fifth-frame style;
- whether 1 through 7 stars are equally sized, tightly spaced, and centered;
- whether the ornament progression preserves the supplied frame identities without new colors.
