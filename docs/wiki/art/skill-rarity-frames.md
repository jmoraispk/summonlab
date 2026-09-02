# Skill rarity frames

Wiki ID: `art.skill-rarity-frames`

Design status: **Option C accepted as the canonical comparison authority; individual runtime
exports pending**.

![Canonical seven-tier skill rarity-frame comparison](../../../assets/wiki/skills/rarity-frame-v1/skill-rarity-option-c-v1.webp)

The selected plate fixes one hexagonal frame language for every skill domain. Domain, family,
equipment, and element do not recolor rarity. The interior illustration identifies the skill;
the frame identifies its fixed rarity.

## Canonical material and ornament ladder

| Tier | Name | Material | Ornament and construction |
| --- | --- | --- | --- |
| F | Common | Weathered iron | Narrow undecorated rim, hammered wear, and nearly hidden rivets |
| E | Uncommon | Aged bronze | Brown-gold patina, one inset line, and understated corner collars |
| D | Rare | Tempered blue steel | Cool cobalt heat sheen, crisp double bevel, and tiny angular vertex cuts |
| C | Epic | Moonlit silver | Brighter controlled silver, a stepped rim, and one precise geometric channel |
| B | Mythic | Blackened metal and amethyst | Faceted purple mineral inset; the supernatural material replaces outward filigree |
| A | Fabled | Champagne electrum | Gentle pearl-metal highlight, doubled inner rim, six spear-leaf accents, and a refined crest |
| S | Legendary | Ceremonial antique gold | Crowned silhouette, saturated gold, and the fullest integrated ornament; preserve this treatment |

The progression is therefore **iron → bronze → blue steel → silver → amethyst → electrum →
gold**. Material establishes the primary distinction. Ornament reinforces rank without forcing every
tier into a busier silhouette.

The D frame may attract attention because blue steel is more chromatic than silver. That is
acceptable so long as C remains brighter and more precisely finished. If later testing makes D feel
more prestigious than C, mute D's cobalt reflection before increasing C's glow or ornament.

## Rarity, mastery, and text

Rarity belongs to the skill definition and never changes. Mastery and level belong to the
hero-skill relationship and may differ between bearers of the same skill.

Every displayed skill uses two text rows beneath its hexagon:

1. the skill name;
2. the bearer state as `MASTERY · LV N`, using Novice, Intermediate, Expert, or Master and a level
   from 1 through 10.

The mastery and level shown in the comparison plate are layout examples, not canonical state for
Measured Cut, Ember, Parry, Stone Skin, Fireball, Thousand Cuts, or Worldfire.

## Runtime boundary

The canonical asset root is `assets/wiki/skills/rarity-frame-v1/`. Its provenance catalog binds the
retained reference, selected source PNG, and bundled WebP. The WebP is the approved comparison
plate rendered by this wiki page.

The plate is not a sprite sheet and must not be cropped into seven runtime frames. A later asset
production pass must create individually framed, transparent, text-safe exports that preserve this
material and ornament grammar. That pass may adjust registration and small-size legibility, but it
must not silently change tier materials, letters, or the S treatment.
