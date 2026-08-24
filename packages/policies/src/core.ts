import {
	HERO_POLICY_RESULT_VERSION,
	HeroDecisionPacketSchema,
	HeroDecisionSchema,
	HeroPolicyResultSchema,
	type HeroDecision,
	type HeroDecisionPacket,
	type HeroPolicyResult
} from '@summonlab/contracts';
import { canonicalJson, hashCanonical, verifyHeroDecisionPacket } from '@summonlab/engine';

export interface HeroPolicy {
	readonly policyId: HeroPolicyResult['policyId'];
	decide(packet: HeroDecisionPacket): Promise<HeroPolicyResult>;
}

export function validatePolicyPacket(input: HeroDecisionPacket): HeroDecisionPacket {
	const packet = HeroDecisionPacketSchema.parse(input);
	if (!verifyHeroDecisionPacket(packet)) throw new Error('Decision packet integrity check failed');
	if (hashCanonical(packet.legalActions) !== packet.legalActionHash) {
		throw new Error('Decision packet legal-action hash failed verification');
	}
	const actionIds = packet.legalActions.map((action) => action.actionId);
	if (
		new Set(actionIds).size !== actionIds.length ||
		[...actionIds].sort((left, right) => left.localeCompare(right)).join('|') !==
			actionIds.join('|')
	) {
		throw new Error('Decision packet legal actions are not canonical');
	}
	return packet;
}

export function validatePolicyDecision(
	packet: HeroDecisionPacket,
	input: HeroDecision
): HeroDecision {
	const decision = HeroDecisionSchema.parse(input);
	const action = packet.legalActions.find((candidate) => candidate.actionId === decision.actionId);
	if (!action) throw new Error(`Policy selected an unavailable action: ${decision.actionId}`);
	if (
		new Set(decision.targetIds).size !== decision.targetIds.length ||
		decision.targetIds.some((targetId) => !action.targetIds.includes(targetId))
	) {
		throw new Error('Policy selected targets outside the legal action');
	}
	const availableMemoryIds = new Set(
		packet.knowledge.memoryRetrieval.memories.map((memory) => memory.memoryId)
	);
	if (
		new Set(decision.memoryCandidateIds).size !== decision.memoryCandidateIds.length ||
		decision.memoryCandidateIds.some((memoryId) => !availableMemoryIds.has(memoryId))
	) {
		throw new Error('Policy cited memory outside the decision packet');
	}
	return decision;
}

function unsignedResult(result: HeroPolicyResult): Omit<HeroPolicyResult, 'resultHash'> {
	const unsigned: Partial<HeroPolicyResult> = { ...result };
	delete unsigned.resultHash;
	return unsigned as Omit<HeroPolicyResult, 'resultHash'>;
}

export function hashHeroPolicyResult(result: HeroPolicyResult): string {
	return hashCanonical(unsignedResult(result));
}

export function verifyHeroPolicyResult(result: HeroPolicyResult): boolean {
	return hashHeroPolicyResult(result) === result.resultHash;
}

export function createHeroPolicyResult(
	packet: HeroDecisionPacket,
	policyId: HeroPolicyResult['policyId'],
	decisionInput: HeroDecision,
	trace: HeroPolicyResult['trace']
): HeroPolicyResult {
	const decision = validatePolicyDecision(packet, decisionInput);
	const withoutHash = {
		schemaVersion: HERO_POLICY_RESULT_VERSION,
		policyId,
		packetId: packet.packetId,
		packetHash: packet.packetHash,
		legalActionHash: packet.legalActionHash,
		decisionKind: packet.decisionKind,
		world: {
			stateVersion: packet.world.stateVersion,
			eventCursor: packet.world.eventCursor,
			stateHash: packet.world.stateHash
		},
		decision,
		trace
	};
	const result = HeroPolicyResultSchema.parse({
		...withoutHash,
		resultHash: hashCanonical(withoutHash)
	});
	if (!verifyHeroPolicyResult(result)) throw new Error('Policy result hash failed verification');
	return result;
}

export function policyResultBytes(result: HeroPolicyResult): string {
	return canonicalJson(HeroPolicyResultSchema.parse(result));
}
