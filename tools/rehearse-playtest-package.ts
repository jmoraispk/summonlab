import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { promisify } from 'node:util';

import {
	PlaytestReleaseReportSchema,
	assertPlaytestReleaseReportIntegrity
} from '../packages/evaluation/src/index.js';
import postgres from 'postgres';

import { createPrivatePlaytestPackage } from './playtest-package-lib.js';

const run = promisify(execFile);
const root = process.cwd();
const skipBuild = process.argv.includes('--skip-build');
const reportPath = path.join(root, 'docs/evidence/phase-7-fin008-playtest-release.json');
const report = PlaytestReleaseReportSchema.parse(JSON.parse(await readFile(reportPath, 'utf8')));
assertPlaytestReleaseReportIntegrity(report);
const { stdout: commitOutput } = await run('git', ['rev-parse', 'HEAD'], { cwd: root });
const commit = commitOutput.trim();
const { stdout: trackedStatusOutput } = await run(
	'git',
	['status', '--porcelain', '--untracked-files=no'],
	{ cwd: root }
);
const sourceTreeStatus = trackedStatusOutput.trim().length === 0 ? 'clean' : 'dirty';
const rehearsalRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-package-rehearsal-'));
const extractRoot = path.join(rehearsalRoot, 'extract');
const databaseName = `summonlab_rehearsal_${process.pid}`;
const baseDatabaseUrl =
	process.env.DATABASE_URL ?? 'postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab';
const administratorUrl = new URL(baseDatabaseUrl);
administratorUrl.pathname = '/postgres';
const rehearsalDatabaseUrl = new URL(baseDatabaseUrl);
rehearsalDatabaseUrl.pathname = `/${databaseName}`;
const administrator = postgres(administratorUrl.toString(), { max: 1 });
const services: ChildProcess[] = [];

function serviceLogs(service: ChildProcess): string[] {
	const logs: string[] = [];
	service.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
	service.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
	return logs;
}

async function availablePort(): Promise<number> {
	const server = createServer();
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	if (address === null || typeof address === 'string') throw new Error('Could not allocate a port');
	const port = address.port;
	server.close();
	await once(server, 'close');
	return port;
}

async function waitForHealth(
	url: string,
	serviceName: 'web' | 'worker',
	service: ChildProcess,
	logs: string[]
): Promise<void> {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		if (service.exitCode !== null) {
			throw new Error(`${serviceName} exited before health passed:\n${logs.join('')}`);
		}
		try {
			const response = await fetch(url, {
				headers: { 'x-request-id': `rehearsal-${serviceName}` }
			});
			if (response.ok) {
				const body = (await response.json()) as {
					status?: string;
					service?: string;
					commit?: string;
					database?: { status?: string };
				};
				if (
					body.status === 'ok' &&
					body.service === serviceName &&
					body.commit === commit &&
					body.database?.status === 'available'
				) {
					return;
				}
			}
		} catch {
			// The process may still be binding its port.
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`${serviceName} health did not pass:\n${logs.join('')}`);
}

async function stopService(service: ChildProcess): Promise<void> {
	if (service.exitCode !== null) return;
	service.kill('SIGTERM');
	await Promise.race([
		once(service, 'exit'),
		new Promise((resolve) => setTimeout(resolve, 5_000)).then(() => {
			if (service.exitCode === null) service.kill('SIGKILL');
		})
	]);
}

