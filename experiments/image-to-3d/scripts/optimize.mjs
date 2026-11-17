// Optimize every work/models/<tool>/<subject>/raw.glb into optimized.glb against the game budgets,
// then write measurements (triangles, texture sizes, bytes) to work/models/<tool>/<subject>/metrics.json.
import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
	dedup, weld, simplify, prune, textureCompress, quantize, meshopt, flatten, join, resample,
	getSceneVertexCount, VertexCountMethod
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const EXP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const subjects = JSON.parse(await readFile(path.join(EXP, 'subjects.json'), 'utf8'));
const BUDGET = {
	humanoid: { tris: 15000, bytes: 2 * 1024 * 1024, tex: 1024 },
	quadruped: { tris: 15000, bytes: 2 * 1024 * 1024, tex: 1024 },
	'humanoid-with-object': { tris: 15000, bytes: 2 * 1024 * 1024, tex: 1024 },
	prop: { tris: 3000, bytes: 300 * 1024, tex: 512 }
};

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

export async function measure(file) {
	const doc = await io.read(file);
	let tris = 0;
	for (const mesh of doc.getRoot().listMeshes())
		for (const prim of mesh.listPrimitives()) {
			const idx = prim.getIndices();
			tris += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
		}
	const textures = [];
	for (const t of doc.getRoot().listTextures()) {
		const size = t.getSize();
		textures.push({ mime: t.getMimeType(), size: size ? `${size[0]}x${size[1]}` : null, bytes: t.getImage()?.byteLength ?? 0 });
	}
	return {
		bytes: (await stat(file)).size,
		triangles: Math.round(tris),
		vertices: getSceneVertexCount(doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0], VertexCountMethod.UPLOAD),
		textures,
		animations: doc.getRoot().listAnimations().map((a) => a.getName()),
		skins: doc.getRoot().listSkins().length
	};
}

async function optimizeOne(raw, out, budget) {
	const doc = await io.read(raw);
	await doc.transform(dedup(), flatten(), join(), weld());
	const start = (await measureDoc(doc)).triangles;
	// meshoptimizer stops early at UV seams/borders; tighten ratio until under budget.
	let ratio = Math.min(1, budget.tris / start);
	for (let i = 0; i < 6 && (await measureDoc(doc)).triangles > budget.tris; i++) {
		await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02 * (i + 1), lockBorder: false }));
		ratio *= 0.85;
	}
	await doc.transform(
		prune(),
		textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [budget.tex, budget.tex] }),
		quantize(),
		meshopt({ encoder: MeshoptEncoder, level: 'medium' })
	);
	await io.write(out, doc);
}

async function measureDoc(doc) {
	let tris = 0;
	for (const mesh of doc.getRoot().listMeshes())
		for (const prim of mesh.listPrimitives()) {
			const idx = prim.getIndices();
			tris += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
		}
	return { triangles: tris };
}

const only = new Set(process.argv.slice(2));
const modelsDir = path.join(EXP, 'work', 'models');
for (const tool of await readdir(modelsDir)) {
	for (const s of subjects) {
		if (only.size && !only.has(s.id) && !only.has(tool)) continue;
		const dir = path.join(modelsDir, tool, s.id);
		const raw = path.join(dir, 'raw.glb');
		try { await stat(raw); } catch { continue; }
		const budget = BUDGET[s.kind];
		const outFile = path.join(dir, 'optimized.glb');
		await optimizeOne(raw, outFile, budget);
		// Rigged variant (from scripts/blender_rig.py) goes through the same budget pipeline.
		const rigged = path.join(dir, 'rigged.glb');
		if (await stat(rigged).then(() => true, () => false)) await optimizeOne(rigged, path.join(dir, 'animated.glb'), budget);
		const metrics = { tool, subject: s.id, kind: s.kind, budget, raw: await measure(raw), optimized: await measure(outFile) };
		if (await stat(path.join(dir, 'animated.glb')).then(() => true, () => false)) metrics.animated = await measure(path.join(dir, 'animated.glb'));
		metrics.withinBudget = metrics.optimized.triangles <= budget.tris && metrics.optimized.bytes <= budget.bytes;
		await writeFile(path.join(dir, 'metrics.json'), JSON.stringify(metrics, null, 2));
		console.log(tool, s.id, 'raw', metrics.raw.triangles, 'tris', (metrics.raw.bytes / 1024).toFixed(0), 'KB ->',
			metrics.optimized.triangles, 'tris', (metrics.optimized.bytes / 1024).toFixed(0), 'KB', metrics.withinBudget ? 'OK' : 'OVER');
	}
}
