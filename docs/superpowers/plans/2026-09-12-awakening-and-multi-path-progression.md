# Awakening and Multi-Path Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship immutable-star level growth, levels 1–999, versioned awakening conversion tables, intrinsic attribute growth, and shared hero experience from combat and completed crafting as `engine-v27`.

**Architecture:** Build a versioned progression owner on the completed four-attribute and readiness-combat `engine-v26` foundation. Pure functions consume an injected, content-hashed `progression-rules-v1` table; domain adapters turn training, synthesis, legacy-combat, readiness-combat, and production evidence into one typed experience-claim contract, while the event log retains every before/after receipt.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, event-sourced `@summonlab/engine`, SvelteKit, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-12-awakening-and-multi-path-progression-design.md`

**Prerequisite:** Complete and verify both `docs/superpowers/plans/2026-09-06-four-attribute-legacy-combat.md` and `docs/superpowers/plans/2026-09-06-agent-readiness-combat.md`. The implementation branch already contains both prerequisites as `engine-v25` and `engine-v26`.

## Global Constraints

- Preserve every `engine-v1` through `engine-v26` schema, state hash, event hash, content binding, and replay result, except for the accepted canonical-name correction applied before these unreleased versions are integrated.
- New heroes use `engine-v27`; existing runs continue under the engine and progression rules they already bind.
- Hero level is an integer from `1` through `999`; awakening tier is exactly `Math.floor(level / 100)` and therefore `0..9`.
- `stars` remains an integer from `1` through `7`, is immutable after generation, and grants exactly `stars` unallocated attribute points for every crossed level after level 1.
- The canonical compact attribute order is `STR`, `AGI`, `VIT`, `MAG`; full names remain canonical in prose and accessible labels.
- Power rates are `[1.0, 1.2, 1.4, 1.8, 2.2, 2.6, 3.2, 3.8, 4.4, 5.0]`; Health-per-Vitality rates are `[5, 6, 7, 9, 11, 13, 16, 19, 22, 25]`.
- Attribute rate calculations use fixed-point integers. Floating-point results never enter authoritative state, receipts, hashes, or replay.
- Awakening applies to all applicable intrinsic attribute points regardless of when or how they were earned. It does not multiply ratio statistics, flat equipment values, skill mastery, craft quality, XP, or authored flat effects.
- Combat and Crafting are the two initial macro-path identifiers. Path selection or generation remains deferred; neither path gates valid experience from the other.
- Hero XP and skill practice remain separate. Completed crafting can grant both, but one never substitutes for the other.
- Final XP quantities are calibration data rather than schema. A later buff or nerf creates a new content-hashed rules table and leaves earlier receipts replayable.
- Use `apply_patch` for edits. Run each task's focused red/green tests and create the listed Conventional Commit before starting the next task.

---

### Task 0: Correct the unreleased four-attribute names

**Files:**

- Modify: `packages/contracts/src/capability.ts`
- Modify: `packages/contracts/src/capability.spec.ts`
- Modify: `packages/content/src/combat-rules.ts`
- Modify: `packages/content/src/combat-rules.spec.ts`
- Modify: `packages/engine/src/domains/capability`
- Modify: `packages/engine/src/domains/combat`
- Modify: `packages/engine/src/domains/readiness-combat`
- Modify: affected engine, compatibility, replay, presentation, and fixture tests

**Interfaces:**

- Consumes: the implemented but not yet integrated `engine-v25`/`engine-v26` four-attribute contracts.
- Produces: canonical `strength`, `agility`, `vitality`, `magic` fields and `STR`, `AGI`, `VIT`, `MAG` presentation without preserving the rejected Might/Spirit vocabulary in v25/v26.

- [x] **Step 1: Write failing canonical-name tests**

Assert v25 and v26 accept only Strength/Agility/Vitality/Magic fields, canonical display order is `STR`, `AGI`, `VIT`, `MAG`, physical power reads Strength, magical power and Mana read Magic, and v1-v24 historical mind schemas remain byte-stable.

- [x] **Step 2: Run focused tests and verify red**

```bash
pnpm --filter @summonlab/contracts test -- capability.spec.ts engine-compatibility.spec.ts
pnpm --filter @summonlab/content test -- combat-rules.spec.ts
pnpm --filter @summonlab/engine test -- domains/capability domains/combat domains/readiness-combat compatibility/replay-vectors.spec.ts
```

Expected: FAIL because the unreleased v25/v26 implementation still exposes Might and Spirit.

- [x] **Step 3: Rename the canonical v25/v26 contract and consumers**

Replace only the v25/v26 capability vocabulary and derived rule names. Keep historical v1-v24 `CharacterMind` fields untouched. Update fixtures and regenerate affected v25/v26 snapshots or replay evidence; do not introduce alias fields or a second canonical order.

- [x] **Step 4: Run focused verification**

```bash
pnpm --filter @summonlab/contracts test -- capability.spec.ts engine-compatibility.spec.ts
pnpm --filter @summonlab/content test -- combat-rules.spec.ts
pnpm --filter @summonlab/engine test -- domains/capability domains/combat domains/readiness-combat compatibility/replay-vectors.spec.ts
pnpm --filter @summonlab/contracts typecheck
pnpm --filter @summonlab/content typecheck
pnpm --filter @summonlab/engine typecheck
```

- [x] **Step 5: Commit (`d35ce016a`)**

```bash
git add packages/contracts packages/content packages/engine
git commit -m "refactor(attributes): adopt strength and magic names"
```

---

### Task 1: Define strict progression contracts

**Files:**

- Create: `packages/contracts/src/progression.ts`
- Create: `packages/contracts/src/progression.spec.ts`
- Modify: `packages/contracts/src/engine/base-state.ts:86-114`
- Modify: `packages/contracts/src/engine/index.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`

**Interfaces:**

- Consumes: `CombatAttributeNameSchema`, `CombatAttributesSchema`, and `SkillProgressSchema` from the completed v26 foundation after Task 0.
- Produces: `HeroProgressionV2Schema`, `ProgressionRulesBindingSchema`, `ExperienceClaimSchema`, `ExperienceReceiptSchema`, `AttributeGrowthClaimSchema`, and `AttributeGrowthReceiptV2Schema` for every later task. The v2 suffix avoids colliding with the replay-bound v25 `AttributeGrowthReceiptSchema`.

- [x] **Step 1: Write failing strict-schema tests**

Cover level boundaries `1`, `999`, `0`, and `1000`; star boundaries `1` and `7`; all source discriminators; zero/negative claim rejection; and rejection of unknown keys.

```ts
it('accepts immutable-star v2 progression through level 999', () => {
	const parsed = HeroProgressionV2Schema.parse({
		progressionVersion: 'hero-progression-v2',
		stars: 7,
		level: 999,
		experience: 9_980,
		unallocatedAttributePoints: 6_986,
		permanentGrowth: { strength: 0, agility: 0, vitality: 0, magic: 0 },
		evidenceCounts: { combat: {}, crafting: {} },
		skills: { swordFighting: { rank: 0, experience: 0 } }
	});
	expect(parsed.level).toBe(999);
	expect(() => HeroProgressionV2Schema.parse({ ...parsed, level: 1000 })).toThrow();
});
```

- [x] **Step 2: Run the contract test and verify red**

Run: `pnpm --filter @summonlab/contracts test -- progression.spec.ts`

Expected: FAIL because `packages/contracts/src/progression.ts` and its schemas do not exist.

- [x] **Step 3: Implement the contract module**

Define the public shapes exactly as follows, reusing the shared UUID, datetime, hash, attribute, and skill schemas rather than duplicating them:

```ts
export const ProgressionMacroPathSchema = z.enum(['combat', 'crafting']);
export const ExperienceSourceKindSchema = z.enum([
	'combat',
	'crafting',
	'training',
	'synthesis',
	'authored'
]);
export const PermanentAttributeGrowthSchema = z.object({
	strength: z.number().int().nonnegative(),
	agility: z.number().int().nonnegative(),
	vitality: z.number().int().nonnegative(),
	magic: z.number().int().nonnegative()
}).strict();
export const HeroProgressionV2Schema = z.object({
	progressionVersion: z.literal('hero-progression-v2'),
	stars: z.number().int().min(1).max(7),
	level: z.number().int().min(1).max(999),
	experience: z.number().int().nonnegative(),
	unallocatedAttributePoints: z.number().int().nonnegative(),
	permanentGrowth: PermanentAttributeGrowthSchema,
	evidenceCounts: z.object({
		combat: z.record(z.string().min(1).max(160), z.number().int().nonnegative()),
		crafting: z.record(z.string().min(1).max(160), z.number().int().nonnegative())
	}).strict(),
	skills: z.object({ swordFighting: SkillProgressSchema }).strict()
}).strict();

