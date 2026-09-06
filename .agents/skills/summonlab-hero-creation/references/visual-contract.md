# Hero visual-trio contract

## Shared identity

Every visual trio depicts one original adult person. Before generation, author a visual brief
containing:

- display name, adult age, gender presentation, skin, face structure, and controlled expression;
- height language, frame breadth, shoulder and hip relationship, torso and limb proportions, body
  fat, muscle distribution, posture, and center of gravity;
- hair color, texture, length, mass, parting, shaved areas, braids, ties, and silhouette;
- garment silhouette, layers, collar, sleeves, waist, legwear, footwear, materials, closures,
  repairs, patterns, and bounded palette;
- optional jewelry, earrings, necklaces, bracelets, piercings, tattoos, scars, keepsakes, or other
  durable recognition anchors;
- a compact character kernel: dominant trait, counter-trait, social edge, maintenance attitude, and
  one drawable consequence.

When the user supplies aptitude information, use only the accepted Attribute, Family, Learning
mode, Variety, and Affinity categories. Aptitudes may weakly influence concrete pose or clothing
cues, but this visual skill does not author or change canonical gameplay statistics.

For batches of 2–10, write a variation grid before prompting. No two heroes should share the same
combination of body construction, hairstyle silhouette, wardrobe family, palette family, and
signature detail. Variation includes ordinary, slight, soft, heavy, athletic, muscular, and
bodybuilder bodies where the request permits; it must not collapse into ten similarly ripped people.

## Rendering register

Use cinematic semi-realistic painted game-character art. Preserve believable adult anatomy, skin,
hair, textiles, leather, and metal while retaining a deliberate illustrated finish. Do not use
literal photography, pore-and-lens photorealism, plastic 3D rendering, anime simplification, or cel
shading. Keep facial acting restrained unless the brief explicitly requires otherwise.

Default to a full-body, weaponless, affinity-neutral, standing three-quarter portrait on a simple
warm parchment studio field. Keep the complete hairstyle, both hands, all clothing, and both feet
inside comfortable margins. No rarity frame, stars, interface, label, logo, watermark, or text.

Native stars affect authored singularity rather than dignity or rendering quality. Higher native
stars may have a rarer silhouette, more resolved construction, or a stronger signature motif. They
must not be more beautiful, more anatomically correct, or more culturally expensive by default.

## Summon prompt shape

Render the following slots into complete prose. Preserve this order; include only relevant optional
details:

```text
Create one original adult Summonlab hero as a full-body vertical character portrait.

Identity: {identity_and_face}. Physical construction: {body_and_posture}. Hair:
{hair_construction}. Wardrobe: {wardrobe_construction_palette_and_footwear}. Personal details:
{accessories_tattoos_marks_and_kernel_consequence}.

Native/current rank: {native_stars}★ / {current_stars}★. Express rank through authored silhouette
and construction only; do not draw stars or a card frame. Affinity: {affinity_instruction}.

Cinematic semi-realistic painted game-character art with believable adult anatomy and materials,
warm cohesive color, restrained facial acting, and a clean readable silhouette. Weaponless, no
equipped gear. Show the entire hairstyle, both hands, all clothing, and both feet inside comfortable
margins with a small grounding shadow on a simple warm parchment studio field. Vertical 1024x1536.

Exactly one person. No magic unless affinity was explicitly requested. No rarity frame, stars, UI,
label, logo, watermark, text, published-character resemblance, photography, plastic 3D, anime, cel
shading, broken anatomy, duplicate limbs, fused hands, or cropped extremities.
```

## Chibi identity lock

The selected summon provider source is the chibi's sole visual authority. Preserve:

- the same face, apparent age, skin, gender expression, and durable marks;
- the same body construction and mass distribution;
- relative shoulder width, arm and wrist girth, hand size, torso and hip width, and leg length;
- exact hairstyle color, front/side silhouette, gathered mass, and shaved areas;
- garment construction, layer order, palette, footwear, accessories, tattoos, and repairs.

Do not generically widen the shoulders, inflate the torso, thicken arms or hands, add fat or muscle,
or shorten the limbs to make the result “cute.” A muscular source remains muscular; a slight, soft,
heavy, lanky, ordinary, or unusually proportioned source remains itself.

## Chibi prompt shape

```text
Create a new full-body combat chibi of the adult hero in the single supplied summon reference. This
is the same person, not a reinterpretation. Preserve exactly the reference hero's face, apparent
age, skin, body construction and mass distribution, hairstyle silhouette, wardrobe construction and
palette, footwear, accessories, tattoos, markings, and restrained expression.

Proportion contract: render the complete standing figure at a target of 5.0 anatomical heads tall,
measured from the top of the skull to the chin and repeated to the soles of the feet. Do not count
hair volume, hats, horns, or ornaments as part of the head unit. Use a moderately enlarged stylized
head, a clearly developed adult torso, naturally long limbs, source-faithful shoulders and hips,
and source-faithful arm, wrist, hand, thigh, and calf girth. Do not make the hero baby-like,
super-deformed, fatter, more muscular, broader, shorter-limbed, or puffier than the reference.

Keep the accepted cinematic semi-realistic painted game-character style: warm cohesive color,
believable anatomy and materials, controlled expression, and a clean combat-readable silhouette.
Show the entire hairstyle, both hands, all clothing, and both feet inside comfortable margins with a
small grounding shadow on a simple warm parchment studio field. Vertical 1024x1536.

Weaponless. No magic, affinity effects, aura, rarity frame, stars, interface, label, logo, watermark,
or text unless the source itself contains an explicitly requested affinity cue. Not photography,
plastic 3D, cel anime, caricature, toddler, mascot, or bobble-head art. Do not duplicate, fuse, omit,
or crop anatomy. The supplied summon reference is the only visual authority.
```

## Village-cutout identity lock

The Village uses the hero at normal proportions, never the combat chibi and never an opaque portrait
card. The summon provider source is the cutout's sole `identity-pixel-authority`. Background removal
is the only intended visual change: preserve the existing pose, face, body construction, hairstyle,
clothes, palette, accessories, silhouette, and crop. Remove the parchment studio field and grounding
shadow to true alpha. Do not repaint, restyle, redraw, add scenery, add an outline, or invent hidden
anatomy.

## Village-cutout prompt shape

```text
Create a transparent-background cutout from the single supplied summon portrait. Keep the exact same
normal-proportion adult hero in the exact same pose and crop. Preserve the face, apparent age, skin,
body construction, hairstyle, wardrobe, palette, footwear, accessories, markings, silhouette, and
painted rendering. The supplied summon portrait is the sole identity-pixel-authority.

Remove only the warm parchment studio field and the grounding shadow. Outside the complete character,
use true transparent alpha to every canvas edge. Keep the entire hairstyle, both hands, all clothing,
and both feet visible with comfortable transparent margins. Vertical 1024x1536 PNG.

No new pose, chibi proportions, repainting, restyling, scenery, floor, pedestal, portrait plate,
outline, glow, aura, frame, UI, label, logo, watermark, text, added or omitted anatomy, or opaque
background. Do not invent pixels behind overlapping parts of the existing character.
```
