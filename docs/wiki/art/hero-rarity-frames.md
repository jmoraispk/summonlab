# Hero rarity frames

Wiki ID: `art.hero-rarity-frames`

Design status: **corrected v4 production-review candidate; owner review pending; runtime integration not requested**.

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

The current production-review packet and provenance live in
`assets/heroes/visuals/rarity-frames-v3/`. It preserves the prior v3 combined sheet, adds a corrected
v4 neutral authority, seven newly generated 1024×1536 neutral candidates with exact star counts, and
Fire, Water, Earth, and Wind affinity comparison studies. The affinity begins subtly at rank 3 and
increases through rank 7 while ranks 1–2 remain neutral. Across every current progression, dragon
mouths remain completely closed through rank 6; only rank 7 opens both mouths.

All files remain visual-direction candidates. They are not transparent runtime exports and have not
been registered in any shared catalog. The former v1 layered approach remains rejected provenance,
and shared catalogs and contracts remain unchanged until owner approval and an explicit integration
handoff.
