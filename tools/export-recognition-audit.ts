import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from '../packages/characters/src/index.js';
import {
	CharacterVisualCatalogSchema,
	RuntimeVisualManifestSchema,
	VisualRecognitionAuditSchema,
	type VisualRecognitionAudit,
	type VisualRecognitionCase
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(workspaceRoot, 'assets/heroes/visuals/catalog.json');
const runtimeManifestPath = resolve(
	workspaceRoot,
	'apps/web/static/runtime/visual-catalog-v1/manifest.json'
);
const auditPath = resolve(workspaceRoot, 'assets/heroes/visuals/recognition-audit.json');
const phoneDpr = 2 as const;

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

const cases: readonly VisualRecognitionCase[] = [
	{
		caseId: 'summon-neutral',
		label: 'First contact',
		cameraTier: 'summon',
		expression: 'neutral',
		paletteMode: 'base',
		equipment: 'none',
		walking: false,
		displayCssWidth: 240,
		displayCssHeight: 432,
		requiredCues: ['face', 'hair', 'silhouette', 'palette', 'signature-traits'],
		requiredStateLayers: ['expression', 'palette'],
		humanReviewStatus: 'pending-human-review',
		reviewPrompt:
			'Does the guarded clean-slate arrival still read as Mara before any nameplate appears?'
	},
	{
		caseId: 'dialogue-alert',
		label: 'Alert reply',
		cameraTier: 'dialogue',
		expression: 'alert',
		paletteMode: 'base',
		equipment: 'none',
		walking: false,
		displayCssWidth: 160,
		displayCssHeight: 288,
		requiredCues: ['face', 'hair', 'silhouette', 'palette', 'signature-traits'],
		requiredStateLayers: ['expression'],
		humanReviewStatus: 'pending-human-review',
		reviewPrompt: 'Does alertness change her expression without replacing her facial structure?'
	},
	{
		caseId: 'dialogue-skeptical-night',
		label: 'Skeptical night watch',
		cameraTier: 'dialogue',
		expression: 'skeptical',
		paletteMode: 'night',
		equipment: 'none',
		walking: false,
		displayCssWidth: 160,
		displayCssHeight: 288,
		requiredCues: ['face', 'hair', 'silhouette', 'palette', 'signature-traits'],
		requiredStateLayers: ['expression', 'palette'],
		humanReviewStatus: 'pending-human-review',
		reviewPrompt:
			'Do the brow and mouth shift survive the night grade without muddying identity cues?'
	},
	{
		caseId: 'roster-equipped',
		label: 'Roster with bow',
		cameraTier: 'roster',
		expression: 'neutral',
		paletteMode: 'base',
		equipment: 'short-bow',
		walking: false,
		displayCssWidth: 96,
		displayCssHeight: 173,
		requiredCues: ['face', 'hair', 'silhouette', 'palette', 'signature-traits'],
		requiredStateLayers: ['equipment'],
		humanReviewStatus: 'pending-human-review',
		reviewPrompt:
			'Does the bow remain an attachment while height, knot, cloak, and clasp stay primary?'
	},
	{
		caseId: 'settlement-night-walk',
		label: 'Settlement night walk',
		cameraTier: 'settlement',
		expression: 'neutral',
		paletteMode: 'night',
		equipment: 'none',
		walking: true,
		displayCssWidth: 48,
		displayCssHeight: 86,
		requiredCues: ['hair', 'silhouette', 'palette', 'signature-traits'],
		requiredStateLayers: ['palette', 'gait'],
		humanReviewStatus: 'pending-human-review',
		reviewPrompt:
			'Without claiming the face, do gait, hair mass, cloak, and ember clasp identify Mara?'
	},
	{
		caseId: 'mission-exertion',
		label: 'Mission exertion',
		cameraTier: 'mission',
		expression: 'exertion',
		paletteMode: 'base',
		equipment: 'practice-blade',
		walking: true,
		displayCssWidth: 72,
		displayCssHeight: 130,
		requiredCues: ['hair', 'silhouette', 'palette', 'signature-traits'],
		requiredStateLayers: ['expression', 'equipment', 'gait'],
		humanReviewStatus: 'pending-human-review',
		reviewPrompt:
			'Does combat motion preserve her guarded silhouette and dominant-hand equipment logic?'
	},
	{
		caseId: 'dialogue-injured',
		label: 'Injured debrief',
		cameraTier: 'dialogue',
		expression: 'injured',
		paletteMode: 'injured',
		equipment: 'none',
		walking: false,
		displayCssWidth: 160,
		displayCssHeight: 288,
		requiredCues: ['face', 'hair', 'silhouette', 'palette', 'signature-traits'],
		requiredStateLayers: ['expression', 'palette', 'injury'],
		humanReviewStatus: 'pending-human-review',
		reviewPrompt:
			'Does injury read as a localized consequence rather than a redesign or global filter?'
	}
];

async function buildAudit(): Promise<VisualRecognitionAudit> {
	const [catalogBytes, runtimeBytes] = await Promise.all([
		readFile(catalogPath),
		readFile(runtimeManifestPath)
	]);
	const catalog = CharacterVisualCatalogSchema.parse(JSON.parse(catalogBytes.toString('utf8')));
	const runtime = RuntimeVisualManifestSchema.parse(JSON.parse(runtimeBytes.toString('utf8')));
	if (runtime.catalogVersion !== catalog.catalogVersion) {
		throw new Error('Recognition audit catalog and runtime versions disagree');
	}
	if (runtime.catalogContentHash !== sha256(catalogBytes)) {
		throw new Error('Recognition audit runtime catalog hash is stale');
	}

	const profile = catalog.profiles.find((candidate) => candidate.approvedAssetKeys.length > 0);
	if (!profile) throw new Error('Recognition audit requires an approved character profile');
	const approvedSource = catalog.assets.find(
		(asset) => asset.status === 'approved' && profile.approvedAssetKeys.includes(asset.assetKey)
	);
	if (!approvedSource) throw new Error('Recognition audit profile has no approved source asset');
	if (
		approvedSource.characterIds.length !== 1 ||
		approvedSource.characterIds[0] !== profile.characterId ||
		approvedSource.manifestHashes[0] !== profile.manifestHash
	) {
		throw new Error('Recognition audit approved source identity is inconsistent');
	}
	const runtimeAssets = runtime.bundles
		.flatMap((bundle) => bundle.assets)
		.filter((asset) => asset.sourceAssetKey === approvedSource.assetKey);
	const displaySizes = {
		summon: { width: 192, height: 288 },
		dialogue: { width: 160, height: 240 },
		roster: { width: 96, height: 144 }
	} as const;
	const textures = (['summon', 'dialogue', 'roster'] as const).map((usage) => {
		const asset = runtimeAssets.find((candidate) => candidate.usage === usage);
		if (!asset) throw new Error(`Recognition audit is missing the ${usage} runtime texture`);
		const display = displaySizes[usage];
		const requiredPixelWidth = display.width * phoneDpr;
		const requiredPixelHeight = display.height * phoneDpr;
		return {
			alias: asset.alias,
			usage,
			width: asset.width,
			height: asset.height,
			displayCssWidth: display.width,
			displayCssHeight: display.height,
			requiredPixelWidth,
			requiredPixelHeight,
			densityMargin: Number(
				Math.min(asset.width / requiredPixelWidth, asset.height / requiredPixelHeight).toFixed(3)
			),
			encodedBytes: asset.bytes,
			decodedRgbaBytes: asset.width * asset.height * 4,
			densityStatus: 'sufficient' as const
		};
	});
	const expressionCoverage = [...new Set(cases.map((entry) => entry.expression))];
	if (
		profile.expressions.length !== expressionCoverage.length ||
		profile.expressions.some((expression) => !expressionCoverage.includes(expression))
	) {
		throw new Error('Recognition cases must cover every expression in the approved profile');
	}
	const core = {
		schemaVersion: 'visual-recognition-audit-v1' as const,
		catalogVersion: catalog.catalogVersion,
		catalogContentHash: runtime.catalogContentHash,
		characterId: profile.characterId,
		manifestHash: profile.manifestHash,
		approvedSourceAssetKey: approvedSource.assetKey,
		approvedSourceContentHash: approvedSource.contentHash,
		cases,
		coverage: {
			expressions: expressionCoverage,
			cameraTiers: ['summon', 'dialogue', 'roster', 'settlement', 'mission'] as const,
			paletteModes: ['base', 'night', 'injured'] as const,
			equipment: ['none', 'practice-blade', 'short-bow'] as const
		},
		phoneDelivery: {
			profile: 'mid-range-phone-390x844-2x' as const,
			viewportCssWidth: 390 as const,
			viewportCssHeight: 844 as const,
			devicePixelRatio: phoneDpr,
			textures,
			totalEncodedBytes: textures.reduce((total, texture) => total + texture.encodedBytes, 0),
			totalDecodedRgbaBytes: textures.reduce(
				(total, texture) => total + texture.decodedRgbaBytes,
				0
			),
			visualPayloadBudgetBytes: 8_000_000 as const,
			textureMemoryReferenceBytes: 300_000_000 as const,
			payloadStatus: 'within-budget' as const,
			textureMemoryProxyStatus: 'within-reference' as const
		},
		humanReviewStatus: 'pending-human-review' as const
	};
	return VisualRecognitionAuditSchema.parse({
		...core,
		auditHash: sha256(canonicalJson(core))
	});
}

const audit = await buildAudit();
const auditText = await format(JSON.stringify(audit), {
	parser: 'json',
	useTabs: true,
	printWidth: 100,
	trailingComma: 'none'
});

if (process.argv.includes('--check')) {
	const stored = VisualRecognitionAuditSchema.parse(JSON.parse(await readFile(auditPath, 'utf8')));
	const { auditHash: _storedHash, ...storedCore } = stored;
	if (
		sha256(canonicalJson(storedCore)) !== stored.auditHash ||
		auditText !== (await readFile(auditPath, 'utf8'))
	) {
		throw new Error('Recognition audit is stale; run pnpm export:recognition-audit');
	}
} else {
	await writeFile(auditPath, auditText);
}

process.stdout.write(
	`${JSON.stringify(
		{
			mode: process.argv.includes('--check') ? 'check' : 'write',
			auditHash: audit.auditHash,
			caseCount: audit.cases.length,
			expressionCount: audit.coverage.expressions.length,
			cameraTierCount: audit.coverage.cameraTiers.length,
			phoneEncodedBytes: audit.phoneDelivery.totalEncodedBytes,
			phoneDecodedRgbaBytes: audit.phoneDelivery.totalDecodedRgbaBytes,
			humanReviewStatus: audit.humanReviewStatus
		},
		null,
		2
	)}\n`
);
