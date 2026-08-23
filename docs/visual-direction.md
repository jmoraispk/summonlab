# Visual direction

## Target feeling

Summonlab should look like arcane machinery discovering a human soul: dark, precise systems interrupted by warm, living character.

The current concept art establishes a useful palette:

- midnight navy and near-black for the world and interface;
- amber-gold for summons, agency, and important choices;
- muted violet for possibility, memory, and the gate;
- cyan for validated actions, information, and system feedback.

The visual system should avoid generic rainbow rarity effects. Rarity changes density, geometry, sound, and the behavior of light—not merely the hue of the same explosion.

## Recommended presentation: a living 2.5D diorama

Use layered two-dimensional art with depth, lighting, particles, and camera motion rather than committing immediately to full 3D.

This direction can support:

- a painterly settlement with parallax depth;
- small characters moving between real locations;
- expressive portraits during council and conversation;
- tactical expedition rooms with clear positions and targets;
- elaborate summon effects without requiring a fully modeled world;
- deterministic seeded variation in characters and scenes.

It also matches turn-based pacing: the screen can breathe while a hero thinks, then animate the chosen action decisively.

## Animation layers

Use the simplest renderer that fits each layer:

| Layer | Technique | Examples |
| --- | --- | --- |
| Interface ornament | SVG and CSS | Gate rings, pity meter, rarity stars, legal-action paths |
| Character portraits | Layered raster parts or a 2D bone rig | Breathing, blinking, gaze, mouth, hair, clothing |
| World characters | Sprite sheets or compact rigs | Walking, work, combat, reactions |
| Environment | Layered raster scenes | Parallax, day/night light, fog, fires, banners |
| Dense effects | Canvas or WebGL | Summon particles, weather, spell fields, crowds |
| Cinematic accents | Camera and compositing | Slow push, shake, bloom, silhouettes, wipes |

Do not make every idle surface move. One focal animation plus low-frequency ambient motion feels more expensive than many unrelated loops.

## Signature summoning sequence

A summon should visualize the actual character-generation pipeline.

1. **The gate wakes** — thin violet geometry maps possible identities.
2. **A body resolves** — a silhouette forms from physical trait layers.
3. **A mind branches** — values, motives, and temperament appear as orbiting paths.
4. **A choice ignites** — one warm gold signal moves from the hero outward, showing agency rather than ownership.
5. **Rarity reveals** — star geometry locks into place with increasing complexity.
6. **The hero speaks first** — a generated introductory line reveals attitude before the stat sheet appears.

The player should feel that the gate produced a person, not opened a loot box containing an icon.

### Rarity language

- 1★: one clean ring, grounded light, direct reveal;
- 2★: a second orbital line and stronger silhouette;
- 3★: branching motifs and a short environment response;
- 4★: multi-stage geometry, held anticipation, character-specific accent;
- 5★: the gate briefly changes the surrounding room, then becomes quiet for the first spoken line.

The animation must remain skippable after the result is committed. Skip affects presentation, never randomness.

## Procedural human characters

### Reproducible layers

A `visualSeed` should select and parameterize:

- body height and proportions;
- face shape and feature placement;
- skin tone and surface details;
- hair shape, texture, color, and age effects;
- eyes, brows, nose, mouth, ears, and facial hair;
- scars, marks, and non-genetic details from personal history;
- posture and neutral expression from current state;
- clothing silhouette, material, wear, equipment, and vocation;
- small animated behaviors such as gaze, fidgeting, breathing, or guarded stance.

Portrait parts need shared anchor standards so thousands of combinations do not clip. Generate a deterministic visual manifest and validate it independently from the personality manifest.

### Personality without caricature

Personality may influence posture, expression, gaze duration, personal space, and animation timing, but should not permanently stamp one emotion onto a face. A cautious hero can smile; an extrovert can grieve.

Inherited family traits influence coherent appearance ranges. Culture separately influences clothing, naming, ornament, gesture, and social presentation. Neither should recolor a single face template or imply personality. Clothing and equipment should also reveal profession, resources, climate, and personal modification.

## Settlement screens

### Hearthgate overview

An angled diorama shows every important location: gate, hall, homes, workshop, stores, palisade, farms, and road. Heroes physically move to assignments. Weather, damage, construction, and population change the same scene over time.

Clicking a hero should answer three questions immediately:

1. What are they doing?
2. Why are they doing it?
3. What do they currently care about?

### Council table

Frame the player at one end of a table with heroes arranged by relationship and office. Small posture changes, glances, interruptions, and side reactions make group dynamics visible before dialogue explains them.

Requests can appear as an intent card in the center. Lines connect it to each hero with private willingness hidden until they respond. The visual echoes the SVG banner's legal choices orbiting an autonomous core.

### Relationship constellation

Use a constellation view sparingly for inspection, not as the main game. Nodes represent people; line style represents trust, affection, authority, fear, debt, or conflict. Selecting an edge reveals the events that changed it so relationships remain explainable.

## Expedition and combat screens

Use compact rooms with clear cover, hazards, elevation, exits, interactable objects, and visible objectives. The camera can be isometric or a shallow side perspective, but readable legal targets matter more than spectacle.

During a hero turn:

1. relevant objects gain subtle outlines;
2. a short “considering” motion gathers possibilities around the hero;
3. the selected action path becomes gold;
4. validation turns it cyan;
5. the action animates quickly;
6. intent or dialogue appears only if it adds character.

Never simulate thinking with an endless spinner. Show the bounded choices and the hero's changing focus without revealing hidden model reasoning.

## High-value animated moments

1. **Summon reveal** — identity and agency forming together.
2. **First refusal** — the command card stops, fractures, and returns as a counterproposal.
3. **Kept promise** — a remembered event connects two characters and changes a later decision.
4. **Ascension** — past choices orbit the hero before resolving into a new conviction.
5. **Beacon restoration** — the settlement and world map light together, showing campaign progress.
6. **Raid preparation payoff** — defenses built earlier activate in the same living settlement view.

## Animation principles

- Animate cause and consequence, not decoration.
- Keep autonomous loops slow and subtle.
- Make every critical animation skippable or accelerable.
- Respect reduced-motion settings.
- Preserve a finished static frame for SVG and loading states.
- Avoid flashes and rapid full-screen luminance changes.
- Use seeded variation for particles and timings when a replay must match.
- Separate simulation time from presentation time.

## Asset strategy for the prototype

Start with one excellent reusable scene instead of many thin scenes:

- one Hearthgate background with day, evening, and raid lighting;
- three modular human portrait sets;
- four vocation clothing kits;
- a small shared library of body and face parts;
- one goblin family with several equipment variations;
- one gate animation assembled from code-native rings and particles;
- one expedition room kit;
- one conversation and council presentation.

The prototype should prove that procedural people remain visually coherent and emotionally readable before expanding the species catalog.
