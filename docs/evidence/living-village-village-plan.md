# Living Village Village screen execution plan

Status: completed under the revised unified Village and roster assignment

> Crash-recovery note (2026-08-29): this planning commit survived, but no uncommitted implementation
> did. The updated owner prompt superseded the original three-owned-hero projection below: execution
> renders all six fixed residents on one Village surface, adds anchored hero inspection, a detail
> drawer, the find-and-focus roster ribbon, and route-local Court/Tower orders. The original plan is
> retained as historical context; the shipped scope and results are recorded in
> `living-village-village-validation.md`.

Target route: `/living-village-lab/village`

Target branch: `codex/lv-village-screen`

Base branch: latest `origin/codex/shared-system-architecture`

## Objective

Build one isolated, polished browser prototype that makes the static Hearth feel like a place while
remaining a direct command surface. A player must be able to understand and operate the Summoning
Gate, Training Court, and Tower Threshold; read the fixed-six loop's important state at a glance;
zoom and pan with pointer, wheel, touch, or keyboard; and reliably recover the whole Village view.

The route must load without database or model-provider access, work deliberately at desktop and
390×844, respect reduced motion, remain usable at 200% browser zoom, and stay entirely inside the
assigned ownership boundary.

## Ownership boundary

Only create or edit files under:

```text
apps/web/src/routes/living-village-lab/village/**
apps/web/src/lib/components/living-village/village/**
docs/evidence/living-village-village-*
```

Do not edit shared layouts, homepage navigation, production routes, contracts, catalogs, other lab
routes, or another screen owner's component folder. Propose shared interfaces in the final handoff
instead of adding them to a shared package.

## Explicit exclusions

- No generated art or replacement hero identities.
- No construction, upgrades, staffing, or settlement management.
- No society, schedules, dialogue, relationships, or agent/model calls.
- No free-walking or autonomous hero simulation.
- No production navigation changes or sibling-screen implementation.
- No shared contract or catalog changes.
- No database, API, or provider dependency.

## Execution assumptions

These assumptions are reversible and local to the prototype:

1. The screen represents the useful decision point immediately after Floor 3.
2. Dara Zev, Mara Vey, and Jori Daro are owned and form the ready three-hero party.
3. The Training Court has three open slots.
4. Floor 3 is the highest cleared floor and Floor 4 is available.
5. One Normal summon token is available and is bound to Kira Toren.
6. The existing top-center arc remains the Summoning Gate.
7. The existing bottom-center settlement egress is presented as the Tower Threshold through a
   code-owned hotspot; the shared Hearth scene definition is not changed.
8. Fit preserves the selected destination. Reset fits the whole Village and restores Gate
   selection.
9. The prototype reports destination intent but does not invent navigation to sibling lab routes.
10. Textual hero tokens are used where the exact approved runtime portrait binding is incomplete;
    no other person's portrait is substituted.

## Planned files

```text
apps/web/src/routes/living-village-lab/village/
├── +page.svelte
├── fixtures.ts
└── village.e2e.ts

apps/web/src/lib/components/living-village/village/
├── types.ts
├── VillageViewport.svelte
├── VillageSummary.svelte
└── VillageFacilityPanel.svelte

docs/evidence/
├── living-village-village-desktop.png
├── living-village-village-phone.png
├── living-village-village-plan.md
└── living-village-village-validation.md
```

### File responsibilities

`fixtures.ts`

- Define the local `living-village-v1` screen projection.
- Use immutable, typed facility, hero, party, training, tower, and summon fixtures.
- Bind only the existing Hearth environment public path.
- Keep values deterministic and independent of server state.

`types.ts`

- Define the narrow component-facing types for facility hotspots, status summaries, hero tokens,
  and destination state.
- Keep these types inside the owned folder.
- Document the equivalent shared projection that should eventually replace them.

`VillageViewport.svelte`

- Render the Hearth environment and its code-owned atmosphere/interface layers.
- Own camera measurement, transforms, bounds, controls, and all input modalities.
- Render the three semantic hotspot buttons.
- Expose stable test state through `data-*` attributes.

`VillageSummary.svelte`

- Render five compact, clearly labelled status fixtures.
- Keep current party identity names legible without requiring portraits.
- Reflow without horizontal scrolling.

