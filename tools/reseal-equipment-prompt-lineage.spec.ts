import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { deriveRetiredForms } from './american-english-policy.js';
import {
	resealEquipmentPromptLineageDocuments,
	selectEquipmentPromptLineagePaths
} from './reseal-equipment-prompt-lineage.js';

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

describe('equipment prompt lineage resealing', () => {
	it('recomputes a projected prompt digest and propagates it to dependent records', () => {
		const retired = deriveRetiredForms('armor')[0]!;
		const previousPrompt = `Render one ${retired} set.`;
		const projectedPrompt = 'Render one armor set.';
		const previousDigest = sha256(previousPrompt);
		const projectedDigest = sha256(projectedPrompt);
		const documents = [
			{
				path: 'assets/equipment/experiments/material-equipment-v3/assignments/f/fixture.json',
				contents: `${JSON.stringify({ prompt: projectedPrompt, promptSha256: previousDigest }, null, '\t')}\n`
			},
			{
				path: 'assets/equipment/experiments/material-equipment-v3/results/f/fixture.json',
				contents: `${JSON.stringify({ resultId: 'fixture', promptSha256: previousDigest }, null, '\t')}\n`
			}
		];

		expect(resealEquipmentPromptLineageDocuments(documents)).toEqual(
			documents.map((document) => ({
				...document,
				contents: document.contents.replace(previousDigest, projectedDigest)
			}))
		);
	});

	it('preserves exact bytes when every prompt binding is already valid', () => {
		const prompt = 'Render one equipment set.';
		const contents = ` {"prompt":"${prompt}","promptSha256":"${sha256(prompt)}"} `;
		expect(
			resealEquipmentPromptLineageDocuments([{ path: 'fixture.assignment.json', contents }])
		).toEqual([]);
	});

	it('rejects an ambiguous stale digest instead of choosing a replacement', () => {
		const stale = 'a'.repeat(64);
		const documents = ['first', 'second'].map((name) => ({
			path: `${name}.assignment.json`,
			contents: `${JSON.stringify({ prompt: name, promptSha256: stale })}\n`
		}));
		expect(() => resealEquipmentPromptLineageDocuments(documents)).toThrow(/ambiguous/iu);
	});

	it('selects only v3 assignment and result lineage records', () => {
		expect(
			selectEquipmentPromptLineagePaths([
				'assets/equipment/experiments/material-equipment-v3/assignments/f/item.json',
				'assets/equipment/experiments/material-equipment-v3/results/f/item.json',
				'assets/equipment/experiments/material-equipment-v3/revisions/item/attempt-2/assignment.json',
				'assets/equipment/experiments/material-equipment-v3/direction/class-progressions/item.result.json',
				'assets/equipment/experiments/material-equipment-v3/schemas/assignment.schema.json',
				'assets/equipment/experiments/material-equipment-v2/assignment.json'
			])
		).toEqual([
			'assets/equipment/experiments/material-equipment-v3/assignments/f/item.json',
			'assets/equipment/experiments/material-equipment-v3/direction/class-progressions/item.result.json',
			'assets/equipment/experiments/material-equipment-v3/results/f/item.json',
			'assets/equipment/experiments/material-equipment-v3/revisions/item/attempt-2/assignment.json'
		]);
	});
});
