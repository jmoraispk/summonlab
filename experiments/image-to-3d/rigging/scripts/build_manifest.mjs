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
const SAMPLE = { asha: ['Asha', 1.7, 'biped'], wolf: ['Gray Wolf', 0.85, 'quadruped'], hawk: ['Hunting Hawk', 0.6, 'avian'], armor: ['Iron armor set on mannequin', 1.8, 'biped'],
	golem: ['Clay Figure golem', 1.8, 'biped'], wenyn: ['Wenyn Amarun', 1.83, 'biped'], kelan: ['Kelan Grelan', 1.55, 'biped'] };
const steps = (await exists(HOSTED)) ? await readdir(HOSTED) : [];
// Batch subjects (rigging/batches/*.json) supply label, height and body plan for any API rig.
const batchSubjects = {};
for (const f of (await exists(path.join(RIG, 'batches'))) ? await readdir(path.join(RIG, 'batches')) : []) {
	if (!f.endsWith('.json')) continue;
	for (const sub of JSON.parse(await readFile(path.join(RIG, 'batches', f), 'utf8')).subjects) if (!sub.done) batchSubjects[sub.id] = sub;
}
for (const step of steps.sort()) {
	const m = step.match(/^(.+?)-(neutral|original|set)--rig-(\w+)$/);
	if (!m || !(await hostedOk(step))) continue;
	const [, name, arm, rigType] = m;
	const b = batchSubjects[name];
	if (!SAMPLE[name] && !b) continue;
	const [label, height] = SAMPLE[name] ?? [b.label, b.height];
	// Own preset clips only (<id>--anim-<n>); other clip sets (v1.0 combat) are attached as borrowed files.
	const clipFiles = rigType === 'others' ? [] : steps.filter((x) => new RegExp(`^${name}-${arm}--anim-\\d+$`).test(x)).sort().map((x) => hosted(x));
	const o = overrides[`${name}-${arm}${rigType === 'others' ? '-others' : ''}`] ?? {};
	const src = arm === 'neutral' ? hosted(`${name}-${arm}--image`, 'generated_image_url.png') : `../work/sample/${name}__source.png`;
	entries.push({ batch: b ? 'starting-set' : 'sample', kind2: b?.kind ?? null, id: `api/${name}-${arm}${rigType === 'others' && SAMPLE[name] ? '-others' : ''}`, label: `API · ${label} (${arm === 'neutral' ? 'neutral-pose image' : arm === 'set' ? 'set' : 'original art'}, ${rigType})`,
		tool: 'tripo-api', subject: name, kind: rigType, height: o.height ?? height, facing: o.facing ?? 0, rigged: hosted(step), clips: {}, clipFiles,
		source: o.source ?? src, removeIslands: o.removeIslands ?? false, weapons: rigType === 'biped' ? await weapons(name) : {} });
}
// Clip sharing: humanoid rigs playing Asha's Tripo clips (rotations only, root scaled at load).
const ashaClips = entries.find((e) => e.id === 'api/asha-neutral')?.clipFiles;
for (const id of ['api/golem-neutral', 'api/wenyn-neutral', 'api/kelan-neutral']) {
	const e = entries.find((x) => x.id === id);
	if (ashaClips && e) entries.push({ ...e, id: `share/${id.split('/')[1]}-asha-clips`, label: `Clip sharing · ${e.label.replace('API · ', '')} playing Asha's clips`, clipFiles: ashaClips });
}
// v1.0 combat clips (chop, punch, kick, hit to head, defeat): on their own v1.0 rig, and borrowed by v3.0 rigs.
const combat = (await hostedOk('asha-neutral--anim-v1-combat')) ? [hosted('asha-neutral--anim-v1-combat')] : null;
if (combat) {
	const asha = entries.find((e) => e.id === 'api/asha-neutral');
	entries.push({ ...asha, id: 'api/asha-neutral-v1', label: 'API · Asha, v1.0 rig (combat presets)', rigged: hosted('asha-neutral--rig-v1-mixamo'), clipFiles: combat, weapons: {} });
	for (const id of ['api/asha-neutral', 'api/wenyn-neutral', 'api/kelan-neutral', 'api/golem-neutral', 'api/goblin-runt-neutral', 'api/orc-grunt-neutral']) {
		const e = entries.find((x) => x.id === id);
		if (e) entries.push({ ...e, id: `combat/${id.split('/')[1]}`, label: `Combat clips · ${e.label.replace('API · ', '')}`, clipFiles: [...(e.clipFiles ?? []), ...combat], clipsForeign: false, combatFiles: combat });
	}
}
await writeFile(path.join(RIG, 'manifest.json'), JSON.stringify({ entries }, null, 2));
console.log(`manifest: ${entries.length} entries`, entries.map((e) => e.id).join(', '));
