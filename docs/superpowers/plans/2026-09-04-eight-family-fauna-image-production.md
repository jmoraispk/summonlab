# Eight-Family Fauna Image Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` to implement this plan with parallel image producers.
> Every producer must use `summonlab-image-production` for each assigned raster. Steps use checkbox
> (`- [ ]`) syntax for harness tracking.

**Goal:** Produce all 200 individual candidate images for the eight designed fauna families without
regenerating any image from the completed original enemy program.

**Architecture:** Preserve `family-affinity-v1` as the immutable completed 30-family,
750-coordinate program. Create a collision-safe production revision under `fauna-family-v1`, bind
the 40 committed forms to five individual targets each, and generate the Normal, Fire, Earth, Wind,
and Water candidate waves without interim owner checkpoints. Keep targets, assignments, candidates,
approved assets, and runtime assets as distinct states.

**Tech Stack:** Markdown, JSON production manifests, TypeScript/Zod production tooling, PNG raster
assets, `summonlab-image-production`, `imagegen`, Git, and pnpm.

**Spec:** `docs/superpowers/specs/2026-09-04-fauna-family-expansion-design.md`

## Plan boundary

This document contains implementation and production stages only. It intentionally contains no
separate verification, validation, visual-review, or approval stage. The controller must not add an
intermediate owner checkpoint. The final output remains candidate-only and is handed back as a
complete production matrix.

## Global constraints

- The scope is exactly eight families, 40 forms, and 200 individual candidate images.
- The affinities are exactly `normal`, `fire`, `earth`, `wind`, and `water` in that order.
- Rodents are excluded so they remain available for a later independent
  `summonlab-enemy-creation` skill test.
- The original 30 families, 150 forms, and 750 generated coordinates remain untouched.
- Do not regenerate, replace, rename, relocate, or reclassify existing-family images.
- Do not modify engine contracts, skills gameplay data, unrelated visual domains, or shared runtime
  catalogs.
- Each coordinate owns one individual raster. Contact sheets, composites, crops, and recolored
  copies do not count as coordinate output.
- Legacy images are reference-only and receive no automatic reuse, approval, or runtime status.
- Generated images remain candidates. The producer cannot self-approve or promote them to runtime.
- Each T1-T5 form changes combat function and silhouette; progression is not merely increasing size.
- T3 is the qualitative Specialist pivot. T5 is a Sovereign that coordinates lower family forms.
- Generate continuously without interim product questions, aesthetic decisions, or owner
  checkpoints.
- Resolve ordinary provider failures through collision-safe retries while unrelated coordinates
  continue.
- Commit and push collision-safe production batches throughout the run.

## Authoritative inputs

- `assets/enemies/experiments/fauna-family-v1/manifest.json`
- `assets/enemies/experiments/fauna-family-v1/active-sources.json`
- `assets/enemies/experiments/fauna-family-v1/families/01-wolves.json`
- `assets/enemies/experiments/fauna-family-v1/families/02-bears.json`
- `assets/enemies/experiments/fauna-family-v1/families/03-boars.json`
- `assets/enemies/experiments/fauna-family-v1/families/04-burrowers.json`
- `assets/enemies/experiments/fauna-family-v1/families/05-great-cats.json`
- `assets/enemies/experiments/fauna-family-v1/families/06-serpents.json`
- `assets/enemies/experiments/fauna-family-v1/families/07-crocodilians.json`
- `assets/enemies/experiments/fauna-family-v1/families/08-raptors.json`
- `docs/superpowers/specs/2026-09-04-fauna-family-expansion-design.md`
- `docs/wiki/creatures/fauna-family-expansion.md`

## Family roster

### Wolves

- T1: Gray Wolf — Flank-Probe Initiate
- T2: Dire Wolf — Hamstring Pursuer
- T3: Howler — Pack-Tempo Specialist
- T4: Pack Alpha — Prey-Marking Champion
- T5: Greatwolf — Hunt-Circle Sovereign

### Bears

