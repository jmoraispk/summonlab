# Summonlab art bible

Status: **approval candidate** for the Phase 3 visual gate.

Pack-specific extensions must preserve this document's identity and representation boundaries. The
medieval expansion is defined by the [Character Pack 2 art-direction contract](character-pack-2-art-direction.md).

This document converts the broader [visual direction](visual-direction.md) into production rules. It
applies to original human characters, classic enemy families, the Character Forge, settlement
scenes, dialogue, summon cards, and later rig exports. The current review pair is Mara Vey and Remy Nahl in the
[visual continuity lab](../apps/web/src/routes/visual-lab/+page.svelte).

## Visual thesis

Summonlab looks like **arcane machinery trying to classify a human soul**. People remain warmer,
less geometrically perfect, and more materially worn than the systems surrounding them.

- The world is midnight navy, near-black stone, smoke, worn wood, and cold cyan edge light.
- Agency, chosen action, and irreversible cost use restrained ember gold.
- Possibility, memory, and the unknown use muted plum or violet.
- Validation and stable system truth use cyan.
- Habitation appears as localized amber light rather than a globally warm grade.

Rarity changes the density and behavior of geometry, resonance rings, and light. It never recolors a
person through a generic rarity rainbow.

## Character construction

The deterministic manifest owns physical truth. An image can interpret but cannot silently change:

- adult age, height, frame, build, mass, muscle tone, body-fat band, limb proportion, and hand scale;
- skin tone, face shape, nose profile, eye color, hair texture/color/style, and durable marks;
- handedness, resting posture, clothing palette, signature clasp, and equipment anchors.

Physiology and culture are separate. Neither ancestry, skin, hair, sex presentation, height, nor body
composition implies intelligence, morality, temperament, rarity, combat role, or social value.

### Anatomy and pose

- Use believable adult proportions with specific height and frame differences.
- Preserve asymmetry: brow notches, scars, posture bias, clothing wear, and dominant-hand behavior.
- Hands must be readable and functional. Weapons attach to the declared hand and anchor.
- Avoid glamour poses, extreme contrapposto, anatomy exaggeration, and gendered costume shortcuts.
- A clean-slate summon looks observant, guarded, confused, direct, or cautious—not loot-box ecstatic.

## Line, value, and material rules

### Line

- Controlled dark linework defines face, hands, cloth overlap, and equipment contact.
- Exterior silhouettes may use a slightly firmer edge than interior fabric detail.
- Fine detail falls away by camera tier; it must not turn into noisy hatching at settlement scale.
- Hair masses read first as a silhouette, then as texture.

### Value

- Faces and hands receive the clearest local value separation.
- Keep most clothing inside the lower 45% of the value range; separate layers through temperature,
  edge, weave, and sheen rather than bright color.
- The focal face may be two value steps brighter than the torso. Nothing except committed magic or
  UI validation reaches near-white.
- Injury changes local hue, swelling, stance, and fabric condition. It does not globally desaturate
  or redesign the character.

### Materials

- Cloth shows weave, fold memory, repairs, and different weights.
- Leather is matte, creased, and utilitarian; metal is sparse and catches narrow highlights.
- Settlement stone and wood show use, soot, water, impact, and repair.
- Magic geometry is precise and emissive; people and buildings remain imperfect.

## Enemy construction

Enemy realism follows the same material world without making every creature humanoid or every boss
ornate.

- A silhouette should reveal battlefield duty before its species label: reach, armor, speed,
  ranged posture, spell focus, or command weight.
- Families share anatomy and material ancestry while rank changes age, equipment quality, posture,
  scars, and scale. A goblin chieftain is not merely a larger green goblin.
- Beasts retain believable weight distribution, joints, coat wear, claws, and movement. Fantasy
  threat does not require oversized heads or impossible musculature.
- Constructs expose how their material bears load: fingerprints and cracks in clay, jointed blocks
  in stone, forged articulation in iron, internal stress and refraction in crystal.
- Giants must preserve human-readable weight and ground contact. Size is established with camera,
  stride, environmental response, and known scale anchors rather than anatomy distortion.
