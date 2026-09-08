import {
	CombatModeBindingSchema,
	type CombatModeBinding,
	type CombatModeId
} from '@summonlab/contracts';
import { AGENT_READINESS_RULES_VERSION, COMBAT_CONTENT_BINDING } from '@summonlab/content';

export { AGENT_READINESS_RULES_VERSION } from '@summonlab/content';

export const LEGACY_AUTO_RULES_VERSION = 'legacy-auto-rules-v1' as const;

export type CombatModeAvailability =
	| { readonly status: 'available'; readonly modeId: CombatModeId; readonly message: null }
	| { readonly status: 'not-yet-live'; readonly modeId: CombatModeId; readonly message: string }
	| { readonly status: 'unavailable'; readonly modeId: CombatModeId; readonly message: string };

export function createCombatModeBinding(modeId: CombatModeId, boundAt: string): CombatModeBinding {
	return CombatModeBindingSchema.parse({
		modeId,
		rulesVersion:
			modeId === 'legacy-auto-v1' ? LEGACY_AUTO_RULES_VERSION : AGENT_READINESS_RULES_VERSION,
		contentHash: COMBAT_CONTENT_BINDING.contentHash,
		boundAt
	});
}

export function assertLegacyAutoBinding(binding: CombatModeBinding): void {
	const availability = combatModeAvailability(binding);
	if (availability.status === 'available' && availability.modeId === 'legacy-auto-v1') return;
	if (availability.status === 'available') {
		throw new Error('Combat mode agent-readiness-v1 cannot use the legacy automatic resolver');
	}
	throw new Error(availability.message);
}

export function combatModeAvailability(
	binding: CombatModeBinding,
	runtimeSchemaVersion = 25
): CombatModeAvailability {
	const parsed = CombatModeBindingSchema.parse(binding);
	if (parsed.modeId === 'agent-readiness-v1') {
		if (
			parsed.rulesVersion !== AGENT_READINESS_RULES_VERSION ||
			parsed.contentHash !== COMBAT_CONTENT_BINDING.contentHash
		) {
			return {
				status: 'unavailable',
				modeId: parsed.modeId,
				message: 'Combat mode agent-readiness-v1 rules binding is unavailable'
			};
		}
		return runtimeSchemaVersion === 26
			? { status: 'available', modeId: parsed.modeId, message: null }
			: {
					status: 'not-yet-live',
					modeId: parsed.modeId,
					message: 'Combat mode agent-readiness-v1 is not yet live'
				};
	}
	if (
		parsed.rulesVersion !== LEGACY_AUTO_RULES_VERSION ||
		parsed.contentHash !== COMBAT_CONTENT_BINDING.contentHash
	) {
		return {
			status: 'unavailable',
			modeId: parsed.modeId,
			message: 'Combat mode legacy-auto-v1 rules binding is unavailable'
		};
	}
	return { status: 'available', modeId: parsed.modeId, message: null };
}
