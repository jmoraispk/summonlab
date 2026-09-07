# Persistent Village Hero Travel Animation Design

**Status:** Approved in chat; written-spec review pending  
**Date:** 2026-09-06

## Goal

Make every authoritative hero journey visible in the persistent Hearth 01 Village as a short,
directionally coherent run by that hero's approved normal-proportion raster character. A journey
should read immediately on laptop and phone without turning the Village into a second simulation or
making the player wait through the engine's full wall-clock travel time.

The first production wave covers the current campaign residents: Yaso Dreno, Oren Sorin, and Joror
Pelleth. Yaso is the calibration hero. Oren and Joror are produced only after Yaso's motion is
reviewed and accepted.

## Accepted product decisions

- Every journey visible to the current player animates, whether it began from a player direction or
  an autonomous hero decision.
- A visual journey lasts between 3 and 5 seconds according to its projected scene distance. It does
  not reuse the authoritative journey's potentially much longer wall-clock duration.
- Each hero receives two five-frame run cycles: toward-camera and away-camera. The runtime mirrors
  those raster frames horizontally for leftward travel.
- The run follows the repository-owned `classical-human-run-5` action authority: left contact, left
  compression/push, airborne, right contact, and right recovery, with support sequence
  `left,left,none,right,right` and a clean loop seam.
- Character identity, normal proportions, face, clothing, equipment, camera, scale, and foot anchor
  remain locked across every frame. Village motion never uses a chibi.
- Player-facing characters are raster images only. PixiJS may move and composite those images, but
  it must not draw or approximate a character with vectors, text, emoji, or procedural geometry.
- The existing painted Village, HTML controls, resident links, labels, phone navigation, and
  accessibility semantics remain intact.
- Motion preference continues to come from Player Menu → Motion (`system`, `full`, or `reduced`).
  Reduced motion performs no travel animation and makes no PixiJS request.

## Chosen architecture: one lazy transparent PixiJS overlay

`LivingHearthScene.svelte` remains an HTML/Svelte scene. It owns the painted environment, building
state, static resident links, activity labels, focus behavior, and non-character failure states. A
new `VillageTravelLayer.svelte` mounts one transparent, pointer-inert canvas over the resident layer
only after a journey first needs animation.

That component dynamically imports PixiJS v8, creates one `Application` for the scene, and adds all
moving heroes to one depth-sortable `Container`. There is never one application or canvas per hero.
Each traveler uses a PixiJS `AnimatedSprite` backed by its approved atlas. The static DOM cutout is
hidden while its moving sprite is active and becomes visible again when the playback settles.

The overlay uses the same normalized node projections as the DOM residents. A `ResizeObserver`
keeps the transparent canvas aligned to the `living-scene` client bounds. Pixi coordinates are
computed from normalized scene coordinates and the live canvas size, so laptop and `390x844` phone
layouts share one route model.

The canvas has `pointer-events: none` and `aria-hidden="true"`. The existing resident anchor remains
the only interactive and accessible representation; PixiJS accessibility is deliberately not
enabled because duplicating those links would create two focus targets for one resident.

### Rejected alternatives

1. **CSS/DOM animation only.** This is adequate for one simple translation, but directional frame
   changes, independent clip playback, multiple simultaneous travelers, depth sorting, and later
   motion clips become brittle. It would also establish a second animation architecture beside the
   existing PixiJS combat renderer.
2. **Render the whole Village in PixiJS.** This would duplicate accessible controls and accepted DOM
   layout, increase migration risk, and load the renderer when nothing moves.
3. **One PixiJS application per hero.** Three render loops and canvases add memory and lifecycle
   complexity without any rendering benefit.

## Canonical motion assets

The summonable-hero catalog remains the single production owner of hero visuals. Its next schema
adds an optional `villageRun` binding beside `villageCutout`. The binding identifies:

- the same immutable `heroId`, character manifest hash, and approved Village cutout authority;
- action authority `classical-human-run-5` and support sequence
  `left,left,none,right,right`;
- the toward-camera and away-camera five-frame source rows;
- the source experiment, exact prompts and references, hashes, measurements, review record, and
  explicit owner approval;
- one content-addressed runtime atlas, PixiJS-compatible atlas JSON, and motion manifest.

The source production directory is an immutable experiment beneath `assets/heroes/experiments/`.
Each frame is produced through the `summonlab-character-animations` workflow using the approved
normal-proportion Village cutout and its identity authority. The hero-creation workflow remains
responsible for establishing a new hero's summon/chibi/cutout trio; it does not silently expand into
animation production.

