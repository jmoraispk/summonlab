# Task 2 report — rat encounter fixture and request-driven mechanics

## Scope delivered

- Added the canonical, frozen `RAT_ENCOUNTER_REQUEST`, its versioned fixture claim policy, request hash helpers, and SHA-256 asset-binding projection.
- Replaced hard-coded combat actors with request projection, including resources, action references, presentation bindings, victory requirements, and fixed tick intervals.
- Made each mechanics step return the next state plus authoritative mechanics events.
- Replaced the hard-coded motion singleton with request-binding diagnostics that retain the first actor-order occurrence of each shared pack.
- Updated only the existing presentation callers needed to pass the request and consume `.state`; no session lifecycle, registry, or Pixi ownership behavior was added.

## TDD record

### Cycle 1 — new module import/export bootstrap

RED command:

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts
```

Exact failures (caught dynamic imports):

```text
expected undefined to deeply equal Any<Function>
expected undefined to be defined
Test Files  1 failed | 32 passed (33)
Tests  2 failed | 168 passed (170)
Exit status 1
```

GREEN command (after minimal `combat-hash.ts` export and fixture export):

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts
```

Exact result:

```text
Test Files  33 passed (33)
Tests  170 passed (170)
```

### Cycle 2 — fixture contract and bindings

RED command:

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts
```

Exact failures:

```text
ZodError: Invalid input: expected "exploration-encounter-request-v1"
AssertionError: expected [] to have a length of 17 but got +0
Test Files  1 failed | 32 passed (33)
Tests  2 failed | 168 passed (170)
Exit status 1
```

GREEN command:

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts
```

Exact result:

```text
Test Files  33 passed (33)
Tests  170 passed (170)
```

### Cycle 3 — request projection and mechanics events

RED command:

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts
```

Exact failure causes:

```text
expected 'running' to be 'victory'
expected { ... } to match object { health: 126, mana: 40, x: 0.66, y: 0.88 }
TypeError: Cannot read properties of undefined (reading 'filter')
TypeError: Cannot read properties of undefined (reading 'actors')
Test Files  1 failed | 32 passed (33)
Tests  8 failed | 164 passed (172)
Exit status 1
```

GREEN command:

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts
```

Exact result:

```text
Test Files  33 passed (33)
Tests  172 passed (172)
```

### Cycle 4 — request-bound motion diagnostic

RED command:

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts
```

Exact failure:

```text
Expected: "asha:2,iron-guardian:5,moss-archer:4,rat-brute:1,lesser-rat:2"
Received: "0:2,1:5,2:4,3:1,4:2,5:2,6:2,7:2"
Test Files  1 failed | 32 passed (33)
Tests  1 failed | 171 passed (172)
Exit status 1
```

GREEN command:

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts
```

Exact result:

```text
Test Files  33 passed (33)
Tests  172 passed (172)
```

## Final verification

```text
Focused combat regression:
  Test Files  33 passed (33)
  Tests  172 passed (172)

Typecheck:
  svelte-check found 0 errors and 0 warnings

Targeted ESLint:
  exit 0

git diff --check:
  exit 0
```

The fixture continues to settle to deterministic victory before 40 seconds.

## Self-review

- Verified all 17 unique fixture sources are request-derived and carry the supplied distinct SHA-256 hashes.
- Verified fixture status is `fixture`, while every bound asset uses `fixture-only`; production validation remains solely in the Task 1 contract.
- Verified victory evaluates only living enemies marked `requiredForVictory`, not a rat-specific team count.
- Verified Saffron Arc activates from the bound `saffron-arc-v1` action ID and animation revision counters remain state-owned mechanics data.
- Kept the motion-pack source validation helper and changed only its public diagnostic input to request bindings.

## Fix round 1 — trace capacity and Arc event identity

### RED — terminal trace capacity and Arc identity

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts
```

Exact failures:

```text
AssertionError: expected 2187 to be less than or equal to 2000
AssertionError: expected [] to deeply equal [ 'action-started', 'action-resolved' ]
Test Files  1 failed | 32 passed (33)
Tests  2 failed | 172 passed (174)
Exit status 1
```

The initial 2,187 count is the complete mechanics trace plus the two reserved future lifecycle events. The event stream emitted `movement-committed` for every advancing actor on every tick, and Saffron Arc reused the primary strike action ID.

### GREEN — summarized movement and bound Arc identity

Movement events now describe a committed movement transition (a newly selected target or a transition back into advance), rather than emitting every fixed simulation tick. When the third bound Saffron action triggers its Arc, `action-started` and `action-resolved` both carry `saffron-arc-v1`; an otherwise identical actor with that action removed emits neither Arc identity nor Arc summary.

GREEN command:

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts
```

Exact result:

```text
Test Files  33 passed (33)
Tests  174 passed (174)
```

### Fixture assertion strengthening

Added a low-cost regression that pins all 17 source-to-SHA-256-to-approval mappings, the exact 8-actor bounds and combat profiles, and deep-freeze behavior. It passed against the existing canonical fixture:

```text
Test Files  33 passed (33)
Tests  175 passed (175)
```

### Fix-round verification

```text
Focused combat regression:
  Test Files  33 passed (33)
  Tests  175 passed (175)

Typecheck:
  svelte-check found 0 errors and 0 warnings

Targeted ESLint:
  exit 0

git diff --check:
  exit 0
```

### Fix-round self-review

- The regression reserves two events for future `encounter-started` and `encounter-ended` lifecycle emission without increasing `maximumTraceEvents`.
- Movement summaries remain authoritative state-transition events while removing repeated per-tick noise.
- Arc identity is selected before both action lifecycle events, so no non-Arc strike can be mislabeled and no actor lacking `saffron-arc-v1` can emit it.
