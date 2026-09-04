import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
const validator = path.join(repositoryRoot, 'tools/validate-realtime-combat-motion-pack.mjs');
const tomaV2Manifest = path.join(
	repositoryRoot,
	'apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v2.json'
);

describe('realtime combat motion pack validator', () => {
	it('rejects Toma v2 because its advance frames contain a baked ground ellipse', () => {
		const result = spawnSync(
			process.execPath,
			[validator, tomaV2Manifest, '--max-advance-ground-artifact-pixels', '500'],
			{ encoding: 'utf8' }
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /advance frame .* ground artifact/i);
	});
});
