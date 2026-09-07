import {
	StoryBeatEligibilityReportSchema,
	StoryBeatHistorySchema,
	StoryExpressionCastMemberSchema,
	StoryExpressionResolutionSchema,
	TowerBandStoryEnvelopeSchema,
	type CharacterMind,
	type MissionPackage,
	type StoryBeatEligibilityReport,
	type StoryBeatHistory,
	type StoryExpressionCastMember,
	type StoryExpressionFrame,
	type StoryExpressionResolution,
	type TowerBandStoryEnvelope
} from '@summonlab/contracts';

import { TOWER_BAND_01_RUNTIME_PACKAGES } from './tower-band-01.js';

export const TOWER_BAND_01_STORY_CONTENT_VERSION = 'tower-band-01-story-v1';

const forbiddenChanges = [
	'world-laws',
	'primary-objective',
	'arena-truth',
	'reward-budget',
	'required-anchors'
] as const;

const expressionPreferences = [
	{
		purpose: 'testimony',
		allowedFrames: ['operational', 'analytical', 'relational', 'plain'],
		preferredValues: ['duty', 'knowledge', 'belonging'],
		preferredDrives: ['understand', 'connect', 'protect']
	},
	{
		purpose: 'warning',
		allowedFrames: ['operational', 'relational', 'cautious', 'plain'],
		preferredValues: ['duty', 'mercy', 'belonging'],
		preferredDrives: ['protect', 'survive', 'connect']
	},
	{
		purpose: 'reflection',
		allowedFrames: ['analytical', 'relational', 'defiant', 'cautious'],
		preferredValues: ['mercy', 'freedom', 'belonging'],
		preferredDrives: ['survive', 'protect', 'connect']
	},
	{
		purpose: 'interpretation',
		allowedFrames: ['analytical', 'operational', 'defiant', 'plain'],
		preferredValues: ['knowledge', 'mastery', 'duty'],
		preferredDrives: ['understand', 'create', 'prove']
	},
	{
		purpose: 'challenge',
		allowedFrames: ['defiant', 'operational', 'relational', 'cautious'],
		preferredValues: ['freedom', 'duty', 'mercy'],
		preferredDrives: ['prove', 'protect', 'survive']
	}
] as const;

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

function beatCatalog(missions: readonly MissionPackage[]) {
	return missions.flatMap((mission, missionIndex) => {
		const priorMission = missions[missionIndex - 1];
		const priorFinalBeatId = priorMission?.story.defaultBeatOrder.at(-1);
		const firstBeatId = mission.story.defaultBeatOrder[0];
		const anchors = new Map(
			mission.story.anchors.map((anchor) => [anchor.beatId, anchor.anchorId])
		);
		return mission.story.beats.map((beat) => ({
			...beat,
			missionId: mission.missionId,
			floor: mission.tower!.floor,
			floorInBand: mission.tower!.floorInBand,
			eligibleAfterBeatIds:
				beat.beatId === firstBeatId && priorFinalBeatId
					? [...beat.eligibleAfterBeatIds, priorFinalBeatId]
					: [...beat.eligibleAfterBeatIds],
			anchorId: anchors.get(beat.beatId) ?? null
		}));
	});
}

function anchorCatalog(missions: readonly MissionPackage[]) {
	let order = 0;
	return missions.flatMap((mission) =>
		[...mission.story.anchors]
			.sort((left, right) => left.order - right.order)
			.map((anchor) => ({
				...anchor,
				order: (order += 1),
				missionId: mission.missionId,
				floor: mission.tower!.floor
			}))
	);
}

