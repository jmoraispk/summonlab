// Minimal static server for viewer.html. Binds 0.0.0.0 so the collaborator can reach it over the LAN.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REPO = path.resolve(ROOT, '..', '..');
const PORT = Number(process.env.PORT ?? 5180);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
	'.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };

createServer(async (req, res) => {
	const url = new URL(req.url, 'http://x');
	let rel = decodeURIComponent(url.pathname);
	if (rel === '/') rel = '/viewer.html';
	// /repo/... serves read-only source art from the repository root.
	const base = rel.startsWith('/repo/') ? REPO : ROOT;
	const file = path.join(base, rel.replace(/^\/repo\//, '/'));
	if (!file.startsWith(base)) return res.writeHead(403).end();
	try {
		if (!(await stat(file)).isFile()) throw new Error();
		res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
		res.end(await readFile(file));
	} catch {
		res.writeHead(404).end('not found');
	}
}).listen(PORT, '0.0.0.0', () => console.log(`viewer on http://0.0.0.0:${PORT}/viewer.html`));
