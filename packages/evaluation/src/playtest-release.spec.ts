import { describe, expect, it } from 'vitest';

import {
	OWNER_PLAYTEST_PLAN,
	OwnerPlaytestSourceSchema,
	createEmptyOwnerPlaytestSource,
	createOwnerPlaytestReport,
	type OwnerPlaytestSession
} from './moderated-playtest.js';
import {
	PlaytestPackageReceiptSchema,
	PlaytestReleaseReportSchema,
	assertPlaytestReleaseReady,
	createPlaytestReleaseReport
} from './playtest-release.js';

function completedSession(): OwnerPlaytestSession {
	return {
		sessionCode: 'OWNER-01',
		track: 'owner-vertical-slice',
		buildCommit: 'a'.repeat(40),
		disposition: 'completed',
		taskResults: OWNER_PLAYTEST_PLAN.requiredTaskIds.map((taskId) => ({
			taskId,
			outcome: 'completed'
		})),
		feedbackReviewed: true
	};
}

describe('private playtest release gate', () => {
	it('holds the current empty owner slot and names every unmet human prerequisite', () => {
		const release = createPlaytestReleaseReport(
			createOwnerPlaytestReport(createEmptyOwnerPlaytestSource())
		);

		expect(PlaytestReleaseReportSchema.parse(release)).toEqual(release);
		expect(release.status).toBe('held');
		expect(release.checks.map((check) => [check.checkId, check.status])).toEqual([
			['evidence-integrity', 'pass'],
			['owner-playtest', 'hold'],
			['required-journey-coverage', 'hold'],
			['release-findings', 'hold']
		]);
		expect(() => assertPlaytestReleaseReady(release)).toThrow(/0\/1/u);
	});

	it('opens packaging after one reviewed owner journey with no unverified P0 or P1', () => {
		const source = OwnerPlaytestSourceSchema.parse({
			...createEmptyOwnerPlaytestSource(),
			updatedAt: '2026-08-27T20:00:00.000Z',
			sessions: [completedSession()]
		});
		const release = createPlaytestReleaseReport(createOwnerPlaytestReport(source));

		expect(release.status).toBe('ready-to-package');
		expect(release.blockers).toEqual([]);
		expect(() => assertPlaytestReleaseReady(release)).not.toThrow();
	});

	it('rejects a valid-shaped release report whose hashed content was edited', () => {
		const release = createPlaytestReleaseReport(
			createOwnerPlaytestReport(createEmptyOwnerPlaytestSource())
		);
		const edited = PlaytestReleaseReportSchema.parse({
			...release,
			checks: release.checks.map((check) =>
				check.checkId === 'owner-playtest' ? { ...check, detail: '1/1 claimed by hand.' } : check
			)
		});

		expect(() => assertPlaytestReleaseReady(edited)).toThrow(/report hash/u);
	});

	it('holds when the FIN-007 content no longer matches its evidence hash', () => {
		const owner = createOwnerPlaytestReport(createEmptyOwnerPlaytestSource());
		const release = createPlaytestReleaseReport({
			...owner,
			updatedAt: '2026-08-27T01:00:00.000Z'
		});

		expect(release.status).toBe('held');
		expect(release.checks[0]).toMatchObject({ checkId: 'evidence-integrity', status: 'hold' });
	});

	it('reserves the canonical archive name for a real release receipt', () => {
		const receipt = {
			schemaVersion: 'playtest-package-receipt-v1',
			mode: 'rehearsal',
			releaseId: 'fin008-private-playtest-v1',
			commit: 'a'.repeat(40),
			archiveName: 'summonlab-fin008-private-playtest.tar.gz',
			sha256: 'b'.repeat(64),
			bytes: 42,
			releaseReportHash: 'c'.repeat(64)
		};

		expect(() => PlaytestPackageReceiptSchema.parse(receipt)).toThrow(/Only release mode/u);
		expect(
			PlaytestPackageReceiptSchema.parse({
				...receipt,
				archiveName: 'summonlab-fin008-package-rehearsal.tar.gz'
			})
		).toMatchObject({ mode: 'rehearsal' });
		expect(PlaytestPackageReceiptSchema.parse({ ...receipt, mode: 'release' })).toMatchObject({
			mode: 'release',
			archiveName: 'summonlab-fin008-private-playtest.tar.gz'
		});
	});
});
