import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
	options: {
		host: { type: 'string', default: '0.0.0.0' },
		port: { type: 'string', default: '5189' }
	}
});
const output = fileURLToPath(new URL('../build/', import.meta.url));
const base = '/summonlab';
const types = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.webp': 'image/webp',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon'
};

createServer(async (request, response) => {
	try {
		if (!['GET', 'HEAD'].includes(request.method)) {
			response.writeHead(405).end();
			return;
		}
		const url = new URL(request.url, 'http://preview.invalid');
		if (url.pathname === base) {
			response.writeHead(301, { location: `${base}/${url.search}` }).end();
			return;
		}
		if (!url.pathname.startsWith(`${base}/`)) {
			response.writeHead(404).end();
			return;
		}
		let file = resolve(output, `.${decodeURIComponent(url.pathname.slice(base.length))}`);
		if (relative(output, file).startsWith('..')) {
			response.writeHead(404).end();
			return;
		}
		if ((await stat(file)).isDirectory()) {
			if (!url.pathname.endsWith('/')) {
				response.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
				return;
			}
			file = resolve(file, 'index.html');
		}
		const body = await readFile(file);
		response.writeHead(200, {
			'content-type': types[extname(file)] ?? 'application/octet-stream',
			'cache-control': 'no-store'
		});
		response.end(request.method === 'HEAD' ? undefined : body);
	} catch {
		response.writeHead(404).end();
	}
}).listen(Number(values.port), values.host, () =>
	console.log(`Static wiki preview listening on ${values.host}:${values.port}${base}/wiki/`)
);
