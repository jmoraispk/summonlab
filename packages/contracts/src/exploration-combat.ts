import { z } from 'zod';

import { ContentVersionSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{2,119}$/u);
const UnitIdSchema = z.union([SlugSchema, z.string().uuid()]);
export const AssetStatusSchema = z.enum(['production', 'fixture']);
export const CombatAssetApprovalStatusSchema = z.enum(['approved', 'fixture-only']);

function addIssue(context: z.RefinementCtx, message: string, path: (string | number)[] = []) {
	context.addIssue({ code: 'custom', path, message });
}

function validateUniqueStrings(
	values: string[],
	context: z.RefinementCtx,
	message: string,
	path: (string | number)[]
) {
	if (new Set(values).size !== values.length) {
		addIssue(context, message, path);
	}
}

export const CombatRasterBindingSchema = z
	.object({
		assetKey: SlugSchema,
		source: z.string().regex(/^\/runtime\/[a-z0-9./-]+\.(?:png|webp)$/u),
		contentHash: StateHashSchema,
		approvalStatus: CombatAssetApprovalStatusSchema,
		approvalId: SlugSchema
	})
	.strict();

export const CombatMotionPackBindingSchema = z
	.object({
		motionPackId: SlugSchema,
		source: z.string().regex(/^\/runtime\/[a-z0-9./-]+\.json$/u),
		atlasImageSource: z.string().regex(/^\/runtime\/[a-z0-9./-]+\.(?:png|webp)$/u),
		version: z.number().int().positive(),
		contentHash: StateHashSchema,
		atlasImageHash: StateHashSchema,
		approvalStatus: CombatAssetApprovalStatusSchema,
		approvalId: SlugSchema
	})
	.strict();

export const CombatResourcesSchema = z
	.object({
		health: z.number().int().nonnegative(),
		maximumHealth: z.number().int().positive(),
		mana: z.number().int().nonnegative(),
		maximumMana: z.number().int().nonnegative()
	})
	.strict()
	.superRefine((resources, context) => {
		if (resources.health > resources.maximumHealth) {
			addIssue(context, 'Health exceeds maximumHealth', ['health']);
		}
		if (resources.mana > resources.maximumMana) {
			addIssue(context, 'Mana exceeds maximumMana', ['mana']);
		}
	});

export const CombatProfileSchema = z
	.object({
		movementUnitsPerSecond: z.number().finite().positive().max(4),
		attackRange: z.number().finite().positive().max(2),
		attackPower: z.number().int().positive().max(100_000),
		armour: z.number().int().nonnegative().max(100_000),
		attackIntervalTicks: z.number().int().positive().max(36_000)
	})
	.strict();

export const DeploymentSchema = z
	.object({
		x: z.number().finite().min(0).max(1),
		y: z.number().finite().min(0).max(1)
	})
	.strict();

export const CombatPresentationBindingSchema = z
	.object({
		combatAssetBinding: CombatRasterBindingSchema,
		motionPackBinding: CombatMotionPackBindingSchema.nullable(),
		visualTuning: z
			.object({
				bodyOffsetY: z.number().finite().min(-200).max(200),
				shadowRadiusX: z.number().finite().positive().max(400),
				shadowRadiusY: z.number().finite().positive().max(200),
				displaySize: z.number().finite().positive().max(600)
			})
			.strict()
	})
	.strict();

const ActionDefinitionRefsSchema = z
	.array(SlugSchema)
	.min(1)
	.max(20)
	.superRefine((actionDefinitionRefs, context) => {
		validateUniqueStrings(
			actionDefinitionRefs,
			context,
			'Action definition references must be unique',
			[]
		);
	});

export const ExplorationCombatHeroSchema = z
	.object({
		heroRef: z
			.object({
				heroId: UnitIdSchema,
				characterManifestHash: StateHashSchema,
				lifeState: z.literal('combat-capable'),
				availabilityRevision: z.number().int().nonnegative(),
				rulesetVersion: ContentVersionSchema
			})
			.strict(),
		displayName: z.string().min(1).max(80),
		resources: CombatResourcesSchema,
		capability: z
			.object({
				capabilitySnapshotHash: StateHashSchema,
				loadoutHash: StateHashSchema,
				actionDefinitionRefs: ActionDefinitionRefsSchema,
				combatRole: z.enum(['brawler', 'guardian', 'archer'])
			})
			.strict(),
		combatProfile: CombatProfileSchema,
		deployment: DeploymentSchema,
		presentation: CombatPresentationBindingSchema
	})
	.strict();

