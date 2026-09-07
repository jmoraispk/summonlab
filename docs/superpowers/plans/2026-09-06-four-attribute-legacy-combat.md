# Four-Attribute Legacy Combat Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the canonical Might/Vitality/Agility/Spirit character model and operator-selected `legacy-auto-v1` combat as a beta-safe `engine-v25`, while preserving every historical v24 replay byte-for-byte.

**Architecture:** Add versioned v2 character capability contracts beside the legacy mind schema, persist them independently, and materialize an operator-owned combat-mode binding on every new mission attempt. The existing round resolver remains frozen behind a legacy adapter; new four-attribute heroes enter it only through an explicit compatibility projection. Shared combat math is introduced as pure, parameterized functions and promoted only after a deterministic balance harness passes.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, event-sourced `@summonlab/engine`, PostgreSQL via `postgres`, SvelteKit, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-attributes-and-combat-modes-design.md`

## Global constraints

- Preserve all v1 character, proof, mission, event, and `engine-v1` through `engine-v24` schemas and hashes.
- New contracts are additive: `CharacterMindV2`, `CharacterCapabilityProfileV1`, `MissionRunStateV9`, and `EngineGameStateV25`.
- `legacy-auto-v1` is the only deployable value accepted by release configuration in this phase. The cross-phase `CombatModeIdSchema` may also know `agent-readiness-v1`, but the config parser must reject it until the second plan lands.
- Players may advance automatic combat, but they cannot submit a combat mode, per-hero action, target, or policy.
- Store intrinsic attributes separately from effective action-scoped modifiers.
- No base attribute grants mitigation, accuracy, critical chance, morale, control duration, mental resistance, or learning quality.
- Use `apply_patch` for edits. After every task, run its focused tests and make the listed commit. Do not amend historical commits.

---

### Task 1: Freeze v24 and current combat behavior

**Files:**

- Modify: `packages/engine/src/compatibility/replay-vectors.ts`
- Modify: `packages/engine/src/compatibility/replay-vectors.spec.ts`
- Modify: `packages/engine/src/domains/mission/mission-runtime.spec.ts`
- Modify: `packages/contracts/src/engine-compatibility.spec.ts`

- [ ] Add a replay vector that initializes the current equipment-enabled v24 state, prepares and deploys a mission, resolves two rounds, and records the exact event hashes, state hashes, entropy cursor, initiative order, effects, and outcome.
- [ ] Add characterization tests for two same-round conflicts: two actors recover the same objective, and two actors move through the same mission edge. Assert the current `applied`/`superseded` evidence without changing it.
- [ ] Assert legacy public schemas continue to parse the frozen vector and that the public export snapshot remains unchanged.
- [ ] Run the characterization tests before refactoring:

```bash
pnpm --filter @summonlab/engine test -- compatibility/replay-vectors.spec.ts domains/mission/mission-runtime.spec.ts
pnpm --filter @summonlab/contracts test -- engine-compatibility.spec.ts
```

- [ ] Commit the frozen baseline:

```bash
git add packages/engine/src/compatibility packages/engine/src/domains/mission/mission-runtime.spec.ts packages/contracts/src/engine-compatibility.spec.ts
git commit -m "test(combat): freeze legacy automatic resolution"
```

### Task 2: Add versioned character capability contracts

**Files:**

- Create: `packages/contracts/src/capability.ts`
- Create: `packages/contracts/src/capability.spec.ts`
- Modify: `packages/contracts/src/character.ts`
- Modify: `packages/contracts/src/proof.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`

- [ ] Write failing contract tests for strict parsing, score bounds, old-schema compatibility, and hidden-learning serialization.
- [ ] Define the new public primitives:

```ts
export const CombatAttributeNameSchema = z.enum(['might', 'vitality', 'agility', 'spirit']);
export const CombatAttributesSchema = z.object({
	might: z.number().int().min(1).max(100),
	vitality: z.number().int().min(1).max(100),
	agility: z.number().int().min(1).max(100),
	spirit: z.number().int().min(1).max(100)
}).strict();
export const LearningDomainSchema = z.enum([
	'martial', 'magical', 'crafting', 'survival', 'social'
]);
export const CharacterLearningProfileSchema = z.object({
	cognitiveLearningScore: z.number().int().min(0).max(100),
	domainAptitudes: z.record(LearningDomainSchema, z.number().int().min(0).max(100))
}).strict();
export const CharacterCapabilityProfileV1Schema = z.object({
	profileVersion: z.literal('character-capability-v1'),
	attributes: CombatAttributesSchema,
	learning: CharacterLearningProfileSchema
}).strict();
```

- [ ] Add `CharacterMindV2Schema = CharacterMindSchema.omit({ aptitudes: true })`, plus `CharacterDraftV2Schema` with `mind: CharacterMindV2Schema` and `capabilityProfile: CharacterCapabilityProfileV1Schema`. Keep the current schemas and types exported as legacy-compatible names.
- [ ] Add `ProofRunSnapshotV2Schema` as a discriminated internal v2 proof record with the capability profile, plus `PublicProofRunSnapshotV2Schema` exposing attributes but omitting `learning`; keep `ProofRunSnapshotSchema` parsing existing rows. Do not add capability data to `ProofRunCreateRequestSchema` because clients do not choose generated attributes or learning factors.
- [ ] Export the new schemas/types and extend the root contract tests to exercise the public import path.
- [ ] Verify the focused contracts:

```bash
pnpm --filter @summonlab/contracts test -- capability.spec.ts contracts.spec.ts engine-compatibility.spec.ts
pnpm --filter @summonlab/contracts typecheck
```

- [ ] Commit:

```bash
git add packages/contracts/src
git commit -m "feat(contracts): add four-attribute capability profile"
```

### Task 3: Generate and persist v2 characters without rewriting legacy rows

**Files:**

- Modify: `packages/characters/src/index.ts`
- Modify: `packages/characters/src/characters.spec.ts`
- Modify: `packages/characters/src/summonable.spec.ts`
- Create: `packages/database/migrations/0018_character_capability_profiles.sql`
- Modify: `packages/database/src/proof.ts`
- Modify: `packages/database/src/proof.integration.spec.ts`
- Modify: `packages/database/src/migration.integration.spec.ts`
- Create: `apps/web/src/lib/server/proof-presentation.ts`
- Create: `apps/web/src/lib/server/proof-presentation.spec.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/+server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/decide/+server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/arrive/+server.ts`
- Modify: `apps/web/src/routes/summon/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/play/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/mission/[runId]/+page.server.ts`

- [ ] Add failing generator tests proving the same recipe produces the same v2 mind/capability profile, all four attributes are `1..100`, all learning scores are `0..100`, and no v2 mind contains `aptitudes`.
- [ ] Generate four combat attributes and the six learning scores from dedicated deterministic recipe labels. Do not derive learning scores from combat attributes. Keep `generateLegacySummonableCharacterDraft()` around the existing v1 algorithm for compatibility fixtures; make `generateSummonableCharacterDraft()` return `CharacterDraftV2`.
- [ ] Add nullable `capability_profile jsonb` and non-null `character_schema_version text default 'character-v1'` columns to `summonlab_proof_runs`. Backfill no synthetic capability data into old rows.
- [ ] Change `CreateProofRunInput` to the v1/v2 draft union. Insert `character-v2` plus `capability_profile` for new drafts, and parse old rows with `ProofRunSnapshotSchema` and new rows with `ProofRunSnapshotV2Schema`.
- [ ] Add `PublicProofRunSnapshotV2Schema` and one server projection that exposes the four visible attributes but omits the entire learning profile. Apply it to every proof API/page boundary; keep the full profile available only to trusted engine/worker code.
- [ ] Verify migration and round-trip behavior:

```bash
pnpm --filter @summonlab/characters test
pnpm --filter @summonlab/database test:integration -- migration.integration.spec.ts proof.integration.spec.ts
pnpm --filter @summonlab/web test -- src/lib/server/proof-presentation.spec.ts
pnpm --filter @summonlab/database typecheck
```

- [ ] Commit:

```bash
git add packages/characters packages/database apps/web/src/lib/server/proof-presentation.ts apps/web/src/lib/server/proof-presentation.spec.ts apps/web/src/routes/api/runs apps/web/src/routes/summon apps/web/src/routes/play apps/web/src/routes/mission
git commit -m "feat(characters): persist versioned capability profiles"
```

### Task 4: Introduce `engine-v25` capability state and deterministic bootstrap migration

**Files:**

- Modify: `packages/contracts/src/engine/base-state.ts`
- Modify: `packages/contracts/src/engine/settlement-state.ts`
- Modify: `packages/contracts/src/engine/game-state.ts`
- Modify: `packages/contracts/src/engine/index.ts`
- Modify: `packages/contracts/src/engine-public-api.snapshot.ts`
- Modify: `packages/contracts/src/engine-compatibility.spec.ts`
- Modify: `packages/engine/src/core/types.ts`
- Modify: `packages/engine/src/core/versions.ts`
- Modify: `packages/engine/src/core/state.ts`
- Modify: `packages/engine/src/orchestration/bootstrap.ts`
- Modify: `packages/engine/src/engine.spec.ts`
- Modify: `packages/engine/src/compatibility/public-api.snapshot.ts`

- [ ] First write tests asserting `EngineGameStateV24Schema` still accepts the frozen replay, while v25 requires every hero to have `capabilityProfile` and never reads `mind.aptitudes` for canonical mechanics.
- [ ] Add `EngineHeroStateV25Schema` by extending v24 with `capabilityProfile`, and add `EngineGameStateV25Schema`/types/unions. Add `CAPABILITY_ENGINE_CONTENT_VERSION = 'engine-v25'` and extend only the API/version lists that v25 actually supports.
- [ ] Change bootstrap input to accept the v1/v2 draft union. New web runs bootstrap directly as v25 from the v2 capability profile. Compatibility fixtures may still request their explicit older development version.
- [ ] Implement the only allowed bootstrap conversion for explicitly migrated v1 fixtures:

```ts
export function capabilityProfileFromLegacyMind(mind: CharacterMind): CharacterCapabilityProfileV1 {
	return {
		profileVersion: 'character-capability-v1',
		attributes: {
			might: mind.aptitudes.might * 10,
			vitality: mind.aptitudes.resolve * 10,
			agility: mind.aptitudes.finesse * 10,
			spirit: mind.aptitudes.insight * 10
		},
		learning: deterministicLegacyLearningProfile(mind)
	};
}
```

- [ ] Mark this conversion as a bootstrap compatibility boundary, never an event-history rewrite. Derive its learning scores deterministically from canonical JSON plus named hash purposes, not from combat attributes.
- [ ] Update engine and contracts public snapshots, then verify:

```bash
pnpm --filter @summonlab/contracts test -- engine-compatibility.spec.ts
pnpm --filter @summonlab/engine test -- engine.spec.ts compatibility/replay-vectors.spec.ts
pnpm --filter @summonlab/contracts typecheck
pnpm --filter @summonlab/engine typecheck
```

- [ ] Commit:

```bash
git add packages/contracts packages/engine
git commit -m "feat(engine): add v25 capability state"
```

### Task 5: Add scoped attribute, learning, defense, and regeneration math

**Files:**

- Create: `packages/contracts/src/combat-rules.ts`
- Create: `packages/contracts/src/combat-rules.spec.ts`
- Create: `packages/content/src/combat-rules.ts`
- Create: `packages/content/src/combat-rules.spec.ts`
- Create: `packages/engine/src/domains/combat/capability.ts`
- Create: `packages/engine/src/domains/combat/capability.spec.ts`
- Modify: `packages/contracts/src/engine/settlement-state.ts`
- Modify: `packages/contracts/src/engine/game-state.ts`
- Modify: `packages/engine/src/orchestration/bootstrap.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/content/src/index.ts`
- Modify: `packages/engine/src/index.ts`

- [ ] Add tests for intrinsic/effective separation, typed modifier scope, stacking order, Might-only physical scaling, Spirit-only magical scaling, Vitality Health and regeneration, armor-only general mitigation, named resistance caps, and the bounded cognitive factor.
- [ ] Define `AttributeModifier`, `ResistanceTag`, `DamageTag`, `CombatRulesV1`, and typed source receipts. Use basis points and integers in authoritative math.
- [ ] Publish `combat-rules-v1` from content with these first harness candidates: base Health `100`, Health per Vitality `4`, base Mana `40`, Mana per Spirit `2`, combat Health regeneration delay `50` ticks, combat recovery at one-fifth safe-rest recovery, armor curve constant `100`, resistance cap `7500` basis points, cognitive factor from `9000..11000` basis points, and affinity contribution nudge capped at `1000` basis points.
- [ ] Implement pure functions with explicit rules input:

```ts
intrinsicAttributes(profile, permanentReceipts): CombatAttributes
effectiveAttribute(intrinsic, modifiers, scope, rules): number
maximumHealth(vitality, rules): number
healthRegeneration(vitality, context, rules): number
maximumMana(spirit, rules): number
manaRegeneration(spirit, context, rules): number
armorReduction(armor, penetration, rules): number
namedResistanceReduction(tags, resistances, rules): number
learningGain(evidence, profile, context, rules): LearningGainReceipt
```

- [ ] Ensure natural regeneration returns zero while downed, during the post-hit delay, and for injury repair. Ensure `learningGain` applies the cognitive factor only to `comprehensionHeavy: true` evidence and does not expose it through player presentation contracts.
- [ ] Extend only v25 heroes with `mana`/`maxMana`, widen the v25 Health bounds, and initialize both resource maxima through these pure functions. Keep v1-v24 Health schemas and replay values untouched.
- [ ] Verify:

```bash
pnpm --filter @summonlab/contracts test -- combat-rules.spec.ts
pnpm --filter @summonlab/content test -- combat-rules.spec.ts
pnpm --filter @summonlab/engine test -- domains/combat/capability.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] Commit:

