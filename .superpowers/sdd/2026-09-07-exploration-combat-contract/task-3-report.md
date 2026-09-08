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

## Fix round 1/5

### Changes

- Moved all ordinary request inspection behind `ExplorationEncounterRequestSchema.safeParse`; the only
  pre-parse production-art classification now uses defensive record and array guards, so partial
  external input cannot throw. Invalid input yields a typed `invalid-request` rejection.
- Applied the fixture exemption to `fixture-only` bindings rather than `visualStatus`. A noncanonical
  request may retain `visualStatus: fixture` when every binding is approved; any request with a
  fixture-only binding must match `fixtureRequestHash` exactly.
- Public combat state and snapshots now return deep-frozen structured-clone views. Internal mechanics
  and trace arrays remain private and mutable only within the session.
- Hardened content validation to require exactly one supported ruleset binding with its canonical
  content ID, version, and hash; exactly one supplied claim-policy binding; and exactly one binding
  for every declared action reference with no surplus action binding.

### RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/combat-session.spec.ts
```

The new regressions failed against `c887c6a3c` as expected:

```text
Test Files  1 failed | 33 passed (34)
Tests  4 failed | 191 passed (195)
```

The failures respectively showed the unsafe `request.party is not iterable` access, rejection of an
approved noncanonical fixture, acceptance of altered/surplus binding entries, and mutable public combat
state.

### GREEN

After the boundary, binding, and immutable-view changes, the focused session suite reported:

```text
Test Files  34 passed (34)
Tests  195 passed (195)
```

### Self-review

- Confirmed production fixture-only art still receives the existing explicit art rejection through the
  defensive pre-parse classification, while arbitrary malformed production objects receive
  `invalid-request` without throwing.
- Confirmed frozen public views are detached from the `currentCombat` and `trace` state used by
  `advanceFixedStep`, preserving atomic capacity checks and deterministic receipt hashes.
- Confirmed policy/ruleset duplicates are rejected by cardinality rather than by whichever entry
  `.find()` happened to return, and action references cannot be satisfied by a broad kind/ID subset.

## Fix round 2/5

### Changes

- Deep-freeze the complete `CombatSessionSnapshot` wrapper after creating its detached combat and trace
  views, so callers cannot replace scalar fields or optional terminal fields on the snapshot object.
- Derive the authoritative action-binding map from the canonical rat request and require every action
  reference to match that trusted binding's ID, version, and hash exactly.

### RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/combat-session.spec.ts
```

The new regression run failed as intended:

```text
Test Files  1 failed | 33 passed (34)
Tests  2 failed | 193 passed (195)
```

An altered existing action binding was accepted into `loading`, and `Object.isFrozen(snapshot)` was
false.

### GREEN

The same focused suite after the changes reported:

```text
Test Files  34 passed (34)
Tests  195 passed (195)
```

### Self-review

- The trusted action map is constructed from the fixture module, not from request-supplied values; an
  approved visual fixture variation remains acceptable when its canonical action bindings are intact.
- Snapshot creation still provides detached frozen combat and event views, while the added wrapper freeze
  prevents mutation of `status`, `simulationTick`, and optional terminal references.
