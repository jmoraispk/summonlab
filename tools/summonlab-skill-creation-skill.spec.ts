import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '..');

type CoordinatorDocument = {
	path: string;
	content: string;
};

async function readRepositoryFile(path: string): Promise<string> {
	return readFile(resolve(repositoryRoot, path), 'utf8');
}

function extractSection(documentation: string, heading: string, nextHeading: string): string {
	const start = documentation.indexOf(heading);
	const end = documentation.indexOf(nextHeading, start);

	if (start === -1 || end === -1) {
		throw new Error(`Could not extract ${heading}`);
	}

	return documentation.slice(start, end);
}

function normalizeWhitespace(value: string): string {
	return value.replaceAll(/\s+/g, ' ').trim();
}

function coordinatorDirectives(documentation: string): Array<{ heading: string; text: string }> {
	const directives: Array<{ heading: string; text: string }> = [];
	let heading = '';
	let current = '';

	const flush = () => {
		if (current) {
			directives.push({ heading, text: normalizeWhitespace(current) });
			current = '';
		}
	};

	for (const line of documentation.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) {
			flush();
			continue;
		}
		if (/^#{1,6}\s/.test(trimmed)) {
			flush();
			heading = trimmed;
			continue;
		}
		if (/^(?:[-*]\s+|\d+\.\s+)/.test(trimmed)) {
			flush();
		}
		current = current ? `${current} ${trimmed}` : trimmed;
	}
	flush();

	return directives;
}

function findUnapprovedFramedIndividualInstructions(documents: CoordinatorDocument[]): string[] {
	const positiveFrameVerb =
		/\b(?:attach|include|add|use|supply|provide|giv(?:e|ing)|embed|render|compose|apply|put|place|generate)\b/i;
	const frameContent =
		/\b(?:canonical|approved|rarity)?\s*(?:frame(?:d)?|crest|rank(?:\s+surround)?|border|rail|ornament)s?\b/i;
	const generationContext =
		/\b(?:producer|individual|prompt|imagegen|generation|generation-reference|reference)\b/i;
	const explicitNegativeOrReferenceOnly =
		/\b(?:no|never|not|without|forbid|forbidden|reject|must not|do not|does not|reference-only|common mistakes)\b/i;

	return documents.flatMap(({ path, content }) =>
		coordinatorDirectives(content)
			.filter(({ text }) => {
				return (
					positiveFrameVerb.test(text) &&
					frameContent.test(text) &&
					generationContext.test(text) &&
					!explicitNegativeOrReferenceOnly.test(text)
				);
			})
			.map(({ text }) => `${path}: ${text}`)
	);
}

const canonicalIndividualProduction = normalizeWhitespace(`
3. Generate one frameless artwork layer from content, geometry, family, and immediate-parent
   authorities. The individual producer receives no approved frame as generation content. The
   family sheet may remain a complete framed review reference, never crop content; do not use an
   enlarged crop from it as individual artwork.
4. The coordinator centers the accepted provider artwork at artworkScale: 0.9, producing 922x922
   pixels at (51,51) on the 1024x1024 canvas. It assembles layers strictly back-to-front as
   \`backing → skill-art → rarity-frame\`; \`rarityFrameIsFinal === true\`. It extracts the aperture
   interior, adds canonical backing, and applies the canonical rarity frame with
   compositionProfile: 'frame-opening-v3'. A different scale requires new explicit owner-reviewed
   authority; never guess it per target. Here, accepted provider artwork means the
   coordinator-selected exact provider source, not owner approval or promotion.
5. Fail closed before composition acceptance unless every literal outcome holds:
   \`apertureCoverage.complete === true\`; no baked frame traces; \`exteriorTransparent === true\`;
   \`backingOnlyComponents.length === 0\`; \`layerHashesMatch === true\`; \`exactComposite === true\`;
   \`protectedBandMatches === true\`; and \`rarityFrameIsFinal === true\`. Preserve source, layer,
   candidate, result, hashes, and inspection evidence for the provider artwork and deterministic
   assembly.
`);

