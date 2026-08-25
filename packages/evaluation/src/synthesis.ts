import {
	EngineCommandSchema,
	type ActionSource,
	type EngineGameStateV22
} from '@summonlab/contracts';
import {
	applyCommand,
	createBootstrapEngine,
	hashCanonical,
	legalActions,
	replayEventsStrict
} from '@summonlab/engine';

const runId = '27000000-0000-4000-8000-000000000001';
const sourceHeroId = '27000000-0000-4000-8000-000000000002';
const recipientHeroId = '27000000-0000-4000-8000-000000000003';
const witnessHeroId = '27000000-0000-4000-8000-000000000004';
const listenerHeroId = '27000000-0000-4000-8000-000000000005';
const manualSource: ActionSource = {
	source: 'manual',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};
const scriptedSource: ActionSource = { ...manualSource, source: 'scripted' };

function checkpoint() {
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'phase-7-synthesis-evidence',
		heroId: sourceHeroId,
		manifestHash: '1'.repeat(64),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableSynthesis: true,
			additionalHeroes: [
				{ heroId: recipientHeroId, manifestHash: '2'.repeat(64) },
				{ heroId: witnessHeroId, manifestHash: '3'.repeat(64) },
				{ heroId: listenerHeroId, manifestHash: '4'.repeat(64) }
			]
		}
	});
	if (bootstrap.snapshot.state.schemaVersion !== 22) throw new Error('Expected engine-v22');
	return { bootstrap, state: bootstrap.snapshot.state };
}

function synthesisCommand(state: EngineGameStateV22, visibility: 'private' | 'open') {
	return EngineCommandSchema.parse({
		commandId: '27000000-0000-4000-8000-000000000010',
		runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: '27000000-0000-4000-8000-000000000011',
		source: manualSource,
		commandType: 'settlement.synthesize.hero',
		sourceHeroId,
		recipientHeroId,
		visibility,
		warningVersion: 'synthesis-warning-v1',
		confirmedIrreversible: true,
		rationale: 'Prepare the company for the next tower threshold.'
	});
}

function blocked(label: string, action: () => unknown) {
	try {
		action();
		return { label, blocked: false };
	} catch {
		return { label, blocked: true };
	}
}

