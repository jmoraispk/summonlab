# Real-Time 2.5D Combat Study Design

**Status:** Owner-approved direction on 2026-09-03; design awaiting owner review before implementation planning.

## Purpose

Build an isolated, visually ambitious real-time combat study that tests whether Summonlab can achieve
the readable, polished party-versus-monster presentation seen in the supplied *Last Asylum: Plague*
clips without copying that game's assets, characters, interface, names, or data.

The study is not a replacement for the accepted turn-based combat direction. It is a sibling lab
used to compare how autonomous real-time combat feels and looks before any production combat decision
is made.

## Approved product decisions

- Use a 2.5D PixiJS presentation rather than introducing a full 3D renderer.
- Prioritize character, environment, animation, impact, and camera quality over manual control depth.
- Make the first encounter fully autonomous. One skill may fire automatically when its tactical
  conditions and cooldown permit.
- Keep available actions and the actor's current public intent inspectable in a quiet developer
  sidecar. The battlefield itself stays clean and cinematic.
- Use the owner-supplied saffron-clad, long-braided woman as the identity anchor for the hero art
  pipeline.
- Keep all supplied gameplay videos outside Git. They are private behavioral and visual references,
  not runtime assets.
- Develop on branch `codex/realtime-combat-study` in the sibling worktree
  `/home/joao/Documents/summonlab-realtime-combat-study`.

## Reference findings

The supplied footage shows three control sources operating on a common-looking world and actor
presentation:

1. settlement locomotion driven by a virtual joystick;
2. autonomous combat locomotion driven by target selection and attack range;
3. authored story locomotion driven by a cinematic timeline and camera choreography.

The reusable idea is not one global movement algorithm. It is one actor presentation and animation
contract whose desired motion can be supplied by different controllers. This study implements only
the autonomous combat controller while preserving that boundary for later settlement and story
experiments.

The combat reference is a fixed-camera, real-time encounter. Heroes acquire enemies, run into range,
face targets, play attacks, receive hits, use skills on cooldown, and settle briefly between actions.
Health bars, damage numbers, hit flashes, contact shadows, restrained camera response, fog, and
layered lighting provide most of the perceived polish.

## Scope

Create a new focused route at `/living-village-lab/realtime-combat` with:

- one vertical 9:16 battlefield that also presents cleanly in a desktop shell;
- one identity-bound lead hero based on the supplied character;
- one original rat-brute enemy and a small number of original lesser rats;
- autonomous approach, target acquisition, melee or close-range skill use, hit reaction, defeat,
  victory, pause, and replay;
- health bars, cooldown state, damage numbers, contact shadows, particles, hit-stop, restrained
  camera shake, and sound-ready presentation cues;
- a collapsed-by-default developer sidecar showing current public intent, available actions,
  selected action, target, cooldowns, and recent resolved outcomes;
- deterministic local fixtures and no database, model call, production mission mutation, or server
  dependency.

The first complete encounter may remain one hero against a small pack. Additional polished heroes
are explicitly downstream of the lead-hero art gate; low-quality companions must not be added merely
to make the party count resemble the reference.

## Non-goals

- Reproduce the settlement-management sequence, joystick, dialogue interruption, reinforcement
  arrival, village cinematic, Rat King story beat, or crowd dispersal in this slice.
- Integrate with `/mission/:runId`, alter the authoritative turn-based mission engine, or decide that
  real-time combat replaces it.
- Use the supplied video or still frames in the shipped experience.
- Extract, recreate, or approximate proprietary *Last Asylum: Plague* assets or interface chrome.
- Produce a full roster animation library before one hero and one enemy pass the art and motion gate.
- Add networked agents or unconstrained model decisions. The autonomous policy is deterministic and
  replaceable.

## Experience design

The route opens on an already composed dusk encounter: the lead hero enters from the lower third,
while lesser rats and a heavier creature occupy the upper half. Starting the study runs a short
autonomous battle. The hero chooses a target, accelerates into range, claims a readable fighting
position, attacks, receives or evades a response, and automatically uses one distinctive skill when
its conditions are met. Combat continues until one side is defeated.

Actions follow a readable cadence:

```text
observe -> declare intent -> approach -> plant feet -> wind up -> impact -> react -> recover
```

Actors may move concurrently, but impacts remain visually separated enough to read. Locomotion
eases into and out of combat range. Actors do not vibrate around a range threshold, instantly snap
to face a target, or restart an animation on every simulation tick. A short commitment window and
recovery window make decisions feel intentional.

The default screen emphasizes the battlefield. A small pause control, encounter time, and discreet
autonomy indicator remain visible. Replay appears after victory or defeat. The developer sidecar is
available for evaluating agent behavior but is not part of the intended player composition.