function storySource(missions: readonly MissionPackage[]) {
	const beats = beatCatalog(missions);
	const anchors = anchorCatalog(missions);
	const proposals = missions.flatMap((mission) =>
		mission.story.proposalCatalog.map((proposal) => ({
			...proposal,
			missionId: mission.missionId,
			floor: mission.tower!.floor
		}))
	);
	const patchSlots = missions.flatMap((mission) =>
		mission.story.patchSlots.map((slot) => ({
			...slot,
			missionId: mission.missionId,
			floor: mission.tower!.floor
		}))
	);
	const expressionHooks = missions.map((mission, index) => {
		const recoveryBeat = mission.story.beats.find((beat) => beat.kind === 'recovery')!;
		const anchor = mission.story.anchors.find(
			(candidate) => candidate.beatId === recoveryBeat.beatId
		)!;
		const preferences = expressionPreferences[index]!;
		return {
			hookId: `${anchor.anchorId}-expression`,
			anchorId: anchor.anchorId,
			...preferences
		};
	});
	const floor05 = missions[4]!;
	const floor05Confrontation = floor05.story.beats.find((beat) => beat.kind === 'confrontation')!;
	const floor05Recovery = floor05.story.beats.find((beat) => beat.kind === 'recovery')!;
	const floor05Extraction = floor05.story.beats.find((beat) => beat.kind === 'extraction')!;
	const rewardBudget = missions.reduce((sum, mission) => sum + mission.rewards.budgetPoints, 0);
	const rewardCost = missions.reduce(
		(sum, mission) =>
			sum + mission.rewards.grants.reduce((floorSum, grant) => floorSum + grant.budgetCost, 0),
		0
	);

	return {
		schemaVersion: 'tower-band-story-envelope-v1',
		contentVersion: TOWER_BAND_01_STORY_CONTENT_VERSION,
		envelopeId: 'first-band-unclaimed-authority',
		towerBand: { band: 1, firstFloor: 1, lastFloor: 5 },
		storySpineId: 'band-one-unclaimed-authority',
		title: 'The Authority No One Gave You',
		theme:
			'Authority begins as an emergency claim, becomes a burden shared with strangers, and is judged by preparation, trust, and who survives its exercise.',
		emotionalQuestion:
			'Will the summoned company obey because the Master is strong, cooperate because the settlement needs them, or decide that authority must be earned?',
		worldLaws: [
			{
				lawId: 'death-is-permanent',
				statement: 'A dead hero or Master cannot be restored by story direction or mission reward.',
				enforcedBy: 'engine'
			},
			{
				lawId: 'retreat-remains-history',
				statement:
					'Retreat ends an attempt but preserves its bodily, social, and informational consequences.',
				enforcedBy: 'aftermath'
			},
			{
				lawId: 'knowledge-has-a-holder',
				statement:
					'A discovery may influence a later beat only through a living character who holds its evidence.',
				enforcedBy: 'knowledge'
			},
			{
				lawId: 'objectives-remain-authored',
				statement:
					'Optional expression and complications cannot replace a floor primary objective.',
				enforcedBy: 'content'
			},
			{
				lawId: 'rewards-follow-extraction',
				statement:
					'Only authored triggers and successful extraction can grant the fixed band rewards.',
				enforcedBy: 'engine'
			}
		],
		openingState: {
			settlementId: 'hearth-01',
			establishedFacts: [
				'Hearth 01 is a walled settlement with no government and only the systems the Master has restored.',
				'New summons arrive as adults without a shared history or automatic recognition of the Master.',
				'The Endless Tower is the only known route to the First Ember and the power the settlement needs.'
			],
			unresolvedGoalIds: [
				'restore-hearth-systems',
				'understand-tower-records',
				'earn-company-recognition'
			]
		},
		beats,
		defaultBeatOrder: missions.flatMap((mission) => mission.story.defaultBeatOrder),
		anchors,
		proposals,
		patchSlots,
		expressionHooks,
		finaleConstraints: [
			{
				constraintId: 'warden-conflict-cannot-be-skipped',
				summary: 'The company must confront and defeat the authored Foundry Warden.',
				requiredBeatIds: [floor05Confrontation.beatId],
				enforcedBy: 'encounter'
			},
			{
				constraintId: 'archive-truth-survives-victory',
				summary: 'Victory reveals that Hearth 01 was not the first settlement.',
				requiredBeatIds: [floor05Recovery.beatId],
				enforcedBy: 'aftermath'
			},
			{
				constraintId: 'band-rewards-require-extraction',
				summary: 'The relight core and archive fragment become canonical only through extraction.',
				requiredBeatIds: [floor05Extraction.beatId],
				enforcedBy: 'extraction'
			}
		],
		contentCatalog: {
			missionBindings: missions.map((mission) => ({
				missionId: mission.missionId,
				floor: mission.tower!.floor,
				contentVersion: mission.contentVersion,
				contentHash: mission.contentHash,
				primaryObjectiveId: mission.objectives.find((objective) => objective.primary)!.objectiveId
			})),
			discoveries: missions.flatMap((mission) =>
				mission.arena.discoveries.map((discovery) => ({
					missionId: mission.missionId,
					discoveryId: discovery.discoveryId
				}))
			),
			enemyPolicyIds: [
				...new Set(
					missions.flatMap((mission) => mission.monsterDuties.map((duty) => duty.policyId))
				)
			],
			rewardGrants: missions.flatMap((mission) =>
				mission.rewards.grants.map((grant) => ({
					missionId: mission.missionId,
					grantId: grant.grantId
				}))
			)
		},
		rewardBudget: { budgetPoints: rewardBudget, declaredCost: rewardCost },
		forbiddenChanges,
		contentHash: 'e7b59f5c06e4549fb542b40bf0d64f54da87428bbd1fb82b98ebf69dc50b1e6d'
	};
}