export function generateSynthesisReport() {
	const { bootstrap, state } = checkpoint();
	const initialActionIds = legalActions(state, state.master.masterId).map(
		(action) => action.actionId
	);
	const synthesized = applyCommand(state, synthesisCommand(state, 'private'));
	if (synthesized.state.schemaVersion !== 22) throw new Error('Expected engine-v22');
	const receipt = Object.values(synthesized.state.synthesis.receipts)[0]!;
	const rumorCommand = EngineCommandSchema.parse({
		commandId: '27000000-0000-4000-8000-000000000012',
		runId,
		actorId: recipientHeroId,
		expectedVersion: synthesized.state.version,
		correlationId: '27000000-0000-4000-8000-000000000013',
		source: scriptedSource,
		commandType: 'hero.share.synthesis.rumor',
		receiptId: receipt.receiptId,
		targetHeroId: listenerHeroId
	});
	const rumored = applyCommand(synthesized.state, rumorCommand);
	if (rumored.state.schemaVersion !== 22) throw new Error('Expected engine-v22');
	const rumor = Object.values(rumored.state.synthesis.rumors)[0]!;
	const strictReplay = replayEventsStrict([
		bootstrap.event,
		...synthesized.events,
		...rumored.events
	]);
	const checks = [
		{
			code: 'versioned-boundary',
			passed: state.schemaVersion === 22 && state.society.contentVersion === 'society-v5'
		},
		{
			code: 'explicit-confirmation',
			passed:
				receipt.warningVersion === 'synthesis-warning-v1' && receipt.confirmedIrreversible === true
		},
		{
			code: 'terminal-source',
			passed:
				rumored.state.heroes[sourceHeroId]?.lifeState === 'synthesized' &&
				rumored.state.heroes[sourceHeroId]?.health === 0
		},
		{
			code: 'bounded-progression',
			passed:
				receipt.essenceExperience === 40 &&
				rumored.state.heroes[recipientHeroId]?.progression.experience === 40
		},
		{
			code: 'identity-does-not-transfer',
			passed:
				receipt.sourceProgression.experience === 0 &&
				rumored.state.heroes[recipientHeroId]?.manifestHash === '2'.repeat(64)
		},
		{
			code: 'private-witness-boundary',
			passed:
				receipt.socialConsequences.filter((item) => item.knowledge === 'participant').length ===
					1 &&
				receipt.socialConsequences.filter((item) => item.knowledge === 'absence').length === 2
		},
		{
			code: 'rumor-provenance',
			passed:
				rumor.speakerHeroId === recipientHeroId &&
				rumor.listenerHeroId === listenerHeroId &&
				rumor.chainDepth === 1 &&
				rumor.confidence === 85
		},
		{
			code: 'social-consequence',
			passed: receipt.socialConsequences.every((item) => item.relationshipDeltas.trust < 0)
		},
		{
			code: 'canonical-events',
			passed:
				synthesized.events[0]?.eventType === 'hero.synthesized' &&
				rumored.events[0]?.eventType === 'social.synthesis.rumor.shared'
		},
		{
			code: 'strict-replay',
			passed:
				strictReplay.verified &&
				hashCanonical(strictReplay.snapshot.state) === hashCanonical(rumored.state)
		}
	];
	const adversarial = [
		blocked('false confirmation', () =>
			EngineCommandSchema.parse({
				...synthesisCommand(state, 'private'),
				confirmedIrreversible: false
			})
		),
		blocked('source equals recipient', () =>
			applyCommand(
				state,
				EngineCommandSchema.parse({
					...synthesisCommand(state, 'private'),
					recipientHeroId: sourceHeroId
				})
			)
		),
		blocked('non-Master initiator', () =>
			applyCommand(
				state,
				EngineCommandSchema.parse({
					...synthesisCommand(state, 'private'),
					actorId: recipientHeroId
				})
			)
		),
		blocked('terminal source reused', () => {
			const current = synthesized.state as EngineGameStateV22;
			return applyCommand(
				current,
				EngineCommandSchema.parse({
					...synthesisCommand(current, 'private'),
					expectedVersion: current.version,
					recipientHeroId: witnessHeroId
				})
			);
		}),
		blocked('manual hero rumor', () =>
			applyCommand(
				synthesized.state,
				EngineCommandSchema.parse({ ...rumorCommand, source: manualSource })
			)
		),
		blocked('unknown rumor receipt', () =>
			applyCommand(
				synthesized.state,
				EngineCommandSchema.parse({
					...rumorCommand,
					receiptId: '27000000-0000-4000-8000-000000000099'
				})
			)
		),
		blocked('rumor to exact witness', () =>
			applyCommand(
				synthesized.state,
				EngineCommandSchema.parse({ ...rumorCommand, targetHeroId: recipientHeroId })
			)
		)
	];
	if (checks.some((check) => !check.passed) || adversarial.some((test) => !test.blocked)) {
		throw new Error(
			`Synthesis evidence contains a failed boundary: ${JSON.stringify({ checks, adversarial })}`
		);
	}
	return {
		reportVersion: 'synthesis-evidence-v1',
		contentVersion: state.contentVersion,
		warningVersion: receipt.warningVersion,
		initialActionIds,
		checks,
		adversarial,
		receipt: {
			receiptId: receipt.receiptId,
			sourceHeroId,
			recipientHeroId,
			visibility: receipt.visibility,
			essenceExperience: receipt.essenceExperience,
			recipientLevelBefore: receipt.recipientProgressionBefore.level,
			recipientLevelAfter: receipt.recipientProgressionAfter.level,
			knowledge: receipt.socialConsequences.map((item) => ({
				heroId: item.heroId,
				knowledge: item.knowledge,
				confidence: item.confidence,
				trustDelta: item.relationshipDeltas.trust,
				fearDelta: item.relationshipDeltas.fear,
				resentmentDelta: item.relationshipDeltas.resentment
			}))
		},
		rumor: {
			rumorId: rumor.rumorId,
			speakerHeroId: rumor.speakerHeroId,
			listenerHeroId: rumor.listenerHeroId,
			confidence: rumor.confidence,
			chainDepth: rumor.chainDepth,
			originObservationId: rumor.originObservationId
		},
		replay: {
			eventTypes: strictReplay.checks.map((check) => check.eventType),
			verified: strictReplay.verified,
			stateHash: strictReplay.snapshot.stateHash
		}
	};
}