Each runtime atlas has two rows of five `256x384` cells for a `1280x768` transparent WebP. Frame
names are stable and explicit: `run-toward-01` through `run-toward-05` and `run-away-01` through
`run-away-05`. The atlas JSON stores trimmed frame rectangles without changing a shared logical
source size or bottom-center anchor. The motion manifest records 10 frames per second, looping
playback, both ordered frame lists, atlas hashes, source hashes, and approval provenance.

The exporter rejects an atlas when it lacks true alpha, exceeds `600000` encoded bytes, exceeds the
exact `1280x768` runtime dimensions, has a missing or duplicate frame, uses unequal logical frame
sizes, violates the bottom-center anchor, or does not bind the approved cutout and character
manifest. The decoded atlas budget is `3932160` RGBA bytes per loaded hero.

No generated candidate enters the approved catalog or runtime tree automatically. The production
sequence is:

1. generate, persist, validate, and review Yaso's two run rows;
2. obtain explicit owner acceptance of Yaso at runtime scale and speed;
3. produce Oren and Joror from their own approved identity authorities;
4. obtain explicit owner acceptance of the three-hero review sheet;
5. promote bindings and export the content-addressed runtime packs.

## Journey playback model

The existing `SettlementPresentation` remains the source of journey truth. Its occupant projection
already supplies `heroId`, current node, destination node, ordered route node IDs, progress,
`startedAt`, and `arrivesAt`. The browser derives presentation-only playback state from this data;
it does not emit commands, schedule arrivals, advance the simulation clock, or modify occupancy.

A journey has the stable key
`heroId:startedAt:arrivesAt:toNodeId`. The client records observed keys for the lifetime of the
mounted scene so the 15-second projection refresh and the event-stream refresh cannot restart a
clip. A new key replaces any older playback for that hero from the hero's current visible point.

For a newly observed journey:

1. Resolve its route node IDs against the authoritative scene node projections.
2. Remove consecutive duplicate or unresolved points. If fewer than two valid points remain, use
   the current and destination node projections; if that also fails, use the normal static fallback.
3. When opening the page during an existing journey, begin at the projection's current progress
   along the route rather than replaying already elapsed segments.
4. Measure the remaining normalized polyline length and set
   `durationMs = clamp(3000 + remainingLength * 2000, 3000, 5000)`.
5. Move at constant distance per unit of time along the polyline. Route corners change direction but
   do not restart the run cycle.

The visual run deliberately compresses simulation time. It may settle at the destination before the
scheduled authoritative arrival, or the authoritative arrival may occur before the minimum
three-second playback completes. In either case, the started clip completes once without snapping.
The activity label, occupancy ledger, available actions, event journal, and server projections keep
reporting authoritative state throughout. When the arrival projection is received, the settled
static DOM cutout and its authoritative destination coincide without another animation.

If a journey is replaced, the new path begins at the currently rendered point. If its destination or
route cannot be resolved, the moving sprite is removed and the static DOM state remains visible. A
route change never invents an intermediate node.

## Direction, scale, and depth

For each active route segment:

- positive screen-space `dy` selects the toward-camera row;
- negative `dy` selects the away-camera row;
- a nearly horizontal segment retains the prior row, defaulting to toward-camera when there is no
  prior direction;
- negative `dx` mirrors the sprite horizontally; positive or zero `dx` uses the authored
  orientation.

Direction changes occur only when a segment changes or the sign crosses a small dead zone, avoiding
frame-to-frame flicker around vertical routes. Scale follows the existing resident cutout size rather
than introducing perspective growth in this slice. Each sprite uses a bottom-center anchor. Its
`zIndex` is derived from normalized `y`, with campaign ordinal as a stable tie-breaker, so a traveler
farther down the scene renders in front without nondeterministic swaps.

The DOM resident anchor and activity tag move directly to the visual destination when playback
begins, while its cutout image is hidden. This makes the label read as the destination marker the
hero is running toward and keeps the semantic link stable instead of causing layout work on every
frame.

## Runtime lifecycle and performance contract

The current production build measures `44328` bytes of initial JavaScript gzip and `174946` bytes
for its largest lazy runtime chunk, the existing PixiJS bundle. This design keeps that chunk out of
the initial Village request. If combat or another PixiJS surface already loaded it, the browser cache
is reused.

