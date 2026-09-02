# Hero identity, capability cues, and evolution art

Wiki ID: `art.hero-identity-evolution`

Design status: **accepted visual-generation direction; production experiment pending**.

This page governs hero identity generation beyond the fixed Living Village prototype roster. It
connects physical variation, starting capability, aptitudes, personality, wardrobe, native stars,
and current-star evolution without pretending that an image model is a deterministic procedural
human renderer.

## Reproducible brief, stochastic image

The durable source is a versioned hero design manifest plus the exact approved image bytes. A
manifest can be reproduced from its recorded recipe, but an AI image generation using the same
prompt and seed may still produce a different person or composition. Therefore:

- the recipe deterministically resolves design facts and constraints, not pixels;
- image generation produces candidates and may interpret the brief differently on every attempt;
- each attempt records its prompt, references, dimensions, model/tool provenance, and output hash;
- identity review chooses one high-resolution source image, whose bytes become the approved visual
  anchor;
- roster portraits and combat icons derive from that approved anchor rather than being independently
  invented;
- candidate, approved-source, and runtime assets remain distinct states.

The workflow is an authored, constraint-assisted character studio. It is not a promise of a fully
procedural human generator.

## Generation order

```text
recipe + native stars
        |
        v
identity anchors + coherent physical profile
        |
        v
starting attribute budget with probabilistic physical correlations
        |
        +------> concrete aptitude set
        +------> independent personality
        |
        v
wardrobe DNA + current-star presentation state + affinity state
        |
        v
candidate full-body renders -> approved anchor -> derived small-scale views
```

The generator randomizes bounded ingredients, then resolves compatibility and art-directable cues.
It does not independently roll every visible feature.

## What may be randomized

### Identity anchors

- adult age and apparent age band;
- gender presentation and pronouns;
- height, frame breadth, mass, muscle tone, body-fat distribution, and limb/torso proportions;
- face structure, skin, hair texture, hair mass and silhouette, eyes, grooming, and facial hair;
- handedness, durable marks, tattoos, piercings, and one or more recognition anchors;
- voice and nonvisual identity fields where the broader character system owns them.

These anchors persist through evolution. Hair arrangement, grooming, expression, clothing, and
temporary marks may change, but the approved person cannot be regenerated as a new face or body at
each rank.

### Physical presentation

- stance width and center of gravity;
- grounded, centered, forward, or light weight distribution;
- visible conditioning and whether the build reads as explosive, sustained, mobile, or mixed;
- joint openness, resting tension, gesture size, and habitual posture;
- the way clothing accommodates the body: shoulder ease, hem division, waist support, fabric weight,
  and range of motion.

These are visual-production directions rather than new combat statistics.

### Wardrobe DNA

Every hero receives an outfit system rather than an interchangeable fantasy uniform:

- primary silhouette and layering strategy;
- garment construction, collar, sleeve, waist, legwear, and footwear shapes;
- fabric weight, stiffness, surface treatment, closures, asymmetry, and pattern language;
- maintenance, repairs, stains, age, personal alterations, and one keepsake or signature detail;
- a bounded palette and cultural/technological vocabulary that do not imply phenotype, personality,
  aptitude, morality, or star rank.

The default summon image remains weaponless. Clothing can support movement and capability without
locking a hero to a combat class.

## Capability is suggested, not diagrammed

The accepted attributes remain Might, Vitality, Agility, Dexterity, Intellect, and Spirit. The
image should use concrete, drawable evidence rather than abstract claims such as "has fine motor
habits."

| Attribute | Useful candidate cues | Cues that must not become a rule |
| --- | --- | --- |
| Might | frame and muscle distribution, stable leverage, garment fit across shoulders or legs, forceful stance | large body always means high Might |
| Vitality | robust conditioning, grounded balance, durable bearing, recovery-ready clothing construction | body fat, age, scars, or attractiveness prove Vitality |
| Agility | low visual inertia, mobile stance, free hems, close sleeves, long or coiled movement lines | thinness always means fast |
| Dexterity | precise closures, controlled hand pose when reliably rendered, meticulous wrapping or repair, uncluttered hand silhouette | face shape or social class proves precision |
| Intellect | studied or observant expression, organized clothing, scholarly/student/medical/craft history cues, notes or small personal effects when composition permits | ethnicity, beauty, skull shape, or expensive clothing proves intelligence |
| Spirit | composure, deliberate stillness, centered gaze, ritual or contemplative history cues, disciplined visual rhythm | age, religion, quietness, or affinity proves Spirit |

