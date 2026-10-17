import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import phoneEnvironment from '../apps/web/static/runtime/settlements/hearth-01/environment-phone.json' with { type: 'json' };

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
if (report.measurements.firstSettlementVisualBytes !== phoneEnvironment.bytes) {
	throw new Error('Phone performance evidence references a stale first-settlement visual payload');
}

const phoneBytes = await readFile(resolve(workspaceRoot, phoneEnvironment.file));
const phoneSourceBytes = await readFile(resolve(workspaceRoot, scene.source.file));
const phoneMetadata = await sharp(phoneBytes).metadata();
if (
	phoneEnvironment.sourceFile !== scene.source.file ||
	phoneEnvironment.sourceContentHash !== scene.source.contentHash ||
	createHash('sha256').update(phoneSourceBytes).digest('hex') !== scene.source.contentHash ||
	phoneEnvironment.file !== `apps/web/static${phoneEnvironment.publicPath}` ||
	!phoneEnvironment.publicPath.includes(phoneEnvironment.contentHash.slice(0, 12)) ||
	createHash('sha256').update(phoneBytes).digest('hex') !== phoneEnvironment.contentHash ||
	phoneBytes.length !== phoneEnvironment.bytes ||
	phoneBytes.length > 300_000 ||
	phoneEnvironment.encoder.preset !== 'picture' ||
	phoneEnvironment.width !== phoneMetadata.width ||
	phoneEnvironment.height !== phoneMetadata.height ||
	phoneMetadata.width !== scene.runtime.width ||
	phoneMetadata.height !== scene.runtime.height
) {
	throw new Error('Phone Village artwork does not match its source, runtime binding, or budget');
}
const reproducedPhoneBytes = await sharp(phoneSourceBytes)
	.webp({ ...phoneEnvironment.encoder, preset: 'picture' })
	.toBuffer();
if (!reproducedPhoneBytes.equals(phoneBytes)) {
	throw new Error('Phone Village artwork is not reproducible from its approved source');
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
