import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
	SkillIconAssignmentV2Schema,
	SkillIconTargetV2Schema,
	type SkillIconRarity
} from '../packages/contracts/src/index.js';

const OPTION_C_PATH = 'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png';
const SELECTED_FRAME_SHEET_PATH =
	'assets/wiki/skills/icon-production-v1/mass-production-v1/references/approved-seven-frame-sheet.png';
const REFERENCE_ROOT = 'assets/wiki/skills/icon-production-v1' as const;
const ASSIGNED_AT = '2026-09-04T00:00:00.000Z' as const;

const FRAME_MATERIAL = {
	E: 'aged bronze with brown-gold patina and understated corner collars',
	D: 'tempered blue steel with cool edge highlights and restrained rivets',
	C: 'moonlit silver with clean bevels and minimal ornament',
	B: 'blackened amethyst metal with subtle violet inlay',
	A: 'champagne electrum with brighter bevels and four restrained point ornaments',
	S: 'ceremonial antique gold with the approved thorned crown ornament'
} as const;

const FRAME_RARITIES = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
const FORBIDDEN_SHARED_PATHS = [
	`${REFERENCE_ROOT}/catalog.json`,
	`${REFERENCE_ROOT}/visual-specs.json`,
	`${REFERENCE_ROOT}/masters`,
	`${REFERENCE_ROOT}/review`,
	'apps/web/static/skill-icons/v1',
	'docs/wiki/art/skill-rarity-frames.md',
	OPTION_C_PATH,
	SELECTED_FRAME_SHEET_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH
] as const;

interface AuthorityFile {
	readonly path: string;
	readonly contentHash: string;
}

interface PacketPair {
	readonly jobId: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly target: ReturnType<typeof SkillIconTargetV2Schema.parse>;
	readonly assignment: ReturnType<typeof SkillIconAssignmentV2Schema.parse>;
}

