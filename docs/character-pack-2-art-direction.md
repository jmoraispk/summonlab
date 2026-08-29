# Character Pack 2 art-direction contract

Status: **implementation contract**

Date: **2026-08-28**

Pack ID: `character-pack-2`

Generator: `human-v4`

Visual catalog: `visual-catalog-v2`

This document turns the [Character Pack 2 production plan](character-pack-2-plan.md) and
[inspiration audit](references/character-pack-2-audit.md) into production rules. The shared
[Summonlab art bible](art-bible.md) remains authoritative where this contract is silent.

## Visual thesis

Pack 2 is **medieval humanity made specific by body, labor, history, and resonance**.

Every person must look like an adult who occupied a physical life before summoning, even without
autobiographical memory. Bodies are not interchangeable mannequins. Clothing bears use, equipment
has weight, posture reflects habit, and star evolution changes capacity without changing human
worth.

The pack should feel more aspirational than Pack 1 while remaining grounded:

- heroic without glamour anatomy;
- attractive without objectification;
- ornate without visual noise;
- magical without full-body colored glow;
- medieval without making every person a knight;
- diverse without assigning physiology to role or personality.

Pack 1 remains a separate intact baseline. Pack 2 must not overwrite its manifests, assets, prompts,
or catalog records.

## Cohort construction

### Height bands

Height is reviewed on a common floor line and camera, never inferred from portrait crops.

| Band | Review range | Design use |
| --- | ---: | --- |
| Short | 150–162 cm | Compact reach, grounded center of mass; never coded as juvenile |
| Medium | 163–178 cm | Broad central range with varied proportions |
| Tall | 179–192 cm | Longer scale without mandatory thinness or authority |
| Exceptional | 193–205 cm | Rare adult scale requiring grounded weight and equipment fit |

The generator may produce continuous values within the supported adult range. Bands exist for
cohort coverage and review, not stereotypes.

### Build families

| Build | Primary read | Required distinction |
| --- | --- | --- |
| Wiry | Low mass, defined tendons, compact muscle | Not identical to simply scaling a model narrower |
| Lean | Light mass, softer definition | Distinct from wiry through muscle and posture |
| Athletic | Balanced trained mass | One option among many, not the default heroic body |
| Soft | Higher body-fat band, lower definition | Equally capable of premium costume and heroic framing |
| Sturdy | Broad load-bearing mass | Weight through torso, hips, legs, and stance—not only shoulders |
| Powerful | High trained mass and functional leverage | Available across presentations; never exposure-led |

Every six-person pilot must contain at least four visibly distinct build families. Every 18-person
cohort must contain all six.

### Proportion profiles

Proportion is independent from height and build.

| Profile | Torso | Arms | Legs | Read |
| --- | --- | --- | --- | --- |
| Compact | Longer relative torso | Short-to-balanced | Shorter | Dense, grounded silhouette |
| Balanced | Balanced | Balanced | Balanced | Neutral comparison point |
| Long-limbed | Shorter relative torso | Long | Long | Reach and stride, without mandatory thinness |
| Long-torso | Long | Balanced-to-long | Shorter | Strong central mass and lower center of gravity |

Avoid extreme fashion illustration ratios. Heads, hands, shoulders, hips, and joints remain
believable and functional.

### Cross-distribution rule

Height, build, proportion, presentation, phenotype, hair, rarity, personality, aptitude, and role
use independent entropy. Curated pilot selection deliberately crosses them; for example:

- short powerful feminine;
- tall soft masculine;
- medium sturdy androgynous;
- exceptional-height lean feminine;
- short athletic masculine;
- tall wiry androgynous.

These are coverage examples, not fixed characters.

## Face, hair, and age

- Adults span ages 18–42 in the first generator version, with visible but non-caricatured age cues.
- Face shape must survive without hair or costume: brow, cheek, jaw, nose, eye spacing, and durable
  marks carry identity.
- Hair first reads as mass and outline, then texture. Every six-person pilot uses six distinct hair
  silhouettes.
- Hair texture and protective construction receive equal rendering care.
- Facial hair, grooming, wrinkles, freckles, scars, and asymmetry expand identity without becoming
  universal noise.
- A clean-slate summon looks alert, guarded, direct, formal, grounded, confused, or observant—not
  ecstatic about being obtained.

## Medieval role vocabulary

Pack 2 includes combat and non-combat histories. Equipment signals plausible experience rather
than binding a permanent class.