try {
	if (!skipBuild) await run('pnpm', ['build'], { cwd: root });
	const created = await createPrivatePlaytestPackage({
		root,
		artifactRoot: path.join(rehearsalRoot, 'artifact'),
		archiveName: 'summonlab-fin008-package-rehearsal.tar.gz',
		mode: 'rehearsal',
		metadata: {
			releaseId: report.releaseId,
			commit,
			sourceTreeStatus,
			releaseReportHash: report.reportHash,
			moderatedPlaytestReportHash: report.generatedFrom.moderatedPlaytestReportHash
		}
	});
	const deterministicVerification = await createPrivatePlaytestPackage({
		root,
		artifactRoot: path.join(rehearsalRoot, 'determinism-check'),
		archiveName: 'summonlab-fin008-package-rehearsal.tar.gz',
		mode: 'rehearsal',
		metadata: {
			releaseId: report.releaseId,
			commit,
			sourceTreeStatus,
			releaseReportHash: report.reportHash,
			moderatedPlaytestReportHash: report.generatedFrom.moderatedPlaytestReportHash
		}
	});
	if (created.receipt.sha256 !== deterministicVerification.receipt.sha256) {
		throw new Error('Two independently assembled rehearsal archives produced different SHA-256s');
	}
	await mkdir(extractRoot, { recursive: true });
	await run('tar', ['-xzf', created.archivePath, '-C', extractRoot]);
	const packageRoot = path.join(extractRoot, 'summonlab-private-playtest');
	await run('pnpm', ['install', '--prod', '--frozen-lockfile', '--ignore-scripts'], {
		cwd: packageRoot,
		maxBuffer: 10 * 1024 * 1024
	});

	await administrator.unsafe(`create database "${databaseName}"`);
	const serviceEnvironment = {
		...process.env,
		NODE_ENV: 'production',
		HOST: '127.0.0.1',
		DATABASE_URL: rehearsalDatabaseUrl.toString(),
		POLICY_MODE: 'scripted',
		ENABLE_DEV_ROUTES: 'false',
		SUMMONLAB_COMMIT_SHA: commit,
		LOG_LEVEL: 'warn'
	};
	await run('pnpm', ['--filter', '@summonlab/database', 'migrate'], {
		cwd: packageRoot,
		env: serviceEnvironment
	});

	const webPort = await availablePort();
	const workerPort = await availablePort();
	const web = spawn('node', ['apps/web/build'], {
		cwd: packageRoot,
		env: { ...serviceEnvironment, PORT: String(webPort), WEB_PORT: String(webPort) },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	services.push(web);
	const webLogs = serviceLogs(web);
	await waitForHealth(`http://127.0.0.1:${webPort}/health`, 'web', web, webLogs);
	const titleResponse = await fetch(`http://127.0.0.1:${webPort}/`);
	const titleHtml = await titleResponse.text();
	if (!titleResponse.ok || !titleHtml.includes('They were summoned')) {
		throw new Error(`Extracted player title did not render:\n${webLogs.join('')}`);
	}
	const developmentRouteResponse = await fetch(`http://127.0.0.1:${webPort}/playtest-release`);
	if (developmentRouteResponse.status !== 404) {
		throw new Error('Extracted production server exposed the development release desk');
	}

	const worker = spawn('node', ['apps/worker/dist/index.js'], {
		cwd: packageRoot,
		env: { ...serviceEnvironment, WORKER_PORT: String(workerPort) },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	services.push(worker);
	const workerLogs = serviceLogs(worker);
	await waitForHealth(`http://127.0.0.1:${workerPort}/health`, 'worker', worker, workerLogs);

	process.stdout.write(
		`${JSON.stringify(
			{
				schemaVersion: 'playtest-package-rehearsal-report-v1',
				releaseEligible: false,
				sourceReleaseStatus: report.status,
				commit,
				sourceTreeStatus,
				commitBound: sourceTreeStatus === 'clean',
				archive: {
					name: created.receipt.archiveName,
					sha256: created.receipt.sha256,
					bytes: created.receipt.bytes,
					mode: created.receipt.mode
				},
				checks: {
					productionBuild: skipBuild ? 'prebuilt' : 'passed',
					deterministicArchive: 'passed',
					frozenProductionInstall: 'passed',
					cleanDatabaseMigration: 'passed',
					webHealth: 'passed',
					playerTitle: 'passed',
					developmentRouteBoundary: 'passed',
					workerHealth: 'passed'
				}
			},
			null,
			2
		)}\n`
	);
} finally {
	await Promise.all(services.map((service) => stopService(service)));
	await administrator
		.unsafe(
			`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${databaseName}' and pid <> pg_backend_pid()`
		)
		.catch(() => undefined);
	await administrator.unsafe(`drop database if exists "${databaseName}"`).catch(() => undefined);
	await administrator.end({ timeout: 5 });
	await rm(rehearsalRoot, { recursive: true, force: true });
}
