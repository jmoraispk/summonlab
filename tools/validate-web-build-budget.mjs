import { gzipSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';

const JAVASCRIPT_BUDGET_BYTES = 700_000;
const EVIDENCE_DRIFT_TOLERANCE_BYTES = 256;
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = resolve(workspaceRoot, 'apps/web/.svelte-kit/output/client');
const manifestPath = resolve(clientRoot, '.vite/manifest.json');
const generatedNodeRoot = resolve(
	workspaceRoot,
	'apps/web/.svelte-kit/generated/client-optimized/nodes'
);
const runtimeManifestPath = resolve(
	workspaceRoot,
	'apps/web/static/runtime/visual-catalog-v1/manifest.json'
);
const reportPath = resolve(workspaceRoot, 'docs/evidence/phase-3-runtime-budget.json');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const runtimeManifest = JSON.parse(await readFile(runtimeManifestPath, 'utf8'));

function entryKeyByName(name) {
	const match = Object.entries(manifest).find(([, entry]) => entry.name === name);
	if (!match) throw new Error(`Missing Vite manifest entry: ${name}`);
	return match[0];
}

async function routeNodeKey(sourceSuffix) {
	const nodeEntries = Object.entries(manifest).filter(([, entry]) =>
		/^nodes\/\d+$/u.test(entry.name)
	);
	for (const [key, entry] of nodeEntries) {
		const nodeNumber = entry.name.split('/')[1];
		const source = await readFile(resolve(generatedNodeRoot, `${nodeNumber}.js`), 'utf8');
		if (source.includes(sourceSuffix)) return key;
	}
	throw new Error(`Missing generated route node: ${sourceSuffix}`);
}

function collect(entryKeys, includeDynamic) {
	const visited = new Set();
	const visit = (key) => {
		if (visited.has(key)) return;
		const entry = manifest[key];
		if (!entry) throw new Error(`Broken Vite manifest reference: ${key}`);
		visited.add(key);
		for (const dependency of entry.imports ?? []) visit(dependency);
		if (includeDynamic) {
			for (const dependency of entry.dynamicImports ?? []) visit(dependency);
		}
	};
	for (const key of entryKeys) visit(key);
	return visited;
}

async function gzipBytes(entryKeys) {
	let bytes = 0;
	for (const key of entryKeys) {
		bytes += gzipSync(await readFile(resolve(clientRoot, manifest[key].file))).byteLength;
	}
	return bytes;
}

const startKey = entryKeyByName('entry/start');
const appKey = entryKeyByName('entry/app');
const layoutKey = await routeNodeKey('src/routes/+layout.svelte');
const homeKey = await routeNodeKey('src/routes/+page.svelte');
const runtimeKey = await routeNodeKey('src/routes/visual-lab/runtime-bundles/+page.svelte');
const recognitionKey = await routeNodeKey('src/routes/visual-lab/recognition/+page.svelte');
const settlementRouteKey = await routeNodeKey('src/routes/settlement-lab/+page.svelte');
const initialEntries = collect([startKey, appKey, layoutKey, homeKey], false);
const shellEntries = collect([startKey, appKey, layoutKey], false);
const runtimeEntries = new Set([...shellEntries, ...collect([runtimeKey], true)]);
const recognitionEntries = new Set([...shellEntries, ...collect([recognitionKey], true)]);
const settlementRouteEntries = new Set([...shellEntries, ...collect([settlementRouteKey], true)]);
const lazyEntries = [...runtimeEntries].filter((key) => !initialEntries.has(key));
const lazySizes = await Promise.all(
	lazyEntries.map(async (key) => ({ key, bytes: await gzipBytes(new Set([key])) }))
);

const report = {
	schemaVersion: 'web-build-budget-v1',
	budgets: {
		initialJavaScriptGzipBytes: JAVASCRIPT_BUDGET_BYTES,
		runtimeInspectorLoadedJavaScriptGzipBytes: JAVASCRIPT_BUDGET_BYTES,
		recognitionAuditLoadedJavaScriptGzipBytes: JAVASCRIPT_BUDGET_BYTES,
		settlementRouteLabLoadedJavaScriptGzipBytes: JAVASCRIPT_BUDGET_BYTES,
		runtimeVisualPayloadBytes: runtimeManifest.initialPayloadBudgetBytes
	},
	measurements: {
		initialJavaScriptGzipBytes: await gzipBytes(initialEntries),
		runtimeInspectorLoadedJavaScriptGzipBytes: await gzipBytes(runtimeEntries),
		recognitionAuditLoadedJavaScriptGzipBytes: await gzipBytes(recognitionEntries),
		settlementRouteLabLoadedJavaScriptGzipBytes: await gzipBytes(settlementRouteEntries),
		largestRuntimeLazyChunkGzipBytes: Math.max(...lazySizes.map(({ bytes }) => bytes)),
		runtimeVisualPayloadBytes: runtimeManifest.initialPayloadBytes
	},
	status: {
		initialJavaScript: 'within-budget',
		runtimeInspectorLoadedJavaScript: 'within-budget',
		recognitionAuditLoadedJavaScript: 'within-budget',
		settlementRouteLabLoadedJavaScript: 'within-budget',
		runtimeVisualPayload: 'within-budget'
	}
};

if (report.measurements.initialJavaScriptGzipBytes > report.budgets.initialJavaScriptGzipBytes) {
	throw new Error('Initial JavaScript exceeds the 700 KB compressed budget');
}
if (
	report.measurements.runtimeInspectorLoadedJavaScriptGzipBytes >
	report.budgets.runtimeInspectorLoadedJavaScriptGzipBytes
) {
	throw new Error('Loaded runtime inspector JavaScript exceeds the 700 KB compressed budget');
}
if (
	report.measurements.recognitionAuditLoadedJavaScriptGzipBytes >
	report.budgets.recognitionAuditLoadedJavaScriptGzipBytes
) {
	throw new Error('Loaded recognition audit JavaScript exceeds the 700 KB compressed budget');
}
if (
	report.measurements.settlementRouteLabLoadedJavaScriptGzipBytes >
	report.budgets.settlementRouteLabLoadedJavaScriptGzipBytes
) {
	throw new Error('Loaded settlement route lab JavaScript exceeds the 700 KB compressed budget');
}
if (report.measurements.runtimeVisualPayloadBytes > report.budgets.runtimeVisualPayloadBytes) {
	throw new Error('Runtime visual payload exceeds the 8 MB phone budget');
}

const reportText = await format(JSON.stringify(report), {
	parser: 'json',
	useTabs: true,
	printWidth: 100,
	trailingComma: 'none'
});
if (process.argv.includes('--write')) {
	await writeFile(reportPath, reportText);
} else {
	const stored = await readFile(reportPath, 'utf8');
	const storedReport = JSON.parse(stored);
	const stableEvidenceMatches =
		storedReport.schemaVersion === report.schemaVersion &&
		JSON.stringify(storedReport.budgets) === JSON.stringify(report.budgets) &&
		JSON.stringify(storedReport.status) === JSON.stringify(report.status) &&
		storedReport.measurements.runtimeVisualPayloadBytes ===
			report.measurements.runtimeVisualPayloadBytes;
	const javascriptEvidenceIsCurrent = [
		'initialJavaScriptGzipBytes',
		'runtimeInspectorLoadedJavaScriptGzipBytes',
		'recognitionAuditLoadedJavaScriptGzipBytes',
		'settlementRouteLabLoadedJavaScriptGzipBytes',
		'largestRuntimeLazyChunkGzipBytes'
	].every((key) => {
		const storedBytes = storedReport.measurements?.[key];
		const currentBytes = report.measurements[key];
		return (
			Number.isInteger(storedBytes) &&
			Math.abs(storedBytes - currentBytes) <= EVIDENCE_DRIFT_TOLERANCE_BYTES
		);
	});
	if (!stableEvidenceMatches || !javascriptEvidenceIsCurrent) {
		throw new Error(
			'Checked-in web build budget report is stale; run pnpm measure:web-build-budget'
		);
	}
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
