# Hero rarity frames

Wiki ID: `art.hero-rarity-frames`

Design status: **uniform v4 production-review candidates; owner review pending; runtime integration not requested**.

Hero portrait cards use one coherent charcoal, gold, navy, and sapphire frame family across seven
star ranks. Rarity increases silhouette complexity, ornament density, dragon anatomy, and blue
energy. It does not cycle through unrelated colors, and the stars remain one warm-gold component at
every rank.

## Progression

| Rank | Frame identity | Power cue |
| --- | --- | --- |
| 1★ | forged charcoal iron | disciplined construction and scale engraving |
| 2★ | horned iron | curved gold-edged silhouette |
| 3★ | gilded wing | navy enamel, wing corners, and sapphire crest |
| 4★ | dragon heraldry | paired closed-mouth dragon heads and lower claws |
| 5★ | dragon guardians | full closed-mouth bodies along the rails |
| 6★ | elder dragons | fuller bodies, folded wings, closed mouths, and controlled energy |
| 7★ | awakened dragons | both mouths open in a roar and sapphire energy intensifies |

## Integrated star tray

Every frame contains a horizontal lower tray with its complete rank row generated as part of the
same illustrated object. The stars retain one warm-gold, broad, friendly five-point treatment while
sharing the frame's lighting, bevel, shadows, and occlusion. They are not separate sprites or a
post-generation overlay. Star rows expand symmetrically from one through seven and stay in the same
lower visual zone.

The accepted comparison direction remains preserved in `assets/heroes/visuals/rarity-frames-v3/`.
The current equal-canvas production packet and provenance live in
`assets/heroes/visuals/rarity-frames-v4/`. It adds a gemless no-affinity authority and 35 individual
1024×1536 RGB candidates: Neutral, Fire, Water, Earth, and Wind at every rank from 1 through 7.

Neutral dragons use gemless tempered steel and dark iron without blue gems or affinity emission.
Ranks 1–2 are byte-identical neutral frames across all five sets; affinity begins subtly at rank 3
and increases through rank 7. Dragon mouths remain completely closed through rank 6; only rank 7
opens both mouths.

The internal horizontal hero opening is now a measurable review constraint. Within each seven-rank
family, widest measured central opening divided by narrowest must be no more than 1.20. Current
candidate variation ranges from 13.84% to 18.60%. Any correction needed to meet this bound scales the
complete rendered frame—including its integrated tray and stars—as one indivisible image; the stars
are never moved independently. Untouched provider renders and normalization hashes remain in the v4
packet.

Wind rank 7 uses the corrected v2 composition: the left dragon faces right and the right dragon
faces left, so both open mouths roar inward toward the hero opening. The outward-facing v1 remains
superseded provenance and is not shown as the active candidate.

All files remain visual-direction candidates. They are not transparent runtime exports and have not
been registered in any shared catalog. The former v1 layered approach remains rejected provenance,
and shared catalogs and contracts remain unchanged until owner approval and an explicit integration
handoff.