export interface ReferencePacketExportReport {
	readonly mode: 'write' | 'check';
	readonly jobIds: readonly string[];
	readonly written: readonly string[];
	readonly drifted: readonly string[];
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function repositoryPathFor(kind: 'targets' | 'assignments', jobId: string): string {
	return `${REFERENCE_ROOT}/${kind}/references/${jobId}.json`;
}

function outputPaths(jobId: string): {
	readonly candidatePath: string;
	readonly resultPath: string;
} {
	return {
		candidatePath: `${REFERENCE_ROOT}/candidates/references/${jobId}.png`,
		resultPath: `${REFERENCE_ROOT}/results/references/${jobId}.json`
	};
}

function framePrompt(rarity: keyof typeof FRAME_MATERIAL): string {
	return `Create exactly one 1254×1254 RGB PNG provider-source raster for the tier ${rarity} rarity-frame layer. Use the supplied Option C comparison only as material and ornament authority, and use the approved seven-frame sheet only as proportional and material-ladder guidance; do not crop or trace either reference or reuse source pixels. Use the supplied geometry guide only as a registration and role-mask reference, never as image content. Render one fully visible regular hexagon with every frame-material pixel confined to the guide's allowed annulus and top-center crest zone. Keep a completely empty aperture and every exterior region free of foreground. Build ${FRAME_MATERIAL[rarity]}. Include exactly one integrated crest/letter bearing only the uppercase letter ${rarity}. Render on a perfectly uniform opaque #00FF00 matte with no baked checkerboard; keep this provider matte perfectly uniform. Do not render guide colors, construction marks, labels, UI, shadows, fringe, texture, gradient, or marks in the empty aperture or exterior matte. No art or backing, scenery, glow, emblem, or additional symbol, number, word, label, or text. The pipeline removes the matte, resizes to 1024×1024, and applies the fixed rarity-frame role mask. Output only this isolated provider-source raster.`;
}

function backingPrompt(): string {
	return 'Create exactly one 1254×1254 RGB PNG provider-source raster for the universal skill-icon backing layer. Use the supplied Option C comparison only as Option C tonal authority; do not crop or trace it or reuse source pixels. Use the supplied geometry guide only as a registration and role-mask reference, never as image content. Fill the guide\'s backing aperture with dark neutral charcoal forged stone, restrained shallow facets, and subtle low-contrast forged texture, carrying the material cleanly to the backing boundary. Leave every region outside that aperture as uninterrupted matte. Render on a perfectly uniform opaque #00FF00 matte with no baked checkerboard; keep this provider matte perfectly uniform. Do not render guide colors, construction marks, labels, UI, frame, rim, ornament, emblem, skill art, rarity cue, medallion, letter, number, word, scenery, glow, colored magic, or bright focal mark. The pipeline removes the matte, resizes to 1024×1024, and applies the fixed backing role mask. Output only this isolated provider-source raster.';
}

function normalization() {
	return {
		profile: 'skill-icon-green-key-role-mask-v3' as const,
		sourceContract: {
			mediaType: 'image/png' as const,
			width: 1254 as const,
			height: 1254 as const,
			alphaMode: 'rgb' as const,
			matteColor: '#00FF00' as const
		},
		outputContract: {
			mediaType: 'image/png' as const,
			width: 1024 as const,
			height: 1024 as const,
			alphaMode: 'rgba' as const
		},
		geometry: {
			path: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
			contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
		}
	};
}

function assignmentFor(
	jobId: string,
	logicalIdentity: string,
	revision: number,
	targetPath: string,
	assignmentPath: string,
	permittedOutputs: ReturnType<typeof outputPaths>
) {
	return SkillIconAssignmentV2Schema.parse({
		schemaVersion: 'skill-icon-assignment-v2',
		assignmentId: `assignment-${jobId}`,
		jobId,
		logicalIdentity,
		revision,
		targetPath,
		assignmentPath,
		skillVersion: 'summonlab-skill-icon-production-v4',
		normalization: { profile: 'skill-icon-green-key-role-mask-v3' },
		assignedAt: ASSIGNED_AT,
		retryCeiling: 1,
		permittedOutputs,
		forbiddenSharedPaths: FORBIDDEN_SHARED_PATHS,
		completionContract: {
			oneTargetOneImage: true,
			structuredResultRequired: true,
			sharedFilesMustRemainUntouched: true,
			selfPromotionForbidden: true
		}
	});
}

function framePacket(rarity: SkillIconRarity, authorities: Readonly<Record<string, AuthorityFile>>): PacketPair {
	const slug = rarity.toLowerCase();
	const logicalIdentity = `rarity-frame-${slug}`;
	const revision = 5;
	const jobId = `${logicalIdentity}-v${revision}`;
	const targetPath = repositoryPathFor('targets', jobId);
	const assignmentPath = repositoryPathFor('assignments', jobId);
	const output = outputPaths(jobId);
	const target = SkillIconTargetV2Schema.parse({
		schemaVersion: 'skill-icon-target-v2',
		jobId,
		logicalIdentity,
		revision,
		role: 'rarity-frame',
		skillTargetId: null,
		motifFamily: null,
		rarity,
		exactPrompt: framePrompt(rarity),
		references: [
			{
				path: OPTION_C_PATH,
				purpose: 'Canonical Option C rarity-frame material and ornament authority.',
				contentHash: authorities[OPTION_C_PATH]!.contentHash
			},
			{
				path: SELECTED_FRAME_SHEET_PATH,
				purpose:
					'Approved seven-frame sheet for proportional and material-ladder guidance only; never crop or trace it.',
				contentHash: authorities[SELECTED_FRAME_SHEET_PATH]!.contentHash
			},
			{
				path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
				purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
				contentHash: authorities[SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH]!.contentHash
			}
		],
		canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
		output,
		normalization: normalization()
	});
	return {
		jobId,
		targetPath,
		assignmentPath,
		target,
		assignment: assignmentFor(jobId, logicalIdentity, revision, targetPath, assignmentPath, output)
	};
}

function backingPacket(authorities: Readonly<Record<string, AuthorityFile>>): PacketPair {
	const logicalIdentity = 'charcoal-forged-stone';
	const revision = 5;
	const jobId = `${logicalIdentity}-v${revision}`;
	const targetPath = repositoryPathFor('targets', jobId);
	const assignmentPath = repositoryPathFor('assignments', jobId);
	const output = outputPaths(jobId);
	const target = SkillIconTargetV2Schema.parse({
		schemaVersion: 'skill-icon-target-v2',
		jobId,
		logicalIdentity,
		revision,
		role: 'backing',
		skillTargetId: null,
		motifFamily: null,
		rarity: null,
		exactPrompt: backingPrompt(),
		references: [
			{
				path: OPTION_C_PATH,
				purpose: 'Canonical Option C material and tonal authority.',
				contentHash: authorities[OPTION_C_PATH]!.contentHash
			},
			{
				path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
				purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
				contentHash: authorities[SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH]!.contentHash
			}
		],
		canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
		output,
		normalization: normalization()
	});
	return {
		jobId,
		targetPath,
		assignmentPath,
		target,
		assignment: assignmentFor(jobId, logicalIdentity, revision, targetPath, assignmentPath, output)
	};
}

async function loadAuthority(root: string, repositoryPath: string): Promise<AuthorityFile> {
	const absolutePath = path.resolve(root, repositoryPath);
	const metadata = await lstat(absolutePath);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Reference authority must be a regular file: ${repositoryPath}`);
	return { path: repositoryPath, contentHash: sha256(await readFile(absolutePath)) };
}

function assertCollisionSafe(packets: readonly PacketPair[]): void {
	const paths = packets.flatMap((packet) => [
		packet.targetPath,
		packet.assignmentPath,
		packet.target.output.candidatePath,
		packet.target.output.resultPath
	]);
	if (new Set(paths).size !== paths.length) throw new Error('Reference packet paths must be collision-safe');
}

async function compareOrWrite(
	root: string,
	repositoryPath: string,
	bytes: Buffer,
	mode: 'write' | 'check',
	written: string[],
	drifted: string[]
): Promise<void> {
	const destination = path.resolve(root, repositoryPath);
	const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current?.equals(bytes)) return;
	if (mode === 'check') {
		drifted.push(repositoryPath);
		return;
	}
	await mkdir(path.dirname(destination), { recursive: true });
	await writeFile(destination, bytes);
	written.push(repositoryPath);
}

export async function exportCleanupReferencePackets({
	root = process.cwd(),
	mode
}: {
	readonly root?: string;
	readonly mode: 'write' | 'check';
}): Promise<ReferencePacketExportReport> {
	const authorities = Object.fromEntries(
		await Promise.all(
			[OPTION_C_PATH, SELECTED_FRAME_SHEET_PATH, SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH].map(
				async (repositoryPath) => [repositoryPath, await loadAuthority(root, repositoryPath)] as const
			)
		)
	) as Readonly<Record<string, AuthorityFile>>;
	const geometry = await loadAuthority(root, SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH);
	if (geometry.contentHash !== SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH)
		throw new Error('Geometry-v2 authority hash drifted');
	if (
		authorities[SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH]!.contentHash !==
		SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH
	)
		throw new Error('Provider-space guide authority hash drifted');

	const packets = [
		...FRAME_RARITIES.map((rarity) => framePacket(rarity, authorities)),
		backingPacket(authorities)
	];
	assertCollisionSafe(packets);
	const written: string[] = [];
	const drifted: string[] = [];
	for (const packet of packets) {
		await compareOrWrite(root, packet.targetPath, jsonBytes(packet.target), mode, written, drifted);
		await compareOrWrite(
			root,
			packet.assignmentPath,
			jsonBytes(packet.assignment),
			mode,
			written,
			drifted
		);
	}
	return { mode, jobIds: packets.map((packet) => packet.jobId), written, drifted };
}

function parseMode(args: readonly string[]): 'write' | 'check' {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? ''))
		throw new Error('Usage: tsx tools/export-skill-icon-cleanup-reference-packets.ts --write|--check');
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	exportCleanupReferencePackets({ mode: parseMode(process.argv.slice(2)) })
		.then((report) => {
			process.stdout.write(
				`${report.mode}: ${report.jobIds.length} packet pairs; ${report.written.length} written; ${report.drifted.length} drifted\n`
			);
			if (report.drifted.length > 0) process.exitCode = 1;
		})
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
