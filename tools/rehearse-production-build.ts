import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import {
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	realpath,
	rm,
	stat,
	symlink,
	writeFile
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import postgres from 'postgres';

const run = promisify(execFile);
const root = await realpath(process.cwd());
const outputRoot = path.join(root, 'apps/web/.vercel/output');
const { stdout: commitOutput } = await run('git', ['rev-parse', 'HEAD'], { cwd: root });
const commit = commitOutput.trim();
const { stdout: statusOutput } = await run('git', ['status', '--porcelain'], { cwd: root });
const sourceTreeStatus = statusOutput.trim() ? 'dirty' : 'clean';

function assertContained(rootPath: string, candidate: string): void {
	const relative = path.relative(rootPath, candidate);
	if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error(`Build output path escapes its directory: ${candidate}`);
	}
}

async function containedFile(directory: string, relative: string): Promise<string> {
	const resolved = path.resolve(directory, relative);
	assertContained(directory, resolved);
	assertContained(await realpath(directory), await realpath(resolved));
	const information = await stat(resolved);
	if (!information.isFile() || information.size === 0) {
		throw new Error(`Build output file is missing or empty: ${resolved}`);
	}
	return resolved;
}

async function verifyTraceLinks(directory: string, traceRoot = directory): Promise<void> {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const file = path.join(directory, entry.name);
		if ((await lstat(file)).isSymbolicLink()) {
			assertContained(traceRoot, await realpath(file));
		} else if (entry.isDirectory()) {
			await verifyTraceLinks(file, traceRoot);
		}
	}
}

async function stageBuiltWorker(runtimeRoot: string): Promise<void> {
	const packageNames = [
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
	];
	for (const relative of ['apps/worker', ...packageNames.map((name) => `packages/${name}`)]) {
		const source = path.join(root, relative);
		const destination = path.join(runtimeRoot, relative);
		const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8')) as {
			exports?: string | Record<string, string>;
			dependencies?: Record<string, string>;
		};
		// Workspace builds bundle public subpaths into index.js; the policy provider has its own entry.
		if (manifest.exports) {
			manifest.exports =
				typeof manifest.exports === 'string'
					? './dist/index.js'
					: Object.fromEntries(
							Object.keys(manifest.exports).map((key) => [
								key,
								key === './openai' ? './dist/openai.js' : './dist/index.js'
							])
						);
		}
		await mkdir(destination, { recursive: true });
		await cp(path.join(source, 'dist'), path.join(destination, 'dist'), { recursive: true });
		await writeFile(path.join(destination, 'package.json'), JSON.stringify(manifest));
		for (const dependency of Object.keys(manifest.dependencies ?? {})) {
			const link = path.join(destination, 'node_modules', dependency);
			const target = dependency.startsWith('@summonlab/')
				? path.join(runtimeRoot, 'packages', dependency.slice('@summonlab/'.length))
				: await realpath(path.join(source, 'node_modules', dependency));
			await mkdir(path.dirname(link), { recursive: true });
			await symlink(target, link, 'dir');
		}
	}
	await cp(
		path.join(root, 'packages/database/migrations'),
		path.join(runtimeRoot, 'packages/database/migrations'),
		{ recursive: true }
	);
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

type Health = {
	status?: string;
	service?: string;
	commit?: string;
	database?: { status?: string };
};

function assertHealthy(health: Health, serviceName: 'web' | 'worker'): void {
	if (
		health.status !== 'ok' ||
		health.service !== serviceName ||
		health.commit !== commit ||
		health.database?.status !== 'available'
	) {
		throw new Error(`${serviceName} health did not match the tested commit and database`);
	}
}

async function waitForWorker(worker: ChildProcess, port: number, logs: string[]): Promise<void> {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		if (worker.exitCode !== null || worker.signalCode !== null) break;
		try {
			const response = await fetch(`http://127.0.0.1:${port}/health`, {
				signal: AbortSignal.timeout(2_000)
			});
			if (response.ok) {
				assertHealthy((await response.json()) as Health, 'worker');
				return;
			}
		} catch {
			// The worker may still be starting its health server.
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`Built worker health did not pass:\n${logs.join('')}`);
}

async function stopService(service: ChildProcess): Promise<void> {
	if (service.exitCode !== null || service.signalCode !== null || service.pid === undefined) return;
	const exited = once(service, 'exit');
	service.kill('SIGTERM');
	const timeout = setTimeout(() => service.kill('SIGKILL'), 5_000);
	try {
		await exited;
	} finally {
		clearTimeout(timeout);
	}
}

