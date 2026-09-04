# Realtime combat study v1 provenance

## Owned source

- `saffron-braid-source-v1.png`
- SHA-256: `3cc917c4b0b15bfce012bb2fcdbf01d1cb4977871fdc222b4db3afd32120fa77`
- Supplied by the project owner in the Codex task on 2026-09-03.
- The project owner explicitly authorized use of the complete character and derivative hero designs for this prototype.

The two gameplay recordings used for motion and camera study are reference-only and are not copied into the repository. No Last Asylum assets, packages, extracted data, or screenshots ship with this study.

## Generated derivatives

All generated images below were produced with the built-in Codex image generation tool on 2026-09-03. Generation originals remain in Codex-managed storage; gameplay-ready copies live under `apps/web/static/runtime/combat/realtime-study-v1/`.

### Asha / saffron-braid lead

- Generation original: `exec-7c12f314-cf62-4fa2-974d-cb2d89ba0be4.png`
- References: an earlier combat adaptation and `saffron-braid-source-v1.png` as the canonical owned identity/costume reference.
- Final prompt: preserve the adult Black woman's exact identity, RIGHT shaved temple and geometric marking, long heavy braid on HER LEFT, hoop earring, saffron hooded robe, cream trim, dark inner layer, woven sash, loose cream trousers, wraps, and boots; redraw as a dignified compact adult chibi about three heads tall, full body, planted unarmed stance facing diagonally up-right, steep three-quarter top-down mobile strategy camera, premium hand-painted near-3D rendering, cool dusk rim and warm saffron key, readable at 140px, clean transparent isolation, no scenery, UI, text, weapon, mirroring, infant proportions, or costume redesign.

### Toma / iron guardian

- Generation original: `exec-d7790946-0dd4-4466-9530-c177cc7bd4eb.png`
- Reference: Asha output for quality, camera, proportions, palette discipline, and lighting only.
- Final prompt: create an original stocky older East Asian male guardian with gray topknot and short beard, iron-blue and muted teal layered village armor, battered round shield and compact mace; approximately three heads tall, steep three-quarter top-down camera, facing diagonally up-left, premium hand-painted near-3D volume, adult dignity, full body, clean transparent isolation, no copied facial identity or costume elements.

### Nessa / moss archer

- Generation original: `exec-dfb78f06-5681-4829-9c72-9c74a107e9eb.png`
- Reference: Asha output for quality, camera, proportions, palette discipline, and lighting only.
- Final prompt: create an original agile adult light-brown-skinned female scout with cropped copper curls, a moss-green mantle, practical layered travel clothes, and recurved bow; approximately three heads tall, steep three-quarter top-down camera, facing diagonally up-right, premium hand-painted near-3D volume, full body, clean transparent isolation, no copied facial identity or costume elements.

## Runtime processing

The generator returned the isolated actors against a baked light checkerboard. `tools/key-checkerboard-background.mjs` converts connected neutral-light pixels to alpha, trims the subject, and places it on a transparent 768×768 runtime canvas. The generation originals remain unmodified outside the repository.

## Animation canary v1

The animation canary was produced with the built-in Codex image generation tool on 2026-09-03.
The selected generation sheets are stored as project-bound source inputs so the runtime atlases are
reproducible and do not depend on Codex-managed temporary storage.

### Asha motion sheet

- Generation original: `exec-482f4b0d-d3dd-4d01-b07c-763db73f8a70.png`
- Project source: `animation-canary-v1/asha/asha-motion-sheet-source-v1.png`
- Source SHA-256: `dda1bd35bd4561c946c871b9455f56ba9b9dea4a4de3d8fccda03ea1c493834e`
- Runtime atlas SHA-256: `05e50e161d71bd3017230550b4710654b9fabd3fbb76137546a078f79e3cf162`
- References: the owned canonical hero and the accepted Asha combat cutout.
- Final prompt: create the exact same owned adult Black woman as a precise 5-column by 4-row motion
  sheet: five idle poses, five advance/run poses, five unarmed saffron-force-strike poses, then two
  hit reactions and three down poses. Preserve her right shaved temple and marking, long braid on her
  left, face, saffron-and-cream costume, steep top-down combat camera, fixed feet baseline, adult
  proportions, and lighting. Use a uniform white matte with no scenery, text, shadow, mirroring, or
  identity/costume drift.