## Visual direction

Use a steep three-quarter camera, an authored painted environment, bottom-center feet anchors,
Y-sorted actors, soft elliptical contact shadows, foreground occlusion, and separate atmosphere and
effect layers. The intended result should feel dimensional at phone scale without pretending to be
free-camera 3D.

The arena uses a restrained dark-fantasy palette: cool blue-gray distance and fog, warm saffron and
fire accents around the lead hero, muted earth underfoot, and a darker enemy mass. Characters must
remain legible at approximately 120 to 170 rendered pixels tall on a 1080-by-1920 reference frame.
Outlines, edge lighting, and value separation do more work than tiny costume detail.

Visual polish comes from coordinated layers:

- authored environment plate without baked actors or UI;
- separate foreground occluders and atmosphere veil;
- identity-bound transparent actor art;
- runtime contact shadows and local health bars;
- skill arcs, impact flashes, debris, dust, fog disturbance, and damage numbers;
- brief hit-stop, actor recoil, and camera impulse tied to resolved impact strength;
- stable idle and recovery poses that let the scene breathe between attacks.

## Lead-hero identity contract

The supplied 1024-by-1536 reference is an identity source, not a frame that may simply be scaled down.
The combat adaptation must preserve:

- an adult Black woman with a confident, grounded presence;
- the asymmetrical hairstyle, shaved right temple, and geometric temple marking;
- the exceptionally long, heavy braid falling on her left side;
- dark eyes, strong brows, and the recognizable face shape;
- a small hoop earring;
- the saffron hooded outer layer with cream trim over a dark gray inner layer;
- the broad woven geometric sash, patterned forearm wraps, loose cream trousers, and wrapped boots;
- a warm saffron, cream, umber, and charcoal palette.

The combat proportion target is stylized adult chibi at roughly 2.75 to 3.25 heads tall. It must not
make her look infantile, toy-like, glossy, or generically anime. Her silhouette should read first as
braid, hooded shoulder shape, long split saffron layer, loose trousers, and grounded boots.

Horizontal mirroring is forbidden because it would move the shaved temple, marking, and braid to the
wrong side. The first pack authors only the combat-facing directions the choreography actually needs.
Broader settlement movement waits for a later pack with independently authored directions.

The first skill is an unarmed or focus-driven saffron wind/force strike so the study does not invent
a canonical weapon absent from the owner reference. This is a presentation fixture, not a permanent
character ability. The braid and coat tails receive restrained secondary motion but never obscure
the face, feet anchor, target, or impact.

## Art-production gate

Asset production is intentionally separated from encounter expansion.

### Gate A — identity and scale

Produce one transparent neutral combat pose in the intended camera direction and composite it into
the arena at final phone scale. Review identity, silhouette, value separation, feet anchor, and
environment fit before producing animation frames.

### Gate B — motion vocabulary

Produce a minimal coherent pack for the approved direction:

- idle loop;
- approach/run loop;
- attack or skill action;
- hit reaction;
- defeat/down pose.

Frames share a stable canvas, feet anchor, light direction, palette, costume construction, and body
proportion. The source reference and every derived asset retain provenance and content hashes. Failed
or rejected variants do not silently enter runtime catalogs.

### Gate C — opponent and encounter

After the lead hero passes motion review, produce one original rat-brute pack and a lower-cost lesser
rat variant, then assemble the full encounter. Supporting heroes are deferred until this encounter
demonstrates that the art pipeline can preserve quality in motion.

## Runtime architecture

The study stays presentation-local and deterministic.

```text
scenario fixture
  -> fixed-step real-time combat simulation
  -> resolved combat events
  -> presentation cue projector
  -> PixiJS scene playback
  -> Svelte controls and accessible/debug mirror
```

### Actor boundary

Each actor has one simulation state and one presentation view. Movement ownership is behind a small
controller interface:

```text
ActorController
  observe(world, self)
  chooseIntent(availableActions)
  updateDesiredMotion(delta)
```

The study implements `AutonomousCombatController`. Future work may implement
`DirectPlayerController` and `ScriptedTimelineController` without replacing actor art, animation
selection, health presentation, or world projection.

### Simulation

Use a fixed simulation step and a seeded scenario. The world owns position, facing, velocity, health,
range, attack commitment, recovery, cooldowns, target validity, and encounter outcome. The controller
may select only from enumerated available actions. PixiJS never decides damage, cooldown completion,
target validity, or victory.

The first autonomous policy is deliberately understandable:

1. retain a valid target through a short commitment window;
2. prefer the nearest threatening target;
3. approach until inside a range band with hysteresis;
4. use the fixture skill when ready and at least one valid target is in its effect area;
5. otherwise use the basic attack when ready;
6. recover before choosing another action.

