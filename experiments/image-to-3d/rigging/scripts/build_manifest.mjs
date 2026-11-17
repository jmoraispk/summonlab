// Build rigging/manifest.json for engine.html from rigging/tripo-exports/<subject>__<stage>.glb
// plus Experiment 1's local Blender rigs as baselines.
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const RIG = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXPORTS = path.join(RIG, 'tripo-exports');
const exists = (p) => stat(p).then(() => true, () => false);
const overrides = JSON.parse(await readFile(path.join(RIG, 'subjects.json'), 'utf8'));
const CLIPS = ['idle', 'walk', 'run', 'attack', 'hit', 'death'];

const files = (await exists(EXPORTS)) ? await readdir(EXPORTS) : [];
const bySubject = {};
for (const f of files) {
	const m = f.match(/^(.+?)__(.+)\.(glb|gltf|fbx)$/);
	if (m) (bySubject[m[1]] ??= {})[m[2]] = `tripo-exports/${f}`;
}

const HOSTED = path.join(RIG, '../work/hosted/tripo');
const hosted = (step, file = 'model_url.glb') => `../work/hosted/tripo/${step}/${file}`;
const hostedOk = async (step) => exists(path.join(HOSTED, step, 'model_url.glb'));

const weapons = async (subject) => {
	const w = {};
	if (await hostedOk('sword--model')) w['sword (Tripo)'] = { file: hosted('sword--model'), mode: 'grip', length: 0.55, hold: 0.08, tip: '-y' };
	if (await hostedOk('shield--model')) w['shield (Tripo, left forearm)'] = { file: hosted('shield--model'), mode: 'forearm', side: 'l', length: 0.42 };
	if (await hostedOk('helmet--model')) w['helmet (Tripo)'] = { file: hosted('helmet--model'), mode: 'head' };
	if (bySubject.spear?.mesh) w['spear (generated)'] = { file: bySubject.spear.mesh, mode: 'grip', length: 0.95 };
	if (subject === 'goblin-crouched' && bySubject['goblin-crouched']?.['spear-part'])
		w['spear (segmented part, in place)'] = { file: bySubject['goblin-crouched']['spear-part'], mode: 'inplace' };
	w['iron shield (Exp. 1, left forearm)'] = { file: '../work/models/hunyuan3d/iron-shield/optimized.glb', mode: 'forearm', side: 'l', length: 0.42 };
	return w;
};

const entries = [];
for (const [subject, stages] of Object.entries(bySubject)) {
	const rigged = stages.clips ?? stages.rigged;
	if (!rigged) continue;
	const o = overrides[subject] ?? {};
	const clips = Object.fromEntries(CLIPS.filter((c) => stages[c]).map((c) => [c, stages[c]]));
	entries.push({ id: `tripo/${subject}`, label: `Tripo · ${o.label ?? subject}`, tool: 'tripo', subject, kind: o.kind ?? 'biped',
		height: o.height ?? 1.0, facing: o.facing ?? 0, rigged, clips, mesh: stages.mesh ?? null,
		source: o.source ?? null, weapons: await weapons(subject) });
}
// Experiment 1 baselines (Hunyuan3D-2 mesh + Blender landmark rig).
for (const [id, label, height] of [['golem-clay-figure', 'Clay Figure', 1.8], ['goblin-runt', 'Goblin Runt (crouched)', 1.0]]) {
	const file = `../work/models/hunyuan3d/${id}/rigged.glb`;
	if (!(await exists(path.join(RIG, file)))) continue;
	entries.push({ id: `local/${id}`, label: `Local baseline · ${label}`, tool: 'local', subject: id, kind: 'biped', height, facing: 0,
		rigged: file, clips: {}, source: `../previews/sources/${id}.webp`, weapons: await weapons(id) });
}
// Your Tripo Studio rigs (Mixamo skeleton, no clips).
for (const [id, file, label, height] of [['goblin', 'goblin_warrior_3d_model_rigged.glb', 'Goblin (crouched art, humanoid)', 1.0],
	['golem', 'clay_gollem_guardian_3d_model_rigged.glb', 'Clay Guardian (T-pose image)', 1.8]]) {
	if (!(await exists(path.join(EXPORTS, 'studio', file)))) continue;
	const o = overrides[`studio-${id}`] ?? {};
	entries.unshift({ id: `studio/${id}`, label: `Studio · ${label}`, tool: 'tripo-studio', subject: id, kind: 'biped', height, facing: o.facing ?? 0,
		rigged: `tripo-exports/studio/${file}`, clips: {}, source: o.source ?? null, weapons: await weapons(id) });
}
// Experiment 2b API sample: <name>-<arm>--rig-<type>, clips from <name>-<arm>--anim-<i> (several clips per file).
const SAMPLE = { asha: ['Asha', 1.7, 'biped'], wolf: ['Gray Wolf', 0.85, 'quadruped'], hawk: ['Hunting Hawk', 0.6, 'avian'], armor: ['Iron armor set on mannequin', 1.8, 'biped'] };
const steps = (await exists(HOSTED)) ? await readdir(HOSTED) : [];
for (const step of steps.sort()) {
	const m = step.match(/^(asha|wolf|hawk|armor)-(neutral|original|set)--rig-(\w+)$/);
	if (!m || !(await hostedOk(step))) continue;
	const [, name, arm, rigType] = m;
	const [label, height] = SAMPLE[name];
	const clipFiles = steps.filter((x) => x.startsWith(`${name}-${arm}--anim-`)).sort().map((x) => hosted(x));
	const o = overrides[`${name}-${arm}`] ?? {};
	const src = arm === 'neutral' ? hosted(`${name}-${arm}--image`, 'generated_image_url.png') : `../work/sample/${name}__source.png`;
	entries.push({ id: `api/${name}-${arm}`, label: `API · ${label} (${arm === 'neutral' ? 'neutral-pose image' : arm === 'set' ? 'set' : 'original art'}, ${rigType})`,
		tool: 'tripo-api', subject: name, kind: rigType, height: o.height ?? height, facing: o.facing ?? 0, rigged: hosted(step), clips: {}, clipFiles,
		source: o.source ?? src, weapons: rigType === 'biped' ? await weapons(name) : {} });
}
await writeFile(path.join(RIG, 'manifest.json'), JSON.stringify({ entries }, null, 2));
console.log(`manifest: ${entries.length} entries`, entries.map((e) => e.id).join(', '));
