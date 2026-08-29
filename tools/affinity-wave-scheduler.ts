import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	AffinityWaveEventSchema,
	buildWaveReport,
	nextDispatchDecision,
	preflightWave,
	readPreflight,
	readWaveEvents,
	readWavePlan,
	recordEventExclusive,
	writePreflightExclusive,
	writeReportExclusive
} from './affinity-wave-scheduler-lib.js';

function option(args: readonly string[], name: string): string {
	const index = args.indexOf(name);
	const value = index >= 0 ? args[index + 1] : undefined;
	if (!value) throw new Error(`Missing required option ${name}`);
	return value;
}

function usage(): never {
	throw new Error(
		[
			'Usage:',
			'  pnpm exec tsx tools/affinity-wave-scheduler.ts preflight --plan <path> --available-agent-slots <n>',
			'  pnpm exec tsx tools/affinity-wave-scheduler.ts next --preflight <path>',
			'  pnpm exec tsx tools/affinity-wave-scheduler.ts record-event --preflight <path> --event <path>',
			'  pnpm exec tsx tools/affinity-wave-scheduler.ts report --preflight <path>'
		].join('\n')
	);
}

async function main(): Promise<void> {
	const [command, ...args] = process.argv.slice(2);
	if (!command) usage();
	const workspaceRoot = process.cwd();
	if (command === 'preflight') {
		const planPath = option(args, '--plan');
		const availableAgentSlots = Number(option(args, '--available-agent-slots'));
		const plan = await readWavePlan(workspaceRoot, planPath);
		const preflight = await preflightWave(
			workspaceRoot,
			plan,
			availableAgentSlots,
			new Date().toISOString()
		);
		const outputPath = await writePreflightExclusive(workspaceRoot, preflight);
		process.stdout.write(`${JSON.stringify({ outputPath, preflight }, null, 2)}\n`);
		return;
	}
	const preflightPath = option(args, '--preflight');
	const preflight = await readPreflight(workspaceRoot, preflightPath);
	if (command === 'next') {
		const events = await readWaveEvents(workspaceRoot, preflight);
		process.stdout.write(`${JSON.stringify(nextDispatchDecision(preflight, events), null, 2)}\n`);
		return;
	}
	if (command === 'record-event') {
		const eventPath = option(args, '--event');
		const event = AffinityWaveEventSchema.parse(
			JSON.parse(await readFile(path.resolve(workspaceRoot, eventPath), 'utf8')) as unknown
		);
		const outputPath = await recordEventExclusive(workspaceRoot, preflight, event);
		process.stdout.write(`${JSON.stringify({ outputPath, event }, null, 2)}\n`);
		return;
	}
	if (command === 'report') {
		const events = await readWaveEvents(workspaceRoot, preflight);
		const report = await buildWaveReport(
			workspaceRoot,
			preflight,
			events,
			new Date().toISOString()
		);
		const outputPath = await writeReportExclusive(workspaceRoot, preflight, report);
		process.stdout.write(`${JSON.stringify({ outputPath, report }, null, 2)}\n`);
		return;
	}
	usage();
}

main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