```bash
git add packages/contracts packages/content packages/engine
git commit -m "feat(combat): add scoped four-attribute math"
```

### Task 6: Add one-point intrinsic attribute growth and typed receipts

**Files:**

- Modify: `packages/contracts/src/engine/base-state.ts`
- Modify: `packages/contracts/src/engine/commands.ts`
- Modify: `packages/contracts/src/event.ts`
- Modify: `packages/engine/src/domains/settlement/commands.ts`
- Modify: `packages/engine/src/domains/settlement/reducer.ts`
- Modify: `packages/engine/src/domains/settlement/routines.ts`
- Create: `packages/engine/src/domains/settlement/progression.spec.ts`

- [ ] Write failing tests for level-up point grants, single-point allocation, intrinsic growth receipts, stale commands, insufficient points, invalid attributes, and action-scoped temporary modifiers that must not alter intrinsic values.
- [ ] Extend v25 progression with `unspentAttributePoints` and append-only `attributeGrowthReceipts`. A transition from level `L` to `L+n` grants exactly `n` points. Bootstrap at level 1 grants zero unspent points.
- [ ] Add `hero.allocate.attribute` with one `CombatAttributeName`, and emit one receipt containing receipt ID, hero ID, attribute, before/after intrinsic values, spent points, source level, rules version, command ID, and game time.
- [ ] Reject allocation while the hero is terminal and clamp no hidden bonus into the receipt. Equipment/food/status modifiers remain separate scoped sources and never consume points.
- [ ] Keep historical progression schemas unchanged. Do not manufacture old six-stat allocation receipts because no such authoritative persisted allocation exists in v1-v24.
- [ ] Verify:

```bash
pnpm --filter @summonlab/contracts test -- engine-compatibility.spec.ts
pnpm --filter @summonlab/engine test -- domains/settlement/progression.spec.ts domains/settlement/settlement-domain.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] Commit:

```bash
git add packages/contracts/src/engine packages/contracts/src/event.ts packages/engine/src/domains/settlement
git commit -m "feat(progression): add intrinsic attribute allocation"
```

### Task 7: Version skill delivery, mastery, armor training, and named resistances

**Files:**

- Create: `packages/contracts/src/combat-skill.ts`
- Modify: `packages/contracts/src/equipment.ts`
- Create: `packages/contracts/src/combat-loadout.spec.ts`
- Create: `packages/content/src/combat-skills.ts`
- Modify: `packages/content/src/equipment.ts`
- Modify: `packages/content/src/equipment.spec.ts`
- Modify: `packages/content/src/index.ts`
- Create: `packages/engine/src/domains/combat/legal-actions.ts`
- Create: `packages/engine/src/domains/combat/legal-actions.spec.ts`

- [ ] Add failing tests that reject an attack unless equipped-family tags intersect both the skill's delivery tags and the hero's trained tags. Test related-family familiarization explicitly rather than accepting a specific item instance.
- [ ] Add `EquipmentFamilyTagSchema` (`unarmed`, `one-handed-blade`, `two-handed-blade`, `bow`, `staff-focus`, `shield`), per-skill mastery, trained delivery tags, authored accuracy/reliability progression, and optional refinement unlocks.
- [ ] Add equipment load, Might load tolerance, explicit heavy-item Might requirements, and `armor-training` proficiency. Do not add Vitality requirements.
- [ ] Add named `cut`, `pierce`, `impact`, `burn`, `frost`, `shock`, and `arcane` resistance grants to equipment/passive skills/physiology records. Do not add a universal poise field. Permit only explicitly authored `breakMeter` mechanics on content that owns them.
- [ ] Adapt the current sword and bow runtime records to the new tags while keeping all old catalog IDs stable.
- [ ] Verify:

```bash
pnpm --filter @summonlab/contracts test -- combat-loadout.spec.ts
pnpm --filter @summonlab/content test -- equipment.spec.ts
pnpm --filter @summonlab/engine test -- domains/combat/legal-actions.spec.ts
pnpm validate:equipment-content-bindings
```

- [ ] Commit:

```bash
git add packages/contracts packages/content packages/engine
git commit -m "feat(combat): bind skills to trained equipment families"
```

### Task 8: Bind `legacy-auto-v1` to attempts and remove player combat choices

**Files:**

- Modify: `packages/contracts/src/engine/mission-state.ts`
- Modify: `packages/contracts/src/engine/commands.ts`
- Modify: `packages/contracts/src/proof.ts`
- Modify: `packages/config/src/index.ts`
- Modify: `packages/config/src/config.spec.ts`
- Create: `packages/engine/src/domains/mission/combat-mode.ts`
- Create: `packages/engine/src/domains/mission/legacy-auto.ts`
- Create: `packages/engine/src/domains/mission/legacy-auto.spec.ts`
- Modify: `packages/engine/src/domains/mission/actions.ts`
- Modify: `packages/engine/src/domains/mission/commands.ts`
- Modify: `packages/engine/src/domains/mission/reducer.ts`
- Modify: `apps/web/src/routes/api/runs/+server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/mission/+server.ts`
- Modify: `apps/web/src/routes/mission/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/mission/[runId]/+page.svelte`
- Create: `apps/web/src/routes/api/runs/[runId]/mission/server.spec.ts`

- [ ] Add `CombatModeIdSchema = z.enum(['legacy-auto-v1', 'agent-readiness-v1'])` and `CombatModeBindingSchema` containing mode ID, rules version, content hash, and bound timestamp. Add the binding to `MissionAttemptV9Schema`; validate that it cannot change after preparation.
- [ ] Add `COMBAT_MODE` to config, but in this phase parse only `legacy-auto-v1` and default to it. Expose it as `config.combatMode`; never add it to `ProofRunCreateRequestSchema` or `MissionLifecycleRequestSchema`.
- [ ] Replace client-supplied `masterActionId` resolution for v25 with `advance-automatic-combat`. The route reads the attempt binding and dispatches internally. Keep old schema-version routes working for historical development fixtures.
- [ ] Implement `legacyCapabilityProjection()` exactly as `{ might: Might, finesse: Agility, insight: Spirit, resolve: Vitality }`, scaled back from `1..100` to the legacy `1..10` range with integer half-up rounding and clamping. Feed the projection only to a frozen copy/adapter of the existing resolver.
- [ ] Use a seeded random policy for every autonomous party choice, record policy ID and hashes, and retain the existing resolver's sequential entropy semantics and 48-round safety behavior. A player may press **Continue battle**, but cannot choose actors' actions or the combat mode.
- [ ] Assert request bodies containing `combatMode`, `masterActionId`, `choices`, `targetId`, or `policy` are rejected by strict schemas for v25. Assert changing `COMBAT_MODE` after attempt creation cannot change its binding.
- [ ] Verify legacy parity, config ownership, and UI behavior:

```bash
pnpm --filter @summonlab/config test
pnpm --filter @summonlab/engine test -- domains/mission/legacy-auto.spec.ts compatibility/replay-vectors.spec.ts
pnpm --filter @summonlab/web test -- src/routes/api/runs/[runId]/mission/server.spec.ts
pnpm --filter @summonlab/web typecheck
```

- [ ] Commit:

```bash
git add packages/contracts packages/config packages/engine apps/web
git commit -m "feat(combat): make legacy mode operator controlled"
```

### Task 9: Build and enforce the mechanics balance harness

**Files:**

- Create: `tools/combat-balance-harness.ts`
- Create: `tools/combat-balance-harness.spec.ts`
- Create: `docs/evidence/combat-balance-v1.json`
- Modify: `package.json`

- [ ] Write failing invariant tests for levels 10, 40, 70, and 99 across low/mid/high attribute spreads and Fire-caster, Water-martial, armored, unarmored, novice, trained, and mastered fixtures.
- [ ] Simulate at least 10,000 seeded trials per matchup. Emit rates and percentile bands, not only averages.
- [ ] Enforce these promotion gates: novice peer hit rate `65..70%`, trained peer `77..83%`, mastered peer `90..95%`; relative Agility changes peer hit chance by at most 10 percentage points; passive combat regeneration never matches sustained peer damage; off-affinity archetypes remain within 15% median completion time of their matched-affinity controls; armor reduction is monotonic and remains below 75% without an explicit resistance.
- [ ] Add `pnpm export:combat-balance` (`--write`) and `pnpm validate:combat-balance` (`--check`). Generate the committed evidence JSON with rules/content hashes and seed set.
- [ ] Run twice and confirm the second run is byte-identical:

```bash
pnpm export:combat-balance
pnpm validate:combat-balance
pnpm vitest run tools/combat-balance-harness.spec.ts
```

- [ ] Commit:

```bash
git add tools/combat-balance-harness.ts tools/combat-balance-harness.spec.ts docs/evidence/combat-balance-v1.json package.json
git commit -m "test(combat): gate four-attribute balance"
```

### Task 10: Replace the wiki mechanics and record the architecture decision

**Files:**

- Modify: `docs/wiki/mechanics/attributes.md`
- Modify: `docs/wiki/mechanics/progression/attributes-and-training.md`
- Modify: `docs/wiki/mechanics/progression/affinities.md`
- Modify: `docs/wiki/mechanics/affinities/README.md`
- Modify: `docs/wiki/mechanics/affinities/fire.md`
- Modify: `docs/wiki/mechanics/affinities/earth.md`
- Modify: `docs/wiki/mechanics/affinities/wind.md`
- Modify: `docs/wiki/mechanics/affinities/water.md`
- Modify: `docs/wiki/mechanics/skills/framework.md`
- Modify: `docs/wiki/mechanics/equipment/README.md`
- Modify: `docs/wiki/mechanics/equipment/armor-and-shields.md`
- Modify: `docs/wiki/mechanics/equipment/rarity-and-weight.md`
- Modify: `docs/wiki/mechanics/equipment/weapons.md`
- Modify: `docs/wiki/systems/summoning-progression-combat.md`
- Create: `docs/decisions/0072-four-attributes-and-operator-owned-combat-modes.md`
- Modify: `docs/superpowers/specs/2026-09-06-attributes-and-combat-modes-design.md`

- [ ] Replace six-stat language with the four-column ownership table and intrinsic/effective distinction. Explicitly remove Dexterity, Intellect, universal poise, attribute mitigation, Spirit morale/control/learning, and Vitality armor requirements.
- [ ] Document Health/Mana regeneration safeguards, hidden bounded cognitive learning, domain aptitudes, one point per level as the initial new-growth rule, the four affinity nudges, per-skill mastery, delivery tags, armor training, and named resistances.
- [ ] Document that `legacy-auto-v1` is operator-selected, beta-default, attempt-locked, automatic, and not player-visible. Link the second implementation plan for `agent-readiness-v1` rather than documenting it as shipped.
- [ ] Add ADR 0072 with context, decision, compatibility projection, release ownership, replay consequences, and superseded wiki statements. Change the design spec status to `accepted; implementation planned` and link both plan files.
- [ ] Validate links, terminology, and generated catalogs:

```bash
rg -n "Dexterity|Intellect|universal poise|player.*combat mode" docs/wiki docs/decisions/0072-four-attributes-and-operator-owned-combat-modes.md
pnpm validate:wiki
pnpm validate:combat-balance
pnpm --filter @summonlab/contracts test
pnpm --filter @summonlab/engine test
pnpm --filter @summonlab/web test
pnpm format:check
pnpm lint
pnpm typecheck
```

- [ ] Commit:

```bash
git add docs/wiki docs/decisions/0072-four-attributes-and-operator-owned-combat-modes.md docs/superpowers/specs/2026-09-06-attributes-and-combat-modes-design.md
git commit -m "docs(mechanics): publish four-attribute combat rules"
```

### Task 11: Verify the beta-safe foundation end to end

**Files:**

- Modify only if evidence changes: `docs/evidence/combat-balance-v1.json`

- [ ] Start PostgreSQL, migrate a fresh database, and run integration tests:

```bash
pnpm db:start
pnpm db:migrate
pnpm test:integration
```

- [ ] Run the full repository gate:

```bash
pnpm check
git status --short
```

- [ ] Launch the beta-default slice on the required interface:

```bash
HOST=0.0.0.0 COMBAT_MODE=legacy-auto-v1 pnpm dev
```

- [ ] Play through: summon a new v2 hero; inspect the four visible attributes with no IQ number; prepare and deploy a mission; press **Continue battle** several times; verify no combat-mode or per-action selector exists; reload mid-attempt and verify the bound mode and replay trace are unchanged.
- [ ] Confirm database evidence contains `character-v2`, `character-capability-v1`, `engine-v25`, and `legacy-auto-v1`, while the frozen v24 replay retains its prior hashes.
- [ ] Stop the development stack, confirm a clean tree, and push the completed branch according to `AGENTS.md`.
