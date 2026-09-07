import {
	CombatModeBindingSchema,
	type CombatModeBinding,
	type CombatModeId
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING } from '@summonlab/content';

export const LEGACY_AUTO_RULES_VERSION = 'legacy-auto-rules-v1' as const;
export const AGENT_READINESS_RULES_VERSION = 'agent-readiness-rules-v1' as const;

export type CombatModeAvailability =
	| { readonly status: 'available'; readonly modeId: 'legacy-auto-v1'; readonly message: null }
	| {
			readonly status: 'not-yet-live';
			readonly modeId: 'agent-readiness-v1';
			readonly message: string;
	  }
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
	if (availability.status === 'available') return;
	throw new Error(availability.message);
}

export function combatModeAvailability(binding: CombatModeBinding): CombatModeAvailability {
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
		return {
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
