import {
	buildWikiSkillVisualCatalog,
	checkWikiSkillVisualCatalog,
	writeWikiSkillVisualCatalog
} from './wiki-skill-visual-catalog-lib.js';

const mode = process.argv.at(-1);
if (mode !== '--write' && mode !== '--check') {
	throw new Error('Usage: tsx tools/export-wiki-skill-visual-catalog.ts --write|--check');
}
const built = await buildWikiSkillVisualCatalog();
if (mode === '--write') await writeWikiSkillVisualCatalog(built);
else await checkWikiSkillVisualCatalog(built);