const probeSource = `
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const [handlerPath, resultPath] = process.argv.slice(2);
const handler = (await import(pathToFileURL(handlerPath).href)).default;
if (typeof handler?.fetch !== 'function') {
	throw new Error('The generated function does not export fetch(Request)');
}
const responses = [];
for (const pathname of ['/health', '/', '/playtest-release']) {
	const response = await handler.fetch(new Request('http://production-rehearsal.test' + pathname, {
		headers: { 'x-forwarded-for': '127.0.0.1', 'x-request-id': 'production-rehearsal' }
	}));
	if (!(response instanceof Response)) throw new Error('The generated function did not return a Response');
	responses.push({ pathname, status: response.status, body: await response.text() });
}
await writeFile(resultPath, JSON.stringify(responses));
process.exit(0);
`;

async function checkStaticAssets(html: string) {
	const origin = 'http://production-rehearsal.test';
	const staticRoot = path.join(outputRoot, 'static');
	assertContained(await realpath(outputRoot), await realpath(staticRoot));
	const javascript = new Set<string>();
	for (const match of html.matchAll(/["']([^"'<>\s]+)["']/gu)) {
		const value = match[1]!;
		if (!value.includes('_app/immutable/') || !value.endsWith('.js')) continue;
		javascript.add(value);
	}
	const artwork = new Set<string>();
	for (const tag of html.matchAll(/<(?:img|source)\b[^>]*>/gu)) {
		for (const attribute of tag[0].matchAll(/\b(?:src|srcset)="([^"]+)"/gu)) {
			for (const candidate of attribute[1]!.split(',')) {
				artwork.add(candidate.trim().split(/\s+/u)[0]!);
			}
		}
	}
	if (javascript.size === 0 || artwork.size === 0) {
		throw new Error('The player title did not reference immutable JavaScript and title artwork');
	}
	async function verifyReference(reference: string): Promise<string> {
		const url = new URL(reference, origin);
		if (url.origin !== origin)
			throw new Error(`Title asset points outside the build: ${reference}`);
		const relative = decodeURIComponent(url.pathname).replace(/^\//u, '');
		await containedFile(staticRoot, relative);
		return url.pathname;
	}
	return {
		immutableJavaScript: await Promise.all([...javascript].map(verifyReference)),
		titleArtwork: await Promise.all([...artwork].map(verifyReference))
	};
}

const databaseName = `summonlab_build_rehearsal_${process.pid}`;
const baseDatabaseUrl = new URL(
	process.env.DATABASE_URL ?? 'postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab'
);
const administratorUrl = new URL(baseDatabaseUrl);
administratorUrl.pathname = '/postgres';
const rehearsalDatabaseUrl = new URL(baseDatabaseUrl);
rehearsalDatabaseUrl.pathname = `/${databaseName}`;
const administrator = postgres(administratorUrl.toString(), { max: 1 });
const rehearsalRoot = await realpath(
	await mkdtemp(path.join(tmpdir(), 'summonlab-production-rehearsal-'))
);
let databaseCreated = false;
const services: ChildProcess[] = [];
let report: unknown;