Every selected intent and resolved result is inspectable. This deterministic policy stands in for an
agent during the visual study; a later agent policy can choose among the same validated actions.

### Presentation

Use one PixiJS application and ticker. The scene graph is:

```text
combatStage
  environmentLayer
  groundEffectsLayer
  actorLayer (sorted by projected feet Y)
    actorContainer
      contactShadow
      animatedBody
      localHealthBar
  airborneEffectsLayer
  foregroundLayer
  atmosphereLayer
  transientUiLayer
```

Simulation time and presentation time remain separate. Pausing stops both for the study; replay
restarts from the same seed. Reduced motion removes camera shake, large displacement, and nonessential
particles while preserving timing, health changes, intent, and outcomes.

## Relationship to existing combat work

The current `/living-village-lab/combat` route demonstrates playback of one already-resolved
turn-based receipt on an authoritative projected board. It remains unchanged.

The new study may reuse narrow technical utilities such as Pixi application setup, resize behavior,
asset loading conventions, feet-anchor placement, depth sorting, and reduced-motion detection. It
must not reuse the current frozen receipt as if it were a continuous simulation or alter the accepted
turn-based route's camera, timeline, feed, controls, or data contract.

Any later proposal to connect real-time presentation to the production mission engine requires a new
owner decision and design. This study supplies evidence, not a migration.

## Accessibility and responsive behavior

- Provide start, pause/resume, restart, replay, sidecar disclosure, and reduced-motion behavior as
  semantic controls outside the canvas.
- Mirror encounter state, current public intent, health changes, and final outcome in readable DOM
  status rather than requiring canvas inspection.
- Preserve a dominant 9:16 battlefield on phone. Desktop centers the same composition and places the
  developer sidecar beside it when space permits.
- Keep controls keyboard reachable with visible focus. Canvas pointer input is optional in the first
  autonomous slice.
- Avoid rapid full-screen flashes; effect luminance and camera impulses remain bounded.

## Error and loading behavior

Preload the encounter's environment, hero, enemy, and effect bundle before enabling Start. Reserve
the final battlefield geometry during loading. If a required asset fails, present a stable error with
Retry and keep the diagnostic in the DOM; do not silently replace an identity-bound hero with a
generic proxy.

The runtime must reject malformed frame manifests, missing clips, invalid anchors, duplicate actor
IDs, non-finite positions, and unknown action IDs before the encounter starts.

## Verification

The implementation plan must include:

- unit tests for deterministic replay, target commitment, range hysteresis, cooldown gating, damage,
  defeat, and terminal outcome;
- unit tests for cue projection and malformed asset manifests;
- component or browser tests for loading, retry, start, pause/resume, replay, sidecar disclosure,
  keyboard operation, and reduced motion;
- phone and desktop screenshots at defined checkpoints;
- a visual review of the hero at final gameplay scale, not only as a large source image;
- a sustained encounter run that checks for target jitter, animation resets, feet sliding, depth-sort
  errors, runaway particles, and frame-time degradation;
- repository format, lint, typecheck, unit test, build, web-budget, and required premium UI audits.

## Success criteria

The study succeeds when:

1. the lead hero is immediately recognizable from the supplied identity reference at phone combat
   scale;
2. approach, facing, foot planting, attack, impact, reaction, recovery, and defeat read without the
   developer sidecar;
3. the autonomous policy appears intentional rather than twitchy or mechanically random;
4. environment, actors, lighting, effects, UI restraint, and camera response feel like one authored
   visual system;
5. the same seed replays the same mechanical encounter and final outcome;
6. the route remains isolated from production mission state and the accepted turn-based lab;
7. owner playtest feedback can decide whether to continue with more heroes, test full 3D, or retain
   the existing turn-based direction.

## Primary risks

- **Identity drift across frames:** gate the neutral pose first, retain explicit invariants, forbid
  silent mirroring, and review at gameplay scale.
- **Generated animation inconsistency:** keep the first direction and clip vocabulary narrow, use a
  canonical neutral anchor, and reject packs with unstable costume, anatomy, light, or feet anchors.
- **Flat or puppet-like motion:** combine authored key poses with restrained runtime interpolation,
  secondary motion, hit-stop, recoil, particles, and stable recovery rather than excessive tweening.
- **Art scope overwhelms engineering:** do not add companion heroes before one hero, one enemy, and
  one environment pass review.
- **The experiment conflicts with canonical turn-based combat:** isolate the route, fixtures, and
  simulation modules and require a separate adoption decision.
- **Visual resemblance becomes copying:** reproduce presentation principles only; keep characters,
  creatures, arena, UI, copy, timings, tuning, and assets original to Summonlab.
