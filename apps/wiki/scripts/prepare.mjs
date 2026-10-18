import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const routes = join(app, 'src/routes');
const assets = join(app, 'static');
await rm(routes, { recursive: true, force: true });
await rm(assets, { recursive: true, force: true });
await mkdir(routes, { recursive: true });
await cp(join(app, 'templates'), routes, { recursive: true });
await cp(join(root, 'apps/web/src/routes/wiki'), join(routes, 'wiki'), {
	recursive: true,
	filter: (path) => !path.endsWith('.e2e.ts')
});
for (const folder of ['hero-archive', 'wiki-media', 'runtime/equipment-v1']) {
	await cp(join(root, 'apps/web/static', folder), join(assets, folder), { recursive: true });
}
const monsters = JSON.parse(
	await readFile(join(root, 'assets/enemies/runtime/monster-wiki-v1/catalog.json'), 'utf8')
);
for (const record of monsters.records) {
	const path = record.runtime.path.replace(/^apps\/web\/static\//, '');
	if (path === record.runtime.path || path.includes('..'))
		throw new Error('Invalid monster export path');
	await mkdir(dirname(join(assets, path)), { recursive: true });
	await cp(join(root, record.runtime.path), join(assets, path));
}
await writeFile(join(assets, '.nojekyll'), '');
console.log(
	'Prepared wiki routes and gallery assets; game routes and server endpoints are excluded.'
);
