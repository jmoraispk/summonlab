# Rank-first Equipment calibration — 2026-09-02

Status: **experiment-only**. These files are direction references, not manifest production
candidates, approved sources, or runtime assets.

This calibration tests whether the accepted seven-rank Dagger method transfers to other Equipment
classes and whether a design from a progression sheet can be reconstructed as a dedicated individual
render rather than cropped.

## Direction references

- `../material-vs-class-calibration-2026-09-02/approach-a-steel-material-cohort-v1.png` supplies the
  accepted finish and the Steel Axe, Spear, Dagger, Shield, and Heavy Armour style direction.
- `../material-vs-class-calibration-2026-09-02/approach-b-dagger-class-progression-v1.png` supplies the
  owner-accepted rank-escalation rhythm and silhouette ambition.
- Both inputs remain direction-only references. Their pictured items are not automatically approved
  candidates and must not be cropped into production assets.

## Outputs

| File | Role | Dimensions | SHA-256 |
| --- | --- | ---: | --- |
| `sword-metal-ranks-v1.png` | seven-rank Sword sheet | 1624×969 | `63835048580050dfae01d4195d26a1a0dc9b8d66546ca2af8540aa5565338f43` |
| `spear-metal-ranks-v1.png` | seven-rank Spear sheet | 1624×969 | `bdfa20d86ca6b2a4c6b9540e6b0924e018cfe749b1dc8981fdead06ded7101bd` |
| `axe-metal-ranks-v1.png` | seven-rank Axe sheet | 1624×969 | `b99400da66d60a542d80683dc8083993dbcca30a2f4a268a77037b3d6fbbb8dd` |
| `mace-metal-ranks-v1.png` | seven-rank Mace sheet | 1624×969 | `b8e12d3b64ec7ac4515ef067b87dad09c5b51b02a1f5d6a1fb13f1c425389359` |
| `shield-metal-ranks-v1.png` | seven-rank Shield sheet | 1770×889 | `fa4f02530a8838cd9ac0738dae28ffdddcbf5f87527f9fc2d2989f4568d936e2` |
| `heavy-armour-metal-ranks-v1.png` | seven-rank Heavy Armour sheet | 1921×819 | `e43eebe931c75330abe54d39b35a97b69bc1e18c2e349c31eff1bb0b096683da` |
| `bronze-dagger-individual-v1.png` | dedicated Bronze Dagger test | 1024×1536 | `47022bbdf47bb370b1a84156190f8a7bab75c1f999c7b126fc3e8e7dcd47ec08` |
| `sunsteel-dagger-individual-v1.png` | dedicated Sunsteel Dagger test | 1024×1536 | `8c5c69fc6a02b6eaa71bb6cfa679fb19f3c12b775ca85722cb282350a5e97cd1` |

All eight files were generated with the built-in image-generation tool. The two progression inputs
were passed by exact local path. The dedicated Daggers are new renderings, not image crops.

## Immediate findings

- The Dagger rank rhythm transfers successfully to Swords, Spears, Axes, Maces, and Shields.
- Rank remains readable primarily through silhouette and construction, with palette and finish as
  secondary reinforcement.
- Both individual Dagger tests retain the selected progression-sheet designs in dedicated renders.
  Their portrait canvas is suitable for this calibration; production masters will use the final
  profile's locked canvas and framing.
- The Heavy Armour sheet demonstrates useful rank escalation but does not yet satisfy the empty-set
  requirement: several sets read as occupied mannequins. It is a ranking reference only.

## Exact shared progression prompt

Each six-class progression prompt was the following shared block plus its exact class supplement.

```text
Use case: stylized-concept
Asset type: reference-only Equipment rank-progression calibration sheet
Input images: Image 1 is the accepted same-material Steel cohort style reference; Image 2 is the accepted seven-rank Dagger progression and sets the desired rank-escalation rhythm, silhouette ambition, presentation, lighting, and finish. Use broad visual principles only; create original designs and do not copy recognizable geometry.
Scene/backdrop: midnight-charcoal studio presentation ground with a restrained floor plane
Style/medium: premium realistic painterly dark fantasy game concept art; grounded medieval construction becoming progressively more fantastical
Lighting/mood: cold key light with a restrained warm rim
Rank order: exactly seven designs from left to right — Bronze F, Iron E, Steel D, Blacksteel C, Skyiron B, Starmetal A, Sunsteel S
Progression: Bronze practical and appealing; Iron sturdy; Steel refined; Blacksteel dense and bold; Skyiron elegant and unnaturally light; Starmetal extraordinary and cosmic; Sunsteel legendary and solar
Constraints: identical camera, pose family, normalized footprint, and lighting across all seven; every rank changes silhouette or construction rather than only color; one dominant silhouette idea per design; readable at phone-thumbnail size; no labels, text, borders, logos, trademarks, characters, hands, scenery, or watermark
```

### Sword supplement

```text
Primary request: create a clean seven-cell progression sheet of seven original SWORDS.
Subject: one complete practical hand-and-a-half sword per cell, tip down and grip high with a slight right diagonal.
Material expression: progressively vary blade profile, fuller, guard, pommel, negative space, and restrained ornament. Keep F and E believable; allow daring blade geometry at A and S without turning them into oversized slabs.
Avoid: daggers, identical recolors, horizontal weapons, floor-lying weapons, implausible grips, excessive spikes.
```

