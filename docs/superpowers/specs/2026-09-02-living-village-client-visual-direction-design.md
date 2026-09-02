# Living Village client visual direction

**Status:** Title gateway locked; remaining system flows exploratory

**Date:** 2026-09-02

**Scope:** title gateway, Wiki presentation boundary, responsive Village shell, Village home, hero
inspection, Village Inventory, mission packing, and motion language

## Purpose

Create one coherent interface for entering and inhabiting Summonlab without flattening the title, Wiki,
and game into the same navigation system. The title is a gate. The Wiki is an independent archive. The
Village is the application shell for play.

This is a phase-one visual and interaction proposal. It deliberately makes no runtime changes and does
not alter gameplay contracts or shared content catalogs.

## Approved product decisions

1. The title page contains the Summonlab mark, one `Enter Village` action, and a quiet `Wiki` link.
   The primary action remains square and architectural. The portal supplies the visual warmth while the
   control preserves the gateway's bare-bones simplicity.
2. Sign-in may follow `Enter Village` later, but is outside this phase.
3. Village navigation exists only inside the Village experience.
4. The Wiki remains a separate destination, not a persistent game-navigation item.
5. Desktop uses a centered, symmetrical panorama as its home composition.
6. Facility pointers inherit the brighter, more legible callout treatment from the first explored
   direction.
7. Phone uses a fixed bottom navigation bar with icon and label for `Village`, `Residents`, `Inventory`,
   `Tower`, and `Gate`.
8. Hero details appear only after the player selects a resident.
9. Inventory has two meanings only: the shared Village Inventory and a temporary per-hero Mission
   Inventory.
10. Mission packs are suggested automatically and remain editable before departure.

## Freeze boundary

The following visual foundation is approved and should not be reopened during routine screen design:

- the title gateway composition on desktop and phone;
- the dark observatory material language, ember-gold structure, and cyan living-focus accent;
- the centered, scene-first desktop Village composition;
- bright facility labels attached to their targets with fine leader lines;
- the cyan circle and arrow used to identify a selected hero in the scene;
- the five-destination phone navigation pattern and bottom placement.

Approval of the composition does not freeze the mature settlement shown in the exploratory Village
mockups as the launch-state population or construction state. Inventory layout, mission packing details,
return reconciliation, Tower/Gate separation, and settlement progression remain open design work.

The title gateway is locked. Subsequent design passes may define the sign-in step after `Enter Village`,
but should not add login fields, account navigation, or secondary actions to the gateway itself.

## Visual thesis: the inhabited observatory

The interface should feel like an instrument built into the same observatory settlement shown in the
world art. It is dark, precise, weathered, and alive. It should not feel like a generic fantasy web
dashboard laid over an illustration.

### Materials and color

- Use deep charcoal and midnight navy as the field.
- Use ember gold for structure, selection, and high-value actions.
- Reserve cool cyan for residents, active life, and navigational focus within the world.
- Prefer thin engraved dividers, squared or lightly chamfered panels, and layered translucency over
  pill-shaped controls and floating rounded cards.
- Allow the scene to remain visible behind inspection layers; avoid opaque route-sized modals.

### Typography

- Use the current editorial serif voice for world names, destinations, and major headings.
- Use a compact, highly legible utility face for counts, state, durability, and controls.
- Keep display tracking deliberate and sparse. Body and status copy should favor reading speed over
  atmosphere.
- On phone, preserve type hierarchy rather than proportionally shrinking the desktop scale.

### Iconography

- Use simple engraved silhouettes with consistent optical weight.
- Pair every navigation icon with a label on phone.
- Do not rely on color alone for active state; combine color, border/marker, and text treatment.

## Information architecture

```text
Title gateway
├── Enter Village
│   └── Village shell
│       ├── Village
│       ├── Residents
│       ├── Inventory
│       ├── Tower
│       └── Gate
└── Wiki
    ├── Index
    └── Articles
```

The Wiki and Village are siblings reached from the title gateway. Neither owns the other. Contextual
help in play may open a short field note or a deep link, but it should not reproduce Wiki navigation
inside the game shell.

## Title gateway

The title page should behave like a threshold rather than a marketing homepage.

- The full viewport belongs to the gate artwork.
- `Enter Village` is the sole primary action.
- The action uses square corners and a thin ember-gold outline. It should feel like part of the gate's
  architecture rather than a soft application control.
- `Wiki` sits quietly in a top corner and remains keyboard reachable.
- Remove seed selection, consent explanations, runtime diagnostics, and developer-route links from the
  normal gateway presentation.
- A future sign-in step may follow the primary action without changing this composition.

Desktop and phone use the same content hierarchy. Phone shifts the action toward the bottom safe area
while protecting it from the browser and device gesture regions.

Mockups: [desktop](../../design-proposals/living-village-ui/mockups/title-gateway-desktop.png) and
[phone](../../design-proposals/living-village-ui/mockups/title-gateway-phone.png).

## Village shell and home surface

