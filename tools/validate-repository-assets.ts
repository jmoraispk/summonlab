import { resolve } from 'node:path';

import { validateRepositoryAssets } from './repository-asset-policy.js';

const summary = await validateRepositoryAssets(resolve(import.meta.dirname, '..'));
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
