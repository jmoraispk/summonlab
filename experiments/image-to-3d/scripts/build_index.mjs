// Scan work/models/<tool>/<subject>/ and write work/models/index.json for viewer.html.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const EXP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const subjects = JSON.parse(await readFile(path.join(EXP, 'subjects.json'), 'utf8'));
const TOOL_LABELS = { trellis: 'TRELLIS (local)', hunyuan3d: 'Hunyuan3D-2 (local)' };
const exists = (p) => stat(p).then(() => true, () => false);
const readJson = async (p) => (await exists(p)) ? JSON.parse(await readFile(p, 'utf8')) : null;

const models = [];
const dir = path.join(EXP, 'work', 'models');
for (const s of subjects) {
	for (const tool of (await readdir(dir)).sort()) {
		const d = path.join(dir, tool, s.id);
		if (!(await exists(path.join(d, 'raw.glb')))) continue;
		const rel = (f) => path.relative(EXP, path.join(d, f));
		models.push({
			key: `${tool}/${s.id}`, tool, toolLabel: TOOL_LABELS[tool] ?? tool, subject: s.id, label: s.label, kind: s.kind,
			raw: rel('raw.glb'),
			optimized: (await exists(path.join(d, 'optimized.glb'))) ? rel('optimized.glb') : null,
			animated: (await exists(path.join(d, 'animated.glb'))) ? rel('animated.glb') : null,
			sourcePreview: `previews/sources/${s.id}.webp`,
			meta: await readJson(path.join(d, 'meta.json')),
			metrics: await readJson(path.join(d, 'metrics.json'))
		});
	}
}
await writeFile(path.join(dir, 'index.json'), JSON.stringify({ models }, null, 2));
console.log(`index: ${models.length} models`);
