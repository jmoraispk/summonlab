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
- Each V26 readiness state carries private, schema-bound accumulated outcome evidence. Applied,
  canceled, and scheduled events update that evidence before any terminal result is derived; it is
  included in the canonical state hash and excluded from every provider view.
- An engine-authorized terminal directive binds extraction or retreat to the exact attempt, tick,
  and pre-directive state hash. Provider/model text cannot author a terminal outcome.
- Claim application returns one manifest-level atomic transition checkpoint. It binds the exact
  before/after hashes of both owner projections, canonical result/authority/claim-manifest hashes,
  and the complete receipt manifest. Duplicate application authenticates the checkpoint and every
  receipt, then requires both current owner projections to equal the recorded post-state hashes.

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
- Second-review REDs proved that six valid receipts could be retained while their corresponding
  owner effects were deleted, because no manifest-level atomic checkpoint authenticated the full
  before/after projections.
- Readiness safety finalization after a prior action discarded the action's resource, harm,
  emitted-event, and practice evidence; ordinary terminal causes were exercised only through a
  helper instead of the production post-batch path.
- Contract REDs rejected the new private accumulator until it was required and cross-validated
  against canonical combatants, event counters, and completed-result evidence.
- Final-review REDs showed that time advance returned a decision window after a due scheduled
  effect had already downed the final enemy or the complete party, and after crossing an authored
  deadline. All three public regressions failed with `decision-window` instead of a combat result.

### GREEN

- Second-review focused engine coverage: 117/117.
- Second-review focused contract coverage: 44/44.
- Content focused rules coverage: 2/2.
- Contracts full: 146/146; content full: 66/66.
- Engine full after second-review fixes: 452/452.
- Final-review readiness/outcome/window/arbitration focus: 73/73.
- Engine full after final-review time-advance fixes: 454/454.
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
- production time advance and post-batch arbitration both send ordinary terminal conditions
  through the same finalizer; scheduled lethal effects finalize at their exact due tick, while an
  authored deadline or authenticated extraction/retreat ends before another decision window;
- scheduled-effect victory and total-party downing retain the exact emitted-event count and ID,
  final resources, harm, and downing evidence without applying post-terminal regeneration;
- a safety stop after prior applied action preserves exact final Health (including the 70/100
  regression), harm, four emitted events, and legitimate skill-practice evidence;
- altered/deleted owner effects cannot be hidden behind otherwise valid per-claim receipts: exact
  post-projection hashes and the manifest-level checkpoint reject the entire duplicate before any
  owner transition.

## Assumptions

- `securedLoot` has already passed mission/extraction ownership rules; the combat outcome adapter
  does not decide whether loot is secured.
- A failed retreat, party-down, or authored deadline may lose an unrecovered downed hero. A safety
  stop never creates that permanent-loss consequence in this transition.
- The ephemeral projections are harnessable now and are intended to be atomically applied to the
  canonical V26 owners by the later orchestration task.
- Persistence of mission-authored extraction/retreat commands belongs to the later V26
  orchestration task; Task 6 consumes only the strict engine-authorized, state-bound directive.