`VillageFacilityPanel.svelte`

- Render the selected facility name, state, current action, and one supporting detail.
- Remain non-modal so recovery and destination switching are always available.
- Provide an accessible relationship between the hotspot and panel heading.

`+page.svelte`

- Compose the route header, summary rail, Hearth viewport, facility panel, help text, and live region.
- Own only selection and route-local presentation state.
- Add route-specific title and description metadata.

`village.e2e.ts`

- Prove direct loading, hotspot selection, zoom, pan, Fit, Reset, keyboard operation, reduced motion,
  responsive composition, and lack of horizontal overflow.
- Capture desktop and 390×844 evidence.

## Fixture state

The screen opens on this deterministic projection:

| Summary | Value | Supporting meaning |
| --- | --- | --- |
| Owned heroes | `3 / 6` | Dara Zev, Mara Vey, and Jori Daro are active |
| Current party | `3 ready` | Dara, Mara, and Jori form the one prepared party |
| Training slots | `0 / 3 occupied` | All Court slots are available for returning heroes |
| Highest floor | `Floor 3 cleared` | Floor 4 is the next Tower action |
| Summon availability | `1 Normal token` | Kira Toren is the next fixed reveal |

Facility panels use the same projection:

| Facility | State | Current action |
| --- | --- | --- |
| Summoning Gate | `Ready · 1 Normal token` | Reveal the next fixed hero |
| Training Court | `3 slots open` | Assign returning heroes to training |
| Tower Threshold | `Floor 4 available` | Prepare the current party |

## Visual composition

Use the existing 1536×1024 WebP:

```text
/runtime/settlements/hearth-01/environment.96cbb666f3d9.webp
```

The painting remains the primary surface. Code-owned treatment may add restrained vignette,
selected-state light, hotspot frames, labels, and control chrome, but it must not obscure entrances
or imply a new authoritative environment state.

### Hotspot geometry

- Gate: reuse the existing normalized top-center scene bounds.
- Court: cover the lower-right sand court with a generous rectangle that does not overlap Tower.
- Tower: cover the bottom-center egress with a wide, touch-safe rectangle.
- Every hotspot remains at least 44×44 CSS pixels at the 390px fit view.
- Labels stay visible without requiring hover.
- Non-functional visible buildings remain environmental scenery and are not focus targets.

### Desktop layout

- A compact five-item status rail sits above the Village surface.
- The Hearth viewport is the dominant element.
- The selected-facility panel sits beside the viewport.
- Camera controls are attached to the viewport and always visible.
- The composition should feel like an observation table or command overlook, not a settings page.

### 390×844 layout

- Summaries wrap into a deliberate two-column grid; the party item may span both columns.
- The map keeps a useful touch area without consuming the whole page.
- Camera controls remain fully visible and at least 44px tall.
- The facility panel becomes a full-width sheet below the map rather than covering it.
- The user can scroll the page by starting outside the gesture-controlled map.

### 200% browser zoom

- Let responsive CSS reflow instead of preserving the desktop grid.
- Avoid fixed overlays, fixed pixel widths, clipped toolbars, or horizontal page scrolling.
- Keep status labels and values distinct rather than relying on icon-only summaries.
- Verify manually at 200% in addition to the automated narrow CSS-viewport check; device pixel ratio
  must not be reported as browser-zoom evidence.

## Camera model

Use an explicit 1536×1024 world coordinate system.

1. Measure the viewport with `ResizeObserver`.
2. Calculate the fit scale with contained geometry and a small internal padding.
3. Express zoom as a relative multiplier of fit scale.
4. Clamp relative zoom to `1.0` through `3.0` and display it as `100%` through `300%`.
5. Zoom around the pointer, pinch centroid, or viewport center.
6. Clamp translation after every pan, zoom, and resize so the map cannot disappear.
7. Preserve the relative zoom through responsive resizing, then re-clamp the translation.
8. Expose current zoom and offsets with stable attributes such as `data-zoom-percent`,
   `data-offset-x`, and `data-offset-y`.

### Recovery semantics

- **Fit Village** sets zoom to 100%, centers the entire scene, and preserves facility selection.
- **Reset View** performs Fit Village and restores Summoning Gate selection.
- `0` invokes Fit Village.
- `Home` invokes Reset View.
- Both actions remain available even while a facility panel is open.

