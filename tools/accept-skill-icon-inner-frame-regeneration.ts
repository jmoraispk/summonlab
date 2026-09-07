import { syncSkillIconInnerFrameAcceptance } from './skill-icon-inner-frame-acceptance.js';

await syncSkillIconInnerFrameAcceptance({
	repositoryRoot: process.cwd(),
	mode: process.argv.includes('--write') ? 'write' : 'check'
});
