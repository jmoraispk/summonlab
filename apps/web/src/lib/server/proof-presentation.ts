import {
	ProofRunSnapshotSchema,
	PublicProofRunSnapshotV2Schema,
	type ProofRunSnapshot,
	type ProofRunSnapshotV2,
	type PublicProofRunSnapshotV2
} from '@summonlab/contracts';

export function projectProofRunForPublic(
	snapshot: ProofRunSnapshot | ProofRunSnapshotV2
): ProofRunSnapshot | PublicProofRunSnapshotV2 {
	if (!('characterSchemaVersion' in snapshot)) return ProofRunSnapshotSchema.parse(snapshot);
	return PublicProofRunSnapshotV2Schema.parse({
		...snapshot,
		capabilityProfile: {
			profileVersion: snapshot.capabilityProfile.profileVersion,
			attributes: snapshot.capabilityProfile.attributes
		}
	});
}