describe('summonlab skill-icon producer and coordinator workflow', () => {
	it('keeps the producer frameless and makes its coordinator handoff explicit', async () => {
		const producerSkill = await readRepositoryFile(
			'skills/summonlab-skill-icon-production/SKILL.md'
		);
		const producerRubric = await readRepositoryFile(
			'skills/summonlab-skill-icon-production/references/review-rubric.md'
		);
		const handoff = extractSection(
			producerSkill,
			'## Coordinator-owned `skill-art` handoff',
			'## Hard boundaries'
		);
		const normalizedHandoff = normalizeWhitespace(handoff);

		for (const boundary of [
			'Never resize, position, mask, add backing to, or apply a rarity frame to `skill-art`',
			'Never create a composite',
			'Never invoke `promote:skill-icon-output`'
		]) {
			expect(producerSkill).toContain(boundary);
		}

		for (const term of [
			'frameless artwork layer',
			'artworkScale: 0.9',
			'922x922',
			'(51,51)',
			"compositionProfile: 'frame-opening-v3'",
			'backing → skill-art → rarity-frame',
			'rarityFrameIsFinal === true',
			'apertureCoverage.complete === true',
			'no baked frame traces',
			'exteriorTransparent === true',
			'backingOnlyComponents.length === 0',
			'layerHashesMatch === true',
			'exactComposite === true',
			'protectedBandMatches === true',
			'coordinator-owned handoff constraints only',
			'does not authorize producer execution'
		]) {
			expect(normalizedHandoff).toContain(term);
		}

		expect(producerRubric).toContain('do not resize, mask, composite, or promote it');
	});

	it('keeps deterministic assembly and fail-closed gates in the coordinator workflow', async () => {
		const creationSkill = await readRepositoryFile('skills/summonlab-skill-creation/SKILL.md');
		const individualWorkflow = await readRepositoryFile(
			'skills/summonlab-skill-creation/references/repository-workflow.md'
		);
		const individualProduction = extractSection(
			individualWorkflow,
			'3. Generate one frameless artwork layer',
			'\n\nUse `summonlab-skill-icon-production`'
		);
		const normalizedIndividualProduction = normalizeWhitespace(individualProduction);

		expect(creationSkill).toContain('coordinator owns its deterministic resize, masking, backing');
		for (const term of [
			'Generate one frameless artwork layer from content, geometry, family, and immediate-parent authorities',
			'The individual producer receives no approved frame as generation content',
			'complete framed review reference, never crop content',
			'artworkScale: 0.9',
			'922x922',
			'(51,51)',
			"compositionProfile: 'frame-opening-v3'",
			'backing → skill-art → rarity-frame',
			'rarityFrameIsFinal === true',
			'apertureCoverage.complete === true',
			'no baked frame traces',
			'exteriorTransparent === true',
			'backingOnlyComponents.length === 0',
			'layerHashesMatch === true',
			'exactComposite === true',
			'protectedBandMatches === true'
		]) {
			expect(normalizedIndividualProduction).toContain(term);
		}
	});

	it('locks the extracted individual-production block against framed prompt instructions', async () => {
		const individualWorkflow = await readRepositoryFile(
			'skills/summonlab-skill-creation/references/repository-workflow.md'
		);
		const individualProduction = extractSection(
			individualWorkflow,
			'3. Generate one frameless artwork layer',
			'\n\nUse `summonlab-skill-icon-production`'
		);

		expect(normalizeWhitespace(individualProduction)).toBe(canonicalIndividualProduction);

		for (const paraphrase of [
			'Attach a canonical frame in the individual prompt.',
			'Include a canonical frame in the individual generation.',
			'Add a canonical frame to the individual reference.',
			'Pass a canonical frame to the individual prompt.',
			'Use a canonical frame for the individual generation.'
		]) {
			expect(normalizeWhitespace(`${individualProduction}\n${paraphrase}`)).not.toBe(
				canonicalIndividualProduction
			);
		}

		expect(individualWorkflow).toContain('complete framed review reference');
	});

	it('rejects positive frame directives anywhere in coordinator-facing instructions', async () => {
		const coordinatorDocuments = [
			{
				path: 'skills/summonlab-skill-creation/SKILL.md',
				content: await readRepositoryFile('skills/summonlab-skill-creation/SKILL.md')
			},
			{
				path: 'skills/summonlab-skill-creation/references/repository-workflow.md',
				content: await readRepositoryFile(
					'skills/summonlab-skill-creation/references/repository-workflow.md'
				)
			}
		];

		expect(findUnapprovedFramedIndividualInstructions(coordinatorDocuments)).toEqual([]);

		for (const directive of [
			'Attach a canonical frame in the individual prompt.',
			'Include a canonical crest in the individual generation.',
			'Add a canonical rank surround to the individual reference.',
			'Use a canonical border in the individual prompt.',
			'Supply a canonical rail in the individual generation.',
			'Provide a canonical ornament to the individual reference.',
			'Give a canonical frame in the individual prompt.',
			'Embed a canonical crest in the individual generation.',
			'Render a canonical rank surround in the individual reference.',
			'Compose a canonical border in the individual prompt.',
			'Apply a canonical rail in the individual generation.',
			'Put a canonical ornament in the individual reference.',
			'Place a canonical frame in the individual prompt.'
		]) {
			for (const document of coordinatorDocuments) {
				const mutatedDocuments = coordinatorDocuments.map((candidate) =>
					candidate.path === document.path
						? { ...candidate, content: `${candidate.content}\n\n${directive}` }
						: candidate
				);

				expect(findUnapprovedFramedIndividualInstructions(mutatedDocuments)).toContain(
					`${document.path}: ${directive}`
				);
			}
		}
	});
});
