import {
	PublicProofRunSnapshotSchema,
	PublicProofRunSnapshotV2Schema,
	type CharacterManifest,
	type ProofRunSnapshot,
	type ProofRunSnapshotV2,
	type PublicProofRunSnapshot,
	type PublicProofRunSnapshotV2
} from '@summonlab/contracts';
import { hashCanonical } from '@summonlab/engine';

function publicProjectionHash(kind: 'proof-event' | 'proof-manifest', projection: unknown): string {
	return hashCanonical({
		publicProjectionHashVersion: 'public-projection-hash-v1',
		kind,
		projection
	});
}

export function projectProofManifestForPublic(manifest: CharacterManifest) {
	const projection = {
		characterId: manifest.characterId,
		displayName: manifest.displayName,
		rarityStars: manifest.rarityStars,
		adultAge: manifest.adultAge,
		heightCm: manifest.heightCm,
		bodyBuild: manifest.bodyBuild,
		voiceCadence: manifest.voice.cadence,
		posture: manifest.posture,
		artKey: manifest.artKey
	};
	return {
		manifest: projection,
		publicManifestHash: publicProjectionHash('proof-manifest', projection)
	};
}

export function projectProofRunForPublic(
	snapshot: ProofRunSnapshot | ProofRunSnapshotV2
): PublicProofRunSnapshot | PublicProofRunSnapshotV2 {
	const { manifest, publicManifestHash } = projectProofManifestForPublic(snapshot.manifest);
	const base = {
		runId: snapshot.runId,
		storyEnvelopeId: snapshot.storyEnvelopeId,
		controlMode: snapshot.controlMode,
		manifest,
		publicManifestHash,
		firstObservation: snapshot.firstObservation,
		firstLine: snapshot.firstLine,
		destination: snapshot.destination,
		storyBranch: snapshot.storyBranch,
		arrived: snapshot.arrived,
		events: snapshot.events.map((event) => {
			const publicEvent = {
				eventId: event.eventId,
				sequence: event.sequence,
				eventType: event.eventType,
				summary: event.summary,
				decisionSource: event.decisionSource,
				createdAt: event.createdAt
			};
			return {
				...publicEvent,
				publicEventHash: publicProjectionHash('proof-event', publicEvent)
			};
		}),
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
