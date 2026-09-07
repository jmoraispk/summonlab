import {
	CombatActionIntentSchema,
	CombatRulesV1Schema,
	ReadinessCombatStateV1Schema,
	type ActorDecisionView,
	type CombatActionIntent,
	type CombatActionResolutionProfile,
	type CombatLegalAction,
	type CombatLegalActionTemplate,
	type CombatResolvedEvent,
	type CombatRulesV1,
	type DamageChannel,
	type DamageTag,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import {
	COMBAT_CONTENT_BINDING,
	COMBAT_RULES_V1,
	COMBAT_SKILLS_BY_ID,
	COMBAT_SKILL_CONFLICT_POLICIES_V1
} from '@summonlab/content';

import { hashCanonical } from '../../hash.js';
import { armourReduction } from './capability.js';
import { purposeKeyedInteger } from './randomness.js';
import { advanceUntilDecision } from './window.js';

const BASIS_POINTS = 10_000;

type AttackResolutionProfile = Extract<CombatActionResolutionProfile, { profileKind: 'attack' }>;

export type CombatHitChanceInput = Readonly<{
	skillAccuracyBasisPoints: number;
	defenderEvasionBasisPoints: number;
	attackerAgility: number;
	defenderAgility: number;
	flank: boolean;
	surround: boolean;
	unaware: boolean;
	rules: CombatRulesV1['hit'];
}>;

export type CombatHitContest = Readonly<{
	skillAccuracyBasisPoints: number;
	defenderEvasionBasisPoints: number;
	relativeAgilityBasisPoints: number;
	flank: boolean;
	surround: boolean;
	unaware: boolean;
	positionalBasisPoints: number;
	chanceBasisPoints: number;
}>;

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
	hitContest: CombatHitContest | null;
	calculation: CombatDamageCalculation | null;
}>;

export type ResolveCombatActionInput = Readonly<{
	state: ReadinessCombatStateV1;
	intent: CombatActionIntent;
	rules: CombatRulesV1;
}>;