try {
	if (rehearsalRoot === root || rehearsalRoot.startsWith(`${root}${path.sep}`)) {
		throw new Error('The function rehearsal must run outside the repository');
	}
	const outputConfig = JSON.parse(await readFile(path.join(outputRoot, 'config.json'), 'utf8')) as {
		version?: number;
		routes?: { src?: string; dest?: string }[];
	};
	if (outputConfig.version !== 3) throw new Error('Expected Vercel Build Output API version 3');
	const catchall = outputConfig.routes?.findLast(
		(route) => route.src === '/.*' && typeof route.dest === 'string'
	);
	if (!catchall?.dest) throw new Error('The build has no catchall function route');
	const functionsRoot = path.join(outputRoot, 'functions');
	const functionDirectory = path.resolve(
		functionsRoot,
		`${catchall.dest.replace(/^\//u, '')}.func`
	);
	assertContained(functionsRoot, functionDirectory);
	assertContained(await realpath(functionsRoot), await realpath(functionDirectory));
	const functionConfigPath = await containedFile(functionDirectory, '.vc-config.json');
	const functionConfig = JSON.parse(await readFile(functionConfigPath, 'utf8')) as {
		handler?: string;
	};
	if (!functionConfig.handler) throw new Error('The catchall function has no configured handler');
	await containedFile(functionDirectory, functionConfig.handler);
	const isolatedFunction = path.join(rehearsalRoot, 'function');
	await cp(functionDirectory, isolatedFunction, {
		recursive: true,
		dereference: false,
		verbatimSymlinks: true
	});
	await verifyTraceLinks(isolatedFunction);
	const isolatedHandler = await containedFile(isolatedFunction, functionConfig.handler);
	const workerRuntime = path.join(rehearsalRoot, 'worker-runtime');
	await stageBuiltWorker(workerRuntime);
	await administrator.unsafe(`create database "${databaseName}"`);
	databaseCreated = true;
	const environment = {
		...process.env,
		NODE_ENV: 'production',
		NODE_PATH: '',
		HOST: '127.0.0.1',
		DATABASE_URL: rehearsalDatabaseUrl.toString(),
		POLICY_MODE: 'scripted',
		ENABLE_DEV_ROUTES: 'false',
		ENABLE_IMAGE_GENERATION: 'false',
		SUMMONLAB_COMMIT_SHA: commit,
		LOG_LEVEL: 'warn'
	};
	await run(process.execPath, ['packages/database/dist/migrate.js'], {
		cwd: workerRuntime,
		env: environment,
		timeout: 60_000
	});
	const probePath = path.join(rehearsalRoot, 'probe.mjs');
	const resultPath = path.join(rehearsalRoot, 'responses.json');
	await writeFile(probePath, probeSource);
	await run(process.execPath, [probePath, isolatedHandler, resultPath], {
		cwd: rehearsalRoot,
		env: environment,
		timeout: 30_000,
		killSignal: 'SIGKILL'
	});
	const responses = JSON.parse(await readFile(resultPath, 'utf8')) as {
		pathname: string;
		status: number;
		body: string;
	}[];
	const health = responses.find((response) => response.pathname === '/health');
	if (health?.status !== 200)
		throw new Error('The isolated web health endpoint did not return 200');
	assertHealthy(JSON.parse(health.body) as Health, 'web');
	const title = responses.find((response) => response.pathname === '/');
	if (
		title?.status !== 200 ||
		!title.body.includes('data-testid="campaign-title"') ||
		!title.body.includes('Summonlab')
	) {
		throw new Error('The isolated production function did not render the player title');
	}
	if (responses.find((response) => response.pathname === '/playtest-release')?.status !== 404) {
		throw new Error('The production function exposed the development release desk');
	}
	const assets = await checkStaticAssets(title.body);
	const workerPort = await availablePort();
	const worker = spawn(process.execPath, ['apps/worker/dist/index.js'], {
		cwd: workerRuntime,
		env: { ...environment, WORKER_PORT: String(workerPort) },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	services.push(worker);
	const workerLogs: string[] = [];
	worker.on('error', (error) => workerLogs.push(error.message));
	worker.stdout.on('data', (chunk: Buffer) => workerLogs.push(chunk.toString()));
	worker.stderr.on('data', (chunk: Buffer) => workerLogs.push(chunk.toString()));
	await waitForWorker(worker, workerPort, workerLogs);
	report = {
		schemaVersion: 'production-build-rehearsal-report-v1',
		commit,
		sourceTreeStatus,
		buildInput: 'existing-production-output',
		outputFormat: 'vercel-build-output-v3',
		function: {
			directory: path.relative(outputRoot, functionDirectory),
			handler: functionConfig.handler,
			isolation: 'copied-trace-outside-repository'
		},
		workerDependencies: 'installed-workspace-third-party-dependencies',
		assets,
		checks: {
			outputConfiguration: 'passed',
			isolatedFunctionImport: 'passed',
			cleanDatabaseMigration: 'passed',
			webHealth: 'passed',
			playerTitle: 'passed',
			referencedStaticAssets: 'passed',
			developmentRouteBoundary: 'passed',
			workerHealth: 'passed',
			cleanup: 'passed'
		}
	};
} finally {
	try {
		await Promise.all(services.map(stopService));
	} finally {
		try {
			if (databaseCreated) {
				await administrator`select pg_terminate_backend(pid) from pg_stat_activity
					where datname = ${databaseName} and pid <> pg_backend_pid()`;
				await administrator.unsafe(`drop database "${databaseName}"`);
			}
		} finally {
			try {
				await administrator.end({ timeout: 5 });
			} finally {
				await rm(rehearsalRoot, { recursive: true, force: true });
			}
		}
	}
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
