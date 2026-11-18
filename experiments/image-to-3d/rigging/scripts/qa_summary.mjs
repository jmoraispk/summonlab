// QA summary for a batch: gates per subject from the batch run, bench results and budget, plus overview
// sheets. node rigging/scripts/qa_summary.mjs rigging/batches/starting-set.json
// Writes rigging/results/qa-<name>.json, rigging/results/qa-<name>.md, previews/sample/<name>-creatures.webp
// and previews/sample/<name>-equipment.webp.
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RIG = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXP = path.resolve(RIG, '..');
const exists = (p) => stat(p).then(() => true, () => false);
const batch = JSON.parse(await readFile(process.argv[2], 'utf8'));
const run = JSON.parse(await readFile(path.join(RIG, 'results', `batch-${batch.name}.json`), 'utf8').catch(() => '{"subjects":{}}'));
const budget = JSON.parse(await readFile(path.join(RIG, 'results', 'budget.json'), 'utf8').catch(() => '[]'));
const subjectsCfg = JSON.parse(await readFile(path.join(RIG, 'subjects.json'), 'utf8'));
const MINOR = /finger|thumb|index|middle|ring|pinky|toe|end/i;
const BIPED_REGIONS = 19;

const rows = [];
for (const s of batch.subjects.filter((x) => !x.done)) {
	const r = run.subjects[s.id] ?? {};
	const row = { id: s.id, kind: s.kind, label: s.label, body: s.body, gates: {}, notes: [] };
	const flag = (gate, ok, note) => { row.gates[gate] = ok; if (!ok && note) row.notes.push(note); };
	if (s.kind === 'equipment') {
		flag('model', r.model === 'ok' || (await exists(path.join(EXP, 'work/hosted/tripo', `${s.id}--model`, 'model_url.glb'))), r.error ?? 'no model');
		const b = budget.find((x) => x.name === `${s.id}--model`);
		if (b) flag('budget', b.withinBudget, `${b.optimized.triangles} tris, ${Math.round(b.optimized.bytes / 1024)} KB`);
		row.render = `work/hosted/tripo/${s.id}--model/rendered_image_url.webp`;
		rows.push(row);
		continue;
	}
	if (r.error) { flag('generated', false, r.error.slice(0, 120)); rows.push(row); continue; }
	flag('riggable', r.rig !== 'not riggable', 'rig-check: not riggable');
	const slug = `api-${s.id}-neutral`;
	const res = JSON.parse(await readFile(path.join(RIG, 'results', `${slug}.json`), 'utf8').catch(() => 'null'));
	if (!res) { if (r.rig === 'ok') row.notes.push('bench not run'); rows.push(row); continue; }
	// Head flagged at >=80% outside: Mixamo's head end sits on the skull top, so a correct head reads ~40%
	// (Asha, checked visually); the golem's misplaced head reads 100%. Other bones at >=60%. Ground-level
	// roots and unnamed extra bones (bone_N) are ignored.
	const frac = Object.entries(res.rigCheck?.outsideFraction ?? {}).filter(([b]) => !MINOR.test(b) && !/Root$|bone_\d+$/.test(b));
	const out = frac.filter(([b, v]) => v >= (/Head$/.test(b) ? 0.8 : 0.6)).map(([b]) => b);
	const majors = frac.length || 1;
	if (out.length / majors > 0.3) row.notes.push(`${out.length} bones read as outside: thin geometry, check visually`);
	else flag('bones', out.length === 0, `bones outside mesh: ${out.join(', ')}`);
	if (s.body === 'biped') {
		const h = res.hitRegions ?? {};
		const filled = Object.values(h).filter((v) => v.vertices).length;
		const pur = Object.entries(h).filter(([, v]) => v.purity != null).sort((a, b) => a[1].purity - b[1].purity)[0];
		flag('hits', filled >= BIPED_REGIONS - 2 && (pur?.[1].purity ?? 0) >= 0.6, `hit regions ${filled}/19, lowest ${pur?.[0]} ${Math.round((pur?.[1].purity ?? 0) * 100)}%`);
	}
	const peaks = Object.values(res.deformation ?? {}).filter(Boolean).map((d) => [d.clip, d.peak.all ?? 0]);
	if (peaks.length) {
		const [clip, worst] = peaks.sort((a, b) => b[1] - a[1])[0];
		row.worstStretch = `${clip} ${Math.round(worst * 100)}%`;
		flag('deformation', worst <= 2.0, `worst-1% stretch ${Math.round(worst * 100)}% (${clip})`);
	} else row.notes.push('no clips (none available for this body plan)');
	const st = res.ragdoll?.stats?.at(-1);
	if (st) flag('ragdoll', st.maxJointSeparation === 0 && st.maxSpeed < 1.0, `ragdoll end speed ${st.maxSpeed} m/s`);
	const b = budget.filter((x) => x.name.startsWith(`${s.id}-neutral--`));
	if (b.length) flag('budget', b.every((x) => x.withinBudget), 'over budget');
	// Floating pieces far from the body need a human: artifact (removeIslands) or costume part (keepIslands).
	const flaggedIslands = (res.cleanup?.floatingIslands ?? []).filter((x) => x.flagged);
	const review = subjectsCfg[`${s.id}-neutral`] ?? {};
	if (flaggedIslands.length) flag('islands', Boolean(review.removeIslands || review.keepIslands), `${flaggedIslands.length} floating pieces to review`);
	if (flaggedIslands.length && review._review) row.notes.push(`islands reviewed: ${review.removeIslands ? 'removed' : 'kept'}`);
	row.qa = `rigging/previews/${slug}/qa.webp`;
	rows.push(row);
}
const pass = (r) => Object.values(r.gates).every(Boolean);
const md = [`# QA: ${batch.name}`, '', `${rows.filter(pass).length} of ${rows.length} subjects pass every gate. Gates: generated, riggable,`,
	'bones inside mesh, hit regions (bipeds: ≥17/19 filled, lowest purity ≥60%), worst-1% stretch ≤200%, ragdoll settles',
	'floating pieces ≥4% of height away reviewed (removed as artifacts or kept as costume parts),',
	'(<1 m/s at 2.5 s, no separation), budget (creatures ≤15k tris and 2 MB; props ≤3k tris and 300 KB).', '',
	'| Subject | Kind | Body | Result | Worst clip | Notes |', '| --- | --- | --- | --- | --- | --- |',
	...rows.map((r) => `| ${r.label ?? r.id} | ${r.kind} | ${r.body} | ${pass(r) ? 'pass' : 'FLAG: ' + Object.entries(r.gates).filter(([, v]) => !v).map(([k]) => k).join(', ')} | ${r.worstStretch ?? ''} | ${r.notes.join('; ')} |`), ''];
