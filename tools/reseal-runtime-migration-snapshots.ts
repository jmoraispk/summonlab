import { spawnSync } from 'node:child_process';

const result = spawnSync(
	'pnpm',
	[
		'exec',
		'vitest',
		'run',
		'packages/engine/src/compatibility/replay-vectors.spec.ts',
		'packages/engine/src/domains/mission/mission-runtime.spec.ts',
		'-u'
	],
	{ cwd: process.cwd(), encoding: 'utf8' }
);

if (result.status !== 0) {
	throw new Error(
		`Runtime migration snapshot resealing failed:\n${result.stdout ?? ''}${result.stderr ?? ''}`
	);
}
