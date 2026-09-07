# Task 3 — Bounded Combat Session Report

## Scope

Implemented the bounded request-driven combat session only. The session owns validated lifecycle
state, fixed-step mechanics advancement, bounded contract trace capture, deterministic terminal
receipt construction, uncommitted claims, and completion subscriptions. It does not include the
Task 4 registry/replay constructor, Task 5 Pixi ownership, or Task 6 route behavior.

## Implementation

- Added `combat-session.ts` with loading, ready, running, victory, defeat, rejected, and unavailable
  lifecycle states.
- Strictly parses requests, recomputes their canonical hash, validates the supported ruleset and all
  required request content bindings, and returns typed pre-simulation rejections.
- Enforces `approvalStatus: approved | fixture-only`: production and altered fixture requests require
  approved bindings; the fixture-only exemption is tied solely to the supplied canonical
  `fixtureRequestHash`.
- Captures only contract mechanics events with `simulationTick` authority and reserves the terminal
  event slot. A mechanics step that would exceed the trace capacity is not applied.
- Produces parsed, deep-frozen deterministic receipts with terminal state, final resources, sorted
  uncommitted claims, value hashes, deterministic receipt ID, and a self-consistent replay reference.
- Emits one terminal receipt per active completion subscription. `markUnavailable()` produces no
  receipt.

## TDD evidence

### Bootstrap RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/combat-session.spec.ts
```

The caught dynamic import assertion failed as intended because `combat-session.ts` did not exist:

```text
AssertionError: expected undefined to deeply equal Any<Function>
Test Files  1 failed | 33 passed (34)
Tests  1 failed | 175 passed (176)
```

### Bootstrap GREEN

After the minimum factory export, the same command reported:

```text
Test Files  34 passed (34)
Tests  176 passed (176)
```

### Behavioral RED

After replacing the bootstrap assertion with the lifecycle, validation, bounds, claims, receipt,
replay-reference, fixed-step, and subscription suite, the placeholder returned `undefined`:

```text
Test Files  1 failed | 33 passed (34)
Tests  15 failed | 175 passed (190)
```

### Behavioral GREEN

The finished suite, including a final RED/GREEN check for missing required action bindings, reports:

```text
Test Files  34 passed (34)
Tests  191 passed (191)
```

## Verification

Ran successfully:

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/contracts test -- exploration-combat.spec.ts
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/combat-session.spec.ts src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web typecheck
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web exec eslint src/lib/components/living-village/realtime-combat/combat-session.ts src/lib/components/living-village/realtime-combat/combat-session.spec.ts
git diff --check
```

The contract test ran 126 tests; focused web regression ran 190 tests before the final binding-only
test was added, and the final focused session suite ran 191 tests. Typecheck reported zero errors and
zero warnings. Targeted ESLint and whitespace checks exited zero.

## Self-review

- Kept mechanics presentation and resolution combined under the session, with no presentation-only
  resolver split.
- Confirmed receipt construction parses through the shared contract before deep-freezing and that the
  HUD mechanics phase is changed to the same terminal result.
- Confirmed the normal fixture stays below the 2,000-event capacity after the start and end records.
- Confirmed no paused, reduced-motion, renderer, registry, replay-constructor, or route concerns were
  added to this module.

## Concerns

`SUPPORTED_RULESET_VERSION` intentionally scopes this first unified session to the existing rat
mechanics. Supporting later rulesets requires an explicit mechanics implementation and binding policy,
not a silent fallback.
