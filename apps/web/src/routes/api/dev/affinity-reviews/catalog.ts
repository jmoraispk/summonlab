import type {
	AffinityWorkflowReviewCreateRequest,
	ImageProductionCatalog
} from '@summonlab/contracts';

export function reviewMatchesCurrentAffinityCandidate(
	review: AffinityWorkflowReviewCreateRequest,
	catalog: ImageProductionCatalog
): boolean {
	if (review.experimentId !== catalog.experimentId) return false;
	const candidate = catalog.entries.find((entry) => entry.targetId === review.targetId);
	return (
		candidate?.status === 'candidate' && candidate.candidateHash === review.candidateContentHash
	);
}