- Magic and rarity use restrained emissive cores, marks, or telegraphs. They do not wash the entire
  creature in colored glow.

Family plates are taxonomy reviews only. Approval still requires individual front/profile/action
anchors, mission-scale silhouette checks, injury states, and telegraph animation for every runtime
archetype.

## Camera tiers

| Tier | Composition | Identity carrier | Required output |
| --- | --- | --- | --- |
| Summon | First-person, near life-size | face, gaze, breath, full silhouette | premium anchor / summon card |
| Dialogue | Eye-level or over-shoulder, chest-up | face, hair, marks, posture | expression layers and subtle parallax |
| Roster | Full body or thigh-up group | height, frame, hair, palette, clasp | separated silhouettes and readable relationships |
| Settlement | Hand-composed 2.5D three-quarter | height, gait, hair mass, cloak/mantle, accent | compact rig or sprite; face is not claimed |
| Mission | Authored third-person arena | silhouette, equipment, stance, action timing | limited tracks and readable consequences |

Free-roaming cameras are out of scope until one courtyard experiment proves they improve embodiment
without weakening composition and recognition.

## Continuity contract

Every approved character has:

1. one canonical manifest hash;
2. one full-body identity anchor;
3. a versioned visual profile containing identity locks, expressions, attachment anchors, injury
   placement, and palette swaps;
4. a front/profile/back and expression continuity sheet;
5. a roster/group sample;
6. a settlement-scale sample;
7. per-sample recognition checks for face, hair, silhouette, palette, and signature traits.

An asset stays an `approval-candidate` until a human accepts it. A failed cue is recorded explicitly.
For the current settlement sample, face recognition is intentionally **not claimed**; four other cues
carry identity at that distance.

The local `/visual-lab` records accept/revise decisions as append-only notes bound to the exact
catalog version and asset SHA-256. The `/forge/contact-sheet` route prints or exports the deterministic
100-seed distribution used to catch cohort-level repetition and correlation before portrait work.

## Motion

- Dialogue: breathing, eye focus, blink, small posture shifts, mouth shapes, and cloth lag.
- Settlement: gait, dominant-hand task motion, cloak/mantle rhythm, idle routine, and route confidence.
- Injury: reduced range, guarded weight transfer, delayed recovery, and visible treatment state.
- Agent latency: a short focus state; never an endless spinner or hidden chain-of-thought.
- Reduced motion: preserve every critical static state and remove camera sweeps, bobbing, and dense
  particles.

Animation communicates cause and consequence. It never hides death, synthesis, cost, failed action,
or a committed state transition.

## Settlement environment construction

- Environment plates remain hero-free so character rigs, occupancy, equipment, injury, and actions
  can change without regenerating architecture.
- A scene plate must match a versioned topology binding. Building labels, hotspots, routes, and
  activity markers remain code-owned layers rather than painted facts.
- Hearth 01 composes six depths: bitmap architecture, atmosphere, illumination, route projection,
  activity intent, and interaction. Ambient motion freezes under reduced motion.
- Source PNGs remain review artifacts. Runtime delivery is content-addressed WebP with explicit
  byte, decoded-size, and route-bundle budgets.
- A beautiful plate is still an approval candidate. It cannot approve character identity, commit
  movement, imply powered equipment, or silently move a building relative to the content graph.

## Approval rubric

Review each candidate at 100%, roster size, and settlement size:

- **Specificity:** does this feel like one person rather than a genre default?
- **Manifest fidelity:** do age, body, phenotype, posture, handedness, and markers agree?
- **Cross-view identity:** do front/profile/back and expressions preserve face and proportions?
- **State continuity:** do equipment and injury read as layers rather than redesigns?
- **Group separation:** can height, silhouette, and palette be distinguished immediately?
- **Scale survival:** do at least four non-facial cues survive the settlement camera?
- **Production fit:** can the asset be layered, cropped, compressed, and animated without losing truth?

The current pair must be accepted or revised before expanding to twelve representative humans.
