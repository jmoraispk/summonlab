import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	FamilyAffinityAssignmentSchema,
	FamilyAffinityTargetSchema,
	familyAffinityRawSha256,
	familyAffinitySha256,
	preflightFamilyAffinityProductionDispatch,
	stableFamilyAffinityJson,
	validateFamilyAffinityProductionCompatibility
} from './family-affinity-production-lib.js';

const repositoryRoot = process.cwd();
const skillContractPath = 'skills/summonlab-image-production/references/contract-v3.json';

const pathTemplates = {
	canonicalTarget:
		'assets/enemies/experiments/family-affinity-v1/targets/{familyId}/{formId}/{affinity}/target-v{version}.json',
	canonicalAssignment:
		'assets/enemies/experiments/family-affinity-v1/assignments/{familyId}/{formId}/{affinity}/assignment-v{version}.json',
	canonicalCandidate:
		'assets/enemies/experiments/family-affinity-v1/candidates/{familyId}/{formId}/{affinity}-v{version}.png',
	canonicalResult:
		'assets/enemies/experiments/family-affinity-v1/results/{familyId}/{formId}/{affinity}-v{version}.json',
	bridgeTarget:
		'assets/enemies/experiments/family-affinity-v1/bridge/targets/{currentClassId}/{affinity}/target-v{version}.json',
	bridgeAssignment:
		'assets/enemies/experiments/family-affinity-v1/bridge/assignments/{currentClassId}/{affinity}/assignment-v{version}.json',
	bridgeCandidate:
		'assets/enemies/experiments/family-affinity-v1/bridge/candidates/{currentClassId}/{affinity}-v{version}.png',
	bridgeResult:
		'assets/enemies/experiments/family-affinity-v1/bridge/results/{currentClassId}/{affinity}-v{version}.json'
} as const;

async function loadContractBytes(): Promise<Buffer> {
	return readFile(join(repositoryRoot, skillContractPath));
}

async function validReceipt() {
	const contractBytes = await loadContractBytes();
	const approved = JSON.parse(
		await readFile(
			join(
				repositoryRoot,
				'assets/enemies/experiments/family-affinity-v1/production-compatibility.json'
			),
			'utf8'
		)
	);
	return {
		schemaVersion: 'family-affinity-production-compatibility-v1',
		skillVersion: 'summonlab-image-production-v3',
		profile: 'image-production-family-target-v1',
		targetSchema: 'family-affinity-target-v1',
		assignmentSchema: 'family-affinity-assignment-v1',
		resultSchema: 'family-affinity-result-v1',
		promptMaterialSchema: 'family-affinity-prompt-material-v1',
		sourcePacketSchemas: ['family-packet-v1', 'bridge-identity-packet-v1'],
		experimentId: 'family-affinity-v1',
		affinities: ['normal', 'fire', 'earth', 'wind', 'water'],
		namespaces: ['canonical', 'bridge'],
		pathTemplates,
		ownership: {
			producerRoleAllowlist: ['image-producer'],
			retryCeiling: [0, 1],
			exclusiveCandidateCreate: true,
			immutableSingleCreateResult: true,
			overwriteForbidden: true,
			targetAssignmentCrossHashRequired: true,
			familyPacketHashRequired: true,
			candidateRawHashRequired: true,
			promptMaterialHashRequired: true,
			runtimeMutationForbidden: true
		},
		forbiddenWriteClasses: ['review', 'catalog', 'contact-sheet', 'wiki', 'runtime', 'manifest'],
		skillContractPath,
		skillContractSha256: familyAffinityRawSha256(contractBytes),
		approvedSkillRoot: approved.approvedSkillRoot,
		executionSurface: approved.executionSurface,
		repositoryDispatch: approved.repositoryDispatch,
		sealedLauncher: approved.sealedLauncher,
		bridgeExtension: {
			schemaVersion: 'earth-bridge-production-extension-v1',
			wavePath: 'assets/enemies/experiments/family-affinity-v1/waves/earth-bridge-v1.json',
			reviewedAt: '2026-09-02T12:00:00.000Z',
			approvalReference: 'root-approved-task10-bridge-production-extension-2026-09-02'
		},
		reviewedAt: '2026-09-02T12:00:00.000Z',
		approvalReference: 'user-confirmed-summonlab-image-production-v3-2026-09-02'
	};
}

