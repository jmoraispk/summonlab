import { hashCanonical } from '@summonlab/engine';
import { z } from 'zod';

import {
	MODERATED_PLAYTEST_REQUIRED_SESSIONS,
	ModeratedPlaytestReportSchema,
	type ModeratedPlaytestReport
} from './moderated-playtest.js';

export const PLAYTEST_RELEASE_REPORT_VERSION = 'playtest-release-report-v1' as const;
export const PLAYTEST_RELEASE_ID = 'fin008-private-playtest-v1' as const;

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const PlaytestReleaseCheckSchema = z
	.object({
		checkId: z.enum([
			'evidence-integrity',
			'human-sessions',
			'assigned-task-coverage',
			'release-findings'
		]),
		status: z.enum(['pass', 'hold']),
		detail: z.string().min(1)
	})
	.strict();

export const PlaytestReleaseReportSchema = z
	.object({
		schemaVersion: z.literal(PLAYTEST_RELEASE_REPORT_VERSION),
		releaseId: z.literal(PLAYTEST_RELEASE_ID),
		generatedFrom: z
			.object({
				moderatedPlaytestSchemaVersion: z.literal('moderated-playtest-report-v1'),
				moderatedPlaytestReportHash: HashSchema,
				cohortId: z.literal('fin007-local-private-v1')
			})
			.strict(),
		status: z.enum(['held', 'ready-to-package']),
		checks: z.array(PlaytestReleaseCheckSchema).length(4),
		blockers: z.array(z.string().min(1)),
		packagePlan: z
			.object({
				archiveName: z.literal('summonlab-fin008-private-playtest.tar.gz'),
				command: z.literal('pnpm package:playtest --acknowledge-private-release'),
				contents: z.array(z.string().min(1)).min(1),
				excludes: z.array(z.string().min(1)).min(1),
				artifactReceiptRequired: z.literal(true)
			})
			.strict(),
		reportHash: HashSchema
	})
	.strict()
	.superRefine((report, context) => {
		const heldChecks = report.checks.filter((check) => check.status === 'hold');
		if (report.status === 'held' && heldChecks.length === 0) {
			context.addIssue({
				code: 'custom',
				path: ['status'],
				message: 'A held release needs a held check'
			});
		}
		if (
			report.status === 'ready-to-package' &&
			(heldChecks.length > 0 || report.blockers.length > 0)
		) {
			context.addIssue({
				code: 'custom',
				path: ['status'],
				message: 'A release with blockers cannot be ready to package'
			});
		}
	});

export type PlaytestReleaseReport = z.infer<typeof PlaytestReleaseReportSchema>;

function moderatedReportHash(report: ModeratedPlaytestReport): string {
	const unsigned: Partial<ModeratedPlaytestReport> = { ...report };
	delete unsigned.reportHash;
	return hashCanonical(unsigned);
}

export function createPlaytestReleaseReport(input: ModeratedPlaytestReport): PlaytestReleaseReport {
	const moderated = ModeratedPlaytestReportSchema.parse(input);
	const actualEvidenceHash = moderatedReportHash(moderated);
	const evidenceIntact = actualEvidenceHash === moderated.reportHash;
	const sessionsComplete =
		moderated.moderationStatus === 'complete' &&
		moderated.qualityGate.conductedSessionCount === MODERATED_PLAYTEST_REQUIRED_SESSIONS;
	const taskCoverageComplete =
		moderated.qualityGate.coveredTaskCount === moderated.qualityGate.requiredTaskCount &&
		moderated.qualityGate.allAssignedTasksObserved;
	const findingsClear =
		moderated.releaseRecommendation === 'candidate' &&
		moderated.qualityGate.openReleaseBlockerCount === 0;

	const checks = [
		{
			checkId: 'evidence-integrity' as const,
			status: evidenceIntact ? ('pass' as const) : ('hold' as const),
			detail: evidenceIntact
				? `FIN-007 evidence hash verified: ${moderated.reportHash.slice(0, 16)}.`
				: 'FIN-007 evidence content does not match its recorded report hash.'
		},
		{
			checkId: 'human-sessions' as const,
			status: sessionsComplete ? ('pass' as const) : ('hold' as const),
			detail: `${moderated.qualityGate.conductedSessionCount}/${MODERATED_PLAYTEST_REQUIRED_SESSIONS} de-identified moderated sessions recorded.`
		},
		{
			checkId: 'assigned-task-coverage' as const,
			status: taskCoverageComplete ? ('pass' as const) : ('hold' as const),
			detail: `${moderated.qualityGate.coveredTaskCount}/${moderated.qualityGate.requiredTaskCount} task families observed; assigned coverage ${moderated.qualityGate.allAssignedTasksObserved ? 'complete' : 'incomplete'}.`
		},
		{
			checkId: 'release-findings' as const,
			status: findingsClear ? ('pass' as const) : ('hold' as const),
			detail: `${moderated.qualityGate.openReleaseBlockerCount} unverified P0/P1 findings; FIN-007 recommendation ${moderated.releaseRecommendation}.`
		}
	];
	const blockers = checks.filter((check) => check.status === 'hold').map((check) => check.detail);
	const unsigned = {
		schemaVersion: PLAYTEST_RELEASE_REPORT_VERSION,
		releaseId: PLAYTEST_RELEASE_ID,
		generatedFrom: {
			moderatedPlaytestSchemaVersion: moderated.schemaVersion,
			moderatedPlaytestReportHash: moderated.reportHash,
			cohortId: moderated.cohortId
		},
		status: blockers.length === 0 ? ('ready-to-package' as const) : ('held' as const),
		checks,
		blockers,
		packagePlan: {
			archiveName: 'summonlab-fin008-private-playtest.tar.gz' as const,
			command: 'pnpm package:playtest --acknowledge-private-release' as const,
			contents: [
				'production web server build',
				'production worker build',
				'database migrations and locked workspace manifests',
				'private operator runbook',
				'SHA-256 artifact receipt bound to the packaged commit'
			],
			excludes: [
				'participant identities, recordings, direct quotations, and raw moderator notes',
				'local environment secrets and development evidence',
				'unoptimized source artwork'
			],
			artifactReceiptRequired: true as const
		}
	};

	return PlaytestReleaseReportSchema.parse({ ...unsigned, reportHash: hashCanonical(unsigned) });
}

export function assertPlaytestReleaseReady(report: PlaytestReleaseReport): void {
	const parsed = PlaytestReleaseReportSchema.parse(report);
	const unsigned: Partial<PlaytestReleaseReport> = { ...parsed };
	delete unsigned.reportHash;
	if (hashCanonical(unsigned) !== parsed.reportHash) {
		throw new Error('Playtest release report content does not match its report hash.');
	}
	if (parsed.status !== 'ready-to-package') {
		throw new Error(`Playtest release is held: ${parsed.blockers.join(' | ')}`);
	}
}
