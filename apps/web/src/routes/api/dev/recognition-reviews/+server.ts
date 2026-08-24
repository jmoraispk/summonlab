import { getConfig } from '@summonlab/config';
import {
	RecognitionReviewCreateRequestSchema,
	RecognitionReviewListSchema,
	VisualRecognitionAuditSchema
} from '@summonlab/contracts';
import {
	RecognitionReviewIdempotencyConflictError,
	createRecognitionReview,
	listRecognitionReviews
} from '@summonlab/database';
import { json } from '@sveltejs/kit';
import recognitionAuditSource from '../../../../../../../assets/heroes/visuals/recognition-audit.json';

import type { RequestHandler } from './$types';

const audit = VisualRecognitionAuditSchema.parse(recognitionAuditSource);

export const GET: RequestHandler = async ({ url }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		const reviews = await listRecognitionReviews(getConfig().databaseUrl, audit.auditHash, {
			includeAutomated: url.searchParams.get('includeAutomated') === 'true'
		});
		return json(RecognitionReviewListSchema.parse(reviews), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		return json(
			{
				message: 'Recognition review history is unavailable. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const parsed = RecognitionReviewCreateRequestSchema.safeParse(
		await request.json().catch(() => null)
	);
	if (!parsed.success) {
		return json(
			{ message: 'The recognition review is invalid.', issues: parsed.error.issues },
			{ status: 400 }
		);
	}
	const auditCase = audit.cases.find((candidate) => candidate.caseId === parsed.data.caseId);
	const submittedCues = new Set(parsed.data.outcomes.map((outcome) => outcome.cue));
	if (
		parsed.data.auditHash !== audit.auditHash ||
		parsed.data.catalogVersion !== audit.catalogVersion ||
		parsed.data.characterId !== audit.characterId ||
		!auditCase ||
		submittedCues.size !== auditCase.requiredCues.length ||
		auditCase.requiredCues.some((cue) => !submittedCues.has(cue))
	) {
		return json(
			{ message: 'The recognition audit changed. Reload it before recording evidence.' },
			{ status: 409 }
		);
	}

	try {
		const result = await createRecognitionReview(getConfig().databaseUrl, parsed.data);
		return json(result.review, {
			status: result.created ? 201 : 200,
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		if (error instanceof RecognitionReviewIdempotencyConflictError) {
			return json({ message: error.message }, { status: 409 });
		}
		return json(
			{
				message: 'The recognition review could not be persisted.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};
