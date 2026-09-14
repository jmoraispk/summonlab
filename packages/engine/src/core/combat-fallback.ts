import {
	ActorDecisionViewSchema,
	CombatActionIntentSchema,
	type ActorDecisionView,
	type CombatActionIntent,
	type CombatLegalAction
} from '@summonlab/contracts';

import { hashCanonical } from '../hash.js';

export type DeterministicCombatFallbackBinding = Readonly<
	Pick<CombatActionIntent, 'attemptId' | 'tick' | 'snapshotHash'>
>;

function primaryTarget(action: CombatLegalAction): CombatActionIntent['target'] {
	const contract = action.targetContract;
	if (contract.kind === 'self') return { kind: 'self' };
	if (contract.kind === 'entity') {
		return { kind: 'entity', combatantId: contract.allowedCombatantIds[0]! };
	}
	if (contract.kind === 'tile') return { kind: 'tile', position: contract.allowedPositions[0]! };
	return {
		kind: 'entity-relative-position',
		combatantId: contract.allowedCombatantIds[0]!,
		relation: contract.allowedRelations[0]!
	};
}

export function buildDeterministicCombatFallbackIntent(
	input: ActorDecisionView,
	binding: DeterministicCombatFallbackBinding
): CombatActionIntent {
	const view = ActorDecisionViewSchema.parse(input);
	const unsignedView: Partial<ActorDecisionView> = { ...view };
	delete unsignedView.actorViewHash;
	if (
		hashCanonical(unsignedView) !== view.actorViewHash ||
		hashCanonical(view.legalActions) !== view.legalActionSetHash
	) {
		throw new Error('Deterministic combat fallback actor view integrity is invalid');
	}
	if (binding.snapshotHash !== view.snapshotHash) {
		throw new Error('Deterministic combat fallback snapshot binding does not match the actor view');
	}
	const action = view.legalActions[0];
	if (!action) throw new Error('Deterministic combat fallback found no supplied legal action');
	return CombatActionIntentSchema.parse({
		windowId: view.windowId,
		attemptId: binding.attemptId,
		tick: binding.tick,
		actorId: view.actorId,
		snapshotHash: view.snapshotHash,
		actorViewHash: view.actorViewHash,
		legalActionSetHash: view.legalActionSetHash,
		actionId: action.actionId,
		actionInstanceId: action.actionInstanceId,
		actionKind: action.actionKind,
		skillId: action.skillId,
		target: primaryTarget(action),
		fallbackId: action.fallbackOptions[0]?.fallbackId ?? null,
		publicIntent: `Follow the deterministic fallback: ${action.publicLabel}.`
	});
}
