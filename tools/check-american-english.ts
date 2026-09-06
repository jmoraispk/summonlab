import {
	auditTrackedTreeReport,
	type AmericanEnglishAuditReport
} from './american-english-policy.js';

const usage =
	'Usage: tsx tools/check-american-english.ts [--repository-root PATH] [--format text|json]';

interface CliOptions {
	readonly repositoryRoot: string;
	readonly format: 'text' | 'json';
}

function parseArguments(arguments_: readonly string[]): CliOptions {
	const cliArguments = arguments_[0] === '--' ? arguments_.slice(1) : arguments_;
	let repositoryRoot = process.cwd();
	let format: CliOptions['format'] = 'text';
	let sawRepositoryRoot = false;
	let sawFormat = false;
	for (let index = 0; index < cliArguments.length; index += 1) {
		const argument = cliArguments[index];
		if (argument === '--repository-root' && !sawRepositoryRoot) {
			const value = cliArguments[index + 1];
			if (value === undefined || value.startsWith('--')) throw new Error(usage);
			repositoryRoot = value;
			sawRepositoryRoot = true;
			index += 1;
			continue;
		}
		if (argument === '--format' && !sawFormat) {
			const value = cliArguments[index + 1];
			if (value !== 'text' && value !== 'json') throw new Error(usage);
			format = value;
			sawFormat = true;
			index += 1;
			continue;
		}
		throw new Error(usage);
	}
	return { repositoryRoot, format };
}

function formatText(report: AmericanEnglishAuditReport): string {
	const lines = report.violations.map((violation) => {
		const location =
			violation.line === null
				? violation.path
				: `${violation.path}:${violation.line}:${violation.column}`;
		return `${location}: ${violation.found} -> ${violation.recommended} [${violation.ruleId}/${violation.kind}]`;
	});
	lines.push(
		`American English audit: ${report.counts.total} violation(s) (${report.counts.content} content, ${report.counts.path} path).`
	);
	return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
	let options: CliOptions;
	try {
		options = parseArguments(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : usage}\n`);
		process.exitCode = 2;
		return;
	}

	try {
		const report = await auditTrackedTreeReport(options.repositoryRoot);
		process.stdout.write(
			options.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : formatText(report)
		);
		process.exitCode = report.counts.total === 0 ? 0 : 1;
	} catch (error) {
		process.stderr.write(`American English audit failed: ${String(error)}\n${usage}\n`);
		process.exitCode = 2;
	}
}

await main();
