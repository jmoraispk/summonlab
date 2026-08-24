import type { AppConfig } from '@summonlab/config';
import type { CatchUpReport } from '@summonlab/contracts';
import { catchUpDueRuns } from '@summonlab/database';

interface CatchUpLogger {
	info(bindings: Record<string, unknown>, message: string): void;
	error(bindings: Record<string, unknown>, message: string): void;
}

export interface CatchUpLoop {
	start(): void;
	runOnce(): Promise<readonly CatchUpReport[]>;
	stop(): Promise<void>;
}

export function createCatchUpLoop(options: {
	readonly pollMs: number;
	readonly processDue: (wallTime: string) => Promise<readonly CatchUpReport[]>;
	readonly now?: () => string;
	readonly onReports?: (reports: readonly CatchUpReport[]) => void;
	readonly onError?: (error: unknown) => void;
}): CatchUpLoop {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let stopped = true;
	let inFlight: Promise<readonly CatchUpReport[]> | null = null;
	const now = options.now ?? (() => new Date().toISOString());

	const schedule = () => {
		if (stopped) return;
		timer = setTimeout(() => void tick(), options.pollMs);
		timer.unref?.();
	};
	const runOnce = () => {
		inFlight ??= options
			.processDue(now())
			.then((reports) => {
				options.onReports?.(reports);
				return reports;
			})
			.catch((error) => {
				options.onError?.(error);
				return [];
			})
			.finally(() => {
				inFlight = null;
			});
		return inFlight;
	};
	const tick = async () => {
		await runOnce();
		schedule();
	};

	return {
		start() {
			if (!stopped) return;
			stopped = false;
			void tick();
		},
		runOnce,
		async stop() {
			stopped = true;
			if (timer) clearTimeout(timer);
			timer = null;
			await inFlight;
		}
	};
}

export function startCatchUpWorker(config: AppConfig, logger: CatchUpLogger): CatchUpLoop {
	const loop = createCatchUpLoop({
		pollMs: config.catchUpPollMs,
		processDue: (wallTime) => catchUpDueRuns(config.databaseUrl, wallTime),
		onReports: (reports) => {
			if (reports.length === 0) return;
			logger.info(
				{
					runCount: reports.length,
					commandsApplied: reports.reduce((total, report) => total + report.commandsApplied, 0),
					schedulesResolved: reports.reduce((total, report) => total + report.schedulesResolved, 0)
				},
				'worker catch-up batch completed'
			);
		},
		onError: (error) => logger.error({ error }, 'worker catch-up batch failed')
	});
	loop.start();
	return loop;
}