These are weighted proxies. A scholar may have modest Intellect, a new medical student may be
brilliant or overwhelmed, and a physically imposing hero may also be highly intellectual. The cue
mix creates expectations and occasional surprises; it never reveals exact numbers.

Valid capability combinations always retain a nonzero probability. Strong correlations make some
extreme contradictions very, very rare, but no valid attribute or aptitude combination is forbidden.
An exceptional broad, heavy hero may begin extraordinarily agile; the manifest should treat that as
a rare person and make the final image physically coherent rather than silently rerolling them into
the common case. Invalid anatomy and broken image generation are production failures, not forbidden
character builds.

## Aptitudes: one accepted typed model

New hero design and visual production use only the five aptitude categories defined by the
progression authority:

| Category | Concrete target |
| --- | --- |
| Attribute | one of the six accepted attributes |
| Family | an authored skill family |
| Learning mode | solo practice, guidance, or pressure |
| Variety | stronger benefit from novel contexts |
| Affinity | one accepted affinity |

The legacy four scores named `might`, `finesse`, `insight`, and `resolve` are superseded. They must
not be generated for a new hero, used to direct new art, or treated as the semantic source for an
aptitude. Existing contracts, policies, fixtures, receipts, and replay snapshots that still carry
those scores are compatibility-only technical debt pending a versioned cross-system migration.
There is no authoritative one-to-one conversion from the four legacy scores to the five typed
categories.

Aptitude means training rate or access, not present ability or ultimate ceiling. The visual can
weakly foreshadow an aptitude, but hidden aptitudes must remain discoverable through play rather
than being printed into the costume.

## Personality and appearance

Personality remains independently generated. It can direct expression, gaze, grooming, garment
maintenance, color confidence, ornament density, and how the hero occupies space after both are
known. It does not derive from body, phenotype, stars, affinity, or aptitude.

This independence allows useful combinations: a huge gentle scholar, a slight confrontational
laborer, a meticulous extrovert in visibly repaired clothes, or a reserved hero whose elaborate
outfit reflects cultural practice rather than temperament.

## Native stars and current stars are different visual axes

A hero has both a native-star origin and a current-star evolution state. A native 1★ can eventually
become 5★ and then 7★, so rank art cannot be a collection of unrelated redraws.

### Native-star distinction

A rare native 5★ summon should arrive with more singular visual authorship than a native 1★ summon:
a more unusual silhouette, rarer construction detail, stronger signature motif, more resolved
layering, or a particularly memorable contrast. This is not better anatomy, greater beauty, a more
expensive-looking culture, or higher rendering quality. Every hero receives intentional art; higher
native stars receive a less common starting composition and a stronger initial capability presence.

### Current-star evolution

Current stars control earned visual development. Promotion can change posture, confidence, garment
refinement, personal marks, silhouette emphasis, affinity expression, and the scale of one signature
motif. The drawing must visibly evolve; applying a new frame to the identical body artwork is not a
complete promotion treatment.

The identity lock preserves face structure, body proportions, recognition anchors, wardrobe DNA,
and core palette relationships across every state. Later art should look like the same person after
lived development, not a replacement character.

A nurtured 1★ reaching 5★ may become just as visually singular as a native 5★, but through earned
history and accumulated personal details. A native 5★ begins with a rare, resolved design. At the
same current rank, origin should not be readable as a simple quality hierarchy or expose a hidden
mechanical label to an opponent.

## Evolution packet

Production ultimately preserves, per hero:

1. one immutable identity manifest and approved high-resolution anchor;
2. native-star and current-star fields kept separately;
3. a current-rank evolution brief for 1★ through 7★, even though only 1★ through 5★ are summonable;
4. a continuity sheet comparing at least 1★, 3★, 5★, and 7★ before all seven states are produced;
5. exact prompts, references, candidate hashes, review decisions, and approved source hashes;
6. roster and combat-scale derivatives checked against the same recognition anchors.

The first production experiment should cover twelve 1★ heroes with deliberately broad wardrobe and
physical variation. The strongest identities then receive 1★, 3★, 5★, and 7★ evolution studies so
the team can judge both initial variety and continuity before producing a large roster.

## Integration boundary

This page authorizes hero visual planning and candidate production. It does not modify shared engine
contracts, policies, replay formats, runtime catalogs, or summon tables. Replacing the legacy
four-score aptitude payload requires an integration owner to define a versioned typed schema,
migration and replay compatibility behavior, update every consumer, and validate existing histories.
