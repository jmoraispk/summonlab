# Task 3 report: Toma v4 run-cycle rebuild

## Animation clip brief (resolved before generation)

```text
Character / clip: Toma / iron-guardian / advance run, five-frame loop
Action authority: classical-human-run-5
Motion sentence: Toma drives through one complete heavy run cycle: left contact and compression, a compact airborne pass, then unmistakable right contact and recovery into the left-foot loop return.
Frame beats (left to right): 1. Contact A — left foot reaches and accepts weight while the right leg trails. 2. Compression A — left knee loads and the center of mass reaches its low point. 3. Airborne pass — neither foot is planted, clear white air is visible under both feet, and the right knee passes forward. 4. Contact B — right foot lands clearly ahead in a silhouette unmistakably distinct from frame 1. 5. Recovery B — weight moves over the right foot while the left leg advances toward frame 1.
Support/contact sequence: left, left, none, right, right
Loop seam or terminal state: frame 5 is right-foot recovery and must continue naturally into frame 1 left-foot contact without a pose snap.
Accepted source path / version / SHA-256 / approval record: assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v3.png / v3 / b22c5390f290abf4ff3cca9540c713eb30d1045ed4f1c9573389a8d223df99d9 / PROVENANCE.md records v3 as the accepted source binding and candidate awaiting owner playtest; the task-3 ledger ruling requires decoded raw-pixel preservation of source rows 1, 3, and 4 (one-based).
Identity and equipment locks: identity reference apps/web/static/runtime/combat/realtime-study-v1/hero-iron-guardian-ready-v1.png, SHA-256 66b7017812f2bd218a221d5f19b26b861951350293e6b7692bc055d0c46ec114; exact gray topknot, beard, stocky dignified adult proportions, navy-and-teal layered armor, bronze round shield fixed to Toma's left arm, compact mace fixed in his right hand; no equipment swap, loss, duplication, or redesign.
Camera / anchor / scale locks: steep three-quarter up-field combat camera; consistent body scale, bottom-center registration, shared ground line, neutral lighting, and painterly 2.5D finish; full body and both feet visible with generous per-cell clearance.
Directions / mirror policy / source regions: up-field only; never mirror; generate one five-column horizontal temporal strip; deterministically replace zero-based row 1 only in the v3 sheet; preserve zero-based rows 0, 2, and 3 exactly.
Allowed effects: none.
Forbidden changes: shadows or ground ellipses, scenery, text, dividers, labels, mirroring, equipment swaps, hidden or cropped feet, duplicate poses or silhouettes, extra or missing limbs, identity/costume/camera/scale/lighting drift, cell spill.
Runtime contract: complete 5-by-4 source sheet; five advance frames in playback order at 10 fps loop; builder emits a 5-by-4 atlas of 256-pixel RGBA cells with bottom-center feet anchor; validator ground-artifact ceiling 500 pixels; five unique support-evidence hashes bound to classical-human-run-5.
Output paths and next version: assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v4.png; assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png; assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json; apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.png; apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.json; apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json; all new artifacts are version 4 with status candidate.
```

## Initial generation record (superseded after independent review)

- Mode: built-in Codex image generation. The five poses were generated as one horizontal temporal
  strip from the accepted v3 motion sheet, accepted identity cutout, and the repository-owned
  `classical-human-run-5` diagram. Bounded built-in precise-object edits then corrected only failing
  contact anatomy and the airborne cell's bottom-alignment read.
- Reference roles:
  - `iron-guardian-motion-sheet-source-v3.png`: accepted source reference for identity, costume,
    camera, scale, lighting, white matte, and painterly finish.
  - `hero-iron-guardian-ready-v1.png`: accepted identity and equipment reference.
  - `classical-human-run.svg` (rendered for the built-in call): action-authority reference for the
    exact five-beat support order.
- Selected generated original ID: `exec-bd79d1ad-def1-42ec-9f2c-8ba3d35668d1.png`.
- Selected generated original path:
  `/home/joao/.codex/generated_images/01a06e0d-7dcd-7101-a64f-ae9d9ce48ea0/exec-bd79d1ad-def1-42ec-9f2c-8ba3d35668d1.png`.
