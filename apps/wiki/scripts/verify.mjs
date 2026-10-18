import { access, lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../build/', import.meta.url));
const base = '/summonlab';
const pages = [];
let bytes = 0;
async function walk(path) {
	for (const entry of await readdir(path, { withFileTypes: true })) {
		const file = join(path, entry.name);
		if (entry.isSymbolicLink()) throw new Error(`Pages artifact contains a symbolic link: ${file}`);
		if (entry.isDirectory()) await walk(file);
		else {
			bytes += (await lstat(file)).size;
			if (entry.name.endsWith('.html')) pages.push(file);
		}
	}
}
await walk(output);
if (bytes >= 1_000_000_000) throw new Error('Wiki exceeds the GitHub Pages 1 GB size limit');
const failures = [];
for (const page of pages) {
	const html = await readFile(page, 'utf8');
	for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/gu)) {
		const pathname = new URL(match[1].replaceAll('&amp;', '&'), 'https://jmoraispk.github.io')
			.pathname;
		if (!pathname.startsWith(`${base}/`) && pathname !== base) {
			failures.push(`${page}: URL leaves the project base: ${pathname}`);
			continue;
		}
		const target = join(output, decodeURIComponent(pathname.slice(base.length)));
		try {
			if ((await lstat(target)).isDirectory()) await access(join(target, 'index.html'));
		} catch {
			failures.push(`${page}: missing target: ${pathname}`);
		}
	}
}
for (const forbidden of ['api', 'village', 'play', 'tower-combat', 'living-village-lab']) {
	try {
		await access(join(output, forbidden));
		throw new Error(`Game route unexpectedly published: ${forbidden}`);
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
}
if (failures.length) throw new Error(failures.slice(0, 30).join('\n'));
console.log(
	`Verified ${pages.length} static pages, local links/images, no game endpoints, and ${(bytes / 1_000_000).toFixed(1)} MB of published files.`
);