### Lesser-rat motion sheet

- Generation original: `exec-eb475ff9-8e1b-47ec-a92f-49b75fe6c4ac.png`
- Project source:
  `../../../../enemies/experiments/realtime-combat-study-v1/animation-canary-v1/lesser-rat/lesser-rat-motion-sheet-source-v1.png`
- Source SHA-256: `a9ee3d007b9453f9be57727d918232d236011d57fd3a2b15e88a45db66eaadf1`
- Runtime atlas SHA-256: `de89da518d06b8b9dd7370d0ed1847c99e5c6aba39f6aa0f8c3540a1f08d6079`
- Reference: the original lesser-rat combat cutout created for this study.
- Final prompt: create the exact same rat as a precise 5-column by 4-row motion sheet: five idle
  poses, five scurry poses, five bite/claw attack poses, then two hit reactions and three down poses.
  Preserve soot-brown fur, ragged ears, pale eyes, tail, red spine infection, steep top-down combat
  camera, fixed feet baseline, mass, and lighting. Use a uniform white matte with no scenery, text,
  shadow, mirroring, or design drift.

### Asha gait correction v2

- Generation original: `exec-0000de41-b6c3-4b7d-b57d-38f8aafa743e.png`
- Project source: `animation-canary-v1/asha/asha-motion-sheet-source-v2.png`
- Source SHA-256: `3a8ebfd62479c95aec94b934e5cebb24770ad9bea019b96f7388d5bdd0e4902f`
- Runtime atlas SHA-256: `11d40da687b1795f8a8797ba09c348f332100a8d0b1d6420544d19830a82f996`
- Mode: built-in Codex image generation edit.
- Final prompt: edit only row two of the existing five-by-four Asha motion sheet into an explicit
  five-frame alternating gait: left-foot contact with right trailing, passing, airborne, right-foot
  contact with left trailing, then recovery. Alternate both arms and legs on a stable baseline while
  preserving rows one, three, and four, identity, right shaved temple, left braid, costume, camera,
  palette, and white matte; do not mirror, crop, relight, add props, or redesign the character.

### Lesser-rat gait correction v2

- Generation original: `exec-0a29101f-3e88-44a7-8046-4ea186f7e3be.png`
- Project source:
  `../../../../enemies/experiments/realtime-combat-study-v1/animation-canary-v1/lesser-rat/lesser-rat-motion-sheet-source-v2.png`
- Source SHA-256: `f22609eeb531ee4f64e0512d1a12235ab4d6f065f440b3db5267b4fa4a581d2b`
- Runtime atlas SHA-256: `56a3338099ac3d71238d3c0406a91d6519b5246771f0cdde63bf3fcf0019ce0b`
- Mode: built-in Codex image generation edit.
- Final prompt: edit only row two of the existing five-by-four lesser-rat sheet into an explicit
  five-frame quadruped gallop: left-fore/right-hind contact, compression, airborne extension,
  right-fore/left-hind contact, then recovery. Change all four limbs, spine, and tail while preserving
  every other row, the rat's identity, infection markings, camera, palette, mass, fixed baseline, and
  white matte; do not add scenery, text, shadows, props, cropping, or design drift.

### Toma / iron guardian motion sheet

- Generation original: `exec-c5171e8b-24e7-4ceb-b96d-ec0ceaa4e62b.png`
- Project source: `animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v1.png`
- Source SHA-256: `c32d30711b625fa999071ed791c3130446bad8d87f4223b75b9c7b74c3b559e5`
- Runtime atlas SHA-256: `c853e2eb86c7e7f4638f9b1b5c8d6f9512ec5f28c538e2368b6dc2581365dd7d`
- Mode: built-in Codex image generation with identity and layout references.
- Final prompt: preserve Toma's exact face, gray topknot, beard, iron-blue armor, left-arm round
  shield, and right-hand mace in a precise five-by-four sheet. Author five idles, an alternating
  armored advance, a shield-and-mace attack, two equipped hit reactions, and three defeat poses on a
  uniform white matte. Preserve camera, adult proportions, palette, lighting, handedness, and
  identity; no mirroring, equipment swap, extra figures, crop, scenery, text, or shadow.

### Nessa / moss archer motion sheet