- Selected generated original SHA-256:
  `bc0c48141c891f92fab515024575fd7d8d6884836a13dc9cb70129209f7d4791`.
- Disposition: seven intermediate outputs were rejected because they repeated the mace-side contact,
  read as airborne in intended planted cells, allowed two-foot support in frame 1, or lost frame 3's
  air gap during deterministic bottom alignment. They were moved to recoverable trash. Only the
  selected original remains in its Codex-managed generation directory.

Exact final prompt:

```text
Use case: precise-object-edit
Asset type: production source strip for a five-frame game-character run animation
Primary request: Change only Toma's right arm and mace in the CENTER/THIRD airborne cell of Image 1. Swing his right arm down naturally during flight so the complete mace head hangs substantially LOWER than both airborne boot soles, while remaining firmly gripped in his right hand. The mace head must be the lowest non-white point in cell 3, with at least a full boot-height of uninterrupted white visible below both boots before the level of the mace head. This low hanging mace preserves visible air under both feet when the cell is bottom-aligned during deterministic sheet assembly.
Preserve all five leg poses exactly. Preserve cells 1, 2, 4, and 5 unchanged. Cell 1 and 2 keep the shield-side/anatomical-left foot support; cell 3 keeps NEITHER boot planted; cells 4 and 5 keep mace-side/anatomical-right foot support. Preserve the opposite-contact silhouettes in cells 1 and 4.
Invariants: exact Toma identity, gray topknot, beard, stocky adult proportions, navy-and-teal armor, bronze shield on left arm, same compact mace in right hand, handedness, steep three-quarter up-field camera, body scale, lighting, pure uniform white matte, full-body/equipment clearance, and painterly 2.5D finish.
Avoid: changing the airborne legs or boot positions; adding any ground line, cast/contact shadow, ground ellipse or floor mark; changing other cells; scenery; text; dividers; crop; mirrored or swapped equipment; extra/missing limbs; identity/costume/camera/scale/lighting drift.
```

Source-resolution visual inspection:

- Frame 1 visibly bears weight on the shield-side/anatomical-left boot, while the mace-side boot is
  lifted with its sole exposed.
- Frame 2 keeps the same left support, bends the planted knee, and lowers the head and pelvis into
  compression.
- Frame 3 is a compact airborne pass. Neither boot is planted; both complete soles remain above a
  clear white gap in the assembled source and runtime atlas. The right-hand mace hangs below the
  boots as legitimate equipment lag and preserves that gap through the row composer's bottom
  alignment.
- Frame 4 unmistakably lands on the mace-side/anatomical-right boot with the other leg trailing. Its
  narrow forward-contact silhouette is distinct from frame 1's wide split-leg contact.
- Frame 5 remains over right support while the left leg advances toward the frame-1 loop return.
- Across all frames, Toma retains the same face, gray topknot, beard, stocky adult proportions,
  navy-and-teal armor, left-arm bronze shield, right-hand mace, steep three-quarter up-field camera,
  neutral lighting, and painterly 2.5D finish. Both feet and all equipment are fully visible. No
  shadow, floor ellipse, scenery, text, mirroring, equipment swap, duplicate silhouette, or extra
  limb is visible.

## Initial assembly, validation, and evidence (superseded after independent review)

Compose command:

```bash
node tools/compose-realtime-combat-motion-rows.mjs \
  --base assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v3.png \
  --out assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png \
  --replace 1:assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v4.png
```

Result: the 2161×728 selected strip was assembled into zero-based row 1 of the 1402×1122 v4 source
sheet. Decoded raw-pixel hashes prove preservation of the ledger-required one-based rows:

| One-based row | v3 decoded raw SHA-256 | v4 decoded raw SHA-256 | Equal |
| --- | --- | --- | --- |
| 1 | `dcaeac075ba2854972f2edf112e1ad6384817ba75b0c4b541fef0dfc76bc7208` | `dcaeac075ba2854972f2edf112e1ad6384817ba75b0c4b541fef0dfc76bc7208` | yes |
| 3 | `68e16c62bccdd190af1f01987509bc8d8fa471474e9d0168bb6c40a3eb426762` | `68e16c62bccdd190af1f01987509bc8d8fa471474e9d0168bb6c40a3eb426762` | yes |
| 4 | `3f35c3fd6b8504876b3189a55b3e995a098c111922cd1184a675853e38b15547` | `3f35c3fd6b8504876b3189a55b3e995a098c111922cd1184a675853e38b15547` | yes |