## Input behavior

### Pointer and mouse

- Drag empty map space to pan after a small threshold.
- Use pointer capture so a drag remains reliable outside the initial bounds.
- Do not begin a pan from a hotspot or camera-control button.
- Cancel cleanly on `pointercancel` or lost capture.

### Wheel and trackpad

- Wheel over the focused/hovered map zooms around the pointer position.
- Prevent the page from scrolling only while the map consumes that gesture.
- Keep visible controls available for users who do not want wheel capture.

### Touch

- One pointer pans.
- Two pointers pinch around their centroid.
- Maintain pointer IDs rather than relying on touch ordering.
- Clamp the transform after every gesture frame.
- Keep enough page surface outside the map for ordinary document scrolling.

### Keyboard

- The map viewport is a named, focusable region.
- `+` or `=` zooms in.
- `-` zooms out.
- Arrow keys pan in predictable screen-space steps.
- `0` fits the Village.
- `Home` resets the view and Gate selection.
- Tab reaches all three real hotspot buttons.
- Enter and Space select a hotspot.
- Escape returns focus from the facility panel to the selected hotspot.

## Accessibility

- Use semantic buttons for hotspots and controls.
- Give the viewport an accessible name and short keyboard/touch instructions through
  `aria-describedby`.
- Mark the active facility with `aria-pressed` and a visible selected state.
- Associate the facility panel with a stable heading.
- Announce completed selection and recovery actions through a polite live region, but never announce
  every drag frame.
- Preserve the repository focus ring against the painted background.
- Do not encode state through color alone.
- Use minimum 44×44 CSS-pixel interactive targets.
- Freeze ambient motion and remove transform transitions under `prefers-reduced-motion` and the
  repository's player-motion override.
- Preserve operation at the repository's 320px minimum width.

## Focused Playwright evidence

### Desktop test: 1440×1000

1. Load `/living-village-lab/village` and assert a successful response.
2. Verify the Hearth image loads at natural size `1536x1024`.
3. Assert that the route makes no database, model-provider, or route-owned API request.
4. Confirm all five summaries and three hotspots are visible.
5. Click Gate, Court, and Tower and verify each panel's state and action.
6. Exercise Zoom In and Zoom Out and prove the `100%` and `300%` bounds.
7. Wheel-zoom around a map point and verify zoom changes.
8. Pointer-drag after zooming and verify offsets change.
9. Invoke Fit Village and verify `100%`, centered offsets, and preserved selection.
10. Change selection and camera, invoke Reset View, and verify `100%`, centered offsets, and Gate
    selection.
11. Focus the viewport and exercise `+`, ArrowRight, `0`, and `Home`.
12. Focus a hotspot and activate it with Enter.
13. Emulate reduced motion and verify owned transitions/animations no longer move.
14. Capture `docs/evidence/living-village-village-desktop.png`.

### Phone test: 390×844

1. Load the same route with the phone viewport.
2. Verify the five summaries, three hotspots, controls, and panel remain accessible.
3. Select each hotspot and verify the below-map panel updates.
4. Verify controls meet the minimum target size.
5. Confirm the document has no horizontal overflow.
6. Exercise the visible zoom, Fit, and Reset controls.
7. Capture `docs/evidence/living-village-village-phone.png`.

### Manual browser checks

- Chrome or Chromium at 200% browser zoom: operate summaries, hotspots, controls, and panel.
- Touch emulation: one-finger pan, two-finger pinch, tap each hotspot, and recover with Fit.
- Reduced motion: verify state changes remain immediate and understandable without movement.

## Validation commands

Format only the owned files:

```bash
pnpm exec prettier --write \
  apps/web/src/routes/living-village-lab/village \
  apps/web/src/lib/components/living-village/village \
  docs/evidence/living-village-village-plan.md \
  docs/evidence/living-village-village-validation.md
```

Run the required gates:

```bash
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web test:e2e -- \
  src/routes/living-village-lab/village/village.e2e.ts
pnpm --filter @summonlab/web build
```

Record the exact commands, exit results, manual checks, and evidence filenames in
`docs/evidence/living-village-village-validation.md`.

## Useful owner test actions

