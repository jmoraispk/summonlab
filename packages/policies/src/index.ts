import {
	HERO_DECISION_PREVIEW_VERSION,
	HeroDecisionPreviewSchema,
	HeroDecisionSchema,
	RANDOM_POLICY_VERSION,
	SCRIPTED_POLICY_VERSION,
	type HeroDecision,
	type HeroDecisionPacket,
	type HeroDecisionPreview,
	type HeroPolicyResult,
	type LegalAction,
	type PolicyActionScore,
	type PolicyScoreContribution
} from '@summonlab/contracts';
import { sha256Hex } from '@summonlab/engine';

import { createHeroPolicyResult, validatePolicyPacket, type HeroPolicy } from './core.js';

export * from './core.js';

function bounded(value: string, limit: number): string {
	return value.length <= limit ? value : `${value.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

function actionPhrase(action: LegalAction): string {
	const label = action.label.replace(/[.!?]+$/u, '');
	return label.charAt(0).toLowerCase() + label.slice(1);
}

function selectedMemoryIds(packet: HeroDecisionPacket): string[] {
	const limit = packet.decisionKind === 'conversation-response' ? 2 : 1;
	return packet.knowledge.memoryRetrieval.memories.slice(0, limit).map((memory) => memory.memoryId);
}

function goalFor(packet: HeroDecisionPacket, action: LegalAction): HeroDecision['goalProposal'] {
	if (packet.decisionKind === 'conversation-response') return null;
	const horizon =
		packet.decisionKind === 'mission-action'
			? ('mission' as const)
			: packet.decisionKind === 'story-expression'
				? ('long-term' as const)
				: ('today' as const);
	return {
		summary: bounded(action.label, 240),
		motive: bounded(
			`Act from ${packet.identity.mind.primaryValue} and ${packet.identity.mind.primaryDrive}`,
			160
		),
		horizon
	};
}

function spokenLine(packet: HeroDecisionPacket, action: LegalAction): string | null {
	if (
		packet.decisionKind !== 'conversation-response' &&
		packet.decisionKind !== 'story-expression'
	) {
		return action.kind === 'communicate'
			? bounded(`I choose to ${actionPhrase(action)}.`, 600)
			: null;
	}
	const phrase = actionPhrase(action);
	const line = {
		reserved: `For now, I will ${phrase}.`,
		direct: `I choose to ${phrase}.`,
		warm: `I think we should ${phrase}.`,
		wry: `Then ${phrase} it is.`,
		formal: `My decision is to ${phrase}.`,
		inquisitive: `Let us see what follows if I ${phrase}.`
	}[packet.identity.mind.socialStyle];
	return bounded(line, 600);
}

function decisionFor(
	packet: HeroDecisionPacket,
	action: LegalAction,
	reason: string
): HeroDecision {
	return HeroDecisionSchema.parse({
		actionId: action.actionId,
		targetIds: action.targetIds.slice(0, packet.responseContract.maxTargetIds),
		publicIntent: bounded(`I intend to ${actionPhrase(action)}. ${reason}`, 240),
		spokenText: spokenLine(packet, action),
		goalProposal: goalFor(packet, action),
		memoryCandidateIds: selectedMemoryIds(packet).slice(
			0,
			packet.responseContract.maxMemoryCandidateIds
		)
	});
}

export class RandomPolicy implements HeroPolicy {
	readonly policyId = RANDOM_POLICY_VERSION;

	constructor(private readonly seed: string) {
		if (!seed.trim()) throw new Error('RandomPolicy requires an explicit non-empty seed');
	}

	async decide(input: HeroDecisionPacket): Promise<HeroPolicyResult> {
		const packet = validatePolicyPacket(input);
		const candidateActionIds = packet.legalActions.map((action) => action.actionId);
		const seedHash = sha256Hex(
			`${this.policyId}\u0000${this.seed}\u0000${packet.packetHash}\u0000${packet.legalActionHash}`
		);
		const draw = Number.parseInt(seedHash.slice(0, 8), 16) >>> 0;
		const selectedIndex = draw % candidateActionIds.length;
		const action = packet.legalActions[selectedIndex];
		if (!action) throw new Error('RandomPolicy failed to resolve its selected legal action');
		return createHeroPolicyResult(
			packet,
			this.policyId,
			decisionFor(packet, action, 'A named deterministic draw selected this legal option.'),
			{
				kind: 'random',
				policyVersion: this.policyId,
				seedHash,
				draw,
				candidateActionIds,
				selectedIndex
			}
		);
	}
}

function searchableTerms(action: LegalAction): Set<string> {
	return new Set(
		[action.actionId, action.kind, action.label, action.description, ...action.tags]
			.join(' ')
			.toLowerCase()
			.split(/[^a-z0-9]+/u)
			.filter(Boolean)
	);
}

function keywordScore(
	terms: ReadonlySet<string>,
	keywords: readonly string[],
	weight: number
): number {
	return keywords.reduce((total, keyword) => total + (terms.has(keyword) ? weight : 0), 0);
}

function contribution(
	contributions: PolicyScoreContribution[],
	key: string,
	value: number,
	reason: string
): void {
	if (value !== 0) contributions.push({ key, value, reason });
}

const VALUE_TERMS = {
	duty: ['work', 'defend', 'protect', 'assignment', 'objective', 'accept', 'cooperate'],
	freedom: ['retreat', 'explore', 'refuse', 'independent', 'secret', 'move'],
	knowledge: ['inspect', 'interact', 'question', 'ask', 'context', 'secret', 'explore'],
	belonging: ['social', 'communicate', 'kitchen', 'accept', 'cooperate', 'protect'],
	mastery: ['train', 'training', 'attack', 'practice', 'progression'],
	mercy: ['defend', 'protect', 'rest', 'heal', 'negotiate', 'accept']
} as const;

const DRIVE_TERMS = {
	understand: ['inspect', 'question', 'ask', 'context', 'secret', 'explore'],
	protect: ['protect', 'defend', 'guard', 'heal'],
	prove: ['attack', 'train', 'training', 'challenge', 'progression'],
	connect: ['social', 'communicate', 'kitchen', 'accept', 'cooperate'],
	create: ['craft', 'work', 'repair', 'build', 'equipment'],
	survive: ['retreat', 'defend', 'rest', 'recovery', 'heal']
} as const;

const HABIT_TERMS = {
	'checks-exits': ['retreat', 'move', 'explore', 'inspect'],
	'stretches-at-dawn': ['train', 'training', 'practice', 'progression'],
	'shares-breakfast': ['kitchen', 'eat', 'meal', 'social', 'rest'],
	'catalogs-tools': ['inspect', 'equipment', 'work', 'craft', 'repair'],
	'walks-the-walls': ['move', 'defend', 'guard', 'patrol'],
	'practices-knots': ['finesse', 'equipment', 'work', 'repair']
} as const;

function mindContributions(packet: HeroDecisionPacket, terms: ReadonlySet<string>) {
	const contributions: PolicyScoreContribution[] = [];
	const mind = packet.identity.mind;
	contribution(
		contributions,
		'mind.value',
		keywordScore(terms, VALUE_TERMS[mind.primaryValue], 14),
		`${mind.primaryValue} value alignment`
	);
	contribution(
		contributions,
		'mind.drive',
		keywordScore(terms, DRIVE_TERMS[mind.primaryDrive], 12),
		`${mind.primaryDrive} drive alignment`
	);
	contribution(
		contributions,
		'mind.habit',
		keywordScore(terms, HABIT_TERMS[mind.dailyHabit], 10),
		`${mind.dailyHabit.replaceAll('-', ' ')} habit cue`
	);
	contribution(
		contributions,
		'mind.conscientiousness',
		keywordScore(
			terms,
			['work', 'train', 'training', 'defend', 'plan'],
			Math.round((mind.personality.conscientiousness - 50) / 10)
		),
		'conscientiousness changes structured action appeal'
	);
	contribution(
		contributions,
		'mind.openness',
		keywordScore(
			terms,
			['interact', 'inspect', 'explore', 'secret', 'story'],
			Math.round((mind.personality.openness - 50) / 10)
		),
		'openness changes novelty appeal'
	);
	contribution(
		contributions,
		'mind.social',
		keywordScore(
			terms,
			['communicate', 'social', 'accept', 'cooperate', 'kitchen'],
			Math.round((mind.personality.extraversion + mind.personality.agreeableness - 100) / 12)
		),
		'extraversion and agreeableness change social appeal'
	);
	return contributions;
}

function decisionKindContributions(
	packet: HeroDecisionPacket,
	action: LegalAction,
	terms: ReadonlySet<string>
): PolicyScoreContribution[] {
	const contributions: PolicyScoreContribution[] = [
		{ key: 'decision.legal-baseline', value: 1, reason: 'the engine supplied this legal action' }
	];
	const mind = packet.identity.mind;
	if (packet.decisionKind === 'settlement-action') {
		contribution(
			contributions,
			'settlement.hunger',
			keywordScore(
				terms,
				['kitchen', 'eat', 'meal', 'need'],
				Math.floor(packet.self.needs.hunger / 8)
			),
			'hunger increases food-seeking appeal'
		);
		contribution(
			contributions,
			'settlement.fatigue',
			keywordScore(terms, ['rest', 'sleep', 'recovery'], Math.floor(packet.self.needs.fatigue / 8)),
			'fatigue increases recovery appeal'
		);
		contribution(
			contributions,
			'settlement.training',
			keywordScore(
				terms,
				['train', 'training', 'practice'],
				mind.aptitudes.might + mind.aptitudes.resolve
			),
			'might and resolve increase training appeal'
		);
	}
	if (packet.decisionKind === 'mission-action') {
		const missingHealth = Math.max(0, packet.self.maxHealth - packet.self.health);
		if (packet.environment.mission) {
			const objectiveStatus = packet.environment.mission.objectiveStatus;
			const progressScore = terms.has('recover')
				? 60
				: terms.has('return') || terms.has('extraction')
					? objectiveStatus === 'available'
						? 0
						: 46
					: terms.has('advance') || terms.has('objective-route')
						? objectiveStatus === 'available'
							? 38
							: 0
						: 0;
			contribution(
				contributions,
				'mission.objective-progress',
				progressScore,
				'known objective state favors a concrete recovery or return step'
			);
		}
		contribution(
			contributions,
			'mission.survival',
			keywordScore(terms, ['retreat', 'defend', 'rest', 'heal'], Math.ceil(missingHealth / 5)),
			'missing health increases survival appeal'
		);
		contribution(
			contributions,
			'mission.offense',
			keywordScore(
				terms,
				['attack', 'strike', 'challenge'],
				mind.aptitudes.might + (mind.stressResponse === 'confront' ? 8 : 0)
			),
			'might and confrontation response increase offense appeal'
		);
		contribution(
			contributions,
			'mission.insight',
			keywordScore(terms, ['interact', 'inspect', 'secret', 'explore'], mind.aptitudes.insight),
			'insight increases discovery appeal'
		);
	}
	if (packet.decisionKind === 'conversation-response') {
		contribution(
			contributions,
			'conversation.channel',
			action.kind === 'communicate' ? 18 : 0,
			'conversation responses favor explicit communication actions'
		);
		const authority = packet.social.authority.reduce(
			(total, view) =>
				total + view.dimensions.trust + view.dimensions.legitimacy + view.dimensions.consistency,
			0
		);
		const authorityDirection = Math.sign(authority);
		contribution(
			contributions,
			'conversation.authority',
			authorityDirection > 0
				? keywordScore(
						terms,
						['accept', 'cooperate', 'agree'],
						Math.min(18, Math.ceil(authority / 20))
					)
				: keywordScore(
						terms,
						['question', 'ask', 'refuse', 'delay'],
						Math.min(18, Math.ceil(Math.abs(authority) / 20))
					),
			'holder-owned authority evidence shapes the response'
		);
		contribution(
			contributions,
			'conversation.clean-slate',
			packet.knowledge.beliefs.length <= 2
				? keywordScore(terms, ['question', 'ask', 'context'], 12)
				: 0,
			'limited beliefs increase requests for context'
		);
	}
	if (packet.decisionKind === 'story-expression') {
		contribution(
			contributions,
			'story.discovery',
			keywordScore(
				terms,
				['explore', 'secret', 'question', 'interact'],
				mind.aptitudes.insight + Math.floor(mind.personality.openness / 10)
			),
			'insight and openness increase discovery appeal'
		);
		contribution(
			contributions,
			'story.resolve',
			keywordScore(terms, ['commit', 'defend', 'accept', 'refuse'], mind.aptitudes.resolve),
			'resolve increases defining commitments'
		);
	}
	return contributions;
}

function directiveContribution(
	packet: HeroDecisionPacket,
	terms: ReadonlySet<string>
): PolicyScoreContribution | null {
	let matches = 0;
	let conversationWeight = 0;
	for (const directive of packet.activeDirectives) {
		const weightMarker = directive.priorities.find((priority) =>
			/^conversation-weight-(12|24)$/u.test(priority)
		);
		if (weightMarker) {
			const intentTerms = directive.priorities.filter((priority) => priority !== weightMarker);
			if (intentTerms.some((term) => terms.has(term))) {
				conversationWeight += Number(weightMarker.slice('conversation-weight-'.length));
			}
			continue;
		}
		const directiveTerms = [...directive.priorities, directive.text]
			.join(' ')
			.toLowerCase()
			.split(/[^a-z0-9]+/u)
			.filter((term) => term.length >= 3);
		matches += directiveTerms.filter((term) => terms.has(term)).length;
	}
	const total = Math.min(36, conversationWeight + matches * 6);
	return total === 0
		? null
		: {
				key: 'directive.witnessed-match',
				value: total,
				reason: 'witnessed directive or accepted conversation terms match this legal action'
			};
}

function scoreAction(packet: HeroDecisionPacket, action: LegalAction): PolicyActionScore {
	const terms = searchableTerms(action);
	const contributions = [
		...decisionKindContributions(packet, action, terms),
		...mindContributions(packet, terms)
	];
	const directive = directiveContribution(packet, terms);
	if (directive) contributions.push(directive);
	const resourceCost = Object.values(action.resourceCosts).reduce(
		(total, value) => total + value,
		0
	);
	contribution(
		contributions,
		'action.resource-cost',
		-Math.ceil(resourceCost * 3),
		'resource costs create deterministic friction'
	);
	return {
		actionId: action.actionId,
		total: contributions.reduce((total, item) => total + item.value, 0),
		contributions
	};
}

export class ScriptedPolicy implements HeroPolicy {
	readonly policyId = SCRIPTED_POLICY_VERSION;

	async decide(input: HeroDecisionPacket): Promise<HeroPolicyResult> {
		const packet = validatePolicyPacket(input);
		const actionScores = packet.legalActions.map((action) => scoreAction(packet, action));
		const ranked = [...actionScores].sort(
			(left, right) => right.total - left.total || left.actionId.localeCompare(right.actionId)
		);
		const selectedScore = ranked[0];
		const action = packet.legalActions.find(
			(candidate) => candidate.actionId === selectedScore?.actionId
		);
		if (!selectedScore || !action) throw new Error('ScriptedPolicy found no legal action');
		const strongest = [...selectedScore.contributions]
			.sort(
				(left, right) =>
					Math.abs(right.value) - Math.abs(left.value) || left.key.localeCompare(right.key)
			)
			.find((item) => item.key !== 'decision.legal-baseline');
		const reason =
			strongest?.reason ?? 'The stable action-id tie-break selected this legal option.';
		return createHeroPolicyResult(packet, this.policyId, decisionFor(packet, action, reason), {
			kind: 'scripted',
			policyVersion: this.policyId,
			tieBreakRule: 'highest-score-then-action-id',
			actionScores
		});
	}
}

export async function createHeroDecisionPreview(
	packet: HeroDecisionPacket,
	randomSeed: string
): Promise<HeroDecisionPreview> {
	const [random, scripted] = await Promise.all([
		new RandomPolicy(randomSeed).decide(packet),
		new ScriptedPolicy().decide(packet)
	]);
	return HeroDecisionPreviewSchema.parse({
		schemaVersion: HERO_DECISION_PREVIEW_VERSION,
		packet,
		policies: { random, scripted }
	});
}
