import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

const ROOT = 'assets/wiki/skills/icon-production-v1' as const;
const CLEANUP_ROOT = `${ROOT}/quality-cleanup-v1` as const;
const AUDIT_REPORT_PATH = `${CLEANUP_ROOT}/review/v10-inner-frame-audit/report.json` as const;
const CATALOG_PATH = `${ROOT}/catalog.json` as const;
const FRAMELESS_CLAUSE =
	'Artwork layer only: no rarity frame, rank crest, rank letter, border rails, backing, UI, label, logo, watermark, or text.';
const CORRECTED_SOURCE_SLUGS = new Set([
	'craft-knowledge-languages',
	'craft-knowledge-research',
	'magical-enchantment-component-craft',
	'martial-polearm-rend-armour'
]);
const CORRECTION_PROMPT_BY_SLUG: Readonly<Record<string, string>> = {
	'craft-knowledge-languages':
		'Targeted correction edit only. Preserve the composition, open book, quill, inkwell, dramatic fantasy painting, palette, lighting, and all other visual identity. Remove every written character, faux script, letter-like marking, speech bubble, and floating symbol. Replace page writing with purely pictorial embossed motifs suggesting listening and speaking through abstract flowing sound waves; these must contain no alphabetic, runic, numeric, or UI-like glyphs. Frameless artwork layer only, no border, rank crest, UI, label, logo, watermark, or text.',
	'craft-knowledge-research':
		'Targeted correction edit only. Preserve the composition, open research book, magnifying glass, candles, dark scholarly fantasy painting, palette, lighting, and all other visual identity. Remove every written character, faux script, rune, letter-like marking, and floating symbol. Replace page writing with purely pictorial sketches of artifacts, plants, and non-symbolic connecting lines; no alphabetic, runic, numeric, or UI-like glyphs. Frameless artwork layer only, no border, rank crest, UI, label, logo, watermark, or text.',
	'magical-enchantment-component-craft':
		'Targeted correction edit only. Preserve the composition, crystals, potion vessels, alchemical tools, pedestal, luminous magical material-crafting scene, palette, lighting, and all other visual identity. Remove every written character, rune, faux script, letter-like marking, diagram label, and detached symbol. Replace those marks with irregular mineral veins, sparks, and abstract non-symbolic filaments of light. Frameless artwork layer only, no border, rank crest, UI, label, logo, watermark, or text.',
	'martial-polearm-rend-armour':
		'Targeted correction edit only. Preserve the armored target, polearm impact, shattered armor plates, sparks, dramatic martial fantasy painting, palette, lighting, and all other visual identity. Remove only the three detached glowing orange downward chevrons and any other UI-like indicator. Replace them with natural fragments of broken armor, sparks, and dust integrated into the impact. Frameless artwork layer only, no border, rank crest, UI, label, logo, watermark, or text.'
};

interface AuditRecord {
	readonly targetId: string;
	readonly name: string;
	readonly rank: Rank;
	readonly currentPath: string;
	readonly currentHash: string;
	readonly classification: 'clear' | 'borderline';
}

interface CatalogRecord {
	readonly targetId: string;
	readonly name: string;
	readonly visualSpec: {
		readonly dominantSubject: string;
		readonly supportingCue: string;
		readonly semanticPalette: readonly string[];
	};
}

