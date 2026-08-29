# Character Pack 2 variation and monster-grade revision

Status: **implemented as reviewable `human-v5` and `pack-two-monster-grades-v1` candidates**

## Accepted feedback

The first Pack 2 pass improved height, build, proportion, and role variation, but its rendered humans
still collapsed toward a repeated face and one common outfit. The cause was structural: `human-v4`
stored one cloth palette, five face shapes, four nose profiles, and no garment modules. `HeroRig`
therefore drew the same tunic, sleeve, trouser, and boot geometry even when the body manifest differed.

The monster families and battlefield-duty language are accepted. They remain intact and gain a
deterministic grade layer rather than being replaced.

## Compatibility and versioning decision

- `human-v1` through `human-v4` remain byte-stable.
- `human-v5` is the Pack 2 variation revision and is the active 1,000-seed Forge audit lane.
- Existing polished `human-v4` anchors remain review candidates; `human-v5` does not silently reuse or
  promote them.
- Clothing and facial structure are independent of skin tone and gender presentation.
- Coherence comes from age, role, material, and construction rules—not from forcing hairstyles or
  garments into binary gender stereotypes.
- Automatically drawn silver hair is limited to mature adults. Covered headwear resolves to a close
  visible hair silhouette. Torso and sleeve construction must be compatible.

## Human variation grammar

`human-v5` owns five garment slots with ten modules each:

| Slot | Ten-module vocabulary |
| --- | --- |
| Footwear | turnshoes, ankle boots, riding boots, hobnailed boots, wrapped sandals, fur-lined boots, soft leather shoes, riding greaves, sabatons, moccasin boots |
| Legwear | fitted hose, split hose and breeches, loose linen trousers, wool trousers, quilted chausses, leather riding trousers, wrap skirt over leggings, divided skirt trousers, mail chausses, work breeches |
| Torso | linen tunic, belted wool tunic, leather jerkin, quilted gambeson, mail shirt, brigandine vest, scholar robe, apron over tunic, hooded surcoat, fitted doublet |
| Arms | sleeveless, rolled sleeves, full linen sleeves, quilted sleeves, split sleeves, mail sleeves, leather vambraces, wrapped forearms, bell cuffs, fitted cuffs |
| Headwear | none, linen coif, wool hood, broad hat, felt cap, mail coif, kettle hat, nasal helm, turban wrap, circlet |

Role-specific pools prevent implausible automatic draws. A guard can draw sabatons, mail chausses,
and a nasal helm; a scribe can draw turnshoes, a fitted doublet, and a felt cap. Torso selection then
constrains arms, primary material, and layering.

The face grammar expands to ten face shapes, ten nose profiles, and separate eye shape, eye spacing,
brow, cheek, jaw, chin, and mouth dimensions. These are independently seeded. The Forge gate requires
at least 975 complete face signatures in a 1,000-seed audit, all ten modules in all five clothing
slots, and no age-incoherent silver-hair draw.

## Monster grades

Every one of the 24 existing Pack 2 archetypes can produce grades 1 through 10. Grades are not levels:
a grade owns an overlapping level distribution, a mean power target, and visual escalation parameters.

| Grade | Title | Level range | Mean |
| ---: | --- | ---: | ---: |
| 1 | Lurking | 1–13 | 7 |
| 2 | Hardened | 9–23 | 16 |
| 3 | Veteran | 18–34 | 26 |
| 4 | Elite | 29–47 | 38 |
| 5 | Dire | 40–62 | 51 |
| 6 | Tyrant | 53–77 | 65 |
| 7 | Cataclysmic | 67–93 | 80 |
| 8 | Mythic | 82–110 | 96 |
| 9 | Calamity | 99–129 | 114 |
| 10 | Tower-ending | 117–151 | 134 |

Adjacent grades overlap by design while their means rise strictly. A deterministic triangular draw
keeps results near the mean without forbidding rare boundary cases.

Escalation is family- and duty-aware:

- elementals increase core density, body scale, binding light, and environmental wake;
- arcane hostiles increase controlled glow, focus scale, orbiting geometry, and casting anchors;
- arachnids increase abdomen scale, leg mass, carapace, silk output, brood payload, and nest footprint;
- undead increase spectral density, armor, command weapons, and binding seals;
- draconic monsters increase frame, musculature, horns, plates, wings, and breath organs;
- dungeon predators increase feeding mass, cores, teeth, eyes, plates, and signature hazard footprint.

Weapon duties gain weapon scale more quickly; mage duties gain glow more quickly. Size remains a clear
signal for most species, while arcane specialists grow physically more modestly.

## Review proofs

All three proofs are registered in
`assets/heroes/visuals/forge-v2/revisions/catalog.json`. Their unabridged generation prompts,
source-output identifiers, and measured wall-clock times are preserved in
`assets/heroes/visuals/forge-v2/revisions/generation-record.md`. Reviewers can inspect and record a
hash-bound accept/revise decision for each file at `/forge/pack-2/revision`; review does not promote
an asset automatically.

- `assets/heroes/visuals/forge-v2/revisions/human-v5-face-attire-proof-v1.png`
  (`sha256:68396959fc5736a91021976a8ec46aa5c28523c37b9296189dece9d56b8956a8`) is a built-in
  image-generation review plate derived from six `human-v5` directions. It is not catalog-promoted.
- `assets/heroes/visuals/forge-v2/revisions/human-v5-face-grammar-proof-v1.png`
  (`sha256:6daaa7f1fdd356acf9d2c0ad1eee4f4dba440628ad42eeb2b7548f8bce9fceac`) is a built-in
  image-generation close-up audit of eight deliberately separated adult facial structures. It was
  added because the full-body plate still compressed some face differences at roster scale.
- `assets/enemies/review/pack-2/monster-grade-escalation-v1.png`
  (`sha256:622a63ea55ab833f0451d29f0967f26f2335c912296ad45537e2a0889c8ecd2e`) is a built-in
  image-generation review plate showing Death Knight and Tower Archmage at grades 4, 7, and 10. It is
  not catalog-promoted.

Promotion still requires explicit visual review and a catalog update.
