import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
	FamilyAffinityAssignmentSchema,
	FamilyAffinityTargetSchema
} from './family-affinity-production-lib.js';

function usage(): never {
	throw new Error(
		'usage: finalize-family-affinity-result.ts TARGET ASSIGNMENT PRODUCER_ID SKILL_ROOT [REPOSITORY_ROOT]'
	);
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export async function finalizeFamilyAffinityResult(input: {
	targetPath: string;
	assignmentPath: string;
	producerId: string;
	skillRoot: string;
	repositoryRoot: string;
}): Promise<string> {
	if (input.producerId.trim().length === 0) throw new Error('producer ID must be nonempty');
	const repositoryRoot = resolve(input.repositoryRoot);
	const targetPath = resolve(repositoryRoot, input.targetPath);
	const assignmentPath = resolve(repositoryRoot, input.assignmentPath);
	const skillRoot = resolve(input.skillRoot);
	const target = FamilyAffinityTargetSchema.parse(JSON.parse(await readFile(targetPath, 'utf8')));
	const assignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(await readFile(assignmentPath, 'utf8'))
	);
	if (
		target.namespace !== 'canonical' ||
		target.targetId !== assignment.targetId ||
		target.coordinateId !== assignment.coordinateId ||
		target.version !== assignment.version ||
		target.ownedPaths.candidate !== assignment.allowedOutputs.candidate ||
		target.ownedPaths.result !== assignment.allowedOutputs.result
	) {
		throw new Error('target and assignment do not bind the same canonical attempt');
	}
	const candidateBytes = await readFile(resolve(repositoryRoot, target.ownedPaths.candidate));
	const exactPrompt = execFileSync(
		'python3',
		[join(skillRoot, 'scripts/render_prompt.py'), targetPath, assignmentPath],
		{ encoding: 'utf8' }
	);
	const result = {
		schemaVersion: 'family-affinity-result-v1',
		targetId: target.targetId,
		targetSha256: assignment.targetSha256,
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		producerId: input.producerId,
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: sha256(candidateBytes),
		resultPath: target.ownedPaths.result,
		sourcePath: target.sources.familyPacketPath,
		sourceSha256: target.sources.familyPacketSha256,
		promptSha256: sha256(Buffer.from(exactPrompt, 'utf8')),
		state: 'candidate-only',
		runtimeCatalogMutationForbidden: true
	} as const;
	const temporaryDirectory = await mkdtemp(join(tmpdir(), 'summonlab-family-result-'));
	const draftPath = join(temporaryDirectory, 'draft.json');
	try {
		await writeFile(draftPath, JSON.stringify(result), { flag: 'wx' });
		const created = execFileSync(
			'python3',
			[
				join(skillRoot, 'scripts/write_family_result.py'),
				targetPath,
				assignmentPath,
				draftPath,
				repositoryRoot
			],
			{ encoding: 'utf8' }
		);
		const verified = execFileSync(
			'python3',
			[
				join(skillRoot, 'scripts/verify_result.py'),
				targetPath,
				assignmentPath,
				resolve(repositoryRoot, target.ownedPaths.result),
				repositoryRoot
			],
			{ encoding: 'utf8' }
		);
		return `${created.trim()}\n${verified.trim()}\n`;
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
}

if (process.argv[1]?.endsWith('finalize-family-affinity-result.ts')) {
	const [targetPath, assignmentPath, producerId, skillRoot, repositoryRoot = process.cwd(), extra] =
		process.argv.slice(2);
	if (!targetPath || !assignmentPath || !producerId || !skillRoot || extra) usage();
	process.stdout.write(
		await finalizeFamilyAffinityResult({
			targetPath,
			assignmentPath,
			producerId,
			skillRoot,
			repositoryRoot
		})
	);
}