export interface SkillIconInnerFrameRegenerationJob {
	readonly targetId: string;
	readonly slug: string;
	readonly name: string;
	readonly rank: Rank;
	readonly currentPath: string;
	readonly currentHash: string;
	readonly referencePath: string;
	readonly referenceHash: string;
	readonly outputPath: string;
	readonly exactPrompt: string;
	readonly sourceAttempts: readonly {
		readonly path: string;
		readonly prompt: string;
		readonly status: 'accepted' | 'rejected';
		readonly reason?: 'faux-text-or-ui-artifact';
	}[];
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function regularBytes(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolute = path.resolve(repositoryRoot, repositoryPath);
	const relative = path.relative(repositoryRoot, absolute);
	if (relative === '..' || relative.startsWith(`..${path.sep}`))
		throw new Error(`Inner-frame regeneration input escapes repository: ${repositoryPath}`);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Inner-frame regeneration input is not a regular file: ${repositoryPath}`);
	return readFile(absolute);
}

function exactPrompt(record: CatalogRecord): string {
	const subject =
		record.targetId === 'martial:body:called-shot'
			? 'a clearly readable combatant holding a disciplined precision targeting pose, with the decisive stance visible'
			: record.visualSpec.dominantSubject;
	const supportingCue =
		record.targetId === 'martial:body:called-shot'
			? 'one restrained secondary cue communicating deliberate selection of a precise target marker'
			: record.visualSpec.supportingCue;
	const inputRole =
		record.targetId === 'martial:body:called-shot'
			? 'Image 1 is the sibling style and figure-treatment reference; create a distinct precision-targeting scene.'
			: 'Image 1 is the identity and composition reference.';
	return [
		'Use case: precise-object-edit',
		'Asset type: standalone Summonlab painted-emblem artwork layer',
		`Primary request: Recreate only the painted scene visible in Image 1 for ${record.name}. Preserve its recognizable identity, subject, action, palette, lighting, material treatment, and dark-fantasy brushwork.`,
		`Input images: ${inputRole}`,
		'Scene/backdrop: extend the existing atmospheric painted scene naturally to every edge of the square canvas.',
		`Subject: ${subject}.`,
		`Supporting cue: ${supportingCue}.`,
		'Style/medium: high-end dark-fantasy painted emblem; lightly dimensional materials; crisp at 384-pixel display.',
		'Composition: one centered dominant silhouette with strong negative space; preserve the original action direction and relative subject placement.',
		`Color palette: ${record.visualSpec.semanticPalette.join(', ')}.`,
		'Constraints: preserve the depicted skill identity and do not introduce unrelated props or narrative scenery.',
		FRAMELESS_CLAUSE
	].join('\n');
}

export async function buildSkillIconInnerFrameRegenerationJobs(
	repositoryRoot: string
): Promise<readonly SkillIconInnerFrameRegenerationJob[]> {
	const [auditBytes, catalogBytes] = await Promise.all([
		regularBytes(repositoryRoot, AUDIT_REPORT_PATH),
		regularBytes(repositoryRoot, CATALOG_PATH)
	]);
	const audit = JSON.parse(auditBytes.toString('utf8')) as { readonly records: AuditRecord[] };
	const catalog = JSON.parse(catalogBytes.toString('utf8')) as {
		readonly records: CatalogRecord[];
	};
	const approved = audit.records.filter((record) => record.classification === 'clear');
	if (approved.length !== 23)
		throw new Error(`Expected 23 owner-approved clear failures; received ${approved.length}`);
	const catalogByTarget = new Map(catalog.records.map((record) => [record.targetId, record]));
	const auditByTarget = new Map(audit.records.map((record) => [record.targetId, record]));
	const jobs: SkillIconInnerFrameRegenerationJob[] = [];
	for (const auditRecord of approved) {
		const catalogRecord = catalogByTarget.get(auditRecord.targetId);
		if (!catalogRecord || catalogRecord.name !== auditRecord.name)
			throw new Error(`Catalog binding drift for ${auditRecord.targetId}`);
		const referenceRecord =
			auditRecord.targetId === 'martial:body:called-shot'
				? auditByTarget.get('martial:body:sidestep')
				: auditRecord;
		if (!referenceRecord) throw new Error('Missing safe Called Shot sibling reference');
		const reference = await regularBytes(repositoryRoot, referenceRecord.currentPath);
		if (sha256(reference) !== referenceRecord.currentHash)
			throw new Error(`Identity reference hash drift for ${auditRecord.targetId}`);
		const slug = path.basename(auditRecord.currentPath, '.png');
		const sourceRevision = CORRECTED_SOURCE_SLUGS.has(slug) ? 'v2' : 'v1';
		const prompt = exactPrompt(catalogRecord);
		const initialOutputPath = `${CLEANUP_ROOT}/provider-sources/${slug}-v1-frameless-source.png`;
		const outputPath = `${CLEANUP_ROOT}/provider-sources/${slug}-${sourceRevision}-frameless-source.png`;
		const correctionPrompt = CORRECTION_PROMPT_BY_SLUG[slug];
		const sourceAttempts =
			sourceRevision === 'v2'
				? [
						{
							path: initialOutputPath,
							prompt,
							status: 'rejected' as const,
							reason: 'faux-text-or-ui-artifact' as const
						},
						{
							path: outputPath,
							prompt: correctionPrompt ?? '',
							status: 'accepted' as const
						}
					]
				: [{ path: outputPath, prompt, status: 'accepted' as const }];
		if (sourceRevision === 'v2' && correctionPrompt === undefined)
			throw new Error(`Missing correction prompt provenance for ${slug}`);
		jobs.push({
			targetId: auditRecord.targetId,
			slug,
			name: auditRecord.name,
			rank: auditRecord.rank,
			currentPath: auditRecord.currentPath,
			currentHash: auditRecord.currentHash,
			referencePath: referenceRecord.currentPath,
			referenceHash: referenceRecord.currentHash,
			outputPath,
			exactPrompt: prompt,
			sourceAttempts
		});
	}
	if (new Set(jobs.map((job) => job.targetId)).size !== 23)
		throw new Error('Owner-approved regeneration inventory contains duplicates');
	return jobs;
}

if (
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
	const jobs = await buildSkillIconInnerFrameRegenerationJobs(process.cwd());
	// eslint-disable-next-line no-console
	console.log(JSON.stringify(jobs, null, '\t'));
}
