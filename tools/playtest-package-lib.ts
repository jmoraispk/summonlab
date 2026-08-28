import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
	PlaytestPackageReceiptSchema,
	type PlaytestPackageReceipt
} from '../packages/evaluation/src/index.js';

const run = promisify(execFile);

export const PRIVATE_PLAYTEST_PACKAGE_NAMES = [
	'characters',
	'config',
	'content',
	'contracts',
	'database',
	'engine',
	'evaluation',
	'observability',
	'policies',
	'queue'
] as const;

export const PRIVATE_PLAYTEST_COPY_TARGETS = [
	'.env.example',
	'.node-version',
	'.npmrc',
	'docker-compose.yml',
	'package.json',
	'pnpm-lock.yaml',
	'pnpm-workspace.yaml',
	'apps/web/build',
	'apps/web/package.json',
	'apps/worker/dist',
	'apps/worker/package.json',
	'packages/database/migrations',
	'docs/private-playtest-release.md'
] as const;

export interface PlaytestPackageMetadata {
	releaseId: 'fin008-private-playtest-v1';
	commit: string;
	sourceTreeStatus: 'clean' | 'dirty';
	releaseReportHash: string;
	ownerPlaytestReportHash: string;
}

export interface CreatePlaytestPackageOptions {
	root: string;
	artifactRoot: string;
	archiveName:
		'summonlab-fin008-private-playtest.tar.gz' | 'summonlab-fin008-package-rehearsal.tar.gz';
	mode: 'release' | 'rehearsal';
	metadata: PlaytestPackageMetadata;
}

export interface CreatedPlaytestPackage {
	archivePath: string;
	receiptPath: string;
	receipt: PlaytestPackageReceipt;
}

const FORBIDDEN_ARCHIVE_ENTRY =
	/(?:^|\/)(?:node_modules|src|docs\/evidence)(?:\/|$)|(?:^|\/)\.env$|\.(?:png|jpe?g|map)$/iu;

async function pruneNonRuntimeArtifacts(directory: string): Promise<void> {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			await pruneNonRuntimeArtifacts(entryPath);
		} else if (/\.(?:png|jpe?g|map)$/iu.test(entry.name)) {
			await rm(entryPath, { force: true });
		}
	}
}

export function validatePrivatePlaytestArchiveEntries(entries: string[]): void {
	const required = [
		'summonlab-private-playtest/RELEASE.json',
		'summonlab-private-playtest/apps/web/build/index.js',
		'summonlab-private-playtest/apps/worker/dist/index.js',
		'summonlab-private-playtest/packages/database/dist/migrate.js'
	];
	for (const entry of required) {
		if (!entries.includes(entry)) throw new Error(`Private package is missing ${entry}`);
	}
	const forbidden = entries.find((entry) => FORBIDDEN_ARCHIVE_ENTRY.test(entry));
	if (forbidden) throw new Error(`Private package contains forbidden entry ${forbidden}`);
}

async function stagePrivatePlaytestPackage(
	root: string,
	stageRoot: string,
	mode: 'release' | 'rehearsal',
	metadata: PlaytestPackageMetadata
): Promise<void> {
	await mkdir(stageRoot, { recursive: true });
	for (const target of PRIVATE_PLAYTEST_COPY_TARGETS) {
		const destination = path.join(stageRoot, target);
		await mkdir(path.dirname(destination), { recursive: true });
		await cp(path.join(root, target), destination, { recursive: true });
	}
	for (const packageName of PRIVATE_PLAYTEST_PACKAGE_NAMES) {
		const packageRoot = path.join(stageRoot, 'packages', packageName);
		await mkdir(packageRoot, { recursive: true });
		const packageManifestPath = path.join(root, 'packages', packageName, 'package.json');
		const packageManifest = JSON.parse(await readFile(packageManifestPath, 'utf8')) as {
			exports?: string | Record<string, string>;
			scripts?: Record<string, string>;
		};
		packageManifest.exports =
			packageName === 'policies'
				? { '.': './dist/index.js', './openai': './dist/openai.js' }
				: './dist/index.js';
		if (packageName === 'database') {
			packageManifest.scripts = { migrate: 'node dist/migrate.js' };
		}
		await writeFile(
			path.join(packageRoot, 'package.json'),
			`${JSON.stringify(packageManifest, null, 2)}\n`,
			'utf8'
		);
		await cp(path.join(root, 'packages', packageName, 'dist'), path.join(packageRoot, 'dist'), {
			recursive: true
		});
	}
	await pruneNonRuntimeArtifacts(stageRoot);
	await writeFile(
		path.join(stageRoot, 'RELEASE.json'),
		`${JSON.stringify({ schemaVersion: 'private-playtest-package-v1', mode, ...metadata }, null, 2)}\n`,
		'utf8'
	);
}

export async function createPrivatePlaytestPackage(
	options: CreatePlaytestPackageOptions
): Promise<CreatedPlaytestPackage> {
	const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-private-release-'));
	const stageRoot = path.join(temporaryRoot, 'summonlab-private-playtest');
	const archivePath = path.join(options.artifactRoot, options.archiveName);
	const receiptPath = path.join(
		options.artifactRoot,
		options.mode === 'release'
			? `${options.metadata.releaseId}.receipt.json`
			: `${options.metadata.releaseId}.rehearsal-receipt.json`
	);

	try {
		await stagePrivatePlaytestPackage(options.root, stageRoot, options.mode, options.metadata);
		await mkdir(options.artifactRoot, { recursive: true });
		await rm(archivePath, { force: true });
		await run(
			'tar',
			[
				'--sort=name',
				'--mtime=UTC 2020-01-01',
				'--owner=0',
				'--group=0',
				'--numeric-owner',
				'-czf',
				archivePath,
				'-C',
				temporaryRoot,
				path.basename(stageRoot)
			],
			{ cwd: options.root }
		);
		const { stdout: entryOutput } = await run('tar', ['-tzf', archivePath]);
		validatePrivatePlaytestArchiveEntries(
			entryOutput
				.split('\n')
				.map((entry) => entry.replace(/\/$/u, ''))
				.filter((entry) => entry.length > 0)
		);
		const archive = await readFile(archivePath);
		const archiveStat = await stat(archivePath);
		const receipt = PlaytestPackageReceiptSchema.parse({
			schemaVersion: 'playtest-package-receipt-v1',
			mode: options.mode,
			releaseId: options.metadata.releaseId,
			commit: options.metadata.commit,
			archiveName: options.archiveName,
			sha256: createHash('sha256').update(archive).digest('hex'),
			bytes: archiveStat.size,
			releaseReportHash: options.metadata.releaseReportHash
		});
		await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
		return { archivePath, receiptPath, receipt };
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
}
