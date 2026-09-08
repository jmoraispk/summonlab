# Task 5 — Request-bound Pixi Combat Stage Report

## Scope

Implemented the Task 5 unified presentation and resolution boundary. The existing Pixi stage now
creates or replays one request-bound `CombatSession`, advances that same session from its ticker,
and renders the session snapshot. The lab route only received the compile-required prop wiring; it
does not implement Task 6 terminal UI/state behavior.

## Implementation

- Replaced fixture construction, actor-ID artwork lookup, local motion tables, and `restartKey` with
  request/claim-policy/registry/replay props and a single live or replay session.
- Uses the request's de-duplicated raster and motion-pack bindings for all asset loads, environment,
  occluder, actor tuning, and motion sheets. Every actor body is an `AnimatedSprite` built from its
  declared motion pack; a missing declared actor texture or idle clip enters the typed unavailable
  state instead of drawing a procedural character fallback.
- Starts the session only after Pixi, request-declared assets, motion sheets, and scene setup are
  ready. The ticker advances `advanceFixedStep()` at 60 Hz and renders the resulting session combat
  state; pause and presentation lenses do not recreate the session or change its receipt.
- Keeps live completion, rejection, unavailable, and replay-verification callbacks separate and
  one-shot. Async load/unmount races detach listeners/ticker, destroy the application, and unload
  the exact request-derived sources without marking an unmounted encounter unavailable.
- Moved fixture-specific actor offsets, shadows, and display sizes into request visual tuning.

## TDD evidence

### RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts
```

The new request-tuning assertion failed against the actor-ID registration: it received a zero body
offset, default 45/14 shadow, and no display size instead of the declared guardian tuning.

The new stage boundary static-contract suite then failed three assertions before the stage rewrite:
it had no request/session props, no request-derived assets, and advanced local realtime mechanics.

### GREEN

The updated visual-registration and stage-boundary suites report 35 files and 221 tests passing.

## Verification

Passed with `PATH=/tmp/summonlab-node-24.14.1/bin:$PATH`:

```sh
pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/RealtimeCombatStage.spec.ts src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts
pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/actor-animator.spec.ts src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts src/lib/components/living-village/realtime-combat/depth-projection.spec.ts src/lib/components/living-village/realtime-combat/health-bar-layout.spec.ts src/lib/components/living-village/realtime-combat/combat-spatial.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web exec eslint src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte src/lib/components/living-village/realtime-combat/RealtimeCombatStage.spec.ts src/lib/components/living-village/realtime-combat/actor-visual-registration.ts src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts src/routes/living-village-lab/realtime-combat/+page.svelte
pnpm --filter @summonlab/web build
git diff --check
```

Results: unit suite 35/35 files and 221/221 tests passing; Svelte typecheck reports zero errors and
zero warnings; targeted ESLint and whitespace checks pass; production build passes. The build emits
its pre-existing Vite `node:crypto` externalization and adapter `sharp` optional-platform warnings.

## Self-review

- No combat character is constructed with `Graphics`, CSS, SVG, emoji, or text; character bodies
  require request-bound motion art, while Graphics remain limited to stage effects and UI elements.
- No local fixture art table, actor ID matching, or local fixed-step resolver remains in the stage.
- Completion/unavailable/replay callbacks have independent subscriptions and guards, and teardown
  removes callbacks/ticker before destroying Pixi and unloading the request assets.

## Concern

The compile-only lab route passes no-op terminal callbacks. Task 6 must own presentation of live
completion, rejection, unavailable, replay verification, and a new keyed request instance for the
existing replay control.
