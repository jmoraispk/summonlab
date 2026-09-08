# Hero identity, capability cues, and evolution art

Wiki ID: `art.hero-identity-evolution`

Design status: **accepted visual-generation direction; 200-hero summon roster approved and bound**.

This page governs hero identity generation beyond the fixed Living Village prototype roster. It
connects physical variation, the four combat attributes, a separate hidden learning profile,
personality, history, wardrobe, native stars, and current-star evolution without pretending that an
image model is a deterministic procedural human renderer.

## Accepted rendering register

Hero art uses **cinematic semi-realistic painted character art**. The accepted realism ceiling is
the [Ochre Braid progression reference](../../../assets/heroes/visuals/style-references/current-hero-rendering/ochre-braid-progression-reference.png),
whose manifest explicitly limits approval to rendering direction.

The target combines believable adult anatomy, weight, skin, hair, textile construction, leather,
and metal with a polished painterly game-key-art finish. It must not be pushed into literal
live-action photography, photo-specific pore or lens treatment, plastic 3D surfaces, anime
simplification, or cel shading. “Realistic” in older hero planning documents means materially and
anatomically believable inside this painted register; it does not authorize photorealism.

Expression belongs to identity and scene context, not rank. Evolution must not manufacture a smile,
grin, theatrical anger, or exaggerated facial acting merely to make a later form feel different.
Unless a scene brief explicitly requires another expression, continuity studies preserve the
anchor's calm, controlled facial affect.

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

## Current summonable roster

The approved player pool is `summonable-heroes-v1`: exactly 200 named, native-1★ identities, split
100 women and 100 men. These are the heroes normal player summoning selects from. Each catalog entry
binds one stable `human-v6` character draft to its exact approved summon portrait and combat chibi;
the pair is one identity, never two independently selectable images.

The v2 catalog source of truth is
`assets/heroes/approved/summonable-roster-v1/catalog.json`. It records the immutable experiment
paths, SHA-256 hashes, dimensions, approval ID, character manifest, and stable asset keys. Nineteen
heroes use the explicitly approved v3 chibi correction; the other 181 use their completed five-head
regeneration. Candidate PNGs remain production evidence. The v2 runtime manifest is
`apps/web/static/runtime/summonable-heroes-v1/manifest.json`; its WebP derivatives are bound to the
exact character-manifest hash and loaded in a lazy bundle for that hero.

Only these base 1★ forms are approved here. Their 2★–7★ current-star art remains future evolution
production and must preserve the identity rules below.

### Combat chibi derivative

The chibi is the hero's combat representation, not a second independently invented character. It
derives from the selected summon anchor and preserves the face, skin, age cues, dominant hairstyle
silhouette, body-mass silhouette, wardrobe construction and palette, footwear, and the few
accessories or tattoos that survive at combat scale. Chibi stylization enlarges the head and
simplifies shapes, but it must not use wider shoulders, thicker upper arms or forearms, a wider
torso, shorter limbs, added fat, or added muscle as a generic shortcut to cuteness. Relative
shoulder width, arm girth, wrist size, torso and hip width, leg length, body fat, and muscle
distribution all derive from the summon anchor. Deliberately muscular heroes remain muscular;
slight, lanky, gangly, soft, heavy, and otherwise unusually proportioned heroes remain themselves.

The accepted combat-chibi target is **5.0 anatomical heads tall**, measured from skull crown to chin
and excluding hairstyle mass. AI generation does not make the prompt's number mechanically exact;
five heads is the shared art direction rather than a computer-vision acceptance score. Face, age,
body construction, shoulder width, arm and wrist girth, torso and hip width, leg length, hairstyle,
wardrobe, and durable marks must agree with the summon anchor.
Tallness and gangliness survive through narrowness, posture, hairstyle, and relative limb language.
Hands may be simplified for readability, but they should not become disproportionately huge unless
large hands are a deliberate source trait. The selected summon portrait is the only image reference
for regeneration; the historical chibi remains comparison evidence and is not fed back into the
model.

Warm color cohesion is a useful strength of the chibi treatment. It may inform a summon-art
correction when the result stays inside the hero's established palette, but it does not authorize
recoloring the identity or introducing affinity cues.

Candidate chibis are produced alongside 1★ summon candidates so identity transfer can influence
selection. The review unit is always the visible summon/chibi pair; reviewers should not need to
switch modes to compare bodies. They do not become runtime assets at the same moment as the summon
art: selected fighters still require clean alpha, consistent canvas and footprint normalization,
small-scale recognition review, and explicit promotion.

### Village-cutout derivative

Every newly created hero visual identity also includes a `village-cutout`: a normal-proportion,
transparent PNG derived from the selected summon portrait. It is the same painted hero in the same
pose and crop, with only the parchment studio field and grounding shadow removed. The summon provider
source remains its sole `identity-pixel-authority`. It is not a combat chibi, a new pose, a repaint, or
an opaque portrait card placed over the scene.

