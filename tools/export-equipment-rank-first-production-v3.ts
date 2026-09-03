import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { EQUIPMENT_V3_SCHEMA_DEFINITIONS } from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_CLASS_DIRECTIONS_V3,
	EQUIPMENT_MATERIAL_BRIEFS_V3,
	EQUIPMENT_V3_ALLOCATION_PATH,
	EQUIPMENT_V3_DIRECTION_MANIFEST_PATH,
	EQUIPMENT_V3_MANIFEST_PATH,
	EQUIPMENT_V3_ROOT,
	assertEquipmentV3Invariants,
	buildEquipmentCandidateTargetsV3,
	buildEquipmentDirectionPacketsV3,
	buildEquipmentV3AllocationPlan,
	buildEquipmentV3Manifest,
	canonicalSha256,
	serializeJson
} from './equipment-rank-first-production-v3.js';

const args = process.argv.slice(2).filter((value) => value !== '--');
if (args.length !== 1 || !['--write', '--check'].includes(args[0]!)) {
	throw new Error(
		'Usage: tsx tools/export-equipment-rank-first-production-v3.ts (--write|--check)'
	);
}
const check = args[0] === '--check';
const root = process.cwd();

interface Artifact {
	readonly path: string;
	readonly contents: string;
}

const manifest = buildEquipmentV3Manifest();
const allocation = buildEquipmentV3AllocationPlan();
const targets = buildEquipmentCandidateTargetsV3();
const directionPackets = buildEquipmentDirectionPacketsV3();

const artifacts: Artifact[] = [
	{ path: EQUIPMENT_V3_MANIFEST_PATH, contents: serializeJson(manifest) },
	{ path: EQUIPMENT_V3_ALLOCATION_PATH, contents: serializeJson(allocation) },
	{
		path: EQUIPMENT_V3_DIRECTION_MANIFEST_PATH,
		contents: serializeJson({
			schemaVersion: 'equipment-class-direction-manifest-v3',
			productionId: 'material-equipment-v3',
			directions: EQUIPMENT_CLASS_DIRECTIONS_V3,
			secondaryFinishReference: {
				path: 'assets/equipment/experiments/material-vs-class-calibration-2026-09-02/approach-a-steel-material-cohort-v1.png',
				sha256: '6749ad1a65b995f48b89b0c1c8c8ee051da145315f5fd60775803f691ad7b887'
			}
		})
	},
	...EQUIPMENT_MATERIAL_BRIEFS_V3.map((brief) => ({
		path: brief.briefPath,
		contents: serializeJson({ schemaVersion: 'equipment-material-brief-v3', ...brief })
	})),
	...targets.map((target) => ({ path: target.output.targetPath, contents: serializeJson(target) })),
	...directionPackets.flatMap((packet) => [
		{
			path: packet.targetPath,
			contents: serializeJson({
				schemaVersion: 'equipment-class-direction-target-v3',
				directionId: packet.directionId,
				classId: packet.classId,
				width: 1536,
				height: 1024,
				mediaType: 'image/png',
				orderedRanks: ['F', 'E', 'D', 'C', 'B', 'A', 'S'],
				candidatePath: packet.candidatePath,
				resultPath: packet.resultPath
			})
		},
		{
			path: packet.assignmentPath,
			contents: serializeJson({
				schemaVersion: 'equipment-class-direction-assignment-v3',
				assignmentId: `assignment-${packet.directionId}`,
				directionId: packet.directionId,
				immutable: true,
				prompt: packet.prompt,
				promptSha256: packet.promptSha256,
				references: packet.references,
				permittedOutputs: { candidatePath: packet.candidatePath, resultPath: packet.resultPath },
				selfPromotionForbidden: true
			})
		},
		{ path: packet.promptPath, contents: `${packet.prompt}\n` }
	]),
	...EQUIPMENT_V3_SCHEMA_DEFINITIONS.map(([filename, schema]) => ({
		path: `${EQUIPMENT_V3_ROOT}/schemas/${filename}`,
		contents: serializeJson({
			...z.toJSONSchema(schema, { target: 'draft-2020-12' }),
			$id: `https://summonlab.local/schemas/equipment/v3/${filename}`,
			$comment:
				'Structural interchange validation only; semantic validation uses the corresponding Zod schema.'
		})
	})),
	{
		path: `${EQUIPMENT_V3_ROOT}/README.md`,
		contents: `# Equipment rank-first production v3\n\nThis additive namespace owns direction evidence, immutable work packets, candidates, provenance, and review evidence for the rank-first Equipment production. It never implies approval or runtime promotion.\n\n## Lifecycle\n\n\`direction\` → \`candidate\` → owner review receipt → separately authorized approval → separately integrated runtime asset.\n\nThe first activation gate is owner checkpoint 1 for the four generated Bow, Staff, Light Armour, and Robes progression sheets. Root assignments are materialized only after all class directions have accepted hash-bound receipts. Armour-piece assignments additionally require the exact accepted full-set candidate hash.\n\n## Deterministic package\n\n- Manifest: \`manifest.json\`\n- Allocation and gates: \`allocation-plan.json\`\n- 28 material briefs: \`direction/material-briefs/\`\n- 11 class directions: \`direction/class-progressions/manifest.json\`\n- 161 reserved targets: \`targets/\`\n- Contract schemas: \`schemas/\`\n\nValidate with:\n\n\`\`\`bash\ncorepack pnpm tsx tools/export-equipment-rank-first-production-v3.ts --check\ncorepack pnpm vitest run tools/equipment-rank-first-production-v3.spec.ts\n\`\`\`\n`
	},
	{
		path: `${EQUIPMENT_V3_ROOT}/worker-protocol.md`,
		contents: `# Equipment v3 worker protocol\n\n1. Read exactly one immutable target and assignment pair.\n2. Verify the prompt hash and every reference hash before generation.\n3. Generate one dedicated image; progression-sheet crops and multi-item substitutions are forbidden.\n4. Persist only through \`persist-equipment-rank-first-output-v3.ts\`; it validates canvas, ownership, references, and exclusive-create semantics.\n5. Write only the assignment's candidate and provenance-result paths. Candidate never means approved.\n6. A failed call is terminal evidence. Retry only as a separately assigned versioned attempt; never overwrite.\n7. Never edit v1/v2, approved/runtime catalogs, other visual domains, shared contracts, reviews, or checkpoint receipts.\n\nRoot lanes preserve class context and run F→S. Armour pieces remain locked until a hash-bound full-set unlock receipt exists.\n`
	},
	{
		path: `${EQUIPMENT_V3_ROOT}/review-protocol.md`,
		contents: `# Equipment v3 review protocol\n\n## Checkpoint 1\n\nReview all 11 class progression sheets at full resolution plus 128px and 256px thumbnails. Decide accept, revise, or defer for the four new directions. No root assignment exists until all four are accepted.\n\n## Checkpoint 2\n\nReview the 11 deterministic class audits first, then 28 material audits, then each of 77 dedicated roots. Rank clarity wins over material uniformity. A full Armour set additionally must be empty, self-supporting, and show exactly Head, Torso, Legs, and Boots before it can receive an unlock receipt.\n\n## Checkpoint 3\n\nReview 21 audits in strict order: Full Set, Head, Torso, Legs, Boots. Each piece must preserve the exact accepted source's material, silhouette language, palette, trim, fastenings, wear, ornament, and slot boundary.\n\nCheckpoint receipts are hash-bound and owner-authored. Review evidence does not promote a candidate to approved or runtime state.\n`
	},
	{
		path: `${EQUIPMENT_V3_ROOT}/runs/material-equipment-v3-run-001/plan.json`,
		contents: serializeJson({
			schemaVersion: 'equipment-rank-first-run-plan-v3',
			runId: 'material-equipment-v3-run-001',
			productionId: 'material-equipment-v3',
			manifest: { path: EQUIPMENT_V3_MANIFEST_PATH, canonicalSha256: canonicalSha256(manifest) },
			status: 'awaiting-owner-checkpoint-1',
			maximumConcurrency: 16,
			classLaneCount: 11,
			rootAssignmentCountBeforeCheckpoint1: 0,
			armourPieceAssignmentCountBeforeSetUnlocks: 0,
			checkpointPaths: [
				`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-1-directions.json`,
				`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-2-roots.json`,
				`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-3-armour-pieces.json`
			]
		})
	},
	{
		path: `${EQUIPMENT_V3_ROOT}/runs/material-equipment-v3-run-001/journal.json`,
		contents: serializeJson({
			schemaVersion: 'equipment-rank-first-run-journal-v3',
			runId: 'material-equipment-v3-run-001',
			appendPolicy: 'immutable-versioned-events',
			events: []
		})
	}
];