await writeFile(path.join(RIG, 'results', `qa-${batch.name}.md`), md.join('\n'));
await writeFile(path.join(RIG, 'results', `qa-${batch.name}.json`), JSON.stringify(rows, null, 1));

// Overview sheets: first frame of each creature's QA sheet; Tripo's render of each equipment piece.
async function grid(items, file, cols, w, h) {
	const tiles = [];
	for (const [i, it] of items.entries()) {
		let img;
		try { img = await sharp(it.file).extract(it.crop ?? { left: 0, top: 0, width: (await sharp(it.file).metadata()).width, height: (await sharp(it.file).metadata()).height }).resize(w, h, { fit: 'contain', background: '#6f747a' }).flatten({ background: '#6f747a' }).png().toBuffer(); }
		catch { img = await sharp({ create: { width: w, height: h, channels: 3, background: '#40444a' } }).png().toBuffer(); }
		const label = it.label.replace(/&/g, '&amp;').replace(/</g, '&lt;');
		const color = it.ok ? '#000' : '#8a1c1c';
		const svg = Buffer.from(`<svg width="${w}" height="22"><rect width="${w}" height="22" fill="${color}" opacity="0.75"/><text x="5" y="16" font-size="13" fill="#fff" font-family="sans-serif">${label}</text></svg>`);
		tiles.push({ input: await sharp(img).composite([{ input: svg, top: h - 22, left: 0 }]).png().toBuffer(), left: (i % cols) * w, top: Math.floor(i / cols) * h });
	}
	if (!tiles.length) return;
	await sharp({ create: { width: cols * w, height: Math.ceil(items.length / cols) * h, channels: 3, background: '#222' } }).composite(tiles).webp({ quality: 74 }).toFile(file);
}
const creatures = [];
for (const r of rows.filter((x) => x.kind !== 'equipment')) {
	const f = path.join(EXP, r.qa ?? 'missing');
	const meta = await sharp(f).metadata().catch(() => null);
	creatures.push({ file: meta ? f : 'missing', crop: meta ? { left: 0, top: 0, width: Math.round(meta.width / Math.max(1, Math.round(meta.width / meta.height * 440 / 360))), height: meta.height } : null, label: `${r.label}${pass(r) ? '' : ' · ' + Object.entries(r.gates).filter(([, v]) => !v).map(([k]) => k).join(', ')}`, ok: pass(r) });
}
await grid(creatures, path.join(RIG, 'previews/sample', `${batch.name}-creatures.webp`), 6, 220, 270);
await grid(rows.filter((x) => x.kind === 'equipment').map((r) => ({ file: path.join(EXP, r.render), label: r.label, ok: pass(r) })),
	path.join(RIG, 'previews/sample', `${batch.name}-equipment.webp`), 10, 150, 170);
console.log(md.slice(0, 3).join('\n'));
