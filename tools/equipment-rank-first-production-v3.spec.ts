import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
	EquipmentCandidateAssignmentV3Schema,
	EquipmentCandidateTargetV3Schema,
	EquipmentArmourSourceChecksV3Schema,
	EquipmentDirectionAssignmentV3Schema,
	EquipmentDirectionTargetV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_ARMOUR_SLOTS,
	EQUIPMENT_CLASSES,
	EQUIPMENT_CLASS_DIRECTIONS_V3,
	EQUIPMENT_MATERIAL_BRIEFS_V3,
	EQUIPMENT_RANKS,
	EQUIPMENT_V3_ALLOCATION_PATH,
	EQUIPMENT_V3_MANIFEST_PATH,
	EQUIPMENT_V3_ROOT,
	assertEquipmentV3Invariants,
	buildEquipmentCandidateAssignmentV3,
	buildEquipmentCandidateTargetsV3,
	buildEquipmentDirectionPacketsV3,
	buildEquipmentV3AllocationPlan,
	buildEquipmentV3Manifest,
	serializeJson
} from './equipment-rank-first-production-v3.js';

describe('Equipment rank-first production v3', () => {
	it('reserves the complete 28-material, 11-class, 161-candidate matrix', () => {
		assertEquipmentV3Invariants();
		const manifest = buildEquipmentV3Manifest();
		expect(manifest.summary).toEqual({
			materialBriefCount: 28,
			classDirectionCount: 11,
			acceptedDirectionCount: 7,
			pendingDirectionCount: 4,
			targetCount: 161,
			rootCount: 77,
			armourPieceCount: 84,
			armourSetCount: 21
		});
		expect(EQUIPMENT_MATERIAL_BRIEFS_V3).toHaveLength(28);
		expect(EQUIPMENT_CLASS_DIRECTIONS_V3).toHaveLength(11);
		expect(manifest.targets).toHaveLength(161);
		expect(
			manifest.targets.filter(({ dependsOnTargetId }) => dependsOnTargetId === null)
		).toHaveLength(77);
		expect(
			manifest.targets.filter(({ artifactRole }) => artifactRole === 'armour-piece')
		).toHaveLength(84);
	});

	it('has seven ordered root ranks per class and exactly four ordered children per Armour source', () => {
		const targets = buildEquipmentCandidateTargetsV3();
		for (const classId of EQUIPMENT_CLASSES) {
			expect(
				targets
					.filter((target) => target.classId === classId && target.dependsOnTargetId === null)
					.map(({ rank }) => rank)
			).toEqual(EQUIPMENT_RANKS);
		}
		const sources = targets.filter(({ artifactRole }) => artifactRole === 'set-source');
		expect(sources).toHaveLength(21);
		for (const source of sources) {
			expect(
				targets
					.filter(({ dependsOnTargetId }) => dependsOnTargetId === source.targetId)
					.map(({ slot }) => slot)
			).toEqual(EQUIPMENT_ARMOUR_SLOTS);
		}
	});

	it('keeps every owned path unique, v3-local, and outside approval/runtime namespaces', () => {
		const targets = buildEquipmentCandidateTargetsV3();
		const paths = targets.flatMap(({ output }) => Object.values(output));
		expect(new Set(paths).size).toBe(161 * 6);
		expect(paths.every((value) => value.startsWith(`${EQUIPMENT_V3_ROOT}/`))).toBe(true);
		expect(
			paths.every((value) => !/material-equipment-v[12]|\/approved\/|\/runtime\//u.test(value))
		).toBe(true);
	});

	it('binds all seven accepted direction references to their checked-in hashes', () => {
		for (const direction of EQUIPMENT_CLASS_DIRECTIONS_V3.filter(
			({ status }) => status === 'owner-accepted'
		)) {
			const actual = createHash('sha256').update(readFileSync(direction.imagePath)).digest('hex');
			expect(actual).toBe(direction.sha256);
		}
		expect(
			EQUIPMENT_CLASS_DIRECTIONS_V3.filter(({ status }) => status === 'generation-required').map(
				({ classId }) => classId
			)
		).toEqual(['bow', 'staff', 'light-armour', 'robes']);
	});

	it('materializes four valid immutable direction packets without generating images', () => {
		const packets = buildEquipmentDirectionPacketsV3();
		expect(packets).toHaveLength(4);
		for (const packet of packets) {
			EquipmentDirectionTargetV3Schema.parse({
				schemaVersion: 'equipment-class-direction-target-v3',
				directionId: packet.directionId,
				classId: packet.classId,
				width: 1536,
				height: 1024,
				mediaType: 'image/png',
				orderedRanks: EQUIPMENT_RANKS,
				candidatePath: packet.candidatePath,
				resultPath: packet.resultPath
			});
			EquipmentDirectionAssignmentV3Schema.parse({
				schemaVersion: 'equipment-class-direction-assignment-v3',
				assignmentId: `assignment-${packet.directionId}`,
				directionId: packet.directionId,
				immutable: true,
				prompt: packet.prompt,
				promptSha256: packet.promptSha256,
				references: packet.references,
				permittedOutputs: { candidatePath: packet.candidatePath, resultPath: packet.resultPath },
				selfPromotionForbidden: true
			});
			expect(packet.prompt).toContain('exactly seven');
			expect(packet.prompt).toContain('F, E, D, C, B, A, S');
		}
	});

	it('gates piece assignments on an exact accepted full-set reference', () => {
		const [root] = buildEquipmentCandidateTargetsV3();
		const piece = buildEquipmentCandidateTargetsV3().find(
			({ artifactRole }) => artifactRole === 'armour-piece'
		)!;
		const direction = {
			path: 'assets/equipment/reference.png',
			sha256: '1'.repeat(64),
			purpose: 'accepted class direction'
		};
		expect(() =>
			buildEquipmentCandidateAssignmentV3({ target: piece, classDirection: direction })
		).toThrow(/requires accepted full-set/u);
		const rootAssignment = buildEquipmentCandidateAssignmentV3({
			target: root!,
			classDirection: direction
		});
		expect(EquipmentCandidateAssignmentV3Schema.parse(rootAssignment)).toEqual(rootAssignment);
		const pieceAssignment = buildEquipmentCandidateAssignmentV3({
			target: piece,
			classDirection: direction,
			consistencySource: {
				path: piece.output.candidatePath,
				sha256: '2'.repeat(64),
				purpose: 'accepted full-set source'
			}
		});
		expect(EquipmentCandidateAssignmentV3Schema.parse(pieceAssignment)).toEqual(pieceAssignment);
	});

	it('records producer checks for the exact 21 empty four-slot Armour sources', () => {
		const checks = EquipmentArmourSourceChecksV3Schema.parse(
			JSON.parse(
				readFileSync(
					`${EQUIPMENT_V3_ROOT}/reviews/armour-source-checks-v1.json`,
					'utf8'
				)
			)
		);
		const sourceIds = buildEquipmentCandidateTargetsV3()
			.filter(({ artifactRole }) => artifactRole === 'set-source')
			.map(({ targetId }) => targetId);
		expect(checks.checks.map(({ sourceTargetId }) => sourceTargetId)).toEqual(sourceIds);
		expect(
			checks.checks.every(
				({ emptySetCheck, fourComponentCheck }) =>
					emptySetCheck === 'pass' && fourComponentCheck === 'pass'
			)
		).toBe(true);
	});

	it('validates every target contract and matches checked-in deterministic artifacts', () => {
		for (const target of buildEquipmentCandidateTargetsV3())
			EquipmentCandidateTargetV3Schema.parse(target);
		expect(readFileSync(EQUIPMENT_V3_MANIFEST_PATH, 'utf8')).toBe(
			serializeJson(buildEquipmentV3Manifest())
		);
		expect(readFileSync(EQUIPMENT_V3_ALLOCATION_PATH, 'utf8')).toBe(
			serializeJson(buildEquipmentV3AllocationPlan())
		);
	});
});
