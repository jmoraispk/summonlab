import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	AFFINITY_CLIENT_BUNDLE_ROOT,
	ProtectedFinalControlledDesignRiskValues,
	validateAffinityClientBundlePrivacy
} from './validate-affinity-client-bundle-privacy.js';

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(content: string): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'summonlab-affinity-client-privacy-'));
	roots.push(root);
	const bundleRoot = path.join(root, AFFINITY_CLIENT_BUNDLE_ROOT);
	await mkdir(path.join(bundleRoot, '_app/immutable/chunks'), { recursive: true });
	await writeFile(path.join(bundleRoot, '_app/immutable/chunks/app.js'), content, 'utf8');
	return root;
}

describe('affinity client-bundle privacy', () => {
	it('accepts a built client tree with no protected semantic values', async () => {
		const root = await workspace('const status = "blind";');
		await expect(validateAffinityClientBundlePrivacy(root)).resolves.toMatchObject({
			status: 'passed',
			scannedFileCount: 1,
			protectedValueCount: new Set(ProtectedFinalControlledDesignRiskValues).size
		});
	});

	it('rejects any protected risk identity in a client chunk', async () => {
		const leaked = ProtectedFinalControlledDesignRiskValues[1]!;
		const root = await workspace(`const leaked = ${JSON.stringify(leaked)};`);
		await expect(validateAffinityClientBundlePrivacy(root)).rejects.toThrow(leaked);
	});

	it('does not treat public base target IDs as secret risk-decision metadata', async () => {
		const root = await workspace('const publicTarget = "affinity-workflow-v1-cave-bear-normal";');
		await expect(validateAffinityClientBundlePrivacy(root)).resolves.toMatchObject({
			status: 'passed'
		});
	});

	it('fails closed when no production client JavaScript exists', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-affinity-client-privacy-'));
		roots.push(root);
		await mkdir(path.join(root, AFFINITY_CLIENT_BUNDLE_ROOT), { recursive: true });
		await expect(validateAffinityClientBundlePrivacy(root)).rejects.toThrow(
			'production client bundle is missing'
		);
	});
});
