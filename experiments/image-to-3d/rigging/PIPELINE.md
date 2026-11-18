# Image-to-3D production pipeline (living document)

How Summonlab art becomes rigged, animated, game-ready 3D on the Tripo API. Update this file whenever a
batch teaches us something: add the lesson with its evidence, change the step it affects, and log the
change at the bottom. Owner decisions are in `notes/decisions.md`; API facts in `notes/api-facts.md`;
the experiment that established all this is `REPORT-rigging.md`.

## Run a batch

1. **Plan:** `python rigging/scripts/plan_starting_set.py` writes `rigging/batches/<name>.json`, one
   entry per subject (`kind`, `body`, `height`, `source`, `prompt`; `done: true` to skip). Commit the batch
   file; it is the record of what was asked for.
2. **Estimate and approve:** send the owner a one-line cost estimate (table below), then wait for approval.
3. **Generate:** `TRIPO_CONCURRENCY=6 python rigging/scripts/batch_run.py rigging/batches/<name>.json
   --budget <credits>`. Re-running is safe: finished steps are reused from `rigging/ledger.jsonl`, and
   failed tasks are never charged. If the process dies with tasks in flight, adopt them with
   `python rigging/scripts/tripo.py adopt <step> <endpoint> <task_id>` instead of paying twice.
4. **Load:** `node rigging/scripts/build_manifest.mjs`.
5. **QA bench:** `PARTS=quick node rigging/scripts/engine_tests.mjs api/` (metrics plus one sheet per
   rig). Use the full run without `PARTS` for subjects that need a closer look.
6. **Budget:** `node rigging/scripts/budget.mjs`.
7. **Summary:** `node rigging/scripts/qa_summary.mjs rigging/batches/<name>.json` writes
   `results/qa-<name>.md` and overview sheets in `previews/sample/`.
8. **Review:** look at every flagged subject, mark reviewed fixes in `rigging/subjects.json` (for example
   `removeIslands`), and record what you learned below.

## Settings per step

| Step | Setting | Why |
| --- | --- | --- |
| Neutral image | `image-to-image`, `seedream_v5`; `template: t_pose` for bipeds; body-plan prompt otherwise; hero prompts from the roster catalog | action poses are not riggable; T-pose rigs deform ~4× better |
| Model | v3.1, texture + PBR, Smart Mesh; `face_limit` 10000 creatures, 2000 props | Smart Mesh counts quads (10000 → ~13.6k triangles) |
| Rig | biped: `v3.0-20260909` + `spec: mixamo`; quadruped, avian, serpentine, hexapod, octopod: `v2.5-20260210`; others: `v3.0` | "others" only exists on v3.0; Mixamo names make clips and hit regions portable |
| Clips | biped: one shared library made on a donor rig (v3.0 presets: idle, walk, run, slash, hurt, fall; v1.0 presets for combat: chop, box, kick, hit reactions, defeat) and retargeted in world space to every humanoid; quadruped/hexapod/octopod walk; serpentine march; avian and others none | retargeted clips deform as well as each rig's own (walk 73% vs 77% on the golem); per-character presets become optional |
| Import | auto facing from the skeleton; rebase clip position tracks onto the bind pose; flag floating pieces ≥4% of height for review; props yaw −90° | API exports face ±X; non-biped exports sink without the rebase |

Cost per subject: biped with clips 130, quadruped/hexapod/octopod/serpentine with clip 80, avian or
others 70, equipment 40. Image generation runs one at a time per account (~20–85 s each); models, rigs
and clips run in parallel.

## Gates

| Gate | Pass | Where |
| --- | --- | --- |
| Riggable | rig-check `riggable: true` | batch run |
| Bones inside mesh | no major bone outside; if over 30% read as outside, the body is thin (bones, wings): check visually | bench `rigCheck` |
| Hit regions (bipeds) | ≥17 of 19 filled, lowest purity ≥60% | bench `hitRegions` |
| Deformation | worst-1% edge stretch ≤200% on every clip | bench `deformation` |
| Ragdoll | no joint separation, <1 m/s after 2.5 s at 3× gravity | bench `ragdoll` |
| Budget | creatures ≤15k triangles and 2 MB with clips; props ≤3k and 300 KB | `budget.mjs` |
| Floating pieces | every piece ≥4% of height from the body reviewed: `removeIslands` (artifact) or `keepIslands` (costume part) in `subjects.json` | QA sheet markers |

