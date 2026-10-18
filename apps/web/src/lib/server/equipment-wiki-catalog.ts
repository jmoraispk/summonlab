import { createHash } from 'node:crypto';
import { base } from '$app/paths';

import materialRaw from '../../../../../assets/equipment/approved/material-equipment-v1/manifest.json?raw';
import greatswordRaw from '../../../../../assets/equipment/approved/two-handed-greatsword-v1/manifest.json?raw';
import runtimeRaw from '../../../static/runtime/equipment-v1/manifest.json?raw';
import galleryRaw from '../../../static/wiki-media/equipment-gallery-v1/manifest.json?raw';

export interface EquipmentWikiRecord {
	readonly assetKey: string;
	readonly name: string;
	readonly rank: string;
	readonly materialId: string;
	readonly material: string;
	readonly equipmentClass: string;
	readonly className: string;
	readonly slot: string | null;
	readonly role: 'item' | 'armor-set-reference';
	readonly integration: 'runtime' | 'reference' | 'pending';
	readonly sourcePath: string;
	readonly sourceContentHash: string;
	readonly image: {
		readonly publicPath: string;
		readonly width: number;
		readonly height: number;
		readonly contentHash: string;
	};
	readonly pieces: readonly { readonly assetKey: string; readonly slot: string }[];
}

interface SourceRecord {
	assetKey: string;
	rank: string;
	materialId: string;
	equipmentClass?: string;
	slot?: string | null;
	role?: 'item' | 'armor-set-reference';
	approved: { path: string; sha256: string };
}

interface GalleryRecord {
	assetKey: string;
	sourcePath: string;
	sourceContentHash: string;
	file: string;
	publicPath: string;
	width: number;
	height: number;
	bytes: number;
	contentHash: string;
}

export interface EquipmentWikiAuthorities {
	material: string;
	greatsword: string;
	runtime: string;
	gallery: string;
}

const sourcePaths = {
	material: 'assets/equipment/approved/material-equipment-v1/manifest.json',
	greatsword: 'assets/equipment/approved/two-handed-greatsword-v1/manifest.json'
};
const defaultAuthorities = {
	material: materialRaw,
	greatsword: greatswordRaw,
	runtime: runtimeRaw,
	gallery: galleryRaw
};
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const title = (id: string) =>
	id
		.split('-')
		.map((word) => word[0]!.toUpperCase() + word.slice(1))
		.join(' ');

