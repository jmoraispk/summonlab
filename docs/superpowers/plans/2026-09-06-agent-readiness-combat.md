# Agent Readiness Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, replayable `agent-readiness-v1` combat mode in which heroes independently choose legal intents from one frozen readiness window and the engine alone resolves timing, collisions, hits, damage, downing, and outcomes.

**Architecture:** Build `engine-v26` on the completed v25 foundation. A pure stepped combat kernel advances to one-tick readiness cohorts, emits a shared canonical snapshot plus filtered actor views, and accepts one validated choice batch. Durable decision jobs run outside the engine and are grouped by a window coordinator; replay bypasses providers and reapplies recorded batches. The operator may enable the mode after internal gates pass, but no player route receives a mode selector.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, event-sourced `@summonlab/engine`, PostgreSQL durable jobs, `@summonlab/policies`, OpenAI Responses API adapter already present in the repository, SvelteKit, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-attributes-and-combat-modes-design.md`

**Prerequisite:** Complete and verify `docs/superpowers/plans/2026-09-06-four-attribute-legacy-combat.md` first.

## Global constraints

- The intent provider chooses exactly one supplied legal action plus structured target/destination and an allowed fallback. It never resolves an effect.
- All actors ready on simulation tick `T` bind to the same canonical snapshot before any choice mutates combat state. API latency never advances simulation time.
- Hidden seed, rolls, non-visible enemies, and other actors' unresolved choices never enter an actor view.
- Batch order is exact readiness time, authored interrupt priority, then purpose-keyed seeded tie-break. Agility does not get a second general initiative bonus.
- No provider re-query occurs during collision arbitration. Every legal action declares invalid-target, occupied-destination, retarget, cancellation, and refund policies.
- The engine owns death/downing. Provider prose cannot mutate state or create effects.
- `legacy-auto-v1` and all engine-v25 behavior remain unchanged.

---

### Task 1: Add v26 readiness contracts and versioned mission state

**Files:**

- Create: `packages/contracts/src/readiness-combat.ts`
- Create: `packages/contracts/src/readiness-combat.spec.ts`
- Modify: `packages/contracts/src/engine/mission-state.ts`
- Modify: `packages/contracts/src/engine/commands.ts`
- Modify: `packages/contracts/src/event.ts`
- Modify: `packages/contracts/src/engine/game-state.ts`
- Modify: `packages/contracts/src/engine/index.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/engine-public-api.snapshot.ts`
- Modify: `packages/engine/src/core/types.ts`
- Modify: `packages/engine/src/core/versions.ts`
- Modify: `packages/engine/src/core/state.ts`

- [ ] Write failing strict-schema tests for combatants, positions, resources, readiness, conditions, action intents, fallback choices, frozen windows, batches, resolved events, safety stops, results, and claims.
- [ ] Define these versioned identifiers: `readiness-combat-state-v1`, `combat-window-v1`, `combat-choice-batch-v1`, `combat-result-v1`, `combat-rules-v1`, and `engine-v26`.
- [ ] Add `MissionAttemptV10Schema` whose mode-specific state is a discriminated union: existing legacy turn state for `legacy-auto-v1`, or `ReadinessCombatStateV1Schema` for `agent-readiness-v1`. Add `MissionRunStateV10Schema` and `EngineGameStateV26Schema` without mutating v25.
- [ ] Define the stepped public return types:

```ts
type CombatAdvance =
	| { kind: 'decision-window'; snapshot: CombatWindowSnapshot; views: ActorDecisionView[] }
	| { kind: 'combat-result'; result: CombatResult };