export const TOWER_BAND_01_STORY_ENVELOPE = deepFreeze(
	TowerBandStoryEnvelopeSchema.parse(storySource(TOWER_BAND_01_RUNTIME_PACKAGES))
);

export async function calculateTowerBandStoryContentHash(
	envelope: TowerBandStoryEnvelope
): Promise<string> {
	const payload: Partial<TowerBandStoryEnvelope> = { ...envelope };
	delete payload.contentHash;
	const digest = await globalThis.crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(canonicalJson(payload))
	);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

let verifiedEnvelope: Promise<TowerBandStoryEnvelope> | undefined;

export function loadTowerBand01StoryEnvelope(): Promise<TowerBandStoryEnvelope> {
	verifiedEnvelope ??= (async () => {
		const calculated = await calculateTowerBandStoryContentHash(TOWER_BAND_01_STORY_ENVELOPE);
		if (calculated !== TOWER_BAND_01_STORY_ENVELOPE.contentHash) {
			throw new Error(
				`Tower Band 01 story hash drifted: expected ${TOWER_BAND_01_STORY_ENVELOPE.contentHash}, calculated ${calculated}`
			);
		}
		return TOWER_BAND_01_STORY_ENVELOPE;
	})();
	return verifiedEnvelope;
}

export function evaluateStoryBeatEligibility(
	sourceEnvelope: TowerBandStoryEnvelope,
	sourceHistory: StoryBeatHistory
): StoryBeatEligibilityReport {
	const envelope = TowerBandStoryEnvelopeSchema.parse(sourceEnvelope);
	const history = StoryBeatHistorySchema.parse(sourceHistory);
	if (
		history.unlockedFloor < envelope.towerBand.firstFloor ||
		history.unlockedFloor > envelope.towerBand.lastFloor
	) {
		throw new Error('Story history unlocked floor lies outside its envelope');
	}
	const beats = new Map(envelope.beats.map((beat) => [beat.beatId, beat]));
	const proposals = new Map(envelope.proposals.map((proposal) => [proposal.proposalId, proposal]));
	const completed = new Set(history.completedBeatIds);
	const activated = new Set(history.activatedProposalIds);
	for (const beatId of completed) {
		const beat = beats.get(beatId);
		if (!beat || beat.floor > history.unlockedFloor) {
			throw new Error(`Completed story beat is not available: ${beatId}`);
		}
		if (beat.eligibleAfterBeatIds.some((dependencyId) => !completed.has(dependencyId))) {
			throw new Error(`Completed story beat lacks its causal dependency: ${beatId}`);
		}
	}
	for (const proposalId of activated) {
		const proposal = proposals.get(proposalId);
		if (!proposal || proposal.floor > history.unlockedFloor) {
			throw new Error(`Activated story proposal is not available: ${proposalId}`);
		}
	}
	for (const beat of envelope.beats.filter(
		(candidate) => !candidate.required && completed.has(candidate.beatId)
	)) {
		if (![...activated].some((proposalId) => proposals.get(proposalId)?.beatId === beat.beatId)) {
			throw new Error(`Completed optional beat was not activated: ${beat.beatId}`);
		}
	}
	for (const slot of envelope.patchSlots) {
		const selected = slot.allowedProposalIds.filter((proposalId) => activated.has(proposalId));
		if (selected.length > slot.maximumSelections) {
			throw new Error(`Story patch slot selection bound exceeded: ${slot.slotId}`);
		}
		if (selected.length > 0) {
			const afterBeatId = envelope.anchors.find(
				(anchor) => anchor.anchorId === slot.afterAnchorId
			)!.beatId;
			const beforeBeatId = envelope.anchors.find(
				(anchor) => anchor.anchorId === slot.beforeAnchorId
			)!.beatId;
			if (!completed.has(afterBeatId)) {
				throw new Error(`Story patch slot has not reached its opening anchor: ${slot.slotId}`);
			}
			if (
				completed.has(beforeBeatId) &&
				selected.some((proposalId) => !completed.has(proposals.get(proposalId)!.beatId))
			) {
				throw new Error(`Story patch slot expired before its selected beat: ${slot.slotId}`);
			}
		}
	}
	for (const proposalId of activated) {
		if (!envelope.patchSlots.some((slot) => slot.allowedProposalIds.includes(proposalId))) {
			throw new Error(`Activated proposal has no authored patch slot: ${proposalId}`);
		}
	}

	const records = envelope.beats.map((beat) => {
		const activation = envelope.proposals.find(
			(proposal) => proposal.beatId === beat.beatId && activated.has(proposal.proposalId)
		);
		const missingDependencyIds = beat.eligibleAfterBeatIds.filter(
			(dependencyId) => !completed.has(dependencyId)
		);
		const status = completed.has(beat.beatId)
			? ('completed' as const)
			: beat.floor > history.unlockedFloor
				? ('locked-floor' as const)
				: !beat.required && !activation
					? ('optional-dormant' as const)
					: missingDependencyIds.length > 0
						? ('locked-dependency' as const)
						: ('eligible' as const);
		return {
			beatId: beat.beatId,
			missionId: beat.missionId,
			floor: beat.floor,
			required: beat.required,
			status,
			missingDependencyIds,
			activatedByProposalId: activation?.proposalId ?? null
		};
	});
	const recordById = new Map(records.map((record) => [record.beatId, record]));
	const nextDefaultBeatId =
		envelope.defaultBeatOrder.find((beatId) => recordById.get(beatId)?.status === 'eligible') ??
		null;
	return StoryBeatEligibilityReportSchema.parse({
		reportVersion: 'story-beat-eligibility-v1',
		envelopeId: envelope.envelopeId,
		envelopeContentHash: envelope.contentHash,
		history,
		records,
		nextDefaultBeatId
	});
}

