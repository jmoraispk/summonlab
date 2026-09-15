import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
	PlaytestReleaseReportSchema,
	assertPlaytestReleaseReady
} from '../packages/evaluation/src/index.js';
import { createPrivatePlaytestPackage } from './playtest-package-lib.js';

const root = process.cwd();
const run = promisify(execFile);
const acknowledgment = '--acknowledge-private-release';
if (!process.argv.includes(acknowledgment)) {
	throw new Error(`Private packaging requires explicit operator acknowledgment: ${acknowledgment}`);
}

const reportPath = path.join(root, 'docs/evidence/phase-7-fin008-playtest-release.json');
const report = PlaytestReleaseReportSchema.parse(JSON.parse(await readFile(reportPath, 'utf8')));
assertPlaytestReleaseReady(report);

const { stdout: dirtyTracked } = await run(
	'git',
	['status', '--porcelain', '--untracked-files=no'],
	{ cwd: root }
);
if (dirtyTracked.trim().length > 0) {
	throw new Error('Commit tracked release inputs before packaging the private build.');
}

const { stdout: commitOutput } = await run('git', ['rev-parse', 'HEAD'], { cwd: root });
const commit = commitOutput.trim();
await run('pnpm', ['build'], { cwd: root });

const created = await createPrivatePlaytestPackage({
	root,
	artifactRoot: path.join(root, 'artifacts/private-playtest'),
	archiveName: report.packagePlan.archiveName,
	mode: 'release',
	metadata: {
		releaseId: report.releaseId,
		commit,
		sourceTreeStatus: 'clean',
		releaseReportHash: report.reportHash,
		ownerPlaytestReportHash: report.generatedFrom.ownerPlaytestReportHash
	}
});

process.stdout.write(
	`${created.archivePath}\n${created.receipt.sha256}\n${created.receipt.bytes} bytes\n`
);
