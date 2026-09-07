import {
	checkCanonicalSkillAssets,
	writeCanonicalSkillAssets
} from './skill-icon-canonical-assets.js';

const mode = process.argv.at(-1);
if (mode === '--write') await writeCanonicalSkillAssets();
else if (mode === '--check') await checkCanonicalSkillAssets();
else throw new Error('Usage: tsx tools/export-skill-icon-canonical-assets.ts --write|--check');
