import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(directory, '../../apps/web/package.json'));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage({
		viewport: { width: 1400, height: 1200 },
		deviceScaleFactor: 1
	});
	await page.goto(pathToFileURL(resolve(directory, 'gallery.html')).href);
	await page.evaluate(async () => {
		await globalThis.document.fonts.ready;
		await Promise.all([...globalThis.document.images].map((image) => image.decode()));
	});
	const provenancePath = resolve(directory, 'provenance.json');
	const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
	provenance.htmlSourceSha256 = createHash('sha256')
		.update(await readFile(resolve(directory, 'gallery.html')))
		.digest('hex');
	provenance.captureScript = 'docs/readme-gallery/capture.mjs';
	provenance.captureScriptSha256 = createHash('sha256')
		.update(await readFile(fileURLToPath(import.meta.url)))
		.digest('hex');
	for (const output of provenance.outputs) {
		const path = resolve(directory, `${output.sectionId}.jpg`);
		const section = page.locator(`#${output.sectionId}`);
		const buffer = await section.screenshot({ path, type: 'jpeg', quality: 90 });
		const box = await section.boundingBox();
		output.sha256 = createHash('sha256').update(buffer).digest('hex');
		output.bytes = buffer.length;
		output.width = Math.round(box.width);
		output.height = Math.round(box.height);
		process.stdout.write(
			`${output.sectionId}: ${output.width} × ${output.height}, ${output.bytes} bytes\n`
		);
	}
	await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
} finally {
	await browser.close();
}
