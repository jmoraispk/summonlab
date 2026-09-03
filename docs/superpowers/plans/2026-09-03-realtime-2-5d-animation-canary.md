# Realtime 2.5D Animation-and-Depth Canary Implementation Plan

Design: [2026-09-03-realtime-2-5d-combat-study-design.md](../specs/2026-09-03-realtime-2-5d-combat-study-design.md)

**Status:** Owner-approved design; ready for implementation.

## Outcome

Upgrade `/living-village-lab/realtime-combat` so Asha and one lesser rat visibly idle, advance,
attack, react, recover, and fall in response to the existing deterministic encounter. Move world
health bars above visible character bounds and make the 2.5D lens materially different from the flat
2D lens through projection and environmental overlap. Do not expand animation to the full cast until
the canary passes a phone-scale visual review.

## Scope controls

### In scope

- One authored Asha motion pack in the existing up-field combat direction.
- One authored lesser-rat motion pack in the existing down-field combat direction.
- Idle, advance, attack, hit, and down clips with stable feet anchors.
- Agent decision and resolved-event cues that drive clips without moving combat authority into Pixi.
- Screen-space, asset-authored health-bar placement.
- Trapezoidal 2.5D world projection, nonlinear depth scale, separated occluders, camera framing,
  directional shadows, and reduced-motion behavior.
- The current flat 2D lens as a matched control over the same simulation state.
- Asset, unit, browser, performance, and visual validation for the canary.

### Out of scope

- Animating Toma, Nessa, the Rat Brute, or every lesser-rat instance with unique packs.
- Eight-direction locomotion, free camera rotation, or horizontal mirroring of Asha.
- Full skeletal or 3D models, inverse kinematics, navigation meshes, or physics-driven ragdolls.
- Changing damage, cooldowns, target legality, seed, encounter outcome, or production mission state.
- Adding model calls or exposing private agent reasoning.

## Technical direction

Use a pose-atlas hybrid rather than a full runtime skeleton. Each canary actor receives authored,
full-body transparent frames on a fixed canvas. PixiJS `AnimatedSprite` plays the frames, while small
container transforms supply sub-frame easing, contact compression, recoil, hit-stop, and secondary
motion. This preserves the painterly character rendering and gives attacks authored silhouettes
without requiring hidden-joint reconstruction from the current flattened paintings.

The simulation remains fixed-step and deterministic. It emits monotonically increasing cue revisions
for action start, hit receipt, and defeat. A presentation-local animator consumes each revision once,
chooses the appropriate clip, finishes non-looping clips, and returns to idle or advance without
restarting a clip on every simulation tick.

```text
fixed-step actor state
  -> public cue revision (advance / attack / hit / down + facing)
  -> clip-state projector
  -> per-actor animator
  -> AnimatedSprite frame + sub-frame transforms
  -> projected feet anchor, shadow, occlusion, and screen-space health UI
```

## Asset contract

Create versioned canary assets under:

```text
assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/asha/
assets/enemies/experiments/realtime-combat-study-v1/animation-canary-v1/lesser-rat/
apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/
```

Each runtime pack contains a spritesheet PNG, Pixi-compatible atlas JSON, and a motion manifest. The
manifest is authoritative for identity, direction, clip timing, loop behavior, fixed frame canvas,
bottom-center feet anchor, visible bounds, health-bar clearance, contact-shadow footprint, and source
provenance.

Minimum clip budgets:

| Actor | Idle | Advance | Attack | Hit | Down |
| --- | ---: | ---: | ---: | ---: | ---: |
| Asha | 4–6 looping frames | 6–8 looping frames | 6–8 frames | 2–3 frames | 4–6 frames |
| Lesser rat | 3–4 looping frames | 5–6 looping frames | 4–6 frames | 2 frames | 3–5 frames |

All frames must share one canvas size and a feet anchor within two source pixels. Asha must preserve
her right shaved temple, marking, left-side braid, face, costume construction, adult proportions, and
light direction. Rejected generations remain outside runtime. Selected generations, edit prompts,
hashes, and any mechanical alpha/cell processing are added to the existing provenance record.

## Work sequence

### 1. Freeze visual evidence and acceptance measurements

**Modify**

- `docs/superpowers/specs/2026-09-03-realtime-2-5d-combat-study-design.md`
- `assets/heroes/visuals/realtime-combat-study-v1/PROVENANCE.md`

**Create**

- `docs/evidence/realtime-combat-animation-canary/README.md`

Record the approved screenshot as review context without copying user attachments into Git. Define
the phone and desktop viewport sizes, required animation checkpoints, face-clearance rule, feet-slide
tolerance, projection contrast, and a stable screenshot naming scheme. Treat the current static slice
as the baseline rather than silently replacing its evidence.