export const ProgressionRulesBindingSchema = z.object({
	rulesVersion: z.literal('progression-rules-v1'),
	contentHash: StateHashSchema
}).strict();

const ExperienceClaimBaseSchema = z.object({
	claimId: EntityIdSchema,
	heroId: EntityIdSchema,
	sourceEventId: EntityIdSchema,
	evidenceKey: z.string().min(1).max(160),
	amount: z.number().int().positive()
});
export const ExperienceClaimSchema = z.discriminatedUnion('sourceKind', [
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('combat') }).strict(),
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('crafting') }).strict(),
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('training') }).strict(),
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('synthesis') }).strict(),
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('authored') }).strict()
]);

const AttributeGrowthClaimBaseSchema = z.object({
	claimId: EntityIdSchema,
	heroId: EntityIdSchema,
	sourceEventId: EntityIdSchema,
	attribute: CombatAttributeNameSchema,
	amount: z.number().int().positive()
});
export const AttributeGrowthClaimSchema = z.discriminatedUnion('sourceKind', [
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('allocation') }).strict(),
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('training') }).strict(),
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('achievement') }).strict(),
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('consumable') }).strict(),
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('cultivation') }).strict()
]);

export const ExperienceReceiptSchema = z.object({
	receiptVersion: z.literal('experience-receipt-v1'),
	receiptId: EntityIdSchema,
	claim: ExperienceClaimSchema,
	rules: ProgressionRulesBindingSchema,
	experienceBefore: z.number().int().nonnegative(),
	experienceAfter: z.number().int().nonnegative(),
	levelBefore: z.number().int().min(1).max(999),
	levelAfter: z.number().int().min(1).max(999),
	levelsCrossed: z.array(z.number().int().min(2).max(999)),
	pointsGranted: z.number().int().nonnegative(),
	occurredAt: IsoDateTimeSchema
}).strict();