export const ExplorationCombatEnemySchema = z
	.object({
		enemyInstanceId: UnitIdSchema,
		displayName: z.string().min(1).max(80),
		definitionRef: z
			.object({
				enemyDefinitionId: SlugSchema,
				definitionVersion: ContentVersionSchema,
				contentHash: StateHashSchema
			})
			.strict(),
		resources: CombatResourcesSchema,
		combatRole: z.enum(['brute', 'swarm']),
		actionDefinitionRefs: ActionDefinitionRefsSchema,
		combatProfile: CombatProfileSchema,
		deployment: DeploymentSchema,
		requiredForVictory: z.boolean(),
		presentation: CombatPresentationBindingSchema
	})
	.strict();

export const CombatContentBindingSchema = z
	.object({
		kind: z.enum(['ruleset', 'action', 'enemy', 'claim-policy', 'battlefield']),
		contentId: SlugSchema,
		version: ContentVersionSchema,
		contentHash: StateHashSchema
	})
	.strict();

const CombatContentBindingsSchema = z
	.array(CombatContentBindingSchema)
	.superRefine((contentBindings, context) => {
		const tuples = contentBindings.map(
			({ kind, contentId, version }) => `${kind}:${contentId}:${version}`
		);
		validateUniqueStrings(
			tuples,
			context,
			'Content binding kind, content ID, and version must be unique',
			[]
		);
	});

export const BattlefieldBindingSchema = z
	.object({
		battlefieldId: SlugSchema,
		version: ContentVersionSchema,
		contentHash: StateHashSchema,
		environmentAssetBinding: CombatRasterBindingSchema,
		occluderAssetBindings: z.array(CombatRasterBindingSchema).max(20)
	})
	.strict();

export const ExplorationEncounterBoundsSchema = z
	.object({
		maximumCombatants: z.number().int().min(2).max(48),
		maximumSimulationTicks: z.number().int().positive().max(216_000),
		maximumTraceEvents: z.number().int().min(2).max(10_000)
	})
	.strict();

const ExplorationEncounterRequestBaseSchema = z
	.object({
		schemaVersion: z.literal('exploration-encounter-request-v1'),
		requestId: z.string().uuid(),
		idempotencyKey: SlugSchema,
		runId: z.string().uuid(),
		correlationId: z.string().uuid(),
		causationId: z.string().uuid().optional(),
		encounterId: SlugSchema,
		explorationAttemptId: z.string().uuid(),
		observedGameTime: IsoDateTimeSchema,
		expectedExplorationStateHash: StateHashSchema,
		rulesetVersion: ContentVersionSchema,
		contentBindings: CombatContentBindingsSchema.min(1).max(100),
		seed: z.string().min(1).max(200),
		entropyCursor: z.number().int().nonnegative(),
		visualStatus: AssetStatusSchema,
		party: z.array(ExplorationCombatHeroSchema).min(1).max(8),
		enemies: z.array(ExplorationCombatEnemySchema).min(1).max(40),
		battlefieldBinding: BattlefieldBindingSchema,
		bounds: ExplorationEncounterBoundsSchema,
		requestHash: StateHashSchema
	})
	.strict();

function hasFixtureBinding(presentation: z.infer<typeof CombatPresentationBindingSchema>) {
	return (
		presentation.combatAssetBinding.approvalStatus === 'fixture-only' ||
		presentation.motionPackBinding?.approvalStatus === 'fixture-only'
	);
}

function validateEncounterRequest(
	request: z.infer<typeof ExplorationEncounterRequestBaseSchema>,
	context: z.RefinementCtx
) {
	const allUnitIds = [
		...request.party.map((hero) => hero.heroRef.heroId),
		...request.enemies.map((enemy) => enemy.enemyInstanceId)
	];
	if (new Set(allUnitIds).size !== allUnitIds.length) {
		addIssue(context, 'Participant IDs must be unique');
	}
	if (!request.enemies.some((enemy) => enemy.requiredForVictory)) {
		addIssue(context, 'At least one enemy is required for victory', ['enemies']);
	}
	if (request.bounds.maximumCombatants !== allUnitIds.length) {
		addIssue(context, 'maximumCombatants must equal declared participants', [
			'bounds',
			'maximumCombatants'
		]);
	}
	if (request.visualStatus === 'production') {
		const participantHasFixtureBinding = [...request.party, ...request.enemies].some(
			(participant) => hasFixtureBinding(participant.presentation)
		);
		const battlefieldHasFixtureBinding =
			request.battlefieldBinding.environmentAssetBinding.approvalStatus === 'fixture-only' ||
			request.battlefieldBinding.occluderAssetBindings.some(
				(binding) => binding.approvalStatus === 'fixture-only'
			);
		if (participantHasFixtureBinding || battlefieldHasFixtureBinding) {
			addIssue(
				context,
				'Production encounters require production-approved raster and motion bindings',
				['visualStatus']
			);
		}
	}
}