The five assembled source run cells were decoded and hashed independently in playback order:

1. `19e70c4b2d2bcac06ca01cfa8ab2614b06f2475150eaf87c914298527fb731f1`
2. `3d39b0fc87b2b4129544c7bd4bee161afb1a62b000c65b3b3bb8b426db32aded`
3. `fd553eda1f7dd4c233b422ddd36fed6e3e0df10ac4a271a219ed23bae697d4ef`
4. `fa2b2c287a1ff0ceebfc6d07c1f648a7985ac7612f62880442a6cd682170b166`
5. `c473e1e23e9b4b40d038f5e41c877d9a8149675d0822c6dadf5abfec926b9f53`

All five hashes are distinct lowercase 64-character values. The evidence file was serialized with
the required `JSON.stringify` construction, action authority `classical-human-run-5`, support
`["left","left","none","right","right"]`, and status `candidate`.

Builder command:

```bash
node tools/build-realtime-combat-motion-pack.mjs \
  --actor iron-guardian \
  --input assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png \
  --out-dir apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian \
  --version 4
```

Builder output:

```json
{
  "actorId": "iron-guardian",
  "inputPath": "assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png",
  "atlasPath": "apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.png",
  "commonScale": 0.8472222222222222
}
```

Validator command:

```bash
node tools/validate-realtime-combat-motion-pack.mjs \
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json \
  --max-advance-ground-artifact-pixels 500 \
  --advance-support-evidence assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json
```

Validator output:

```json
{"valid":true,"actorId":"iron-guardian","frames":20,"atlasPath":"apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.png"}
```

Validator regression command/result: `node --test
tools/validate-realtime-combat-motion-pack.spec.mjs` passed all 9 tests with 0 failures.

Runtime review: the five 256-pixel atlas cells were reviewed side-by-side at the configured
184-pixel Toma display size, and a temporary 15-frame animation exercised three full loops at the
manifest's 10 fps (100 ms per frame). The contacts, airborne beat, equipment sides, and frame-5 to
frame-1 recovery remain readable at gameplay scale.

## Initial files (superseded hashes)

| File | SHA-256 |
| --- | --- |
| `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v4.png` | `bc0c48141c891f92fab515024575fd7d8d6884836a13dc9cb70129209f7d4791` |
| `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png` | `9c513f0ffd0447fdd37a05551b969346ef5fd98eb09245cc2abc50844699b165` |
| `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json` | `7596e5e8150fbe07befdd8d57e02a1a52a27e9555b4a6582344f5def48b0ff5c` |
| `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.png` | `6b10d4ee67fd166e049de884d8117c28d27bc68a09a084f1be5d6452670a6756` |
| `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.json` | `e1374eafacc56543d12288a1149d30ef932376d2c29e9b6e4c17cc8cdb0d5641` |
| `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json` | `11b380e65128e86ee3d102817d2ed0acd1186b3c0ea18cfc03e725a3911a7fc8` |
| `assets/heroes/visuals/realtime-combat-study-v1/PROVENANCE.md` | updated with complete v4 provenance |
| `.superpowers/sdd/2026-09-04-character-action-animation-contract/task-3-report.md` | this report |

## Initial self-review and concerns

- Acceptance gates passed: five unique poses, visible `left, left, none, right, right` anatomy,
  frame-3 air under both boots, opposite frame-4 contact, distinct frame-1/frame-4 silhouettes,
  canonical identity/equipment/camera, clean matte, no baked shadow, immutable v1-v3, and decoded raw
  equality for preserved v3 rows 1, 3, and 4.
- The low mace in frame 3 is intentional secondary motion and acts as a non-ground bottom anchor so
  the row composer does not erase the airborne gap. It remains attached to the right hand and is
  legible at gameplay size, but its amount of downward lag is the primary visual-review question.
- No runtime consumer was switched from v3 to v4; this deliverable is intentionally a `candidate`
  pack until owner approval. The owner should judge run cadence, the low-mace airborne silhouette,
  and the frame-5 to frame-1 seam in the combat scene before promotion.

