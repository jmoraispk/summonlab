import {
	CombatModeBindingSchema,
	CombatResultSchema,
	type CombatModeBinding,
	type CombatResult
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING } from '@summonlab/content';

import { combatAftermathRulesForBinding } from '../core/combat-aftermath-rules.js';
import type { CombatClaimReceipt } from '../core/combat-claims.js';
import {
	authenticateCombatResult,
	emitCombatOutcome,
	type EmitCombatOutcomeInput
} from '../domains/combat/outcome.js';
import {
	parseCombatMissionClaimProjection,
	type CombatMissionClaimProjection
} from '../domains/mission/lifecycle.js';
import { transitionCombatMissionClaims } from '../domains/mission/reducer.js';
import {
	applyCombatProgressionClaim,
	parseCombatProgressionClaimProjection,
	type CombatProgressionClaimProjection
} from '../domains/progression/claims.js';

export interface CombatClaimTransitionInput {
	readonly mission: CombatMissionClaimProjection;
	readonly progression: CombatProgressionClaimProjection;
}

export interface CombatClaimTransition extends CombatClaimTransitionInput {
	readonly receipts: readonly CombatClaimReceipt[];
}

export type V26LegacyCombatOutcomeInput = Omit<
	EmitCombatOutcomeInput,
	'modeId' | 'rulesVersion'
> & {
	readonly combatModeBinding: CombatModeBinding;
};

/** Adapts frozen legacy terminal evidence only after it reaches the additive V26 boundary. */
export function adaptV26LegacyCombatOutcome(input: V26LegacyCombatOutcomeInput): CombatResult {
	const binding = CombatModeBindingSchema.parse(input.combatModeBinding);
	if (
		binding.modeId !== 'legacy-auto-v1' ||
		binding.rulesVersion !== 'legacy-auto-rules-v1' ||
		binding.contentHash !== COMBAT_CONTENT_BINDING.contentHash
	) {
		throw new Error('V26 legacy outcome requires the exact immutable legacy combat binding');
	}
	return emitCombatOutcome({
		attemptId: input.attemptId,
		modeId: binding.modeId,
		rulesVersion: binding.rulesVersion,
		endedAtTick: input.endedAtTick,
		termination: input.termination,
		partyHeroIds: input.partyHeroIds,
		engineDamageTakenByHeroId: input.engineDamageTakenByHeroId,
		finalCombatants: input.finalCombatants,
		resolvedEvents: input.resolvedEvents,
		engineRecoveredCombatantIds: input.engineRecoveredCombatantIds,
		securedLoot: input.securedLoot,
		objectiveStates: input.objectiveStates,
		decisiveEventIds: input.decisiveEventIds
	});
}

/**
 * Coordinates owner-specific pure transitions without becoming a canonical state owner itself.
 * The caller persists the returned patches and receipts atomically with the terminal result.
 */
export function transitionCombatResultClaims(
	input: CombatClaimTransitionInput,
	resultInput: CombatResult,
	authorityInput: EmitCombatOutcomeInput
): CombatClaimTransition {
	const parsedInput = {
		mission: parseCombatMissionClaimProjection(input.mission),
		progression: parseCombatProgressionClaimProjection(input.progression)
	};
	const result = authenticateCombatResult(CombatResultSchema.parse(resultInput), authorityInput);
	const missionClaims = result.claims.filter((claim) => claim.claimType !== 'skill-practice');
	const progressionClaims = result.claims.filter((claim) => claim.claimType === 'skill-practice');
	const expectedKeys = new Set(result.claims.map((claim) => claim.idempotencyKey));
	const unexpectedAttemptReceipt = [
		...Object.keys(parsedInput.mission.receipts),
		...Object.keys(parsedInput.progression.receipts)
	].find((key) => key.startsWith(`${result.attemptId}:`) && !expectedKeys.has(key));
	if (unexpectedAttemptReceipt) {
		throw new Error(
			`Combat claim receipt collides with the terminal attempt: ${unexpectedAttemptReceipt}`
		);
	}
	const missionApplied = missionClaims.filter(
		(claim) => parsedInput.mission.receipts[claim.idempotencyKey] !== undefined
	).length;
	const progressionApplied = progressionClaims.filter(
		(claim) => parsedInput.progression.receipts[claim.idempotencyKey] !== undefined
	).length;
	const missionPartial = missionApplied !== 0 && missionApplied !== missionClaims.length;
	const progressionPartial =
		progressionApplied !== 0 && progressionApplied !== progressionClaims.length;
	const crossOwnerPartial =
		missionClaims.length > 0 &&
		progressionClaims.length > 0 &&
		(missionApplied === missionClaims.length) !== (progressionApplied === progressionClaims.length);
	if (missionPartial || progressionPartial || crossOwnerPartial) {
		throw new Error('Combat claims contain a partial non-atomic receipt set');
	}
	const missionTransition = transitionCombatMissionClaims(parsedInput.mission, result);
	let progression = parsedInput.progression;
	const receiptsByKey = new Map(
		missionTransition.receipts.map((receipt) => [receipt.idempotencyKey, receipt])
	);
	for (const claim of result.claims) {
		if (claim.claimType !== 'skill-practice') continue;
		const applied = applyCombatProgressionClaim(progression, claim);
		progression = applied.projection;
		receiptsByKey.set(applied.receipt.idempotencyKey, applied.receipt);
	}
	const mission = parseCombatMissionClaimProjection(missionTransition.projection);
	progression = parseCombatProgressionClaimProjection(progression);
	const aftermathRules = combatAftermathRulesForBinding(result.modeId, result.rulesVersion);
	const recovered = new Set(result.claimEvidence.engineRecoveredCombatantIds);
	const permanentLoss = aftermathRules.permanentLossOutcomes.some(
		(outcome) => outcome === result.outcome
	);
	for (const heroId of result.claimEvidence.partyHeroIds) {
		const before = parsedInput.mission.combatants[heroId];
		const finalCombatant = result.finalCombatants[heroId]!;
		const after = mission.combatants[heroId];
		if (!before || !after) throw new Error(`Combat aftermath lacks persistent hero ${heroId}`);
		const wasRecovered = recovered.has(heroId);
		const expectedHealth = wasRecovered
			? aftermathRules.minimumSafeHealth
			: finalCombatant.resources.health.current;
		const expectedDowned = wasRecovered ? false : finalCombatant.downed;
		const expectedLost = wasRecovered
			? false
			: permanentLoss && finalCombatant.downed
				? true
				: before.lost;
		if (
			after.health !== expectedHealth ||
			after.mana !== finalCombatant.resources.mana.current ||
			after.downed !== expectedDowned ||
			after.lost !== expectedLost ||
			(mission.recoveries[heroId] !== undefined) !== wasRecovered
		) {
			throw new Error(`Combat aftermath invariant failed for ${heroId}`);
		}
	}
	return {
		mission,
		progression,
		receipts: result.claims.map((claim) => {
			const receipt = receiptsByKey.get(claim.idempotencyKey);
			if (!receipt) throw new Error(`Combat claim lacks an owner: ${claim.idempotencyKey}`);
			return receipt;
		})
	};
}