### Desktop

Desktop is anchored in the centered panorama direction:

- a restrained top navigation establishes the five in-game destinations;
- the panorama remains the dominant surface rather than becoming a banner;
- facility names are placed near their targets with thin leader lines;
- a resident strip anchors selection without covering the settlement;
- contextual information opens as a right sheet and leaves most of the scene visible.

Facility labels must be generated from known anchor points, not painted permanently into the scene.
At runtime, the layout should test candidate label positions, avoid overlaps with navigation and sheets,
and hide lower-priority labels when the viewport cannot support all of them.

Mockup: [desktop Village home](../../design-proposals/living-village-ui/mockups/village-home-desktop.png).

### Phone

Phone treats the Village as a vertical, explorable home rather than a compressed desktop header:

- the settlement fills the usable viewport;
- facility pointers remain directly attached to the scene;
- the fixed bottom bar exposes all five destinations with icon and label;
- resident details rise as a bottom sheet or replace the resident strip after selection;
- safe-area padding is part of the navigation height;
- when the keyboard or a blocking confirmation opens, the bar may temporarily yield.

Mockup: [phone Village home](../../design-proposals/living-village-ui/mockups/village-home-phone.png).

### Settlement growth

The current panorama represents the visual ceiling of a mature, inhabited Village, not the initial
state. The home surface must tell the truth about the player's settlement and roster.

| Visual stage | World presentation |
| --- | --- |
| Starting Village | Three to five visible summoned residents, the portal/gate landmark, only the facilities actually available, dark or empty plots, and generous negative space |
| Growing Village | Newly built structures occupy established plots; scaffolding, work light, smoke, and a few purposeful residents communicate progress without background crowds |
| Mature Village | The denser illuminated panorama, broader activity, and full facility labeling shown by the current exploratory mockups |

These are visual stages, not gameplay thresholds or content-catalog definitions. The runtime scene should
derive visible residents from the actual roster and facility presence from actual settlement state. It
must not use decorative crowds that imply heroes or workers the player does not have.

The camera composition, navigation anchors, and major plots should remain stable across stages so growth
feels additive. Construction fills deliberate absences; it should not replace the whole Village with an
unrelated background. A future design pass must establish the starting plot map, the first available
facility set, and transitions for construction and arrival.

### Facility pointer states

Pointers have three states: ambient, focused, and suppressed. Ambient labels use restrained contrast;
hover, focus, or nearby resident activity brightens the leader and target; suppressed labels disappear
when they would collide. Labels are buttons only when the facility is actionable, and their hit target
extends beyond the drawn text and line.

## Hero inspection

Selecting a resident focuses the character in the scene and opens exactly one inspection surface.
Opening the full sheet dismisses the quick view; the two must never stack.

The sheet order is:

1. identity and current location;
2. readiness and role;
3. `Equipment`;
4. `Mission Inventory`.

`Equipment` represents persistent hero-bound gear. `Change Equipment` enters the shared Village
Inventory with the relevant hero as the assignment target. `Mission Inventory` is explicitly temporary:
outside preparation or an active mission it shows an empty state and routes the player to the Tower.
There is no persistent personal backpack or hero-owned stockpile.

Mockup: [desktop hero inspection](../../design-proposals/living-village-ui/mockups/hero-inspection-desktop.png).

## Inventory custody model

The interaction model is:

```text
Village Inventory
    ↓ suggested mission packing, then player adjustment
Hero Mission Inventory
    ↓ consumption and loot during the mission
Return reconciliation
    ├── equipped items stay equipped
    └── unused supplies and loot deposit into Village Inventory
```

### Village Inventory

The Inventory destination always opens the shared settlement stockpile. Resources and Equipment are
views of the same communal holding, not different owners.

- Resource rows emphasize name and amount.
- Equipment rows expose availability, current wearer when equipped, and durability.
- `Assign or Pack` starts a destination-aware flow: persistent equipment assignment or temporary
  mission packing.
- A hero portrait may appear in a chooser, but never dominate the stockpile surface.

Mockup: [desktop Village Inventory](../../design-proposals/living-village-ui/mockups/village-inventory-desktop.png).

### Mission Inventory and suggested packs

The Tower owns mission preparation. After a mission is selected, the client proposes a pack for each
hero based on known mission conditions. The player can adjust quantities hero by hero and accept the
whole set when satisfied.

- Each pack states that its source is Village Inventory.
- Each hero view is labeled `Mission Inventory` and `For this mission`.
- The design preserves open loot space as an explicit preparation choice.
- Departure cannot silently overdraw shared stock; final validation belongs to the eventual gameplay
  contract.
- The return screen should reconcile `Consumed`, `Lost`, `Still equipped`, and `Returned to Village`
  before closing the mission.

Mockup: [phone mission packing](../../design-proposals/living-village-ui/mockups/mission-packing-phone.png).

## Responsive navigation