export const AttributeGrowthReceiptV2Schema = z.object({
	receiptVersion: z.literal('attribute-growth-receipt-v2'),
	receiptId: EntityIdSchema,
	claim: AttributeGrowthClaimSchema,
	rules: ProgressionRulesBindingSchema,
	intrinsicBefore: z.number().int().nonnegative(),
	intrinsicAfter: z.number().int().positive(),
	pointsSpent: z.number().int().nonnegative(),
	unallocatedBefore: z.number().int().nonnegative(),
	unallocatedAfter: z.number().int().nonnegative(),
	occurredAt: IsoDateTimeSchema
}).strict();
```

Allocation claims spend unallocated points; `training`, `achievement`, `consumable`, and `cultivation` growth claims grant direct permanent points. `ProgressionMacroPathSchema` is exported taxonomy only in v27: do not add a hero macro-path field until the deferred selection/generated/inferred decision has its own accepted design.

- [x] **Step 4: Export v2 without mutating v1**

Keep `HeroProgressionSchema` and all v1-v26 imports unchanged. Export the v2 schema from `engine/index.ts` and the package root, and add its intentional names to the public-contract snapshot test.

- [x] **Step 5: Run focused verification**

```bash
pnpm --filter @summonlab/contracts test -- progression.spec.ts contracts.spec.ts engine-compatibility.spec.ts
pnpm --filter @summonlab/contracts typecheck
```

Expected: all commands exit `0`; legacy compatibility snapshots are unchanged except for additive public exports.

- [x] **Step 6: Commit**

```bash
git add packages/contracts/src
git commit -m "feat(contracts): define versioned hero progression"
```

### Task 2: Publish authored progression rules and fixed-point awakening math

**Files:**

- Create: `packages/content/src/progression-rules.ts`
- Create: `packages/content/src/progression-rules.spec.ts`
- Modify: `packages/content/src/index.ts`
- Create: `packages/engine/src/domains/progression/math.ts`
- Create: `packages/engine/src/domains/progression/math.spec.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**

- Consumes: `ProgressionRulesBindingSchema` and canonical four-attribute types from Task 1 and v26.
- Produces: `PROGRESSION_RULES_V1`, `awakeningTier(level)`, `intrinsicAttributes(profile, growth)`, `attributePowerMilli(attribute, level, rules)`, `maximumHealth(vitality, level, rules)`, `craftExperience(input, rules)`, and `combatExperience(input, rules)`.

- [ ] **Step 1: Write failing table and boundary tests**

```ts
it.each([
	[99, 0, 1_000, 5],
	[100, 1, 1_200, 6],
	[500, 5, 2_600, 13],
	[899, 8, 4_400, 22],
	[900, 9, 5_000, 25],
	[999, 9, 5_000, 25]
])('resolves level %i from the authored table', (level, tier, powerMilli, health) => {
	expect(awakeningTier(level)).toBe(tier);
	expect(PROGRESSION_RULES_V1.powerPerAttributeMilli[tier]).toBe(powerMilli);
	expect(PROGRESSION_RULES_V1.healthPerVitality[tier]).toBe(health);
});
```

Also test that flat gear power and ratio-stat helpers receive no awakening argument, and that changing only a supplied rules table changes the result without changing state shape.

- [ ] **Step 2: Run the math tests and verify red**

Run: `pnpm --filter @summonlab/engine test -- domains/progression/math.spec.ts`

Expected: FAIL because the progression rules and math module do not exist.

- [ ] **Step 3: Add the content-hashed v1 rules artifact**

Store Power as thousandths so `1.2` is `1_200` and Health as whole points. Include the current `10 XP` per level behavior as an initial calibration value, not a schema constant.

```ts
export const PROGRESSION_RULES_V1 = Object.freeze({
	rulesVersion: 'progression-rules-v1' as const,
	levelCap: 999,
	experiencePerLevel: 10,
	powerPerAttributeMilli: [1_000, 1_200, 1_400, 1_800, 2_200, 2_600, 3_200, 3_800, 4_400, 5_000],
	healthPerVitality: [5, 6, 7, 9, 11, 13, 16, 19, 22, 25],
	crafting: {
		difficultyExperience: [4, 6, 9, 13, 18, 25, 35],
		ingredientRarityBps: [10_000, 11_000, 12_000, 13_000, 14_000, 15_000, 16_000],
		qualityBps: { standard: 10_000, fine: 12_500, masterwork: 15_000 },
		firstSuccessBps: 15_000,
		repetitionBps: [10_000, 8_000, 6_500, 5_000, 4_000, 3_000, 2_500],
		minimumExperience: 1
	},
	combat: {
		difficultyExperience: [4, 6, 9, 13, 18, 25, 35],
		objectiveBonus: [1, 2, 3, 5, 7, 10, 14],
		firstClearBps: 15_000,
		repetitionBps: [10_000, 8_000, 6_500, 5_000, 4_000, 3_000, 2_500],
		minimumExperience: 1
	}
});
```

Create the content hash from canonical JSON and export one `ProgressionRulesBinding` containing `progression-rules-v1` and that hash. A future nerf publishes `progression-rules-v2`; it never edits v1 in place.

- [ ] **Step 4: Implement pure fixed-point math**

```ts
export function awakeningTier(level: number): number {
	if (!Number.isInteger(level) || level < 1 || level > 999) throw new RangeError('level');
	return Math.floor(level / 100);
}

export function attributePowerMilli(attribute: number, level: number, rules: ProgressionRules): number {
	return attribute * rules.powerPerAttributeMilli[awakeningTier(level)]!;
}

export function maximumHealth(vitality: number, level: number, rules: ProgressionRules): number {
	return vitality * rules.healthPerVitality[awakeningTier(level)]!;
}
```

Implement `multiplyBasisPoints(value, bps)` with integer half-up rounding. Apply craft factors in the documented order: difficulty base → ingredient rarity → quality → first-success bonus → repetition decay → minimum floor. Apply combat factors as difficulty base plus objective bonus, then first-clear bonus → repetition decay → minimum floor.

- [ ] **Step 5: Prove monotonic and authored-table behavior**

Run property loops across all levels `1..999`, all seven difficulty/rarity bands, and representative intrinsic values. Assert higher difficulty or rarity never decreases an otherwise identical reward and tier 9 contributes exactly five times tier 0.

- [ ] **Step 6: Run focused verification**

