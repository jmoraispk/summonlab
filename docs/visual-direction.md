# Visual direction

The production rules derived from this direction live in the
[Summonlab art bible](art-bible.md). Current hero identity and scale direction is maintained in the
[hero identity and evolution wiki](wiki/art/hero-identity-and-evolution.md).

## Prototype

![Tower and settlement interface prototype](../assets/tower-prototype.png)

[Open the interactive prototype](../prototype/index.html).

The prototype explores one integrated command surface rather than separate management and combat products. The player can switch between settlement, tower, and portal views while the roster, accelerated clock, resources, pending decisions, and social activity remain visible.

## Target feeling

Summonlab should look like arcane machinery trying to classify a human soul.

- Midnight navy and near-black create the world and interface.
- Amber-gold represents agency, summons, chosen actions, and irreversible decisions.
- Muted violet represents possibility, memory, habit, and the unknown tower.
- Cyan represents engine validation, information, and stable system state.
- Warm settlement light contrasts with cold tower geometry.

Rarity should alter geometry, density, sound, and the behavior of light—not cycle through a generic rainbow.

## Product frame

The persistent game shell contains:

- current day, time, and speed multiplier;
- food, ore, aether, and other scarce resources;
- destination switcher for settlement, tower, and portals;
- Master and hero roster with stars, level, health, and current activity;
- selected hero state, needs, habits, plan, and authority belief;
- pending agent decisions and recent event log.

The shell should answer three questions without opening a character sheet:

1. Who needs attention?
2. What is happening while I am away?
3. What decision will matter next?

## Tower view

The tower is a vertical campaign object, not a generic stage selector.

- Show all twenty five-floor bands as a compressed spine.
- Emphasize the current band and next floor rather than drawing 100 identical buttons.
- Mark every fifth floor as a threshold and every tenth as a boss gate.
- Let cleared bands retain scars, trophies, or discovered side paths.
- Display current objective, known hazards, party readiness, secret progress, and extraction route.
- Animate legal possibilities converging into the selected action, echoing the README SVG.

The default prototype shows floor 15, “The Hollow Foundry,” with a hidden route indicator and party silhouettes against a monumental tower cutaway.

## Settlement view

Use a living 2.5D diorama inside one visible wall:

- summoning gate;
- dormitory;
- kitchen;
- training ground;
- workshop and forge;
- infirmary;
- social hall;
- portal chamber;
- synthesis chamber.

The settlement should grow denser and more animated rather than sprawl across a map. Heroes move between buildings according to real schedules. Lighting, occupancy, smoke, meals, training, construction, and damage show the passage of accelerated time.

### Habit visibility

Do not visualize habits as invisible numeric buffs.

- A regular route becomes subtly more confident and direct.
- A repeated activity gains a small routine marker on the schedule.
- Strong cue-action links appear as a compact “after waking → stretch” chain.
- Interrupted habits show the blocking cause: injury, locked building, missing partner, order, or mission.
- Building upgrades visibly reduce friction through better access, capacity, equipment, and teaching.

The player can inspect habit strength, cue, last repetition, and recent outcome without seeing raw model reasoning.

## Portal view

Portals are time-limited mission cards embedded in a spatial chamber, not a permanent world map.

Each portal shows:

- world silhouette and material identity;
- time remaining in real and game time;
- known hazards and environmental rules;
- required extraction condition;
- expected resources;
- heroes currently deployed or preparing.

Portal worlds can vary art direction dramatically while the surrounding chamber and interface keep the product coherent.

## Combat view

![Accepted phone combat direction](evidence/living-village-combat-phone-direction-v1.png)

This is the accepted visual baseline for the first phone combat slice. Preserve its steep top-down
2.5D camera, tile-centered combatants, subtle portrait timeline, exact tile selection outline,
three-line name-only activity feed, and low-profile autonomy and skill controls. New mockups may
change characters and environments without silently resetting these interface decisions.

![Accepted combat motion storyboard](evidence/living-village-combat-motion-storyboard-v1.png)

The locked first action cadence is `focus -> move -> impact -> settle`. Motion can remain fluid, but
the acting character must visibly claim the destination tile before the hit, and the final state must
settle long enough for the battlefield, timeline, and feed to agree.

## Character presentation

### Clean-slate reveal

A summon sequence should reveal a person before a stat sheet:

1. gate geometry maps physical possibility;
2. body silhouette resolves;
3. fragments of temperament and affinity orbit without a biography;
4. star resonance locks into place;
5. the hero looks at the room;
6. the hero speaks or asks a first question;
7. only then do attributes and available actions appear.

