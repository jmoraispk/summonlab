import {
	HEARTH_01_DEFINITION,
	IRON_MOON_PACKAGE,
	TOWER_BAND_01_RUNTIME_PACKAGES,
	TOWER_BAND_01_STORY_ENVELOPE,
	TOWER_FLOOR_01_PACKAGE
} from '@summonlab/content';
import type { EngineGameState, MissionPackage, SettlementDefinition } from '@summonlab/contracts';

import { ReplayIntegrityError } from '../errors.js';
import { hashCanonical } from '../hash.js';

type NavigationState = Extract<
	EngineGameState,
	{
		schemaVersion:
			| 3
			| 4
			| 5
			| 6
			| 7
			| 8
			| 9
			| 10
			| 11
			| 12
			| 13
			| 14
			| 15
			| 16
			| 17
			| 18
			| 19
			| 20
			| 21
			| 22
			| 23;
	}
>;
type MissionState = Extract<
	EngineGameState,
	{ schemaVersion: 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 }
>;

let verifiedSettlement: SettlementDefinition | undefined;
const verifiedMissions = new Map<string, MissionPackage>();
let verifiedBandStory: typeof TOWER_BAND_01_STORY_ENVELOPE | undefined;

export function verifiedStoryEnvelope(): typeof TOWER_BAND_01_STORY_ENVELOPE {
	if (verifiedBandStory) return verifiedBandStory;
	const { contentHash, ...payload } = TOWER_BAND_01_STORY_ENVELOPE;
	const calculatedHash = hashCanonical(payload);
	if (calculatedHash !== contentHash) {
		throw new Error(
			`First-band story hash drifted: expected ${contentHash}, calculated ${calculatedHash}`
		);
	}
	verifiedBandStory = TOWER_BAND_01_STORY_ENVELOPE;
	return verifiedBandStory;
}

export function verifiedSettlementContent(): SettlementDefinition {
	if (verifiedSettlement) return verifiedSettlement;
	const { contentHash, ...payload } = HEARTH_01_DEFINITION;
	const calculatedHash = hashCanonical(payload);
	if (calculatedHash !== contentHash) {
		throw new Error(
			`Hearth 01 content hash drifted: expected ${contentHash}, calculated ${calculatedHash}`
		);
	}
	verifiedSettlement = HEARTH_01_DEFINITION;
	return verifiedSettlement;
}

export function verifiedMissionContent(
	missionId = TOWER_FLOOR_01_PACKAGE.missionId
): MissionPackage {
	const cached = verifiedMissions.get(missionId);
	if (cached) return cached;
	const mission =
		missionId === IRON_MOON_PACKAGE.missionId
			? IRON_MOON_PACKAGE.mission
			: TOWER_BAND_01_RUNTIME_PACKAGES.find((candidate) => candidate.missionId === missionId);
	if (!mission) throw new Error(`Mission content is unavailable: ${missionId}`);
	const { contentHash, ...payload } = mission;
	const calculatedHash = hashCanonical(payload);
	if (calculatedHash !== contentHash) {
		throw new Error(
			`${missionId} content hash drifted: expected ${contentHash}, calculated ${calculatedHash}`
		);
	}
	if (missionId === IRON_MOON_PACKAGE.missionId) {
		const { contentHash: portalHash, ...portalPayload } = IRON_MOON_PACKAGE;
		const calculatedPortalHash = hashCanonical(portalPayload);
		if (calculatedPortalHash !== portalHash) {
			throw new Error(
				`${missionId} portal content hash drifted: expected ${portalHash}, calculated ${calculatedPortalHash}`
			);
		}
	}
	verifiedMissions.set(missionId, mission);
	return mission;
}

export function verifiedMissionBinding(missionId: string) {
	const mission = verifiedMissionContent(missionId);
	return {
		missionId,
		contentVersion: mission.contentVersion,
		contentHash:
			missionId === IRON_MOON_PACKAGE.missionId
				? IRON_MOON_PACKAGE.contentHash
				: mission.contentHash
	};
}

export function settlementForState(state: NavigationState): SettlementDefinition {
	const definition = verifiedSettlementContent();
	const binding = state.settlement.navigation;
	if (
		binding.settlementId !== definition.settlementId ||
		binding.contentVersion !== definition.contentVersion ||
		binding.contentHash !== definition.contentHash
	) {
		throw new ReplayIntegrityError('Settlement content binding is unavailable', state.eventCursor);
	}
	return definition;
}

export function missionContentForState(state: MissionState): MissionPackage {
	const mission = verifiedMissionContent(state.mission.binding.missionId);
	const binding = verifiedMissionBinding(state.mission.binding.missionId);
	if (
		state.mission.binding.missionId !== binding.missionId ||
		state.mission.binding.contentVersion !== binding.contentVersion ||
		state.mission.binding.contentHash !== binding.contentHash
	) {
		throw new ReplayIntegrityError('Mission content binding is unavailable', state.eventCursor);
	}
	return mission;
}
