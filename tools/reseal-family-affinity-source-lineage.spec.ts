import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	familyAffinityPromptSha256,
	familyAffinitySha256
} from './family-affinity-production-lib.js';
import {
	resealFamilyAffinitySourceLineageDocuments,
	selectFamilyAffinitySourceLineagePaths
} from './reseal-family-affinity-source-lineage.js';

const sourcePath =
	'assets/enemies/experiments/family-affinity-v1/family-replacements/21-elementals.json';

describe('family-affinity source lineage resealing', () => {
	it('validates the canonical packet and propagates its digest across bound documents', async () => {
		const sourceContents = await readFile(path.resolve(sourcePath), 'utf8');
		const sourceDigest = familyAffinitySha256(JSON.parse(sourceContents));
		const staleDigest = 'f'.repeat(64);
		const documents = [
			{
				path: 'assets/enemies/experiments/family-affinity-v1/targets/elementals/fixture/normal/target-v1.json',
				contents: `${JSON.stringify({
					sources: { familyPacketPath: sourcePath, familyPacketSha256: staleDigest }
				})}\n`
			},
			{
				path: 'assets/enemies/experiments/family-affinity-v1/results/elementals/fixture/normal-v1.json',
				contents: `${JSON.stringify({ sourceSha256: staleDigest })}\n`
			}
		];

		expect(
			resealFamilyAffinitySourceLineageDocuments(
				{ path: sourcePath, contents: sourceContents },
				documents
			)
		).toEqual(
			documents.map((document) => ({
				...document,
				contents: document.contents.replace(staleDigest, sourceDigest)
			}))
		);
	});

	it('preserves exact bytes when packet bindings are already current', async () => {
		const sourceContents = await readFile(path.resolve(sourcePath), 'utf8');
		const sourceDigest = familyAffinitySha256(JSON.parse(sourceContents));
		const contents = ` {"sources":{"familyPacketPath":"${sourcePath}","familyPacketSha256":"${sourceDigest}"}} `;

		expect(
			resealFamilyAffinitySourceLineageDocuments({ path: sourcePath, contents: sourceContents }, [
				{ path: 'target.json', contents }
			])
		).toEqual([]);
	});

	it('reseals target and prompt lineage after the family packet digest changes', async () => {
		const targetPath =
			'assets/enemies/experiments/family-affinity-v1/targets/elementals/elemental-spirit/fire/target-v2.json';
		const assignmentPath =
			'assets/enemies/experiments/family-affinity-v1/assignments/elementals/elemental-spirit/fire/assignment-v2.json';
		const resultPath =
			'assets/enemies/experiments/family-affinity-v1/results/elementals/elemental-spirit/fire-v2.json';
		const sourceContents = await readFile(path.resolve(sourcePath), 'utf8');
		const sourceDigest = familyAffinitySha256(JSON.parse(sourceContents));
		const staleDigest = 'f'.repeat(64);
		const target = JSON.parse(await readFile(path.resolve(targetPath), 'utf8'));
		target.sources.familyPacketSha256 = staleDigest;
		const assignment = JSON.parse(await readFile(path.resolve(assignmentPath), 'utf8'));
		assignment.targetSha256 = familyAffinitySha256(target);
		const result = JSON.parse(await readFile(path.resolve(resultPath), 'utf8'));
		result.sourceSha256 = staleDigest;
		result.targetSha256 = familyAffinitySha256(target);
		result.promptSha256 = familyAffinityPromptSha256(target, assignment);
		const receiptPath =
			'assets/enemies/experiments/family-affinity-v1/review/decisions/elementals/fixture.json';
		const receipt = {
			targetId: target.targetId,
			promptSha256: result.promptSha256,
			sourceSha256: staleDigest
		};
		const documents = [
			{ path: targetPath, contents: `${JSON.stringify(target)}\n` },
			{ path: assignmentPath, contents: `${JSON.stringify(assignment)}\n` },
			{ path: resultPath, contents: `${JSON.stringify(result)}\n` },
			{ path: receiptPath, contents: `${JSON.stringify(receipt)}\n` }
		];

		const changed = resealFamilyAffinitySourceLineageDocuments(
			{ path: sourcePath, contents: sourceContents },
			documents
		);
		const byPath = new Map(
			changed.map((document) => [document.path, JSON.parse(document.contents)])
		);
		const updatedTarget = byPath.get(targetPath);
		const updatedAssignment = byPath.get(assignmentPath);
		const updatedResult = byPath.get(resultPath);
		const updatedReceipt = byPath.get(receiptPath);
		expect(updatedTarget.sources.familyPacketSha256).toBe(sourceDigest);
		expect(updatedAssignment.targetSha256).toBe(familyAffinitySha256(updatedTarget));
		expect(updatedResult.targetSha256).toBe(familyAffinitySha256(updatedTarget));
		expect(updatedResult.promptSha256).toBe(
			familyAffinityPromptSha256(updatedTarget, updatedAssignment)
		);
		expect(updatedReceipt.promptSha256).toBe(updatedResult.promptSha256);
		expect(updatedReceipt.sourceSha256).toBe(updatedResult.sourceSha256);
	});

	it('selects only tracked elementals JSON lineage', () => {
		expect(
			selectFamilyAffinitySourceLineagePaths([
				'assets/enemies/experiments/family-affinity-v1/manifest.json',
				'assets/enemies/experiments/family-affinity-v1/targets/elementals/wisp/normal/target-v1.json',
				'assets/enemies/experiments/family-affinity-v1/results/elementals/wisp/normal-v1.json',
				'assets/enemies/experiments/family-affinity-v1/targets/dragons/drake/normal/target-v1.json',
				'assets/enemies/experiments/family-affinity-v1/candidates/elementals/wisp/normal-v1.png'
			])
		).toEqual([
			'assets/enemies/experiments/family-affinity-v1/manifest.json',
			'assets/enemies/experiments/family-affinity-v1/results/elementals/wisp/normal-v1.json',
			'assets/enemies/experiments/family-affinity-v1/targets/elementals/wisp/normal/target-v1.json'
		]);
	});
});