export const ExplorationEncounterRequestSchema =
	ExplorationEncounterRequestBaseSchema.superRefine(validateEncounterRequest);

export const ExplorationCombatEventKindSchema = z.enum([
	'encounter-started',
	'intent-selected',
	'movement-committed',
	'action-started',
	'action-resolved',
	'resource-changed',
	'unit-defeated',
	'encounter-ended'
]);

export const ExplorationCombatEventSchema = z
	.object({
		eventId: z.string().uuid(),
		sequence: z.number().int().nonnegative(),
		simulationTick: z.number().int().nonnegative(),
		kind: ExplorationCombatEventKindSchema,
		actorId: UnitIdSchema,
		targetIds: z.array(UnitIdSchema),
		actionId: SlugSchema.optional(),
		healthDeltas: z.array(z.object({ unitId: UnitIdSchema, amount: z.number().int() }).strict()),
		manaDeltas: z.array(z.object({ unitId: UnitIdSchema, amount: z.number().int() }).strict()),
		claimSourceRefs: z.array(SlugSchema),
		publicSummary: z.string().min(1).max(300)
	})
	.strict();

export const ExplorationCombatClaimBaseSchema = z
	.object({
		claimId: z.string().uuid(),
		definitionRef: z
			.object({
				definitionId: SlugSchema,
				version: ContentVersionSchema,
				contentHash: StateHashSchema
			})
			.strict(),
		quantity: z.number().int().positive(),
		sourceEventIds: z.array(z.string().uuid()).min(1)
	})
	.strict();

export const ProgressionXpClaimSchema = ExplorationCombatClaimBaseSchema.extend({
	kind: z.literal('progression-xp'),
	heroId: UnitIdSchema
}).strict();

export const SkillPracticeClaimSchema = ExplorationCombatClaimBaseSchema.extend({
	kind: z.literal('skill-practice'),
	heroId: UnitIdSchema,
	actionDefinitionId: SlugSchema
}).strict();

export const MaterialClaimSchema = ExplorationCombatClaimBaseSchema.extend({
	kind: z.literal('material'),
	sourceEnemyInstanceId: UnitIdSchema,
	materialDefinitionId: SlugSchema
}).strict();

export const ExplorationCombatClaimSchema = z.discriminatedUnion('kind', [
	ProgressionXpClaimSchema,
	SkillPracticeClaimSchema,
	MaterialClaimSchema
]);

const FinalResourcesSchema = z
	.object({
		health: z.number().int().nonnegative(),
		maximumHealth: z.number().int().positive(),
		mana: z.number().int().nonnegative(),
		maximumMana: z.number().int().nonnegative()
	})
	.strict()
	.superRefine((resources, context) => {
		if (resources.health > resources.maximumHealth) {
			addIssue(context, 'Health exceeds maximumHealth', ['health']);
		}
		if (resources.mana > resources.maximumMana) {
			addIssue(context, 'Mana exceeds maximumMana', ['mana']);
		}
	});

export const FinalCombatHeroSchema = FinalResourcesSchema.extend({
	heroId: UnitIdSchema,
	combatState: z.enum(['combat-capable', 'defeated'])
}).strict();

export const FinalCombatEnemySchema = FinalResourcesSchema.extend({
	enemyInstanceId: UnitIdSchema,
	combatState: z.enum(['combat-capable', 'defeated']),
	requiredForVictory: z.boolean()
}).strict();

export const ExplorationCombatDecisiveCauseSchema = z
	.object({
		code: z.enum(['enemies-defeated', 'heroes-defeated', 'encounter-limit-reached']),
		summary: z.string().min(1).max(300),
		supportingEventIds: z.array(z.string().uuid()).min(1)
	})
	.strict();

