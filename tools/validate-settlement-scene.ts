import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

import { loadHearth01, loadHearth01Scene } from '../packages/content/src/index.js';

async function sha256(path: string): Promise<string> {
	return createHash('sha256')
		.update(await readFile(path))
		.digest('hex');
}

function assertSameSet(actual: string[], expected: string[], label: string): void {
	const left = [...actual].sort();
	const right = [...expected].sort();
	if (JSON.stringify(left) !== JSON.stringify(right)) {
		throw new Error(`${label} coverage drifted`);
	}
}

const [settlement, scene] = await Promise.all([loadHearth01(), loadHearth01Scene()]);
if (
	scene.settlementContentVersion !== settlement.contentVersion ||
	scene.settlementContentHash !== settlement.contentHash
) {
	throw new Error('Settlement scene is bound to stale topology');
}

assertSameSet(
	scene.hotspots.map((hotspot) => hotspot.buildingId),
	settlement.buildings.map((building) => building.buildingId),
	'Building hotspot'
);
assertSameSet(
	scene.hotspots.map((hotspot) => hotspot.entranceNodeId),
	settlement.buildings.map((building) => building.entranceNodeId),
	'Building entrance'
);
assertSameSet(
	scene.nodeProjections.map((projection) => projection.nodeId),
	settlement.nodes.map((node) => node.nodeId),
	'Route node projection'
);

const hotspotByBuildingId = new Map(scene.hotspots.map((hotspot) => [hotspot.buildingId, hotspot]));
const gate = hotspotByBuildingId.get('summoning-gate')!;
const kitchen = hotspotByBuildingId.get('kitchen')!;
const workshop = hotspotByBuildingId.get('workshop')!;
const dormitory = hotspotByBuildingId.get('dormitory')!;
const training = hotspotByBuildingId.get('training-ground')!;
if (
	gate.center.y >= kitchen.center.y ||
	gate.center.y >= workshop.center.y ||
	kitchen.center.x >= workshop.center.x ||
	dormitory.center.y <= kitchen.center.y ||
	training.center.y <= workshop.center.y ||
	dormitory.center.x >= training.center.x
) {
	throw new Error('Settlement scene no longer matches the reviewed five-place compass layout');
}

for (const reference of scene.generation.references) {
	if ((await sha256(resolve(reference.file))) !== reference.contentHash) {
		throw new Error(`Settlement scene reference drifted: ${reference.file}`);
	}
}

for (const asset of [scene.source, scene.runtime]) {
	const path = resolve(asset.file);
	const [details, metadata, contentHash] = await Promise.all([
		stat(path),
		sharp(path).metadata(),
		sha256(path)
	]);
	if (details.size !== asset.bytes)
		throw new Error(`Settlement scene bytes drifted: ${asset.file}`);
	if (metadata.width !== asset.width || metadata.height !== asset.height) {
		throw new Error(`Settlement scene dimensions drifted: ${asset.file}`);
	}
	if (contentHash !== asset.contentHash) {
		throw new Error(`Settlement scene content hash drifted: ${asset.file}`);
	}
}

const expectedPublicPath = scene.runtime.file.replace('apps/web/static', '').replaceAll('\\', '/');
if (scene.runtime.publicPath !== expectedPublicPath) {
	throw new Error('Settlement scene public path drifted from its runtime file');
}
if (!scene.runtime.file.includes(scene.runtime.contentHash.slice(0, 12))) {
	throw new Error('Settlement scene runtime filename is not content-addressed');
}

process.stdout.write(
	`${JSON.stringify(
		{
			sceneVersion: scene.sceneVersion,
			sceneHash: scene.sceneHash,
			settlementContentHash: scene.settlementContentHash,
			status: scene.status,
			layerCount: scene.layers.length,
			hotspotCount: scene.hotspots.length,
			nodeProjectionCount: scene.nodeProjections.length,
			runtimeBytes: scene.runtime.bytes,
			runtimeBudgetBytes: scene.runtime.budgetBytes,
			runtimeBudgetUsedPercent: Number(
				((scene.runtime.bytes / scene.runtime.budgetBytes) * 100).toFixed(1)
			),
			decodedRgbaBytes: scene.runtime.decodedRgbaBytes,
			decodedMemoryBudgetBytes: scene.runtime.decodedMemoryBudgetBytes,
			decodedMemoryBudgetUsedPercent: Number(
				((scene.runtime.decodedRgbaBytes / scene.runtime.decodedMemoryBudgetBytes) * 100).toFixed(1)
			)
		},
		null,
		2
	)}\n`
);
