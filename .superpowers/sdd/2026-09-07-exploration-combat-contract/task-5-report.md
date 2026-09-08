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

## Fix round 1/5 — Pixi asset lifecycle ownership

### Scope

- Added a shared per-source Pixi asset owner for request-derived raster and motion sources.
- Made stage initialization failure and unmount release their claim immediately and idempotently,
  while detaching callbacks, the ticker, the resize observer, and the Pixi application.
- Added behavior-level lifecycle coverage; the retained source-text checks are supplementary only.
- Deliberately left the `Run it again` route behavior unchanged: Task 6 owns the keyed request
  instance and terminal/replay UI boundary.

### Exact RED/GREEN evidence

#### RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/stage-lifecycle.spec.ts
```

The new unload-in-flight replacement test failed: it expected the source to load twice (once after
the global Pixi unload) but received one load. That demonstrated the old owner could evict a texture
after a replacement stage had claimed it. Earlier RED evidence also showed the helper module absent,
then `stageAssetOwner is not a function` before shared ownership was added.

#### GREEN

The owner now serializes an unload/reclaim transition: a claimant that arrives during the final
unload receives a reloaded texture before its `ready` promise settles. The complete web unit suite
passes with 36 files and 231 tests.

### Behavioral coverage

`stage-lifecycle.spec.ts` verifies request-source de-duplication, shared-source overlap, final-only
unload, pending-load unmount, partial load failure cleanup, duplicate/idempotent release, reclaim
before release settles, reclaim during an in-flight unload, paused fixed-step stability, 60 Hz
advancement, and one-shot live completion/unavailable versus replay verification.

### Verification

Passed with `PATH=/tmp/summonlab-node-24.14.1/bin:$PATH`:

```sh
pnpm --filter @summonlab/web test:unit
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web exec eslint src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte src/lib/components/living-village/realtime-combat/RealtimeCombatStage.spec.ts src/lib/components/living-village/realtime-combat/stage-lifecycle.ts src/lib/components/living-village/realtime-combat/stage-lifecycle.spec.ts
pnpm --filter @summonlab/web build
git diff --check
```

All commands passed. The production build retains its existing `node:crypto` browser-externalization
and optional-platform `sharp` warnings.

### Fix-round self-review

- The source list remains request-derived; no actor visual fallback or procedural character was
  added. Actor bodies remain declared raster/motion `AnimatedSprite`s.
- Each stage claim releases at most once. Shared sources unload only after their final claimant;
  a claimant arriving while Pixi is unloading reloads before it can render.
- Asset errors and unmounts release claims promptly. Failure teardown is idempotent and removes
  active callbacks, ticker, observer, render functions, and the Pixi application before a stale
  stage can publish or complete.

## Fix round 2/5 — Prompt partial-load failure

### Exact RED/GREEN evidence

#### RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/stage-lifecycle.spec.ts
```

The new rejected-source/pending-sibling behavior test timed out at Vitest's five-second limit.
`claim.ready` caught the failed source but awaited `release()`, whose deferred cleanup correctly
waited for the sibling loader and therefore prevented the stage unavailable path from running.

#### GREEN

The failure path now decrements all ownership synchronously and schedules release cleanup with a
handled detached promise. `claim.ready` rethrows the original load error immediately; the stage
also schedules rather than awaits release before entering its unavailable teardown. A replacement
claim made before the pending sibling resolves stays claimed, then owns its final unload.

### Verification

Passed with `PATH=/tmp/summonlab-node-24.14.1/bin:$PATH`:

```sh
pnpm --filter @summonlab/web test:unit
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web exec eslint src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte src/lib/components/living-village/realtime-combat/stage-lifecycle.ts src/lib/components/living-village/realtime-combat/stage-lifecycle.spec.ts
pnpm --filter @summonlab/web build
git diff --check
```

All commands passed: 36 unit files / 232 tests and Svelte typecheck with zero errors or warnings.
The build retains its existing `node:crypto` browser-externalization and optional-platform `sharp`
warnings.

### Fix-round self-review