describe('family affinity production compatibility gate', () => {
	it('accepts only the approved installed v3 contract and exact repository profile', async () => {
		const bytes = await loadContractBytes();
		const receipt = await validReceipt();
		const validated = validateFamilyAffinityProductionCompatibility(receipt, bytes);
		expect(validated.affinities).toEqual(['normal', 'fire', 'earth', 'wind', 'water']);
		expect(validated.profile).toBe('image-production-family-target-v1');
	});

	it.each([
		['absent', undefined],
		['extra', { extra: true }],
		['version', { skillVersion: 'summonlab-image-production-v2' }],
		['profile', { profile: 'family-affinity-target-v1' }],
		['target schema', { targetSchema: 'image-production-family-target-v1' }],
		['approval', { approvalReference: 'not-approved' }],
		['Earth missing', { affinities: ['normal', 'fire', 'wind', 'water'] }],
		['Wood admitted', { affinities: ['normal', 'fire', 'earth', 'wind', 'water', 'wood'] }],
		['affinities reordered', { affinities: ['normal', 'earth', 'fire', 'wind', 'water'] }],
		['retry expansion', { ownership: { retryCeiling: [0, 1, 2] } }]
	])('rejects %s compatibility evidence', async (_label, mutation) => {
		const bytes = await loadContractBytes();
		if (mutation === undefined) {
			expect(() => validateFamilyAffinityProductionCompatibility(mutation, bytes)).toThrow();
			return;
		}
		const receipt = await validReceipt();
		const forged = { ...receipt, ...mutation };
		expect(() => validateFamilyAffinityProductionCompatibility(forged, bytes)).toThrow();
	});

	it.each([
		[
			'nonversioned',
			{ canonicalCandidate: pathTemplates.canonicalCandidate.replace('-v{version}', '') }
		],
		['traversal', { canonicalResult: `${pathTemplates.canonicalResult}/../stolen.json` }],
		['overlap', { bridgeCandidate: pathTemplates.canonicalCandidate }],
		['wrong root', { bridgeTarget: 'assets/enemies/other/{currentClassId}/target-v{version}.json' }]
	])('rejects %s path templates', async (_label, pathMutation) => {
		const bytes = await loadContractBytes();
		const receipt = await validReceipt();
		expect(() =>
			validateFamilyAffinityProductionCompatibility(
				{ ...receipt, pathTemplates: { ...receipt.pathTemplates, ...pathMutation } },
				bytes
			)
		).toThrow();
	});

	it('rejects installed contract and declared source/prompt drift', async () => {
		const bytes = await loadContractBytes();
		const receipt = await validReceipt();
		expect(() =>
			validateFamilyAffinityProductionCompatibility(
				receipt,
				Buffer.concat([bytes, Buffer.from('\n')])
			)
		).toThrow(/contract.*drift|hash/i);
		const contract = JSON.parse(bytes.toString('utf8'));
		contract.profiles['image-production-family-target-v1'].promptMaterialSchema = 'wrong-v1';
		const forgedBytes = Buffer.from(JSON.stringify(contract));
		const forgedReceipt = { ...receipt, skillContractSha256: familyAffinityRawSha256(forgedBytes) };
		expect(() => validateFamilyAffinityProductionCompatibility(forgedReceipt, forgedBytes)).toThrow(
			/prompt|contract/i
		);
	});

	it('rejects repository dispatch entrypoint drift from the sealed skill contract', async () => {
		const bytes = await loadContractBytes();
		const receipt = await validReceipt();
		expect(() =>
			validateFamilyAffinityProductionCompatibility(
				{
					...receipt,
					repositoryDispatch: { ...receipt.repositoryDispatch, sha256: 'a'.repeat(64) }
				},
				bytes
			)
		).toThrow(/profile|dispatch|drift/i);
	});

	it.each([
		[
			'Node runtime',
			(receipt: Awaited<ReturnType<typeof validReceipt>>) => ({
				...receipt.sealedLauncher,
				node: { ...receipt.sealedLauncher.node, sha256: 'a'.repeat(64) }
			})
		],
		[
			'gate bundle',
			(receipt: Awaited<ReturnType<typeof validReceipt>>) => ({
				...receipt.sealedLauncher,
				bundle: { ...receipt.sealedLauncher.bundle, sha256: 'a'.repeat(64) }
			})
		],
		[
			'source surface',
			(receipt: Awaited<ReturnType<typeof validReceipt>>) => ({
				...receipt.sealedLauncher,
				sources: receipt.sealedLauncher.sources.map(
					(source: { path: string; sha256: string }, index: number) =>
						index === 0 ? { ...source, sha256: 'a'.repeat(64) } : source
				)
			})
		]
	])('rejects %s launcher drift from the sealed skill contract', async (_label, mutate) => {
		const bytes = await loadContractBytes();
		const receipt = await validReceipt();
		expect(() =>
			validateFamilyAffinityProductionCompatibility(
				{ ...receipt, sealedLauncher: mutate(receipt) },
				bytes
			)
		).toThrow(/profile|launcher|drift/i);
	});

	it('requires every ownership/hash binding and exact forbidden write classes', async () => {
		const bytes = await loadContractBytes();
		const receipt = await validReceipt();
		for (const key of Object.keys(receipt.ownership)) {
			const ownership = { ...receipt.ownership } as Record<string, unknown>;
			delete ownership[key];
			expect(() =>
				validateFamilyAffinityProductionCompatibility({ ...receipt, ownership }, bytes)
			).toThrow();
		}
		expect(() =>
			validateFamilyAffinityProductionCompatibility(
				{ ...receipt, forbiddenWriteClasses: receipt.forbiddenWriteClasses.slice(0, -1) },
				bytes
			)
		).toThrow();
	});

	it('gates dispatch separately from general manifest validation', async () => {
		const receipt = await validReceipt();
		const bytes = await loadContractBytes();
		const targetPath =
			'assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-bog-troll/normal/target-v1.json';
		const assignmentPath = targetPath
			.replace('/targets/', '/assignments/')
			.replace('target-v1.json', 'assignment-v1.json');
		const target = FamilyAffinityTargetSchema.parse(
			JSON.parse(await readFile(join(repositoryRoot, targetPath), 'utf8'))
		);
		const assignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(await readFile(join(repositoryRoot, assignmentPath), 'utf8'))
		);
		const report = preflightFamilyAffinityProductionDispatch({
			compatibility: receipt,
			installedContractBytes: bytes,
			target,
			assignment,
			targetPath,
			assignmentPath,
			familyPacketBytes: await readFile(join(repositoryRoot, target.sources.familyPacketPath)),
			renderedPromptBytes: Buffer.from(
				stableFamilyAffinityJson({
					schemaVersion: 'family-affinity-prompt-material-v1',
					target,
					assignment
				}).slice(0, -1)
			)
		});
		expect(report.dispatchable).toBe(true);
		expect(report.affinity).toBe('normal');
		expect(() =>
			preflightFamilyAffinityProductionDispatch({
				compatibility: undefined,
				installedContractBytes: bytes,
				target,
				assignment,
				targetPath,
				assignmentPath,
				familyPacketBytes: Buffer.from('{}'),
				renderedPromptBytes: Buffer.from('{}')
			})
		).toThrow(/compatibility/i);
	});

	it('rejects blocked canonical Earth and permits synthetic provisional bridge Earth', async () => {
		const receipt = await validReceipt();
		const bytes = await loadContractBytes();
		const earthPath =
			'assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-bog-troll/earth/target-v1.json';
		const earthAssignmentPath = earthPath
			.replace('/targets/', '/assignments/')
			.replace('target-v1.json', 'assignment-v1.json');
		const earth = JSON.parse(await readFile(join(repositoryRoot, earthPath), 'utf8'));
		const earthAssignment = JSON.parse(
			await readFile(join(repositoryRoot, earthAssignmentPath), 'utf8')
		);
		const familyPacketBytes = await readFile(join(repositoryRoot, earth.sources.familyPacketPath));
		const blockedEarth = FamilyAffinityTargetSchema.parse({
			...earth,
			status: 'blocked-on-anchor',
			anchor: {
				...earth.anchor,
				reviewReceiptSha256: null,
				normalCandidatePath: null,
				normalCandidateSha256: null,
				normalResultPath: null,
				normalResultSha256: null
			}
		});
		const blockedEarthAssignment = FamilyAffinityAssignmentSchema.parse({
			...earthAssignment,
			targetSha256: familyAffinitySha256(blockedEarth),
			dispatchStatus: 'blocked-on-anchor'
		});
		expect(() =>
			preflightFamilyAffinityProductionDispatch({
				compatibility: receipt,
				installedContractBytes: bytes,
				target: blockedEarth,
				assignment: blockedEarthAssignment,
				targetPath: earthPath,
				assignmentPath: earthAssignmentPath,
				familyPacketBytes,
				renderedPromptBytes: Buffer.from('{}')
			})
		).toThrow(/blocked-on-anchor/i);

		const normalCandidateSha256 = 'a'.repeat(64);
		const bridgeTarget = FamilyAffinityTargetSchema.parse({
			...earth,
			namespace: 'bridge',
			canonicalCoordinateId: earth.coordinateId,
			coordinateId: 'goblin-skirmisher/trolls/troll-bog-troll/earth',
			targetId: 'bridge/goblin-skirmisher/trolls/troll-bog-troll/earth/v1',
			currentClassId: 'goblin-skirmisher',
			status: 'earth-bridge-provisional',
			anchor: {
				kind: 'earth-bridge-provisional',
				normalCandidatePath:
					'assets/enemies/experiments/affinity-expansion-v1/candidates/goblin-skirmisher/normal-v1.png',
				normalCandidateSha256
			},
			ownedPaths: {
				candidate:
					'assets/enemies/experiments/family-affinity-v1/bridge/candidates/goblin-skirmisher/earth-v1.png',
				result:
					'assets/enemies/experiments/family-affinity-v1/bridge/results/goblin-skirmisher/earth-v1.json',
				decision:
					'assets/enemies/experiments/family-affinity-v1/review/bridge/decisions/goblin-skirmisher/earth/candidate-v1-review-v1.json',
				blindReview:
					'assets/enemies/experiments/family-affinity-v1/review/bridge/blind/goblin-skirmisher/earth/candidate-v1-blind-v1.json'
			}
		});
		const bridgeTargetPath =
			'assets/enemies/experiments/family-affinity-v1/bridge/targets/goblin-skirmisher/earth/target-v1.json';
		const bridgeAssignmentPath =
			'assets/enemies/experiments/family-affinity-v1/bridge/assignments/goblin-skirmisher/earth/assignment-v1.json';
		let bridgeAssignment = FamilyAffinityAssignmentSchema.parse({
			...earthAssignment,
			assignmentId: `${bridgeTarget.targetId}/assignment`,
			targetId: bridgeTarget.targetId,
			targetSha256: familyAffinitySha256(bridgeTarget),
			coordinateId: bridgeTarget.coordinateId,
			namespace: 'bridge',
			dispatchStatus: 'earth-bridge-provisional',
			allowedOutputs: {
				candidate: bridgeTarget.ownedPaths.candidate,
				result: bridgeTarget.ownedPaths.result
			}
		});
		bridgeAssignment = { ...bridgeAssignment, targetSha256: earthAssignment.targetSha256 };
		// The preflight must reject the forged hash before accepting the valid synthetic bridge.
		expect(() =>
			preflightFamilyAffinityProductionDispatch({
				compatibility: receipt,
				installedContractBytes: bytes,
				target: bridgeTarget,
				assignment: bridgeAssignment,
				targetPath: bridgeTargetPath,
				assignmentPath: bridgeAssignmentPath,
				familyPacketBytes,
				renderedPromptBytes: Buffer.from('{}')
			})
		).toThrow(/hash|cross-bind/i);
		bridgeAssignment = FamilyAffinityAssignmentSchema.parse({
			...bridgeAssignment,
			targetSha256: familyAffinitySha256(bridgeTarget)
		});
		const bridgePromptBytes = Buffer.from(
			stableFamilyAffinityJson({
				schemaVersion: 'family-affinity-prompt-material-v1',
				target: bridgeTarget,
				assignment: bridgeAssignment
			}).slice(0, -1)
		);
		const report = preflightFamilyAffinityProductionDispatch({
			compatibility: receipt,
			installedContractBytes: bytes,
			target: bridgeTarget,
			assignment: bridgeAssignment,
			targetPath: bridgeTargetPath,
			assignmentPath: bridgeAssignmentPath,
			familyPacketBytes,
			renderedPromptBytes: bridgePromptBytes
		});
		expect(report).toMatchObject({
			dispatchable: true,
			affinity: 'earth',
			status: 'earth-bridge-provisional',
			promotionCeiling: 'candidate-only'
		});
	});
});