export const ExplorationCombatReplayRefSchema = z
	.object({
		replayVersion: z.literal('exploration-combat-replay-v1'),
		requestId: z.string().uuid(),
		requestHash: StateHashSchema,
		receiptId: z.string().uuid(),
		traceHash: StateHashSchema,
		rulesetVersion: ContentVersionSchema,
		seed: z.string().min(1).max(200),
		entropyCursor: z.number().int().nonnegative(),
		battlefieldBindingHash: StateHashSchema,
		participantPresentationBindingsHash: StateHashSchema
	})
	.strict();

const ExplorationCombatReceiptBaseSchema = z
	.object({
		schemaVersion: z.literal('exploration-combat-receipt-v1'),
		receiptId: z.string().uuid(),
		requestId: z.string().uuid(),
		idempotencyKey: SlugSchema,
		requestHash: StateHashSchema,
		runId: z.string().uuid(),
		correlationId: z.string().uuid(),
		encounterId: SlugSchema,
		explorationAttemptId: z.string().uuid(),
		rulesetVersion: ContentVersionSchema,
		contentBindings: CombatContentBindingsSchema.min(1),
		startedAtTick: z.number().int().nonnegative(),
		endedAtTick: z.number().int().nonnegative(),
		outcome: z.enum(['victory', 'defeat']),
		decisiveCause: ExplorationCombatDecisiveCauseSchema,
		finalHeroes: z.array(FinalCombatHeroSchema).min(1).max(8),
		finalEnemies: z.array(FinalCombatEnemySchema).min(1).max(40),
		defeatedEnemyIds: z.array(UnitIdSchema),
		events: z.array(ExplorationCombatEventSchema).min(2).max(10_000),
		claims: z.array(ExplorationCombatClaimSchema),
		inputStateHash: StateHashSchema,
		outputStateHash: StateHashSchema,
		traceHash: StateHashSchema,
		replayRef: ExplorationCombatReplayRefSchema,
		ownership: z
			.object({
				explorationMutated: z.literal(false),
				progressionCommitted: z.literal(false),
				inventoryCommitted: z.literal(false),
				lootCacheMutated: z.literal(false)
			})
			.strict()
	})
	.strict();

function validateTerminalResourceState(
	unit: z.infer<typeof FinalCombatHeroSchema> | z.infer<typeof FinalCombatEnemySchema>,
	context: z.RefinementCtx,
	path: (string | number)[]
) {
	if (unit.combatState === 'defeated' && unit.health !== 0) {
		addIssue(context, 'Defeated units must have zero health', path);
	}
	if (unit.combatState === 'combat-capable' && unit.health === 0) {
		addIssue(context, 'Combat-capable units must have positive health', path);
	}
}