Acceptance measurements:

- health bars clear the per-frame visible top by at least 12 logical pixels;
- clip-to-clip feet movement stays within two source pixels before world motion is applied;
- Asha never uses runtime horizontal mirroring;
- the near actor is at least 25% larger than an equivalent far actor in 2.5D and the same size in 2D;
- 2.5D far-lane horizontal span is at least 20% narrower than the near lane;
- camera impulse stays below 7 logical pixels and is removed under reduced motion.

### 2. Add test-first motion and projection contracts

**Create**

- `apps/web/src/lib/components/living-village/realtime-combat/combat-motion-manifest.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/combat-motion-manifest.spec.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/combat-cue-projector.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/combat-cue-projector.spec.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/depth-projection.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/depth-projection.spec.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/health-bar-layout.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/health-bar-layout.spec.ts`

Define and test:

- valid clip names, frame ranges, frames per second, loop rules, anchors, visible bounds, and
  presentation direction;
- rejection of missing clips, duplicate frames, non-finite anchors, canvas mismatches, and unknown
  actor IDs;
- one-time consumption of attack, hit, and down cue revisions;
- precedence `down > hit > attack > advance > idle` and completion behavior for non-looping clips;
- no clip restart when the actor remains in the same simulation intent;
- rectangular 2D projection versus trapezoidal 2.5D projection over identical world coordinates;
- nonlinear depth scale, far-lane convergence, stable projected feet, and deterministic z-order;
- health-bar placement above authored visible bounds at constant logical size.

Run after this step:

```bash
pnpm --filter @summonlab/web exec vitest run \
  src/lib/components/living-village/realtime-combat/combat-motion-manifest.spec.ts \
  src/lib/components/living-village/realtime-combat/combat-cue-projector.spec.ts \
  src/lib/components/living-village/realtime-combat/depth-projection.spec.ts \
  src/lib/components/living-village/realtime-combat/health-bar-layout.spec.ts
```

### 3. Extend simulation output without changing encounter results

**Modify**

- `apps/web/src/lib/components/living-village/realtime-combat/realtime-combat.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts`

Add presentation-safe state only: velocity, facing angle or authored facing sector, action revision, hit
revision, defeat revision, and public action kind. Increment revisions only when the corresponding
resolved event occurs. Preserve the current policy, target hysteresis, damage, cooldowns, seed, and
terminal result.

Add regression assertions that the pre-canary encounter settles with the same winner, defeated-rat
count, and deterministic state sequence. Verify that presentation fields cannot change target
validity, damage, or timing.

### 4. Produce and validate the Asha motion canary

**Create or extend**

- `tools/build-realtime-combat-motion-pack.mjs`
- `tools/validate-realtime-combat-motion-pack.mjs`
- `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/asha/`
- `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/asha/`

Use the owned canonical hero plus the selected combat anchor as identity references. Generate one
clip at a time, always in the approved up-field orientation, then normalize alpha, canvas, feet
anchor, color, and lighting. Assemble the accepted frames into one atlas only after every clip passes
the identity and motion gate.

Review in this order:

1. idle and advance at 140–180 rendered pixels;
2. attack silhouette, anticipation, contact, and recovery;
3. hit reaction without identity or costume drift;
4. down pose with readable defeat and no gore;
5. complete loop continuity and stable feet.

Stop expansion if the pack reads as morphing, sliding, mirrored, childlike, or costume-unstable.

### 5. Produce and validate the lesser-rat motion canary

**Create**

- `assets/enemies/experiments/realtime-combat-study-v1/animation-canary-v1/lesser-rat/`
- `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/lesser-rat/`

Create the approved down-field idle, scurry, bite, hit, and down vocabulary. Keep the spine infection
trace, ragged ears, tail length, body mass, camera, and lighting stable. The rat may use a smaller
frame budget than Asha, but the scurry must move limbs and spine rather than merely bobbing the whole
sprite.

Run the pack validator on both actors and persist selected source IDs, prompts, hashes, atlas output,
and rejection notes.

### 6. Add an isolated actor animator

**Create**

- `apps/web/src/lib/components/living-village/realtime-combat/actor-animator.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/actor-animator.spec.ts`

**Modify**

- `apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte`

Load the motion atlases through one Pixi Assets bundle. Replace the canary actors' static `Sprite`
views with `AnimatedSprite` views managed by `actor-animator.ts`; retain the static fallback for
Toma, Nessa, Rat Brute, and non-canary rat instances. Keep actor state, clip state, and rendering in
separate objects.

Use simulation time for decision cues and presentation time for frame playback. Pausing freezes both.
Reduced motion retains authored frame animation but removes camera impulse and large runtime
displacement. Attack and hit clips may briefly ease or hold their contact frame, but must not delay or
alter simulation damage.