export type BoundCombatActionAuthority = Readonly<{
	view: ActorDecisionView;
	legalAction: CombatLegalAction;
	template: CombatLegalActionTemplate;
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

function immutableRules(rulesInput: CombatRulesV1): CombatRulesV1 {
	const parsed = CombatRulesV1Schema.parse(rulesInput);
	if (hashCanonical(parsed) !== hashCanonical(COMBAT_RULES_V1)) {
		throw new Error('Combat resolution requires the immutable combat rules');
	}
	return COMBAT_RULES_V1;
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

function rederiveActionAuthority(
	state: ReadinessCombatStateV1,
	intent: CombatActionIntent,
	rules: CombatRulesV1
): BoundCombatActionAuthority {
	if (
		intent.attemptId !== state.attemptId ||
		intent.tick !== state.tick ||
		state.status !== 'active'
	) {
		throw new Error('Combat intent does not bind to the current canonical state');
	}
	const advance = advanceUntilDecision(state, rules);
	if (advance.kind !== 'decision-window' || advance.snapshot.tick !== state.tick) {
		throw new Error('Combat state is not at the intent decision window');
	}
	const { snapshot } = advance;
	if (
		intent.windowId !== snapshot.windowId ||
		intent.attemptId !== snapshot.attemptId ||
		intent.tick !== snapshot.tick ||
		intent.snapshotHash !== snapshot.snapshotHash
	) {
		throw new Error('Combat intent window or snapshot binding does not match canonical truth');
	}
	const view = advance.views.find((candidate) => candidate.actorId === intent.actorId);
	if (!view) throw new Error('Combat intent actor is not ready in the current window');
	if (
		intent.actorViewHash !== view.actorViewHash ||
		intent.legalActionSetHash !== view.legalActionSetHash
	) {
		throw new Error('Combat intent view or legal-action-set binding does not match');
	}
	const legalAction = view.legalActions.find((action) => action.actionId === intent.actionId);
	if (!legalAction) throw new Error('Combat action is not in the current legal-action set');
	if (
		intent.actionInstanceId !== legalAction.actionInstanceId ||
		intent.actionKind !== legalAction.actionKind ||
		intent.skillId !== legalAction.skillId
	) {
		throw new Error('Combat intent action instance, kind, or skill binding does not match');
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
	const context = state.actorContexts[intent.actorId];
	const template = context?.legalActionTemplates.find(
		(candidate) => candidate.actionId === legalAction.actionId
	);
	if (!context || !template) {
		throw new Error('Combat action has no private canonical resolution profile');
	}
	return { view, legalAction, template };
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
	const sortedRight = [...right].sort();
	return (
		left.length === right.length &&
		[...left].sort().every((value, index) => value === sortedRight[index])
	);
}

function validateResolutionProfile(
	profile: CombatActionResolutionProfile,
	legalAction: CombatLegalAction,
	rules: CombatRulesV1
): void {
	if (
		profile.rulesVersion !== rules.rulesVersion ||
		profile.contentHash !== COMBAT_CONTENT_BINDING.contentHash
	) {
		throw new Error('Combat resolution profile does not match immutable rules and content');
	}
	if (profile.profileKind !== 'attack') return;
	if (legalAction.skillId === null) {
		throw new Error('Combat attack resolution requires a catalog skill');
	}
	const skill = COMBAT_SKILLS_BY_ID[legalAction.skillId];
	const masteryStep = skill?.masteryProgression.find(
		(step) => step.minimumMastery === profile.masteryStepMinimum
	);
	if (
		!skill ||
		skill.kind !== 'attack' ||
		!skill.deliveryTags.includes(profile.deliveryTag) ||
		!masteryStep ||
		masteryStep.accuracyBasisPoints !== profile.skillAccuracyBasisPoints ||
		!sameStringSet(skill.damageTags, profile.damage.tags) ||
		hashCanonical(COMBAT_SKILL_CONFLICT_POLICIES_V1[legalAction.skillId]) !==
			hashCanonical(legalAction.conflictPolicy)
	) {
		throw new Error('Combat resolution profile does not match the immutable skill catalog');
	}
	if (
		profile.damage.affinityContributionBasisPoints > rules.affinity.contributionNudgeCapBasisPoints
	) {
		throw new Error('Authored affinity contribution exceeds the combat rules cap');
	}
}

function facingDirection(
	facing: ReadinessCombatStateV1['combatants'][string]['facing']
): Readonly<{ x: number; y: number }> {
	if (facing === 'north') return { x: 0, y: -1 };
	if (facing === 'east') return { x: 1, y: 0 };
	if (facing === 'south') return { x: 0, y: 1 };
	return { x: -1, y: 0 };
}

function relativeCardinalDirection(
	from: Readonly<{ x: number; y: number }>,
	to: Readonly<{ x: number; y: number }>
): Readonly<{ x: number; y: number }> | null {
	const deltaX = to.x - from.x;
	const deltaY = to.y - from.y;
	if (deltaX === 0 && deltaY === 0) return null;
	return Math.abs(deltaX) >= Math.abs(deltaY)
		? { x: Math.sign(deltaX), y: 0 }
		: { x: 0, y: Math.sign(deltaY) };
}

function isFlanking(
	attacker: ReadinessCombatStateV1['combatants'][string],
	defender: ReadinessCombatStateV1['combatants'][string]
): boolean {
	const direction = relativeCardinalDirection(defender.position, attacker.position);
	if (!direction) return false;
	const facing = facingDirection(defender.facing);
	return direction.x * facing.x + direction.y * facing.y === 0;
}

function isSurrounded(
	state: ReadinessCombatStateV1,
	defender: ReadinessCombatStateV1['combatants'][string]
): boolean {
	const occupiedSides = new Set<string>();
	for (const combatant of Object.values(state.combatants)) {
		if (
			combatant.teamId === defender.teamId ||
			!combatant.active ||
			combatant.downed ||
			Math.abs(combatant.position.x - defender.position.x) +
				Math.abs(combatant.position.y - defender.position.y) !==
				1
		) {
			continue;
		}
		occupiedSides.add(
			`${combatant.position.x - defender.position.x}:${combatant.position.y - defender.position.y}`
		);
	}
	return occupiedSides.size >= 2;
}

function hasActiveCondition(
	combatant: ReadinessCombatStateV1['combatants'][string],
	conditionId: string,
	tick: number
): boolean {
	return combatant.conditions.some(
		(condition) =>
			condition.conditionId === conditionId &&
			(condition.expiresAtTick === null || condition.expiresAtTick > tick)
	);
}

export function combatHitChance(input: CombatHitChanceInput): CombatHitContest {
	for (const [label, value] of [
		['skill accuracy', input.skillAccuracyBasisPoints],
		['defender evasion', input.defenderEvasionBasisPoints],
		['attacker Agility', input.attackerAgility],
		['defender Agility', input.defenderAgility]
	] as const) {
		if (!Number.isSafeInteger(value) || value < 0) {
			throw new Error(`Combat ${label} must be a nonnegative safe integer`);
		}
	}
	const agilityShift = clamp(
		(input.attackerAgility - input.defenderAgility) *
			input.rules.relativeAgilityBasisPointsPerPoint,
		-input.rules.relativeAgilityCapBasisPoints,
		input.rules.relativeAgilityCapBasisPoints
	);
	const positionalShift =
		(input.flank ? input.rules.flankBasisPoints : 0) +
		(input.surround ? input.rules.surroundBasisPoints : 0) +
		(input.unaware ? input.rules.unawareBasisPoints : 0);
	const chance = clamp(
		input.skillAccuracyBasisPoints -
			input.defenderEvasionBasisPoints +
			agilityShift +
			positionalShift,
		input.rules.minimumChanceBasisPoints,
		input.rules.maximumChanceBasisPoints
	);
	return {
		skillAccuracyBasisPoints: input.skillAccuracyBasisPoints,
		defenderEvasionBasisPoints: input.defenderEvasionBasisPoints,
		relativeAgilityBasisPoints: agilityShift,
		flank: input.flank,
		surround: input.surround,
		unaware: input.unaware,
		positionalBasisPoints: positionalShift,
		chanceBasisPoints: chance
	};
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
	authority: AttackResolutionProfile['damage'],
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

function frozenResolution(
	state: ReadinessCombatStateV1,
	effects: CombatResolvedEffect[],
	outcome: CombatActionResolution['outcome'],
	hitContest: CombatHitContest | null,
	calculation: CombatDamageCalculation | null
): CombatActionResolution {
	return Object.freeze({
		state: ReadinessCombatStateV1Schema.parse(state),
		effects: Object.freeze(effects),
		outcome: Object.freeze(outcome),
		hitContest: hitContest === null ? null : Object.freeze(hitContest),
		calculation: calculation === null ? null : Object.freeze(calculation)
	});
}

export function resolveCombatAction(input: ResolveCombatActionInput): CombatActionResolution {
	const state = ReadinessCombatStateV1Schema.parse(input.state);
	const intent = CombatActionIntentSchema.parse(input.intent);
	const rules = immutableRules(input.rules);
	const authority = rederiveActionAuthority(state, intent, rules);
	return resolveBoundCombatAction({ state, intent, rules, authority });
}

/**
 * Internal same-window entry point. The package root intentionally does not export it: callers
 * must first bind authority through the frozen window, while arbitration reuses that already
 * validated authority against progressive canonical state.
 */
export function resolveBoundCombatAction(input: {
	state: ReadinessCombatStateV1;
	intent: CombatActionIntent;
	rules: CombatRulesV1;
	authority: BoundCombatActionAuthority;
}): CombatActionResolution {
	const state = ReadinessCombatStateV1Schema.parse(input.state);
	const intent = CombatActionIntentSchema.parse(input.intent);
	const rules = immutableRules(input.rules);
	const { legalAction, template } = input.authority;
	validateResolutionProfile(template.resolutionProfile, legalAction, rules);

	const actor = state.combatants[intent.actorId];
	if (!actor || !actor.active || actor.downed) throw new Error('Combat actor is not active');
	if (actor.resources.mana.current < legalAction.manaCost) {
		throw new Error('Combat action is not affordable with current Mana');
	}
	const targetId = targetCombatantId(intent);
	const target = targetId === null ? null : state.combatants[targetId];
	const profile = template.resolutionProfile;
	if (profile.profileKind === 'attack' && (!target || !target.active || target.downed)) {
		throw new Error('Combat attack requires an active combatant target');
	}
	const possibleStatusExpiry =
		profile.profileKind === 'attack' && profile.damage.status !== null
			? state.tick + profile.damage.status.durationTicks
			: null;
	if (possibleStatusExpiry !== null && !Number.isSafeInteger(possibleStatusExpiry)) {
		throw new Error('Status expiry exceeded the safe integer domain');
	}

	const effects: CombatResolvedEffect[] = [];
	const manaBefore = actor.resources.mana.current;
	const manaAfter = manaBefore - legalAction.manaCost;
	const manaEffect =
		legalAction.manaCost === 0
			? null
			: ({
					kind: 'resource',
					combatantId: actor.combatantId,
					resource: 'mana',
					before: manaBefore,
					after: manaAfter,
					delta: -legalAction.manaCost
				} as const);

	if (profile.profileKind !== 'attack' || !target) {
		actor.resources.mana.current = manaAfter;
		if (manaEffect) effects.push(manaEffect);
		return frozenResolution(
			state,
			effects,
			{ hit: true, critical: false, statusApplied: false, downed: false },
			null,
			null
		);
	}

	const defenderEvasion = clamp(
		target.attributes.agility * rules.hit.defenderAgilityEvasionBasisPointsPerPoint,
		0,
		BASIS_POINTS
	);
	const hitContest = combatHitChance({
		skillAccuracyBasisPoints: profile.skillAccuracyBasisPoints,
		defenderEvasionBasisPoints: defenderEvasion,
		attackerAgility: actor.attributes.agility,
		defenderAgility: target.attributes.agility,
		flank: isFlanking(actor, target),
		surround: isSurrounded(state, target),
		unaware: hasActiveCondition(target, 'unaware', state.tick),
		rules: rules.hit
	});
	const hit =
		actorPurposeRoll(state, intent, legalAction, targetId, 'hit') < hitContest.chanceBasisPoints;
	const criticalTriggered =
		hit &&
		actorPurposeRoll(state, intent, legalAction, targetId, 'critical') <
			profile.damage.criticalChanceBasisPoints;
	const statusTriggered =
		hit &&
		profile.damage.status !== null &&
		actorPurposeRoll(state, intent, legalAction, targetId, 'status') <
			profile.damage.status.chanceBasisPoints;
	if (!hit) {
		actor.resources.mana.current = manaAfter;
		if (manaEffect) effects.push(manaEffect);
		return frozenResolution(
			state,
			effects,
			{ hit: false, critical: false, statusApplied: false, downed: false },
			hitContest,
			null
		);
	}

	const calculation = calculateDamage(
		profile.damage,
		profile.damage.channel,
		actor,
		target,
		rules,
		criticalTriggered,
		statusTriggered
	);
	const healthBefore = target.resources.health.current;
	const healthAfter = healthBefore - calculation.finalDamage;
	const downed = healthBefore > 0 && healthAfter === 0;

	actor.resources.mana.current = manaAfter;
	if (manaEffect) effects.push(manaEffect);
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
	let statusApplied = false;
	if (statusTriggered && profile.damage.status && !downed && possibleStatusExpiry !== null) {
		const status = profile.damage.status;
		const condition = {
			conditionId: status.conditionId,
			stacks: status.stacks,
			appliedAtTick: state.tick,
			expiresAtTick: possibleStatusExpiry,
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
	return frozenResolution(
		state,
		effects,
		{ hit: true, critical: criticalTriggered, statusApplied, downed },
		hitContest,
		calculation
	);
}
