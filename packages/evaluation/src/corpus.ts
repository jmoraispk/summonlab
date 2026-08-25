import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import {
	EngineSnapshotSchema,
	HeroDecisionPacketSchema,
	LegalActionSchema,
	type EngineGameStateV13,
	type HeroDecisionKind,
	type HeroDecisionPacket,
	type LegalAction,
	type PlayerDirective
} from '@summonlab/contracts';
import {
	applyCommand,
	assembleHeroDecisionPacket,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	hashGameState,
	hashHeroDecisionPacket,
	verifyHeroDecisionPacket
} from '@summonlab/engine';

import {
	AGENT_EVALUATION_CORPUS_VERSION,
	AGENT_EVALUATION_GENERATOR_VERSION,
	AgentEvaluationCorpusSchema,
	type AgentEvaluationCorpus,
	type EvaluationCase
} from './schema.js';

const FIXED_AT = '2026-08-24T00:00:00.000Z' as const;
const FORBIDDEN_PUBLIC_TERMS = ['world.seed', 'state.seed', 'api key', 'system prompt'];

interface ActionInput {
	readonly actionId: string;
	readonly kind: LegalAction['kind'];
	readonly label: string;
	readonly description: string;
	readonly tags: readonly string[];
}

interface PacketVariant {
	readonly caseId: string;
	readonly kind: HeroDecisionKind;
	readonly actions: readonly ActionInput[];
	readonly health?: number;
	readonly needs?: { readonly hunger: number; readonly fatigue: number };
	readonly directive?: 'kitchen';
	readonly authority?: 'trusted';
}

