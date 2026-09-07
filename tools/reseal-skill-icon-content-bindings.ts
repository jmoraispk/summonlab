import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const v1 = 'assets/wiki/skills/icon-production-v1';
const v2 = 'assets/wiki/skills/icon-production-v2';
const run = `${v2}/runs`;
const bindingsByPath = new Map<string, ReadonlySet<string>>([
	[
		`${v2}/overlay.json`,
		new Set([`${v1}/catalog.json`, `${v1}/motif-map.json`, `${v1}/visual-specs.json`])
	],
	[
		`${run}/reversal-cut-v1/manifest.json`,
		new Set([`${v2}/catalog.json`, `${v2}/motif-map.json`, `${v2}/visual-specs.json`])
	],
	[`${run}/reversal-cut-v2/completion.json`, new Set([`${run}/reversal-cut-v2/manifest.json`])],
	[`${run}/reversal-cut-v2/guard-flow-ancestor-authority.json`, new Set([`${v2}/catalog.json`])],
	[
		`${run}/reversal-cut-v2/individual-attempt-v1.json`,
		new Set([`${v2}/catalog.json`, `${run}/reversal-cut-v2/guard-flow-ancestor-authority.json`])
	],
	[
		`${run}/reversal-cut-v2/manifest.json`,
		new Set([`${v2}/catalog.json`, `${v2}/motif-map.json`, `${v2}/visual-specs.json`])
	],
	[`${run}/reversal-cut-v3/activation.json`, new Set([`${run}/reversal-cut-v3/owner-review.json`])],
	[
		`${run}/reversal-cut-v3/owner-review.json`,
		new Set([
			`${run}/reversal-cut-v2/individual-attempt-v1.json`,
			`${v2}/catalog.json`,
			`${run}/reversal-cut-v2/guard-flow-ancestor-authority.json`
		])
	],
	[
		`${run}/reversal-cut-v4/correction.json`,
		new Set([
			`${run}/reversal-cut-v4/owner-frame-feedback.json`,
			`${run}/reversal-cut-v3/activation.json`,
			`${v1}/mass-production-v1/manifest.json`
		])
	],
	[
		`${run}/reversal-cut-v4/owner-frame-feedback.json`,
		new Set([`${run}/reversal-cut-v3/activation.json`])
	],
	[`${run}/reversal-cut-v7/activation.json`, new Set([`${run}/reversal-cut-v3/activation.json`])]
]);
const bindingPaths = [...bindingsByPath.keys()];

function visit(value: unknown, update: (record: Record<string, unknown>) => void): void {
	if (Array.isArray(value)) {
		for (const child of value) visit(child, update);
		return;
	}
	if (value === null || typeof value !== 'object') return;
	const record = value as Record<string, unknown>;
	update(record);
	for (const child of Object.values(record)) visit(child, update);
}

for (let iteration = 0; iteration < bindingPaths.length; iteration += 1) {
	let changed = false;
	for (const repositoryPath of bindingPaths) {
		const filePath = path.join(root, ...repositoryPath.split('/'));
		const source = await readFile(filePath, 'utf8');
		const value = JSON.parse(source) as unknown;
		visit(value, (record) => {
			if (
				typeof record.path !== 'string' ||
				typeof record.contentHash !== 'string' ||
				!bindingsByPath.get(repositoryPath)!.has(record.path)
			)
				return;
			const targetPath = path.join(root, ...record.path.split('/'));
			const target = readFile(targetPath).catch(() => null);
			(record as Record<string, unknown>).__pendingHash = target;
		});
		const pending: Promise<void>[] = [];
		visit(value, (record) => {
			const target = record.__pendingHash;
			if (!(target instanceof Promise)) return;
			delete record.__pendingHash;
			pending.push(
				target.then((bytes) => {
					if (bytes === null) return;
					const digest = createHash('sha256').update(bytes).digest('hex');
					if (record.contentHash !== digest) {
						record.contentHash = digest;
						changed = true;
					}
				})
			);
		});
		await Promise.all(pending);
		const expected = `${JSON.stringify(value, null, source.includes('\t') ? '\t' : 2)}\n`;
		if (expected !== source) await writeFile(filePath, expected, 'utf8');
	}
	if (!changed) break;
	if (iteration === bindingPaths.length - 1) {
		throw new Error('Skill-icon content binding reseal did not converge');
	}
}
