# Tripo Studio checklist for Experiment 2

> **Superseded on 2026-11-17:** the pipeline now runs on the Tripo API (`scripts/batch_sample.py`); see
> `REPORT-rigging.md` and `notes/decisions.md`. Kept for the record of the Studio-only plan.

You run these steps by hand in Tripo Studio, on your paid subscription. I run everything after the
exports land. Inputs are in `experiments/image-to-3d/rigging/tripo-inputs/`. Save every export to
`experiments/image-to-3d/rigging/tripo-exports/`. Both folders are gitignored.

**If Studio's labels differ from mine,** use the closest match and write the real label in `TIMING.md`.
Those notes become the production recipe.

## Before you start

- Copy `rigging/TIMING-template.md` to `rigging/tripo-exports/TIMING.md`. For each step, write down the
  minutes it took, the credits it cost, and anything odd. That is how we'll decide whether production needs
  the API.
- Use these settings everywhere unless a step says otherwise:

| Setting | Value |
| --- | --- |
| Model version | newest (v3.1 or later) |
| Texture | on |
| PBR | on |
| Texture quality | standard |
| Smart Mesh / low-poly | on, triangles (not quads) |
| Face limit | about 15,000 for creatures; about 3,000 for the spear |

- **Export format:**
  - glTF binary (`.glb`) with textures embedded.
  - For rigged files, include the mesh and the skeleton.
  - For animated files, also include the animation, with **in place** (no root motion) on for walk and run.
  - If Studio can put several clips in one GLB, do that and name the file `<subject>__clips.glb`.
    Otherwise export one GLB per clip.
- **File names:** `<subject>__<stage>.glb`, using exactly the names below. Lower case, two underscores.

## Order, in case time runs short

1. Neutral goblin (A–C). Critical.
2. Crouched goblin with Segment (D). Critical.
3. Hog (E).
4. Spear prop (B).
5. Raider (F).
6. HD + retopology comparison (G).

## A. Neutral A-pose goblin image

Use Studio's image generation (AI image / image-to-image), with `2-goblin-reference-for-neutral-and-spear.png`
as the reference image.

1. Prompt:

   > The exact same goblin character as the reference: same face, wrinkles, ears, earrings, skin color, body
   > proportions, loincloth, belt and ankle band. Redraw him standing upright in a neutral A-pose, facing the
   > camera straight on: arms straight and angled about 30 degrees away from the body, open empty hands with
   > fingers relaxed, palms facing the thighs, legs straight and slightly apart, feet flat on the ground. He
   > holds no weapon and nothing in his hands. Full body from head to toes, nothing cropped, plain light gray
   > background, soft even studio lighting, no shadows on the ground, same painterly-realistic style.

2. If Studio has a **T-pose / A-pose template or toggle**, also run one with it, using the same reference.
3. Pick the best result. It should be the same face and outfit, with empty hands and full body visible.
4. Download it as `goblin-neutral__source.png`. If you rejected others, save them as
   `goblin-neutral__rejected-1.png` and so on, so I can report the hit rate.

## B. Spear image and prop

1. Image generation with the same reference, plus an asset-extraction template if Studio has one. Prompt:

   > Extract only the goblin's crude spear from the reference: the wooden shaft with leather bindings and the
   > iron leaf-shaped spearhead. Show the complete spear alone, full length, lying horizontally, viewed from
   > the side, nothing cropped, no hands, no character, plain light gray background, soft even lighting, same
   > painterly-realistic style and colors.

2. Save the chosen image as `spear__source.png`.
3. Run **Image to 3D** on it with the default settings, but face limit about 3,000.
4. Export `spear__mesh.glb`.

## C. Neutral goblin: model, rig, clips

1. **Image to 3D** on `goblin-neutral__source.png`, with the default settings. Export `goblin-neutral__mesh.glb`.
2. **Auto Rig** as **humanoid / biped**.
   - If Studio offers a skeleton standard, choose **Mixamo**. Mixamo bone names let me test standard
     external clips. Note which one you picked.
   - Export `goblin-neutral__rigged.glb`: mesh and skeleton, no animation, in rest pose.
3. **Animations**: make these six. If a name doesn't exist, pick the closest and note it.

   | Clip | File name |
   | --- | --- |
   | idle | `goblin-neutral__idle.glb` |
   | walk | `goblin-neutral__walk.glb` |
   | run | `goblin-neutral__run.glb` |
   | attack (slash or punch) | `goblin-neutral__attack.glb` |
   | hit reaction (hurt) | `goblin-neutral__hit.glb` |
   | death (fall or die) | `goblin-neutral__death.glb` |

   Or export them all together as `goblin-neutral__clips.glb`.

## D. Crouched goblin: model, Segment, rig, clips

1. **Image to 3D** on `1-goblin-crouched.png`, with the default settings. Export `goblin-crouched__mesh.glb`.
2. **Segment** that model.
   - Export the segmented result with all parts as `goblin-crouched__segmented.glb`.
   - Take a screenshot of the part view and save it as `goblin-crouched__segment.png`.
3. If the spear is its own part, **delete or hide it**. If Studio offers **Complete / fill holes**, run it to
   close the hands.
   - Export the body alone as `goblin-crouched-nospear__mesh.glb`.
   - If the spear part exports on its own, save it as `goblin-crouched__spear-part.glb`.
   - **If the spear is not cleanly separable, stop this sub-step** and note how it failed.
4. **Auto Rig** the spear-less body as humanoid / biped, with the same skeleton standard as in C.
   - If it refuses, note the exact message.
   - If there's no spear-less body, rig `goblin-crouched__mesh.glb` instead and note that.
   - Export `goblin-crouched__rigged.glb`.
5. **Animations**: the same six clips as in C, named `goblin-crouched__idle.glb` and so on, or
   `goblin-crouched__clips.glb`.

## E. Bristle Hog

1. **Image to 3D** on `4-hog.png`, with the default settings. Export `hog__mesh.glb`.
2. **Auto Rig** as **quadruped**. Note whether a pre-rig check or type picker appears, and what it says.
   Export `hog__rigged.glb`.
3. **Animations**: export every quadruped clip Studio offers. At minimum walk; also run, attack, hit and death
   if they exist. Name them `hog__walk.glb` and so on, or `hog__clips.glb`. Note which ones were missing.

## F. Goblin Raider (stretch)

1. **Image to 3D** on `5-raider.png`, with the default settings. Export `raider__mesh.glb`.
2. **Auto Rig** as humanoid / biped, with the same skeleton standard as the goblins. Export `raider__rigged.glb`.
3. **Animations**: walk and attack only. Export `raider__walk.glb` and `raider__attack.glb`. I'll test the
   goblin's clips on the raider myself.

## G. HD + retopology comparison (last)

1. **Image to 3D** on `goblin-neutral__source.png` with HD / Ultra geometry and HD texture, and **Smart Mesh off**.
   Export `goblin-neutral-hd__mesh.glb`.
2. **Retopology / Smart Low Poly / Reduce** that model to about 15,000 triangles. Leave texture baking on if
   it's an option, and note whether a **normal map** option exists.
   Export `goblin-neutral-hd__retopo.glb`.

## When you're done

Tell me. I'll:

- inspect every file: faces, topology, texture maps, bones, clips;
- run the in-engine tests: deformation, spear on the hand bone, Rapier ragdoll, hit regions, day/night
  texture, budget;
- write `REPORT-rigging.md`, including which steps took you longest.