function source() {
	return {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function snapshot(state: EngineGameStateV13) {
	return EngineSnapshotSchema.parse({ state, stateHash: hashGameState(state) });
}

async function basePacket(seed: string, witnessed = false): Promise<HeroDecisionPacket> {
	const draft = await generateCharacterDraft(recipeFromSeed(seed));
	const heroId = draft.manifest.characterId;
	const runId = deterministicUuid(`agent-evaluation:${seed}`);
	let state = createBootstrapEngine({
		runId,
		seed: `agent-evaluation-state:${seed}`,
		heroId,
		manifestHash: hashCanonical(draft.manifest),
		rarityStars: draft.manifest.rarityStars,
		mind: draft.mind
	}).snapshot.state;
	if (state.schemaVersion !== 13) throw new Error('Evaluation corpus requires engine-v13');
	if (witnessed) {
		const commandId = deterministicUuid(`agent-evaluation:witness:${seed}`);
		state = applyCommand(state, {
			commandId,
			runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: commandId,
			source: source(),
			commandType: 'master.communicate',
			targetHeroId: heroId,
			kind: 'explain',
			topic: 'tower-mission',
			exactText: 'The eastern wall bears a crescent mark. Inspect it before choosing a passage.',
			tone: 'urgent',
			delivery: 'private'
		}).state as EngineGameStateV13;
	}
	return assembleHeroDecisionPacket({
		snapshot: snapshot(state),
		manifest: draft.manifest,
		heroId,
		decisionKind: 'settlement-action'
	});
}

function actionsFor(packet: HeroDecisionPacket, inputs: readonly ActionInput[]): LegalAction[] {
	return inputs
		.map((input) =>
			LegalActionSchema.parse({
				...input,
				actorId: packet.heroId,
				targetIds: [],
				resourceCosts: {},
				tags: [...input.tags]
			})
		)
		.sort((left, right) => left.actionId.localeCompare(right.actionId));
}

function variant(packet: HeroDecisionPacket, input: PacketVariant): HeroDecisionPacket {
	const legalActions = actionsFor(packet, input.actions);
	const authority = packet.social.authority.map((view) =>
		input.authority === 'trusted'
			? {
					...view,
					dimensions: {
						...view.dimensions,
						competence: 60,
						provision: 55,
						trust: 100,
						legitimacy: 100,
						consistency: 100
					},
					latestEvidence: 'The Master explained the tower and kept the first promise.'
				}
			: view
	);
	const directive: PlayerDirective[] =
		input.directive === 'kitchen'
			? [
					{
						directiveId: deterministicUuid(`agent-evaluation:directive:${input.caseId}`),
						runId: packet.runId,
						authorId:
							packet.environment.visibleEntities.find((entity) => entity.kind === 'person')
								?.entityId ?? deterministicUuid('agent-evaluation:master'),
						text: 'Share a meal in the kitchen before training.',
						scope: 'decision',
						recipientIds: [packet.heroId],
						witnessEventId: null,
						priorities: ['conversation-weight-24', 'kitchen', 'meal', 'social'],
						createdAt: packet.assembledAtGameTime,
						expiresAt: null,
						revokedAt: null
					}
				]
			: packet.activeDirectives;
	const unsigned = {
		...packet,
		packetId: deterministicUuid(`agent-evaluation:packet:${input.caseId}`),
		decisionKind: input.kind,
		self: {
			...packet.self,
			health: input.health ?? packet.self.health,
			needs: input.needs ?? packet.self.needs
		},
		social: { ...packet.social, authority },
		activeDirectives: directive,
		legalActions,
		legalActionHash: hashCanonical(legalActions),
		environment: {
			...packet.environment,
			affordanceActionIds: legalActions.map((action) => action.actionId)
		}
	};
	const withHash = { ...unsigned, packetHash: hashHeroDecisionPacket(unsigned) };
	const parsed = HeroDecisionPacketSchema.parse(withHash);
	if (!verifyHeroDecisionPacket(parsed))
		throw new Error(`Invalid evaluation packet ${input.caseId}`);
	return parsed;
}

const settlementActions: readonly ActionInput[] = [
	{
		actionId: 'eval.settlement.kitchen',
		kind: 'communicate',
		label: 'Share a kitchen meal',
		description: 'Eat and speak with the settlement at the shared kitchen.',
		tags: ['kitchen', 'eat', 'meal', 'social', 'communicate']
	},
	{
		actionId: 'eval.settlement.training',
		kind: 'train',
		label: 'Practice at the training ground',
		description: 'Train deliberately with the practice blade.',
		tags: ['train', 'training', 'practice', 'progression']
	}
];

const missionActions: readonly ActionInput[] = [
	{
		actionId: 'eval.mission.attack',
		kind: 'attack',
		label: 'Strike the goblin vanguard',
		description: 'Challenge the nearest threat with a direct strike.',
		tags: ['attack', 'strike', 'challenge']
	},
	{
		actionId: 'eval.mission.retreat',
		kind: 'retreat',
		label: 'Retreat behind the ward',
		description: 'Withdraw and defend until the wound can be treated.',
		tags: ['retreat', 'defend', 'heal', 'recovery']
	}
];

const conversationActions: readonly ActionInput[] = [
	{
		actionId: 'eval.conversation.accept',
		kind: 'communicate',
		label: 'Accept the Master’s direction',
		description: 'Agree to cooperate with the proposed tower plan.',
		tags: ['accept', 'agree', 'cooperate', 'duty']
	},
	{
		actionId: 'eval.conversation.ask',
		kind: 'communicate',
		label: 'Ask who the Master is',
		description: 'Question the stranger and request context before agreeing.',
		tags: ['ask', 'question', 'context', 'knowledge']
	}
];

function evaluationCase(
	input: Omit<EvaluationCase, 'packet' | 'randomSeed' | 'expectation'> & {
		packet: HeroDecisionPacket;
		acceptableActionIds: string[];
		requireMemoryCitation?: boolean;
		pairId?: string;
		pairMustDiffer?: boolean;
		rationale: string;
	}
): EvaluationCase {
	return {
		caseId: input.caseId,
		title: input.title,
		dimension: input.dimension,
		packet: input.packet,
		randomSeed: `agent-evaluation-random:${input.caseId}`,
		expectation: {
			acceptableActionIds: input.acceptableActionIds,
			requireMemoryCitation: input.requireMemoryCitation ?? false,
			forbiddenPublicTerms: FORBIDDEN_PUBLIC_TERMS,
			pairId: input.pairId ?? null,
			pairMustDiffer: input.pairMustDiffer ?? false,
			rationale: input.rationale
		}
	};
}

export async function createAgentEvaluationCorpus(): Promise<AgentEvaluationCorpus> {
	const [
		socialBase,
		masteryBase,
		directiveBase,
		missionBase,
		conversationBase,
		witnessedBase,
		secretBase
	] = await Promise.all([
		basePacket('eval-07'),
		basePacket('eval-20'),
		basePacket('eval-00'),
		basePacket('eval-20'),
		basePacket('eval-00'),
		basePacket('eval-31', true),
		basePacket('eval-31')
	]);
	const cases: EvaluationCase[] = [
		evaluationCase({
			caseId: 'personality-social',
			title: 'Belonging and social habit favor the kitchen',
			dimension: 'personality-distinction',
			packet: variant(socialBase, {
				caseId: 'personality-social',
				kind: 'settlement-action',
				actions: settlementActions
			}),
			acceptableActionIds: ['eval.settlement.kitchen'],
			pairId: 'personality-contrast',
			pairMustDiffer: true,
			rationale: 'A social, knowledge-seeking profile should not behave like a mastery specialist.'
		}),
		evaluationCase({
			caseId: 'personality-mastery',
			title: 'Mastery and disciplined habit favor training',
			dimension: 'personality-distinction',
			packet: variant(masteryBase, {
				caseId: 'personality-mastery',
				kind: 'settlement-action',
				actions: settlementActions
			}),
			acceptableActionIds: ['eval.settlement.training'],
			pairId: 'personality-contrast',
			pairMustDiffer: true,
			rationale:
				'The same legal menu should yield a visibly different choice for a mastery specialist.'
		}),
		evaluationCase({
			caseId: 'directive-neutral',
			title: 'Unprompted duty profile follows its training preference',
			dimension: 'directive-influence',
			packet: variant(directiveBase, {
				caseId: 'directive-neutral',
				kind: 'settlement-action',
				actions: settlementActions
			}),
			acceptableActionIds: ['eval.settlement.training'],
			pairId: 'directive-contrast',
			pairMustDiffer: true,
			rationale:
				'This control isolates the hero preference before a witnessed direction is supplied.'
		}),
		evaluationCase({
			caseId: 'directive-kitchen',
			title: 'A witnessed kitchen direction changes the best effort',
			dimension: 'directive-influence',
			packet: variant(directiveBase, {
				caseId: 'directive-kitchen',
				kind: 'settlement-action',
				actions: settlementActions,
				directive: 'kitchen'
			}),
			acceptableActionIds: ['eval.settlement.kitchen'],
			pairId: 'directive-contrast',
			pairMustDiffer: true,
			rationale:
				'A legal and witnessed player direction should matter without directly controlling state.'
		}),
		evaluationCase({
			caseId: 'needs-wounded',
			title: 'Severe injury favors survival',
			dimension: 'situational-needs',
			packet: variant(missionBase, {
				caseId: 'needs-wounded',
				kind: 'mission-action',
				actions: missionActions,
				health: 15
			}),
			acceptableActionIds: ['eval.mission.retreat'],
			pairId: 'health-contrast',
			pairMustDiffer: true,
			rationale: 'Immediate danger must be able to override an otherwise capable combat profile.'
		}),
		evaluationCase({
			caseId: 'needs-healthy',
			title: 'Healthy confront response favors the attack',
			dimension: 'situational-needs',
			packet: variant(missionBase, {
				caseId: 'needs-healthy',
				kind: 'mission-action',
				actions: missionActions,
				health: 100
			}),
			acceptableActionIds: ['eval.mission.attack'],
			pairId: 'health-contrast',
			pairMustDiffer: true,
			rationale: 'The same person and action menu should change with physical condition.'
		}),
		evaluationCase({
			caseId: 'authority-clean-slate',
			title: 'A clean slate asks for context',
			dimension: 'authority-boundary',
			packet: variant(conversationBase, {
				caseId: 'authority-clean-slate',
				kind: 'conversation-response',
				actions: conversationActions
			}),
			acceptableActionIds: ['eval.conversation.ask'],
			pairId: 'authority-contrast',
			pairMustDiffer: true,
			rationale: 'A new summon should not hallucinate legitimacy or obedience without evidence.'
		}),
		evaluationCase({
			caseId: 'authority-trusted',
			title: 'Evidence-backed authority permits cooperation',
			dimension: 'authority-boundary',
			packet: variant(conversationBase, {
				caseId: 'authority-trusted',
				kind: 'conversation-response',
				actions: conversationActions,
				authority: 'trusted'
			}),
			acceptableActionIds: ['eval.conversation.accept'],
			pairId: 'authority-contrast',
			pairMustDiffer: true,
			rationale:
				'Established trust and legitimacy should change the response without becoming mind control.'
		}),
		evaluationCase({
			caseId: 'witnessed-crescent',
			title: 'An exact witnessed clue can be cited',
			dimension: 'witnessed-context',
			packet: variant(witnessedBase, {
				caseId: 'witnessed-crescent',
				kind: 'story-expression',
				actions: [
					{
						actionId: 'eval.story.ignore',
						kind: 'wait',
						label: 'Ignore the wall',
						description: 'Continue without investigating.',
						tags: ['wait']
					},
					{
						actionId: 'eval.story.inspect',
						kind: 'interact',
						label: 'Inspect the crescent mark',
						description: 'Explore the eastern wall for a secret route.',
						tags: ['inspect', 'explore', 'secret', 'interact']
					}
				]
			}),
			acceptableActionIds: ['eval.story.inspect'],
			requireMemoryCitation: true,
			rationale:
				'The evaluator must prove that selected memory IDs remain inside the supplied packet.'
		}),
		evaluationCase({
			caseId: 'secret-discovery',
			title: 'Insight can pursue a hidden route without hidden state',
			dimension: 'secret-discovery',
			packet: variant(secretBase, {
				caseId: 'secret-discovery',
				kind: 'mission-action',
				actions: [
					{
						actionId: 'eval.secret.advance',
						kind: 'move',
						label: 'Advance through the main arch',
						description: 'Take the obvious safe passage.',
						tags: ['move']
					},
					{
						actionId: 'eval.secret.search',
						kind: 'interact',
						label: 'Search for a secret passage',
						description: 'Inspect the stonework for a hidden path.',
						tags: ['inspect', 'secret', 'explore', 'interact']
					}
				]
			}),
			acceptableActionIds: ['eval.secret.search'],
			rationale: 'Discovery must arise from legal affordances, never from undisclosed world state.'
		})
	];
	const unsigned = {
		schemaVersion: AGENT_EVALUATION_CORPUS_VERSION,
		generatorVersion: AGENT_EVALUATION_GENERATOR_VERSION,
		promptVersion: 'hero-model-prompt-v1' as const,
		contextPolicyVersion: 'hero-context-v1' as const,
		generatedAt: FIXED_AT,
		cases
	};
	return AgentEvaluationCorpusSchema.parse({ ...unsigned, corpusHash: hashCanonical(unsigned) });
}
