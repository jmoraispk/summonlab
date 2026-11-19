# Experiment 2 decisions

Durable owner answers, so later turns do not rediscover them.

| Date | Decision | Status |
| --- | --- | --- |
| 2026-11-17 | Use the Tripo API for the pipeline; the owner loaded API credits. Studio steps (`TRIPO-CHECKLIST.md`) are superseded. | accepted |
| 2026-11-17 | No local models: no TRELLIS, Hunyuan3D-2 or Qwen downloads; they make the workflow clunky and use a lot of disk. | accepted |
| 2026-11-17 | Tripo also does the animation (owner's intention); code retargeting is only a fallback or comparison. | accepted |
| 2026-11-17 | No Segment for weapons: weapons are separate pieces, and hit regions are derived from the skeleton in code. | accepted |
| 2026-11-17 | Generate a neutral-pose image for every creature before image-to-3D (Experiment 2b evidence in `REPORT-rigging.md`). | accepted |
| 2026-11-17 | Equipment as individual pieces; the one-image armor set dropped pieces twice. | accepted |
| 2026-11-17 | Biped (Mixamo) rig for every two-armed, two-legged body, from the T-pose image; rig type from the catalog family, rig-check only for `riggable`. | proposed, awaiting owner take |
| 2026-11-17 | Hit regions must be marked carefully: bone-attached volumes plus purity and bone-inside-mesh checks. | revised after owner review |
| 2026-11-17 | A shield straps to the forearm; a ragdoll must not ball up. | revised after owner review |
| 2026-11-17 | Starting content set: 10 heroes, 30 monsters, 60 equipment pieces (`batches/starting-set.json`; ranks F, E, D for equipment). | accepted; run approved (estimate ~6,100 credits, cap 7,000) |
| 2026-11-17 | API spend is billed separately from Studio credits; the owner tops up the API wallet as needed. Each new paid batch still gets a one-line estimate first. | accepted |
| 2026-11-17 | Hit volumes are roughly sufficient; add finer ones (hands above all) for injury precision. Done: 19 regions incl. palm and every finger phalanx. | accepted, revised |
| 2026-11-17 | Clay golem from its T-pose image, rigged both as biped and as `others`, to settle the rig-type question. | run |
| 2026-11-17 | Two more heroes, assistant's choice: Wenyn Amarun (183 cm, powerful) and Kelan Grelan (155 cm, sturdy, voluminous hair). | run |
| 2026-11-17 | Commit the Tripo scripts; keep a living workflow doc with lessons and decisions (`PIPELINE.md`) and improve it every batch. | accepted |
| 2026-11-17 | Proposals for the still-failing issues (cloth bones, v1.0 combat presets, quadruped hit regions, golem head mapping) are in `REPORT-rigging.md` and the `PIPELINE.md` backlog. | proposed, awaiting owner take |
| 2026-11-17 | rig-check is advisory: rig anyway in the retry pass (failed rigs are free); the bench decides. | adopted after 3 false negatives |
| 2026-11-18 | Try both follow-ups: v1.0 combat clips (~75 credits) and cloth bones. | run: combat clips adopted as a shared library; cloth bones rejected for fused meshes (opt-in only) |
| 2026-11-18 | Storing every asset in GitHub does not scale; move generated assets to cloud storage the website can fetch. | proposed: Cloudflare R2 (`notes/storage-and-scenes.md`); waiting for owner-created bucket and keys |
| 2026-11-18 | Path for scenes. | proposed: kit-based scenes on the same pipeline, Hearth-01 square first (`notes/storage-and-scenes.md`) |
| 2026-11-18 | Delete the unused local-model files (TRELLIS, Hunyuan3D-2 environments, weights and cached packages). | done: 45 GB freed; Tripo tools env kept |
| 2026-11-18 | Delete the cloth-bone code (extra complexity; it did not work, and runs already look fine). | done |
| 2026-11-18 | Watch for isolated pieces (the bear's chin blob); a removal stage if cheap. | revised: automatic removal at ≥4% also cut real costume parts (werebeast chain), so far pieces are flagged on the QA sheet and removed per asset after review |
| 2026-11-18 | Helmet must cover the head and face forward; the sword must be held by the hand. | fixed: props turned −90°, helmet fitted to head extents, procedural fist |
| 2026-11-18 | Two R2 buckets: public `summonlab-assets` (runtime files and catalog) and private `summonlab-masters` (every raw Tripo output and source image). | accepted; owner is creating the keys |
| 2026-11-18 | Playing one clip on many characters is a shortcut; clips per skeleton are the target. Runtime stores each character's clips without the mesh. | accepted; per-skeleton clips deferred while shared clips look fine |
| 2026-11-18 | Move most of what GitHub stores and serves (Git LFS art, site runtime images) to R2. | proposed: nearly all binary art can move; setup steps and phases in `notes/r2-migration.md` |
| 2026-11-18 | Back up the 3D files and the 2D LFS art to the private bucket (option "3D and 2D art"). | done: 3,091 files, 6.0 GB, all read back and verified; GitHub unchanged |
| 2026-11-18 | Point the website at the bucket instead of the repository and GitHub. | done on branch `claude/r2-asset-urls` (off until `VITE_ASSET_BASE` is set in Vercel); site images and catalog art published and verified |
| 2026-11-19 | Merge the asset-URL switch once CI is green. | done: jmoraispk/summonlab#1 merged; `assets.<domain>` serves files with CORS; waiting on `VITE_ASSET_BASE` in Vercel |
