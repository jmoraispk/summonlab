import {
	PublicProofRunSnapshotSchema,
	PublicProofRunSnapshotV2Schema,
	type PublicProofRunSnapshot,
	type ProofRunSnapshot,
	type ProofRunSnapshotV2,
	type PublicProofRunSnapshotV2
} from '@summonlab/contracts';

export function projectProofRunForPublic(
	snapshot: ProofRunSnapshot | ProofRunSnapshotV2
): PublicProofRunSnapshot | PublicProofRunSnapshotV2 {
	const base = {
		runId: snapshot.runId,
		storyEnvelopeId: snapshot.storyEnvelopeId,
		controlMode: snapshot.controlMode,
		manifest: snapshot.manifest,
		manifestHash: snapshot.manifestHash,
		firstObservation: snapshot.firstObservation,
		firstLine: snapshot.firstLine,
		destination: snapshot.destination,
		storyBranch: snapshot.storyBranch,
		arrived: snapshot.arrived,
		events: snapshot.events.map((event) => ({
			eventId: event.eventId,
			sequence: event.sequence,
			eventType: event.eventType,
			summary: event.summary,
			decisionSource: event.decisionSource,
			eventHash: event.eventHash,
			createdAt: event.createdAt
		})),
		createdAt: snapshot.createdAt
	};
	if (!('characterSchemaVersion' in snapshot)) return PublicProofRunSnapshotSchema.parse(base);
	return PublicProofRunSnapshotV2Schema.parse({
		...base,
		characterSchemaVersion: snapshot.characterSchemaVersion,
		capabilityProfile: {
			profileVersion: snapshot.capabilityProfile.profileVersion,
			attributes: snapshot.capabilityProfile.attributes
		}
	});
}

export function projectProofResilience(snapshot: ProofRunSnapshot | ProofRunSnapshotV2): {
	readonly label: 'Resolve' | 'Vitality';
	readonly displayValue: number;
	readonly percentage: number;
} {
	if ('characterSchemaVersion' in snapshot) {
		const vitality = snapshot.capabilityProfile.attributes.vitality;
		return { label: 'Vitality', displayValue: vitality, percentage: vitality };
	}
	const resolve = snapshot.mind.aptitudes.resolve;
	return { label: 'Resolve', displayValue: resolve, percentage: resolve * 10 };
}