```bash
pnpm --filter @summonlab/content test -- progression-rules.spec.ts
pnpm --filter @summonlab/engine test -- domains/progression/math.spec.ts
pnpm --filter @summonlab/content typecheck
pnpm --filter @summonlab/engine typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/content/src packages/engine/src/domains/progression packages/engine/src/index.ts
git commit -m "feat(progression): add authored awakening rules"
```

### Task 3: Add `engine-v27` progression state and bindings

**Files:**

- Modify: `packages/contracts/src/engine/settlement-state.ts`
- Modify: `packages/contracts/src/engine/game-state.ts:826-850,1570-1675`
- Modify: `packages/contracts/src/engine/index.ts`
- Modify: `packages/contracts/src/engine-public-api.snapshot.ts`
- Modify: `packages/contracts/src/engine-compatibility.spec.ts`
- Modify: `packages/engine/src/core/types.ts`
- Modify: `packages/engine/src/core/versions.ts`
- Modify: `packages/engine/src/core/state.ts`
- Modify: `packages/engine/src/orchestration/bootstrap.ts`
- Modify: `packages/engine/src/engine.spec.ts`
- Modify: `packages/engine/src/compatibility/public-api.snapshot.ts`

**Interfaces:**

- Consumes: `HeroProgressionV2Schema` from Task 1 and `PROGRESSION_RULES_V1` binding from Task 2.
- Produces: `EngineHeroStateV27Schema`, `EngineGameStateV27Schema`, `PROGRESSION_ENGINE_CONTENT_VERSION`, and v27 bootstrap state for all domain adapters.

- [ ] **Step 1: Add failing v26/v27 compatibility tests**

Assert the corrected v26 state still parses and hashes identically after Task 0. Assert v27 requires a rules binding and v2 progression, accepts level 999, rejects level 1000, and accepts permanent growth beyond the generated base-attribute range.

- [ ] **Step 2: Run compatibility tests and verify red**

```bash
pnpm --filter @summonlab/contracts test -- engine-compatibility.spec.ts
pnpm --filter @summonlab/engine test -- engine.spec.ts compatibility/replay-vectors.spec.ts
```

Expected: FAIL because v27 is not in the state union.

- [ ] **Step 3: Add additive v27 schemas**

Extend v26 rather than widening any earlier schema:

```ts
export const EngineHeroStateV27Schema = EngineHeroStateV26Schema.extend({
	progression: HeroProgressionV2Schema
}).strict();

export const EngineGameStateV27Schema = EngineGameStateV26BaseSchema.extend({
 schemaVersion: z.literal(27),
	contentVersion: z.literal('engine-v27'),
	heroes: z.record(EntityIdSchema, EngineHeroStateV27Schema),
	progressionRules: ProgressionRulesBindingSchema
}).strict().superRefine(validateV27State);
```

`validateV27State` verifies the bound hash, progression level cap, nonnegative growth, and ordinary v26 ownership invariants. It must not derive or persist awakening tier because the tier is a pure projection from level.

- [ ] **Step 4: Bootstrap new runs as v27**

Initialize each hero with immutable generated stars, level 1, zero experience, zero unallocated points, zero permanent growth, empty evidence counts, and the v1 rules binding. Preserve explicit development-version bootstraps used by replay vectors.

- [ ] **Step 5: Add v27 capability routing**

Add `PROGRESSION_ENGINE_CONTENT_VERSION = 'engine-v27'`, include `27` only in APIs already available to v26, and add `supportsProgressionV2(state): state is EngineGameStateV27`. Do not reinterpret v1-v26 through v2 helpers.

- [ ] **Step 6: Run focused verification**

```bash
pnpm --filter @summonlab/contracts test -- engine-compatibility.spec.ts
pnpm --filter @summonlab/engine test -- engine.spec.ts compatibility/replay-vectors.spec.ts
pnpm --filter @summonlab/contracts typecheck
pnpm --filter @summonlab/engine typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/engine packages/contracts/src/engine-public-api.snapshot.ts packages/engine/src
git commit -m "feat(engine): add v27 progression state"
```

### Task 4: Centralize experience, level crossing, and star point grants

**Files:**

- Create: `packages/engine/src/domains/progression/experience.ts`
- Create: `packages/engine/src/domains/progression/experience.spec.ts`
- Modify: `packages/contracts/src/event.ts`
- Modify: `packages/engine/src/orchestration/event-registry.ts`
- Modify: `packages/engine/src/orchestration/reduction.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**

- Consumes: `ExperienceClaim`, `HeroProgressionV2`, `ProgressionRules`, and capability-profile attributes.
- Produces: `experienceThresholdForLevel(level, rules)`, `applyExperienceClaim(input)`, `hero.experience.applied` payloads, and one reusable progression reducer.

- [ ] **Step 1: Write failing multi-level and immutability tests**

```ts
it('grants stars points for every crossed level', () => {
	const outcome = applyExperienceClaim({
		progression: progression({ stars: 5, level: 99, experience: 980 }),
		claim: claim({ amount: 30 }),
		rules: PROGRESSION_RULES_V1,
		occurredAt: NOW
	});
	expect(outcome.progression).toMatchObject({ level: 102, experience: 1010 });
	expect(outcome.receipt).toMatchObject({ levelsCrossed: [100, 101, 102], pointsGranted: 15 });
	expect(outcome.progression.stars).toBe(5);
});
```

Also test levels `1/99/100/199/200/899/900/999`, one- through seven-star grants, XP at level 999, zero/negative rejection, exact receipt bindings, and identical input producing identical output.

- [ ] **Step 2: Run the experience test and verify red**

Run: `pnpm --filter @summonlab/engine test -- domains/progression/experience.spec.ts`

Expected: FAIL because the experience owner does not exist.

- [ ] **Step 3: Implement one level calculation path**

```ts
export function experienceThresholdForLevel(level: number, rules: ProgressionRules): number {
	return (level - 1) * rules.experiencePerLevel;
}

