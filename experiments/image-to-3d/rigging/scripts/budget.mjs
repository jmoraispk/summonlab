// Budget pass for Experiment 2b outputs: the Experiment 1 optimizer recipe (weld, meshopt simplify to the
// triangle budget, WebP textures at the budget size, quantize, meshopt compression; animations resampled)
// applied to every rigged / animated / prop GLB from the Tripo API sample and the Studio rigs.
// Writes work/optimized/<name>.glb and rigging/results/budget.json.
import { readdir, stat, writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, textureCompress, quantize, meshopt, resample, compactPrimitive } from '@gltf-transform/functions';

const compactPrimitives = () => (doc) => { for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) compactPrimitive(p); };
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const RIG = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXP = path.resolve(RIG, '..');
const HOSTED = path.join(EXP, 'work/hosted/tripo');
const OUT = path.join(EXP, 'work/optimized');
const BUDGET = { creature: { tris: 15000, bytes: 2 * 1024 * 1024, tex: 1024 }, prop: { tris: 3000, bytes: 300 * 1024, tex: 512 } };

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const tris = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
	.reduce((s, p) => s + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);

async function measure(file) {
	const doc = await io.read(file);
	return {
		triangles: tris(doc), bytes: (await stat(file)).size, joints: doc.getRoot().listSkins()[0]?.listJoints().length ?? 0,
		clips: doc.getRoot().listAnimations().map((a) => a.getName()),
		textures: doc.getRoot().listTextures().map((t) => `${t.getName().split('_')[0]} ${t.getSize()?.join('x')} ${t.getMimeType().split('/')[1]}`)
	};
}

async function optimize(src, out, budget) {
	const doc = await io.read(src);
	await doc.transform(dedup(), weld());
	let ratio = Math.min(1, budget.tris / tris(doc));
	// meshoptimizer stops early at UV seams; keep tightening ratio and error until under budget.
	for (let i = 0; i < 12 && tris(doc) > budget.tris; i++) {
		await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: Math.min(0.02 * (i + 1), 0.15), lockBorder: false }));
		ratio *= 0.8;
	}
	// Last resort when seams still block the budget (the helmet stalled at 3,519): sloppy simplification
	// ignores topology, so it only trims the final few percent.
	const total = tris(doc);
	if (total > budget.tris) {
		for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
			const idx = prim.getIndices(), pos = prim.getAttribute('POSITION');
			if (!idx || prim.listTargets().length) continue;
			const target = Math.floor((idx.getCount() * budget.tris) / total / 3) * 3;
			const [out] = MeshoptSimplifier.simplifySloppy(Uint32Array.from(idx.getArray()), Float32Array.from(pos.getArray()), 3, null, target, 0.05);
			idx.setArray(out);
		}
		await doc.transform(compactPrimitives());
	}
	await doc.transform(resample(), prune(),
		textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [budget.tex, budget.tex] }),
		quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
	await io.write(out, doc);
}

const jobs = [];
for (const step of (await readdir(HOSTED)).sort()) {
	const file = path.join(HOSTED, step, 'model_url.glb');
	if (!(await stat(file).then(() => true, () => false))) continue;
	if (/--(rig-|anim-)/.test(step) || /^(sword|shield|helmet)--model$/.test(step))
		jobs.push({ name: step, file, kind: /^(sword|shield|helmet)/.test(step) ? 'prop' : 'creature' });
}
for (const f of ['goblin_warrior_3d_model_rigged.glb', 'clay_gollem_guardian_3d_model_rigged.glb'])
	jobs.push({ name: `studio--${f.replace('.glb', '')}`, file: path.join(RIG, 'tripo-exports/studio', f), kind: 'creature' });

await mkdir(OUT, { recursive: true });
const report = [];
const only = process.argv.slice(2);
for (const j of jobs.filter((x) => !only.length || only.some((o) => x.name.includes(o)))) {
	const budget = BUDGET[j.kind];
	const out = path.join(OUT, `${j.name}.glb`);
	await optimize(j.file, out, budget);
	const raw = await measure(j.file), opt = await measure(out);
	const ok = opt.triangles <= budget.tris && opt.bytes <= budget.bytes;
	report.push({ name: j.name, kind: j.kind, budget, raw, optimized: opt, withinBudget: ok });
	console.log(j.name.padEnd(44), `${raw.triangles} tris ${(raw.bytes / 1048576).toFixed(1)} MB -> ${opt.triangles} tris ${(opt.bytes / 1024).toFixed(0)} KB`, ok ? 'OK' : 'OVER');
}
// Merge into the existing report so a filtered run does not drop other entries.
const prior = await readFile(path.join(RIG, 'results/budget.json'), 'utf8').then(JSON.parse, () => []);
const merged = [...prior.filter((r) => !report.some((x) => x.name === r.name)), ...report].sort((a, b) => a.name.localeCompare(b.name));
await writeFile(path.join(RIG, 'results/budget.json'), JSON.stringify(merged, null, 2));
