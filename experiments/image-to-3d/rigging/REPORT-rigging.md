# Experiment 2: rigged, animated characters with Tripo

Status: shortened on 2026-11-17 at the owner's request and run as a production sample on the Tripo
API. Round 1 (720 credits): Asha, wolf, hawk, sword, shield, helmet, armor set. Round 2 (415
credits, after owner feedback): the clay golem from a T-pose image rigged both ways, and two more heroes.
Local models (TRELLIS, Hunyuan3D-2, Qwen) are out of the pipeline. Owner decisions live in
`notes/decisions.md`.

## Rules (accepted unless marked)

1. **Generate a neutral-pose image for every creature before image-to-3D** (accepted). 5 credits,
   22–85 s. Evidence below.
2. **Equipment as individual pieces** (accepted). The one-image armor set dropped pieces twice.
3. **Humanoid (Mixamo) rig for every two-armed, two-legged body, from its T-pose image**
   (proposed; round 2 evidence below). Rig type comes from the catalog family; rig-check only gates
   `riggable`.
4. **Starting set:** about 30 monsters, 10 heroes, 60 equipment pieces (accepted sizing).

### Why the neutral image (round 1)

| Subject | From original art | From neutral-pose image |
| --- | --- | --- |
| Gray wolf (stalking crouch) | rig-check: **not riggable** | riggable, quadruped rig, Tripo walk plays |
| Hunting hawk (diving, scenic background) | rig-check: **not riggable**, broken mesh | riggable, avian rig |
| Asha (near-neutral standing art) | rigged; robe tears in run/attack/death | rigged; deforms ~4× better (below) |
| Clay guardian (your Studio runs) | humanoid rig put the head bone outside the skull | T-pose image rigged much better (your report) |

Asha, worst-1% edge stretch per clip (lower is better; same Tripo presets on both rigs): walk 168% →
62%, run 414% → 99%, slash 453% → 103%, hurt 264% → 114%, fall 488% → 91%.

### Humanoid or "other": settled on the golem (round 2)

Same T-pose model, rigged twice:

| | Humanoid (Mixamo) rig | "Other" rig |
| --- | --- | --- |
| Bones | 65, Mixamo names | 18, generic (`tripoRoot`, `bone_1` …) |
| Tripo animation | six presets played; worst-1% stretch 70–152% | **none available** in the API |
| Hit regions | 18 of 19, purity ≥79% | 1 of 19 (no named bones to map) |
| Known flaw | head bone sits above the small head nub (flagged) | — |

The humanoid failure you saw came from the original pose, not from the humanoid rig type. From the
T-pose image the humanoid rig is as clean as Asha's. "Other" also requires `model: v3.0-20260909`;
v2.5 rejects it with error 1004 (uncharged).

## Recommended pipeline (all API, unattended)

| Step | Tripo call | Credits | Wall time seen | Gate |
| --- | --- | --- | --- | --- |
| 1. Neutral image | `image-to-image`, seedream v5; `t_pose` template for bipeds, prompt for creatures | 5 | 22–85 s, **one at a time** | glance: identity kept, full body, plain background |
| 2. Model | `image-to-model` v3.1, texture + PBR, Smart Mesh, `face_limit` 10000 (creatures) / 2000 (props) | 40 | 2–6.5 min, several in parallel | — |
| 3. Rig check | `rig-check` | 0 | 6 s | `riggable` must be true |
| 4. Rig | `rig` v3.0, `spec: mixamo` for bipeds; v2.5 for quadruped/avian | 25 | 11 s–4 min | bench: bones inside mesh, hit-volume purity |
| 5. Clips | `retarget` presets, ≤5 per call | 10 per clip | 6–32 s | bench: deformation, worst frame |
| 6. Import | bench/game import: auto facing, bind-pose rebase, island report | 0 | seconds | review floating islands |
| 7. Budget | `scripts/budget.mjs` | 0 | seconds | ≤15k tris, ≤2 MB; props ≤3k, ≤300 KB |

Per asset: humanoid with six clips **130 credits**; quadruped with walk 80; creature without clips 70;
equipment piece 40. The starting set is about 7,600 credits. Throughput: image generation is serial
(roughly 40–140 images an hour), and everything after it runs in parallel. Round 2's three subjects
took 8.5 minutes from first image to last clip. The client now queues four tasks per process and
retries HTTP 429 (never charged).

