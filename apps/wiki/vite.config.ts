import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';

const catalog = JSON.parse(
	readFileSync(new URL('../../docs/wiki/catalog.json', import.meta.url), 'utf8')
);
const visualIndex = JSON.parse(
	readFileSync(
		new URL('../../docs/wiki/creatures/monsters/visual-index.json', import.meta.url),
		'utf8'
	)
);
const routes = catalog.entries.map((entry: { path: string }) => {
	const path = entry.path
		.replace(/^docs\/wiki\//, '')
		.replace(/\.md$/, '')
		.replace(/\/README$/, '');
	return path === 'README' ? '/wiki' : `/wiki/${path}`;
});
const legacyRoutes = visualIndex.legacyRoutes.map(
	(entry: { currentClassId: string }) => `/wiki/creatures/monsters/${entry.currentClassId}`
);

export default defineConfig({
	define: { 'import.meta.env.VITE_WIKI_STATIC': JSON.stringify('true') },
	plugins: [
		sveltekit({
			adapter: adapter({ strict: true }),
			files: { lib: '../web/src/lib' },
			paths: { base: '/summonlab', relative: false },
			prerender: {
				entries: [...new Set(['/', '/wiki/heroes', ...routes, ...legacyRoutes])],
				crawl: false
			},
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			}
		})
	],
	resolve: { alias: { $lib: fileURLToPath(new URL('../web/src/lib', import.meta.url)) } }
});
