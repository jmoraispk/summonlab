import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	EquipmentArmourSetUnlockReceiptV3Schema,
	EquipmentRootCandidateSelectionManifestV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_CLASSES,
	EQUIPMENT_CLASS_DIRECTIONS_V3,
	EQUIPMENT_MATERIAL_BRIEFS_V3,
	EQUIPMENT_RANKS,
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	fileSha256
} from './equipment-rank-first-production-v3.js';
import { EQUIPMENT_V3_ROOT_SELECTION_PATH } from './materialize-equipment-rank-first-revisions-v3.js';
import { resolveEquipmentArmourPieceCandidatesV3 } from './materialize-equipment-armour-piece-selections-v3.js';
import { readEquipmentRepositoryJson } from './equipment-repository-io.js';
import { equipmentArmourUnlockPath } from './record-equipment-armour-unlocks-v3.js';

type Checkpoint = '1' | '2' | '3';
type Edition = 'initial' | 'final';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function title(value: string): string {
	return value
		.split('-')
		.map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`)
		.join(' ');
}

async function requireImage(workspaceRoot: string, repositoryPath: string): Promise<void> {
	const metadata = await sharp(path.join(workspaceRoot, ...repositoryPath.split('/'))).metadata();
	if (metadata.format !== 'png' || !metadata.width || !metadata.height)
		throw new Error(`Required PNG is invalid: ${repositoryPath}`);
}

async function persistDerived(
	workspaceRoot: string,
	repositoryPath: string,
	bytes: Buffer
): Promise<void> {
	const absolute = path.join(workspaceRoot, ...repositoryPath.split('/'));
	await mkdir(path.dirname(absolute), { recursive: true });
	const current = await readFile(absolute).catch(() => null);
	if (current && !current.equals(bytes))
		throw new Error(`Refusing to overwrite divergent review derivative: ${repositoryPath}`);
	if (!current) await writeFile(absolute, bytes, { flag: 'wx' });
}

async function thumbnail(
	workspaceRoot: string,
	sourcePath: string,
	checkpoint: string,
	width: 128 | 256
): Promise<string> {
	const stem = sourcePath
		.replace(/^assets\/equipment\//u, '')
		.replaceAll('/', '--')
		.replace(/\.png$/u, '');
	const output = `${EQUIPMENT_V3_ROOT}/reviews/checkpoint-${checkpoint}/thumbnails/${width}/${stem}.webp`;
	const bytes = await sharp(path.join(workspaceRoot, ...sourcePath.split('/')))
		.resize(width, width, { fit: 'contain', background: '#070b12' })
		.webp({ quality: 82 })
		.toBuffer();
	await persistDerived(workspaceRoot, output, bytes);
	return output;
}

async function auditSheet(
	workspaceRoot: string,
	outputPath: string,
	entries: readonly { label: string; imagePath: string }[]
): Promise<string> {
	const tileWidth = 256;
	const tileHeight = 304;
	const width = tileWidth * entries.length;
	const background = await sharp({
		create: { width, height: tileHeight, channels: 4, background: '#070b12ff' }
	})
		.png()
		.toBuffer();
	const composites = await Promise.all(
		entries.flatMap((entry, index) => [
			sharp(path.join(workspaceRoot, ...entry.imagePath.split('/')))
				.resize(tileWidth, 256, { fit: 'contain', background: '#070b12' })
				.png()
				.toBuffer()
				.then((input) => ({ input, left: index * tileWidth, top: 0 })),
			Promise.resolve({
				input: Buffer.from(
					`<svg width="${tileWidth}" height="48"><rect width="100%" height="100%" fill="#101722"/><text x="12" y="29" fill="#edf2f7" font-family="sans-serif" font-size="18">${escapeHtml(entry.label)}</text></svg>`
				),
				left: index * tileWidth,
				top: 256
			})
		])
	);
	const bytes = await sharp(background)
		.composite(composites)
		.png({ compressionLevel: 9 })
		.toBuffer();
	await persistDerived(workspaceRoot, outputPath, bytes);
	return outputPath;
}

interface Card {
	readonly id: string;
	readonly label: string;
	readonly rank: string;
	readonly group: string;
	readonly imagePath: string;
	readonly hash: string;
	readonly thumb128: string;
	readonly thumb256: string;
	readonly reviewable: boolean;
}

async function card(
	workspaceRoot: string,
	checkpoint: string,
	input: Omit<Card, 'hash' | 'thumb128' | 'thumb256'>
): Promise<Card> {
	await requireImage(workspaceRoot, input.imagePath);
	const [thumb128, thumb256] = await Promise.all([
		thumbnail(workspaceRoot, input.imagePath, checkpoint, 128),
		thumbnail(workspaceRoot, input.imagePath, checkpoint, 256)
	]);
	return {
		...input,
		hash: fileSha256(path.join(workspaceRoot, ...input.imagePath.split('/'))),
		thumb128,
		thumb256
	};
}

async function checkpoint1Cards(workspaceRoot: string): Promise<Card[]> {
	return Promise.all(
		EQUIPMENT_CLASS_DIRECTIONS_V3.map((direction) =>
			card(workspaceRoot, '1', {
				id: `equipment-v3-${direction.classId}-rank-progression`,
				label: `${direction.displayName} · F→S direction`,
				rank: 'all',
				group:
					direction.status === 'owner-accepted' ? 'accepted reference' : 'new checkpoint direction',
				imagePath: direction.imagePath,
				reviewable: direction.status === 'generation-required'
			})
		)
	);
}

async function checkpoint2Cards(workspaceRoot: string, edition: Edition): Promise<Card[]> {
	const roots = buildEquipmentCandidateTargetsV3().filter(
		({ dependsOnTargetId }) => dependsOnTargetId === null
	);
	const selections =
		edition === 'final'
			? EquipmentRootCandidateSelectionManifestV3Schema.parse(
					await readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V3_ROOT_SELECTION_PATH)
				).selections
			: [];
	const selectedImagePath = (target: (typeof roots)[number]) =>
		selections.find(({ targetId }) => targetId === target.targetId)?.candidatePath ??
		target.output.candidatePath;
	const rootCards = await Promise.all(
		roots.map((target) =>
			card(workspaceRoot, edition === 'final' ? '2-final' : '2', {
				id: target.targetId,
				label: `${target.materialName} ${title(target.classId)}${target.artifactRole === 'set-source' ? ' Set' : ''}`,
				rank: target.rank,
				group: target.classId,
				imagePath: selectedImagePath(target),
				reviewable: true
			})
		)
	);
	for (const classId of EQUIPMENT_CLASSES) {
		const outputPath = `${EQUIPMENT_V3_ROOT}/reviews/class-audits${edition === 'final' ? '/final' : ''}/${classId}-f-to-s-v3.png`;
		const entries = roots
			.filter((target) => target.classId === classId)
			.map((target) => ({
				label: `${target.rank} · ${target.materialName}`,
				imagePath: selectedImagePath(target)
			}));
		await auditSheet(
			workspaceRoot,
			outputPath,
			entries
		);
	}
	for (const brief of EQUIPMENT_MATERIAL_BRIEFS_V3) {
		const outputPath = `${EQUIPMENT_V3_ROOT}/reviews/material-audits${edition === 'final' ? '/final' : ''}/${brief.rank.toLowerCase()}-${brief.materialId}-v3.png`;
		const entries = roots
			.filter(({ materialId }) => materialId === brief.materialId)
			.map((target) => ({ label: title(target.classId), imagePath: selectedImagePath(target) }));
		await auditSheet(
			workspaceRoot,
			outputPath,
			entries
		);
	}
	const checkpointDirectory = edition === 'final' ? '2-final' : '2';
	const classAuditCards = await Promise.all(
		EQUIPMENT_CLASSES.map((classId) =>
			card(workspaceRoot, checkpointDirectory, {
				id: `equipment-v3-class-audit-${classId}`,
				label: `${title(classId)} · F→S class audit`,
				rank: 'all',
				group: 'class audits',
				imagePath: `${EQUIPMENT_V3_ROOT}/reviews/class-audits${edition === 'final' ? '/final' : ''}/${classId}-f-to-s-v3.png`,
				reviewable: false
			})
		)
	);
	const materialAuditCards = await Promise.all(
		EQUIPMENT_MATERIAL_BRIEFS_V3.map((brief) =>
			card(workspaceRoot, checkpointDirectory, {
				id: `equipment-v3-material-audit-${brief.rank.toLowerCase()}-${brief.materialId}`,
				label: `${brief.displayName} · material audit`,
				rank: brief.rank,
				group: 'material audits',
				imagePath: `${EQUIPMENT_V3_ROOT}/reviews/material-audits${edition === 'final' ? '/final' : ''}/${brief.rank.toLowerCase()}-${brief.materialId}-v3.png`,
				reviewable: false
			})
		)
	);
	return [...classAuditCards, ...materialAuditCards, ...rootCards];
}

async function checkpoint3Cards(workspaceRoot: string, edition: Edition): Promise<Card[]> {
	const targets = buildEquipmentCandidateTargetsV3();
	const pieces = targets.filter(({ artifactRole }) => artifactRole === 'armour-piece');
	const pieceCandidatePaths =
		edition === 'final'
			? (await resolveEquipmentArmourPieceCandidatesV3(workspaceRoot)).candidatePaths
			: new Map(pieces.map((target) => [target.targetId, target.output.candidatePath]));
	const pieceCards = await Promise.all(
		pieces.map((target) =>
			card(workspaceRoot, edition === 'final' ? '3-final' : '3', {
				id: target.targetId,
				label: `${target.materialName} ${title(target.classId)} ${title(target.slot!)}`,
				rank: target.rank,
				group: target.setId!,
				imagePath: pieceCandidatePaths.get(target.targetId)!,
				reviewable: true
			})
		)
	);
	const sources = targets.filter(({ artifactRole }) => artifactRole === 'set-source');
	const auditEntries = [];
	for (const source of sources) {
		const unlock = EquipmentArmourSetUnlockReceiptV3Schema.parse(
			await readEquipmentRepositoryJson(
				workspaceRoot,
				equipmentArmourUnlockPath(source.rank, source.setId!)
			)
		);
		if (unlock.sourceTargetId !== source.targetId) {
			throw new Error(`Armour unlock/source mismatch: ${source.targetId}`);
		}
		const children = targets.filter(
			({ dependsOnTargetId }) => dependsOnTargetId === source.targetId
		);
		const auditPath = `${EQUIPMENT_V3_ROOT}/reviews/armour-piece-audits${edition === 'final' ? '/final' : ''}/${source.rank.toLowerCase()}-${source.setId}-v3.png`;
		await auditSheet(workspaceRoot, auditPath, [
			{ label: 'Full Set', imagePath: unlock.sourceCandidatePath },
			...children.map((target) => ({
				label: title(target.slot!),
				imagePath: pieceCandidatePaths.get(target.targetId)!
			}))
		]);
		auditEntries.push({ source, auditPath });
	}
	const auditCards = await Promise.all(
		auditEntries.map(({ source, auditPath }) =>
			card(workspaceRoot, edition === 'final' ? '3-final' : '3', {
				id: `equipment-v3-armour-audit-${source.setId}`,
				label: `${source.materialName} ${title(source.classId)} · set/pieces audit`,
				rank: source.rank,
				group: 'armour audits',
				imagePath: auditPath,
				reviewable: false
			})
		)
	);
	return [...auditCards, ...pieceCards];
}

function html(checkpoint: Checkpoint, cards: readonly Card[], edition: Edition): string {
	const reviewableCount = cards.filter(({ reviewable }) => reviewable).length;
	const editionLabel = checkpoint === '2' || checkpoint === '3' ? ` · ${edition} audit` : '';
	const cardMarkup = cards
		.map(
			(entry) =>
				`<button class="card" type="button" data-rank="${entry.rank}" data-group="${escapeHtml(entry.group)}" data-reviewable="${entry.reviewable}" data-src="/${entry.imagePath}" data-id="${entry.id}" data-hash="${entry.hash}"><img src="/${entry.thumb256}" srcset="/${entry.thumb128} 128w, /${entry.thumb256} 256w" sizes="(max-width:600px) 44vw, 240px" alt="${escapeHtml(entry.label)}"><span><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.group)} · ${entry.hash.slice(0, 10)}</small></span></button>`
		)
		.join('\n');
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Equipment v3 · checkpoint ${checkpoint}${editionLabel}</title><style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#070b12;color:#edf2f7}*{box-sizing:border-box}body{margin:0}header{position:sticky;top:0;z-index:2;padding:18px clamp(16px,4vw,48px);background:#0b111beF;border-bottom:1px solid #263244;backdrop-filter:blur(12px)}h1{font-size:clamp(20px,4vw,32px);margin:0 0 6px}p{margin:0;color:#9facbd}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}button{font:inherit;color:inherit}.filter{background:#111a27;border:1px solid #324157;border-radius:999px;padding:6px 12px}.filter[aria-pressed=true]{background:#315c83;border-color:#77b8ee}main{padding:20px clamp(12px,3vw,40px) 60px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(180px,43vw),1fr));gap:12px}.card{padding:0;background:#0d141f;border:1px solid #273549;border-radius:12px;overflow:hidden;text-align:left;cursor:pointer}.card[data-reviewable=true]{border-color:#477aa5}.card[hidden]{display:none}.card img{width:100%;aspect-ratio:1;object-fit:contain;background:#05080d;display:block}.card span{display:grid;gap:4px;padding:10px}.card strong{font-size:13px}.card small{font-size:10px;color:#8997aa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.viewer{position:fixed;inset:0;z-index:10;background:#000d;display:grid;place-items:center;padding:14px}.viewer[hidden]{display:none}.panel{max-width:96vw;max-height:96vh;overflow:auto;background:#0b111b;border:1px solid #3a4a60;border-radius:14px;padding:12px}.panel img{display:block;max-width:92vw;max-height:82vh;object-fit:contain;margin:auto}.panel footer{display:flex;justify-content:space-between;gap:12px;padding-top:10px}.close{background:#182334;border:1px solid #3a4a60;border-radius:8px;padding:7px 12px}@media(max-width:600px){header{padding:12px}.grid{gap:8px}.card span{padding:8px}.panel{padding:8px}}
</style></head><body><header><h1>Equipment v3 · checkpoint ${checkpoint}</h1><p>${cards.length} images · ${reviewableCount} require an owner decision · tap any image for the full-resolution source.</p><div class="toolbar"><button class="filter" data-filter="all" aria-pressed="true">All</button>${EQUIPMENT_RANKS.map((rank) => `<button class="filter" data-filter="${rank}" aria-pressed="false">${rank}</button>`).join('')}<button class="filter" data-filter="review" aria-pressed="false">Needs review</button></div></header><main><div class="grid">${cardMarkup}</div></main><div class="viewer" hidden><div class="panel"><img alt=""><footer><span></span><button class="close">Close</button></footer></div></div><script>
const cards=[...document.querySelectorAll('.card')],filters=[...document.querySelectorAll('.filter')],viewer=document.querySelector('.viewer');for(const f of filters)f.onclick=()=>{filters.forEach(x=>x.setAttribute('aria-pressed',String(x===f)));const v=f.dataset.filter;cards.forEach(c=>c.hidden=!(v==='all'||c.dataset.rank===v||(v==='review'&&c.dataset.reviewable==='true')))};for(const c of cards)c.onclick=()=>{viewer.querySelector('img').src=c.dataset.src;viewer.querySelector('img').alt=c.querySelector('strong').textContent;viewer.querySelector('footer span').textContent=c.dataset.id+' · '+c.dataset.hash;viewer.hidden=false};viewer.querySelector('.close').onclick=()=>viewer.hidden=true;viewer.onclick=e=>{if(e.target===viewer)viewer.hidden=true};document.onkeydown=e=>{if(e.key==='Escape')viewer.hidden=true};
</script></body></html>`;
}

