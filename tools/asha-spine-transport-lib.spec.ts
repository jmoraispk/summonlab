import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import {
	buildTransportImage,
	buildTransportImport,
	defaultTransportPreflightIO,
	extractedPixelHash,
	loadTransportManifest,
	normalizeRuntimeArtifacts,
	preflightTransport,
	redactSpineOutput,
	resolveSpineCli,
	resolveTransportPaths,
	spineTransportCommands,
	validateTransportExport
} from './asha-spine-transport-lib.js';

const manifestPath = 'assets/heroes/visuals/spine-exploration-canary-v1/transport/manifest.json';

describe('Asha Spine transport preflight', () => {
	it('pins the owned sources and 4.3 toolchain', async () => {
		const manifest = await loadTransportManifest(manifestPath);
		expect(manifest).toMatchObject({
			schemaVersion: 'asha-spine-transport-v1',
			editorVersion: '4.3.26',
			runtimeVersion: '4.3.13',
			pixiVersion: '8.20.0',
			direction: 'up-field',
			mirrored: false,
			animation: { name: 'idle_transport_probe', durationSeconds: 1 }
		});
	});

	it('rejects a changed authority hash before checking output collisions', async () => {
		const exists = vi.fn(defaultTransportPreflightIO.exists);
		await expect(
			preflightTransport(
				{
					...(await loadTransportManifest(manifestPath)),
					acceptedCutoutSha256: '0'.repeat(64)
				},
				process.cwd(),
				'write',
				{ ...defaultTransportPreflightIO, exists }
			)
		).rejects.toThrow('accepted transport cutout hash mismatch');
		expect(exists).not.toHaveBeenCalled();
	});

	it('rejects an existing owned output in write mode', async () => {
		const manifest = await loadTransportManifest(manifestPath);
		const occupied = resolve(process.cwd(), manifest.outputs.image);
		const exists = vi.fn(async (path: string) => path === occupied);
		await expect(
			preflightTransport(manifest, process.cwd(), 'write', {
				...defaultTransportPreflightIO,
				exists
			})
		).rejects.toThrow('owned output already exists');
	});
});

describe('Asha Spine transport generation', () => {
	it('pads the approved cutout without changing a source pixel', async () => {
		const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'asha-spine-transport-test.'));
		try {
			const manifest = await loadTransportManifest(manifestPath);
			const output = await buildTransportImage(manifest, process.cwd(), temporaryDirectory);
			expect(output).toMatchObject({ width: 1024, height: 1024, left: 128, top: 128 });
			expect(await extractedPixelHash(output.path, 128, 128, 768, 768)).toBe(
				await extractedPixelHash(resolve(process.cwd(), manifest.acceptedCutout), 0, 0, 768, 768)
			);
		} finally {
			await rm(temporaryDirectory, { recursive: true, force: true });
		}
	});

	it('creates a one-slot import with no root translation keys', async () => {
		const manifest = await loadTransportManifest(manifestPath);
		const data = buildTransportImport(manifest);
		expect(data.bones.map((bone) => bone.name)).toEqual(['root', 'body']);
		expect(data.slots).toEqual([{ name: 'body', bone: 'body', attachment: 'asha_transport' }]);
		expect(data.animations.idle_transport_probe.bones.root).toBeUndefined();
		expect(data.animations.idle_transport_probe.bones.body.rotate).toEqual([
			{ value: 0 },
			{ time: 0.5, value: 0.35 },
			{ time: 1, value: 0 }
		]);
	});

	it('pins every Spine invocation and suppresses license identity', async () => {
		const manifest = await loadTransportManifest(manifestPath);
		const paths = resolveTransportPaths(manifest, process.cwd());
		expect(spineTransportCommands('/workspace/Spine/Spine.sh', manifest, paths)).toEqual([
			expect.arrayContaining(['--hide-license', '--update', '4.3.26', '--import']),
			expect.arrayContaining(['--hide-license', '--update', '4.3.26', '--export', 'json+pack'])
		]);
	});

	it('redacts license identity from editor output', () => {
		expect(redactSpineOutput('Starting\nLicensed to: Private Name\nFinished\n')).toBe(
			'Starting\n[license identity redacted]\nFinished\n'
		);
	});

	it('rejects a Spine executable outside the workspace', () => {
		expect(() => resolveSpineCli('/workspace', '/outside/Spine.sh')).toThrow(
			'Spine CLI must be inside the workspace'
		);
	});
});