- T1: Scrub Bear — Swipe-Commit Initiate
- T2: Cave Bear — Maul-Line Soldier
- T3: Hookclaw — Grapple Specialist
- T4: Scarback — Terrain-Breaker Champion
- T5: Ancient Ursine — Den-Territory Sovereign

### Boars

- T1: Bristle Hog — Straight-Line Initiate
- T2: Tunnel Boar — Brace-and-Charge Soldier
- T3: Razorback — Furrow-Cutting Specialist
- T4: War Tusker — Formation-Breaker Champion
- T5: Old Tusk — Stampede Sovereign

### Burrowers

- T1: Soil Grub — Ridge-Trace Initiate
- T2: Burrowing Worm — Eruption Soldier
- T3: Hookjaw Burrower — Drag-Under Specialist
- T4: Tremor Worm — False-Ridge Champion
- T5: Deep Maw — Tunnel-Network Sovereign

### Great Cats

- T1: Wildcat — Brush-Pounce Initiate
- T2: Lynx — High-Ground Soldier
- T3: Panther — Sightline Specialist
- T4: Sabercat — Pinning Champion
- T5: Pride Sovereign — Hunting-Territory Sovereign

### Serpents

- T1: Adder — Range-Probe Initiate
- T2: Constrictor — Space-Hold Soldier
- T3: Spitting Cobra — Venom-Lane Specialist
- T4: Horned Viper — Buried-Reach Champion
- T5: Crown Serpent — Living-Coil Sovereign

### Crocodilians

- T1: Mire Caiman — Waterline Initiate
- T2: River Crocodile — Clamp Soldier
- T3: Snarejaw — Bank-Drag Specialist
- T4: Bastion Alligator — Armored-Rotation Champion
- T5: Primeval Crocodile — Floodplain Sovereign

### Raptors

- T1: Carrion Kite — Shadow-Dive Initiate
- T2: Hunting Hawk — Repeated-Dive Soldier
- T3: Night Owl — Silent-Drop Specialist
- T4: War Eagle — Carry-Off Champion
- T5: Roc — Airspace Sovereign

## Shared image contract

Every image must preserve:

- family identity;
- the exact T1-T5 form and silhouette;
- combat archetype and battlefield duty;
- complete, coherent, load-bearing anatomy;
- the form's attack telegraph and exposed counterplay landmark;
- cinematic presentation and realistic material detail;
- one complete featured creature;
- no labels, UI, watermark, extra featured subject, or cropped anatomy.

The family packet supplies the exact anatomy, mechanic, telegraph, counterplay, and visual delta for
each coordinate. Those authored values take precedence over generic prompt language.

## Affinity construction contract

Affinity variants must change construction, motion, environmental response, and silhouette detail.
Palette-only variants are forbidden.

- **Normal:** Natural fur, feathers, scales, keratin, mud, saliva, dust, and biological movement. Do
  not add unexplained elemental anatomy.
- **Fire:** Localized combustion, heated anatomy, embers, smoke flow, cooling tissue, or heat vents
  follow the creature's mechanic. Do not apply a uniform orange or red wash.
- **Earth:** Mineral accretion, sediment, weighted anatomy, cracked scutes, reinforced claws, and
  detached moving stones follow load-bearing anatomy. Do not replace the living creature with a
  rock statue.
- **Wind:** Directional fur or feather lift, pressure wakes, airborne debris, and partial edge
  dissipation reveal movement. Do not rely on transparency or pale recoloring alone.
- **Water:** Flowing surface behavior, wet fur or feathers, pressure channels, droplets, refraction,
  and a stable anatomical core define the variant. Do not reduce the creature to an amorphous blue
  body.

## Task 1: Materialize the collision-safe production program

**Files:**

- Modify: `assets/enemies/experiments/fauna-family-v1/manifest.json`
- Create: `assets/enemies/experiments/fauna-family-v1/targets/**/target-v1.json`
- Create: `assets/enemies/experiments/fauna-family-v1/assignments/**/assignment-v1.json`
- Create: controller-owned production exports beneath
  `assets/enemies/experiments/fauna-family-v1/`