function validateTerminalReceipt(
	receipt: z.infer<typeof ExplorationCombatReceiptBaseSchema>,
	context: z.RefinementCtx
) {
	if (receipt.endedAtTick < receipt.startedAtTick) {
		addIssue(context, 'endedAtTick cannot precede startedAtTick', ['endedAtTick']);
	}

	for (const [index, event] of receipt.events.entries()) {
		if (event.sequence !== index) {
			addIssue(context, 'Event sequences must be contiguous and start at zero', [
				'events',
				index,
				'sequence'
			]);
		}
	}
	validateUniqueStrings(
		receipt.events.map((event) => event.eventId),
		context,
		'Event IDs must be unique',
		['events']
	);
	if (receipt.events.at(-1)?.kind !== 'encounter-ended') {
		addIssue(context, 'The terminal event must be encounter-ended', ['events']);
	}

	const eventIds = new Set(receipt.events.map((event) => event.eventId));
	const eventsById = new Map(receipt.events.map((event) => [event.eventId, event]));
	const terminalEvent = receipt.events.at(-1);
	for (const supportingEventId of receipt.decisiveCause.supportingEventIds) {
		if (!eventIds.has(supportingEventId)) {
			addIssue(context, 'Decisive cause references an absent supporting event', ['decisiveCause']);
		}
	}
	validateUniqueStrings(
		receipt.claims.map((claim) => claim.claimId),
		context,
		'Claim IDs must be unique',
		['claims']
	);
	for (const [claimIndex, claim] of receipt.claims.entries()) {
		const matchingClaimPolicyBinding = receipt.contentBindings.some(
			(binding) =>
				binding.kind === 'claim-policy' &&
				binding.contentId === claim.definitionRef.definitionId &&
				binding.version === claim.definitionRef.version &&
				binding.contentHash === claim.definitionRef.contentHash
		);
		if (!matchingClaimPolicyBinding) {
			addIssue(context, 'Claim definitions must match a declared claim-policy content binding', [
				'claims',
				claimIndex,
				'definitionRef'
			]);
		}
		validateUniqueStrings(claim.sourceEventIds, context, 'Claim source event IDs must be unique', [
			'claims',
			claimIndex,
			'sourceEventIds'
		]);
		for (const sourceEventId of claim.sourceEventIds) {
			const sourceEvent = eventsById.get(sourceEventId);
			if (!sourceEvent) {
				addIssue(context, 'Claims must reference a source event', [
					'claims',
					claimIndex,
					'sourceEventIds'
				]);
				continue;
			}
			if (claim.kind === 'skill-practice') {
				if (sourceEvent.kind !== 'action-resolved') {
					addIssue(context, 'Skill-practice claims require action-resolved source events', [
						'claims',
						claimIndex,
						'sourceEventIds'
					]);
				}
				if (sourceEvent.actorId !== claim.heroId) {
					addIssue(context, 'Skill-practice claim sources must be acted by the claimed hero', [
						'claims',
						claimIndex,
						'heroId'
					]);
				}
				if (sourceEvent.actionId !== claim.actionDefinitionId) {
					addIssue(
						context,
						'Skill-practice claim sources must match the claimed action definition',
						['claims', claimIndex, 'actionDefinitionId']
					);
				}
			}
			if (claim.kind === 'material') {
				if (sourceEvent.kind !== 'unit-defeated') {
					addIssue(context, 'Material claims require unit-defeated source events', [
						'claims',
						claimIndex,
						'sourceEventIds'
					]);
				}
				if (!sourceEvent.targetIds.includes(claim.sourceEnemyInstanceId)) {
					addIssue(context, 'Material claim sources must target the claimed defeated enemy', [
						'claims',
						claimIndex,
						'sourceEnemyInstanceId'
					]);
				}
			}
			if (
				claim.kind === 'progression-xp' &&
				(sourceEvent.eventId !== terminalEvent?.eventId ||
					terminalEvent?.kind !== 'encounter-ended')
			) {
				addIssue(
					context,
					'Progression claims require the terminal encounter-ended event as evidence',
					['claims', claimIndex, 'sourceEventIds']
				);
			}
		}
	}

	const heroIds = receipt.finalHeroes.map((hero) => hero.heroId);
	const enemyIds = receipt.finalEnemies.map((enemy) => enemy.enemyInstanceId);
	validateUniqueStrings(heroIds, context, 'Final hero IDs must be unique', ['finalHeroes']);
	validateUniqueStrings(enemyIds, context, 'Final enemy IDs must be unique', ['finalEnemies']);
	validateUniqueStrings(
		[...heroIds, ...enemyIds],
		context,
		'Final participant IDs must be unique',
		[]
	);
	for (const [index, hero] of receipt.finalHeroes.entries()) {
		validateTerminalResourceState(hero, context, ['finalHeroes', index]);
	}
	for (const [index, enemy] of receipt.finalEnemies.entries()) {
		validateTerminalResourceState(enemy, context, ['finalEnemies', index]);
	}

	const defeatedEnemyIds = receipt.finalEnemies
		.filter((enemy) => enemy.combatState === 'defeated')
		.map((enemy) => enemy.enemyInstanceId);
	validateUniqueStrings(receipt.defeatedEnemyIds, context, 'Defeated enemy IDs must be unique', [
		'defeatedEnemyIds'
	]);
	if (
		defeatedEnemyIds.length !== receipt.defeatedEnemyIds.length ||
		defeatedEnemyIds.some((enemyId) => !receipt.defeatedEnemyIds.includes(enemyId))
	) {
		addIssue(context, 'defeatedEnemyIds must agree with final enemy states', ['defeatedEnemyIds']);
	}

	const hasRequiredEnemy = receipt.finalEnemies.some((enemy) => enemy.requiredForVictory);
	const requiredEnemiesDefeated = receipt.finalEnemies
		.filter((enemy) => enemy.requiredForVictory)
		.every((enemy) => enemy.combatState === 'defeated');
	const allHeroesDefeated = receipt.finalHeroes.every((hero) => hero.combatState === 'defeated');
	if (receipt.outcome === 'victory') {
		if (receipt.decisiveCause.code !== 'enemies-defeated') {
			addIssue(context, 'Victory receipts require an enemies-defeated decisive cause', [
				'decisiveCause',
				'code'
			]);
		}
		if (!hasRequiredEnemy) {
			addIssue(context, 'Victory requires at least one required enemy', ['finalEnemies']);
		}
		if (!requiredEnemiesDefeated) {
			addIssue(context, 'Victory requires every required enemy to be defeated', ['finalEnemies']);
		}
	}
	if (receipt.outcome === 'defeat') {
		if (receipt.decisiveCause.code === 'enemies-defeated') {
			addIssue(context, 'Defeat receipts cannot use an enemies-defeated decisive cause', [
				'decisiveCause',
				'code'
			]);
		}
		if (receipt.decisiveCause.code === 'heroes-defeated' && !allHeroesDefeated) {
			addIssue(context, 'A heroes-defeated defeat requires every hero to be defeated', [
				'finalHeroes'
			]);
		}
	}

	const finalHeroIds = new Set(heroIds);
	const finalEnemyIds = new Set(enemyIds);
	const finalDefeatedEnemyIds = new Set(defeatedEnemyIds);
	for (const [claimIndex, claim] of receipt.claims.entries()) {
		if ('heroId' in claim && !finalHeroIds.has(claim.heroId)) {
			addIssue(context, 'Hero claims must reference a final hero', ['claims', claimIndex]);
		}
		if ('sourceEnemyInstanceId' in claim && !finalEnemyIds.has(claim.sourceEnemyInstanceId)) {
			addIssue(context, 'Material claims must reference a final enemy', ['claims', claimIndex]);
		}
		if (claim.kind === 'material' && !finalDefeatedEnemyIds.has(claim.sourceEnemyInstanceId)) {
			addIssue(context, 'Material claims must reference a terminally defeated enemy', [
				'claims',
				claimIndex,
				'sourceEnemyInstanceId'
			]);
		}
	}

	if (receipt.replayRef.requestId !== receipt.requestId) {
		addIssue(context, 'Replay request ID must match the receipt request ID', [
			'replayRef',
			'requestId'
		]);
	}
	if (receipt.replayRef.requestHash !== receipt.requestHash) {
		addIssue(context, 'Replay request hash must match the receipt request hash', [
			'replayRef',
			'requestHash'
		]);
	}
	if (receipt.replayRef.receiptId !== receipt.receiptId) {
		addIssue(context, 'Replay receipt ID must match the receipt ID', ['replayRef', 'receiptId']);
	}
	if (receipt.replayRef.traceHash !== receipt.traceHash) {
		addIssue(context, 'Replay trace hash must match the receipt trace hash', [
			'replayRef',
			'traceHash'
		]);
	}
	if (receipt.replayRef.rulesetVersion !== receipt.rulesetVersion) {
		addIssue(context, 'Replay ruleset version must match the receipt ruleset version', [
			'replayRef',
			'rulesetVersion'
		]);
	}
}