The travel layer must satisfy all of these constraints:

- do not import PixiJS or request a motion atlas before the first full-motion journey;
- create at most one canvas and one `Application` per mounted Village scene;
- use a private ticker with a maximum of 60 frames per second and `autoStart: false`;
- start the ticker only while at least one journey is moving and stop it immediately after the last
  playback settles;
- update `AnimatedSprite` frames from that same ticker rather than registering independent shared
  tickers;
- set `resolution` to `min(devicePixelRatio, 2)`, `autoDensity: true`, transparent background, and
  no multisample antialiasing;
- lazy-load each active hero's single atlas and retain at most the current three campaign atlases
  until route teardown, limiting decoded atlas memory to `11796480` bytes;
- unload motion assets and destroy the PixiJS application on scene teardown;
- preserve a minimum of 30 sampled frames per second under the repository's existing
  `mid-range-phone-390x844-2x` profile with 4× CPU throttling;
- add no more than `600000` encoded bytes per hero motion atlas and remain within the existing
  `300000000`-byte renderer working-set reference budget.

Rendering one to three sprites is intentionally below the point where particle containers, custom
shaders, worker rendering, or a new graphics dependency would help. Those optimizations are outside
this slice.

## Reduced motion and failure behavior

The effective motion preference is reduced when the saved setting is `reduced`, or when it is
`system` and the operating system requests reduced motion. In that mode the destination static
cutout is shown immediately, no canvas is mounted, no PixiJS chunk or atlas is requested, and all
authoritative labels and links remain available.

Full-motion failure is deliberately quiet and usable:

- PixiJS import, application initialization, WebGL, atlas, or manifest failure removes the canvas
  and shows the static cutout at the destination marker.
- A missing `villageRun` binding uses the same static fallback without borrowing another hero's
  frames or using the combat chibi.
- A missing or failed `villageCutout` continues to show the established labeled non-character
  `Art pending` state.
- Component teardown cancels pending asset work and prevents a late load from recreating a canvas.
- A hidden browser tab pauses active playback; on visibility return it resumes from elapsed visible
  playback time rather than jumping by the hidden interval.

## Testing and evidence

Pure unit tests cover path normalization, remaining-path interpolation, the exact 3–5 second duration
formula, stable journey keys, toward/away selection, horizontal mirroring, depth order, reduced
motion, and repeated projections that must not restart playback.

Runtime-export tests prove the optional catalog binding, identity and cutout-source linkage, the two
ordered five-frame clips, true alpha, dimensions, frame count, anchor equality, content hashes,
encoded-byte ceiling, decoded-memory accounting, and stale-output detection.

Persistent Village Playwright coverage uses the fixed campaign seed
`village-shell-19aa1947-bcad-4fab-b2f8-e0e34a9b7eb3` on desktop and `390x844` phone viewports. It
verifies:

- the idle Village requests neither PixiJS nor Village motion atlases;
- one authoritative journey creates one transparent canvas and one moving raster hero;
- the matching DOM cutout is hidden only during active playback and the resident link stays usable;
- route position, facing, mirrored direction, duration bounds, completion, and no refresh restart;
- two or three simultaneous travelers share the one canvas and depth-sort by scene `y`;
- reduced motion mounts no canvas and places the static cutout at the destination;
- a forced atlas failure leaves a usable static resident and produces no unhandled browser error;
- phone navigation remains unobstructed and the page has no horizontal overflow.

The existing phone performance test is extended with an active-journey sample. It asserts at least
30 frames per second under the established throttled profile, one canvas, bounded resource bytes,
and an idle travel-layer diagnostic after playback. The component exposes test-only-neutral data
attributes for renderer state and active traveler count; it does not expose mutable debug controls.

Visual review evidence includes Yaso's two-row source sheet, a runtime-scale looping comparison for
both directions, the three-hero approved sheet, and desktop and phone screenshots showing a journey
through at least one route corner.

## Rollout boundaries

This slice produces one run clip for Yaso, Oren, and Joror and connects it to authoritative Hearth 01
journeys. It does not animate idle, work, eating, training, sleep, combat, or injury poses; change
engine travel durations; add manual movement controls; change settlement routing; backfill the other
197 heroes; or migrate the Village UI into PixiJS.

The optional catalog contract allows future heroes to remain static until their motion has been
individually produced and approved. No vector or synthetic placeholder character is introduced for
that gap.