- Initial generation original: `exec-54946f93-fa60-4fd7-91b3-cf2d4f3679f0.png`
- Selected corrected generation original: `exec-92622f81-2555-42a5-bada-e8037ddcbab3.png`
- Project source: `animation-canary-v1/moss-archer/moss-archer-motion-sheet-source-v1.png`
- Source SHA-256: `2194d6a3a8622b7879743fe5ea08f2e71dc9b6b540bb483b1d2b021d7337ce4a`
- Runtime atlas SHA-256: `1186df30ee2455da96ee6a92a979a6d66ab803ce356a30dfc4c49bda11dc89be`
- Mode: built-in Codex image generation followed by one identity-preserving edit.
- Final prompt set: preserve Nessa's exact face, copper curls, moss mantle, travel armor, quiver, and
  recurved bow in a precise five-by-four sheet. Author five idles, an alternating agile advance, a
  mechanically readable nock-draw-release-recovery attack, two hit reactions, and three defeat poses
  on a uniform white matte. The correction changed only the first two hit cells to retain the same
  fully visible bow and grip continuity. Preserve camera, palette, handedness, and identity; no
  mirroring, detached hands, random arrows, extra figures, crop, scenery, text, or shadow.

### Rat King / rat brute motion sheet

- Generation original: `exec-27b6eade-0038-42bd-b25e-4b0dae6c24a8.png`
- Project source:
  `../../../enemies/experiments/realtime-combat-study-v1/animation-canary-v1/rat-brute/rat-brute-motion-sheet-source-v1.png`
- Source SHA-256: `dda07e06a8514c32a3c99a4d4a13ac42cca5f9657c6bfb86946280f97957a767`
- Runtime atlas SHA-256: `4b6960602cd66044659b23f3bc4b6757ad0f19a18db7dcedc164d7e5baa5e7cc`
- Mode: built-in Codex image generation with identity and layout references.
- Final prompt: preserve the exact colossal Rat King identity, scarred anatomy, long tail, plague
  wounds, harness, and same-side asymmetric shoulder armor in a precise five-by-four sheet. Author
  five heavy idles, a four-limb quadrupedal charge, a claw-and-body-slam attack, two heavy hit
  reactions, and three collapse poses on a uniform white matte. Preserve boss weight, camera,
  asymmetry, palette, and lighting; no mirroring, armor swap, cute proportions, extra figures, crop,
  scenery, text, or shadow.

### Toma / iron guardian gait correction v2

- Accepted source binding: `animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v1.png`
  (`c32d30711b625fa999071ed791c3130446bad8d87f4223b75b9c7b74c3b559e5`).
- Identity binding: `../../../../apps/web/static/runtime/combat/realtime-study-v1/hero-iron-guardian-ready-v1.png`
  (`66b7017812f2bd218a221d5f19b26b861951350293e6b7692bc055d0c46ec114`).
- Selected generation original: `exec-fdf32fb5-0d4e-4f90-a06b-8ef0a12da2ad.png`
  (`d91a4d97a783b9e59d89a25c6d50ed4dd66af819fce39a86d01639258d07747c`).
- Project source: `animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v2.png`.
- Source SHA-256: `94544c8cf10d557993fe91313aef935758abc412dc5a4fad303c51b1b9580976`.
- Runtime atlas SHA-256: `3f81572ead38b2464750386da0f4ebdd30094c26735bf709481cc98c29c567aa`.
- Mode: built-in Codex image generation edit, followed by deterministic clip-row assembly.
- Final prompt: create one five-frame horizontal heavy-run strip while preserving Toma's face, gray
  topknot, stocky proportions, navy-and-teal armor, left-hand bronze shield, right-hand mace,
  three-quarter up-field camera, scale, lighting, stable baseline, and 2.5D painterly finish. Make
  left contact, compression/right-knee pass, right contact, opposite compression/left-knee pass, and
  recovery mechanically distinct; never swap, crop, duplicate, or remove equipment.
- Temporal assembly: generated cells `0,1,2,1,4` are sequenced as left/right/left/right/recovery in
  source row two; every other v1 row remains pixel-identical. Candidate awaiting owner playtest.

### Nessa / moss archer gait and defeat correction v2

- Accepted source binding: `animation-canary-v1/moss-archer/moss-archer-motion-sheet-source-v1.png`
  (`2194d6a3a8622b7879743fe5ea08f2e71dc9b6b540bb483b1d2b021d7337ce4a`).
