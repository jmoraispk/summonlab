# Hosted API facts used by Experiment 2 (checked 2026-11-16)

Read from the official docs: T/ = https://developers.tripo3d.ai/en/docs/ ,
M/ = https://docs.meshy.ai/en/api/ . "Unverified" marks claims the docs leave open.

## Tripo (primary; API v3, launched 2026-04)

- Base `https://openapi.tripo3d.ai/v3`, `Authorization: Bearer <key>`. Create returns `data.task_id`;
  poll `GET /tasks/{id}` until the status leaves `queued`/`running` (success, failure, or a cancel/ban/expiry status). Results: `output.model_url`,
  `output.rendered_image_url`, `credits_consumed` (decimal). Failed tasks are not charged. (T/task-query, T/billing)
- Upload: `POST /files` (multipart `file`) → `data.file_token`; every task takes one `input` string
  (file token, URL or task id). (T/files)
- Image → 3D: `POST /generation/image-to-model`, `model=v3.1-20260211`. Options used here: `texture`, `pbr`
  (base color + metallic + roughness + normal), `texture_quality`, `geometry_quality=standard|detailed` (HD),
  `smart_low_poly` (Smart Mesh, 500–20K tris), `quad` (forces FBX), `face_limit`. (T/generation-image-to-model/standard)
- Image generation: `POST /generation/image-to-image` (`model=seedream_v5` default; `template=t_pose` exists,
  **no A-pose template** — A-pose must come from the prompt). Output `output.generated_image_url`. (T/generation-image-to-image)
- Retopology: `POST /mesh/decimate` (`model=v3.0`, `face_limit`, `quad`, `bake` default true). Whether it bakes a
  normal map from the high-poly is **undocumented**. (T/mesh-decimate)
- Segmentation: `POST /mesh/segment` (`model=v1.0-20250506` or `v2.0-20260430` beta with
  `segmentation_granularity`, `split_by_connectivity`, `ref_image`); completion `POST /mesh/complete`. (T/mesh-segment)
- Rigging: free `POST /animations/rig-check` → `riggable`, `rig_type`. `POST /animations/rig` with
  `model=v3.0-20260909` (humanoids; omitting `model` silently gives v1.0) or `v2.5-20260210` (non-humanoid),
  `rig_type=biped|quadruped|hexapod|octopod|avian|serpentine|aquatic|others`, `spec=tripo|mixamo|...`,
  `out_format=glb|fbx`. Bone names are **undocumented**. (T/animations-rig)
- Retarget: `POST /animations/retarget`, `input`=rig task id, `animation` or `animations` (≤5),
  `export_with_geometry`, `animate_in_place`. v3.0 biped presets: `preset:idle|walk|run|dive|climb|jump|slash|shoot|hurt|fall|turn`.
  Non-biped: `preset:quadruped:walk` only for quadrupeds. (T/animations-retarget)
- Account: `GET /account/balance` (`balance`, `frozen`). **No endpoint reports the plan/tier.** (T/account)
- Prices (1 credit = $0.01): image→3D 20 untextured / 30 textured; HD texture +10; HD geometry +20; quad +5;
  smart low-poly +10; decimate v3 35 (40 quad); segment 40; completion 50 / 30 quick cap; rig 25;
  retarget 10 per animation; rig check free; image generation ≈ 5 (seedream). (https://developers.tripo3d.ai/en/pricing)
- Ownership: Terms §5.2.2 "Paid Users generally have all rights" to outputs; §5.2.1 Tripo keeps rights to Free
  Users' outputs. "Paid User" is not defined and API credit purchase is not stated to qualify — confirm in
  writing with Tripo. (https://developers.tripo3d.ai/en/terms)

## Meshy (optional comparison)

- Base `https://api.meshy.ai`; API keys need a paid plan; outputs deleted after 3 days (non-Enterprise). (M/quick-start)
- Image → 3D `POST /openapi/v1/image-to-3d`: `ai_model=latest` (7.1), **`pose_mode=a-pose|t-pose`**,
  `should_remesh`, `topology=quad|triangle`, `target_polycount`, `enable_pbr`, `remove_lighting`. Outputs
  `model_urls.glb`, `texture_urls[]` (base_color, metallic, roughness, normal). (M/image-to-3d)
- Rigging `POST /openapi/v1/rigging`: **textured humanoids only, facing +Z**; `skeleton_template`
  (meshyrig, mixamo, ue5_mannequin, …); walking and running included free. (M/rigging)
- Animation `POST /openapi/v1/animations` with `action_id(s)` (≤10): Idle 0, Casual_Walk 30, Run_02 14,
  Attack 4, Hit_Reaction 178, Dead 8. (M/animation, M/animation-library)
- Balance `GET /openapi/v1/balance` (no plan name). (M/balance)
- Prices: image→3D 30 textured; remesh 5; rig 5; animation 3 per action; Pro $20 / 1,000 credits.
  Paid plans own outputs (Terms §3.2); Meshy may train on non-Enterprise content unless you opt out (§2.9).
  (M/pricing, https://www.meshy.ai/terms-of-use)