export const ExplorationCombatReceiptSchema =
	ExplorationCombatReceiptBaseSchema.superRefine(validateTerminalReceipt);

export const ExplorationCombatRejectionSchema = z
	.object({
		schemaVersion: z.literal('exploration-combat-rejection-v1'),
		requestId: z.string().uuid().optional(),
		code: z.enum([
			'invalid-request',
			'request-hash-mismatch',
			'idempotency-conflict',
			'unsupported-ruleset',
			'stale-content-binding',
			'invalid-party',
			'invalid-enemy-set',
			'invalid-bounds',
			'unapproved-character-art'
		]),
		summary: z.string().min(1).max(300),
		fieldPaths: z.array(z.string().min(1).max(200))
	})
	.strict();

export type CombatRasterBinding = z.infer<typeof CombatRasterBindingSchema>;
export type CombatMotionPackBinding = z.infer<typeof CombatMotionPackBindingSchema>;
export type ExplorationCombatHero = z.infer<typeof ExplorationCombatHeroSchema>;
export type ExplorationCombatEnemy = z.infer<typeof ExplorationCombatEnemySchema>;
export type CombatContentBinding = z.infer<typeof CombatContentBindingSchema>;
export type ExplorationEncounterRequest = z.infer<typeof ExplorationEncounterRequestSchema>;
export type ExplorationCombatEvent = z.infer<typeof ExplorationCombatEventSchema>;
export type ExplorationCombatClaim = z.infer<typeof ExplorationCombatClaimSchema>;
export type ExplorationCombatReceipt = z.infer<typeof ExplorationCombatReceiptSchema>;
export type ExplorationCombatReplayRef = z.infer<typeof ExplorationCombatReplayRefSchema>;
export type ExplorationCombatRejection = z.infer<typeof ExplorationCombatRejectionSchema>;
