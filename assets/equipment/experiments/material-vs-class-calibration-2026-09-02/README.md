# Material-vs-class calibration — 2026-09-02

Status: **experiment-only**. These images are not manifest production candidates, approved sources,
or runtime assets. They compare two concept-development approaches before another Equipment run is
authorized.

## Owner direction decision — 2026-09-02

The owner accepted both sheets as **direction references** for the rank-first production plan while
keeping them outside candidate and runtime paths:

- the Dagger progression is the benchmark for rank readability and silhouette ambition;
- the Steel cohort is the finish reference, with its Axe, Spear, Dagger, Shield, and Heavy Armour
  called out positively;
- rank progression is the primary design axis;
- shared material palette, finish, and construction language are secondary coherence checks.

## Outputs

| Approach | File | Dimensions | SHA-256 |
| --- | --- | ---: | --- |
| A — same material cohort | `approach-a-steel-material-cohort-v1.png` | 1624×969 | `6749ad1a65b995f48b89b0c1c8c8ee051da145315f5fd60775803f691ad7b887` |
| B — one class progression | `approach-b-dagger-class-progression-v1.png` | 1774×887 | `6ecc2035df1272044ca96a0f033977e6de3bad02cd1e855c4f04cad9a45394b2` |

Both were generated with the built-in image-generation tool. Five owner-provided weapon images
were supplied as inspiration-only inputs: the black/copper and silver/blue Daggers, and the purple,
crimson/gold, and radiant/gold Sword references in
[`assets/equipment/references/2026-09-02-owner-weapon-inspiration`](../../references/2026-09-02-owner-weapon-inspiration/README.md).
The prompts explicitly prohibit copying recognizable designs.

## What the comparison tests

- Approach A asks one generation to establish a shared Steel construction language across equipment
  classes.
- Approach B asks one generation to distinguish seven metal ranks while holding the Dagger class,
  presentation, and scale constant.
- The production workflow should use both axes, prioritizing class progression before checking each
  material cohort for palette, finish, and construction coherence.

## Immediate observations

- Approach A has strong surface, lighting, and construction cohesion. Its silhouettes remain fairly
  conservative, and its Armour display does not yet prove the required empty-set presentation.
- Approach B communicates rank escalation and silhouette change much more clearly. Its seven designs
  still share enough blade-and-guard language to read as one class.
- Neither sheet is a source for cropping. They are review evidence for choosing a production method.

## Exact prompt — Approach A

```text
Use case: stylized-concept
Asset type: reference-only game equipment calibration sheet, Approach A — same material cohort
Primary request: create one original concept sheet showing a coherent family of seven Standard-craftsmanship STEEL equipment designs generated as one material cohort: sword, dagger, spear, single-bit axe, long-hafted flanged mace, medium shield, and an empty self-supporting heavy armour set. The purpose is to test whether designing all equipment for one material together creates stronger material consistency.
Input images: the provided weapon images are inspiration references only for silhouette ambition, negative space, and willingness to make fantasy weapons visually exciting. Do not reproduce or closely imitate any recognizable weapon, motif, palette, or ornament from them.
Scene/backdrop: midnight-charcoal studio presentation ground, subtle floor plane
Style/medium: premium realistic painterly dark fantasy game concept art; grounded medieval construction; polished but not photoreal
Composition/framing: a clean 4-by-2 catalog grid with seven separate unframed cells and one empty cell; one complete item per cell; all items large and readable; consistent three-quarter product presentation; no overlaps
Lighting/mood: cold key light with a restrained warm rim
Color palette: honest forged steel, neutral dark leather and wood secondary components, restrained warm highlights
Materials/textures: visibly cohesive worked-steel vocabulary across the family—shared forging logic, edge treatment, joinery, wear, and restrained ornament—while every equipment class has its own unmistakable silhouette
Constraints: original designs; practical class readability; basic level of coolness; no item is a mere recolor of another; standard equipment rather than legendary relics; armour is empty with natural cavity shadow and no mannequin; no text, labels, borders, logos, trademarks, characters, hands, scenery, or watermark
Avoid: identical silhouettes, excessive spikes, implausible joins, tiny objects, flat orthographic blueprint presentation, copying the reference images
```

Built-in output:
`/home/joao/.codex/generated_images/01a05d9f-98a4-7632-b46c-592ff8d726ac/exec-d1c02406-b383-473b-a14a-e4e129e38be2.png`

## Exact prompt — Approach B

```text
Use case: stylized-concept
Asset type: reference-only game equipment calibration sheet, Approach B — one class across materials
Primary request: create one original concept sheet showing seven DAGGERS as a deliberate material-and-rank progression: Bronze F, Iron E, Steel D, Blacksteel C, Skyiron B, Starmetal A, and Sunsteel S. The purpose is to test whether designing the whole class progression together produces distinct silhouettes without losing class recognition.
Input images: the provided weapon images are inspiration references only for silhouette ambition, negative space, asymmetric curves, and exciting fantasy proportions. Do not reproduce or closely imitate any recognizable weapon, motif, palette, or ornament from them.
Scene/backdrop: midnight-charcoal studio presentation ground, subtle floor plane
Style/medium: premium realistic painterly dark fantasy game concept art; grounded construction that becomes progressively more fantastical
Composition/framing: seven separate unframed vertical catalog cells in a clean row or evenly balanced grid; every dagger point-down with grip high and a moderate right diagonal; identical camera, normalized footprint, and lighting; each complete dagger large and readable; no overlaps
Lighting/mood: cold key light with a restrained warm rim
Color palette: material-authentic progression—warm bronze, plain iron, refined steel, dense dark blacksteel, pale atmospheric skyiron, luminous starmetal, restrained solar sunsteel—secondary grips and fittings remain subordinate
Materials/textures: each tier must change construction and silhouette, not merely color; Bronze practical and appealing, Iron sturdy, Steel refined, Blacksteel bold, Skyiron elegant and light, Starmetal extraordinary, Sunsteel legendary; increasingly ambitious guards, blade geometry, cutouts, proportion, and ornament while all remain recognizable one-hand fighting daggers
Constraints: original designs; one dominant silhouette idea per dagger; readable at phone-thumbnail size; no duplicate geometry; no swords; no text, rank labels, borders, logos, trademarks, characters, hands, scenery, or watermark
Avoid: direct copying, seven recolors of one template, excessive visual noise at low ranks, implausible grips, horizontal or floor-lying weapons
```

Built-in output:
`/home/joao/.codex/generated_images/01a05d9f-98a4-7632-b46c-592ff8d726ac/exec-7d194f45-99aa-4840-ba44-e66e8f907044.png`
