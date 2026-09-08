# Task 6 — Rat Route Receipt and Replay Report

## Scope

Implemented the lab-route terminal boundary for the request-driven rat encounter. The route owns
the component-local session registry and consumes only stage callbacks; it does not apply claims or
mutate exploration, inventory, progression, loot/cache, fog, or tiles.

## Implementation

- The live stage receives the canonical rat request, fixture claim policy, component-local registry,
  and the explicit canonical `fixtureRequestHash` dependency. The route deliberately does not pass
  a generic `request.requestHash`, preserving the fixture-only art exemption's narrow scope.
- A single accepted live receipt shows victory/defeat, final hero Health and Mana, the uncommitted
  claim count, receipt ID, and replay request reference. Completion is guarded to one publication.
- Replay keys a replacement stage with the original request and receipt, exposes only verification,
  and retains the original receipt and completion count. It never receives a replay completion or
  claim application path.
- Presentation load failure is separate from defeat and rejection. Retry recreates the stage with
  the same unresolved request; it does not make a new idempotency entry.
- The terminal presents the one approved next action, `Replay verified fight`; production creation
  of a distinct next encounter remains deferred until it can provide approved non-fixture art.
- Lens, pause, and reduced-motion changes do not touch `stageKey`. The only keyed replacements are
  replay and unavailable retry.

## TDD evidence

### RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:e2e -- src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
```

The new terminal case failed after 45 seconds because `combat-resolution` did not exist. The new
unavailable case failed because `combat-unavailable` did not exist. The initial presentation case
also exposed the upstream stage producer omission: it never set its applied-mode marker because it
discarded the canonical fixture hash and rejected the fixture before renderer initialization.

That producer omission was fixed separately in commit `6188842c1` before the route wired
`fixtureRequestHash={dependencies.fixtureRequestHash}`. The existing presentation assertion plus
the added no-rejection assertion protects the canonical route-to-stage integration; the new
unavailable browser case verifies the stage now reaches the presentation failure callback.

### GREEN (pre-fix evidence)

Before fix round 1 removed the misleading control, the route browser file passed five cases:
stable presentation/pause, mobile layout, one live receipt plus verified replay without another
completion, a fresh keyed `Run it again` rejection, and asset-unavailable rendering without a
defeat receipt. This is historical evidence only; the final suite has six cases and no
`Run it again` rejection path.

## Verification

Passed with `PATH=/tmp/summonlab-node-24.14.1/bin:$PATH`:

```sh
pnpm --filter @summonlab/contracts test -- exploration-combat.spec.ts
pnpm --filter @summonlab/contracts typecheck
pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts src/lib/components/living-village/realtime-combat/combat-session.spec.ts src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts src/lib/components/living-village/realtime-combat/actor-animator.spec.ts src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts src/lib/components/living-village/realtime-combat/combat-spatial.spec.ts src/lib/components/living-village/realtime-combat/depth-projection.spec.ts src/lib/components/living-village/realtime-combat/health-bar-layout.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web test:e2e -- src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
pnpm --filter @summonlab/web build
git diff --check
```

Results: contract tests 14 files / 126 tests, web unit tests 36 files / 235 tests, Svelte
typecheck 0 errors and 0 warnings, lint clean, route Playwright 5/5 passing, and production build
passing. The build retains its existing browser `node:crypto`, chunk-size, and optional `sharp`
platform warnings.

## Playtest / preview

Started the requested command with `--host 0.0.0.0`. Port 5173 was already occupied, so Vite
published this slice at `http://10.110.24.218:5174/living-village-lab/realtime-combat` and was
verified listening on `0.0.0.0:5174`; local HTTP returned the route title.

The dedicated headless preview screenshot did not reach Pixi's renderer-ready marker before the
capture closed, so visual composition is not claimed from that probe. The browser suite did pass
the actual renderer-ready, mode-switch, pause, terminal, replay, and unavailable flows.

## Self-review

- No player-facing character fallback was added: the stage continues to render request-bound Pixi
  raster/motion assets only.
- Receipt claims are displayed explicitly as uncommitted and never sent to a claim consumer.
- Replay is constructed from the original request and receipt only; it neither enters the registry
  nor increments the live completion count.
- The canonical fixture alone receives the narrow fixture-art approval dependency; the route does
  not manufacture a new fixture request, idempotency slug, or request hash.

## Fix round 1/5 — replay failure and terminal control

### Scope

- Removed the `Run it again` control and all fresh fixture-request generation. The route now offers
  the approved one canonical live fixture and verified replay only; a production new-encounter
  producer remains deferred.
- Added replay-specific unavailable state alongside the preserved receipt. Its retry keys a new
  replay stage from the same original request and receipt, without clearing the receipt, entering a
  live registry session, incrementing completion, or applying claims.
- Kept initial live-presentation unavailability and its same-request retry behavior separate.
- Bound live and replay unavailable callbacks to distinct handlers selected with the keyed stage,
  so a stale live callback cannot be rendered as a replay failure.

### Exact RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:e2e -- src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts --grep "offers only verified replay"
```

The new terminal-control test failed as expected: `getByRole('button', { name: 'Run it again' })`
resolved to one element when the assertion required zero.

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:e2e -- src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts --grep "retries replay presentation"
```

The replay asset-route test failed as expected after the live receipt: the required
`combat-replay-unavailable` element did not exist. The route handler continued the first
rat-brute motion request, then aborted the replay reload; disabling Playwright's HTTP cache through
routing made the asset failure deterministic.

### GREEN

The two focused browser cases pass after the route-only state split. Full route Playwright now
passes six cases, including receipt/replay, no terminal rerun control, initial unavailable, and
replay unavailable followed by successful replay retry with the original receipt ID and completion
count still equal to one.

### Verification

Passed with `PATH=/tmp/summonlab-node-24.14.1/bin:$PATH`:

```sh
pnpm --filter @summonlab/contracts test -- exploration-combat.spec.ts
pnpm --filter @summonlab/contracts typecheck
pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts src/lib/components/living-village/realtime-combat/combat-session.spec.ts src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts src/lib/components/living-village/realtime-combat/actor-animator.spec.ts src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts src/lib/components/living-village/realtime-combat/combat-spatial.spec.ts src/lib/components/living-village/realtime-combat/depth-projection.spec.ts src/lib/components/living-village/realtime-combat/health-bar-layout.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web test:e2e -- src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
pnpm --filter @summonlab/web build
git diff --check
```

Results: contracts 14 files / 126 tests, web units 36 files / 235 tests, typecheck 0 errors and 0
warnings, lint clean, six route browser cases passing, and build passing. Build warnings remain the
pre-existing browser `node:crypto`, chunk-size, and optional `sharp` platform warnings.

### Self-review

- The persistent receipt contains the original receipt/replay reference only; replay failure and
  retry do not publish a new receipt, claim, or completion.
- The retry action preserves `replayOf`, resets only replay presentation/verification state, and
  increments `stageKey` exactly once for a new non-publishing replay session.
- There is no generic fixture authorization, new request hash, idempotency slug, or live rerun
  path in the route. The canonical fixture exemption remains explicit at the stage boundary.
