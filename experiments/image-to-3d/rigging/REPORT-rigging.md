# Experiment 2: rigged, animated characters with Tripo

Status: shortened on 2026-11-17 at the owner's request. The goblin side-by-side in Tripo Studio was
replaced by a production-style sample on the Tripo API (owner-approved, cap 900 credits; 720 spent).
Local models (TRELLIS, Hunyuan3D-2, Qwen) are out of the pipeline by owner decision.

## Answer

**Production rule: regenerate a neutral-pose image for every creature before image-to-3D.** It costs
5 credits and 20–50 seconds, and it decided every comparison we ran:

| Subject | From original art | From neutral-pose image |
| --- | --- | --- |
| Gray wolf (stalking crouch) | rig-check: **not riggable** | riggable, quadruped rig, Tripo walk plays |
| Hunting hawk (diving, scenic background) | rig-check: **not riggable**, broken mesh | riggable, avian rig |
| Asha (near-neutral standing art) | rigged; robe tears in run/attack/death | rigged; deforms ~4× better (below) |
| Clay guardian (your Studio runs) | humanoid rig put the head bone outside the skull (bench flags it) | T-pose image rigged much better (your report) |

Asha, worst-1% edge stretch per clip (lower is better; same Tripo presets on both rigs):

| Clip | Original art | T-pose image |
| --- | --- | --- |
| walk | 168% | 62% |
| run | 414% | 99% |
| slash (attack) | 453% | 103% |
| hurt | 264% | 114% |
| fall (death) | 488% | 91% |

The original Experiment 2 question (segmented crouched goblin vs neutral goblin) was not run as
designed: you judged Segment unnecessary (weapons come as separate pieces; hit regions come from the
skeleton). Your crouched Studio goblin passes the static gates (bones inside the mesh except one short
clavicle, hit-volume purity 0.82–1.0 except the throat at 0.51), but it has no clips, so it could not be
judged on deformation. The evidence above supports the stricter rule, "neutral image for every monster",
not "original art for similar poses".

## Recommended pipeline (all API, unattended)

| Step | Tripo call | Credits | Wall time seen | Gate |
| --- | --- | --- | --- | --- |
| 1. Neutral image | `image-to-image`, seedream v5; `t_pose` template for bipeds, prompt for creatures | 5 | 22–53 s | glance: identity kept, full body, plain background |
| 2. Model | `image-to-model` v3.1, texture + PBR, Smart Mesh, `face_limit` 10000 (creatures) / 2000 (props) | 40 | 2–6 min (queued in parallel) | — |
| 3. Rig check | `rig-check` | 0 | 6 s | `riggable` must be true; ignore its `rig_type` (it said "biped" for a sword) |
| 4. Rig | `rig`, type from the catalog family; bipeds `v3.0` + `spec: mixamo` | 25 | 11 s–4 min | bench: bones inside mesh, hit-volume purity |
| 5. Clips | `retarget` presets, ≤5 per call | 10 per clip | 11–32 s | bench: deformation p99, worst frame |
| 6. Budget | `rigging/scripts/budget.mjs` (gltf-transform) | 0 | seconds | ≤15k tris, ≤2 MB; props ≤3k tris, ≤300 KB |

Per asset: biped with six clips **130 credits ($1.30)**; quadruped with walk 80; creature without clips
70; equipment piece 40. A starting set of 30 monsters, 10 heroes and 60 equipment pieces is about
7,600 credits (~$76). The API accepts about five or six concurrent generations; extra submissions get
HTTP 429 (not charged) and the client waits and retries. This sample's 10 chains finished in about
25 minutes of wall time with no hands-on steps, which points to roughly 40–50 creatures per hour.

**Does production need the API?** Yes. Your Studio timings (image-to-3D 27 s / 100 credits, texture
70 s / 30 credits, rig 30 s / 20 credits) are fast per click, but every asset also needs export,
renaming and filing by hand, and only the API lets the gates in steps 3–6 run automatically. Texturing
was your longest machine step; on the API it is folded into step 2.

## Humanoid or "other"

Use a biped rig whenever the body has two arms and two legs, and always from the T-pose image. The
clay guardian failed as a humanoid from its original pose, not as a humanoid per se. Non-biped rigs come
back with generic bone names (`tripoRoot`, `bone_9`, `tripoTail_1`), and the API's only non-biped
animation preset is `preset:quadruped:walk`, so choosing "other" for a humanoid-shaped monster gives up
Tripo animation and clip sharing entirely. Decide the rig type from the catalog family, not rig-check.

## Animations: what to do

- **Bipeds: Tripo presets per character** (your intention, and what this sample used): idle, walk, run,
  slash, hurt, fall cost 60 credits and arrive in ~30 s as one GLB with named clips. Weak spots:
  "slash" reads as a crouching grab, not a sword swing, and there is no death clip ("fall" stands in).
- **Combat attacks and deaths need another source.** All Tripo biped rigs share the Mixamo skeleton, so
  a Mixamo-compatible library (the owner would download it; no account was created here) or a few
  hand-keyed attacks can be shared across every humanoid. Still untested: rest-pose differences between
  rigs need a retarget step, so goblin-to-raider and external-clip-to-goblin retargeting are next.
- **Quadrupeds:** Tripo gives a walk only. It works after one import fix (below). Run, attack and death
  need procedural motion or an animator.
- **Birds and other bodies:** no API presets at all; procedural flapping or an animator.

## Equipment