| Vocabulary | Silhouette/material cues |
| --- | --- |
| Guard and infantry | Mail, padded layers, shield straps, repaired plate, broad load distribution |
| Hunter and scout | Short mantle, bow or sling anchors, weatherproof cloth, quiet closures |
| Healer and herbalist | Layered apron, wrapped containers, linen, leather cases, visible hand access |
| Smith and builder | Heavy apron, reinforced forearms, tool loops, soot and repair marks |
| Scribe and ward-reader | Writing case, fitted mantle, geometric clasp, restrained resonance instrument |
| Traveler and laborer | Layered wool, load straps, patched hems, practical boots, weather wear |
| Court and envoy | Fine weave, controlled tailoring, limited jewelry, posture-led status |
| Mage and ritualist | Inscribed practical layers, focus anchors, sparse emissive geometry |

No role is gender-locked. Anyone may wear protective armor appropriate to the same physical job.

## Costume and presentation safety

### Required

- Coverage follows weather, danger, movement, and role.
- Armor bears load at shoulders, waist, hips, hands, and feet.
- Cloth uses believable weave, fold memory, closures, and repairs.
- Boots provide a stable combat or work stance.
- Tailoring accommodates the generated body rather than forcing every body into one hourglass or
  inverted-triangle template.
- Feminine, masculine, and androgynous characters receive equivalent material richness, heroic
  framing, age range, and physical power.

### Prohibited shortcuts

- cleavage, exposed midriff, high-cut hips, or lingerie construction as a rarity signal;
- heeled combat armor or footwear that cannot carry the declared stance;
- narrowing armor around the waist beyond the body and padding beneath it;
- exposure as shorthand for strength, magic, danger, or confidence;
- disproportionately small heads or impossible legs used to make a character fashionable;
- assigning softer or heavier bodies comic framing or lower rendering quality;
- glamour contrapposto in identity and scale-review anchors.

Style and sensuality can exist in later context-specific costumes, but they must be authored as
character-owned choices, not procedural defaults or measures of power.

## Initial quality and equipment progression

Every first-reveal asset meets the same premium anatomy, realism, lighting, material, and identity
bar. A `1★` level-1 hero may wear modest repaired wool and plain leather; the art itself is never
cheap, unfinished, or placeholder-like.

Equipment progression is state, not rarity decoration:

- only owned and equipped items appear;
- upgrades preserve body, face, hair, durable marks, and posture unless state changes them;
- better items improve construction, fit, protection, specialization, and material behavior;
- an unequipped weapon never appears merely to make a portrait cooler;
- injury and wear are separate layers from equipment and identity.

## Leveling and star evolution

Level and evolution communicate different changes.

### Leveling

- advances ordinary levels within the current star cap;
- improves stance, handling, maintenance, confidence, and evidence of practiced movement;
- may add earned wear, repairs, or small role-specific refinements;
- does not automatically change physique, clothing, or equipment;
- cannot exceed `star rank × 10`.

### Evolution

- raises star rank and therefore the maximum level;
- may change style, muscle mass, posture, proportions, resonance anatomy, or other authored physical
  attributes;
- always records the physical change in a versioned evolution state;
- preserves face, phenotype, durable marks, and at least four core recognition cues unless a story
  event explicitly changes one;
- is player-facing terminology; historical schemas may retain `promotion` for replay stability.

### Star grammar

| Stars | Visual grammar |
| ---: | --- |
| `1★` | Simple practical construction; one personal identity cue; no active resonance effect |
| `2★` | Better fit or one specialized material/tool; clearer role silhouette |
| `3★` | Layered role motif and one restrained resonance mark or focus |
| `4★` | Masterwork construction, controlled asymmetry, rare material behavior |
| `5★` | First major evolved motif; resonance begins altering form or motion |
| `6★` | Mature integration of identity, equipment, and resonance anatomy |
| `7★` | Singular history-bound state; powerful through specificity rather than maximum ornament |

Gold amount, glow area, armor size, and exposed skin are not star metrics.

## Color, lighting, and materials

### Shared palette behavior

- Faces and hands receive the clearest local value separation.
- Base clothing remains mostly charcoal, navy, umber, deep green, oxblood, muted plum, or worn
  natural fiber.
- One restrained personal accent survives roster and settlement scale.
- Cold cyan belongs to gate/system light; ember gold belongs to commitment, consequence, and
  controlled resonance.
- Near-white appears only in a deliberate magical or validation focal point.

### Material hierarchy

Status is communicated through how a material is made and maintained:

- ordinary: coarse weave, simple closure, visible repair;
- skilled: fitted layers, reinforced seams, role-specific construction;
- masterwork: integrated load, fine articulation, deliberate asymmetry;
- resonant: material behaves beyond physics in one controlled, readable way.