**Produces:** Exactly 200 manifest-bound coordinates and 200 exclusive assignments without changing
`assets/enemies/experiments/family-affinity-v1/`.

- [ ] Freeze the eight committed family packets into the next collision-safe `fauna-family-v1`
      production manifest revision.
- [ ] Expand every family packet into five forms and five ordered targets per form.
- [ ] Bind every coordinate to its family, form, tier, affinity, target path, assignment path,
      candidate path, result path, and exclusive producer identity.
- [ ] Render the exact per-coordinate prompt from the family packet's identity, anatomy, combat,
      telegraph, counterplay, visual-delta, and affinity fields.
- [ ] Preserve the completed `family-affinity-v1` program as an untouched external authority.
- [ ] Commit and push the materialized program as its own batch.

## Task 2: Produce the 40 Normal candidates

**Files:**

- Create: `assets/enemies/experiments/fauna-family-v1/candidates/**/normal-v*.png`
- Create: `assets/enemies/experiments/fauna-family-v1/results/**/normal-v*.json`
- Create: collision-safe retained provider-source and provenance records required by the production
  contract.

**Produces:** One individual Normal candidate for every authored form.

- [ ] Dispatch families in this order: Wolves, Bears, Boars, Burrowers, Great Cats, Serpents,
      Crocodilians, Raptors.
- [ ] Within each family, dispatch T1 through T5 in order.
- [ ] Use native biology, posture, surface material, habitat response, mechanic, and tier silhouette
      without elemental effects.
- [ ] Persist each returned raster and its result record only to its assigned collision-safe paths.
- [ ] Retain safe superseding attempts under incremented versions rather than overwriting earlier
      artifacts.
- [ ] Commit and push the Normal wave in collision-safe family batches.

## Task 3: Produce the 40 Fire candidates

**Files:**

- Create: `assets/enemies/experiments/fauna-family-v1/candidates/**/fire-v*.png`
- Create: `assets/enemies/experiments/fauna-family-v1/results/**/fire-v*.json`
- Create: matching retained source and provenance records.

**Produces:** One individual Fire candidate for every authored form.

- [ ] Bind each Fire coordinate to the matching form identity established by its Normal target.
- [ ] Apply anatomy-specific combustion, heat, smoke, ember, and cooling behavior from the family
      packet.
- [ ] Preserve the exact species, tier silhouette, combat mechanic, telegraph, and counterplay.
- [ ] Persist every raster and result to its exclusive assigned paths.
- [ ] Continue unrelated coordinates when an individual coordinate needs a collision-safe retry.
- [ ] Commit and push the Fire wave in collision-safe family batches.

## Task 4: Produce the 40 Earth candidates

**Files:**

- Create: `assets/enemies/experiments/fauna-family-v1/candidates/**/earth-v*.png`
- Create: `assets/enemies/experiments/fauna-family-v1/results/**/earth-v*.json`
- Create: matching retained source and provenance records.

**Produces:** One individual Earth candidate for every authored form.

- [ ] Bind each Earth coordinate to the matching form identity established by its Normal target.
- [ ] Apply living-anatomy mineral accretion, sediment, dust, weighted motion, cracks, reinforced
      contact points, and detached stones from the family packet.
- [ ] Keep fur, feathers, scales, flesh, joints, and other biological structure visible rather than
      converting the animal into solid rock.
- [ ] Preserve the exact species, tier silhouette, combat mechanic, telegraph, and counterplay.
- [ ] Persist every raster and result to its exclusive assigned paths.
- [ ] Commit and push the Earth wave in collision-safe family batches.

## Task 5: Produce the 40 Wind candidates

**Files:**

- Create: `assets/enemies/experiments/fauna-family-v1/candidates/**/wind-v*.png`
- Create: `assets/enemies/experiments/fauna-family-v1/results/**/wind-v*.json`
- Create: matching retained source and provenance records.