## Lessons (newest last; each with its evidence)

1. **Neutral image first.** From original action art the wolf and hawk were not riggable; from neutral
   images both rigged. Asha's T-pose rig cut worst-frame stretch from 414% to 99% in the run clip.
2. **rig-check's `rig_type` is a hint, `riggable` is reliable.** It answered "biped" for a sword. Rig type
   comes from the body plan.
3. **Humanoid beats "other" for two-armed, two-legged monsters.** On the T-posed golem, the humanoid rig
   got six clips and 18 of 19 hit regions; "other" got generic bone names, no clips, 1 region.
4. **Image generation is serial per account; 429 is free.** Give images their own one-slot queue, or
   waiting images block the model slots.
5. **Non-biped exports bind the root away from its node position** (0.18–0.28 model units), so clips
   sink the creature; rebase position tracks at import.
6. **API exports face ±X**: derive facing from foot → toe (bipeds) or tail → root; set it by hand for
   rigs with neither (golem "others" rig).
7. **UV seams stall mesh simplification**: a last seam-ignoring pass trims the final few percent (helmet
   3,519 → 2,985 triangles); better, ask for 2000 faces on props.
8. **Floating islands need a human.** Most islands are details (663 in the starting set, mostly 1.5–3% of
   height from the body: bristles, teeth, beads). Pieces ≥4% away are flagged and marked on the QA sheet
   (red removed, amber kept). In the starting set 7 of 34 creatures had flagged pieces: 2 artifacts (the
   bear's chin blob, Asha's broken braid tip; `removeIslands`) and 5 costume or body parts (the werebeast's
   chain, the mummy's hanging strip, the insect's feeler, the spider's leg pieces, the worm's bristles;
   `keepIslands`). Removing everything at ≥4% would have cut the werebeast's chain in half.
9. **Weight edits do not fix robes and skirts:** smoothing, hip blending and shin-to-thigh all raised
   Asha's run stretch (99% → 109–256%). Robes need cloth bones or simulation.
10. **Clips can be shared across Mixamo rigs** after keeping rotations only and scaling the root (golem
    walk 185% → 122%; its own clip 77%). A full retarget closes the rest.
11. **Hit volumes:** joints are limb slices (cylinders), not spheres: spheres either missed thick limbs or
    swallowed the palm. Purity checks weights against geometry. The bone-inside-mesh test is noisy on
    thin bodies.
12. **Ragdoll:** multibody joints never separate. Soft limits must be forces, because Rapier rebuilds
    multibody link velocities and impulses are lost; 10 Hz limits and 8 substeps keep overshoot near 1 rad.
13. **One-image armor sets fail:** image generation kept the cuirass and dropped helmet, legs and boots
    twice. Generate equipment piece by piece.
14. **Process:** `pkill -f <pattern>` and `pgrep -f <pattern>` also match the shell running them (it
    happened twice). Use a bracket pattern such as `pgrep -f "batch_ru[n]"`. A killed batch leaves tasks
    running and charged: adopt them. Never edit a bash script while it runs; restart it.
15. **Image task failure 1001** ("Failed to generate image") is transient: the Rotwalker Shambler failed
    once and succeeded on the retry pass. Failed tasks cost nothing.
16. **rig-check has false negatives:** it called the Bristle Hog (a clean standing boar), the Slime Blob
    and the Elemental Wisp unriggable; all three rigged when asked anyway. The retry pass
    (`batch_run.py --retry`) rigs regardless (a failed rig is free) and lets the bench judge.
17. **Head-bone gate:** Mixamo's head end sits on top of the skull, so a correct head reads ~40% outside
    the mesh (Asha, checked visually); flag the head only at ≥80% (the golem reads 100%), other major bones
    at ≥60%, and ignore ground-level roots and unnamed `bone_N` extras.
18. **Quadruped hit regions** come from Tripo's chain names (head, neck, torso, foreleg, hindleg, paw,
    tail); the head must include the unnamed jaw and ear bones under the head chain.
19. **Exotic body plans are weak:** the octopod walk tore a spider leg (worst-frame stretch 590%); thin
    legs (insect, spider) keep the capsule ragdoll from settling. Snakes and worms take their *thickness*
    as "height"; framing scales with body length.
