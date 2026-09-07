# Task 6 report — common outcomes and claims

## Outcome

Implemented one strict `CombatResult` adapter shared by legacy automatic and agent-readiness modes,
plus deterministic owner-specific claim transitions coordinated above the domain layer. Combat
kernels remain combat-local and do not mutate progression, inventory, mission aftermath, recovery,
or permanent-loss state.

## Contract and ownership decisions

- `CombatResult` now accepts the exact rules version of either current mode and rejects contradictory
  mode/rules pairs.
- `combat-rules-v1.health.minimumSafeHealth` remains the readiness recovery floor, currently 1.
  A separate immutable aftermath registry has explicit entries for the exact legacy and readiness
  mode/rules pairs, so legacy never consumes a caller-supplied readiness rules object. It is not
  used by natural regeneration. The changed readiness-rules hash is recorded in balance evidence.
- `emitCombatOutcome` accepts only typed engine recovery IDs. Provider `publicIntent` is never read
  for recovery, downing, or loss.
- Mission/aftermath and progression each derive an ephemeral transition projection. These are not
  separately persisted canonical states. The orchestration seam coordinates owner transitions for
  later V26 atomic persistence.
- Receipts strictly embed the exact claim and bind its deterministic ID, input hash, claim hash,
  effect hash, key, and owner. Reapplication returns the stored receipt byte-for-byte; poisoned,
  partial, or colliding receipt sets are rejected before owner work.
- Every readiness safety constructor and ordinary readiness completion uses one finalizer. The
  frozen V25 legacy runner is unchanged; only the additive V26 orchestration boundary adapts its
  terminal evidence into the common result.

## TDD evidence

### RED

- Strict combat rules rejected the new `minimumSafeHealth` field.
- The common-outcome suite failed to import the absent adapter.
- Legacy results failed the existing readiness-only `rulesVersion` literal.
- Claim tests failed to import absent projection/transition APIs.
- Forged minimum-safe-Health recovery was accepted before the mission owner checked the exact rule.
- Receipt tests failed because receipts did not yet bind their input projection hash.
- Mission projection tests caught fabricated maximum Health/Mana instead of preserving the exact
  canonical pre-combat resource input.
- Full engine found cross-domain mission→progression imports and intentional public-inventory drift.
- Review REDs proved the actual readiness safety paths emitted empty claim arrays; eight forged or
  incomplete manifests were accepted; recovery could be reordered before final Health; an
  unrelated poisoned receipt was ignored; and a partial persisted receipt set was completed.
- A self-consistent forged result and forged claims were accepted until application required
  separately supplied trusted terminal evidence and re-derived the complete canonical result.
- The first review-fix full engine run caught a mission→combat domain import, which was moved back
  to the orchestration authentication boundary.

### GREEN

- Review-focused outcome/readiness/window/owner/engine integration: 142/142.
- Contract focused rules/result coverage: 30/30.
- Content focused rules coverage: 2/2.
- Contracts full: 146/146; content full: 66/66.
- Engine full after review fixes: 441/441.
- Public API, replay, and module boundaries: 14/14.
- Combat balance: 10,000 trials per matchup, rules hash
  `13b2b27b683e4b0023a2a2c2ee4926127437db3bbf1ace91776def69ef286eff`.
- Contracts/content/engine typecheck and lint: pass.

## Covered behavior

- victory, extraction, retreat, total-party downing, authored deadline, and engine safety stop;
- both combat modes emit the same outer claim categories;
- final Health/Mana, harm, exact recovery floor, skill practice, secured loot, objectives, and
  attempt outcome;
- retreat preserves applied skill-use practice;
- safe victory/extraction recovery raises a downed hero only to 1 Health and preserves injuries;
- unrecovered downing during failed retreat/party-down/deadline becomes loss only in aftermath;
- safety forced-retreat stays explicitly non-authored and does not fabricate permanent loss;
- natural regeneration cannot revive downed heroes or repair injury evidence;
- duplicate application is byte-stable and never doubles practice or loot.
- exact canonical claim rederivation rejects forged loot, practice, objective, harm, recovery,
  claim identity, idempotency identity, missing claims, duplicate IDs, and reordered phases;
- strict projection and embedded-receipt validation occurs before either owner transition, while
  output Health/downed/lost/recovered invariants are asserted after both pure projections;
- ordinary readiness completion requires explicit accumulated engine evidence; actual readiness
  safety stops and the V26 legacy adapter never produce `claims: []`.

## Assumptions

- `securedLoot` has already passed mission/extraction ownership rules; the combat outcome adapter
  does not decide whether loot is secured.
- A failed retreat, party-down, or authored deadline may lose an unrecovered downed hero. A safety
  stop never creates that permanent-loss consequence in this transition.
- The ephemeral projections are harnessable now and are intended to be atomically applied to the
  canonical V26 owners by the later orchestration task.