Do not simply recolor the same costume for different stars.

## Canonical image compositions

### Full-body identity anchor

- `1024 × 1536` portrait orientation;
- one adult, head to toe, hands and footwear visible;
- neutral three-quarter stance on a common floor plane;
- restrained midnight-navy studio backdrop;
- no weapon unless the manifest explicitly declares it as an identity-state attachment;
- no text, UI, frame, logo, watermark, extra person, or glamour pose.

### Continuity sheet

- `1536 × 1024` landscape orientation;
- neutral front, profile, and back views plus three state/action panels;
- identical body ratios, face, hair, marks, clothing state, and equipment anchors;
- no labels baked into pixels.

### True-scale lineup

- shared floor, camera, focal length, head scale, and neutral light;
- subjects ordered by generated height but not resized independently;
- sufficient spacing for flat silhouette review;
- no perspective staging or marketing overlap.

### Roster and settlement checks

- roster: verify face, hair mass, body outline, palette, and personal cue;
- settlement: verify height, gait/posture, hair mass, clothing outline, and accent; do not claim face
  recognition below useful resolution.

## Generation prompt contract

Every human anchor prompt derives from the exact manifest and uses this structure:

```text
Use case: stylized-concept
Asset type: Character Pack 2 full-body identity anchor
Primary request: an original newly summoned adult human hero
Subject: exact manifest-bound age, presentation, height, frame, build, mass, muscle tone,
body-fat band, torso/arm/leg proportions, face, skin, hair, marks, posture, and handedness
Costume: exact medieval role vocabulary and star-appropriate construction; modest equipment is
rendered with premium material fidelity
Style/medium: premium realistic painterly dark-fantasy character key art
Composition/framing: one person, head to toe, neutral three-quarter stance, hands and footwear
visible, common floor plane
Lighting/mood: cold summoning-gate key with restrained warm resonance rim; observant clean-slate mood
Constraints: preserve generated anatomy and identity; practical coverage; believable equipment load;
no published-character or reference-person resemblance
Avoid: sexualization, glamour pose, exposed combat costume, fashion anatomy, implausible heels,
oversized weapon, generic gold rarity recolor, full-body glow, text, UI, logo, watermark, extra people
```

Continuity generations repeat all identity invariants and change only the requested view or state.
References provide finish, material, or composition guidance only; no prompt requests an artist,
franchise, or existing character imitation.

## Asset and provenance contract

Every Pack 2 bitmap record includes:

- `packId: character-pack-2`;
- catalog and profile versions;
- character ID and exact manifest hash;
- generation or edit mode;
- final prompt and reference roles;
- dimensions, byte count, content hash, and created time;
- star/evolution state and equipment-state IDs;
- identity checks for face, hair, body silhouette, proportions, palette, and durable cues;
- human status: `candidate`, `revise`, `approved`, or `rejected`;
- explicit production note.

Generated pixels never enter authoritative simulation state. A manifest without approved
first-reveal art remains outside the player-facing summon pool.

## Review rubric

Review every candidate at full size, roster size, true-scale lineup, and settlement size.

| Gate | Pass question |
| --- | --- |
| Manifest fidelity | Are height, build, proportions, face, hair, marks, posture, and handedness correct? |
| Anatomical credibility | Do joints, hands, footwear, center of mass, and equipment contact work? |
| Body specificity | Does the person remain distinct without costume, color, or face detail? |
| Presentation parity | Would the same role and star receive equivalent protection and polish across presentations? |
| Medieval construction | Do layers, closures, materials, tools, and armor belong to the declared role and pack? |
| Initial quality | Would this be acceptable as the player's first permanent view of the person? |
| Star grammar | Is power readable through construction and resonance rather than gold, glow, or exposure? |
| Continuity | Do all views and states remain the same recognizable person? |
| Scale survival | Do at least four non-facial identity cues survive settlement size? |
| Production fit | Can equipment, injury, evolution, compression, and animation remain separate states? |

A failed gate records `revise` or `rejected`; generation never approves itself.

## Pilot acceptance matrix

The first six humans pass only when the cohort proves all of the following together:

- two short, two medium, and two tall or exceptional heights;
- at least four build families;
- all four proportion profiles represented;
- two feminine, two masculine, and two androgynous presentations;
- six distinct hair silhouettes;
- at least one soft or heavier-set person;
- at least one powerful feminine person;
- at least three medieval role vocabularies, including one non-combat role;
- low-, middle-, and high-star construction without quality differences;
- no candidate depends on sexualization, published-character resemblance, or modern clothing.

Only after this matrix passes should production expand to the 18-human cohort.