The hero-creation candidate unit is therefore a visual trio: summon portrait, combat chibi, and
Village cutout. A cutout must contain true alpha, leave all canvas edges transparent, and preserve
comfortable margins around the entire character before the candidate batch can validate. Approval
and runtime promotion remain separate lifecycle steps.

The approved 200-hero `summonable-heroes-v1` catalog now has three approved pilot cutouts: Yaso
Dreno, Oren Sorin, and Joror Pelleth. The other 197 heroes remain in the explicit cutout backfill
and approval queue. A persistent Village scene may render only a catalog-approved cutout; when a
current-company hero has no approved cutout, it uses a labeled non-character missing-art marker
rather than a chibi, opaque portrait, or invented vector substitute.

## Generation order

```text
recipe + identity inputs
        |
        v
identity anchors + coherent physical profile
        |
        +------> four combat attributes with probabilistic physical cues
        +------> separate hidden learning profile
        +------> independent personality and history
        |
        v
wardrobe DNA + native/current-star presentation + affinity state
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

Hairstyle is a first-class silhouette control, not a finishing detail. Mass-generation batches
should deliberately vary hair texture, mass, length, asymmetry, shaved areas, braids, twists, curls,
head wraps, and grooming while avoiding the same fashionable silhouette on every hero. Jewelry,
bracelets, necklaces, earrings, piercings, tattoos, and other durable personal marks may be used
freely at 1★ when they clarify identity. They are personal design language, not automatic evidence
of rank, affinity, hidden learning, wealth, morality, or culture.

They are also optional. A mass-generation wave should include many heroes with no tattoos and no
visible jewelry. Body construction, hair, garment silhouette, repairs, pattern, closures, keepsakes,
or asymmetry can supply the memorable “cool” anchor instead.

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
  hidden learning, morality, or star rank.

The default summon image remains weaponless. Clothing can support movement and capability without
locking a hero to a combat class.

## Capability is suggested, not diagrammed

The accepted visible combat attributes are Might, Vitality, Agility, and Spirit. The image should
use concrete, drawable evidence rather than turning a score into physiognomy.

| Attribute | Useful candidate cues | Cues that must not become a rule |
| --- | --- | --- |
| Might | frame and muscle distribution, stable leverage, garment fit across shoulders or legs, forceful stance | large body always means high Might |
| Vitality | robust conditioning, grounded balance, durable bearing, recovery-ready clothing construction | body fat, age, scars, or attractiveness prove Vitality |
| Agility | low visual inertia, mobile stance, free hems, close sleeves, long or coiled movement lines | thinness always means fast |
| Spirit | authored magical practice cues, a focus, ritual wear, or controlled magical residue when the brief permits it | religion, quietness, composure, morality, or affinity proves Spirit |

Learned precision, knowledge, scholarship, medicine, and craft may still appear through clothing,
tools, repairs, notes, and lived history. They are skill and experience cues, not extra attributes or
evidence of an IQ score. A scholar may learn slowly, a new medical student may be brilliant or
overwhelmed, and a physically imposing hero may also be highly intellectual. Art never reveals an
exact attribute or hidden learning value.

Valid capability combinations always retain a nonzero probability. Strong correlations make some
extreme contradictions very, very rare, but no valid combat-attribute or learning-profile
combination is forbidden. An exceptional broad, heavy hero may begin extraordinarily agile; the
manifest should treat that as a rare person and make the final image physically coherent rather
than silently rerolling them into the common case. Invalid anatomy and broken image generation are
production failures, not forbidden character builds.

## Learning profile: one accepted typed model

New characters generate learning separately from combat attributes:

| Category | Mechanical target |
| --- | --- |
| Cognitive learning | one hidden bounded score used only for comprehension-heavy practice |
| Domain learning | martial, magical, crafting, survival, or social practice |

The legacy aptitude scores named `might`, `finesse`, `insight`, and `resolve` remain only in
historical state and the versioned `legacy-auto-v1` compatibility boundary. They must not direct new
art or become the source for a new learning profile.

The hidden learning profile changes training rate, not present ability, decision quality, or human
worth. The visual can weakly foreshadow observed practice, but hidden scores must remain
discoverable through play rather than being printed into the costume.

## Personality and appearance

Personality remains independently generated. It can direct expression, gaze, grooming, garment
maintenance, color confidence, ornament density, and how the hero occupies space after both are
known. It does not derive from body, phenotype, stars, affinity, or hidden learning.

This independence allows useful combinations: a huge gentle scholar, a slight confrontational
laborer, a meticulous extrovert in visibly repaired clothes, or a reserved hero whose elaborate
outfit reflects cultural practice rather than temperament.

Mass visual production generates a compact character kernel before the portrait: two or three
temperament descriptors with a tension, social presentation, grooming and maintenance attitude,
color and ornament taste, two cultural fragments, one noncanonical life echo, and one drawable
posture or gesture cue. The image prompt receives only concrete visual consequences. It does not use
personality to redesign facial anatomy, body type, gender, phenotype, beauty, or intelligence.

The kernel must have a high-salience dominant trait, a counter-trait, a social edge, and a distinct
visual consequence. Generic agreeable clusters are production failures. Strong personality still
uses restrained facial acting: posture, grooming, maintenance, silhouette, asymmetry, pattern,
color, and personal objects carry character without compulsory smiles, grins, or theatrical anger.

Do not spend a complete authored biography on every unreviewed candidate. The clean-slate summon has
cultural, gestural, and taste fragments but no autobiographical memory, so a pre-art “life echo” is
visual vocabulary rather than a remembered hometown, family, profession, or deed. After a pair is
kept, expand its kernel into voice, values, drives, fears, and other authored material; the hero's
actual biography, relationships, habits, and remembered history grow through play.

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

Mass-generation review waves contain sixteen 1★ heroes with deliberately broad wardrobe, hair,
body, accessory, and tattoo variation. A wave may carry forward explicitly requested favorites, but
preselection references must be regenerated in the current rendering register and labeled
separately from new or reinterpreted candidates. Once a pair receives an explicit Keep, its accepted
sides should be preserved rather than gratuitously regenerated. The strongest identities then
receive 1★, 3★, 5★, and 7★ evolution studies so the team can judge both initial variety and
continuity before producing a large roster.

After a reviewed wave, explicit Keep decisions survive into the next pair review. Correct only the
failed side of a surviving pair when possible: the wave-002 carry-forward retained Ochre Braid and
Nera Voss unchanged, narrowed Oren Dae's chibi shoulders and arms to match his slight summon body,
and added modest lean muscle and warmer paint cohesion to Zuri Pell's summon while preserving her
narrow frame and accepted chibi. Rejected or undecided photographic identities do not constrain new
people; replacements are generated as new text-authored humans using only the accepted rendering
reference.

## Rendering decision record

- On 2026-09-02, the owner rejected the literal photographic/ultra-realistic branch after direct
  comparison and accepted the cinematic semi-realistic register above.
- The photographic progression and one-star shortlist experiments remain retained as rejected
  review evidence. Their pixels and prompts must not be used as forward hero-style references.
- The shortlist-first production workflow remains viable independently of the rejected rendering
  style: generate 1★ identity candidates, approve anchors, then invest in their evolution states.
- On 2026-09-02, the owner kept Ochre Braid, Nera Voss, Oren Dae, and Zuri Pell from mass wave 001.
  Wave 002 records that exported decision file as review evidence and presents those survivors
  beside twelve completely new painted identities.
- Wave-002 review reinforced the pair-first rule, requested a more standard head ratio for Tor
  Venn's chibi, identified oversized hands or arms as recurring translation risks, and rejected a
  hairstyle that changed gender expression at chibi scale. The next mass run therefore binds hair
  silhouette and gender-expression cues explicitly and makes ripped bodies rare rather than the
  default.
- On 2026-09-04, a three-hero comparison at nominal 4.0, 4.5, and 5.0-head targets established 5.0
  anatomical heads as the combat-chibi standard. The owner selected it for the complete approved
  200-hero roster. The regeneration run has no pilot or owner-review checkpoint; it produces all 200
  candidate-only images using each selected summon portrait as its sole visual authority.
- The corresponding `five-head-chibi-regeneration-001` production run completed all thirteen waves:
  200 summon-bound primary calls produced 200 readable `1024x1536` provider PNGs, 200 byte-identical
  candidates, and 200 strict receipts. One journaled provider-no-output primary received the single
  allowed versioned retry.
- On 2026-09-05, the owner approved all 200 generated heroes as the finite summonable roster. The
  later nineteen-entry v3 correction approval overrides those heroes' regenerated chibis; the other
  181 regeneration results are accepted. The catalog and lazy runtime manifest now preserve the
  exact summon/chibi pair for every hero.

## Integration boundary

This page authorizes hero visual planning, candidate production, and maintenance of the approved
hero catalog and its derived lazy runtime visuals. Player summon selection may consume the approved
catalog through the character package, but combat rules, policies, replay formats, affinity tables,
and unrelated shared catalogs remain outside this visual-production decision. The `character-v2`
and `engine-v25`/`engine-v26` capability profiles already supply typed four-attribute and
hidden-learning data.
Adoption of those fields by paired visual manifests remains future, versioned integration; until
then, art records must not invent missing capability data.
