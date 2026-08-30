# Living Village Village screen validation

Date: 2026-08-29

Route: `/living-village-lab/village`

Branch: `codex/lv-village-screen`

## Crash recovery

The resumed worktree was clean and detached at `b99c186` (`origin/main`). No modified or untracked
implementation files survived the crash, so nothing was reset, discarded, or overwritten. The
useful work that did survive was commit `718b1db`, `docs: add Living Village screen plan`, already
pushed on `origin/codex/lv-village-screen`. The worktree was switched to that branch, which is based
on the current `origin/codex/shared-system-architecture` tip `0494229`.

The revised assignment superseded the plan's earlier three-owned-hero framing. The completed route
shows exactly Dara Zev, Mara Vey, Jori Daro, Kira Toren, Iven Orra, and Remy Nahl in-world and in one
compact find/focus ribbon. No separate roster route was created.

## Completed interaction slice

- Map-first composition: Hearth begins immediately beneath a single compact status bar; the prior
  editorial title, explanatory copy, card wall, secondary heading, and footer were removed after
  owner review.
- The optional Residents finder and camera controls share one compact command toolbar on desktop
  and collapse into two shallow rows on phone.
- Existing Hearth environment with named Gate, Court, and Tower hotspots. Training Grounds and
  Tower labels straddle the middle of their top borders; the Gate label straddles the middle of its
  bottom border to preserve the gate artwork. Gate and Tower use taller interaction regions that
  push those label-bearing edges away from their focal architecture.
- Bounded 100–300% camera with pointer drag from the map, heroes, or facility regions; wheel zoom;
  two-pointer pinch; keyboard zoom/pan; visible zoom controls; Fit; and Reset. A small drag allowance
  remains available at fitted zoom so the camera never feels inert.
- Six fixed in-world hero figures using alpha-background derivatives of their existing approved
  identity anchors, enlarged without card frames, backplates, blend tricks, or redundant
  world-space name labels. Their screen presence grows progressively with camera zoom, capped at
  1.75×, so the figures do not appear to shrink against the enlarged environment.
- Available heroes carry a restrained light silhouette; assigning Court training or a Tower hunt
  removes that light immediately so the world itself communicates who is busy.
- The Summoning Gate is a real link to the repository's existing `/forge` Summoning Forge rather
  than a destination-shaped button with no outcome.
- Anchored quick popover with portrait, name, level, Health, current activity, party state, Court
  training, Tower species hunt, and details actions. Completing either assignment dismisses the
  popover while the resulting destination, activity, and busy silhouette remain visible in-world.
- Same-surface hero drawer for attributes, skills, and equipment.
- Compact six-person roster ribbon that selects, centers, and moves keyboard focus to the same
  in-world hero.
- Local Court assignment and three Floor 4 species hunts with a deliberately simple authored
  destination transition.
- Compact party, training, Tower, summon, and material summaries.
- Reduced-motion behavior, 390×844 composition, minimum 44px controls, and a 720px CSS viewport
  check representing 200% desktop browser-zoom reflow.

## Focused interaction proof

The route-local Playwright configuration uses port `4177` so concurrent worktrees cannot cause the
test to reuse a stale preview server on the repository's default `4173` port.

Command:

```bash
PATH=/home/joao/.nvm/versions/node/v24.19.0/bin:$PATH \
CAPTURE_LV_DESKTOP=/home/joao/.codex/worktrees/7d8f/summonlab/docs/evidence/living-village-village-desktop.png \
CAPTURE_LV_PHONE=/home/joao/.codex/worktrees/7d8f/summonlab/docs/evidence/living-village-village-phone.png \
pnpm --filter @summonlab/web exec playwright test \
  --config src/routes/living-village-lab/village/playwright.village.config.ts
```

Result: **2 passed**. The test proves direct static loading, no `/api/` requests, the natural
1536×1024 Hearth asset, enlarged Gate/Tower regions, top-border Court/Tower labels, bottom-border
Gate label, vertically centered facility status dots, six true-alpha in-world figures with bounded
progressive zoom scaling, absence of the destination
panel/resident-count/camera-help annotations, in-world hero selection, ribbon
focus, anchored popover, details drawer, availability light removal after Court assignment, Court
training and species hunt popover dismissal, pointer pan beginning inside a facility region at
fitted zoom, repeated two-axis pan at maximum zoom, disabled native image/link dragging, click
suppression after a drag,
wheel zoom, visible controls, 100–300% bounds, Fit/Reset semantics, keyboard operation, reduced
motion, phone target sizes, the real Gate-to-Forge navigation, and no horizontal overflow at phone
or 200%-equivalent reflow widths.

## Required gates

```bash
PATH=/home/joao/.nvm/versions/node/v24.19.0/bin:$PATH \
pnpm --filter @summonlab/web typecheck
```

