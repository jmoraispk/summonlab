# Skill rarity frames

Wiki ID: `art.skill-rarity-frames`

Design status: **Approved and implemented as seven reusable complete frame layers.**

The same domain-independent frame family is used for every skill. The illustration identifies the
skill; the frame identifies its fixed rarity. Each retained frame is a transparent 1024px RGBA
layer and is applied last over the shared backing and a frameless skill interior.

| Tier | Name | Canonical frame |
| --- | --- | --- |
| F | Common | ![F skill frame](../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-f.png) |
| E | Uncommon | ![E skill frame](../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-e.png) |
| D | Rare | ![D skill frame](../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-d.png) |
| C | Epic | ![C skill frame](../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-c.png) |
| B | Mythic | ![B skill frame](../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-b.png) |
| A | Fabled | ![A skill frame](../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-a.png) |
| S | Legendary | ![S skill frame](../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-s.png) |

## Material and ornament ladder

| Tier | Name | Material | Ornament and construction |
| --- | --- | --- | --- |
| F | Common | Weathered iron | Narrow undecorated rim, hammered wear, and nearly hidden rivets |
| E | Uncommon | Aged bronze | Brown-gold patina, one inset line, and understated corner collars |
| D | Rare | Tempered blue steel | Cool cobalt heat sheen, crisp double bevel, and tiny angular vertex cuts |
| C | Epic | Moonlit silver | Brighter controlled silver, a stepped rim, and one precise geometric channel |
| B | Mythic | Blackened metal and amethyst | Faceted purple mineral inset; supernatural material replaces outward filigree |
| A | Fabled | Champagne electrum | Gentle pearl-metal highlight, doubled inner rim, six spear-leaf accents, and a refined crest |
| S | Legendary | Ceremonial antique gold | Crowned silhouette, saturated gold, and the fullest integrated ornament |

The progression is **iron → bronze → blue steel → silver → amethyst → electrum → gold**. Material
establishes the primary distinction, while ornament reinforces rank without forcing every tier into
a busier silhouette.

## Rarity and mastery

Rarity belongs to the skill definition and never changes. Mastery and level belong to the
hero-skill relationship and may differ between bearers of the same skill. The frame therefore
contains only the fixed rank language; bearer state is rendered separately by the interface.

## Canonical source and runtime

`assets/wiki/skills/icon-production-v2/asset-manifest.json` binds the seven frames, shared backing,
geometry, and one frameless interior per cataloged skill by SHA-256. Final framed PNG masters are
not retained. The wiki runtime composes each icon in this order:

1. shared charcoal backing;
2. canonical frameless interior;
3. matching rarity frame as the final layer.

Family sheets and review composites are generated on demand and deleted after review. Replacing a
frame requires updating one reusable frame and regenerating the runtime; it does not require
regenerating skill artwork.
