import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildEquipmentVisualProfile } from './equipment-image-profile.js';
import {
	buildEquipmentMaterialAllocationPlan,
	buildEquipmentMaterialProductionManifest
} from './equipment-material-production-lib.js';
import {
	buildEquipmentProfileAcceptance,
	buildRootEquipmentPackets,
	canonicalJsonSha256,
	materializeRootEquipmentPackets,
	renderEquipmentPrompt,
	validateEquipmentPacket
} from './equipment-image-packets.js';
import { runEquipmentImageProductionCli } from './equipment-image-production.js';

const ROOT = 'assets/equipment/experiments/material-equipment-v1';
const PROFILE_PATH = `${ROOT}/visual-profile/profile.json`;
const ACCEPTED_AT = '2026-09-01T23:00:00.000Z';
const ASSIGNED_AT = '2026-09-01T23:05:00.000Z';
const EXPECTED_PROFILE_SHA256 = 'f773bdaab246314d53a596c11404a9e242826838926ecb8121948b375c267d5a';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

function fixture() {
	const manifest = buildEquipmentMaterialProductionManifest();
	const allocation = buildEquipmentMaterialAllocationPlan();
	const profile = buildEquipmentVisualProfile();
	const acceptance = buildEquipmentProfileAcceptance({
		profile,
		profilePath: PROFILE_PATH,
		reviewer: 'owner',
		acceptedAt: ACCEPTED_AT,
		acknowledgedProfileSha256: EXPECTED_PROFILE_SHA256
	});
	return { manifest, allocation, profile, acceptance };
}