**Produces:** One individual Wind candidate for every authored form.

- [ ] Bind each Wind coordinate to the matching form identity established by its Normal target.
- [ ] Apply directional fur, feather, membrane, or scale motion plus pressure wakes, particulates,
      moving debris, and anatomy-appropriate edge dissipation.
- [ ] Keep the creature's anatomical core and exact form readable through every atmospheric effect.
- [ ] Preserve the exact species, tier silhouette, combat mechanic, telegraph, and counterplay.
- [ ] Persist every raster and result to its exclusive assigned paths.
- [ ] Commit and push the Wind wave in collision-safe family batches.

## Task 6: Produce the 40 Water candidates

**Files:**

- Create: `assets/enemies/experiments/fauna-family-v1/candidates/**/water-v*.png`
- Create: `assets/enemies/experiments/fauna-family-v1/results/**/water-v*.json`
- Create: matching retained source and provenance records.

**Produces:** One individual Water candidate for every authored form.

- [ ] Bind each Water coordinate to the matching form identity established by its Normal target.
- [ ] Apply wet material response, directional streams, pressure paths, droplets, wakes, refraction,
      and anatomy-specific stable body structure from the family packet.
- [ ] Keep the animal coherent and detailed rather than turning it into a shapeless blue mass.
- [ ] Preserve the exact species, tier silhouette, combat mechanic, telegraph, and counterplay.
- [ ] Persist every raster and result to its exclusive assigned paths.
- [ ] Commit and push the Water wave in collision-safe family batches.

## Task 7: Publish the complete candidate-matrix handoff

**Files:**

- Modify: `assets/enemies/experiments/fauna-family-v1/manifest.json`
- Create: `assets/enemies/experiments/fauna-family-v1/inventory.json`
- Create: `docs/evidence/fauna-family-v1/index.html`
- Create: `docs/evidence/fauna-family-v1/inventory.json`
- Modify only the authored and derived enemy wiki sources owned by this new production program.

**Produces:** A complete repository handoff for the 200 candidate coordinates without changing their
candidate-only status.

- [ ] Record every target, assignment, candidate, result, provenance record, active version, and
      unresolved provider failure in the production inventory.
- [ ] Generate one browsable HTML gallery organized by family, T1-T5 form, and Normal/Fire/Earth/
      Wind/Water affinity.
- [ ] Publish family-level and global counts while preserving distinct candidate, approved, and
      runtime fields.
- [ ] Update the fauna manifest and derived enemy documentation to point to the completed candidate
      matrix.
- [ ] Leave `approvedCount` and `runtimeCount` unchanged unless a separate owner-authorized process
      has already supplied those state transitions.
- [ ] Commit the final production handoff and push the current branch.

## Legacy disposition

| Legacy class | Disposition | Destination | Existing pixels |
| --- | --- | --- | --- |
| Gray Wolf | Promote identity | Wolves T1 — Gray Wolf | Reference-only |
| Dire Wolf | Promote identity | Wolves T2 — Dire Wolf | Reference-only |
| Cave Bear | Promote identity | Bears T2 — Cave Bear | Reference-only |
| Tunnel Boar | Promote identity | Boars T2 — Tunnel Boar | Reference-only |
| Burrowing Worm | Retire bridge and reframe | Burrowers T2 — Burrowing Worm | Reference-only |
| Armored Brood Guard | Secondary archetype | Arachnids | Reference-only |
| Death Knight | Secondary archetype | Skeletons | Reference-only |
| Cave Drake | Secondary archetype | Dragons | Reference-only |

Other legacy bridge material remains historical evidence outside the new 200-coordinate program.

## Autonomous execution rule

Run the entire program without asking for interim aesthetic feedback, product decisions, or owner
approval. The controller owns queue construction, collision-safe assignment, retries, persistence,
batch commits, pushes, inventory maintenance, and the final handoff. Only an unrecoverable external
blocker may interrupt execution.