**Does production need the API?** Yes. Studio is fast per click (your timings: image-to-3D 27 s,
texture 70 s, rig 30 s), but every asset also needs export, renaming and filing by hand, and only
the API lets steps 3–7 run as automatic gates.

## Hit volumes: injury-grade (round 2)

19 regions per humanoid, each a primitive attached to its bone (what the game registers as Rapier
sensors), with the side taken from the bone:

- **Head and torso:** head (sphere on the head's own vertices), throat (capsule), chest and abdomen
  (one box per spine bone, split at the middle of the chain), pelvis (box).
- **Arms:** shoulder, elbow, wrist (joint *slices*: cylinders as thick as the limb and a band along
  the bone, so they reach the skin on thick limbs without swallowing the palm); upper arm and forearm
  (capsules).
- **Hands:** palm (box across the knuckle line), thumb and fingers (one capsule per phalanx, so they
  curl with the finger).
- **Legs:** hip, knee, ankle (slices); thigh and shin (capsules); foot and toes (capsules).

| Rig | Regions filled | Lowest purity | Note |
| --- | --- | --- | --- |
| Asha, T-pose | 19/19 | 81% (throat) | |
| Wenyn, T-pose | 19/19 | 84% (thumb) | |
| Kelan, T-pose | 19/19 | 41% (shoulder) | capelet skinned to the neck; 63%+ elsewhere |
| Golem, T-pose, humanoid | 18/19 | 79% (wrist) | no head region: head bone above the nub |
| Armor set on mannequin | 19/19 | 81% | |
| Studio goblin (crouched art) | 19/19 | 36% (thumb) | fist clenched on the spear |
| Asha, original art | 19/19 | 27% (thumb) | another point for the neutral image |

Purity is the share of a region's vertices whose strongest skin weight sits on the expected bones; low
purity means the rig's weights disagree with the geometry. A separate check reports bones that lie
outside the mesh (the golem's head; the Experiment 1 Blender golem fails both checks and left the
pipeline).

## Still-failing issues: fixed or proposed

| Issue | What was tried | Result | Proposal |
| --- | --- | --- | --- |
| Robe and skirt tear when the legs split (Asha; Kelan's skirt shows the same knee-band stretch) | smoothing cloth weights, blending toward the hips, moving shin weight to the thigh | **all worse**: Asha T-pose run 99% → 109–256% | **Cloth bones**: at import, hang 6–8 spring bones around the hips, skin the cloth that hangs off the legs to them, and let them swing and collide with the leg capsules. Free; about a day to prototype in the bench. Alternatively, a design rule for combat heroes: robes slit to the hip. |
| Floating braid tip (Asha) | detect pieces with a gap to the body | auto-removal also deleted **47 dangling ornaments** on your goblin | **Fixed by review**: islands are reported in the bench result and removed only for assets marked `removeIslands` after a look (Asha's 2 pieces, both at the braid end; earring kept). |
| Sword held backward | grip along the knuckle line (pinky → index), blade out of the thumb side | **fixed**: blade points forward from the fist and follows the hand in every clip | per-weapon hold points for axes, maces and spears |
| Helmet over the 3k budget | stronger simplification, then a seam-ignoring last pass | **fixed**: 2,985 triangles, 113 KB | generate props with `face_limit` 2000 |
| Ragdoll overshoot | stiffer soft limits (10 Hz), 8 substeps | **better**: worst brief overshoot 0.6–1.3 rad on humanoids (was 1.4–2.6); 2.0–2.8 on the hawk and the armor mannequin | if visible in play: limit only the worst joints harder, or blend to an animated "get hit" pose for the first 0.2 s |
| API concurrency | queue + 429 retry | **fixed**: no failed submissions in round 2 | run all images first, then models in parallel |
| Attacks and deaths beyond Tripo's 11 v3.0 presets | read the retarget docs; tested clip sharing | v1.0 rigs offer 90+ presets, incl. `chop`, `box_01–03`, `front_kick_01–02`, `cast_a_spell`, `hit_to_head`, `hit_to_body`, `defeat_02–03`. Borrowed clips work once rotations-only: golem walk 185% → 122% (own clip 77%) | **Test a v1.0 rig on Asha's T-pose model with five combat presets (~75 credits)**, then share those clips across all humanoids with the rotations-only retarget |
| Golem head bone above the head nub | — | flagged by the rig check | per-family mapping: on golems, "head" = top of the neck volume |
| Non-humanoid hit regions (wolf, hawk) | — | 2–4 of 19 regions | map Tripo's quadruped names (`Head_*`, `Spine_*`, `0/1_Left/Right_Limb_*`, `Tail_*`) to head, neck, torso, fore/hind leg, paw, tail; birds need geometry-based regions |
| Ownership of API outputs | — | `notes/tripo-license-question.md` | owner sends it to Tripo |

## Animations: what to do

- **Every humanoid gets Tripo's six v3.0 presets** (60 credits, ~30 s): idle, walk, run, slash, hurt,
  fall. Round 2 rigs play them cleanly (worst-1% stretch 62–157%).
- **Combat variety:** v1.0 presets (above) are the cheapest source to test next. Clips can then be shared:
  every v3.0 rig uses Mixamo names, and a borrowed clip works after keeping rotations only and scaling
  the root (bench entries `share/…`). The remaining gap to a rig's own clip needs a full retarget.
- **Quadrupeds:** Tripo walk only (works after the bind-pose rebase). **Birds and "other" rigs:** no
  presets; procedural motion or an animator.

## Pass/fail by subject

| Entry | Rig | Clips | Worst-1% stretch | Hit regions (min purity) | Ragdoll | Budget |
| --- | --- | --- | --- | --- | --- | --- |
| API Asha, T-pose | biped 65 | 6 | 49–117% ✅ | 19/19 (81%) ✅ | settles | 13.7k tris, 989 KB ✅ |
| API Asha, original art | biped 65 | 6 | 105–488% ❌ robe | 19/19 (27%) | settles | ✅ |
| API Wenyn, T-pose | biped 65 | 6 | 62–157% ✅ | 19/19 (84%) ✅ | settles | 15k, 1.07 MB ✅ |
| API Kelan, T-pose | biped 65 | 6 | 68–144%; skirt knee band up to 413% | 19/19 (41% shoulder) | settles | 15k, 1.02 MB ✅ |
| API golem, T-pose, humanoid | biped 65 | 6 | 70–152% ✅ | 18/19 (79%), no head | settles | 13.4k, 960 KB ✅ |
| API golem, T-pose, "other" | 18 generic | none | — | 1/19 ❌ | settles | ✅ |
| API wolf, neutral image | quadruped 33 (front legs 5 vs 4 bones) | walk | 73% | 4/19 (not mapped) | settles | 15k, 600 KB ✅ |
| API hawk, neutral image | avian 61 | none exist | — | 2/19 (not mapped) | settles | 12.6k ✅ |
| Studio goblin / golem | biped 65 | none | — | 19/19 (36% / 65%) | settles | ✅ |
| Sword / shield / helmet | — | — | — | — | — | 3.0k / 3.0k / 3.0k tris ✅ |

## Licenses and ownership

Outputs were made with API credits the owner bought. Terms §5.2.2 ("Paid Users generally have all
rights") does not define "Paid User". The owner should send the drafted question in
`notes/tripo-license-question.md` before shipping.

## Evidence

- Sheets in `previews/sample/`:
  - `generation.webp`, `generation-2.webp`: inputs, neutral images, models.
  - `rigging.webp`, `round2-rigs.webp`: rigs, clips, mounts, hit volumes, ragdoll.
  - `asha-run-original-vs-tpose.webp`, `wolf-walk-side.webp`, `clip-sharing-golem.webp`: single comparisons.
- Per rig: `previews/<entry>/` and `results/<entry>.json`.
- Budgets: `results/budget.json`.
- Every Tripo task with its credits and seconds: `results/tripo-tasks.json` (1,135 credits, 54 tasks).
- Re-run steps:
  1. `python rigging/scripts/batch_sample.py --budget <credits> <chain …>`
  2. `node rigging/scripts/build_manifest.mjs`
  3. `node rigging/scripts/engine_tests.mjs` (add `PARTS=hits` for hit regions only)
  4. `node rigging/scripts/budget.mjs`
- Probes:
  - `rigging/scripts/skirt_variants.mjs`: the cloth-weight tests.
  - `rigging/scripts/clip_share_probe.mjs`: shared clips.
  - `rigging/scripts/ragdoll_probe.mjs`: limit tuning.