Result: **passed**, 0 errors and 0 warnings.

```bash
PATH=/home/joao/.nvm/versions/node/v24.19.0/bin:$PATH \
pnpm --filter @summonlab/web lint
```

Result: **passed**.

```bash
PATH=/home/joao/.nvm/versions/node/v24.19.0/bin:$PATH \
pnpm --filter @summonlab/web build
```

Result: **passed**. Vite reported only the repository's existing large-chunk advisory.

## Visual evidence

- `docs/evidence/living-village-village-desktop.png` — 1440×1000 viewport, full-page capture with
  the world surface and anchored resident popover.
- `docs/evidence/living-village-village-phone.png` — 390×844 viewport, full-page capture proving the
  two-column summaries, six-person ribbon, camera controls, and same Village surface.

Both captures were visually inspected after the final focused test.

## Accepted owner feedback

The 2026-08-29 visual review rejected the original page-first hierarchy and persistent facility
frames. The accepted revision keeps the Village at the top, compresses status into an information
toolbar, makes facility geometry invisible at rest, illuminates the hit region only on hover or
keyboard focus, and renames the southeast destination to **Training Grounds**. A later review moved
all three facility labels to the centered top-inside position of their regions. The focused test now
guards the map-first vertical position, transparent resting hitbox, hover illumination, and all
three label positions.

The subsequent interaction review rejected card-shaped resident markers, unreliable panning over
interactive regions, and explanatory overlays that repeated obvious information. The accepted
revision presents larger hero figures with no marker frame or name plate, delays pointer capture
until a real drag begins, preserves click behavior under the same targets, permits modest pan at
fitted zoom, and removes facility detail panels, status subtitles, resident-count keys, visible
camera instructions, and prototype footer notes.

The following owner review accepted Residents as an optional toolbar concern, requested visible
availability on the in-world bodies, and required the Gate to lead somewhere useful. The revision
formally groups Residents and camera actions as the Village toolbar, applies a light silhouette only
while `order === null`, and binds the Gate region to the existing `/forge` Summoning Forge.

The latest review rejected the remaining opaque portrait pixels, off-edge labels, and native-drag
interference. Repository inspection confirmed every existing anchor, continuity sheet, and runtime
derivative for these identities was opaque. The route now uses provenance-documented alpha
derivatives of the exact approved anchors, removes the CSS blend/mask workaround, centers every
label inside the region's top edge, disables browser image/link dragging, and captures bare-map
pointer gestures immediately.

The latest command-flow review requested that a resident's menu close once a Court or Tower order
has been completed. Both finalized assignment paths now dismiss the anchored popover immediately;
the destination selection, activity state, movement placeholder, and busy silhouette continue to
confirm the accepted order in the Village. Statistics and experience changes remain a future data
integration rather than being simulated by this route-local fixture.

The latest visual review placed the Training Grounds and Tower labels directly across the middle of
their regions' top borders and moved the Gate label to the middle of its bottom border. It also
rejected fixed-pixel hero sizing during camera zoom because the residents appeared to shrink
against the enlarged map. Hero figures now grow progressively through the zoom range, with a 1.75×
cap that preserves readable residents without allowing them to dominate the world.

The latest hotspot review expanded both vertical bounds of the Gate and Tower regions so their
labels sit farther from the gate face and tower threshold art. All three facility labels now use a
shared flex row whose status dot and text are geometrically center-aligned instead of relying on
hand-tuned absolute offsets.

## Useful review actions

1. Select Jori directly in the courtyard, then use the ribbon to find Remy. This decides whether
   the true-alpha figure treatment feels like residents standing in the world on desktop and phone.
2. Send Dara to Court training, then send Mara to hunt a Stoneback boar. This decides whether the
   immediate menu dismissal, availability light disappearing, and simple destination transition
   communicate command completion without pretending statistics or polished activity animation
   exists.
3. Drag from bare ground and through the Training Grounds region, reset, then hover and click the
   Gate artwork. This decides whether camera recovery feels predictable and whether the existing
   Summoning Forge is the right interim Gate destination.

## Deliberate limitations and follow-up

- Movement is intentionally a route-local transition placeholder. Polished walking, arrival, and
  training animation remain with the activity owner.
- Orders are deterministic local fixture state and do not persist or call an API.
- No shared transparent exports exist for the fixed six. This route owns documented alpha
  derivatives of their exact approved identity anchors; a shared integration should promote compact
  approved cutouts rather than retain route-local copies.
- The bottom-center egress is treated as the Tower Threshold pending final environment-owner
  confirmation.
- `/forge` is an existing development Summoning Forge rather than a campaign-state summon route;
  it is the useful interim Gate destination requested for this isolated prototype.
- A future shared shell should translate `training.assign` and `tower.hunt-species` intents into the
  owning systems; this task intentionally did not add or edit a shared contract.
