import {
	CombatModeBindingSchema,
	type CombatModeBinding,
	type CombatModeId
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING } from '@summonlab/content';

export const LEGACY_AUTO_RULES_VERSION = 'legacy-auto-rules-v1' as const;

export function createCombatModeBinding(modeId: CombatModeId, boundAt: string): CombatModeBinding {
	if (modeId !== 'legacy-auto-v1') {
		throw new Error(`Combat mode is not enabled for engine-v25: ${modeId}`);
	}
	return CombatModeBindingSchema.parse({
		modeId,
		rulesVersion: LEGACY_AUTO_RULES_VERSION,
		contentHash: COMBAT_CONTENT_BINDING.contentHash,
		boundAt
	});
}

export function assertLegacyAutoBinding(binding: CombatModeBinding): void {
	const parsed = CombatModeBindingSchema.parse(binding);
	if (
		parsed.modeId !== 'legacy-auto-v1' ||
		parsed.rulesVersion !== LEGACY_AUTO_RULES_VERSION ||
		parsed.contentHash !== COMBAT_CONTENT_BINDING.contentHash
	) {
		throw new Error('The stored legacy automatic combat binding is unavailable');
	}
}
