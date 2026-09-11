# Asha Spine Exploration Canary Design

**Status:** Approved by the project owner on 2026-09-10.

## Purpose

Prove that Summonlab can build, export, load, and visually review one identity-safe Spine 4.3
exploration character without risking the approved Asha artwork or coupling this art experiment to
the Floor One implementation branch. The canary covers a restrained idle and one measured tile
traversal. It does not establish a roster-wide modular-character pipeline.

Success means failures are early, bounded, reversible, and attributable to art decomposition, Spine
generation, runtime loading, motion, or exploration integration. A generated candidate may still fail
visual review; no technical result is approved artwork.

## Authority and immutable inputs

The project-owner-authorized identity source is:

- `assets/heroes/visuals/realtime-combat-study-v1/saffron-braid-source-v1.png`
- SHA-256: `3cc917c4b0b15bfce012bb2fcdbf01d1cb4977871fdc222b4db3afd32120fa77`

The accepted transparent cutout used for registration and initial runtime transport is:

- `apps/web/static/runtime/combat/realtime-study-v1/hero-saffron-braid-ready-v1.png`
- SHA-256: `9f6704c825a642c1664cc34573a2e2264a9d3d2f0cf85c5f65ee6c09f4bb5a2b`
- Format: 768×768 RGBA PNG

The existing motion sheet is comparison evidence only:

- `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/asha/asha-motion-sheet-source-v2.png`
- SHA-256: `3a8ebfd62479c95aec94b934e5cebb24770ad9bea019b96f7388d5bdd0e4902f`

None of these files may be overwritten, regenerated, or promoted by this canary. New artwork and
runtime output use versioned sibling paths and remain `candidate` until owner approval.

## Corrected technical target

The supplied proposal named a React shell, but this repository uses SvelteKit. The target is:

```text
Spine Editor 4.3.26 Professional
  -> generated Spine import JSON
  -> versioned .spine project
  -> Spine JSON + atlas + PNG export
  -> @esotericsoftware/spine-pixi-v8 4.3.x
  -> PixiJS 8.20.0
  -> isolated SvelteKit review route
```

Editor and runtime major/minor versions must both be 4.3. The generator always passes
`--update 4.3.26`; it never uses `latest`, `stable`, or `4.3.xx`. The runtime package is pinned to an
exact 4.3 release.

The local Spine application and activation are machine prerequisites, not repository artifacts.
Activation material, launcher settings, and the Spine distribution remain ignored and must not
appear in logs, manifests, commits, or CI artifacts.

## Scope

### Included

- Immutable input-hash and collision preflight.
- A no-new-art transport canary using the accepted cutout as one region attachment.
- One bounded decomposition gate for the body/core, near arm, and braid.
- A minimum articulated Asha rig only after decomposition passes.
- One restrained exploration idle and one measured tile traversal.
- Headless Spine import/export, semantic round-trip validation, and atlas validation.
- An isolated SvelteKit/PixiJS playback surface on this art branch.
- Final visual validation against the actual Floor One route on
  `codex/floor-one-exploration-design`, without merging its implementation here.

### Excluded

- Combat animation changes or replacement of Asha's existing motion atlas.
- Village landmarks, hero cards, combat transitions, loot, or fog behavior.
- Multiple facing directions, horizontal mirroring, or free camera rotation.
- Modular skins, deterministic appearance generation, tint channels, multiple builds, or equipment.
- Meshes, weights, IK, physics, or deform keys before a rigid attachment fails a named gate.
- Blender-generated parts. The supplied Blender strategy remains a separate art-sourcing experiment.
- Runtime promotion into exploration before owner acceptance.

## Ownership boundaries

The automation is split into five independently testable units:

1. **Manifest and preflight:** source hashes, version pins, paths, identity locks, and collisions.
2. **Candidate artwork:** only new versioned decomposition outputs and provenance.
3. **Spine generator:** validated rig description to deterministic Spine 4.3 import JSON.
4. **Spine runner and validator:** editor invocation, import/export, and semantic comparison.
5. **Review surface:** validated output and instance-local playback, with no exploration authority.

Generator inputs are authoritative for this automation-only canary. The `.spine` project and runtime
exports are reproducible products. Manual `.spine` edits are unsupported because they create a
competing source of truth.

## Gated workflow

### Gate 0: Environment and authority

Before creating output:

- verify all three input hashes;
- verify Spine is activated and editor `4.3.26` launches;
- verify every proposed candidate/output path is absent;
- verify the Spine distribution, activation settings, and scratch data are ignored;
- verify PixiJS remains `8.20.0`; and
- select an exact `@esotericsoftware/spine-pixi-v8` 4.3.x version before installation.

Any mismatch is a no-output failure. Automation does not repair or replace an input.

### Gate 1: Transport canary without generated art

Use the unmodified accepted cutout as one region attachment on a minimal skeleton. Add a
non-production `idle_transport_probe` that moves only enough to prove animation timelines reach the
runtime. Import it into a versioned `.spine` project, export JSON/atlas/PNG, and load it through the
isolated browser route.

This proves the editor version, JSON schema, attachment path, atlas pack, runtime parser, Pixi
renderer, anchor convention, and review surface. It does not claim articulated motion quality.

Gate 1 passes only when:

- Spine import and export both exit zero;
- the exported skeleton declares Spine 4.3;
- round-trip validation finds the expected bone, slot, attachment, animation, duration, and keys;
- the atlas contains one expected region and no missing page;
- the browser loads without Spine/runtime warnings; and
- the cutout matches source bounds, orientation, and bottom-center feet anchor.

### Gate 2: Bounded decomposition

The flattened cutout cannot supply pixels hidden behind limbs, braid, or clothing. One identity-bound
raster edit may create a separated body/core, near arm, and braid presentation. One targeted
correction is allowed for a local defect. Repeated cell or edge patching is forbidden.

For this gate, `body/core` is the otherwise complete setup-pose character with the near arm and braid
removed and their newly exposed overlap regions reconstructed. It is deliberately not the final
fully segmented torso. Combining `body/core`, near arm, and braid must therefore reproduce one
complete setup-pose character.

Persist the output under a new versioned candidate directory with reference paths and hashes, exact
prompt, generation/edit mode, returned source path, output hashes, reconstructed regions, and visual
disposition (`candidate`, `revise`, or `failed`).

Recompose the three parts into the setup pose and compare them with the accepted cutout at source
resolution. Fail on face or marking drift, braid-side reversal, silhouette change, costume or palette
redesign, missing or duplicate anatomy, dirty alpha, visible shoulder holes, or unusable overlap.
Failed candidates remain evidence and never reach the rig generator.

### Gate 3: Minimum rigid rig

Only after Gate 2 passes, complete this rigid part set:

- body/core;
- head;
- near and far upper/lower arms with hands;
- near and far upper/lower legs with feet;
- braid; and
- front robe panel.

Use explicit snake-case bones and slots. Draw order remains fixed for the authored up-field direction.
Never mirror. Joint overlap is deliberately generous so restrained rotations do not expose gaps.
Meshes, weights, physics, and IK stay absent.

If a named joint fails despite restrained rotation and sufficient overlap, record the joint and stop.
A later scoped revision may add one mesh or weighted attachment for that joint. The canary never adds
generalized deformation preemptively.

### Gate 4: Motion

Validate idle before tile traversal. Each clip starts from the exact setup pose. Tile traversal ends
on that pose so `exploration_idle_up_field -> tile_walk_up_field -> exploration_idle_up_field` has no
snap. Playback state is instance-local.

### Gate 5: Contextual review

This branch provides an isolated calibration route for source-resolution inspection, transparent
checkerboard inspection, gameplay scale, and clip debugging. It does not copy Floor One files here.

Final visual acceptance consumes the candidate from `codex/floor-one-exploration-design`, whose Floor
One pilot owns the tile map and click movement. This downstream integration is not part of this
branch's history. Use a disposable integration worktree or equivalent uncommitted review surface;
do not merge or copy Floor One implementation files into the art branch. The candidate is not
exploration-ready until it is reviewed over the actual floor at the deliberately smaller
hero-to-tile scale requested by the owner.

## Motion authority

### Exploration idle

