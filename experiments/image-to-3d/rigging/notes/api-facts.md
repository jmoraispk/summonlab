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

## Learned while running Experiment 2b (2026-11-17)

- Concurrency: image-to-image runs **one task at a time** per account; image-to-model, rig and retarget
  accept several (we ran up to six). Extra submissions return HTTP 429 `code 2000` "exceeded the limit
  of generation"; nothing is charged. `scripts/tripo.py` queues four tasks per process and retries 429s.
- Rig models (T/animations-rig): default `v1.0-20240301` is biped-only with **90+ presets**;
  `v2.5-20260210` covers quadruped, hexapod, octopod, serpentine, aquatic and avian; `v3.0-20260909`
  is the humanoid model and the **only one that accepts `rig_type: others`** (v2.5 fails it with
  error 1004 "Invalid input parameter"). `spec` (tripo, mixamo, actorcore, unity, unreal, vrm) applies to
  bipeds only.
- Retarget presets (T/animations-retarget): v3.0 bipeds have 11 (`preset:idle|walk|run|dive|climb|jump|
  slash|shoot|hurt|fall|turn`). v1.0 bipeds have 90+ as `preset:biped:<name>`, including combat-relevant
  `chop`, `box_01..03`, `front_kick_01..02`, `cast_a_spell`, `fire`, `shoot`, `slash`,
  `hit_to_head|body_01|body_02|side|stomach`, `hurt`, `defeat_02..03`, `fall`, `flee_01..02`. Non-biped:
  `preset:quadruped:walk`, `preset:hexapod:walk`, `preset:octopod:walk`, `preset:serpentine:march`,
  `preset:aquatic:march`; **no avian preset**. Whether v1.0 presets work on a v3.0 rig, and whether a
  v1.0 rig accepts `spec: mixamo`, is undocumented.
- rig-check's `rig_type` is only a hint (it answered `biped` for a sword); `riggable` was reliable in
  every case we checked.
- Exports: API rigs face +X or -X, not +Z (the bench derives facing from the skeleton). Non-biped exports
  bind the root 0.18–0.28 model units away from its node translation; clips key the node value, so
  position tracks must be rebased onto the bind pose at import.
- Image-to-model with Smart Mesh counts quads: `face_limit` 10000 gave ~13.6k triangles; 3000 gave
  4.6–5.2k. Use 2000 for props. Outputs carry color + normal + ORM maps at 2048².