export function levelForExperience(experience: number, rules: ProgressionRules): number {
	return Math.min(rules.levelCap, 1 + Math.floor(experience / rules.experiencePerLevel));
}
```

`applyExperienceClaim` adds XP, derives the capped level, enumerates every crossed level in ascending order, grants `levelsCrossed.length * progression.stars`, preserves `stars`, and emits one strict receipt. Experience remains monotonic after level 999 even though no further level or points are granted.

- [ ] **Step 4: Reconcile resources without a free refill**

Export `reconcileHealthAfterProgression({ health, oldMaximum, newMaximum })`. It returns unchanged current Health when the maximum rises and `Math.min(health, newMaximum)` when a rules migration lowers it. Level crossing alone never heals.

- [ ] **Step 5: Register the event and reducer**

Add a v27-only `hero.experience.applied` event whose payload contains the claim, receipt, progression before/after, maximum Health before/after, and current Health after reconciliation. During replay, recompute the outcome from the bound v1 rules and reject any payload mismatch with `ReplayIntegrityError`.

- [ ] **Step 6: Prove there is no star mutation path**

Add a test that enumerates the command registry and progression reducers, applies every progression command to a fixture, and asserts `after.progression.stars === before.progression.stars`. Search production code for assignment to `.stars` outside bootstrap and compatibility projections.

- [ ] **Step 7: Run focused verification**

```bash
pnpm --filter @summonlab/engine test -- domains/progression/experience.spec.ts orchestration/registries.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/contracts/src/event.ts packages/engine/src/domains/progression packages/engine/src/orchestration packages/engine/src/index.ts
git commit -m "feat(progression): grant immutable-star level points"
```

### Task 5: Apply allocations and direct intrinsic attribute growth

**Files:**

- Modify: `packages/contracts/src/engine/commands.ts`
- Modify: `packages/contracts/src/event.ts`
- Create: `packages/engine/src/domains/progression/attributes.ts`
- Create: `packages/engine/src/domains/progression/attributes.spec.ts`
- Modify: `packages/engine/src/orchestration/command-registry.ts`
- Modify: `packages/engine/src/orchestration/event-registry.ts`
- Modify: `packages/engine/src/orchestration/legal-actions.ts`
- Modify: `packages/engine/src/orchestration/reduction.ts`

**Interfaces:**

- Consumes: `AttributeGrowthClaim`, v27 state, `intrinsicAttributes`, and `maximumHealth`.
- Produces: `hero.allocate.attribute`, internal `applyAttributeGrowthClaim`, and replayable `hero.attribute.growth.applied` receipts.

- [ ] **Step 1: Write failing allocation and direct-growth tests**

Test each canonical attribute in `strength`, `agility`, `vitality`, `magic` order; allocation amounts greater than one; insufficient unallocated points; terminal heroes; stale commands; training/achievement/consumable/cultivation claims; and receipt before/after values.

```ts
it('spends points and keeps Vitality Health unfilled', () => {
	const result = applyAttributeGrowthClaim({
		state: v26Hero({ health: 60, vitality: 20, unallocatedAttributePoints: 3 }),
		claim: allocationClaim({ attribute: 'vitality', amount: 3 }),
		rules: PROGRESSION_RULES_V1
	});
	expect(result.receipt).toMatchObject({ intrinsicBefore: 20, intrinsicAfter: 23, pointsSpent: 3 });
	expect(result.hero.health).toBe(60);
	expect(result.hero.maxHealth).toBe(115);
});
```

- [ ] **Step 2: Run the attribute test and verify red**

Run: `pnpm --filter @summonlab/engine test -- domains/progression/attributes.spec.ts`

Expected: FAIL because the claim applier and allocation command do not exist.

- [ ] **Step 3: Add the strict allocation command**

```ts
export const AllocateAttributeCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.allocate.attribute'),
	attribute: CombatAttributeNameSchema,
	amount: z.number().int().positive()
}).strict();
```

Only a living v27 hero with enough unallocated points may allocate. The command becomes a typed allocation claim; it cannot write capability profile, rates, Health, or progression state directly.

- [ ] **Step 4: Implement one growth applier**

Compute intrinsic attributes from generated base plus cumulative `permanentGrowth`. Allocation subtracts `amount` from unallocated points; other accepted sources leave the pool unchanged. Add `amount` to only the selected permanent-growth key, recompute derived maxima at the current tier, keep current Health unchanged unless clamping is required, and emit one before/after receipt.

- [ ] **Step 5: Register replay validation and legal actions**

Expose four compact legal actions in sheet order when points are available. Rebuild each growth outcome from its claim and rules binding during replay and reject forged attribute, amount, source, or before/after values.

- [ ] **Step 6: Verify all point vintages use the current tier**

Construct one hero whose Strength consists of generated base, level allocation, training, achievement, consumable, and cultivation points. Assert `attributePowerMilli(totalStrength, 900, rules)` applies `5_000` to the total rather than tracking per-source conversion rates.

- [ ] **Step 7: Run focused verification**

```bash
pnpm --filter @summonlab/contracts test -- progression.spec.ts
pnpm --filter @summonlab/engine test -- domains/progression/attributes.spec.ts orchestration/registries.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/contracts/src/engine/commands.ts packages/contracts/src/event.ts packages/engine/src/domains/progression packages/engine/src/orchestration
git commit -m "feat(attributes): apply typed intrinsic growth"
```

### Task 6: Route existing training and synthesis XP through progression

**Files:**

- Modify: `packages/engine/src/domains/settlement/routines.ts:343-435`
- Create: `packages/engine/src/domains/settlement/progression.spec.ts`
- Modify: `packages/engine/src/domains/settlement/reducer.ts`
- Modify: `packages/engine/src/domains/synthesis/runtime.ts:46-48,227-236`
- Modify: `packages/engine/src/domains/synthesis/synthesis-domain.spec.ts`

**Interfaces:**

- Consumes: `applyExperienceClaim` from Task 4.
- Produces: training and synthesis evidence adapters; removes duplicate v27 level calculations while retaining frozen v1-v26 behavior.

- [ ] **Step 1: Write failing adapter tests**

For v27 training, assert the existing `8 + First Ember modifier` hero XP and separate sword-practice XP flow through an `ExperienceClaim` with `sourceKind: 'training'`. For synthesis, assert essence XP flows through `sourceKind: 'synthesis'`. In both cases, verify multi-level star grants and no star mutation.

- [ ] **Step 2: Run focused tests and verify red**

```bash
pnpm --filter @summonlab/engine test -- domains/settlement/progression.spec.ts domains/synthesis/synthesis-domain.spec.ts
```

Expected: FAIL because both domains still call their local `levelFor` functions.

- [ ] **Step 3: Adapt v27 training**

Keep the v1-v26 routine branch unchanged. In the v27 branch, build a deterministic claim ID from the scheduled event ID, call `applyExperienceClaim`, and include its receipt in the scheduled activity outcome. Continue to calculate sword skill practice independently.

- [ ] **Step 4: Adapt v27 synthesis**

Replace only the v27 direct `experience + essence` and `levelFor` path with the shared claim. Preserve the existing essence formula, source/recipient legality, and v22-v26 receipt schemas.

- [ ] **Step 5: Recompute awakening-derived Health**

When either source crosses levels 100–900, set the new maximum from the bound table and leave current Health unchanged. Add a test crossing level 99→100 at partial Health.

- [ ] **Step 6: Run focused verification**

```bash
pnpm --filter @summonlab/engine test -- domains/settlement/progression.spec.ts domains/settlement/settlement-domain.spec.ts domains/synthesis/synthesis-domain.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/domains/settlement packages/engine/src/domains/synthesis
git commit -m "refactor(progression): centralize hero experience grants"
```

### Task 7: Grant crafting XP only for completed production

**Files:**

- Modify: `packages/content/src/progression-rules.ts`
- Modify: `packages/content/src/progression-rules.spec.ts`
- Modify: `packages/engine/src/domains/settlement/forging.ts`
- Modify: `packages/engine/src/domains/settlement/forging.spec.ts`
- Modify: `packages/engine/src/domains/settlement/reducer.ts:1140-1175`
- Create: `packages/engine/src/domains/progression/production.ts`
- Create: `packages/engine/src/domains/progression/production.spec.ts`

**Interfaces:**

- Consumes: `craftExperience`, `applyExperienceClaim`, forging outcomes, material ranks, and craftsmanship labels.
- Produces: `ProductionCompletionEvidenceV1`, `experienceClaimForProduction(evidence, history, rules)`, and a generic contract usable by forging and future cooking completion.

- [ ] **Step 1: Write failing generic production tests**

Test `craftKind: 'forging'` and `craftKind: 'cooking'` evidence with recipe difficulty, every consumed ingredient rarity, result quality, novelty, and repetition count. Assert rarer ingredients and harder recipes never lower XP; first success beats repetition; and repeated work never drops below the authored floor.

```ts
const cookingEvidence = ProductionCompletionEvidenceV1Schema.parse({
	evidenceVersion: 'production-completion-v1',
	craftKind: 'cooking',
	resultId: 'food-hearth-stew',
	recipeId: 'recipe-hearth-stew',
	recipeDifficulty: 2,
	consumedIngredientRarities: [1, 2, 2],
	resultQuality: 'standard',
	completionEventId: EVENT_ID
});
expect(experienceClaimForProduction(cookingEvidence, { priorCompletions: 0 }, rules).sourceKind)
	.toBe('crafting');
