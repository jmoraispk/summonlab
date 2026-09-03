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
retained reference, selected Option C source PNG, and bundled WebP. The WebP is the approved comparison
plate rendered by this wiki page.

The plate is not a sprite sheet and must not be cropped into seven runtime frames. A later asset
production pass must create individually framed, transparent, text-safe exports that preserve this
material and ornament grammar. That pass may adjust registration and small-size legibility, but it
must not silently change tier materials, letters, or the S treatment.

## Production normalization boundary

The Option C plate remains the visual authority and is never cropped. Current v2 frame production
accepts only the packet-declared `skill-icon-green-key-role-mask-v1` provider envelope: one
1254×1254 RGB PNG over opaque `#00FF00`, without a baked checkerboard. The collision-safe repository
helper alone converts it to the canonical 1024-pixel RGBA frame, using the outer-hex-plus-medallion
envelope and a clear inner 78% aperture except where the medallion overlaps it. The producing agent
may not resize, crop, key, mask, or rewrite the provider raster.

This v2 envelope is scoped to `rarity-frame` and `backing` retries. It does not apply to individual
`skill-art` or `calibration-plate` production, which remains on the v1 exact-source contract unless
a future contract revision explicitly adds those roles.

Result provenance records pathless provider media properties and hashes, the raw geometry-file
hash, and the normalized output hash; it never retains a machine-local provider pathname. The eight
v1 Task 7 failures remain immutable evidence. Each retry receives a new explicit revision, and the
unique latest revision must complete rather than falling back to an older candidate.

For every new frame or backing revision, the coordinator authors the visual target, binds the raw
geometry authority and exact v2 assignment, and dispatches one isolated generation. The producer
passes the returned provider path/hash directly to the helper. Automated normalization and
geometry validation run before owner review; only an accepted review may promote the master and
derive runtime assets. A failed or revised attempt remains in history and is superseded only by a
higher explicit revision.

The helper publishes the candidate and result as one crash-recoverable unit. If the worker stops
between their no-replace publications, the next production invocation validates the signed journal
and removes only the exact staged/final hashes and inodes owned by that dead transaction before
retrying. A private stage created before the journal is preserved and ignored because it has no
durable inode authorization; a new transaction ID prevents collision. A foreign or changed path
blocks authoritative recovery for coordinator inspection. For a provider or normalization failure,
the result-only verifier publishes an exclusive process-epoch owner record before its complete
fsynced JSON stage, holds the owner inode lock across recovery and commit, and reasserts the target,
assignment, catalog, geometry, references, and observed provider source before committing. Producers
should rerun the assigned command after an interruption and must never clean hidden transaction
files by hand.
