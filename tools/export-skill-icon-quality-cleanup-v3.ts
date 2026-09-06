import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	assertAllHeldParentsNamed,
	assertOwnedPath,
	cleanupTransaction,
	heldChild,
	publishStaged,
	readSafeRepositoryFile,
	removeOwnedPath,
	stageOutput
} from './persist-skill-icon-cleanup-output.js';
import {
	buildCleanupRevisionV3Packets,
	cleanupRevisionV2JsonBytes
} from './skill-icon-quality-cleanup-v2-lib.js';

export interface ExportCleanupRevisionV3Report {
	readonly total: number;
	readonly written: readonly string[];
	readonly existing: readonly string[];
}

function isMissing(error: unknown): boolean {
	return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function writeCreateOnly(root: string, repositoryPath: string, bytes: Buffer): Promise<void> {
	const staged = await stageOutput(root, repositoryPath, bytes);
	try {
		await publishStaged(staged);
		await assertAllHeldParentsNamed([staged]);
		const finalPath = heldChild(staged.parent, path.basename(staged.destination));
		await assertOwnedPath(finalPath, staged, 'Cleanup v3 packet output');
		if (!(await readFile(finalPath)).equals(bytes)) {
			throw new Error(`Cleanup v3 packet bytes changed: ${repositoryPath}`);
		}
		await removeOwnedPath(staged.temporaryPath, staged);
	} catch (error) {
		try {
			await cleanupTransaction([staged]);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				'Cleanup v3 packet publication failed and safe rollback was incomplete',
				{ cause: cleanupError }
			);
		}
		throw error;
	} finally {
		await staged.parent.handle.close().catch(() => undefined);
	}
}

export async function exportCleanupRevisionV3Packets(input: {
	readonly root?: string;
	readonly mode: 'write' | 'check';
}): Promise<ExportCleanupRevisionV3Report> {
	const root = path.resolve(input.root ?? process.cwd());
	const packets = await buildCleanupRevisionV3Packets(root);
	const written: string[] = [];
	const existing: string[] = [];
	const missing: string[] = [];
	for (const artifact of packets) {
		const expectedBytes = cleanupRevisionV2JsonBytes(artifact.packet);
		try {
			const actual = await readSafeRepositoryFile(
				root,
				artifact.path,
				'Cleanup v3 revision packet'
			);
			if (!actual.bytes.equals(expectedBytes)) {
				throw new Error(`Cleanup v3 packet drift: ${artifact.path}`);
			}
			existing.push(artifact.path);
		} catch (error) {
			if (!isMissing(error)) throw error;
			if (input.mode === 'check') {
				missing.push(artifact.path);
				continue;
			}
			await writeCreateOnly(root, artifact.path, expectedBytes);
			written.push(artifact.path);
		}
	}
	if (missing.length > 0) {
		throw new Error(`Cleanup v3 packet inventory is incomplete: ${missing.join(', ')}`);
	}
	return { total: packets.length, written, existing };
}

function parseMode(args: readonly string[]): 'write' | 'check' {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || (normalized[0] !== '--write' && normalized[0] !== '--check')) {
		throw new Error('Expected exactly --write or --check');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	let mode: 'write' | 'check' | undefined;
	try {
		mode = parseMode(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
	if (mode) {
		exportCleanupRevisionV3Packets({ mode })
			.then((report) => process.stdout.write(`${JSON.stringify(report)}\n`))
			.catch((error: unknown) => {
				process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
				process.exitCode = 1;
			});
	}
}
