import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJsonSha256V2 } from './equipment-image-profile-acceptance-v2.js';

const root = process.cwd();
const profilePath = path.join(
	root,
	'assets/equipment/experiments/material-equipment-v2/visual-profile/profile.json'
);
const planPath = path.join(
	root,
	'assets/equipment/experiments/material-equipment-v2/runs/material-equipment-v2-run-001/plan.json'
);
const profile = JSON.parse(await readFile(profilePath, 'utf8')) as unknown;
const plan = JSON.parse(await readFile(planPath, 'utf8')) as {
	boundArtifacts: { profileCanonicalSha256: string };
};
plan.boundArtifacts.profileCanonicalSha256 = canonicalJsonSha256V2(profile);
await writeFile(planPath, `${JSON.stringify(plan, null, '\t')}\n`, 'utf8');