### Spear supplement

```text
Primary request: create a clean seven-cell progression sheet of seven original SPEARS.
Subject: one complete two-hand spear per cell, butt low and metal head high on a consistent long right diagonal; the metal head is rank-bearing and the neutral wood shaft remains subordinate.
Material expression: progressively vary compact head profile, socket, wings or lugs, edge geometry, shaft fittings, and restrained ornament. Heads stay practical at low ranks and become more ambitious without swallowing the shaft.
Avoid: poleaxes, glaives, oversized low-rank heads, identical recolors, horizontal or cropped weapons.
```

### Axe supplement

```text
Primary request: create a clean seven-cell progression sheet of seven original AXES.
Subject: one complete practical single-bit one-hand bearded axe per cell, haft low and head high with a slight right diagonal.
Material expression: progressively vary beard, bit sweep, poll or counterweight, socket, bounded cutouts, haft fittings, and ornament. Preserve one dominant cutting bit at every rank.
Avoid: double-bit axes, halberds, tiny hatchets, identical recolors, horizontal or floor-lying weapons, excessive spikes.
```

### Mace supplement

```text
Primary request: create a clean seven-cell progression sheet of seven original MACES.
Subject: one complete long-hafted one-hand mace per cell, pommel low and head high with a slight right diagonal; total length about 70–80 percent of a sword.
Material expression: progressively vary flange count, crown profile, head mass, striking geometry, haft fittings, and restrained ornament while keeping each head practical for blunt impact.
Avoid: clubs, hammers, axes, tiny handles, gigantic heads, identical recolors, horizontal or floor-lying weapons.
```

### Shield supplement

```text
Primary request: create a clean seven-cell progression sheet of seven original SHIELDS.
Subject: one complete one-hand defensive shield per cell, upright and centered in the same mild three-quarter presentation.
Material expression: visibly vary outline, boss, ribs, rim, apertures, surface construction, and ornament across ranks. Different round, tapered, angular, or hero-like visual forms remain the same Shield equipment class. Low ranks are practical; high ranks may use bold negative space and supernatural material behavior.
Avoid: seven identical heater-shield recolors, held shields, characters, wall displays, excessive scenery, unreadably thin silhouettes.
```

### Heavy Armour supplement

```text
Primary request: create a clean seven-cell progression sheet of seven original EMPTY HEAVY ARMOUR SETS.
Subject: one complete self-supporting set per cell in the same mild three-quarter front view, facing consistently; exactly Head, Torso, Legs, and paired Boots must be readable together.
Material expression: progressively vary plate cut, articulation, overlap, helmet, shoulders, torso structure, skirt or fauld silhouette, greaves, and restrained ornament. Each material must change the set design rather than recolor one suit.
Interior: natural cavity shadows inside openings only; absolutely no body, skin, face, mannequin, black void character, pose dummy, or visible wearer.
Avoid: identical suits, missing helmets, floating disconnected pieces, robes, light armour, characters, weapons, capes hiding the required pieces.
```

## Exact individual Dagger prompts

### Bronze

```text
Use case: stylized-concept
Asset type: experiment-only individual Equipment rendering
Input image: the seven-rank Dagger progression sheet is the design reference. Reconstruct the LEFTMOST Bronze F dagger as one dedicated, high-detail individual asset; do not crop the sheet.
Primary request: faithfully preserve the Bronze dagger's broad practical blade, warm forged-bronze material, dark wrapped grip, guard language, proportions, and grounded low-rank appeal while resolving it as a complete standalone object.
Scene/backdrop: midnight-charcoal studio presentation ground with a restrained floor plane
Style/medium: premium realistic painterly dark fantasy game concept art
Composition/framing: exactly one complete dagger, point low and grip high, moderate right diagonal, centered with generous consistent margins
Lighting/mood: cold key light with restrained warm rim
Constraints: one dagger only; dedicated new rendering; readable at phone-thumbnail size; no text, labels, borders, hands, characters, scenery, logos, trademarks, or watermark
Avoid: copying any user-supplied copyrighted reference, adding a second weapon, turning it into a sword, horizontal or floor-lying presentation.
```

### Sunsteel

```text
Use case: stylized-concept
Asset type: experiment-only individual Equipment rendering
Input image: the seven-rank Dagger progression sheet is the design reference. Reconstruct the RIGHTMOST Sunsteel S dagger as one dedicated, high-detail individual asset; do not crop the sheet.
Primary request: faithfully preserve the Sunsteel dagger's elegant legendary blade geometry, solar gold-and-pale-metal construction, bold guard and negative-space language, white wrapped grip, proportions, and restrained supernatural radiance while resolving it as a complete standalone object.
Scene/backdrop: midnight-charcoal studio presentation ground with a restrained floor plane
Style/medium: premium realistic painterly dark fantasy game concept art
Composition/framing: exactly one complete dagger, point low and grip high, moderate right diagonal, centered with generous consistent margins
Lighting/mood: cold key light with restrained warm rim and controlled solar glow
Constraints: one dagger only; dedicated new rendering; readable at phone-thumbnail size; no text, labels, borders, hands, characters, scenery, logos, trademarks, or watermark
Avoid: copying any user-supplied copyrighted reference, adding a second weapon, turning it into a sword, excessive bloom, horizontal or floor-lying presentation.
```