- Identity binding: `../../../../apps/web/static/runtime/combat/realtime-study-v1/hero-moss-archer-ready-v1.png`
  (`9c94401448f51dc6521c7aae3d00fa15e47bc4b27c452b666023f1d5fcd5bb36`).
- Selected run generation original: `exec-0a1e0f5b-616e-4c33-81ed-dfc090296c33.png`
  (`dbf6413e8f6cef3b085c4ab5f9b6e250ec2df4df86409c4e400fd69909dc81ed`).
- Selected defeat generation original: `exec-9e3e1a00-391c-4d7e-b169-caaf9d09f5cc.png`
  (`6f382aa68e2ced97ee41b26ba2cdb209905d60930af394c489135661ca98eba0`).
- Project source: `animation-canary-v1/moss-archer/moss-archer-motion-sheet-source-v2.png`.
- Source SHA-256: `97cab854e83a8b90d1f0e23556338300d5c06b19521b4f572e1451f0ed3021ed`.
- Runtime atlas SHA-256: `03bcc9b118b98f1aa44a80f60ac75c5b911ffb0896149bdd3e5a4bf9440afd38`.
- Mode: built-in Codex image generation edits, followed by deterministic clip-row assembly.
- Final run prompt: create one five-frame horizontal agile-run strip while preserving Nessa's face,
  copper curls, athletic proportions, travel armor, moss mantle, attached quiver, complete recurved
  bow continuously in her left hand, three-quarter up-field camera, scale, lighting, stable baseline,
  and 2.5D painterly finish. Author left contact, compression, airborne extension, right contact, and
  recovery; keep the bow fully visible, arrows in the quiver, and generous clearance in every cell.
- Final defeat prompt: edit only row four into two readable hit reactions followed by buckle,
  impact, and settled rest. Remove the embedded/floating arrow entirely; let the bow leave her hand
  along a visible path and remain on the ground without vanishing or reappearing. Preserve identity,
  costume, quiver, camera, lighting, scale, and every other row.
- Temporal assembly: run cells `0,4,1,4,2` are sequenced as left/right/left/right/airborne recovery
  in source row two; the defeat generation supplies source row four; rows one and three remain
  pixel-identical to v1. Candidate awaiting owner playtest.

### Toma / iron guardian ground-shadow correction v3

- Accepted source binding: `animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v2.png`
  (`94544c8cf10d557993fe91313aef935758abc412dc5a4fad303c51b1b9580976`).
- Identity binding: `../../../../apps/web/static/runtime/combat/realtime-study-v1/hero-iron-guardian-ready-v1.png`
  (`66b7017812f2bd218a221d5f19b26b861951350293e6b7692bc055d0c46ec114`).
- Selected generation original: `exec-15103857-158b-4b95-862b-d8c2cfc34877.png`
  (`d4e9d58ec15a82f87acd81b0897a1ef32c79c221b046f31177b9d60badee438c`).
- Project source: `animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v3.png`.
- Source SHA-256: `b22c5390f290abf4ff3cca9540c713eb30d1045ed4f1c9573389a8d223df99d9`.
- Runtime atlas SHA-256: `bf6aa0b71000b96330728cd33e00b7f7fde47505415e39f38b4a5a80eb3b7ad5`.
- Mode: built-in Codex image generation precise-object edit, followed by deterministic row-two
  assembly over the exact v2 source.
- Final prompt: remove only the five pale gray/white horizontal floor-shadow ellipses beneath the
  second-row advance poses and replace them with the existing uniform white matte. Add no replacement
  shadow because the runtime owns the contact shadow. Preserve the exact identity, face, topknot,
  beard, proportions, armor, left shield, right mace, leg positions, scale, camera, baseline, spacing,
  lighting, cell order, other three rows, and five-by-four layout; do not redraw, mirror, crop, move,
  resize, relight, restyle, add effects, or alter equipment.
- Assembly validation: source rows one, three, and four are byte-identical to v2. The v3 atlas passes
  the advance ground-artifact ceiling that intentionally rejects v2. Candidate awaiting owner
  playtest.

### Toma / iron guardian run-contract rebuild v4

- Accepted source binding: `animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v3.png`
  (`b22c5390f290abf4ff3cca9540c713eb30d1045ed4f1c9573389a8d223df99d9`).