```

- [ ] **Step 2: Run production tests and verify red**

Run: `pnpm --filter @summonlab/engine test -- domains/progression/production.spec.ts`

Expected: FAIL because production completion evidence does not exist.

- [ ] **Step 3: Implement the generic completion adapter**

Average consumed ingredient rarity with integer half-up rounding, then call the Task 2 craft formula. Use `craftKind:recipeId` as the evidence-count key. `priorCompletions === 0` supplies the discovery bonus; increment the count only in the same authoritative completion event that grants XP.

- [ ] **Step 4: Author forging difficulty bands without changing equipment identity**

Put this editable map in progression rules rather than mutating equipment definitions:

```ts
equipmentClassDifficulty: {
	dagger: 1, sword: 2, spear: 3, bow: 3, axe: 3, mace: 3,
	shield: 3, staff: 4, 'light-armour': 4, robes: 4, 'heavy-armour': 5
}
```

Convert material rank `F/E/D/C/B/A/S` to rarity bands `1..7`; pass the actual craftsmanship label as result quality.

- [ ] **Step 5: Attach XP to forging completion, never reservation**

Extend only the v27 forging outcome with production evidence, claim, and experience receipt. `hero.forging.started`, material reservation, invalid starts, and any canceled/abandoned job grant zero XP. `hero.forging.complete` creates the item, increments history, and applies XP atomically.

- [ ] **Step 6: Preserve the cooking boundary**

The generic adapter accepts and tests cooking evidence now. Do not invent food recipes, ingredient inventories, or a cooking UI in this slice; the future cooking completion owner must emit `ProductionCompletionEvidenceV1` and immediately receives the same XP behavior without a progression-schema change.

- [ ] **Step 7: Run focused verification**

```bash
pnpm --filter @summonlab/content test -- progression-rules.spec.ts
pnpm --filter @summonlab/engine test -- domains/progression/production.spec.ts domains/settlement/forging.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/content/src/progression-rules.ts packages/content/src/progression-rules.spec.ts packages/engine/src/domains/progression packages/engine/src/domains/settlement
git commit -m "feat(progression): grant completed crafting experience"
```

### Task 8: Award combat XP from deterministic participation evidence

**Files:**

- Modify: `packages/contracts/src/engine/mission-state.ts`
- Create: `packages/engine/src/domains/progression/combat-experience.ts`
- Create: `packages/engine/src/domains/progression/combat-experience.spec.ts`
- Modify: `packages/engine/src/domains/mission/combat.ts`
- Modify: `packages/engine/src/domains/mission/lifecycle.ts`
- Modify: `packages/engine/src/domains/mission/reducer.ts`
- Modify: `packages/engine/src/domains/mission/mission-runtime.spec.ts`

**Interfaces:**

- Consumes: common resolved combat effects, mission objective evidence, `combatExperience`, and `applyExperienceClaim`.
- Produces: `CombatContributionEvidenceV1`, deterministic contributor claims, and terminal mission progression receipts reusable by both legacy and readiness combat.

- [ ] **Step 1: Write failing contributor tests**

Create fixtures where one hero damages, one protects/heals, and one advances the objective. Assert all mechanically relevant contributors receive deterministic claims; the last hitter receives no exclusive bonus. Assert an idle deployed hero, invalid evidence, and a trivial exhausted encounter receive no unbounded reward.

- [ ] **Step 2: Run combat XP tests and verify red**

Run: `pnpm --filter @summonlab/engine test -- domains/progression/combat-experience.spec.ts`

Expected: FAIL because combat contribution evidence does not exist.

- [ ] **Step 3: Build contribution evidence from resolved facts**

```ts
export type CombatContributionEvidenceV1 = Readonly<{
	evidenceVersion: 'combat-contribution-v1';
	attemptId: string;
	heroId: string;
	encounterKey: string;
	difficultyBand: 1 | 2 | 3 | 4 | 5 | 6 | 7;
	appliedEffectIds: readonly string[];
	objectiveEvidenceIds: readonly string[];
	firstClear: boolean;
	priorCompletions: number;
}>;
```

An eligible contributor must own at least one applied combat effect or objective evidence record. Superseded actions, narration, declared intent, presence alone, and last-hit identity do not qualify.

- [ ] **Step 4: Apply claims at the terminal ownership boundary**

On success, failure, or retreat, sort evidence by hero ID, derive one claim per eligible hero, apply it through the shared progression owner, and append the receipts to the mission terminal event. Update each hero's combat evidence count atomically. A failure may retain legitimate contribution XP; invalid or absent evidence yields none.

- [ ] **Step 5: Preserve mode independence**

Read only the common resolved-effect and objective-evidence contract. Add an exported `experienceClaimsForCombatResult` function that takes no mode-specific round or readiness-state fields, so both existing combat outcome adapters call it unchanged.

- [ ] **Step 6: Run focused verification**

```bash
pnpm --filter @summonlab/engine test -- domains/progression/combat-experience.spec.ts domains/mission/mission-runtime.spec.ts
pnpm --filter @summonlab/engine typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/engine/mission-state.ts packages/engine/src/domains/progression packages/engine/src/domains/mission
git commit -m "feat(progression): award evidence-based combat experience"
```

### Task 9: Project awakenings and attributes onto character sheets

**Files:**

- Create: `apps/web/src/lib/progression-presentation.ts`
- Create: `apps/web/src/lib/progression-presentation.spec.ts`
- Modify: `apps/web/src/lib/components/living-village/attribute-display.ts`
- Modify: `apps/web/src/lib/components/living-village/attribute-display.spec.ts`
- Modify: `apps/web/src/lib/components/living-village/summon/HeroDossier.svelte`
- Modify: `apps/web/src/lib/components/living-village/village/VillageHeroDrawer.svelte`
- Modify: `apps/web/src/routes/replay/[runId]/+page.svelte:584-605`
- Modify: `apps/web/src/routes/synthesis/[runId]/+page.svelte:98-180`
- Modify: `apps/web/src/lib/server/synthesis.ts`

**Interfaces:**

- Consumes: v27 public state, rules binding, pure tier/rate helpers, and existing canonical attribute-display ordering.
- Produces: `presentHeroProgression(hero, rules)` with level, stars, XP, tier, unallocated points, intrinsic attributes, and per-point conversions.

- [ ] **Step 1: Write failing presentation tests**

Assert sheet order `STR`, `AGI`, `VIT`, `MAG`; accessible full names; level 99 versus 100 rate labels; tier 9 `×5`; and no `current stars`, `promotion`, `Body`, or `Mind` labels.

- [ ] **Step 2: Run presentation tests and verify red**

```bash
pnpm --filter @summonlab/web test -- src/lib/progression-presentation.spec.ts src/lib/components/living-village/attribute-display.spec.ts
```

Expected: FAIL because the v27 progression projection does not exist.

- [ ] **Step 3: Implement one server-safe projection**

```ts
export type HeroProgressionPresentation = Readonly<{
	level: number;
	stars: number;
	experience: number;
	awakeningTier: number;
	unallocatedAttributePoints: number;
	attributes: readonly [
		{ key: 'strength'; abbreviation: 'STR'; fullName: 'Strength'; value: number },
		{ key: 'agility'; abbreviation: 'AGI'; fullName: 'Agility'; value: number },
		{ key: 'vitality'; abbreviation: 'VIT'; fullName: 'Vitality'; value: number },
		{ key: 'magic'; abbreviation: 'MAG'; fullName: 'Magic'; value: number }
	];
	powerPerStrengthMilli: number;
	powerPerMagicMilli: number;
	healthPerVitality: number;
}>;
```

Do not send hidden learning profiles, claim internals, content hashes, or historical compatibility attributes to presentation components.

- [ ] **Step 4: Update compact character sheets**

Render the four attributes in one row or a responsive 2×2 grid. Use abbreviations in the cells and full names in `aria-label`/title text. Show level, immutable star rating, awakening tier, and unallocated-point count without introducing star-upgrade affordances.

- [ ] **Step 5: Update replay and synthesis projections**

Display v27 level and awakening details while retaining existing v22-v26 branches. Synthesis may grant XP but must never alter or describe stars as upgradeable.

- [ ] **Step 6: Run focused verification**

```bash
pnpm --filter @summonlab/web test -- src/lib/progression-presentation.spec.ts src/lib/components/living-village/attribute-display.spec.ts
pnpm --filter @summonlab/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib apps/web/src/routes/replay apps/web/src/routes/synthesis
git commit -m "feat(web): present awakening progression"
```

### Task 10: Gate balance, compatibility, wiki convergence, and handoff

**Files:**

- Create: `tools/progression-balance-harness.ts`
- Create: `tools/progression-balance-harness.spec.ts`
- Create: `docs/evidence/progression-balance-v1.json`
- Modify: `package.json`
- Modify: `docs/wiki/mechanics/progression/README.md`
- Modify: `docs/wiki/mechanics/progression/attributes-and-training.md`
- Create: `docs/wiki/mechanics/progression/experience-and-levels.md`
- Create: `docs/wiki/mechanics/progression/stars.md`
- Modify: `docs/wiki/mechanics/attributes.md`
- Modify: `docs/wiki/systems/summoning-progression-combat.md`
- Create: `docs/decisions/0073-awakening-and-multi-path-progression.md`
- Modify: `docs/superpowers/specs/2026-09-12-awakening-and-multi-path-progression-design.md`
- Modify: `docs/superpowers/specs/2026-09-06-attributes-and-combat-modes-design.md`
- Modify: `docs/superpowers/plans/2026-09-06-four-attribute-legacy-combat.md`

**Interfaces:**

- Consumes: all v27 rules, reducers, receipts, projections, and replay fixtures.
- Produces: byte-stable balance evidence, authoritative wiki copy, ADR 0073, and repository validation commands for the v27 rollout.

- [ ] **Step 1: Write failing balance-harness tests**

Cover Combat and Crafting heroes at levels `1, 99, 100, 199, 200, 499, 500, 899, 900, 999`; stars `1` and `7`; substantial non-level growth; every power/Health table row; multi-level XP; monotonic craft inputs; repetition floors; and flat gear/ratio values remaining unchanged.

- [ ] **Step 2: Run the harness test and verify red**

Run: `pnpm vitest run tools/progression-balance-harness.spec.ts`

Expected: FAIL because the harness and evidence artifact do not exist.

- [ ] **Step 3: Implement deterministic evidence export**

Add `pnpm export:progression-balance` for `--write` and `pnpm validate:progression-balance` for `--check`. Emit canonical JSON containing rules version/hash, seed set, exact rate rows, representative physical/magical/Health results, XP receipts, craft/combat comparisons, and a second candidate table showing that data-only rate changes require no state-schema change.

- [ ] **Step 4: Generate and byte-check evidence**

```bash
pnpm export:progression-balance
pnpm validate:progression-balance
pnpm vitest run tools/progression-balance-harness.spec.ts
```

Expected: the second command reports no diff and all invariant tests pass.

- [ ] **Step 5: Converge the wiki and ADR**

Document levels `1..999`, awakenings every 100 levels, immutable stars as points per level, no star upgrades, shared XP, combat/crafting macro paths, forging and cooking completion evidence, novelty/repetition behavior, all ten conversion rows, and the versioned table-nerf policy. Remove the old `1★=10` through `7★=99` cap table and star-stone/promotion instructions from new-rules pages while labeling historical material explicitly.

- [ ] **Step 6: Reconcile predecessor plans and specs**

Mark the v25 plan's `4 Health per VIT`, level-99 balance ceiling, and one-point-per-level Task 6 as prototype behavior superseded by this completed v27 plan. Set the progression design status to `accepted; implementation complete`, and link this plan and ADR. Record that both v25 legacy combat and v26 readiness combat now consume the shared v27 progression owner.

- [ ] **Step 7: Run full compatibility and repository verification**

```bash
pnpm validate:progression-balance
pnpm validate:wiki
pnpm --filter @summonlab/contracts test
pnpm --filter @summonlab/content test
pnpm --filter @summonlab/engine test
pnpm --filter @summonlab/web test
pnpm typecheck
pnpm build
git diff --check
```

Expected: every command exits `0`; v1-v24 replay vectors retain their exact hashes; corrected v25/v26 fixtures use only canonical attribute names; v27 fixtures use only the new bound rules.

- [ ] **Step 8: Commit**

```bash
git add tools/progression-balance-harness.ts tools/progression-balance-harness.spec.ts docs/evidence/progression-balance-v1.json package.json docs/wiki docs/decisions/0073-awakening-and-multi-path-progression.md docs/superpowers
git commit -m "docs(progression): complete v27 progression rollout"
```

## Execution handoff

Execute Tasks 0–10 in order. Each task must finish its red/green cycle, focused verification, and commit before the next begins. After Task 10, run the repository's end-of-turn delivery checks and push the implementation branch.
