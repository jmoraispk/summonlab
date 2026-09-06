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