- Identity binding: `../../../../apps/web/static/runtime/combat/realtime-study-v1/hero-iron-guardian-ready-v1.png`
  (`66b7017812f2bd218a221d5f19b26b861951350293e6b7692bc055d0c46ec114`).
- Action authority: `classical-human-run-5`; visible support sequence: `left, left, none, right,
  right`.
- Independent review rejected the first v4 submission because its frame-3 mace was elongated to the
  plant baseline and the per-cell source normalization caused visible scale variation. That
  submission is superseded and not retained as the project strip.
- Selected generation original: `exec-3855ea8f-2aeb-4216-9722-52bd21d332ed.png`
  (`a7d82acca4a132d2f8a5fc399e7c8dddc7c7844f0e98a99bf692901752f04b80`).
- Project strip: `animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v4.png`
  (`a7d82acca4a132d2f8a5fc399e7c8dddc7c7844f0e98a99bf692901752f04b80`).
- Project sheet: `animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png`
  (`0a751496ecd72743dba97051231f5c34fb67e7dbab0637df0a6e0531399481dc`).
- Support evidence: `animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json`
  (`da2c1491c6796a61919287f86e960d6a35524eac287e7ae6bd78759ec21964cf`). It binds
  `version: 4`, `actorId: iron-guardian`, and `clip: advance` to zero-based row 1 of the 5×4 v4
  source sheet; its five hashes are decoded RGB cell hashes in left-to-right playback order.
- Runtime atlas: `../../../../apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.png`
  (`af035edbe4162062742d5b1a8dc797d92e2af71a95c16053d1d45862f8d52fec`). Runtime atlas JSON:
  `iron-guardian-motion-v4.json`
  (`e1374eafacc56543d12288a1149d30ef932376d2c29e9b6e4c17cc8cdb0d5641`). Runtime manifest:
  `iron-guardian-motion-manifest-v4.json`
  (`11b380e65128e86ee3d102817d2ed0acd1186b3c0ea18cfc03e725a3911a7fc8`).
- Mode: built-in Codex image generation, with the five poses authored as one temporal strip from the
  v3 sheet, identity cutout, and repository action diagram, followed by bounded built-in
  precise-object edits. Final assembly applies one common source scale to all five generated cells;
  frame 3 receives an 18-pixel source lift and a declared 18-pixel upward translation inside its
  transparent runtime cell. The builder copies every non-advance runtime cell from the v3 atlas, so
  source-row overlap cannot alter idle, attack, hit, or down pixels. Equipment is not used as a
  registration anchor.
- Exact final prompt:

  ```text
  Use case: precise-object-edit
  Asset type: production source strip for a five-frame game-character run animation
  Primary request: Edit Image 1 using Image 2 only as a spatial annotation guide. In the FIRST/LEFTMOST cell only: lift and bend backward the boot circled RED and labeled LIFT THIS in Image 2, leaving a large clear band of white below its entire sole. Lower and flatten the boot circled GREEN and labeled PLANT so it alone bears Toma's weight on the shared baseline. Remove all guide circles, arrows, and text; none may appear in the result.
  Input images: Image 1 is the clean edit target. Image 2 is an annotation guide only. Image 3 is Toma's accepted v3 design/camera/style reference. Image 4 is Toma's accepted identity reference.
  Preserve cells 2, 3, 4, and 5 exactly. Preserve every other part of cell 1 unchanged. The final strip must visibly read: cell 1 shield-side/anatomical-left foot only; cell 2 shield-side/anatomical-left foot only; cell 3 neither foot with white air under both boots; cell 4 mace-side/anatomical-right foot only; cell 5 mace-side/anatomical-right foot only.
  Constraints: pure uniform white matte; no shadow or ground mark; exact face, gray topknot, beard, stocky proportions, navy-and-teal armor, left bronze shield, right mace, handedness, camera, scale, lighting, full-body clearance, and painterly 2.5D finish.
  Avoid: guide graphics or text in output; changes outside the circled boots/legs in cell 1; shadows; scenery; dividers; crop; mirroring; equipment changes; extra/missing limbs; identity/style drift.
  ```