20. **Throughput and cost:** 91 subjects took 56 minutes plus a 7-minute retry pass and cost 6,070
    credits, exactly the estimate. Images (one at a time, 22–85 s) are the bottleneck; give every subject
    its own thread so equipment models fill the model slots while creature images queue.

21. **Cloth bones do not rescue fused robes.** Image-to-3D returns one shell where robe and trousers
    share faces. Spring chains around the hips tore them in every setting tried (Asha's T-pose run:
    100% → 169–707%), as did weight edits. T-pose rigs already keep robes within the gate (≤200%), so the
    cloth code was removed (owner decision, 2026-11-18).
22. **v1.0 rigs carry the combat library.** `v1.0-20240301` accepts `spec: mixamo` and returns 23 bones
    (no fingers), with 90+ presets. Five combat clips cost 75 credits including the rig and deform at
    89–157% on their own rig.
23. **World-space retargeting makes clips portable.** Replaying each bone's rotation relative to its own
    rest pose, in the shared scene frame, moved the combat clips onto Asha, Wenyn, Kelan, the golem, the
    goblin and the orc at 52–183%, and v3.0 walks onto other rigs as well as their own clips.
    Rotations-only copying laid every character sideways.
24. **Take rest from the bind pose.** The v1.0 export's default node pose has the arms turned about
    180° from its bind pose; using the file's node pose as "rest" froze arms in a T.
25. **Name clips exactly.** Matching names by substring made `hit_to_head` replace `hurt`; map only exact
    preset names to bench roles.

26. **Tripo props face +X**, like Tripo characters: helmets and shields mount with a −90° yaw (the helmet
    was on backward). A helmet's bounding box hides its crest and shell thickness, so fit it ~35% over the
    head's own extents (middle 90% of the head vertices, skull base to crown); 12% left the scalp showing.
    Voluminous hair (Kelan) makes the helmet huge: such heroes need a hair-hidden-under-helmet variant.
27. **Grips need a fist.** The handle runs along the knuckle line through the fist center (T-pose rigs rest
    palms down, so the palm is world −Y at rest), and the finger and thumb joints curl around it on top of
    every clip (`applyGrip`). Without the curl the sword looked glued to the back of an open hand.

## Backlog (next experiments)

- Hair under helmets: a hair-hidden head variant per hero, or shrink-to-skull for helmet wear.
- Grow the shared combat library: more v1.0 presets on the donor (10 credits each), one set for every
  humanoid; check that two-handed weapon grips survive the retarget.
- Hit regions for 6- and 8-legged chains (`2_`/`3_` limbs), and geometry-based regions for birds,
  snakes and "others" (quadrupeds are done).
- Per-family head mapping (golems: head bone sits above the head nub).
- Fitting wearable armor (cuirass, legs, boots, robes) to the shared skeleton.
- Spider and insect: try `others` rigs or hand-placed leg weights; a leg-aware ragdoll (thin capsules,
  stiffer limits) for many-legged bodies.
- Storage: Cloudflare R2 bucket and `sync_r2.py` (needs owner-created keys; `notes/storage-and-scenes.md`).
- Scenes: Hearth-01 kit test (~20 pieces, ~1,000 credits; `notes/storage-and-scenes.md`).
- Owner: send `notes/tripo-license-question.md` to Tripo.

## Change log

- 2026-11-17: pipeline established on the API (Experiment 2b). Neutral images, humanoid rigs, Tripo
  clips, import fixes, bench gates.
- 2026-11-17: image queue split from model slots; `adopt` for orphaned tasks; batch planner and runner;
  quick QA mode and QA summary; starting set (10 heroes, 30 monsters, 60 equipment) launched.
- 2026-11-17: starting set done (7 heroes, 27 monsters, 57 equipment; 6,070 credits, 63 min). Retry pass
  rigs despite rig-check; quadruped hit regions; head-bone gate refined; one thread per subject.
- 2026-11-18: cloth bones tested and kept opt-in (fused shells tear); v1.0 combat clips plus world-space
  retarget make one clip library serve every humanoid; exact clip naming; storage and scenes plan.
- 2026-11-18: cloth code removed; floating pieces flagged for review instead of auto-removed; helmets face
  forward and fit the head; procedural fist for sword grips.
