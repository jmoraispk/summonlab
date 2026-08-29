import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	ImageProductionCatalogSchema,
	ImageProductionEvaluationSchema
} from '../packages/contracts/src/index.js';
import {
	ImageProductionBlindReviewCollectionSchema,
	createAffinityWorkflowExportBundle
} from './image-production-lib.js';
import { format } from 'prettier';

const workspaceRoot = process.cwd();
const check = process.argv.includes('--check');
const bundle = createAffinityWorkflowExportBundle();

async function jsonText(filePath: string, value: unknown): Promise<string> {
	return format(JSON.stringify(value), {
		filepath: filePath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
}

function validateAggregate(pathname: string, source: string): void {
	const value: unknown = JSON.parse(source);
	if (pathname.endsWith('/catalog.json')) ImageProductionCatalogSchema.parse(value);
	else if (pathname.endsWith('/blind-review.json')) {
		ImageProductionBlindReviewCollectionSchema.parse(value);
	} else if (pathname.endsWith('/evaluation.json')) ImageProductionEvaluationSchema.parse(value);
}

for (const artifact of bundle.artifacts) {
	const outputPath = path.resolve(workspaceRoot, artifact.path);
	const expected = await jsonText(outputPath, artifact.value);
	const current = await readFile(outputPath, 'utf8').catch(() => null);

	if (artifact.ownership === 'orchestrator-aggregate') {
		if (current === null) {
			if (check) throw new Error(`Missing affinity workflow aggregate: ${artifact.path}`);
			await mkdir(path.dirname(outputPath), { recursive: true });
			await writeFile(outputPath, expected, 'utf8');
		} else {
			validateAggregate(artifact.path, current);
		}
		continue;
	}

	if (check) {
		if (current !== expected) {
			throw new Error(
				`Affinity workflow artifact is missing or stale: ${artifact.path}; run pnpm export:affinity-workflow`
			);
		}
	} else {
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, expected, 'utf8');
	}
}

process.stdout.write(
	`${JSON.stringify(
		{
			mode: check ? 'check' : 'write',
			experimentId: bundle.catalog.experimentId,
			targets: bundle.targets.length,
			assignments: bundle.assignments.length,
			generatedArtifacts: bundle.artifacts.filter((artifact) => artifact.ownership === 'generated')
				.length,
			aggregates: bundle.artifacts.filter(
				(artifact) => artifact.ownership === 'orchestrator-aggregate'
			).length
		},
		null,
		2
	)}\n`
);