1. Zoom and pan until the Village is displaced, then use Fit or `0`. This decides whether camera
   bounds and recovery are comfortable and discoverable.
2. Select Gate, Court, and Tower at desktop and 390×844. This decides whether hotspot placement and
   panel density make the Hearth feel spatial without becoming imprecise.
3. At 200% browser zoom, operate the page using Tab, Enter, `+/-`, arrows, and Home. This decides
   whether control order, labels, target sizes, and responsive reflow remain usable.

## Handoff interface proposal

Do not implement this in shared contracts during this task. Include an equivalent proposal in the
final handoff:

```ts
type VillageProjection = {
  settlementId: string;
  environmentAsset: {
    publicPath: string;
    width: number;
    height: number;
    contentHash: string;
  };
  ownedHeroes: readonly HeroSummary[];
  party: PartySummary;
  training: TrainingCapacitySummary;
  tower: TowerProgressSummary;
  summoning: SummonAvailabilitySummary;
  destinations: readonly VillageDestinationSummary[];
};

type VillageDestinationIntent =
  | { kind: 'summoning.open'; channelId: string }
  | { kind: 'training.open'; suggestedHeroIds: readonly string[] }
  | { kind: 'tower.prepare'; floorId: string; partyId: string };
```

This keeps the Village a read-only projection and lets future routing translate a player selection
into an owning subsystem's command without the presentation layer mutating gameplay state.

## Completion and delivery

The task is complete only when all of the following are true:

- The direct route loads without database or provider access.
- Gate, Court, and Tower are large, named, keyboard-operable hotspots.
- Each hotspot opens the correct local state/action panel.
- Owned heroes, current party, training slots, highest floor, and summon availability are visible.
- Pointer, wheel, touch, keyboard, visible zoom controls, Fit, and Reset work within bounded zoom.
- Reduced motion, 390×844, and 200% browser zoom remain usable.
- The focused Playwright test passes.
- Web typecheck, lint, focused test, and production build pass.
- Desktop and phone screenshots are checked in under the owned evidence prefix.
- The final handoff reports the URL, three test actions and their decisions, validation results,
  unresolved questions, commit hash and subject, pushed branch/destination, and clean-worktree
  status.
- Only in-scope files are committed.
- The branch is pushed but not merged.

Use the Conventional Commit subject:

```text
feat: add Living Village command surface
```

## Goal harness invocation

OpenAI's goal workflow recommends one objective, a verifiable stopping condition, the source plan,
proof commands, checkpoints, and explicit pause conditions. Invoke this plan with:

```text
/goal Implement docs/evidence/living-village-village-plan.md completely on the isolated codex/lv-village-screen branch. Start by fetching origin/codex/shared-system-architecture and confirm this branch is based on its latest tip. Work only inside the ownership paths named in the plan; do not generate art, edit shared contracts or catalogs, change production or sibling routes, merge branches, or use database/model-provider access. Implement the route-local fixtures, polished responsive Village surface, all specified zoom/pan and accessibility behavior, and focused Playwright evidence. Work through reviewable checkpoints, keep concise progress updates, and use the plan's reversible assumptions unless repository evidence contradicts them. Validate with web typecheck, web lint, the focused Playwright test, and a production build; capture the desktop and 390×844 screenshots; record validation evidence; commit only in-scope changes with the planned Conventional Commit subject; push codex/lv-village-screen; and verify a clean worktree. Do not stop until every completion criterion in the plan is satisfied and the final handoff includes the direct URL, three test actions and decisions, validation results, unresolved product questions, commit hash and subject, push destination, and clean-worktree status. Pause only if completing the plan would require an out-of-scope edit, a destructive action, missing authority, or a product decision whose alternatives would materially change the prototype.
```

Goal controls and status behavior are documented in the official
[Follow a goal](https://learn.chatgpt.com/use-cases/follow-goals) guide.

## Unresolved product questions

These do not block the reversible implementation described above:

1. Is the bottom-center egress the intended Tower Threshold location in the existing Hearth art?
2. Should Reset restore Gate selection, or should both Fit and Reset preserve the current facility?
3. Should the final integrated destination actions navigate immediately, open sibling overlays, or
   emit intents to a shell-owned router?
4. Should this lab route eventually receive the repository's development-route gate, or remain a
   directly loadable static prototype path?
