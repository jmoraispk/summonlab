# Nessa idle v4 clip brief

- Character / clip: Nessa (`moss-archer`) / `idle`
- Action authority: known idle contract from
  `.agents/skills/summonlab-character-animations/references/clip-contracts.md`; action creation is
  bypassed.
- Gameplay intent: hold a readable bow-ready stance with the image-left boot supporting her weight
  and the image-right boot visibly lifted clear of the ground.
- Starting pose / prerequisite state: accepted v3 idle sequence.
- Motion sentence: Nessa maintains her five-beat restrained guard while the image-right boot stays
  naturally raised and the image-left boot remains planted.
- Frame beats (left to right): use the v3 poses and cadence as temporal authority; tuck the
  image-right knee and raise its connected boot consistently in frames 1–5 while retaining the
  alert planted-side silhouette.
- Acting limb / delivery: none; idle weight distribution only.
- Target direction / contact beat: up-field; no contact beat.
- Support/contact sequence: image-left boot planted in every frame; image-right boot airborne with a
  visible white gap below it in every frame.
- Contacts / center of mass: preserve torso, pelvis, planted boot, and bottom-center actor anchor.
- Loop seam or terminal state: frame 5 returns to frame 1 at 6 fps without a foot pop.
- Accepted source path / version / SHA-256 / approval record:
  `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/moss-archer/moss-archer-motion-v3.png`,
  v3, `3df6e4fdd0137b5b1b452e15403837b1b2f1d5411e69e604cab7c35468d29ff0`; owner feedback on
  2026-09-05 accepted the restored silhouette and requested only the remaining image-right foot be
  raised.
- Equipment / identity constraints: exact face, copper curls, moss mantle, armor, quiver, recurved
  bow, grip, handedness, and proportions.
- Camera / anchor / scale locks: five 256×256 cells, steep three-quarter up-field camera, stable scale,
  bottom-center runtime anchor `(0.5, 0.9609375)`.
- Directions / mirror policy / source regions: one authored up-field strip; no mirroring. Edit only
  the image-right lower-leg/boot region of each idle cell.
- Allowed effects: none.
- Forbidden alternatives: whole-sprite translation, moving the planted boot, changing pose cadence,
  cropping either boot, or regenerating non-idle clips.
- Forbidden visual changes: face, hair, torso, arms, hands, bow, quiver, clothing, palette, lighting,
  camera, frame placement, or background texture.
- Runtime contract: v4 replaces only `idle`; `advance`, `attack`, `hit`, and `down` remain decoded-RGBA
  identical to v3. All living Nessa clips retain `bodyOffsetY: -4`.
- Acceptance gates: every runtime idle subject remains at least 230 pixels tall; the image-right half
  contains no opaque pixels in the 14-pixel contact band; all 15 non-idle frames are decoded-RGBA
  identical to v3; five-frame playback has no foot pop at the 5→1 seam.
- Output paths and next version:
  `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/moss-archer/moss-archer-idle-strip-raw-v4.png`,
  `moss-archer-idle-strip-source-v4.png`, `moss-archer-motion-sheet-source-v4.png`, and runtime
  `moss-archer-motion-v4.{png,json}` plus `moss-archer-motion-manifest-v4.json`.
