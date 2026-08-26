import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
	PlaytestReleaseReportSchema,
	assertPlaytestReleaseReady
} from '../packages/evaluation/src/index.js';

const root = process.cwd();
const run = promisify(execFile);
const acknowledgement = '--acknowledge-private-release';
if (!process.argv.includes(acknowledgement)) {
	throw new Error(
		`Private packaging requires explicit operator acknowledgement: ${acknowledgement}`
	);
}

const reportPath = path.join(root, 'docs/evidence/phase-7-fin008-playtest-release.json');
const report = PlaytestReleaseReportSchema.parse(JSON.parse(await readFile(reportPath, 'utf8')));
assertPlaytestReleaseReady(report);

const { stdout: dirtyTracked } = await run(
	'git',
	['status', '--porcelain', '--untracked-files=no'],
	{
		cwd: root
	}
);
if (dirtyTracked.trim().length > 0) {
	throw new Error('Commit tracked release inputs before packaging the private build.');
}

const { stdout: commitOutput } = await run('git', ['rev-parse', 'HEAD'], { cwd: root });
const commit = commitOutput.trim();
await run('pnpm', ['build'], { cwd: root });

const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-private-release-'));
const stageRoot = path.join(temporaryRoot, 'summonlab-private-playtest');
const artifactRoot = path.join(root, 'artifacts/private-playtest');
const archivePath = path.join(artifactRoot, report.packagePlan.archiveName);
const receiptPath = path.join(artifactRoot, `${report.releaseId}.receipt.json`);

try {
	await mkdir(stageRoot, { recursive: true });
	const copyTargets = [
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
	];
	for (const target of copyTargets) {
		const destination = path.join(stageRoot, target);
		await mkdir(path.dirname(destination), { recursive: true });
		await cp(path.join(root, target), destination, { recursive: true });
	}
	for (const packageName of [
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
	]) {
		await mkdir(path.join(stageRoot, 'packages', packageName), { recursive: true });
		const packageManifestPath = path.join(root, 'packages', packageName, 'package.json');
		const packageManifest = JSON.parse(await readFile(packageManifestPath, 'utf8')) as {
			exports?: string | Record<string, string>;
		};
		packageManifest.exports =
			packageName === 'policies'
				? { '.': './dist/index.js', './openai': './dist/openai.js' }
				: './dist/index.js';
		if (packageName === 'database') {
			Object.assign(packageManifest, { scripts: { migrate: 'node dist/migrate.js' } });
		}
		await writeFile(
			path.join(stageRoot, 'packages', packageName, 'package.json'),
			`${JSON.stringify(packageManifest, null, 2)}\n`,
			'utf8'
		);
		await cp(
			path.join(root, 'packages', packageName, 'dist'),
			path.join(stageRoot, 'packages', packageName, 'dist'),
			{ recursive: true }
		);
	}
	await writeFile(
		path.join(stageRoot, 'RELEASE.json'),
		`${JSON.stringify(
			{
				releaseId: report.releaseId,
				commit,
				releaseReportHash: report.reportHash,
				moderatedPlaytestReportHash: report.generatedFrom.moderatedPlaytestReportHash
			},
			null,
			2
		)}\n`,
		'utf8'
	);
	await mkdir(artifactRoot, { recursive: true });
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
		{ cwd: root }
	);
	const archive = await readFile(archivePath);
	const archiveStat = await stat(archivePath);
	const receipt = {
		schemaVersion: 'playtest-package-receipt-v1',
		releaseId: report.releaseId,
		commit,
		archiveName: report.packagePlan.archiveName,
		sha256: createHash('sha256').update(archive).digest('hex'),
		bytes: archiveStat.size,
		releaseReportHash: report.reportHash
	};
	await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
	process.stdout.write(`${archivePath}\n${receipt.sha256}\n${receipt.bytes} bytes\n`);
} finally {
	await rm(temporaryRoot, { recursive: true, force: true });
}