- A failed source no longer waits for an indefinitely pending sibling before `claim.ready` rejects
  and the request-bound stage can report unavailable.
- Ownership counts still decrement once per unique source. Cleanup promises are retained for later
  safe unload/reload transitions and their errors are handled, so a detached failure is not
  unhandled and cannot block a replacement stage.
- The new behavioral test exercises failure, pending cleanup, a reclaimed pending source, and its
  eventual final unload. No route or presentation behavior changed.

## Fix round 3/5 — Unload-rejection reacquisition

### Exact RED/GREEN evidence

#### RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/stage-lifecycle.spec.ts
```

The two new unload-rejection tests failed: a replacement after final release inherited `Error:
unload failed`, and a replacement arriving during a controlled rejected unload also inherited the
rejected transition. Vitest additionally reported the latter as an unhandled rejection.

#### GREEN

On an unclaimed final-unload error, the owner removes that stale entry so a later claimant starts a
fresh `loader.load`. If the source is reclaimed while unload fails, the transition reloads and
fulfills the replacement's already-captured readiness promise. Transition errors now have an
explicit observer while callers retain the controlled release rejection when no claimant remains.

### Verification

Passed with `PATH=/tmp/summonlab-node-24.14.1/bin:$PATH`:

```sh
pnpm --filter @summonlab/web test:unit
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web exec eslint src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte src/lib/components/living-village/realtime-combat/stage-lifecycle.ts src/lib/components/living-village/realtime-combat/stage-lifecycle.spec.ts
pnpm --filter @summonlab/web build
git diff --check
```

All commands passed: 36 unit files / 234 tests and Svelte typecheck with zero errors or warnings.
The build retains its existing `node:crypto` browser-externalization and optional-platform `sharp`
warnings.

### Fix-round self-review

- A final unload rejection cannot leave a globally retained rejected `ready` promise: the stale
  unclaimed entry is removed and a later stage loads again.
- A claimant arriving during an unload rejection receives a reload before its readiness settles;
  its later final release performs the next unload attempt exactly once.
- Both explicit release errors and detached transition errors are observed. Existing overlap,
  pending-failure, and successful unload-reclaim cases remain in the full suite.

## Integration fix round 4/5 — Fixture session dependency forwarding

### Exact RED/GREEN evidence

#### RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/stage-lifecycle.spec.ts src/lib/components/living-village/realtime-combat/RealtimeCombatStage.spec.ts
```

The new stage-dependency behavior test found no `stageSessionDependencies` factory, while the stage
static boundary lacked the `fixtureRequestHash` prop. As a result the canonical RAT request entered
`enterCombatSession` without its explicit fixture approval and was rejected before request-declared
Pixi motion assets could load.

#### GREEN

`RealtimeCombatStage` now accepts an optional request-bound `fixtureRequestHash`, snapshots it with
the other session inputs, and builds the exact typed dependencies passed to both live and replay
entry points. The behavior test proves the canonical hash creates a session in `loading`; missing
and incorrect hashes remain rejected.

### Verification

Passed with `PATH=/tmp/summonlab-node-24.14.1/bin:$PATH`:

```sh
pnpm --filter @summonlab/web test:unit
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web exec eslint src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte src/lib/components/living-village/realtime-combat/RealtimeCombatStage.spec.ts src/lib/components/living-village/realtime-combat/stage-lifecycle.ts src/lib/components/living-village/realtime-combat/stage-lifecycle.spec.ts
git diff --check
```

The focused and full unit suites pass at 36 files / 235 tests, and typecheck reports zero errors or
warnings. I intentionally skipped the production build because the shared worktree contains active
Task 6 route/E2E edits; the requested Task 5 evidence remains isolated.

### Fix-round self-review

- The approved fixture exception remains narrow: missing or incorrect hashes do not broaden it.
- Live and replay creation share the same immutable stage dependency object, so they receive the
  same fixture approval input.
- Only Task 5 stage/helper/test files are committed in this integration round. The uncommitted Task
  6 route and E2E files are preserved for their owner.