export async function exportEquipmentRankFirstReviewV3(input: {
	workspaceRoot: string;
	checkpoint: Checkpoint;
	edition?: Edition;
}) {
	const edition = input.edition ?? 'initial';
	const cards =
		input.checkpoint === '1'
			? await checkpoint1Cards(input.workspaceRoot)
			: input.checkpoint === '2'
				? await checkpoint2Cards(input.workspaceRoot, edition)
				: await checkpoint3Cards(input.workspaceRoot, edition);
	const checkpointDirectory =
		(input.checkpoint === '2' || input.checkpoint === '3') && edition === 'final'
			? `checkpoint-${input.checkpoint}-final`
			: `checkpoint-${input.checkpoint}`;
	const outputPath = `${EQUIPMENT_V3_ROOT}/reviews/${checkpointDirectory}/index.html`;
	const contents = html(input.checkpoint, cards, edition);
	await persistDerived(input.workspaceRoot, outputPath, Buffer.from(contents));
	return {
		checkpoint: input.checkpoint,
		outputPath,
		cardCount: cards.length,
		reviewableCount: cards.filter(({ reviewable }) => reviewable).length
	};
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	const index = process.argv.indexOf('--checkpoint');
	const checkpoint = index >= 0 ? (process.argv[index + 1] as Checkpoint) : undefined;
	const editionIndex = process.argv.indexOf('--edition');
	const edition =
		editionIndex >= 0 ? (process.argv[editionIndex + 1] as Edition | undefined) : 'initial';
	if (!checkpoint || !['1', '2', '3'].includes(checkpoint))
		throw new Error('Usage: ... --checkpoint (1|2|3)');
	if (!edition || !['initial', 'final'].includes(edition))
		throw new Error('Usage: ... [--edition (initial|final)]');
	process.stdout.write(
		`${JSON.stringify(
			await exportEquipmentRankFirstReviewV3({
				workspaceRoot: process.cwd(),
				checkpoint,
				edition
			}),
			null,
			2
		)}\n`
	);
}
