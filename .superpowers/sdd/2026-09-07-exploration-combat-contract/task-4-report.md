# Task 4 — Registry Entry and Replay Report

## Scope

Implemented only the Task 4 combat-session boundary: idempotent registry entry, typed terminal
replay/rejection records, unavailable retry removal, and a non-publishing, self-verifying replay
session. Pixi stage ownership and route behavior remain untouched.

## Implementation

- Added `CombatSessionRegistry` and `enterCombatSession()` with canonical request-hash lookup,
  same-object active reuse, frozen completed/rejected records, deterministic conflicts for reused
  idempotency keys or request IDs, and frozen registry lookup views.
- Registers completion storage before external subscriptions execute, so a re-entrant entry observes
  the completed receipt; unavailable sessions remove only their active entry and can retry.
- Added `createReplayCombatSession()` and `CombatReplayVerification`. Replay advances stored contract
  trace events at their captured simulation ticks, never runs current mechanics to generate the
  authoritative trace, never builds/publishes claims, and never calls completion subscribers.
- Replay verifies the request, input-state, trace, output-state, receipt, ruleset, and presentation
  binding hashes before reporting `verified`; any mismatch reports the typed closed failure.
- Preserved Task 3 request validation, fixture-only artwork exception, and exact content-binding
  validation.

## TDD evidence

### RED

```sh
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/combat-session.spec.ts
```

Observed expected failing assertions before implementation for:

- absent `CombatSessionRegistry` / `enterCombatSession` exports;
- duplicate active sessions, idempotency-key conflict, and re-entrant completion lookup;
- absent replay constructor and missing replay verification;
- changed stored `inputStateHash`; and
- persistence of a post-parse request-hash rejection.

The final RED checks respectively reported the missing registry record and a `verified` replay where
the altered input-state hash was expected to produce `mismatch: requestHash`.

### GREEN

The focused session suite completed with 34 test files and 207 tests passing.

## Verification

Passed with `PATH=/tmp/summonlab-node-24.14.1/bin:$PATH`:

```sh
pnpm --filter @summonlab/contracts test -- exploration-combat.spec.ts
pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/combat-session.spec.ts src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web exec eslint src/lib/components/living-village/realtime-combat/combat-session.ts src/lib/components/living-village/realtime-combat/combat-session.spec.ts
git diff --check
```

Results: contracts 126/126 passing; focused web regressions 207/207 passing; typecheck reports zero
errors and zero warnings; targeted ESLint and whitespace checks exit zero.

## Self-review

- Registry reads expose frozen entry wrappers and terminal values are frozen; the active session is
  intentionally the same object so duplicate entry cannot recompute an encounter.
- The registry transition occurs through the first internal completion subscriber, before any caller
  can re-enter from a completion callback.
- Replay consumes immutable stored trace records and final receipt resources rather than invoking
  `stepRealtimeCombat`; it emits only replay verification and leaves `receipt` unset.
- No Pixi stage, Svelte route, claim application, or artwork asset changes are included.

## Concerns

The registry is intentionally in-memory and scoped to the lab session. Durable cross-process
idempotency would need a server-side persistence layer with the same request-hash and receipt rules.

## Fix round 1/5

### Changes

- Replaced trace-driven replay with a private, non-publishing rerun of the normal `CombatSessionImpl`.
  The candidate advances the same fixed mechanics steps, derives events, terminal state, claims, and
  all receipt hashes independently, while the public replay wrapper never exposes its receipt or
  invokes completion subscribers.
- Validates the expected receipt through `ExplorationCombatReceiptSchema` before using it and compares
  the independently generated candidate against request identity, content bindings, ruleset,
  presentation bindings, trace/terminal details, output resources/claims, receipt ID, and complete
  replay-reference data.
- Schema-invalid expected receipts and malformed or incompatible requests now produce a terminal
  replay mismatch (`receiptId`/the closest applicable mismatch field or `requestHash`) instead of a
  normal rejected session without verification.
- Added regressions for intermediate mechanics state, a coherent receipt from another rerun,
  coordinated events/resources/hashes tampering, individual identity/ruleset/presentation/tick
  changes, and malformed receipt/request inputs.

### RED

The new focused replay suite failed against `3a88aff9e` as intended:

```text
Test Files  1 failed | 33 passed (34)
Tests  4 failed | 211 passed (215)
```

Failures showed that replay snapshots retained initial actor state instead of mechanics-applied
state, changed run identity and terminal tick still verified, and a malformed request returned a
plain rejected session with no replay verification. The coordinated-receipt regression additionally
demonstrates a schema-valid self-consistent forged receipt that must be rejected only by an
independent rerun.

### GREEN

After the candidate-session replay implementation, the focused session suite reports 34 test files
and 216 tests passing. Web typecheck reports zero errors and zero warnings; contracts, targeted lint,
and diff checks also pass.

### Self-review

- The candidate is the existing unified session with `publishCompletion` disabled, so it preserves
  mechanics/claims/receipt construction while preventing replay publication.
- Replay uses expected receipt data only after strict parsing and only as the comparison target; live
  snapshots and terminal combat state come from the candidate rerun.
- The approved registry implementation was left unchanged.
