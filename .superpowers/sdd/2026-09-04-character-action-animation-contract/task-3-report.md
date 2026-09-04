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

## Generation record

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

## Assembly, validation, and evidence

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

## Files

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

## Self-review and concerns

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