```text
Character / clip: Asha / exploration_idle_up_field
Action authority: Repository idle clip contract
Gameplay intent: Keep a stationary exploration hero alive without suggesting combat readiness.
Starting pose / prerequisite state: Setup pose, both feet planted, diagonally up-field.
Motion sentence: Asha breathes, shifts weight subtly, and lets her braid and robe settle.
Frame beats: setup -> slight inhale/asymmetric rise -> quiet gaze/weight shift -> exhale -> setup
Acting limb / delivery: Torso and pelvis initiate; braid and robe respond secondarily.
Target direction / contact beat: No target or impact; both feet remain in continuous contact.
Support/contact sequence: both, both, both, both, both
Contacts / center of mass: Feet locked; center of mass stays inside the planted base.
Loop seam or terminal state: Final keys equal setup pose; no snap.
Equipment / identity constraints: Preserve right shaved temple and marking, left braid,
saffron-and-cream costume, adult proportions, palette, and up-field camera.
Camera / anchor / scale locks: Fixed camera; bottom-center feet anchor; no scale pulsing.
Directions / mirror policy: One authored up-field direction; never mirror.
Allowed effects: None.
Forbidden alternatives: Combat guard, synchronized full-body bob, hopping, foot lift, or weapon.
Forbidden visual changes: Face, marking, braid side, anatomy, costume, palette, or lighting redesign.
Runtime contract: 1.8-second loop; normal speed while stationary.
```

### Measured tile traversal

```text
Character / action: Asha / tile_walk_up_field
Gameplay intent: Move exactly one exploration tile without running or combat dashing.
Motion sentence: Asha walks one measured two-contact stride and settles at the destination.
Starting pose / prerequisite state: exploration_idle_up_field setup pose, both feet planted, with one
legal adjacent up-field destination selected.
1. Beat one — departure: Shift weight toward the right leg; release the left heel while lowering the
center of mass slightly.
2. Beat two — left contact: Advance and plant the left foot; keep the right foot behind while weight
begins transferring forward.
3. Beat three — passing: Support on the left while the right foot lifts and passes; arms
counter-swing modestly and braid/robe lag.
4. Beat four — right contact: Plant the right foot nearer the destination and transfer weight onto it;
release the left foot without an airborne run phase.
5. Beat five — arrival: Draw the left foot into setup stance, center weight over both feet, settle
secondary motion, and match exploration_idle_up_field exactly.
Acting limb / delivery: Alternating leg support supplies one walking action; arms only counterbalance.
Target direction / contact beat: Diagonally up-field; destination arrival is beat five. Foot contacts
occur at beats two and four and are not combat contacts.
Contacts / center of mass: right-dominant -> left contact -> left support -> right contact -> both.
Equipment / identity constraints: Preserve right shaved temple and marking, left braid,
saffron-and-cream costume, adult proportions, palette, and up-field camera.
Loop seam or terminal state: Non-looping; terminal pose exactly matches exploration idle setup.
Forbidden alternatives: Running, airborne gait, hopping, sliding, combat dash, attack anticipation,
horizontal mirroring, exaggerated bounce, or costume redesign.
Runtime contract: Exploration exclusively interpolates source tile to destination tile. Spine supplies
in-place limb motion with planted-foot compensation; root translation is never keyed in Spine.
```

The first candidate uses one measured duration selected by the implementation plan and exposes it as
review data. A duration change requires retesting planted-foot compensation.

## Automated validation

The implementation plan provides failing tests before production code for:

- source hashes and output collisions;
- exact editor/runtime compatibility;
- generator schema and naming;
- semantic round-trip equality for bones, slots, attachments, animations, durations, and keys;
- atlas integrity, 2048×2048 maximum page size, and RGBA inputs;
- setup-pose equality at idle and tile-walk boundaries;
- absence of root translation and horizontal mirroring;
- instance-local playback;
- runtime load failure handling; and
- browser coverage of idle, one move, chained moves, arrival, and reduced motion.

Review occurs at source resolution and gameplay scale. Watch idle for at least three loops. Test one
move, chained moves, one rapid legal retarget, and arrival. Record identity, contact/weight,
registration, loop/terminal state, alpha, draw order, and gameplay readability separately.

## Stop conditions

Stop without broadening work when:

- an authoritative source hash changes or an output path exists;
- exact Spine 4.3 runtime compatibility cannot be established;
- Gate 1 cannot round-trip or render the unmodified cutout;
- decomposition fails after one correction;
- rigid motion requires broad full-body mesh repair;
- coherent motion requires mirroring or multiple directions;
- actual Floor One context is unavailable for final review; or
- the owner rejects the candidate direction.

Stopping at a gate is a successful risk-control result. It preserves accepted artwork and leaves the
next decision explicit.

## Acceptance and promotion

Technical validation produces a `candidate`; it cannot approve art. Owner approval follows playback
against Floor One. Promotion into exploration is a separate change on the exploration branch and must
preserve exploration's authority over tile legality, position, fog, and interaction state.