- Row preservation after decoded raw-pixel extraction: one-based row 1 is identical between v3 and
  v4 at `dcaeac075ba2854972f2edf112e1ad6384817ba75b0c4b541fef0dfc76bc7208`; row 3 is
  identical at `68e16c62bccdd190af1f01987509bc8d8fa471474e9d0168bb6c40a3eb426762`; row 4 is
  identical at `3f35c3fd6b8504876b3189a55b3e995a098c111922cd1184a675853e38b15547`.
- Runtime preservation after decoded RGBA extraction: all 15 non-advance v4 cells are identical to
  their v3 counterparts, including `iron-guardian-attack-03.png`. All five v4 advance cells remain
  pixel-identical to the visually reviewed v4 candidate; the airborne frame ends at local y=227.
- Visual inspection: all five full bodies and both boots are unobstructed. Frames 1 and 2 visibly
  retain shield-side left support; frame 3 has neither boot planted and clear white below both soles;
  frame 4 lands on the mace-side right foot in a silhouette distinct from frame 1; frame 5 recovers
  over that right foot toward the loop return. Toma retains his face, gray topknot, beard, stocky
  proportions, navy-and-teal armor, left bronze shield, compact right mace, camera, and white matte.
  Runtime shield heights are `76, 72, 77, 75, 74` pixels; frame-5 to frame-1 shield-size change is 2
  pixels, while overall alpha width changes from 168 to 180 pixels because the contact pose opens its
  stride. No scale snap, ground-dragging weapon, baked shadow, scenery, text, mirror, equipment swap,
  or extra limb was observed in the 184-pixel, three-loop review.
- Deterministic source assembly command:

  ```bash
  node tools/compose-realtime-combat-motion-rows.mjs \
    --base assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v3.png \
    --out assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png \
    --replace 1:assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v4.png \
    --scale-mode shared \
    --cell-y-offset 1:2:-18
  ```

- Deterministic runtime build command (completed with `commonScale: 0.8472222222222222`):

  ```bash
  node tools/build-realtime-combat-motion-pack.mjs \
    --actor iron-guardian \
    --input assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png \
    --out-dir apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian \
    --version 4 \
    --preserve-from-manifest apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v3.json \
    --replace-clip advance \
    --frame-y-offset advance:3:-18
  ```

- Deterministic support-evidence command:

  ```bash
  node tools/write-realtime-combat-motion-support-evidence.mjs \
    --source-sheet assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png \
    --source-sheet-path iron-guardian-motion-sheet-source-v4.png \
    --out assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json \
    --version 4 \
    --actor iron-guardian \
    --clip advance \
    --grid 5x4@1 \
    --action-authority classical-human-run-5 \
    --support left,left,none,right,right
  ```

- A fresh temporary rebuild using those options matched the committed source sheet, runtime atlas,
  atlas JSON, manifest, and support evidence byte-for-byte.
- Validator command/result: `node tools/validate-realtime-combat-motion-pack.mjs
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json
  --max-advance-ground-artifact-pixels 500 --advance-support-evidence
  assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json`
  returned `{"valid":true,"actorId":"iron-guardian","frames":20,"atlasPath":"apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.png"}`.
- Status: `candidate`; owner playtest is still required for approval.

- Runtime registration: living Toma frames receive a `-3` logical-pixel body offset and a `39×13`
  contact-shadow radius; living Nessa frames receive a `-4` logical-pixel body offset. Down clips
  return to the shared ground line, while combat coordinates, shadows, health bars, and targeting
  remain anchored to the original world point.

`tools/build-realtime-combat-motion-pack.mjs` overlaps each nominal cell, keys the neutral background,
isolates the center-connected subject from adjacent-cell fragments, normalizes every frame to a
256×256 canvas with a shared bottom-center anchor, and writes Pixi-compatible atlas JSON plus a motion
manifest. Its preservation mode copies locked clips from a prior manifest's atlas after building the
declared replacements, and its frame-offset option applies registration in decoded RGBA space.
`tools/validate-realtime-combat-motion-pack.mjs` validates clip presence, unique frame ownership,
atlas dimensions, alpha, anchor data, source-bound support evidence, and an optional bright-neutral
locomotion-ground artifact ceiling. The well foreground is a lossless masked copy of the existing
original environment plate produced by `tools/extract-realtime-combat-occluders.mjs`; it contains no
new third-party content.