describe('Equipment profile acceptance and root packets', () => {
	it('requires the owner-acknowledged canonical profile hash', () => {
		const profile = buildEquipmentVisualProfile();
		expect(canonicalJsonSha256(profile)).toBe(EXPECTED_PROFILE_SHA256);
		const acceptance = buildEquipmentProfileAcceptance({
			profile,
			profilePath: PROFILE_PATH,
			reviewer: 'owner',
			acceptedAt: ACCEPTED_AT,
			acknowledgedProfileSha256: canonicalJsonSha256(profile)
		});

		expect(acceptance).toEqual({
			schemaVersion: 'equipment-visual-profile-acceptance-v1',
			acceptanceId: 'equipment-material-visual-profile-v1-acceptance',
			profileId: 'equipment-material-visual-profile-v1',
			profilePath: PROFILE_PATH,
			profileCanonicalSha256: EXPECTED_PROFILE_SHA256,
			decision: 'accepted',
			reviewer: 'owner',
			acceptedAt: ACCEPTED_AT
		});
		expect(() =>
			buildEquipmentProfileAcceptance({
				profile,
				profilePath: PROFILE_PATH,
				reviewer: 'owner',
				acceptedAt: ACCEPTED_AT,
				acknowledgedProfileSha256: '0'.repeat(64)
			})
		).toThrow('acknowledged profile hash');
	});

	it('builds exactly the 77 manifest-derived root packet pairs', () => {
		const { manifest, allocation, profile, acceptance } = fixture();
		const packets = buildRootEquipmentPackets({
			manifest,
			allocation,
			profile,
			acceptance,
			assignedAt: ASSIGNED_AT
		});

		expect(packets).toHaveLength(77);
		expect(packets.every(({ target }) => target.consistencySource === null)).toBe(true);
		expect(
			new Set(
				packets.flatMap(({ target }) => [target.output.candidatePath, target.output.resultPath])
			).size
		).toBe(154);
		expect(packets[0]).toMatchObject({
			targetPath: `${ROOT}/targets/f/copper/sword-v1.json`,
			assignmentPath: `${ROOT}/assignments/f/copper/sword-v1.json`,
			target: {
				targetId: 'material-equipment-v1-copper-sword-v1',
				material: {
					id: 'copper',
					name: 'Copper',
					family: 'metal',
					rank: 'F',
					craftsmanship: 'Standard'
				},
				equipment: { class: 'sword', artifactRole: 'item', slot: null },
				output: {
					candidatePath: `${ROOT}/candidates/f/copper/sword-v1.png`,
					resultPath: `${ROOT}/results/f/copper/sword-v1.json`
				}
			},
			assignment: {
				assignmentId: 'assignment-material-equipment-v1-copper-sword-v1',
				targetId: 'material-equipment-v1-copper-sword-v1',
				assignedAt: ASSIGNED_AT,
				retryCeiling: 0,
				forbiddenSharedPaths: [
					`${ROOT}/manifest.json`,
					`${ROOT}/allocation-plan.json`,
					`${ROOT}/visual-profile`,
					`${ROOT}/reviews`,
					`${ROOT}/runs`,
					'assets/enemies',
					'packages/contracts/src/image-production.ts',
					'tools/persist-image-production-output.ts',
					'skills/summonlab-image-production'
				]
			}
		});
		expect(() =>
			buildRootEquipmentPackets({
				manifest,
				allocation,
				profile,
				acceptance: { ...acceptance, profileCanonicalSha256: '0'.repeat(64) },
				assignedAt: ASSIGNED_AT
			})
		).toThrow('acceptance');

		const changedManifest = {
			...manifest,
			targets: manifest.targets.map((target, index) =>
				index === 0 ? { ...target, materialName: 'Forged Copper' } : target
			)
		};
		const changedAllocation = {
			...allocation,
			sourceManifest: {
				...allocation.sourceManifest,
				canonicalSha256: canonicalJsonSha256(changedManifest)
			}
		};
		expect(() =>
			buildRootEquipmentPackets({
				manifest: changedManifest,
				allocation: changedAllocation,
				profile,
				acceptance,
				assignedAt: ASSIGNED_AT
			})
		).toThrow('deterministic manifest');
	});

	it('renders stable isolated-item and complete-set prompt branches without a final newline', () => {
		const packets = buildRootEquipmentPackets({ ...fixture(), assignedAt: ASSIGNED_AT });
		const isolatedPrompt = renderEquipmentPrompt(packets[0]!.target);
		const fullSetTarget = packets.find(
			({ target }) => target.presentation.mode === 'complete-armour-set'
		)!.target;
		const fullSetPrompt = renderEquipmentPrompt(fullSetTarget);

		expect(isolatedPrompt).toMatchInlineSnapshot(`
"Equipment image production prompt v1
Target: material-equipment-v1-copper-sword-v1
Create one practical hand-and-a-half straight sword as one-complete-object-or-required-pair in a neutral three-quarter view with the complete object or required pair entirely inside the safe margin.
Material: Copper (metal, rank F), Standard craftsmanship (+0). The material supplies the only visible rank.
Style: premium realistic painterly dark fantasy. grounded medieval construction with structurally plausible joins, fastenings, grips, and weight. honest surface wear and material response with narrow controlled highlights and restrained local magic. Material identity uses one or two physical construction cues; palette alone never satisfies the material criterion; where the material calls for it, use one bounded supernatural behavior. Secondary materials stay neutral and subordinate and never assert a second rank. cold key light with a restrained warm rim. midnight-charcoal presentation ground with a restrained floor plane.
Canvas: 1024x1024 image/png; keep the whole subject inside an 8% safe margin.
Reference use (ordered): assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png [9c726ad578a6a6d8ed510a7e7117443ce471e553d233b36a8c20afedddd1040d] — Use only for painterly finish, honest wear, material response, cold key with restrained warm rim, floor, and midnight-charcoal background. Do not transfer Remy, her body, clothing, hammer, or design.
Required checks: complete canvas and safe framing; expected object or component count; equipment-class silhouette; structural plausibility; rank-bearing material dominance; material-cue strength; bounded rank behavior; profile style cohesion; negative-constraint safety.
Forbid: no-subject-transfer, no-published-character-resemblance, no-rarity-rainbow, no-gold-inflation, no-full-object-glow, no-oversized-silhouettes, no-ornament-as-material-identity, no-extra-gear, no-text, no-labels, no-ui, no-borders, no-frames, no-logos, no-watermarks.
Output exactly one candidate image and do not add text, labels, UI, borders, frames, logos, or watermarks."
`);
		expect(fullSetPrompt).toMatchInlineSnapshot(`
"Equipment image production prompt v1
Target: material-equipment-v1-copper-heavy-armour-full-set-v1
Create one metal-dominant articulated protection complete Armour set on a featureless-charcoal-display-form. Full body visible with exactly Head, Torso, Legs, and Boots readable together inside the safe margin.
Material: Copper (metal, rank F), Standard craftsmanship (+0). The material supplies the only visible rank.
Style: premium realistic painterly dark fantasy. grounded medieval construction with structurally plausible joins, fastenings, grips, and weight. honest surface wear and material response with narrow controlled highlights and restrained local magic. Material identity uses one or two physical construction cues; palette alone never satisfies the material criterion; where the material calls for it, use one bounded supernatural behavior. Secondary materials stay neutral and subordinate and never assert a second rank. cold key light with a restrained warm rim. midnight-charcoal presentation ground with a restrained floor plane.
Canvas: 1024x1536 image/png; keep the whole subject inside an 8% safe margin.
Reference use (ordered): assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png [9c726ad578a6a6d8ed510a7e7117443ce471e553d233b36a8c20afedddd1040d] — Use only for painterly finish, honest wear, material response, cold key with restrained warm rim, floor, and midnight-charcoal background. Do not transfer Remy, her body, clothing, hammer, or design.
Required checks: complete canvas and safe framing; expected object or component count; equipment-class silhouette; structural plausibility; rank-bearing material dominance; material-cue strength; bounded rank behavior; profile style cohesion; negative-constraint safety.
Forbid: no-subject-transfer, no-published-character-resemblance, no-rarity-rainbow, no-gold-inflation, no-full-object-glow, no-oversized-silhouettes, no-ornament-as-material-identity, no-extra-gear, no-text, no-labels, no-ui, no-borders, no-frames, no-logos, no-watermarks.
Output exactly one candidate image and do not add text, labels, UI, borders, frames, logos, or watermarks."
`);
		expect(isolatedPrompt.endsWith('\n')).toBe(false);
		expect(fullSetPrompt.endsWith('\n')).toBe(false);
	});

	it('validates strict packet bindings, ordered reference bytes, hashes, and empty outputs', async () => {
		const { manifest, allocation, profile, acceptance } = fixture();
		const packet = buildRootEquipmentPackets({
			manifest,
			allocation,
			profile,
			acceptance,
			assignedAt: ASSIGNED_AT
		})[0]!;

		await expect(
			validateEquipmentPacket({
				workspaceRoot: process.cwd(),
				manifest,
				allocation,
				profile,
				acceptance,
				target: packet.target,
				assignment: packet.assignment
			})
		).resolves.toEqual({
			ownedPaths: [packet.target.output.candidatePath, packet.target.output.resultPath],
			promptSha256: createHash('sha256').update(renderEquipmentPrompt(packet.target)).digest('hex')
		});

		await expect(
			validateEquipmentPacket({
				workspaceRoot: process.cwd(),
				manifest,
				allocation,
				profile,
				acceptance,
				target: packet.target,
				assignment: {
					...packet.assignment,
					targetId: 'material-equipment-v1-copper-dagger-v1'
				}
			})
		).rejects.toThrow('target ID');
		await expect(
			validateEquipmentPacket({
				workspaceRoot: process.cwd(),
				manifest,
				allocation,
				profile,
				acceptance,
				target: packet.target,
				assignment: { ...packet.assignment, assignedAt: '2026-09-01T23:05:01.000Z' }
			})
		).rejects.toThrow('deterministic root packet');
	});

	it('exclusively creates 77 targets and 77 assignments while check mode writes nothing', async () => {
		const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-root-packets-'));
		temporaryDirectories.push(workspaceRoot);
		const input = { ...fixture(), assignedAt: ASSIGNED_AT, workspaceRoot };

		await expect(materializeRootEquipmentPackets(input)).resolves.toMatchObject({
			mode: 'write',
			targetCount: 77,
			assignmentCount: 77,
			writesPerformed: 154
		});
		const targetsRoot = path.join(workspaceRoot, ROOT, 'targets');
		const assignmentsRoot = path.join(workspaceRoot, ROOT, 'assignments');
		const countJsonFiles = async (directory: string): Promise<number> => {
			const entries = await readdir(directory, { withFileTypes: true });
			const counts = await Promise.all(
				entries.map((entry) =>
					entry.isDirectory()
						? countJsonFiles(path.join(directory, entry.name))
						: Promise.resolve(entry.name.endsWith('.json') ? 1 : 0)
				)
			);
			return counts.reduce((total, count) => total + count, 0);
		};
		expect(await countJsonFiles(targetsRoot)).toBe(77);
		expect(await countJsonFiles(assignmentsRoot)).toBe(77);
		await expect(materializeRootEquipmentPackets(input)).rejects.toThrow('collision');

		const firstPath = path.join(workspaceRoot, ROOT, 'targets/f/copper/sword-v1.json');
		const before = await stat(firstPath);
		const beforeBytes = await readFile(firstPath, 'utf8');
		await expect(materializeRootEquipmentPackets({ ...input, check: true })).resolves.toMatchObject(
			{
				mode: 'check',
				targetCount: 77,
				assignmentCount: 77,
				writesPerformed: 0
			}
		);
		const after = await stat(firstPath);
		expect(await readFile(firstPath, 'utf8')).toBe(beforeBytes);
		expect(after.mtimeMs).toBe(before.mtimeMs);
	});

	it('requires a literal valid acknowledged digest before exclusively recording acceptance', async () => {
		const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-profile-acceptance-'));
		temporaryDirectories.push(workspaceRoot);
		const profile = buildEquipmentVisualProfile();
		const profileAbsolute = path.join(workspaceRoot, PROFILE_PATH);
		await mkdir(path.dirname(profileAbsolute), { recursive: true });
		await writeFile(profileAbsolute, `${JSON.stringify(profile, null, '\t')}\n`, 'utf8');

		await expect(
			runEquipmentImageProductionCli({
				args: ['accept-profile', '--reviewer', 'owner'],
				workspaceRoot
			})
		).rejects.toThrow('--acknowledge-profile-sha256');
		await expect(
			runEquipmentImageProductionCli({
				args: [
					'accept-profile',
					'--reviewer',
					'owner',
					'--acknowledge-profile-sha256',
					'not-a-digest'
				],
				workspaceRoot
			})
		).rejects.toThrow('64 lowercase hexadecimal');
		await expect(
			runEquipmentImageProductionCli({
				args: [
					'accept-profile',
					'--reviewer',
					'owner',
					'--acknowledge-profile-sha256',
					EXPECTED_PROFILE_SHA256
				],
				workspaceRoot
			})
		).resolves.toMatchObject({ command: 'accept-profile', writesPerformed: 1 });
		const acceptance = JSON.parse(
			await readFile(path.join(workspaceRoot, ROOT, 'visual-profile/acceptance.json'), 'utf8')
		) as { profileCanonicalSha256: string };
		expect(acceptance.profileCanonicalSha256).toBe(EXPECTED_PROFILE_SHA256);
		await expect(
			runEquipmentImageProductionCli({
				args: [
					'accept-profile',
					'--reviewer',
					'owner',
					'--acknowledge-profile-sha256',
					EXPECTED_PROFILE_SHA256
				],
				workspaceRoot
			})
		).rejects.toThrow('collision');
	});
});
