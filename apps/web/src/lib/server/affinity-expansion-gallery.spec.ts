import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { ENEMY_AFFINITY_EXPANSION_TARGETS } from '@summonlab/content';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	loadAffinityExpansionGallery,
	loadAffinityExpansionMedia
} from './affinity-expansion-gallery';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const target = ENEMY_AFFINITY_EXPANSION_TARGETS.find(
	(candidate) => candidate.speciesId === 'armored-brood-guard' && candidate.affinity === 'wind'
)!;

if (!target) throw new Error('Missing Armored Brood Guard Wind test target.');

type Version = 'v3' | 'v2' | 'v1';

const files = new Map<string, string | Buffer>();
const mockedReadFile = vi.mocked(readFile);

function versionedPath(filePath: string, version: Version): string {
	return filePath.replace(/-v1(?=\.[^.]+$)/u, `-${version}`);
}

function hash(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function putResult(
	version: Version,
	status: 'candidate' | 'revise',
	bytes: Buffer,
	options: { outputPath?: string; targetId?: string; selectedAttemptId?: string | null } = {}
) {
	const resultPath = versionedPath(target.output.resultPath, version);
	const candidatePath = versionedPath(target.output.candidatePath, version);
	const attemptId = `${target.targetId}-${version}-attempt-2`;
	const outputPath = options.outputPath ?? candidatePath;
	files.set(
		resultPath,
		JSON.stringify({
			targetId:
				options.targetId ?? (version === 'v1' ? target.targetId : `${target.targetId}-${version}`),
			status,
			selectedAttemptId:
				options.selectedAttemptId === undefined
					? status === 'candidate'
						? attemptId
						: null
					: options.selectedAttemptId,
			attempts: [
				{
					attemptId: `${target.targetId}-${version}-attempt-1`,
					output: null
				},
				{
					attemptId,
					output: {
						path: outputPath,
						contentHash: hash(bytes),
						mediaType: 'image/png',
						width: 1536,
						height: 1024,
						bytes: bytes.byteLength
					}
				}
			]
		})
	);
	files.set(candidatePath, bytes);
}

beforeEach(() => {
	files.clear();
	mockedReadFile.mockReset();
	mockedReadFile.mockImplementation(async (filePath, options) => {
		const absolutePath = String(filePath);
		const entry = [...files.entries()].find(([suffix]) => absolutePath.endsWith(suffix));
		if (!entry) throw Object.assign(new Error(`ENOENT: ${absolutePath}`), { code: 'ENOENT' });
		const value = entry[1];
		if (options === 'utf8')
			return (Buffer.isBuffer(value) ? value.toString('utf8') : value) as never;
		return (Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value)) as never;
	});
});

describe('affinity expansion gallery rerun resolution', () => {
	it('prefers a candidate over a newer persisted revise output', async () => {
		putResult('v3', 'revise', Buffer.from('v3-revise'));
		putResult('v2', 'candidate', Buffer.from('v2-candidate'));
		putResult('v1', 'candidate', Buffer.from('v1-candidate'));

		const gallery = await loadAffinityExpansionGallery();
		const row = gallery.rows.find((candidate) => candidate.speciesId === target.speciesId);
		const cell = row?.cells.find((candidate) => candidate.affinity === target.affinity);
		const media = await loadAffinityExpansionMedia(target.speciesId, target.affinity);

		expect(cell).toMatchObject({ available: true, status: 'candidate' });
		expect(media?.status).toBe('candidate');
		expect(Buffer.from(media?.bytes ?? new ArrayBuffer(0)).toString()).toBe('v2-candidate');
		expect(media?.contentHash).toBe(hash(Buffer.from('v2-candidate')));
	});

	it('falls back to the newest persisted revise output when no candidate exists', async () => {
		putResult('v3', 'revise', Buffer.from('v3-revise'));
		putResult('v2', 'revise', Buffer.from('v2-revise'));

		const media = await loadAffinityExpansionMedia(target.speciesId, target.affinity);

		expect(media?.status).toBe('revise');
		expect(Buffer.from(media?.bytes ?? new ArrayBuffer(0)).toString()).toBe('v3-revise');
		expect(media?.contentHash).toBe(hash(Buffer.from('v3-revise')));
	});

	it('skips unusable rerun metadata and continues to an older candidate', async () => {
		putResult('v3', 'candidate', Buffer.from('invalid-v3'), {
			outputPath: versionedPath(target.output.candidatePath, 'v2')
		});
		putResult('v1', 'candidate', Buffer.from('v1-candidate'));

		const media = await loadAffinityExpansionMedia(target.speciesId, target.affinity);

		expect(media?.status).toBe('candidate');
		expect(Buffer.from(media?.bytes ?? new ArrayBuffer(0)).toString()).toBe('v1-candidate');
	});
});
