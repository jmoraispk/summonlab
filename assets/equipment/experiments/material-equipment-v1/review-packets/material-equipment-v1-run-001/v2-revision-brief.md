# Material Equipment v2 revision brief

Status: **owner feedback recorded; vocabulary decisions pending**.

This brief translates review feedback from `material-equipment-v1-run-001` into rules for a future
revision. It does not modify, relabel, approve, or promote any v1 production evidence. Revised
assets must use a new collision-safe v2 namespace and a fresh provenance chain.

## Review-state language

The canonical result schema uses `candidate`, `revise`, and `failed`. These are machine-checklist
states, not aesthetic ratings:

| Canonical state | Human-facing reading | Meaning |
| --- | --- | --- |
| `candidate` | Pass | Every recorded worker criterion passed; still unapproved |
| `revise` | Check | An image exists, but at least one strict criterion was flagged |
| `failed` | No image | No usable image was returned |

For v2 review aids, use **Pass**, **Check**, and **No image** prominently. Preserve the canonical
state in provenance. Treat 8% empty space as a composition target and 5% as the proposed hard
minimum; tier-to-tier pose consistency is more important than adding empty space beyond that
minimum. This framing change requires a new profile rather than rewriting v1 results.

## Weapon consistency anchors

Every material tier within a Weapon class must use the same camera, pivot, normalized scale, and
presentation angle. The material and construction may change; the comparison pose must not.
Nothing lies flat on the floor.

| Class | V2 anchor |
| --- | --- |
| Sword | Upright with one consistent slight diagonal; comparable blade-to-frame length at every rank. Lengthen Iron. |
| Dagger | Upright; Copper and Iron are the pose references. Repose Blacksteel from horizontal to upright. |
| Spear | Upright with a slight diagonal and consistent head-to-shaft proportion. Reduce the F-rank head. |
| Bow | Match placement, cant, draw profile, and normalized height across all materials. |
| Axe | Upright with a slight diagonal matching the current F-rank composition. Avoid a perfectly vertical shaft. |
| Mace | Upright with a slight right diagonal. Lengthen the F- and E-rank hafts while keeping total length below a Sword. |
| Staff | Upright with a slight right diagonal by default. The leading crown or branch must follow the shaft gesture rather than becoming a separate vertical line. |

Confirmed v1 pose deviations to correct are: Steel and Blacksteel Swords too vertical; Blacksteel
Dagger horizontal; Yew and Spiritwood Bows mirrored; Iron, Steel, and Skyiron Axes too vertical;
Copper, Blacksteel, and Sunsteel Maces horizontal; and Skyiron Mace leaning opposite the class
direction. Ash Staff needs a new image. Spiritwood Staff may keep its owner-liked left lean if its
leading branch follows the same gesture. Sunsteel Shield should return to the established upright
heater-shield family if it is regenerated.

A double-bit war axe is useful visual variety, but putting it only at selected ranks would make
rank read as weapon subtype. Recommended boundary: keep the primary material ladder on one
single-bit comparison silhouette and reserve double-bit war axes for a later named or crafted
variant. If double-bit becomes the canonical Axe instead, apply it consistently to every rank.

## Armour consistency anchor

The Coarse Hide full set is the camera and display reference: a mild three-quarter front view,
approximately 15 degrees toward frame-left, with the same stance, scale, camera height, and
footprint carried by image reference into every other set.

- use the same three-quarter view and facing direction at every rank;
- keep the turn moderate—never straight-on and never rotated past the reference into the opposite
  direction;
- show an empty, self-supported set with subtle interior cavity shading;
- do not place a body, black void figure, or visible mannequin inside it;
- include a readable Head item in every full-set image;
- preserve the class silhouette: Light Armour stays mobile, Heavy Armour stays protective, and
  Robes stay cloth-led;
- after a full set is accepted as a consistency source, produce Head, Torso, Legs, and Boots as
  four separate images without redesigning them.

The current prompt explicitly requested a featureless charcoal display form, so the visible black
mannequins were a production-brief error rather than an arbitrary generator choice. Missing Head
items are confirmed in Boiled Leather, Beast Scale, Layered Silk, and Ancient Dragon Scale. Visible
mannequins are confirmed in Hemp Weave, Boiled Leather, Beast Scale, Layered Silk, Spellweave, and
Ancient Dragon Scale. Light-Armour silhouettes also need correction in Chitin, Drakescale,
Wyrmscale, and Ancient Dragon Scale.

The review term “impweave” most likely refers to Hemp Weave, whose image contains the described
black oval display form. “Sheeting armour” most likely refers to Chitin. These interpretations stay
provisional until owner confirmation. Spellweave and Chitin are positive design references,
subject to the common camera and empty-interior rules.

## Vocabulary proposals

These names are proposed for the canonical wiki and v2; they must not be applied to v1 evidence.

| V1 name | Proposed v2 name | Rationale | Impact |
| --- | --- | --- | --- |
| Copper | Bronze | More credible and recognizable as a weapon and armour alloy | 11 planned images; 7 generated roots |
| Ash | Ash or Oak | Ash is a real, strong, elastic weapon wood; Oak is the more immediately familiar name | 2 planned and generated roots; Ash Staff has no image |
| Boiled Leather | Hard Leather | Simpler player-facing term for hardened leather | 5 planned images; 1 generated root |

Recommended simplicity choice: **Bronze**, **Ash**, and **Hard Leather**. Ash remains preferable to
Oak when one F-rank wood must plausibly cover bows, staves, and hafts; choosing Oak instead is a
vocabulary/readability decision, not a realism correction.

## Revision boundary

The three possible vocabulary changes affect 18 of 161 planned targets and 10 of 77 generated root
targets. The v1 manifest, allocation, packets, results, run journal, images, and contact sheets are
hash-bound evidence and remain immutable. A v2 production effort must:

1. create `assets/equipment/experiments/material-equipment-v2/` with new target and run IDs;
2. bind a new visual profile containing these consistency anchors;
3. regenerate changed or visually rejected roots rather than renaming old images;
4. accept Armour full-set sources before producing their four separated pieces;
5. keep approved sources and runtime exports separate from candidates.