| Concern | Desktop | Phone |
| --- | --- | --- |
| Primary Village navigation | Slim top bar | Fixed bottom bar with icon and label |
| Facility access | Scene labels and leader lines | Scene labels with collision suppression |
| Resident switching | Bottom resident strip | Compact strip inside the inspection sheet |
| Hero inspection | Right side sheet | Bottom sheet, expandable to full height |
| Inventory detail | Two-column or ledger-plus-context | Single column; detail replaces list until dismissed |
| Mission packing | Side-by-side hero and pack review | Hero carousel plus stacked quantity controls |
| Wiki | Outside shell | Outside shell |

Breakpoints should follow available composition width rather than device names. The desktop shell is
appropriate only while the scene, top navigation, and a 360–420 px inspection sheet can coexist without
crowding. Below that threshold, use the phone navigation and sheet behavior.

## Motion language

Motion should describe place, focus, and custody; it should never be ornamental noise.

| Event | Motion | Target timing |
| --- | --- | --- |
| Title idle | Very slow portal light breathing; no looping text or control motion | 4–6 s cycle |
| Enter Village | Portal gathers, scene luminance bridges, then shell resolves | 450–650 ms total |
| Facility focus | Leader line brightens from target toward label | 140–180 ms |
| Resident selection | Cyan ground marker resolves; camera makes a small ease; sheet enters | 260–340 ms |
| Sheet change | Current content fades 60 ms before new content shifts in | 180–220 ms |
| Navigation change | Active marker travels only between adjacent destinations; distant jumps crossfade | 160–220 ms |
| Item assignment | Selected row holds position while status changes; success mark replaces busy state | 180–260 ms |
| Return deposit | Reconciliation rows move toward the Village summary once, then settle | 300–450 ms |

Use one dominant motion per event. Avoid simultaneous parallax, panel movement, particle bursts, and
counter animation. `prefers-reduced-motion` removes camera movement, parallax, line drawing, and spatial
item travel; it retains immediate state changes and short opacity transitions no longer than 100 ms.

## Interaction and accessibility requirements

- Every facility, navigation destination, hero, item, and increment control is keyboard reachable.
- Focus order follows the visual hierarchy and does not traverse hidden scene markers.
- Touch targets are at least 44×44 CSS pixels; pointer artwork may be visually smaller.
- Bottom navigation accounts for `env(safe-area-inset-bottom)`.
- Sheets trap focus only when modal; routine inspection sheets remain non-modal and support `Escape`.
- Counts and durability changes announce through a restrained live region after confirmed actions.
- Loading, success, unavailable, and depleted states use text or shape in addition to color.
- Decorative particles and scene labels are excluded from the accessibility tree unless interactive.

## Contract boundary and implementation dependencies

The current engine contract exposes a single `main-hand` equipment slot and item ownership/equipped
relationships, while settlement resources are separately represented. This proposal does not change
those definitions.

Implementing the approved custody model later will require a dedicated contract design for at least:

- shared Village Inventory membership and quantities;
- temporary per-mission, per-hero cargo;
- packing validation and reservation;
- mission consumption and loot acquisition;
- return reconciliation with equipped-item exclusion;
- failure, loss, retry, and disconnected-client behavior.

Those semantics must be resolved before production UI writes against them. Mockup labels such as a
mission name, portrait, meal, or potion are presentation examples and do not create canonical catalog
entries.

## Non-goals

- implementing the visual direction in Svelte, CSS, or Pixi;
- changing routes, engine events, item schemas, resource schemas, or shared catalogs;
- introducing authentication;
- replacing the Wiki content system;
- finalizing illustration, portrait, or icon production assets;
- defining inventory balance, capacity, item rarity, or mission rewards.
- defining gameplay thresholds for settlement population or construction stages.

## Remaining visual acceptance criteria

The unresolved system work is ready for implementation planning when reviewers agree that:

1. the title reads as a gateway with one unmistakable action;
2. Wiki and Village feel related but remain structurally independent;
3. the Village scene stays dominant on desktop and phone;
4. facility pointers are more discoverable without becoming a second navigation bar;
5. phone destinations are reachable from the bottom with icon and label;
6. selecting a hero opens only one inspection layer;
7. Village Inventory unmistakably reads as the shared stockpile;
8. Mission Inventory unmistakably reads as temporary and hero-specific;
9. suggested packs are visibly editable before acceptance;
10. the return-to-Village custody rule is visible before departure;
11. the direction does not imply new runtime contracts or canonical catalog content;
12. reduced-motion and keyboard/touch behavior are defined, not deferred.
13. the starting Village visibly contains only the roster and constructed facilities the player has;
14. settlement growth preserves the approved composition while making progression visible;
15. Tower and Gate either have clearly distinct jobs or are intentionally consolidated.

## Phase-one deliverable

The complete review packet lives at
[`docs/design-proposals/living-village-ui/`](../../design-proposals/living-village-ui/README.md). After
visual approval, the next phase should convert this document into an implementation plan with explicit
contract work separated from client-only shell and presentation work.