**Generate equipment as individual pieces.** Sword, shield and helmet came out clean and mount in code:
sword gripped in the right hand, shield strapped to the outer left forearm facing outward, helmet fitted
to the head bone. A full armor set composed into one image failed twice (2×2 sheet and head-to-feet
stack): image generation kept only the cuirass and dropped the helmet, leg armor and boots. Segment
itself worked on the resulting model (8 parts, 40 credits, 114 s). Wearable body armor (cuirass, legs,
boots) still needs a fitting method; the next experiment is skinning individually generated pieces to the
shared Mixamo skeleton.

## Pass/fail by subject

| Entry | Rig | Bones in mesh | Hit purity (min) | Clips | Worst p99 stretch | Ragdoll (3× g) | Budget |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API Asha, T-pose image | biped, 65 bones | flags Spine2, Head (likely hood/wrap double surface; volumes look right) | 0.81 | 6 Tripo | 114% (hurt) | settles, 0 separation | 13.7k tris, 989 KB with 5 clips ✅ |
| API Asha, original art | biped, 65 | ✅ | 0.70 | 6 Tripo | 488% (fall) ❌ robe | settles | ✅ |
| API wolf, neutral image | quadruped, 33 (front legs asymmetric: 5 vs 4 bones) | root only | — | walk (after fix) | 73% | settles | 15k tris, 600 KB ✅ |
| API hawk, neutral image | avian, 61 | thin wings confuse the test | — | none available | — | settles | 12.6k tris ✅ |
| API armor set on mannequin | biped, 65 | ✅ | 0.81 | — | — | settles | ✅ (but the set is incomplete) |
| Studio goblin (crouched art) | biped, 65 | LeftShoulder | 0.51 (throat) | none | — | settles | 9.6k tris, 444 KB ✅ |
| Studio clay guardian (original pose) | biped, 65 | **Head ❌** | 0.80 | none | — | settles | 10.9k tris, 324 KB ✅ |
| API sword / shield / helmet | — | — | — | — | — | — | 3.0k / 3.0k / **3.5k tris ❌** (use `face_limit` 2000) |

Outputs: color + normal + ORM maps at 2048² (the normal map carries the surface detail; your Studio
exports had base color only at 4096²). Faces are counted as quads by Smart Mesh: `face_limit` 10000
yields ~13.6k triangles.

## Bench fixes from your review

- **Shield held like a tray** → new `forearm` mount: strapped to the outer forearm, face outward,
  following the arm. Swords use a `grip` mount with hold point and blade direction; helmets a `head` mount.
- **Hit regions misplaced** → regions are now primitive volumes fitted around each bone and attached to
  it (what the game would register as Rapier sensors): a head sphere, throat capsule, one torso box per
  spine bone, elbow/wrist/knee spheres, forearm capsules. Radii ignore outliers (ears, a fused spear). A
  purity score checks skin weights against them, and a separate check reports bones outside the mesh.
  That check is what exposes the clay guardian's misplaced head bone.
  The Experiment 1 Blender golem you reviewed still fails (head purity 0%, throat 46%, no knee volume)
  because its bones are misplaced; the checks flag it, and that rig left the pipeline with the local models.
- **Ragdoll balled up** → hips always get a body (thighs and spine were detached roots before), soft
  joint limits (swing cone and twist per part; Rapier's JS API has no limits on spherical joints, and
  limited hinge chains gained energy), and self-collision between non-neighboring parts. It now lies
  out flat. Known gap: soft limits still overshoot briefly in hard falls.
- **Import fixes found on the way:** exports are turned to face forward automatically from the skeleton
  (API exports face sideways), and clip position tracks are rebased onto the bind pose. Tripo's
  non-biped exports bind the root 0.18–0.28 model units away from its node position, which sank the walking wolf
  into the ground.

## Still needs a person

- Glance at each neutral image (identity, full body) and each worst-frame sheet.
- Long robes and skirts: Tripo skins them to both legs, and they tear when the legs split (Asha's
  worst-1% stretch in the knee band still peaks at 330–560% on the T-pose rig). Needs cloth bones, physics, or tighter costume art.
- Small detached pieces: Asha's braid tip came out as a separate floating piece.
- Attack and death animation beyond Tripo's presets; all non-walk quadruped and bird motion.
- Per-weapon grip angles (the sword reads as held backward in the walk).

## Licenses and ownership

- Tripo: outputs here were made with API credits the owner bought for this account. Terms §5.2.2
  ("Paid Users generally have all rights") does not define "Paid User", and no API endpoint reports a
  plan. **Confirm in writing with Tripo that API-credit purchases count as paid use** before shipping.
- Meshy: not used. Experiment 1 local tools: dropped from the pipeline.

## Evidence

- Sheets: `previews/sample/generation.webp`, `previews/sample/rigging.webp`,
  `previews/sample/asha-run-original-vs-tpose.webp`, `previews/sample/wolf-walk-side.webp`.
- Per rig: `previews/<entry>/` (clip strips, worst frames, weapons, ragdoll, hit regions, day/night)
  and `results/<entry>.json`; budgets in `results/budget.json`; every Tripo task with credits and
  seconds in `results/tripo-tasks.json`.
- Re-run: `python rigging/scripts/batch_sample.py --budget <credits> [chain ...]`, then
  `node rigging/scripts/build_manifest.mjs`, `node rigging/scripts/engine_tests.mjs`,
  `node rigging/scripts/budget.mjs`. Bench page: `rigging/engine.html`.
