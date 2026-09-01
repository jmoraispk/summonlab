# Hero rarity frames

Wiki ID: `art.hero-rarity-frames`

Design status: **six-family visual source approved; runtime export pending**.

The current hero rarity-frame library contains six complete families in canonical review order:

1. **Legacy Neutral** — the approved comparison direction and the preferred starting family for
   initial rollout;
2. **Neutral** — a gemless no-affinity progression in tempered steel and dark iron;
3. **Fire**;
4. **Water**;
5. **Earth**;
6. **Wind**.

Legacy Neutral and Neutral are separate authorities. Legacy Neutral preserves the established
charcoal, gold, navy, and sapphire comparison language. Neutral removes affinity gems, blue
emission, and affinity color so it can serve as a gemless baseline. The Legacy Neutral rollout
preference is a visual-production recommendation, not a runtime default or catalog binding.

## Canonical source

The current source root is `assets/heroes/visuals/rarity-frames/`. Its
[manifest](../../../assets/heroes/visuals/rarity-frames/manifest.json) records family order, preferred
start, dimensions, image modes, and SHA-256 values. The
[checksum list](../../../assets/heroes/visuals/rarity-frames/checksums.sha256) binds all six sheets
and all 42 individual frames. The
[review page](../../../assets/heroes/visuals/rarity-frames/review/index.html) presents every family
as its full-set sheet followed by ranks 1 through 7.

Each family owns one 2172×724 RGB sheet and seven 1024×1536 RGB individual frames at stable,
unversioned paths. Git history preserves retired generation packets and rejected or superseded
artwork; those historical paths are not active review authority.

## Seven-rank progression

| Rank | Frame identity | Power cue |
| --- | --- | --- |
| 1★ | forged charcoal iron | disciplined construction and scale engraving |
| 2★ | horned iron | curved gold-edged silhouette |
| 3★ | gilded wing | wing corners, crest, and the first affinity expression where applicable |
| 4★ | dragon heraldry | paired closed-mouth dragon heads and lower claws |
| 5★ | dragon guardians | full closed-mouth bodies along the rails |
| 6★ | elder dragons | fuller bodies, folded wings, closed mouths, and controlled energy |
| 7★ | awakened dragons | both mouths open in a roar and energy reaches its apex |

Every family contains all seven ranks. Affinity ranks 1–2 are byte-identical copies of the Neutral
frames; Fire, Water, Earth, and Wind begin expressing their materials at rank 3. Wind rank 7 uses
the approved inward-facing-heads correction: the left dragon faces right and the right dragon faces
left, so both open mouths roar toward the hero opening.

## Integrated tray and mouth gate

Every frame contains its complete warm-gold star row in the lower illustrated tray. Frame, tray,
stars, bevel, lighting, shadow, and occlusion form one indivisible rendered object. The stars are not
separate sprites and must not be recreated as CSS, SVG, canvas, or post-generation overlays.

Dragon mouths remain closed through rank 6. Both mouths open only at rank 7. This mouth gate is part
of the readable rarity progression across Legacy Neutral, Neutral, Fire, Water, Earth, and Wind.

## Runtime boundary

ADR 0067 establishes the canonical six-family visual authority and supersedes ADR 0066. These
approved RGB PNGs are source artwork, not transparent runtime exports. Runtime transparency,
cleanup, sizing, registration, and any engine, affinity, or shared catalog contract change remain
pending a separate integration decision.
