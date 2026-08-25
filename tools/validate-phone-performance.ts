import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadHearth01Scene } from '../packages/content/src/index.js';
import {
	PhonePerformanceReportSchema,
	PlayerVisualManifestSchema,
	WebBuildBudgetReportSchema
} from '../packages/contracts/src/index.js';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function json(path: string): Promise<unknown> {
	return JSON.parse(await readFile(resolve(workspaceRoot, path), 'utf8'));
}

const [reportSource, buildSource, playerManifestSource, scene] = await Promise.all([
	json('docs/evidence/phase-7-fin005-phone-performance.json'),
	json('docs/evidence/phase-3-runtime-budget.json'),
	json('apps/web/static/runtime/player/manifest.json'),
	loadHearth01Scene()
]);
const report = PhonePerformanceReportSchema.parse(reportSource);
const build = WebBuildBudgetReportSchema.parse(buildSource);
const playerManifest = PlayerVisualManifestSchema.parse(playerManifestSource);
const titlePhone = playerManifest.assets.find((asset) => asset.usage === 'title-phone');
if (!titlePhone) throw new Error('Player visual manifest has no phone title asset');

if (
	report.measurements.initialJavaScriptGzipBytes !== build.measurements.initialJavaScriptGzipBytes
) {
	throw new Error('Phone performance evidence references a stale initial JavaScript measurement');
}
if (report.measurements.playerTitleVisualBytes !== titlePhone.bytes) {
	throw new Error('Phone performance evidence references a stale title visual');
}
if (report.measurements.firstSettlementVisualBytes !== scene.runtime.bytes) {
	throw new Error('Phone performance evidence references a stale first-settlement visual payload');
}

process.stdout.write(
	`${JSON.stringify(
		{
			profile: report.profile.name,
			measurements: report.measurements,
			status: report.status,
			realDeviceReview: report.methodology.realDeviceReview
		},
		null,
		2
	)}\n`
);