The first line should often express disorientation: “Where am I?”, “Who are you?”, or a silent refusal to answer.

### Procedural body and portrait

A reproducible visual seed controls body proportions, face, skin, hair, eyes, age, marks, voice profile, posture, clothing fit, and small idle behaviors. Physiology remains visually consistent until injury, aging, equipment, or major evolution changes it.

Temperament affects animation timing and posture tendencies without freezing one expression onto the character. Culture affects gesture, naming, clothing, and ornament separately from inherited appearance.

Build a developer-facing Character Forge before producing a large cast. It must render seed grids, lock individual fields, compare front/profile/full-body views, test expressions and outfits, and export a canonical physical manifest plus an approved presentation reference. Generated summon cards and cinematic images use that manifest and approved reference views; they never redefine the character.

### Camera hierarchy

- Settlement management uses a hand-composed 2.5D three-quarter view with clickable buildings and visible hero routes.
- Building interiors and conversations use illustrated eye-level or over-the-shoulder compositions with subtle parallax.
- Combat missions use authored steep top-down 2.5D tactical arenas with limited camera movement.
- First-person is reserved for the opening summon and rare confrontation shots.
- Free settlement traversal waits until a one-courtyard experiment proves it adds more embodiment than it costs in visual control.

## Attributes, skills, and growth

Use six compact attribute marks rather than a spreadsheet wall:

- Might;
- Vigor;
- Agility;
- Focus;
- Insight;
- Presence.

Skills appear as practiced motions and tools: sword stance, bow draw, cooking rhythm, spell geometry, hammer technique, or teaching posture.

Promotion at each ten-level threshold adds a visible resonance ring. Major promotions can alter silhouette, clothing integration, aura, or physiology. A `7★` hero should look like the accumulated result of a life, not merely a brighter `1★` portrait.

## Synthesis presentation

Synthesis must feel terminal.

- Use the same gate language as summoning, but run the geometry inward.
- Show the selected hero's identity and relationships before confirmation.
- Make the recipient and source visually distinct.
- Do not use celebratory loot-box motion.
- After resolution, leave a quiet absence in the roster and settlement.
- Let later conversations, avoidance, glances, and routine changes carry the social consequence.

The confirmation screen should name close relationships and known witnesses. It should never pretend the source hero is an interchangeable material.

## Mission animation

Turn-based action can still feel alive:

1. relevant legal targets gain subtle outlines;
2. possible paths gather around the acting hero;
3. selected intent turns gold;
4. validation turns the action cyan;
5. the action resolves quickly;
6. consequences linger on bodies and environment.

Agent latency becomes a short focus animation, not an endless spinner. Show “considering,” “validated,” or “fallback” states without exposing hidden chain-of-thought.

## Animation layers

| Layer | Technique | Use |
| --- | --- | --- |
| Interface geometry | SVG and CSS | Tower bands, stars, pity, habits, legal paths |
| Character portraits | Approved layered raster | Gaze, breathing, speech, posture, injury |
| World characters | Approved authored sprites or cutouts | Work, travel, training, combat, social contact |
| Environment | Layered raster scenes | Day/night, fire, weather, construction, damage |
| Dense effects | Canvas or WebGL | Gate particles, magic, portal fields, crowds |
| Cinematic accents | Camera and compositing | Summon, promotion, boss gate, death, synthesis |

## High-value moments

1. A clean-slate hero asks the Master for an explanation.
2. A habitual training route continues while the player is away.
3. A hero breaks routine because a friend is missing.
4. An unexpected inspect action opens a tower side path.
5. The party reaches a fifth-floor threshold.
6. A promotion replays the choices that earned it.
7. A portal collapses seconds after extraction.
8. The Master dies and the continuous settlement falls silent.

## Animation rules

- Animate cause and consequence, not every available surface.
- Make critical sequences skippable after state commits.
- Respect reduced-motion settings.
- Preserve readable static states.
- Avoid flashing and full-screen luminance jumps.
- Use seeded variation when replay presentation must match.
- Separate simulation time from presentation time.
- Never let animation hide a death, synthesis, resource cost, or failed action.

## Prototype asset scope

The current prototype intentionally uses code-native geometry and interface motion. A production visual slice should next add:

- one painted settlement diorama with day and night states;
- one monumental tower cutaway;
- three approved premium hero identity packets;
- five building activity loops;
- one portal-world environment;
- one deterministic monster family;
- summon, hidden-path, promotion, death, and synthesis sequences.
