import {
	CombatActionIntentSchema,
	CombatLegalActionSchema,
	CombatRulesV1Schema,
	DamageChannelSchema,
	DamageTagSchema,
	ReadinessCombatStateV1Schema,
	type CombatActionIntent,
	type CombatLegalAction,
	type CombatResolvedEvent,
	type CombatRulesV1,
	type DamageChannel,
	type DamageTag,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import { z } from 'zod';

import { armourReduction } from './capability.js';
import { purposeKeyedInteger } from './randomness.js';

const BASIS_POINTS = 10_000;

const COMBAT_HIT_PROFILE_V1 = Object.freeze({
	minimumChanceBasisPoints: 500,
	maximumChanceBasisPoints: 9_950,
	relativeAgilityBasisPointsPerPoint: 10,
	relativeAgilityCapBasisPoints: 900,
	flankBasisPoints: 600,
	surroundBasisPoints: 700,
	unawareBasisPoints: 1_200
});

const HitAuthoritySchema = z
	.object({
		// This is the authored mastery-step accuracy, not a second attribute-derived score.
		skillAccuracyBasisPoints: z.number().int().min(0).max(BASIS_POINTS),
		defenderEvasionBasisPoints: z.number().int().min(0).max(BASIS_POINTS),
		flank: z.boolean(),
		surround: z.boolean(),
		unaware: z.boolean()
	})
	.strict();

const StatusAuthoritySchema = z
	.object({
		conditionId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		chanceBasisPoints: z.number().int().min(0).max(BASIS_POINTS),
		damageMultiplierBasisPoints: z.number().int().min(0).max(100_000),
		stacks: z.number().int().positive().max(1_000),
		durationTicks: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
	})
	.strict();

const DamageAuthoritySchema = z
	.object({
		channel: DamageChannelSchema,
		tags: z.array(DamageTagSchema).min(1).max(DamageTagSchema.options.length),
		baseMagnitude: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		coefficientBasisPoints: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		affinityContributionBasisPoints: z.number().int().nonnegative().max(BASIS_POINTS),
		criticalChanceBasisPoints: z.number().int().min(0).max(BASIS_POINTS),
		criticalMultiplierBasisPoints: z.number().int().nonnegative().max(100_000),
		penetration: z.number().int().nonnegative().max(1_000_000),
		status: StatusAuthoritySchema.nullable()
	})
	.strict()
	.superRefine((damage, context) => {
		if (!damage.tags.includes(damage.channel)) {
			context.addIssue({
				code: 'custom',
				path: ['tags'],
				message: 'Damage tags must include the authored damage channel'
			});
		}
		if (new Set(damage.tags).size !== damage.tags.length) {
			context.addIssue({ code: 'custom', path: ['tags'], message: 'Damage tags must be unique' });
		}
	});

const CombatActionAuthoritySchema = z
	.object({
		authorityVersion: z.literal('combat-action-authority-v1'),
		actionId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		skillId: z
			.string()
			.regex(/^combat-skill-[a-z0-9]+(?:-[a-z0-9]+)*$/u)
			.nullable(),
		hit: HitAuthoritySchema,
		damage: DamageAuthoritySchema.nullable()
	})
	.strict();

export type CombatActionAuthority = Readonly<z.infer<typeof CombatActionAuthoritySchema>>;

export type CombatHitChanceInput = Readonly<
	z.infer<typeof HitAuthoritySchema> & {
		attackerAgility: number;
		defenderAgility: number;
	}
>;

export type CombatDamageCalculation = Readonly<{
	authoredMagnitude: number;
	attributeScaledMagnitude: number;
	affinityAdjustedMagnitude: number;
	criticalAdjustedMagnitude: number;
	statusAdjustedMagnitude: number;
	armourReductionBasisPoints: number;
	armourAdjustedMagnitude: number;
	resistanceReductionBasisPoints: number;
	finalDamage: number;
}>;

type CombatResolvedEffect = CombatResolvedEvent['effects'][number];

export type CombatActionResolution = Readonly<{
	state: ReadinessCombatStateV1;
	effects: readonly CombatResolvedEffect[];
	outcome: Readonly<{
		hit: boolean;
		critical: boolean;
		statusApplied: boolean;
		downed: boolean;
	}>;
	calculation: CombatDamageCalculation | null;
}>;

export type ResolveCombatActionInput = Readonly<{
	state: ReadinessCombatStateV1;
	intent: CombatActionIntent;
	legalAction: CombatLegalAction;
	authority: CombatActionAuthority;
	rules: CombatRulesV1;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function scaleHalfUp(value: number, basisPoints: number, label: string): number {
	if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(basisPoints)) {
		throw new Error(`${label} requires safe integer inputs`);
	}
	const denominator = BigInt(BASIS_POINTS);
	const result = (BigInt(value) * BigInt(basisPoints) + denominator / 2n) / denominator;
	if (result < 0n || result > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new Error(`${label} exceeded the safe integer domain`);
	}
	return Number(result);
}

export function combatHitChance(input: CombatHitChanceInput): number {
	const hit = HitAuthoritySchema.parse({
		skillAccuracyBasisPoints: input.skillAccuracyBasisPoints,
		defenderEvasionBasisPoints: input.defenderEvasionBasisPoints,
		flank: input.flank,
		surround: input.surround,
		unaware: input.unaware
	});
	if (
		!Number.isSafeInteger(input.attackerAgility) ||
		input.attackerAgility < 0 ||
		!Number.isSafeInteger(input.defenderAgility) ||
		input.defenderAgility < 0
	) {
		throw new Error('Combat Agility values must be nonnegative safe integers');
	}
	const agilityShift = clamp(
		(input.attackerAgility - input.defenderAgility) *
			COMBAT_HIT_PROFILE_V1.relativeAgilityBasisPointsPerPoint,
		-COMBAT_HIT_PROFILE_V1.relativeAgilityCapBasisPoints,
		COMBAT_HIT_PROFILE_V1.relativeAgilityCapBasisPoints
	);
	const positionalShift =
		(hit.flank ? COMBAT_HIT_PROFILE_V1.flankBasisPoints : 0) +
		(hit.surround ? COMBAT_HIT_PROFILE_V1.surroundBasisPoints : 0) +
		(hit.unaware ? COMBAT_HIT_PROFILE_V1.unawareBasisPoints : 0);
	return clamp(
		hit.skillAccuracyBasisPoints - hit.defenderEvasionBasisPoints + agilityShift + positionalShift,
		COMBAT_HIT_PROFILE_V1.minimumChanceBasisPoints,
		COMBAT_HIT_PROFILE_V1.maximumChanceBasisPoints
	);
}

function selectedTargetIsLegal(
	intent: CombatActionIntent,
	legalAction: CombatLegalAction
): boolean {
	const selected = intent.target;
	const contract = legalAction.targetContract;
	if (contract.kind !== selected.kind) return false;
	if (contract.kind === 'self') return true;
	if (contract.kind === 'entity' && selected.kind === 'entity') {
		return contract.allowedCombatantIds.includes(selected.combatantId);
	}
	if (contract.kind === 'tile' && selected.kind === 'tile') {
		return contract.allowedPositions.some(
			(position) => position.x === selected.position.x && position.y === selected.position.y
		);
	}
	return (
		contract.kind === 'entity-relative-position' &&
		selected.kind === 'entity-relative-position' &&
		contract.allowedCombatantIds.includes(selected.combatantId) &&
		contract.allowedRelations.includes(selected.relation)
	);
}

function targetCombatantId(intent: CombatActionIntent): string | null {
	if (intent.target.kind === 'self') return intent.actorId;
	if (intent.target.kind === 'entity' || intent.target.kind === 'entity-relative-position') {
		return intent.target.combatantId;
	}
	return null;
}

function actorPurposeRoll(
	state: ReadinessCombatStateV1,
	intent: CombatActionIntent,
	legalAction: CombatLegalAction,
	targetId: string | null,
	purpose: 'hit' | 'critical' | 'status'
): number {
	return purposeKeyedInteger({
		seed: state.seed,
		attemptId: state.attemptId,
		tick: state.tick,
		actorId: intent.actorId,
		actionInstanceId: legalAction.actionInstanceId,
		targetId,
		purpose,
		localSequence: 0,
		minimum: 0,
		maximum: BASIS_POINTS - 1
	}).value;
}

function resistanceReduction(
	tags: readonly DamageTag[],
	resistances: ReadinessCombatStateV1['combatants'][string]['resistances'],
	rules: CombatRulesV1
): number {
	const namedTags = tags.filter((tag) => tag !== 'physical' && tag !== 'magical');
	const total = namedTags.reduce((sum, tag) => sum + (resistances[tag] ?? 0), 0);
	return clamp(total, -rules.resistance.capBasisPoints, rules.resistance.capBasisPoints);
}

function calculateDamage(
	authority: NonNullable<CombatActionAuthority['damage']>,
	channel: DamageChannel,
	attacker: ReadinessCombatStateV1['combatants'][string],
	target: ReadinessCombatStateV1['combatants'][string],
	rules: CombatRulesV1,
	critical: boolean,
	statusTriggered: boolean
): CombatDamageCalculation {
	const authoredMagnitude = scaleHalfUp(
		authority.baseMagnitude,
		authority.coefficientBasisPoints,
		'Authored damage coefficient'
	);
	const attribute = channel === 'physical' ? attacker.attributes.might : attacker.attributes.spirit;
	const perAttribute =
		channel === 'physical'
			? rules.damage.physicalBasisPointsPerMight
			: rules.damage.magicalBasisPointsPerSpirit;
	const attributeScaledMagnitude = scaleHalfUp(
		authoredMagnitude,
		BASIS_POINTS + attribute * perAttribute,
		'Attribute-scaled damage'
	);
	const attributeContribution = attributeScaledMagnitude - authoredMagnitude;
	const boundedAffinity = Math.min(
		authority.affinityContributionBasisPoints,
		rules.affinity.contributionNudgeCapBasisPoints
	);
	const affinityContribution = scaleHalfUp(
		attributeContribution,
		BASIS_POINTS + boundedAffinity,
		'Affinity contribution'
	);
	const affinityAdjustedMagnitude = authoredMagnitude + affinityContribution;
	if (!Number.isSafeInteger(affinityAdjustedMagnitude)) {
		throw new Error('Affinity-adjusted damage exceeded the safe integer domain');
	}
	const criticalAdjustedMagnitude = critical
		? scaleHalfUp(
				affinityAdjustedMagnitude,
				authority.criticalMultiplierBasisPoints,
				'Critical damage'
			)
		: affinityAdjustedMagnitude;
	const statusAdjustedMagnitude =
		statusTriggered && authority.status
			? scaleHalfUp(
					criticalAdjustedMagnitude,
					authority.status.damageMultiplierBasisPoints,
					'Status damage'
				)
			: criticalAdjustedMagnitude;
	const armourReductionBasisPoints =
		channel === 'physical' ? armourReduction(target.armour, authority.penetration, rules) : 0;
	const armourAdjustedMagnitude = scaleHalfUp(
		statusAdjustedMagnitude,
		BASIS_POINTS - armourReductionBasisPoints,
		'Armour mitigation'
	);
	const resistanceReductionBasisPoints = resistanceReduction(
		authority.tags,
		target.resistances,
		rules
	);
	const resisted = scaleHalfUp(
		armourAdjustedMagnitude,
		BASIS_POINTS - resistanceReductionBasisPoints,
		'Named resistance mitigation'
	);
	const finalDamage =
		authoredMagnitude > 0 ? Math.min(target.resources.health.current, Math.max(1, resisted)) : 0;
	return {
		authoredMagnitude,
		attributeScaledMagnitude,
		affinityAdjustedMagnitude,
		criticalAdjustedMagnitude,
		statusAdjustedMagnitude,
		armourReductionBasisPoints,
		armourAdjustedMagnitude,
		resistanceReductionBasisPoints,
		finalDamage
	};
}

export function resolveCombatAction(input: ResolveCombatActionInput): CombatActionResolution {
	const state = ReadinessCombatStateV1Schema.parse(input.state);
	const intent = CombatActionIntentSchema.parse(input.intent);
	const legalAction = CombatLegalActionSchema.parse(input.legalAction);
	const authority = CombatActionAuthoritySchema.parse(input.authority);
	const rules = CombatRulesV1Schema.parse(input.rules);
	if (
		intent.attemptId !== state.attemptId ||
		intent.tick !== state.tick ||
		intent.actionId !== legalAction.actionId ||
		authority.actionId !== legalAction.actionId ||
		authority.skillId !== legalAction.skillId
	) {
		throw new Error('Combat intent, legal action, and engine authority bindings do not match');
	}
	if (!selectedTargetIsLegal(intent, legalAction)) {
		throw new Error('Combat target was not supplied by the legal action');
	}
	if (
		intent.fallbackId !== null &&
		!legalAction.fallbackOptions.some((fallback) => fallback.fallbackId === intent.fallbackId)
	) {
		throw new Error('Combat fallback was not supplied by the legal action');
	}
	const actor = state.combatants[intent.actorId];
	const targetId = targetCombatantId(intent);
	const target = targetId === null ? null : state.combatants[targetId];
	if (!actor || !actor.active || actor.downed) throw new Error('Combat actor is not active');
	if (authority.damage && (!target || !target.active || target.downed)) {
		throw new Error('Damage authority requires an active combatant target');
	}
	if (
		authority.damage &&
		authority.damage.affinityContributionBasisPoints >
			rules.affinity.contributionNudgeCapBasisPoints
	) {
		throw new Error('Authored affinity contribution exceeds the combat rules cap');
	}

	if (!authority.damage || !target) {
		return Object.freeze({
			state,
			effects: Object.freeze([]),
			outcome: Object.freeze({ hit: true, critical: false, statusApplied: false, downed: false }),
			calculation: null
		});
	}

	const chance = combatHitChance({
		...authority.hit,
		attackerAgility: actor.attributes.agility,
		defenderAgility: target.attributes.agility
	});
	const hit = actorPurposeRoll(state, intent, legalAction, targetId, 'hit') < chance;
	const criticalTriggered =
		actorPurposeRoll(state, intent, legalAction, targetId, 'critical') <
		authority.damage.criticalChanceBasisPoints;
	const statusTriggered = authority.damage.status
		? actorPurposeRoll(state, intent, legalAction, targetId, 'status') <
			authority.damage.status.chanceBasisPoints
		: false;
	if (!hit) {
		return Object.freeze({
			state,
			effects: Object.freeze([]),
			outcome: Object.freeze({ hit: false, critical: false, statusApplied: false, downed: false }),
			calculation: null
		});
	}

	const calculation = calculateDamage(
		authority.damage,
		authority.damage.channel,
		actor,
		target,
		rules,
		criticalTriggered,
		statusTriggered
	);
	const effects: CombatResolvedEffect[] = [];
	const healthBefore = target.resources.health.current;
	const healthAfter = Math.max(0, healthBefore - calculation.finalDamage);
	if (calculation.finalDamage > 0) {
		target.resources.health.current = healthAfter;
		target.lastDamagedAtTick = state.tick;
		effects.push({
			kind: 'resource',
			combatantId: target.combatantId,
			resource: 'health',
			before: healthBefore,
			after: healthAfter,
			delta: healthAfter - healthBefore
		});
	}
	const downed = healthBefore > 0 && healthAfter === 0;
	let statusApplied = false;
	if (statusTriggered && authority.damage.status && !downed) {
		const status = authority.damage.status;
		const expiresAtTick = state.tick + status.durationTicks;
		if (!Number.isSafeInteger(expiresAtTick)) {
			throw new Error('Status expiry exceeded the safe integer domain');
		}
		const condition = {
			conditionId: status.conditionId,
			stacks: status.stacks,
			appliedAtTick: state.tick,
			expiresAtTick,
			sourceCombatantId: actor.combatantId
		};
		const existingIndex = target.conditions.findIndex(
			(existing) => existing.conditionId === condition.conditionId
		);
		if (existingIndex >= 0) {
			const existing = target.conditions[existingIndex]!;
			effects.push({
				kind: 'condition',
				combatantId: target.combatantId,
				operation: 'removed',
				condition: existing
			});
			target.conditions.splice(existingIndex, 1);
		}
		target.conditions.push(condition);
		effects.push({
			kind: 'condition',
			combatantId: target.combatantId,
			operation: 'applied',
			condition
		});
		statusApplied = true;
	}
	if (downed) {
		target.downed = true;
		target.active = false;
		effects.push({ kind: 'downed', combatantId: target.combatantId });
	}
	const parsedState = ReadinessCombatStateV1Schema.parse(state);
	return Object.freeze({
		state: parsedState,
		effects: Object.freeze(effects),
		outcome: Object.freeze({ hit, critical: criticalTriggered, statusApplied, downed }),
		calculation: Object.freeze(calculation)
	});
}