async function writeValidRuntimeFixture(directory: string): Promise<void> {
	await mkdir(directory, { recursive: true });
	await writeFile(
		join(directory, 'asha-transport-v1.json'),
		JSON.stringify({
			skeleton: { spine: '4.3.26' },
			bones: [{ name: 'root' }, { name: 'body', parent: 'root' }],
			slots: [{ name: 'body', bone: 'body', attachment: 'asha_transport' }],
			skins: [
				{
					name: 'default',
					attachments: {
						body: {
							asha_transport: {
								type: 'region',
								path: 'asha-transport-v1'
							}
						}
					}
				}
			],
			animations: {
				idle_transport_probe: {
					bones: {
						body: {
							rotate: [{ value: 0 }, { time: 0.5, value: 0.35 }, { time: 1, value: 0 }]
						}
					}
				}
			}
		})
	);
	await writeFile(
		join(directory, 'asha-transport-v1.atlas'),
		[
			'asha-transport-v1.png',
			'size: 1024, 1024',
			'format: RGBA8888',
			'filter: Linear, Linear',
			'repeat: none',
			'asha-transport-v1',
			'  rotate: false',
			'  xy: 0, 0',
			'  size: 1024, 1024',
			'  orig: 1024, 1024',
			'  offset: 0, 0',
			'  index: -1',
			''
		].join('\n')
	);
	await sharp({
		create: {
			width: 1024,
			height: 1024,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.png()
		.toFile(join(directory, 'asha-transport-v1.png'));
}

describe('Asha Spine transport export validation', () => {
	it('normalizes editor basenames and rewrites the atlas page', async () => {
		const directory = await mkdtemp(resolve(tmpdir(), 'asha-spine-normalize-test.'));
		try {
			await writeFile(join(directory, 'editor-name.json'), '{}');
			await writeFile(join(directory, 'editor-name.png'), 'png');
			await writeFile(
				join(directory, 'editor-name.atlas'),
				'editor-name.png\nsize: 1, 1\neditor-name\n  size: 1, 1\n'
			);
			await normalizeRuntimeArtifacts(directory);
			await expect(
				defaultTransportPreflightIO.readFile(join(directory, 'asha-transport-v1.atlas'), 'utf8')
			).resolves.toContain('asha-transport-v1.png');
			await expect(
				defaultTransportPreflightIO.readFile(join(directory, 'asha-transport-v1.atlas'), 'utf8')
			).resolves.toContain('\nasha-transport-v1\n');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('accepts exactly one semantically valid runtime triplet', async () => {
		const directory = await mkdtemp(resolve(tmpdir(), 'asha-spine-export-test.'));
		try {
			await writeValidRuntimeFixture(directory);
			await expect(validateTransportExport(directory)).resolves.toMatchObject({
				json: join(directory, 'asha-transport-v1.json'),
				atlas: join(directory, 'asha-transport-v1.atlas'),
				png: join(directory, 'asha-transport-v1.png'),
				animationDurationSeconds: 1
			});
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('rejects root motion even when the runtime triplet is otherwise valid', async () => {
		const directory = await mkdtemp(resolve(tmpdir(), 'asha-spine-export-test.'));
		try {
			await writeValidRuntimeFixture(directory);
			const jsonPath = join(directory, 'asha-transport-v1.json');
			const fixture = JSON.parse(await defaultTransportPreflightIO.readFile(jsonPath, 'utf8'));
			fixture.animations.idle_transport_probe.bones.root = {
				translate: [{ x: 1, y: 0 }]
			};
			await writeFile(jsonPath, JSON.stringify(fixture));
			await expect(validateTransportExport(directory)).rejects.toThrow(
				'root timeline is not allowed'
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