## Independent-review correction

The independent review returned `CHANGES REQUIRED` for two visible defects in the first submission:

1. Frame 3's mace reached the plant baseline and read as an elongated, ground-dragging pole rather
   than Toma's compact mace.
2. Independent per-cell fit scaling enlarged compressed poses and shrank extended poses, producing a
   visible body/shield scale change, especially across the frame-5 to frame-1 seam.

The correction stays within Task 3 and version 4. No stage integration or v1-v3 artifact changed.

### Corrected selected original and prompt

- Mode: built-in Codex image-generation precise-object edit. The corrected v4 selects the earlier
  passing temporal strip before the rejected mace-extension edit; its compact canonical mace and all
  five support poses are intact.
- Selected generation original ID: `exec-3855ea8f-2aeb-4216-9722-52bd21d332ed.png`.
- Selected generation original path:
  `/home/joao/.codex/generated_images/01a06e0d-7dcd-7101-a64f-ae9d9ce48ea0/exec-3855ea8f-2aeb-4216-9722-52bd21d332ed.png`.
- Selected original/project-strip SHA-256:
  `a7d82acca4a132d2f8a5fc399e7c8dddc7c7844f0e98a99bf692901752f04b80`.
- The superseded elongated-mace original was moved to recoverable trash. Only the selected original
  remains in the active Codex generation directory.

Exact prompt that produced the corrected selected original:

```text
Use case: precise-object-edit
Asset type: production source strip for a five-frame game-character run animation
Primary request: Edit Image 1 using Image 2 only as a spatial annotation guide. In the FIRST/LEFTMOST cell only: lift and bend backward the boot circled RED and labeled LIFT THIS in Image 2, leaving a large clear band of white below its entire sole. Lower and flatten the boot circled GREEN and labeled PLANT so it alone bears Toma's weight on the shared baseline. Remove all guide circles, arrows, and text; none may appear in the result.
Input images: Image 1 is the clean edit target. Image 2 is an annotation guide only. Image 3 is Toma's accepted v3 design/camera/style reference. Image 4 is Toma's accepted identity reference.
Preserve cells 2, 3, 4, and 5 exactly. Preserve every other part of cell 1 unchanged. The final strip must visibly read: cell 1 shield-side/anatomical-left foot only; cell 2 shield-side/anatomical-left foot only; cell 3 neither foot with white air under both boots; cell 4 mace-side/anatomical-right foot only; cell 5 mace-side/anatomical-right foot only.
Constraints: pure uniform white matte; no shadow or ground mark; exact face, gray topknot, beard, stocky proportions, navy-and-teal armor, left bronze shield, right mace, handedness, camera, scale, lighting, full-body clearance, and painterly 2.5D finish.
Avoid: guide graphics or text in output; changes outside the circled boots/legs in cell 1; shadows; scenery; dividers; crop; mirroring; equipment changes; extra/missing limbs; identity/style drift.
```

### Corrected v4 registration pipeline

The required row composer was run first against the compact-mace strip. A deterministic v4-only
normalization pass then replaced only zero-based row 1 from the same generated cells:

- trim all five white-matte cells without altering their pixels;
- compute one shared fit scale from the largest generated cell and the 280/281×281 target cells;
- apply the same `0.6039823008849557` scale to all five poses instead of fitting each independently;
- center each pose horizontally with 4 pixels of cell padding;
- bottom-register support frames and position source frame 3 18 pixels above that baseline;
- build the standard v4 pack with `commonScale: 0.8472222222222222`;
- translate only runtime `iron-guardian-advance-03` upward 18 pixels inside its existing transparent
  256×256 atlas cell, preserving the manifest anchor and a visible no-support gap.

The compact mace remains entirely above the runtime baseline. No equipment pixel is used as a ground
or registration anchor.

Generated source-cell sizes before shared scaling were `352×421`, `362×366`, `352×399`, `352×451`,
and `327×452`. Corrected rendered sizes are `213×254`, `219×221`, `213×241`, `213×272`, and
`198×273`; these differences reflect pose extents while every cell uses the same scale.