const deliveryBriefs: Record<StoryExpressionFrame, string> = {
	operational:
		'Deliver the fixed fact as an actionable company constraint; add no new event or order.',
	analytical:
		'Deliver the fixed fact as evidence to interpret; distinguish observation from inference.',
	relational:
		'Deliver the fixed fact through its effect on trust and survival; do not change causality.',
	defiant:
		'Deliver the fixed fact as a challenge to claimed authority; preserve the fact verbatim.',
	cautious: 'Deliver the fixed fact as a risk warning; do not imply knowledge the speaker lacks.',
	plain: 'State the fixed fact without embellishment, prediction, or invented context.'
};

const habitGestures: Record<CharacterMind['dailyHabit'], string> = {
	'checks-exits': 'Checks the nearest exit before speaking.',
	'stretches-at-dawn': 'Rolls one shoulder as if preparing for the next effort.',
	'shares-breakfast': 'Leaves room beside them, making the statement communal.',
	'catalogs-tools': 'Touches each carried tool in sequence before naming the fact.',
	'walks-the-walls': 'Looks toward the perimeter and measures the distance home.',
	'practices-knots': 'Tightens a familiar knot while choosing the exact words.'
};

const linePrefixes: Record<CharacterMind['socialStyle'], string> = {
	reserved: 'I noticed one thing.',
	direct: 'Then this is what matters:',
	warm: 'Remember this together:',
	wry: 'A charming rule:',
	formal: 'Let the record show:',
	inquisitive: 'Start with what we know:'
};

