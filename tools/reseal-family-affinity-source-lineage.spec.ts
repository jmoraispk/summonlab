import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	familyAffinityPromptSha256,
	familyAffinityRawSha256,
	familyAffinityReviewIssuerAttestationSha256,
	familyAffinitySha256
} from './family-affinity-production-lib.js';
import {
	resealFamilyAffinitySourceLineageDocuments,
	resealFamilyAffinitySourceLineagesDocuments,
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

	it('reseals canonical lineage for a non-elementals family packet', async () => {
		const goblinsPacketPath =
			'assets/enemies/experiments/family-affinity-v1/families/01-goblins.json';
		const sourceContents = await readFile(path.resolve(goblinsPacketPath), 'utf8');
		const sourceDigest = familyAffinitySha256(JSON.parse(sourceContents));
		const staleDigest = 'e'.repeat(64);
		const document = {
			path: 'assets/enemies/experiments/family-affinity-v1/targets/goblins/fixture/normal/target-v1.json',
			contents: `${JSON.stringify({
				sources: {
					familyPacketPath: goblinsPacketPath,
					familyPacketSha256: staleDigest
				}
			})}\n`
		};
		const unrelatedSource = {
			path: 'assets/enemies/experiments/family-affinity-v1/review/unrelated-source.json',
			contents: '{"value":"unchanged"}\n'
		};
		const unrelatedReference = {
			path: 'assets/enemies/experiments/family-affinity-v1/review/unrelated-reference.json',
			contents: `${JSON.stringify({
				sourcePath: unrelatedSource.path,
				sourceSha256: 'b'.repeat(64)
			})}\n`
		};
		const unrelatedTargetPath =
			'assets/enemies/experiments/family-affinity-v1/targets/deep-ones/deep-one-abyssal-hunter/earth/target-v1.json';
		const unrelatedAssignmentPath =
			'assets/enemies/experiments/family-affinity-v1/assignments/deep-ones/deep-one-abyssal-hunter/earth/assignment-v1.json';
		const unrelatedResultPath =
			'assets/enemies/experiments/family-affinity-v1/results/deep-ones/deep-one-abyssal-hunter/earth-v1.json';
		const unrelatedTarget = {
			path: unrelatedTargetPath,
			contents: (await readFile(path.resolve(unrelatedTargetPath), 'utf8')).replaceAll(
				String.fromCharCode(103, 114, 101, 121),
				'gray'
			)
		};
		const unrelatedAssignment = {
			path: unrelatedAssignmentPath,
			contents: await readFile(path.resolve(unrelatedAssignmentPath), 'utf8')
		};
		const unrelatedResult = {
			path: unrelatedResultPath,
			contents: await readFile(path.resolve(unrelatedResultPath), 'utf8')
		};

		expect(
			resealFamilyAffinitySourceLineageDocuments(
				{ path: goblinsPacketPath, contents: sourceContents },
				[
					document,
					unrelatedSource,
					unrelatedReference,
					unrelatedTarget,
					unrelatedAssignment,
					unrelatedResult
				]
			)
		).toEqual([
			{
				...document,
				contents: document.contents.replace(staleDigest, sourceDigest)
			}
		]);
	});

	it('reseals multiple changed packet lineages in one deterministic pass', async () => {
		const packetPaths = [
			'assets/enemies/experiments/family-affinity-v1/families/01-goblins.json',
			'assets/enemies/experiments/family-affinity-v1/families/02-orcs.json'
		];
		const sources = await Promise.all(
			packetPaths.map(async (packetPath) => ({
				path: packetPath,
				contents: await readFile(path.resolve(packetPath), 'utf8')
			}))
		);
		const staleDigests = ['c'.repeat(64), 'd'.repeat(64)];
		const documents = sources.map((source, index) => ({
			path: `assets/enemies/experiments/family-affinity-v1/targets/fixture-${index}/normal/target-v1.json`,
			contents: `${JSON.stringify({
				sources: {
					familyPacketPath: source.path,
					familyPacketSha256: staleDigests[index]
				}
			})}\n`
		}));

		const changed = resealFamilyAffinitySourceLineagesDocuments(sources, documents);
		expect(changed).toHaveLength(2);
		for (const [index, document] of changed.entries()) {
			expect(JSON.parse(document.contents).sources.familyPacketSha256).toBe(
				familyAffinitySha256(JSON.parse(sources[index]!.contents))
			);
		}
	});

	it('reseals review attestations after a later packet changes the shared manifest', async () => {
		const manifestPath = 'assets/enemies/experiments/family-affinity-v1/manifest.json';
		const goblinPacketPath =
			'assets/enemies/experiments/family-affinity-v1/families/01-goblins.json';
		const orcPacketPath = 'assets/enemies/experiments/family-affinity-v1/families/02-orcs.json';
		const goblinTargetPath =
			'assets/enemies/experiments/family-affinity-v1/targets/goblins/goblin-runt/normal/target-v1.json';
		const goblinAssignmentPath =
			'assets/enemies/experiments/family-affinity-v1/assignments/goblins/goblin-runt/normal/assignment-v1.json';
		const goblinResultPath =
			'assets/enemies/experiments/family-affinity-v1/results/goblins/goblin-runt/normal-v1.json';
		const goblinReviewPath =
			'assets/enemies/experiments/family-affinity-v1/review/assignments/decisions/goblins/goblin-runt/normal/candidate-v1-ordinary-v1-assignment.json';
		const orcTargetPath =
			'assets/enemies/experiments/family-affinity-v1/targets/orcs/orc-berserker/normal/target-v1.json';
		const orcAssignmentPath =
			'assets/enemies/experiments/family-affinity-v1/assignments/orcs/orc-berserker/normal/assignment-v1.json';
		const documentPaths = [
			manifestPath,
			goblinTargetPath,
			goblinAssignmentPath,
			goblinResultPath,
			goblinReviewPath,
			orcTargetPath,
			orcAssignmentPath
		];
		const documents = await Promise.all(
			documentPaths.map(async (repositoryPath) => ({
				path: repositoryPath,
				contents: await readFile(path.resolve(repositoryPath), 'utf8')
			}))
		);
		const sources = await Promise.all(
			[goblinPacketPath, orcPacketPath].map(async (repositoryPath) => {
				const packet = JSON.parse(await readFile(path.resolve(repositoryPath), 'utf8'));
				packet.classificationNotes = `${packet.classificationNotes} Fixture update.`;
				return { path: repositoryPath, contents: `${JSON.stringify(packet)}\n` };
			})
		);

		const changed = resealFamilyAffinitySourceLineagesDocuments(sources, documents);
		const updated = new Map(
			documents.map((document) => [
				document.path,
				changed.find(({ path: changedPath }) => changedPath === document.path) ?? document
			])
		);
		const target = JSON.parse(updated.get(goblinTargetPath)!.contents);
		const assignment = JSON.parse(updated.get(goblinAssignmentPath)!.contents);
		const resultDocument = updated.get(goblinResultPath)!;
		const result = JSON.parse(resultDocument.contents);
		const review = JSON.parse(updated.get(goblinReviewPath)!.contents);

		expect(review.issuerAttestationSha256).toBe(
			familyAffinityReviewIssuerAttestationSha256({
				issuerId: review.issuerId,
				reviewerId: review.reviewerId,
				kind: review.reviewKind,
				manifestPath: review.manifestPath,
				manifestSha256: review.manifestSha256,
				target,
				targetPath: goblinTargetPath,
				productionAssignment: assignment,
				productionAssignmentPath: goblinAssignmentPath,
				result,
				resultSha256: familyAffinityRawSha256(resultDocument.contents),
				decisionVersion: review.decisionVersion,
				permittedReceiptPath: review.permittedReceiptPath
			})
		);
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

	it('selects every active tracked family-affinity JSON lineage', () => {
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
			'assets/enemies/experiments/family-affinity-v1/targets/dragons/drake/normal/target-v1.json',
			'assets/enemies/experiments/family-affinity-v1/targets/elementals/wisp/normal/target-v1.json'
		]);
	});
});
