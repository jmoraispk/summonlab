import {
	CombatAttributesSchema,
	MissionTurnChoiceSchema,
	type CharacterMind,
	type CombatAttributes,
	type EngineGameStateV25,
	type MissionTurnChoice
} from '@summonlab/contracts';

import { IllegalActionError } from '../../errors.js';
import { hashCanonical } from '../../hash.js';
import { missionTurnActionsForState } from './actions.js';
import { assertLegacyAutoBinding } from './combat-mode.js';

export const LEGACY_AUTO_POLICY_ID = 'legacy-auto-random-policy-v1' as const;

function legacyScale(value: number): number {
	return Math.min(10, Math.max(1, Math.floor(value / 10 + 0.5)));
}

export function legacyCapabilityProjection(
	attributesInput: CombatAttributes
): CharacterMind['aptitudes'] {
	const attributes = CombatAttributesSchema.parse(attributesInput);
	return {
		might: legacyScale(attributes.might),
		finesse: legacyScale(attributes.agility),
		insight: legacyScale(attributes.spirit),
		resolve: legacyScale(attributes.vitality)
	};
}

export function legacyAutomaticChoices(state: EngineGameStateV25): MissionTurnChoice[] {
	const attempt = state.mission.attempt;
	if (!attempt || !['deployed', 'resolving'].includes(attempt.status)) {
		throw new IllegalActionError('mission.advance.automatic');
	}
	assertLegacyAutoBinding(attempt.combatModeBinding);
	return attempt.party.memberIds.map((actorId) => {
		const legalActions = missionTurnActionsForState(state, actorId);
		if (legalActions.length === 0) throw new IllegalActionError('mission.advance.automatic');
		const legalActionHash = hashCanonical(legalActions);
		const packet = {
			runId: state.runId,
			attemptId: attempt.attemptId,
			roundNumber: attempt.turnState.roundNumber + 1,
			stateVersion: state.version,
			actorId,
			...(state.heroes[actorId]
				? {
						legacyAptitudes: legacyCapabilityProjection(
							state.heroes[actorId]!.capabilityProfile.attributes
						)
					}
				: {})
		};
		const packetHash = hashCanonical(packet);
		const seedHash = hashCanonical({
			policyId: LEGACY_AUTO_POLICY_ID,
			seed: state.seed,
			packetHash,
			legalActionHash
		});
		const selectedIndex = Number.parseInt(seedHash.slice(0, 8), 16) % legalActions.length;
		const action = legalActions[selectedIndex]!;
		const policyResult = {
			policyId: LEGACY_AUTO_POLICY_ID,
			seedHash,
			candidateActionIds: legalActions.map((candidate) => candidate.actionId),
			selectedIndex,
			actionId: action.actionId
		};
		return MissionTurnChoiceSchema.parse({
			actorId,
			actionId: action.actionId,
			source: 'random',
			policyId: LEGACY_AUTO_POLICY_ID,
			packetHash,
			legalActionHash,
			policyResultHash: hashCanonical(policyResult),
			publicIntent: `A seeded automatic policy chose to ${action.label.toLowerCase()}.`
		});
	});
}
