import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { FinalControlledDesignRisks } from '../packages/contracts/src/index.js';

export const AFFINITY_CLIENT_BUNDLE_ROOT = 'apps/web/.svelte-kit/output/client' as const;

export const ProtectedFinalControlledDesignRiskValues = [
	'final-controlled-activation-v1',
	...FinalControlledDesignRisks.flatMap((risk) => [risk.riskId, risk.coordinate])
] as const;

export interface AffinityClientBundlePrivacyReport {
	readonly schemaVersion: 'affinity-client-bundle-privacy-v1';
	readonly status: 'passed';
	readonly bundleRoot: typeof AFFINITY_CLIENT_BUNDLE_ROOT;
	readonly scannedFileCount: number;
	readonly scannedByteCount: number;
	readonly protectedValueCount: number;
}

async function listScannableFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry): Promise<string[]> => {
			const entryPath = path.join(root, entry.name);
			if (entry.isDirectory()) return listScannableFiles(entryPath);
			if (!entry.isFile() || !/\.(?:html|js|json)$/u.test(entry.name)) return [];
			return [entryPath];
		})
	);
	return nested.flat().toSorted();
}

export async function validateAffinityClientBundlePrivacy(
	workspaceRoot = path.resolve('.')
): Promise<AffinityClientBundlePrivacyReport> {
	const bundleRoot = path.resolve(workspaceRoot, AFFINITY_CLIENT_BUNDLE_ROOT);
	const files = await listScannableFiles(bundleRoot);
	if (!files.some((file) => file.endsWith('.js'))) {
		throw new Error(
			'The production client bundle is missing; build the web app before validation.'
		);
	}

	let scannedByteCount = 0;
	for (const file of files) {
		const content = await readFile(file, 'utf8');
		scannedByteCount += Buffer.byteLength(content);
		const leaked = ProtectedFinalControlledDesignRiskValues.find((value) =>
			content.includes(value)
		);
		if (leaked) {
			throw new Error(
				`Protected final-controlled design-risk value leaked into client bundle file ${path.relative(bundleRoot, file)}: ${leaked}`
			);
		}
	}

	return {
		schemaVersion: 'affinity-client-bundle-privacy-v1',
		status: 'passed',
		bundleRoot: AFFINITY_CLIENT_BUNDLE_ROOT,
		scannedFileCount: files.length,
		scannedByteCount,
		protectedValueCount: new Set(ProtectedFinalControlledDesignRiskValues).size
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		process.stdout.write(
			`${JSON.stringify(await validateAffinityClientBundlePrivacy(), null, 2)}\n`
		);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