const duplicates = artifacts
	.map(({ path: artifactPath }) => artifactPath)
	.filter((value, index, all) => all.indexOf(value) !== index);
if (duplicates.length > 0) throw new Error(`Duplicate v3 artifact paths: ${duplicates.join(', ')}`);

async function persist(artifact: Artifact): Promise<'written' | 'verified'> {
	const absolute = path.join(root, ...artifact.path.split('/'));
	if (check) {
		const current = await readFile(absolute, 'utf8').catch(() => null);
		if (current === null) throw new Error(`Missing deterministic v3 artifact: ${artifact.path}`);
		if (current !== artifact.contents)
			throw new Error(`Stale deterministic v3 artifact: ${artifact.path}`);
		return 'verified';
	}
	await mkdir(path.dirname(absolute), { recursive: true });
	const current = await readFile(absolute, 'utf8').catch(() => null);
	if (current !== null && current !== artifact.contents)
		throw new Error(`Refusing to overwrite divergent v3 artifact: ${artifact.path}`);
	if (current === null) await writeFile(absolute, artifact.contents, { flag: 'wx' });
	return current === null ? 'written' : 'verified';
}

assertEquipmentV3Invariants(root);
const outcomes = await Promise.all(artifacts.map(persist));
process.stdout.write(
	`${JSON.stringify({ mode: check ? 'check' : 'write', artifactCount: artifacts.length, written: outcomes.filter((value) => value === 'written').length, verified: outcomes.filter((value) => value === 'verified').length, manifestCanonicalSha256: canonicalSha256(manifest), summary: manifest.summary, imageGenerationAuthorized: false }, null, 2)}\n`
);
