import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSkillIconInnerFrameRegenerationJobs } from './skill-icon-inner-frame-regeneration.js';

const FRAMELESS_CLAUSE =
	'Artwork layer only: no rarity frame, rank crest, rank letter, border rails, backing, UI, label, logo, watermark, or text.';

describe('inner-frame regeneration jobs', () => {
	it('binds exactly the 23 owner-approved clear failures to frameless prompts', async () => {
		const jobs = await buildSkillIconInnerFrameRegenerationJobs(process.cwd());

		expect(jobs).toHaveLength(23);
		expect(new Set(jobs.map((job) => job.targetId)).size).toBe(23);
		expect(jobs.flatMap((job) => job.sourceAttempts)).toHaveLength(27);
		expect(jobs.map((job) => job.targetId)).not.toContain('martial:blade:one-blade-one-world');
		for (const job of jobs) {
			expect(job.exactPrompt.split(FRAMELESS_CLAUSE)).toHaveLength(2);
			expect(job.exactPrompt.endsWith(FRAMELESS_CLAUSE)).toBe(true);
			const expectedReferenceSlug =
				job.targetId === 'martial:body:called-shot' ? 'martial-body-sidestep' : job.slug;
			expect(job.referencePath).toBe(
				path.join(
					'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites',
					`${expectedReferenceSlug}.png`
				)
			);
			expect(job.currentPath).toBe(
				path.join(
					'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites',
					`${job.slug}.png`
				)
			);
			expect(job.currentHash).toMatch(/^[a-f0-9]{64}$/u);
			const sourceRevision = new Set([
				'craft-knowledge-languages',
				'craft-knowledge-research',
				'magical-enchantment-component-craft',
				'martial-polearm-rend-armor'
			]).has(job.slug)
				? 'v2'
				: 'v1';
			expect(job.sourceAttempts).toHaveLength(sourceRevision === 'v2' ? 2 : 1);
			expect(job.sourceAttempts.filter((attempt) => attempt.status === 'accepted')).toEqual([
				expect.objectContaining({ path: job.outputPath })
			]);
			expect(job.sourceAttempts.at(0)?.prompt).toBe(job.exactPrompt);
			if (sourceRevision === 'v2') {
				expect(job.sourceAttempts.at(0)?.status).toBe('rejected');
				expect(job.sourceAttempts.at(0)?.reason).toBe('faux-text-or-ui-artifact');
				expect(job.sourceAttempts.at(1)?.prompt).toContain('Targeted correction edit only.');
			}
			expect(job.outputPath).toBe(
				path.join(
					'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources',
					`${job.slug}-${sourceRevision}-frameless-source.png`
				)
			);
		}
		const calledShot = jobs.find((job) => job.targetId === 'martial:body:called-shot');
		expect(calledShot?.exactPrompt).toContain('precision targeting pose');
		expect(calledShot?.exactPrompt).toContain('style and figure-treatment reference');
		expect(calledShot?.exactPrompt).not.toContain('specific body part');
	});
});
