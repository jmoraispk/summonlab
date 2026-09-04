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

`tools/build-realtime-combat-motion-pack.mjs` overlaps each nominal cell, keys the neutral background,
isolates the center-connected subject from adjacent-cell fragments, normalizes every frame to a
256×256 canvas with a shared bottom-center anchor, and writes Pixi-compatible atlas JSON plus a motion
manifest. `tools/validate-realtime-combat-motion-pack.mjs` validates clip presence, unique frame
ownership, atlas dimensions, alpha, and anchor data. The well foreground is a lossless masked copy of
the existing original environment plate produced by `tools/extract-realtime-combat-occluders.mjs`;
it contains no new third-party content.