function advanceUntilDecision(state: ReadinessCombatStateV1, rules: CombatRulesV1): CombatAdvance;
function applyChoiceBatch(
	state: ReadinessCombatStateV1,
	batch: CombatChoiceBatchV1,
	rules: CombatRulesV1
): { state: ReadinessCombatStateV1; events: CombatResolvedEvent[] };
```

- [ ] Add v26 to only the supported engine capabilities and update intentional export snapshots.
- [ ] Verify:

```bash
pnpm --filter @summonlab/contracts test -- readiness-combat.spec.ts engine-compatibility.spec.ts
pnpm --filter @summonlab/contracts typecheck
pnpm --filter @summonlab/engine test -- compatibility/replay-vectors.spec.ts
```

- [ ] Commit:

```bash
git add packages/contracts packages/engine/src/core
git commit -m "feat(combat): define v26 readiness contracts"
```

### Task 2: Implement readiness accumulation and one-tick cohorts

**Files:**

- Create: `packages/engine/src/domains/combat/readiness.ts`
- Create: `packages/engine/src/domains/combat/readiness.spec.ts`
- Modify: `packages/content/src/combat-rules.ts`
- Modify: `packages/content/src/combat-rules.spec.ts`
- Modify: `packages/engine/src/index.ts`

- [ ] Write tests proving: no actor is emitted before ready; all actors crossing on the same tick share one window; actors on adjacent ticks do not; recovery delays the next action; Agility monotonically shortens readiness time; and an action cost is applied only after choice.
- [ ] Add versioned candidates to `combat-rules-v1`: logical tick `100ms`, readiness threshold `10_000`, per-tick gain `100 + Agility`, and action recovery from each authored action's `recoveryTicks`. Keep all arithmetic integer-based.
- [ ] Implement `advanceUntilDecision` as a pure loop that advances only to the next meaningful readiness tick, applies due scheduled effects and natural regeneration, and stops before any ready actor chooses.
- [ ] Compute and store exact readiness numerators for ordering, but expose only player-meaningful timing in presentation. Do not introduce an `initiative` field.
- [ ] Add safety counters for total ticks, emitted events, and no-progress cycles. Return a typed `safety-stop` result rather than an authored timeout failure.
- [ ] Verify:

```bash
pnpm --filter @summonlab/content test -- combat-rules.spec.ts
pnpm --filter @summonlab/engine test -- domains/combat/readiness.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] Commit:

```bash
git add packages/content/src/combat-rules.ts packages/content/src/combat-rules.spec.ts packages/engine/src/domains/combat/readiness.ts packages/engine/src/domains/combat/readiness.spec.ts packages/engine/src/index.ts
git commit -m "feat(combat): advance one-tick readiness cohorts"
```

### Task 3: Build frozen truth, perception-filtered views, and legal intents

**Files:**

- Create: `packages/engine/src/domains/combat/window.ts`
- Create: `packages/engine/src/domains/combat/window.spec.ts`
- Modify: `packages/engine/src/domains/combat/legal-actions.ts`
- Modify: `packages/engine/src/domains/combat/legal-actions.spec.ts`
- Modify: `packages/engine/src/context.ts`
- Modify: `packages/engine/src/context.spec.ts`

- [ ] Add tests with two ready heroes who have different visibility, skills, relationships, doctrine, and Master directions. Assert one snapshot hash, two different actor-view hashes, and two different legal-action-set hashes.
- [ ] Build `CombatWindowSnapshot` from canonical tick, combatants, positions, Health/Mana, conditions, cooldowns/recovery, terrain, visible telegraphs, rules/content bindings, and state hash.
- [ ] Derive each `ActorDecisionView` from the immutable snapshot. Include identity, observable state, remembered/doctrine context, relevant relationships, directions, and supplied legal actions. Exclude seed, roll material, hidden combatants, private state of allies, and unresolved cohort choices.
- [ ] Extend legal actions with typed target contracts (`self`, `entity`, `tile`, `entity-relative-position`) and a finite `fallbackOptions` array. Bind every view and response to snapshot/view/legal hashes.
- [ ] Extend context assembly with `decisionKind: 'combat-action'`; keep settlement and legacy mission packets unchanged.
- [ ] Verify:

```bash
pnpm --filter @summonlab/engine test -- domains/combat/window.spec.ts domains/combat/legal-actions.spec.ts context.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] Commit:

```bash
git add packages/engine/src/domains/combat packages/engine/src/context.ts packages/engine/src/context.spec.ts
git commit -m "feat(combat): assemble frozen actor decision views"
```

### Task 4: Add purpose-keyed randomness and authoritative action resolution

**Files:**

- Create: `packages/engine/src/domains/combat/randomness.ts`
- Create: `packages/engine/src/domains/combat/randomness.spec.ts`
- Create: `packages/engine/src/domains/combat/resolver.ts`
- Create: `packages/engine/src/domains/combat/resolver.spec.ts`
- Modify: `packages/engine/src/index.ts`

- [ ] Add tests proving rolls are stable across object insertion order, unrelated actors, area-target ordering, and replay; changing purpose, actor, action instance, target, or local sequence must change the draw.
- [ ] Implement purpose-key draws from `seed + attemptId + tick + actorId + actionInstanceId + optional targetId + purpose + local sequence`. Do not consume the legacy entropy cursor.
- [ ] Implement hit resolution from skill accuracy/mastery versus defender evasion, a clamped relative-Agility modifier, and explicit flank/surround/unaware modifiers. Use separate `hit`, `critical`, `status`, and `target-fallback` purposes.
- [ ] Resolve damage in this order: authored base/coefficient; Might for physical or Spirit for magical; bounded affinity contribution; critical/status multiplier; armor and penetration for general physical mitigation; matching named resistances; resource clamp; typed downing event.
- [ ] Apply Vitality Health regeneration and Spirit Mana regeneration only during readiness advancement, respecting post-hit delay, caps, and downed state.
- [ ] Assert no model/provider data can supply damage, hit result, critical result, status, downing, loot, or death.
- [ ] Verify:

```bash
pnpm --filter @summonlab/engine test -- domains/combat/randomness.spec.ts domains/combat/resolver.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] Commit:

```bash
git add packages/engine/src/domains/combat packages/engine/src/index.ts
git commit -m "feat(combat): resolve actions with purpose-keyed rolls"
```

### Task 5: Resolve same-window collisions with authored fallbacks

**Files:**

- Create: `packages/engine/src/domains/combat/arbitration.ts`
- Create: `packages/engine/src/domains/combat/arbitration.spec.ts`
- Modify: `packages/contracts/src/readiness-combat.ts`
- Modify: `packages/contracts/src/readiness-combat.spec.ts`
- Modify: `packages/content/src/combat-skills.ts`

- [ ] Test the accepted conflict cases: both actors flank each other; two actors claim one tile; an earlier action moves a target; an earlier action downs a target; an entity-relative flank recalculates around the moved target; a fixed-tile move does not; and a selected fallback is no longer valid.
- [ ] Sort one batch by exact readiness, then authored `reactionPriority`, then a purpose-keyed tie. Validate all batch hashes before the first mutation.
- [ ] Revalidate each intent against the progressively resolved state. Apply only a fallback included in the original legal action and selected response. If none remains valid, cancel with the action's authored Mana/readiness refund policy.
- [ ] Record `originalIntent`, `conflictingEventId`, `fallbackApplied`, `finalOutcome`, resource deltas, and position deltas for every superseded/canceled action.
- [ ] Never query a provider during arbitration and never expose unresolved cohort choices to another actor.
- [ ] Verify:

```bash
pnpm --filter @summonlab/contracts test -- readiness-combat.spec.ts
pnpm --filter @summonlab/engine test -- domains/combat/arbitration.spec.ts
```

- [ ] Commit:

```bash
git add packages/contracts/src/readiness-combat.ts packages/contracts/src/readiness-combat.spec.ts packages/content/src/combat-skills.ts packages/engine/src/domains/combat/arbitration.ts packages/engine/src/domains/combat/arbitration.spec.ts
git commit -m "feat(combat): arbitrate conflicting intent batches"
```

### Task 6: Emit common outcomes, recovery, practice, and idempotent claims

**Files:**

- Create: `packages/engine/src/domains/combat/outcome.ts`
- Create: `packages/engine/src/domains/combat/outcome.spec.ts`
- Create: `packages/engine/src/domains/progression/claims.ts`
- Create: `packages/engine/src/domains/progression/claims.spec.ts`
- Modify: `packages/engine/src/domains/mission/lifecycle.ts`
- Modify: `packages/engine/src/domains/mission/reducer.ts`
- Modify: `packages/engine/src/engine.spec.ts`

- [ ] Test victory, extraction, retreat, total party downing, authored deadline, and engine safety stop. Assert legacy and readiness modes both emit the common outer result and claims.
- [ ] Emit idempotent claims for final combat-local resources, harm/recovery, skill-practice evidence, loot/extraction, objective state, and attempt outcome. Apply them through existing owning reducers, never directly inside the combat kernel.
- [ ] Preserve legitimate practice evidence on retreat. A hero who was downed but recovered by victory/extraction returns at the minimum safe Health defined by the rules; an unrecovered downed hero at failed extraction is lost through the engine-owned aftermath transition.
- [ ] Ensure natural regeneration never revives, removes injuries, or substitutes for recovery claims. Ensure model text cannot declare recovery or death.
- [ ] Verify:

```bash
pnpm --filter @summonlab/engine test -- domains/combat/outcome.spec.ts domains/progression/claims.spec.ts engine.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] Commit:

```bash
git add packages/engine/src/domains/combat/outcome.ts packages/engine/src/domains/combat/outcome.spec.ts packages/engine/src/domains/mission packages/engine/src/domains/progression packages/engine/src/engine.spec.ts
git commit -m "feat(combat): apply readiness outcomes through claims"
```

### Task 7: Persist decision windows and cohort jobs durably

**Files:**

- Create: `packages/database/migrations/0019_combat_decision_windows.sql`
- Create: `packages/database/src/combat-decision-windows.ts`
- Create: `packages/database/src/combat-decision-windows.integration.spec.ts`
- Modify: `packages/database/src/decision-jobs.ts`
- Modify: `packages/database/src/index.ts`
- Modify: `packages/database/src/migration.integration.spec.ts`
- Modify: `packages/contracts/src/decision.ts`
- Create: `packages/contracts/src/decision.spec.ts`

- [ ] Extend decision contracts with `combat-action` and window binding fields while retaining parsability of decision-job v1/v2. Introduce `decision-job-v3` only for new jobs.
- [ ] Create `summonlab_combat_decision_windows` keyed by `window_id`, with run/attempt/tick, snapshot hash, expected run version/cursor, status, batch hash, applied event cursor, and timestamps. Add nullable `window_id` and `actor_view_hash` to decision jobs, plus unique `(window_id, hero_id)` for cohort jobs.
- [ ] Implement one transaction that inserts the window and all actor jobs from the engine-produced views. Implement idempotent reads, leases, terminal aggregation, stale marking, and compare-and-swap batch application.
- [ ] Do not require jobs to finish in actor order. Mark a window ready only when every required actor job has a valid result or an exhausted deterministic fallback.
- [ ] Test crash/retry after window insert, duplicate enqueue, out-of-order completions, expired leases, stale run version, one failed provider, and duplicate batch application.
- [ ] Verify with PostgreSQL:

```bash
pnpm db:start
pnpm db:migrate
pnpm --filter @summonlab/database test:integration -- migration.integration.spec.ts combat-decision-windows.integration.spec.ts
pnpm --filter @summonlab/database typecheck
```

- [ ] Commit:

```bash
git add packages/contracts/src/decision.ts packages/contracts/src/decision.spec.ts packages/database
git commit -m "feat(database): persist combat decision cohorts"
```

### Task 8: Execute provider choices concurrently and assemble the batch

**Files:**

- Modify: `packages/policies/src/core.ts`
- Modify: `packages/policies/src/index.ts`
- Modify: `packages/policies/src/openai.ts`
- Modify: `packages/policies/src/policies.spec.ts`
- Create: `apps/worker/src/combat-decision.ts`
- Create: `apps/worker/src/combat-decision.integration.spec.ts`
- Modify: `apps/worker/src/decision.ts`
- Modify: `apps/worker/src/index.ts`

- [ ] Add a combat response contract that accepts only `actionId`, typed target/destination, one supplied fallback ID, optional public intent, and the four binding hashes/IDs. Keep the instruction: “Choose exactly one supplied legal action. The engine resolves it.”
- [ ] Update Random, Scripted, and OpenAI policies to consume combat actor views without gaining access to canonical hidden state. Validate structured output before storing a result.
- [ ] Let the worker claim different actors' jobs concurrently through the existing lease mechanism. When a window becomes terminal, assemble choices in stable actor-ID order; the engine, not the worker, decides resolution order.
- [ ] On timeout/provider/schema failure, exhaust configured retries and then use the job's precomputed legal deterministic fallback. Never ask another model to resolve the conflict or invent an effect.
- [ ] Test mixed model/random results, latency reordering, malformed targets, hash mismatch, worker restart, fallback exhaustion, and replay without provider calls.
- [ ] Verify:

```bash
pnpm --filter @summonlab/policies test
pnpm --filter @summonlab/worker test
pnpm --filter @summonlab/worker test:integration -- combat-decision.integration.spec.ts
pnpm --filter @summonlab/policies typecheck
pnpm --filter @summonlab/worker typecheck
```

- [ ] Commit:

```bash
git add packages/policies apps/worker
git commit -m "feat(worker): coordinate concurrent combat intents"
```

### Task 9: Wire the operator mode through run creation, mission API, and UI

**Files:**

- Modify: `packages/config/src/index.ts`
- Modify: `packages/config/src/config.spec.ts`
- Modify: `packages/database/src/proof.ts`
- Modify: `apps/web/src/routes/api/runs/+server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/mission/+server.ts`
- Create: `apps/web/src/routes/api/runs/[runId]/combat-windows/[windowId]/+server.ts`
- Modify: `apps/web/src/routes/mission/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/mission/[runId]/+page.svelte`
- Create: `apps/web/src/routes/api/runs/[runId]/mission/server.spec.ts`
- Create: `apps/web/src/routes/api/runs/[runId]/combat-windows/[windowId]/server.integration.spec.ts`

- [ ] Expand `COMBAT_MODE` config to both supported IDs and retain `legacy-auto-v1` as the default. Pass the server value into engine bootstrap/attempt preparation; ignore no client override because strict request schemas reject unknown fields.
- [ ] Dispatch mission advancement by the attempt's stored mode. Legacy continues synchronously. Readiness advancement either returns a terminal result or creates/returns one durable window; polling reads status and applies a completed batch with compare-and-swap semantics.
- [ ] Keep player controls mode-neutral: **Continue battle**, pending-decision status, resolved factual trace, and extraction/retreat actions. Add no mode selector, provider selector, or manual hero action form. An internal dev-only diagnostic label may display the stored mode and window hashes.
- [ ] Add route tests proving client `combatMode` fields are rejected, changing server config cannot alter an active attempt, and a new attempt receives the new configured mode.
- [ ] Verify the full web/database slice:

```bash
pnpm --filter @summonlab/config test
pnpm --filter @summonlab/web test -- src/routes/api/runs/[runId]/mission/server.spec.ts
pnpm --filter @summonlab/web test -- src/routes/api/runs/[runId]/combat-windows/[windowId]/server.integration.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web build
```

- [ ] Commit:

```bash
git add packages/config packages/database/src/proof.ts apps/web
git commit -m "feat(web): expose operator-bound readiness combat"
```

### Task 10: Extend replay and balance gates before mode promotion

**Files:**

- Modify: `packages/engine/src/compatibility/replay-vectors.ts`
- Modify: `packages/engine/src/compatibility/replay-vectors.spec.ts`
- Modify: `tools/combat-balance-harness.ts`
- Modify: `tools/combat-balance-harness.spec.ts`
- Create: `docs/evidence/agent-readiness-v1.json`
- Modify: `docs/wiki/systems/summoning-progression-combat.md`
- Modify: `docs/decisions/0072-four-attributes-and-operator-owned-combat-modes.md`
- Modify: `docs/superpowers/specs/2026-09-06-attributes-and-combat-modes-design.md`

- [ ] Add a replay vector containing at least two same-tick windows, one movement collision, one retarget/cancel fallback, a miss, a critical, a downed/recovered hero, and a terminal common result. Replay solely from recorded batches and assert exact hashes.
- [ ] Extend the balance harness with action cadence distributions, same-window frequency, collision rate, no-progress rate, passive-regeneration duration, provider fallback rate, and deterministic cross-run equality. Keep existing accuracy/armor/off-affinity gates.
- [ ] Generate `agent-readiness-v1.json` from at least 10,000 deterministic trials per benchmark and 100 simulated complete encounters per archetype. Include rules/content hashes, seeds, p50/p95 tick/event counts, and safety-stop count.
- [ ] Gate promotion on: zero nondeterministic replays, zero unclassified cancellations, zero passive-regeneration stalemates, zero safety stops in the benchmark set, p95 complete encounter under the configured tick/event budgets, and 100% provider failures resolving through legal deterministic fallbacks.
- [ ] Update the wiki and ADR to mark readiness as implemented but operator-controlled. Keep `legacy-auto-v1` documented as the release default until a separate operator configuration change is deliberately deployed.
- [ ] Verify all gates:

```bash
pnpm export:combat-balance
pnpm validate:combat-balance
pnpm validate:wiki
pnpm test:integration
pnpm check
git status --short
```

- [ ] Run both operator configurations on `0.0.0.0`, play the same mission seed in each, and verify mode-specific traces produce the same outer claim schema:

```bash
HOST=0.0.0.0 COMBAT_MODE=legacy-auto-v1 pnpm dev
HOST=0.0.0.0 COMBAT_MODE=agent-readiness-v1 pnpm dev
```

- [ ] Commit evidence and documentation, then push the branch according to `AGENTS.md`:

```bash
git add packages/engine/src/compatibility tools docs/evidence/agent-readiness-v1.json docs/wiki/systems/summoning-progression-combat.md docs/decisions/0072-four-attributes-and-operator-owned-combat-modes.md docs/superpowers/specs/2026-09-06-attributes-and-combat-modes-design.md
git commit -m "test(combat): qualify agent readiness mode"
```