### 7. Move health bars to a dedicated UI layer

**Modify**

- `apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte`
- `apps/web/src/lib/components/living-village/realtime-combat/health-bar-layout.ts`

Remove health tracks from depth-scaled actor containers. Render them in `transientUiLayer`, project
from each actor's feet plus the active frame's union visible bounds and manifest clearance, and keep
their thickness constant across depth.

Behavior:

- persistent party vitality remains in the DOM HUD;
- a hero world-bar appears after damage and fades after a short readable hold;
- an enemy world-bar appears once engaged or damaged and remains through defeat settling;
- bars never rotate with downed bodies, scale with depth, or cover a face, weapon, braid, or ears.

### 8. Strengthen the 2.5D world projection and occlusion

**Create**

- `apps/web/static/runtime/combat/realtime-study-v1/environment-occluders-v1/`
- `apps/web/src/lib/components/living-village/realtime-combat/environment-occluders.ts`
- `apps/web/src/lib/components/living-village/realtime-combat/environment-occluders.spec.ts`

**Modify**

- `apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte`
- `apps/web/src/lib/components/living-village/realtime-combat/depth-projection.ts`

Extract exact transparent overlays for the well, left awning/fence, right stall, and foreground
palisade from the existing original environment plate. Keep the base environment unchanged so
overlays can reproduce its pixels without seams. Give each overlay an authored ground-footprint and
z-threshold; insert it into the same projected sort domain as actor feet.

In 2.5D mode:

- converge horizontal positions toward the far lane;
- use nonlinear depth scale and Y sort;
- let actors pass behind authored props;
- deform shadows along the ground plane and lantern direction;
- frame the active engagement with at most a 4% dolly and bounded camera impulse;
- preserve restrained fog and plane-specific parallax.

In 2D mode, use the existing rectangular placement, fixed scale, fixed team-layer priority, rounder
shadows, and no environmental occlusion or camera parallax. Switching modes consumes the current
simulation snapshot and does not restart or retarget the battle.

### 9. Make agent-to-animation decisions inspectable

**Modify**

- `apps/web/src/routes/living-village-lab/realtime-combat/+page.svelte`
- `apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts`

Extend the existing disclosure with public target, intent, active clip, and last resolved action. On
a target change, briefly show a quiet world-space target marker or tether; remove it after the choice
is understood. Do not expose hidden chain-of-thought or add decision text over the battlefield.

Keep the policy unchanged for the canary. Asha's cluster preference, Toma's interception, and Nessa's
range/finisher policy are a later behavior slice after motion and depth pass review.

### 10. Verify the canary and stop at the expansion gate

Run:

```bash
pnpm exec prettier --check \
  apps/web/src/lib/components/living-village/realtime-combat \
  apps/web/src/routes/living-village-lab/realtime-combat \
  assets/heroes/visuals/realtime-combat-study-v1 \
  docs/superpowers
pnpm --filter @summonlab/web exec eslint \
  src/lib/components/living-village/realtime-combat \
  src/routes/living-village-lab/realtime-combat
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web exec vitest run \
  src/lib/components/living-village/realtime-combat
PLAYWRIGHT_PORT=5173 pnpm --filter @summonlab/web exec playwright test \
  src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
pnpm --filter @summonlab/web build
```

Also run a 60-second browser soak with frame-time sampling. Inspect desktop and 390×844 phone captures
at idle, advance, attack contact, hit, down, and actor/occluder crossings in both modes. Check pause,
resume, replay, mid-fight mode switching, reduced motion, keyboard focus, alpha edges, feet sliding,
clip restarts, health clearance, and particle cleanup.

Known repository-wide baseline lint/build failures must be rechecked and reported separately from
feature-specific failures; do not fold unrelated monster-index repairs into this slice.

Do not animate the remaining cast yet. Present the Asha-versus-rat canary and matched 2D/2.5D captures
for owner review. Expansion requires explicit acceptance of:

1. identity stability across all Asha frames;
2. motion quality at phone scale;
3. health-bar clearance and legibility;
4. immediately perceptible 2.5D depth and occlusion;
5. acceptable runtime performance and asset size.

## Commit sequence

Keep commits reviewable and push each completed outcome to `origin/codex/realtime-combat-study`:

1. `test(combat): define animation canary contracts`
2. `art(combat): add Asha and rat motion canary`
3. `feat(combat): project agent cues into animation`
4. `feat(combat): strengthen depth and health staging`
5. `test(combat): verify animation canary experience`

If asset production needs multiple correction passes, keep rejected binaries outside Git and commit
only selected source-bound artifacts plus provenance.
