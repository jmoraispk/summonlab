import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const workspaceRoot = process.cwd();
const host = process.env.EQUIPMENT_REVIEW_HOST ?? '0.0.0.0';
const port = Number(process.env.EQUIPMENT_REVIEW_PORT ?? '4176');
const types: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.json': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8'
};

const server = createServer(async (request, response) => {
	try {
		const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
		const relative =
			pathname === '/'
				? 'assets/equipment/experiments/material-equipment-v3/reviews/checkpoint-1/index.html'
				: pathname.slice(1);
		const absolute = path.resolve(workspaceRoot, relative);
		if (!absolute.startsWith(`${workspaceRoot}${path.sep}`))
			throw new Error('Path escapes workspace');
		const info = await stat(absolute);
		if (!info.isFile()) throw new Error('Not a file');
		response.writeHead(200, {
			'content-type': types[path.extname(absolute)] ?? 'application/octet-stream',
			'cache-control': 'no-store'
		});
		createReadStream(absolute).pipe(response);
	} catch {
		response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
		response.end('Not found');
	}
});

server.listen(port, host, () =>
	process.stdout.write(`Equipment review server listening on http://${host}:${port}\n`)
);
