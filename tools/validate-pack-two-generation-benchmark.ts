import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HumanCatalogSchema = z.object({
	assets: z.array(
		z.object({
			role: z.enum(['full-body-anchor', 'continuity-sheet']),
			humanStatus: z.literal('candidate'),
			attempts: z.array(
				z.object({
					elapsedMs: z.number().int().positive(),
					result: z.enum(['candidate', 'revise'])
				})
			)
		})
	)
});
const MonsterCatalogSchema = z.object({
	plates: z.array(
		z.object({ elapsedMs: z.number().int().positive(), humanStatus: z.literal('candidate') })
	)
});
const BenchmarkSamplesSchema = z.object({
	benchmarkVersion: z.literal('pack-two-generation-benchmark-v1'),
	generationMode: z.literal('built-in-imagegen'),
	costAvailability: z.literal('unavailable-built-in-path'),
	transferBoundary: z.string().min(1),
	normalizationBenchmark: z.object({
		source: z.string().min(1),
		operation: z.string().min(1),
		elapsedMs: z.number().int().positive(),
		outputBytes: z.number().int().positive()
	}),
	samples: z.array(
		z.object({
			assetType: z.enum([
				'individual-monster-anchor',
				'identity-preserving-state-edit',
				'evolution-variant'
			]),
			assetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
			name: z.string().min(1),
			requestStartedAt: z.string().datetime(),
			responseCompletedAt: z.string().datetime(),
			elapsedMs: z.number().int().positive(),
			result: z.literal('candidate'),
			humanStatus: z.literal('candidate'),
			sourceOutput: z.string().min(1),
			file: z.string().min(1),
			width: z.number().int().positive(),
			height: z.number().int().positive(),
			bytes: z.number().int().positive(),
			contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
			promptHeading: z.string().min(1),
			stateProfile: z.record(z.string(), z.unknown()).optional()
		})
	)
});
const BenchmarkReportSchema = z.object({
	benchmarkVersion: z.literal('pack-two-generation-benchmark-v1'),
	percentileMethod: z.literal('nearest-rank'),
	generationMode: z.literal('built-in-imagegen'),
	humanApproval: z.literal('pending'),
	categories: z.array(
		z.object({
			assetType: z.string().min(1),
			requests: z.number().int().positive(),
			candidateAssets: z.number().int().positive(),
			requestMedianMs: z.number().int().positive(),
			requestP90Ms: z.number().int().positive(),
			requestP95Ms: z.number().int().positive(),
			candidateMedianMs: z.number().int().positive(),
			candidateP90Ms: z.number().int().positive(),
			candidateP95Ms: z.number().int().positive()
		})
	),
	normalization: z.object({ operation: z.string().min(1), elapsedMs: z.number().int().positive() }),
	cost: z.literal('unavailable-built-in-path')
});

const [humanCatalog, monsterCatalog, benchmark, persistedReport] = await Promise.all([
	readFile(resolve(workspaceRoot, 'assets/heroes/visuals/forge-v2/catalog.json'), 'utf8').then(
		(value) => HumanCatalogSchema.parse(JSON.parse(value))
	),
	readFile(resolve(workspaceRoot, 'assets/enemies/review/pack-2/catalog.json'), 'utf8').then(
		(value) => MonsterCatalogSchema.parse(JSON.parse(value))
	),
	readFile(resolve(workspaceRoot, 'assets/benchmarks/pack-two/samples.json'), 'utf8').then(
		(value) => BenchmarkSamplesSchema.parse(JSON.parse(value))
	),
	readFile(resolve(workspaceRoot, 'assets/benchmarks/pack-two/report.json'), 'utf8').then((value) =>
		BenchmarkReportSchema.parse(JSON.parse(value))
	)
]);
const promptRecord = await readFile(
	resolve(workspaceRoot, 'assets/benchmarks/pack-two/generation-record.md'),
	'utf8'
);

