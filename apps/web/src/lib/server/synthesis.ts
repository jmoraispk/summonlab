import type { EngineGameStateV22 } from '@summonlab/contracts';
import { legalActions } from '@summonlab/engine';

function short(value: string) {
	return value.slice(0, 8).toUpperCase();
}

export function synthesisView(state: EngineGameStateV22, stateHash: string) {
	const latestReceipt = Object.values(state.synthesis.receipts).at(-1) ?? null;
	const latestRumor = Object.values(state.synthesis.rumors).at(-1) ?? null;
	const heroes = Object.values(state.heroes)
		.sort((left, right) => left.heroId.localeCompare(right.heroId))
		.map((hero, index) => {
			const relationship = Object.values(state.society.relationships).find(
				(candidate) =>
					candidate.fromHeroId === hero.heroId && candidate.toEntityId === state.master.masterId
			);
			const consequence = latestReceipt?.socialConsequences.find(
				(candidate) => candidate.heroId === hero.heroId
			);
			const beliefs = Object.values(state.society.beliefs)
				.filter((belief) => belief.holderHeroId === hero.heroId)
				.filter((belief) =>
					['was-synthesized-into', 'is-missing-after-gate-call'].includes(belief.predicate)
				)
				.map((belief) => ({
					predicate: belief.predicate,
					confidence: belief.confidence,
					provenance: belief.provenance
				}));
			return {
				heroId: hero.heroId,
				callsign: `${['ASH', 'EMBER', 'VEIL', 'WARD'][index] ?? 'HERO'}—${short(hero.heroId)}`,
				lifeState: hero.lifeState,
				stars: hero.progression.stars,
				level: hero.progression.level,
				experience: hero.progression.experience,
				synthesisEssenceExperience: 20 + hero.progression.stars * 15 + hero.progression.level * 5,
				primaryValue: hero.mind.primaryValue,
				primaryDrive: hero.mind.primaryDrive,
				socialStyle: hero.mind.socialStyle,
				relationship: relationship?.dimensions ?? null,
				knowledge: consequence?.knowledge ?? null,
				beliefs
			};
		});
	const rumorOptions = latestReceipt
		? heroes.flatMap((speaker) =>
				legalActions(state, speaker.heroId)
					.filter((action) => action.tags.includes('rumor'))
					.map((action) => ({
						speakerHeroId: speaker.heroId,
						targetHeroId: action.targetIds[0]!,
						receiptId: latestReceipt.receiptId
					}))
			)
		: [];
	return {
		runId: state.runId,
		version: state.version,
		eventCursor: state.eventCursor,
		stateHash,
		contentVersion: state.contentVersion,
		warning: {
			version: 'synthesis-warning-v1' as const,
			title: 'This consumes a hero permanently.',
			body: 'Their memories and personality will not transfer. The recipient gains bounded essence; witnesses and rumors remember the choice.'
		},
		heroes,
		latestReceipt,
		latestRumor,
		rumorCount: Object.keys(state.synthesis.rumors).length,
		rumorOptions,
		canSynthesize: legalActions(state, state.master.masterId).some(
			(action) => action.actionId === 'settlement.synthesis.commit'
		)
	};
}