At runtime, alpha-bound widths changed from the rejected submission's `194, 230, 195, 181, 168` to
`180, 186, 180, 180, 168`. More importantly, detected shield heights are now
`76, 72, 77, 75, 74` pixels: the frame-5 to frame-1 shield-size change is 2 pixels. The remaining
12-pixel overall-width change at that seam is the authored recovery-to-wide-contact stride, not a
body-scale change.

### Corrected evidence and hashes

Decoded raw-pixel preservation remains exact:

| One-based row | v3 decoded raw SHA-256 | Corrected v4 decoded raw SHA-256 | Equal |
| --- | --- | --- | --- |
| 1 | `dcaeac075ba2854972f2edf112e1ad6384817ba75b0c4b541fef0dfc76bc7208` | `dcaeac075ba2854972f2edf112e1ad6384817ba75b0c4b541fef0dfc76bc7208` | yes |
| 3 | `68e16c62bccdd190af1f01987509bc8d8fa471474e9d0168bb6c40a3eb426762` | `68e16c62bccdd190af1f01987509bc8d8fa471474e9d0168bb6c40a3eb426762` | yes |
| 4 | `3f35c3fd6b8504876b3189a55b3e995a098c111922cd1184a675853e38b15547` | `3f35c3fd6b8504876b3189a55b3e995a098c111922cd1184a675853e38b15547` | yes |

Corrected assembled source run-cell SHA-256 values in playback order:

1. `9c518b0b821f3d2f5de096f59e4f0f76305b15853e117b01ed332a74b50fde50`
2. `1a1fb1eedbf9e15933dd89b5cd8d6104c99fec923834112f9ec3fc9d761fd0ec`
3. `4a71c6fa33e3e5a631e1dff6d8ef38769ae7e51e6f41fc4a127aef955453d035`
4. `8f54a90897b54240f6b02a630dbb356aeee21d46af1b76901a73e83a1229c1bf`
5. `ae9e7e083a61aba3048da246d8cd9d38a3c6c3d8b43f8dddca18bc75b63597cb`

All five remain distinct lowercase hashes. The evidence file was rewritten with the required
`JSON.stringify` construction and remains `candidate` with authority `classical-human-run-5` and
support `left, left, none, right, right`.

| Current file | SHA-256 |
| --- | --- |
| `iron-guardian-run-strip-source-v4.png` | `a7d82acca4a132d2f8a5fc399e7c8dddc7c7844f0e98a99bf692901752f04b80` |
| `iron-guardian-motion-sheet-source-v4.png` | `0a751496ecd72743dba97051231f5c34fb67e7dbab0637df0a6e0531399481dc` |
| `iron-guardian-motion-support-v4.json` | `e1f66bfd39f2dc6f3c7421b998e17de6f8c0fcd12f84a05f51079b91707d729e` |
| `iron-guardian-motion-v4.png` | `4a53c67d6ea9a6bb4bcb0846734a164fa92ede0f09d967db549566187ed2d36c` |
| `iron-guardian-motion-v4.json` | `e1374eafacc56543d12288a1149d30ef932376d2c29e9b6e4c17cc8cdb0d5641` |
| `iron-guardian-motion-manifest-v4.json` | `11b380e65128e86ee3d102817d2ed0acd1186b3c0ea18cfc03e725a3911a7fc8` |

### Corrected validation and visual review

The exact validator command returned:

```json
{"valid":true,"actorId":"iron-guardian","frames":20,"atlasPath":"apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.png"}
```

`node --test tools/validate-realtime-combat-motion-pack.spec.mjs` passed all 9 tests with 0 failures.

A corrected 184-pixel contact sheet and 15-page temporary GIF were inspected at the manifest's 10
fps, covering three complete loops. The visible support remains exactly left, left, none, right,
right. Frame 3 retains clear air below both boots and a compact freely carried mace; frame 4 lands on
the opposite foot; frames 1 and 4 remain distinct; handedness, identity, camera, and matte remain
stable. No body/shield scale snap, baked shadow, scenery, text, or extra limb was observed.

Remaining visual concern: frame 2's compression is intentionally much lower than the other poses,
so its overall bounds contract despite constant body scale. The corrected shield metrics and
three-loop playback read this as weight loading, but owner judgment on that cadence remains the main
candidate-review question. Task 4 integration remains untouched.