for (const sample of benchmark.samples) {
	const start = Date.parse(sample.requestStartedAt);
	const end = Date.parse(sample.responseCompletedAt);
	if (Math.abs(end - start - sample.elapsedMs) > 1) {
		throw new Error(`${sample.name} request boundary does not match its measured wall clock`);
	}
	const absolutePath = resolve(workspaceRoot, sample.file);
	const [buffer, file, metadata] = await Promise.all([
		readFile(absolutePath),
		stat(absolutePath),
		sharp(absolutePath).metadata()
	]);
	if (file.size !== sample.bytes) throw new Error(`${sample.name} byte count changed`);
	if (metadata.width !== sample.width || metadata.height !== sample.height) {
		throw new Error(`${sample.name} dimensions changed`);
	}
	if (createHash('sha256').update(buffer).digest('hex') !== sample.contentHash) {
		throw new Error(`${sample.name} hash changed`);
	}
	if (!promptRecord.includes(`## ${sample.promptHeading}`)) {
		throw new Error(`${sample.name} exact prompt is missing`);
	}
}

function percentile(values: readonly number[], fraction: number): number {
	if (values.length === 0) throw new Error('Cannot calculate an empty percentile');
	const ordered = [...values].sort((left, right) => left - right);
	return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)]!;
}

function metrics(requests: readonly number[], candidateAssets: readonly number[]) {
	return {
		requestCount: requests.length,
		requestLatencyMs: {
			median: percentile(requests, 0.5),
			p90: percentile(requests, 0.9),
			p95: percentile(requests, 0.95)
		},
		candidateAssetCount: candidateAssets.length,
		candidateAssetWallClockMs: {
			median: percentile(candidateAssets, 0.5),
			p90: percentile(candidateAssets, 0.9),
			p95: percentile(candidateAssets, 0.95)
		},
		humanApproval: 'pending'
	};
}

const categories: Record<string, ReturnType<typeof metrics>> = {};
for (const [name, role] of [
	['human-full-body-anchor', 'full-body-anchor'],
	['human-continuity-sheet', 'continuity-sheet']
] as const) {
	const assets = humanCatalog.assets.filter((asset) => asset.role === role);
	categories[name] = metrics(
		assets.flatMap((asset) => asset.attempts.map((attempt) => attempt.elapsedMs)),
		assets.map((asset) => asset.attempts.reduce((total, attempt) => total + attempt.elapsedMs, 0))
	);
}
categories['monster-family-plate'] = metrics(
	monsterCatalog.plates.map((plate) => plate.elapsedMs),
	monsterCatalog.plates.map((plate) => plate.elapsedMs)
);
for (const sample of benchmark.samples) {
	categories[sample.assetType] = metrics([sample.elapsedMs], [sample.elapsedMs]);
}

for (const reportCategory of persistedReport.categories) {
	const calculated = categories[reportCategory.assetType];
	if (!calculated) throw new Error(`Report has unknown category ${reportCategory.assetType}`);
	const expected = {
		assetType: reportCategory.assetType,
		requests: calculated.requestCount,
		candidateAssets: calculated.candidateAssetCount,
		requestMedianMs: calculated.requestLatencyMs.median,
		requestP90Ms: calculated.requestLatencyMs.p90,
		requestP95Ms: calculated.requestLatencyMs.p95,
		candidateMedianMs: calculated.candidateAssetWallClockMs.median,
		candidateP90Ms: calculated.candidateAssetWallClockMs.p90,
		candidateP95Ms: calculated.candidateAssetWallClockMs.p95
	};
	if (JSON.stringify(reportCategory) !== JSON.stringify(expected)) {
		throw new Error(`Persisted report drifted for ${reportCategory.assetType}`);
	}
}
if (persistedReport.categories.length !== Object.keys(categories).length) {
	throw new Error('Persisted report does not cover every calculated category');
}
if (persistedReport.normalization.elapsedMs !== benchmark.normalizationBenchmark.elapsedMs) {
	throw new Error('Persisted normalization timing drifted');
}

process.stdout.write(
	JSON.stringify(
		{
			benchmarkVersion: benchmark.benchmarkVersion,
			generationMode: benchmark.generationMode,
			costAvailability: benchmark.costAvailability,
			transferBoundary: benchmark.transferBoundary,
			normalizationBenchmark: benchmark.normalizationBenchmark,
			percentileMethod: 'nearest-rank',
			categories
		},
		null,
		2
	) + '\n'
);