function frameScore(
	mind: CharacterMind,
	frame: StoryExpressionFrame,
	preferredValues: readonly CharacterMind['primaryValue'][],
	preferredDrives: readonly CharacterMind['primaryDrive'][]
): number {
	const base = {
		operational:
			mind.personality.conscientiousness +
			mind.aptitudes.resolve * 8 +
			(['duty', 'mastery'].includes(mind.primaryValue) ? 45 : 0) +
			(['protect', 'prove'].includes(mind.primaryDrive) ? 30 : 0),
		analytical:
			mind.personality.openness +
			mind.aptitudes.insight * 8 +
			(mind.primaryValue === 'knowledge' ? 45 : 0) +
			(['understand', 'create'].includes(mind.primaryDrive) ? 30 : 0),
		relational:
			mind.personality.agreeableness +
			Math.round(mind.personality.extraversion / 2) +
			(['belonging', 'mercy'].includes(mind.primaryValue) ? 45 : 0) +
			(['connect', 'protect'].includes(mind.primaryDrive) ? 30 : 0),
		defiant:
			mind.personality.extraversion +
			mind.aptitudes.resolve * 7 +
			(mind.primaryValue === 'freedom' ? 45 : 0) +
			(mind.primaryDrive === 'prove' || mind.stressResponse === 'confront' ? 30 : 0),
		cautious:
			mind.aptitudes.insight * 8 +
			mind.personality.emotionalVolatility +
			(mind.primaryDrive === 'survive' ? 45 : 0) +
			(['observe', 'prepare', 'withdraw'].includes(mind.stressResponse) ? 30 : 0),
		plain: 80 + mind.aptitudes.resolve * 2
	}[frame];
	return (
		base +
		(preferredValues.includes(mind.primaryValue) ? 25 : 0) +
		(preferredDrives.includes(mind.primaryDrive) ? 20 : 0)
	);
}

export function resolveStoryExpression(
	sourceEnvelope: TowerBandStoryEnvelope,
	hookId: string,
	sourceCast: readonly StoryExpressionCastMember[]
): StoryExpressionResolution | null {
	const envelope = TowerBandStoryEnvelopeSchema.parse(sourceEnvelope);
	const hook = envelope.expressionHooks.find((candidate) => candidate.hookId === hookId);
	if (!hook) throw new Error(`Unknown story expression hook: ${hookId}`);
	const anchor = envelope.anchors.find((candidate) => candidate.anchorId === hook.anchorId)!;
	const cast = sourceCast.map((member) => StoryExpressionCastMemberSchema.parse(member));
	if (new Set(cast.map((member) => member.characterId)).size !== cast.length) {
		throw new Error('Story expression cast ids must be unique');
	}
	const candidates = cast
		.filter(
			(member) => member.lifeState === 'active' && member.knownAnchorIds.includes(anchor.anchorId)
		)
		.map((member) => {
			const frame = [...hook.allowedFrames]
				.map((candidate) => ({
					frame: candidate,
					score: frameScore(member.mind, candidate, hook.preferredValues, hook.preferredDrives)
				}))
				.sort(
					(left, right) => right.score - left.score || left.frame.localeCompare(right.frame)
				)[0]!;
			return { member, ...frame };
		})
		.sort(
			(left, right) =>
				right.score - left.score || left.member.characterId.localeCompare(right.member.characterId)
		);
	const selected = candidates[0];
	if (!selected) return null;
	const { member, frame, score } = selected;
	return StoryExpressionResolutionSchema.parse({
		resolutionVersion: 'story-expression-resolution-v1',
		hookId: hook.hookId,
		anchorId: anchor.anchorId,
		immutableFact: anchor.immutableFact,
		speakerId: member.characterId,
		speakerName: member.displayName,
		frame,
		spokenLine: `${linePrefixes[member.mind.socialStyle]} ${anchor.immutableFact}`,
		deliveryBrief: deliveryBriefs[frame],
		habitGesture: habitGestures[member.mind.dailyHabit],
		selectionScore: score,
		selectionBasis: [
			`knowledge:${anchor.anchorId}`,
			`value:${member.mind.primaryValue}`,
			`drive:${member.mind.primaryDrive}`,
			`style:${member.mind.socialStyle}`,
			`habit:${member.mind.dailyHabit}`
		]
	});
}