export function buildEquipmentWikiCatalog(
	input: EquipmentWikiAuthorities = defaultAuthorities
): readonly EquipmentWikiRecord[] {
	const material = JSON.parse(input.material) as { schemaVersion: string; records: SourceRecord[] };
	const greatsword = JSON.parse(input.greatsword) as {
		schemaVersion: string;
		records: SourceRecord[];
	};
	const runtime = JSON.parse(input.runtime) as {
		schemaVersion: string;
		approvedSource: { manifestContentHash: string };
		bundles: {
			sourceAssetKey: string;
			assets: {
				usage: string;
				sourceApprovedPath: string;
				sourceContentHash: string;
				publicPath: string;
				width: number;
				height: number;
				contentHash: string;
			}[];
		}[];
	};
	const gallery = JSON.parse(input.gallery) as {
		schemaVersion: string;
		sourceAuthorities: Record<string, { path: string; contentHash: string }>;
		summary: { assetCount: number; totalBytes: number };
		records: GalleryRecord[];
	};
	if (
		material.schemaVersion !== 'equipment-approved-source-manifest-v1' ||
		greatsword.schemaVersion !== 'equipment-greatsword-approved-source-manifest-v1' ||
		runtime.schemaVersion !== 'equipment-runtime-visual-manifest-v1' ||
		gallery.schemaVersion !== 'wiki-equipment-gallery-v1'
	)
		throw new Error('Invalid equipment wiki schema');
	for (const key of ['material', 'greatsword'] as const) {
		const authority = gallery.sourceAuthorities[key];
		if (authority?.path !== sourcePaths[key] || authority.contentHash !== sha256(input[key])) {
			throw new Error(`Equipment wiki ${key} source hash mismatch`);
		}
	}
	if (runtime.approvedSource.manifestContentHash !== sha256(input.material)) {
		throw new Error('Equipment runtime source hash mismatch');
	}
	if (
		material.records.length !== 161 ||
		greatsword.records.length !== 7 ||
		runtime.bundles.length !== 140 ||
		gallery.records.length !== 28 ||
		gallery.summary.assetCount !== 28 ||
		gallery.summary.totalBytes !==
			gallery.records.reduce((total, record) => total + record.bytes, 0)
	) {
		throw new Error('Incomplete equipment wiki image inventory');
	}
	const galleryById = new Map(gallery.records.map((record) => [record.assetKey, record]));
	const runtimeById = new Map(runtime.bundles.map((record) => [record.sourceAssetKey, record]));
	const sources = [...material.records, ...greatsword.records];
	if (
		new Set(sources.map((record) => record.assetKey)).size !== 168 ||
		galleryById.size !== 28 ||
		runtimeById.size !== 140
	)
		throw new Error('Duplicate equipment image');

	const records = sources.map((source): EquipmentWikiRecord => {
		const isGreatsword = source.assetKey.startsWith('equipment-greatsword-v1-');
		const role = source.role ?? 'item';
		const equipmentClass = isGreatsword ? 'greatsword' : source.equipmentClass!;
		const className = title(equipmentClass);
		const materialName = title(source.materialId);
		const derived =
			role === 'armor-set-reference' || isGreatsword
				? galleryById.get(source.assetKey)
				: runtimeById.get(source.assetKey)?.assets.find((asset) => asset.usage === 'detail');
		if (!derived) throw new Error(`Missing equipment derivative: ${source.assetKey}`);
		const sourcePath = 'sourcePath' in derived ? derived.sourcePath : derived.sourceApprovedPath;
		if (
			sourcePath !== source.approved.path ||
			derived.sourceContentHash !== source.approved.sha256
		) {
			throw new Error(`Equipment derivative source mismatch: ${source.assetKey}`);
		}
		const publicRoot =
			role === 'armor-set-reference' || isGreatsword
				? '/wiki-media/equipment-gallery-v1/'
				: '/runtime/equipment-v1/';
		const expectedHeight = role === 'armor-set-reference' ? 768 : 512;
		if (
			!derived.publicPath.startsWith(publicRoot) ||
			derived.publicPath.includes('..') ||
			!derived.publicPath.endsWith('.webp') ||
			derived.width !== 512 ||
			derived.height !== expectedHeight ||
			!/^[a-f0-9]{64}$/u.test(derived.contentHash)
		)
			throw new Error(`Invalid equipment image: ${source.assetKey}`);
		const pieces =
			role === 'armor-set-reference'
				? ['head', 'torso', 'legs', 'boots'].map((slot) => {
						const piece = material.records.find(
							(record) =>
								record.role === 'item' &&
								record.slot === slot &&
								record.rank === source.rank &&
								record.materialId === source.materialId &&
								record.equipmentClass === equipmentClass
						);
						if (!piece) throw new Error(`Missing ${slot} for ${source.assetKey}`);
						return Object.freeze({ assetKey: piece.assetKey, slot });
					})
				: [];
		return Object.freeze({
			assetKey: source.assetKey,
			name: `${materialName} ${className}${source.slot ? ` · ${title(source.slot)}` : role === 'armor-set-reference' ? ' · Complete Set' : ''}`,
			rank: source.rank,
			materialId: source.materialId,
			material: materialName,
			equipmentClass,
			className,
			slot: source.slot ?? null,
			role,
			integration: isGreatsword
				? 'pending'
				: role === 'armor-set-reference'
					? 'reference'
					: 'runtime',
			sourcePath: source.approved.path,
			sourceContentHash: source.approved.sha256,
			image: Object.freeze({
				publicPath: `${base}${derived.publicPath}`,
				width: derived.width,
				height: derived.height,
				contentHash: derived.contentHash
			}),
			pieces: Object.freeze(pieces)
		});
	});
	if (records.filter((record) => record.role === 'armor-set-reference').length !== 21) {
		throw new Error('Incomplete armor set inventory');
	}
	return Object.freeze(records);
}

const equipmentWikiCatalog = buildEquipmentWikiCatalog();

export function getEquipmentWikiCatalog(): readonly EquipmentWikiRecord[] {
	return equipmentWikiCatalog;
}
