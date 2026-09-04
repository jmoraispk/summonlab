import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import { familyAffinitySha256 } from './family-affinity-production-lib.js';

type ExportMode = 'dry-run' | 'write' | 'check';
type Tier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
type ActiveCoordinate = {
	activeVersion: number;
	affinity: string;
	coordinateId: string;
	familyId: string;
	formId: string;
	targetPath: string;
	targetSha256: string;
};
type RevisionTarget = {
	coordinateId: string;
	familyId: string;
	formId: string;
	targetId: string;
	tier: Tier;
	version: number;
	ownedPaths: { candidate: string; result: string };
};
type RevisionResult = {
	candidatePath: string;
	candidateSha256: string;
	candidateVersion: number;
	coordinateId: string;
	resultPath: string;
	schemaVersion: string;
	state: string;
	targetId: string;
	targetSha256: string;
};
type RevisionItem = {
	familyId: string;
	formId: string;
	tier: Tier;
	version: number;
	coordinateId: string;
	targetId: string;
	targetPath: string;
	targetSha256: string;
	candidatePath: string;
	candidateSha256: string;
	resultPath: string;
	resultSha256: string;
	candidate: Buffer;
};
type RevisionScan = {
	items: RevisionItem[];
	revisedTargetCount: number;
	blockers: string[];
};

const EXPERIMENT_ROOT = 'assets/enemies/experiments/family-affinity-v1';
const OUTPUT_ROOT = 'docs/evidence/enemy-normal-anchor-review-v2';
const EXPECTED_REVISION_COUNT = 50;
const REQUIRED_FINAL_VERSION = {
	coordinateId: 'vampires/vampire-progenitor/normal',
	minimumVersion: 3
} as const;
const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;
const WAVES = [
	{ id: 'a1', families: ['goblins', 'orcs', 'giants', 'trolls', 'dragons'] },
	{ id: 'a2', families: ['skeletons', 'rotwalkers', 'wraiths', 'vampires', 'mummies'] },
	{ id: 'a3', families: ['demons', 'celestials', 'harpies', 'minotaurs', 'nagas'] },
	{ id: 'a4', families: ['lizardfolk', 'insectoids', 'arachnids', 'slimes', 'golems'] },
	{ id: 'a5', families: ['elementals', 'treants', 'fungalfolk', 'deep-ones', 'werebeasts'] },
	{ id: 'a6', families: ['gargoyles', 'djinn', 'fae', 'void-horrors', 'doppelgangers'] }
] as const;

function ownedAbsolute(repositoryRoot: string, ownedPath: string): string {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, ownedPath);
	if (!absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Path escapes repository: ${ownedPath}`);
	}
	return absolute;
}

async function requiredRealFile(repositoryRoot: string, ownedPath: string): Promise<Buffer> {
	const absolute = ownedAbsolute(repositoryRoot, ownedPath);
	const metadata = await lstat(absolute);
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error(`Required review source must be a real file: ${ownedPath}`);
	}
	return readFile(absolute);
}

async function optionalRealFile(repositoryRoot: string, ownedPath: string): Promise<Buffer | null> {
	try {
		return await requiredRealFile(repositoryRoot, ownedPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

function sha256(bytes: Buffer | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function escapeXml(value: string): string {
	return escapeHtml(value).replaceAll('&#39;', '&apos;');
}

function titleCase(value: string): string {
	return value
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function waveForFamily(familyId: string): (typeof WAVES)[number] {
	const wave = WAVES.find((candidate) => candidate.families.includes(familyId as never));
	if (!wave) throw new Error(`Revised family is not assigned to a review wave: ${familyId}`);
	return wave;
}

async function scanActiveRevisions(repositoryRoot: string): Promise<RevisionScan> {
	const manifestBytes = await requiredRealFile(repositoryRoot, `${EXPERIMENT_ROOT}/manifest.json`);
	const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
		canonicalMatrix: { activeCoordinates: ActiveCoordinate[] };
	};
	const normalCoordinates = manifest.canonicalMatrix.activeCoordinates.filter(
		(coordinate) => coordinate.affinity === 'normal'
	);
	if (normalCoordinates.length !== 150) {
		throw new Error(`Expected 150 active Normal coordinates, found ${normalCoordinates.length}`);
	}

	const blockers: string[] = [];
	const items: RevisionItem[] = [];
	let revisedTargetCount = 0;
	for (const coordinate of normalCoordinates) {
		const targetBytes = await requiredRealFile(repositoryRoot, coordinate.targetPath);
		const target = JSON.parse(targetBytes.toString('utf8')) as RevisionTarget;
		if (familyAffinitySha256(target) !== coordinate.targetSha256) {
			throw new Error(`Manifest target hash mismatch: ${coordinate.targetPath}`);
		}
		if (target.version <= 1) continue;
		revisedTargetCount += 1;
		waveForFamily(target.familyId);
		if (
			target.coordinateId !== coordinate.coordinateId ||
			target.familyId !== coordinate.familyId ||
			target.formId !== coordinate.formId ||
			target.version !== coordinate.activeVersion
		) {
			throw new Error(`Active revision binding mismatch: ${coordinate.coordinateId}`);
		}
		if (!TIERS.includes(target.tier)) {
			throw new Error(`Unexpected tier for ${target.targetId}: ${String(target.tier)}`);
		}
		const candidate = await optionalRealFile(repositoryRoot, target.ownedPaths.candidate);
		const resultBytes = await optionalRealFile(repositoryRoot, target.ownedPaths.result);
		if (!candidate) blockers.push(`missing candidate: ${target.ownedPaths.candidate}`);
		if (!resultBytes) blockers.push(`missing result: ${target.ownedPaths.result}`);
		if (!candidate || !resultBytes) continue;

		const candidateSha256 = sha256(candidate);
		const resultSha256 = sha256(resultBytes);
		const result = JSON.parse(resultBytes.toString('utf8')) as RevisionResult;
		if (
			result.schemaVersion !== 'family-affinity-result-v1' ||
			result.state !== 'candidate-only' ||
			result.targetId !== target.targetId ||
			result.coordinateId !== target.coordinateId ||
			result.candidateVersion !== target.version ||
			result.candidatePath !== target.ownedPaths.candidate ||
			result.resultPath !== target.ownedPaths.result ||
			result.targetSha256 !== coordinate.targetSha256 ||
			result.candidateSha256 !== candidateSha256
		) {
			throw new Error(`Result provenance mismatch: ${target.ownedPaths.result}`);
		}
		items.push({
			familyId: target.familyId,
			formId: target.formId,
			tier: target.tier,
			version: target.version,
			coordinateId: target.coordinateId,
			targetId: target.targetId,
			targetPath: coordinate.targetPath,
			targetSha256: coordinate.targetSha256,
			candidatePath: target.ownedPaths.candidate,
			candidateSha256,
			resultPath: target.ownedPaths.result,
			resultSha256,
			candidate
		});
	}

	if (revisedTargetCount !== EXPECTED_REVISION_COUNT) {
		blockers.push(
			`expected ${EXPECTED_REVISION_COUNT} active revised Normal targets, found ${revisedTargetCount}`
		);
	}
	const finalGate = normalCoordinates.find(
		(coordinate) => coordinate.coordinateId === REQUIRED_FINAL_VERSION.coordinateId
	);
	if (!finalGate || finalGate.activeVersion < REQUIRED_FINAL_VERSION.minimumVersion) {
		blockers.push(
			`${REQUIRED_FINAL_VERSION.coordinateId} must be active at v${REQUIRED_FINAL_VERSION.minimumVersion} or later before final export`
		);
	}
	if (items.length !== revisedTargetCount) {
		blockers.push(
			`expected ${revisedTargetCount} provenance-complete revised candidates, found ${items.length}`
		);
	}

	items.sort(
		(left, right) =>
			WAVES.indexOf(waveForFamily(left.familyId)) - WAVES.indexOf(waveForFamily(right.familyId)) ||
			waveForFamily(left.familyId).families.indexOf(left.familyId as never) -
				waveForFamily(right.familyId).families.indexOf(right.familyId as never) ||
			TIERS.indexOf(left.tier) - TIERS.indexOf(right.tier) ||
			left.formId.localeCompare(right.formId)
	);
	return { items, revisedTargetCount, blockers };
}

async function renderBlindWave(
	waveId: string,
	items: Array<RevisionItem & { token: string }>
): Promise<Buffer> {
	const columns = 5;
	const headerHeight = 108;
	const cellWidth = 360;
	const cellHeight = 350;
	const rows = Math.ceil(items.length / columns);
	const width = columns * cellWidth;
	const height = headerHeight + rows * cellHeight;
	const composites: Array<{ input: Buffer; left: number; top: number }> = [];
	const labels: string[] = [];
	for (const [index, item] of items.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const x = column * cellWidth;
		const y = headerHeight + row * cellHeight;
		composites.push({
			input: await sharp(item.candidate)
				.rotate()
				.resize({
					width: cellWidth - 18,
					height: cellHeight - 48,
					fit: 'contain',
					background: '#080b10'
				})
				.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
				.toBuffer(),
			left: x + 9,
			top: y + 6
		});
		labels.push(
			`<g><rect x="${x + 4}" y="${y + 4}" width="${cellWidth - 8}" height="${cellHeight - 8}" rx="8" fill="none" stroke="#4f5e70" stroke-width="2"/><text x="${x + cellWidth / 2}" y="${y + cellHeight - 17}" text-anchor="middle" fill="#dce5ed" font-size="15" font-weight="700" font-family="monospace">${escapeXml(item.token)}</text></g>`
		);
	}
	const overlay = Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="20" y="34" fill="#70b7c4" font-size="18" font-weight="700" font-family="sans-serif">WAVE ${escapeXml(waveId.toUpperCase())} · BLIND NORMAL REVISION REVIEW</text><text x="20" y="62" fill="#aebbc7" font-size="14" font-family="sans-serif">Record perceived family, role, tier, anatomy, framing, and verdict by opaque token before map access.</text><text x="20" y="86" fill="#d49b68" font-size="13" font-weight="700" font-family="sans-serif">Names, tiers, revisions, and provenance are intentionally hidden.</text>${labels.join('')}</svg>`
	);
	return sharp({ create: { width, height, channels: 3, background: '#070a0f' } })
		.composite([...composites, { input: overlay, left: 0, top: 0 }])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

function buildOwnerHtml(items: RevisionItem[]): Buffer {
	const familyGroups = WAVES.flatMap((wave) =>
		wave.families.flatMap((familyId) => {
			const familyItems = items.filter((item) => item.familyId === familyId);
			if (familyItems.length === 0) return [];
			const cards = familyItems
				.map(
					(item) => `
          <article class="card" data-search="${escapeHtml(`${item.familyId} ${item.formId} ${item.tier}`)}">
            <a href="../../../${escapeHtml(item.candidatePath)}" target="_blank" rel="noreferrer"><img src="../../../${escapeHtml(item.candidatePath)}" alt="${escapeHtml(titleCase(item.formId))}, ${item.tier}, Normal revision v${item.version}" loading="lazy"></a>
            <div class="card-copy">
              <p class="meta">${item.tier} · NORMAL · REVISION V${item.version}</p>
              <h3>${escapeHtml(titleCase(item.formId))}</h3>
              <p class="hash">SHA-256 ${item.candidateSha256}</p>
            </div>
          </article>`
				)
				.join('');
			return [
				`<section class="family"><div class="family-heading"><p>Wave ${wave.id.toUpperCase()}</p><h2>${escapeHtml(titleCase(familyId))}</h2></div><div class="cards">${cards}</div></section>`
			];
		})
	);
	return Buffer.from(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Summonlab Normal Revision Review</title>
  <style>
    :root { color-scheme: dark; --ground:#080805; --surface:#11100c; --paper:#f3ead9; --muted:#aaa08e; --ember:#d4773d; --line:rgba(231,206,164,.16); --serif:Georgia,'Times New Roman',serif; --utility:ui-monospace,SFMono-Regular,Menlo,monospace; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--ground); color:var(--paper); font-family:var(--serif); line-height:1.45; }
    .shell { width:min(100% - 2rem, 100rem); margin:0 auto; }
    header { padding:clamp(3rem,7vw,7rem) 0 2.5rem; border-bottom:1px solid var(--line); }
    .eyebrow,.meta,.hash,.family-heading p,.counter { font-family:var(--utility); letter-spacing:.06em; text-transform:uppercase; }
    .eyebrow,.meta,.family-heading p { color:var(--ember); }
    h1 { max-width:13ch; margin:.6rem 0 1.2rem; font-size:clamp(2.8rem,7vw,6.8rem); font-weight:400; line-height:.92; }
    .lede { max-width:68rem; margin:0; color:var(--muted); font-size:clamp(1rem,1.8vw,1.3rem); }
    .notice { margin-top:1.5rem; padding:1rem 1.1rem; border:1px solid var(--line); color:#e5aa73; font-family:var(--utility); font-size:.78rem; }
    .toolbar { position:sticky; top:0; z-index:5; padding:.85rem 0; background:rgba(8,8,5,.94); border-bottom:1px solid var(--line); backdrop-filter:blur(12px); }
    .toolbar .shell { display:flex; gap:1rem; align-items:center; }
    input { width:min(100%,34rem); min-height:2.7rem; padding:.6rem .8rem; color:var(--paper); background:var(--surface); border:1px solid var(--line); border-radius:.2rem; }
    .counter { margin-left:auto; color:var(--muted); font-size:.7rem; }
    .family { display:grid; grid-template-columns:minmax(12rem,.55fr) minmax(0,2.45fr); gap:1.5rem; padding:2.3rem 0; border-bottom:1px solid var(--line); }
    .family-heading { position:sticky; top:5.2rem; align-self:start; }
    .family-heading p { margin:0 0 .35rem; font-size:.68rem; }
    .family-heading h2 { margin:0; font-size:clamp(1.8rem,4vw,3.4rem); font-weight:400; line-height:1; }
    .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(14rem,1fr)); gap:1rem; }
    .card { min-width:0; background:var(--surface); border:1px solid var(--line); }
    .card[hidden],.family[hidden] { display:none; }
    .card a { display:block; aspect-ratio:1/1; background:#050505; overflow:hidden; }
    .card img { display:block; width:100%; height:100%; object-fit:contain; transition:transform .2s ease; }
    .card a:hover img { transform:scale(1.018); }
    .card-copy { padding:.85rem; }
    .meta { margin:0 0 .3rem; font-size:.63rem; }
    h3 { margin:0; font-size:1.15rem; font-weight:400; }
    .hash { overflow:hidden; margin:.8rem 0 0; color:var(--muted); font-size:.55rem; text-overflow:ellipsis; white-space:nowrap; }
    footer { padding:3rem 0 6rem; color:var(--muted); }
    @media (max-width:48rem) { .family { grid-template-columns:1fr; } .family-heading { position:static; } .counter { display:none; } }
  </style>
</head>
<body>
  <header><div class="shell"><p class="eyebrow">Enemy visual production · candidate evidence</p><h1>Normal anchor revisions</h1><p class="lede">Named owner review for ${items.length} active revised Normal candidates. Review identity, exact T3/T5 form, combat role, anatomy, framing, finish, and neutral affinity treatment.</p><div class="notice">Candidate-only evidence. Nothing on this page is approved or promoted to runtime. Blind reviewers must use the label-hidden sheets before viewing this page.</div></div></header>
  <div class="toolbar"><div class="shell"><input id="search" type="search" placeholder="Filter by family, form, or tier" aria-label="Filter revision candidates"><p class="counter"><span id="shown">${items.length}</span> / ${items.length} shown</p></div></div>
  <main class="shell">${familyGroups.join('')}</main>
  <footer class="shell">Open an image to inspect the exact repository-owned candidate at full resolution.</footer>
  <script>
    const input = document.querySelector('#search');
    const shown = document.querySelector('#shown');
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      let count = 0;
      document.querySelectorAll('.card').forEach((card) => {
        const visible = card.dataset.search.includes(query);
        card.hidden = !visible;
        if (visible) count += 1;
      });
      document.querySelectorAll('.family').forEach((family) => {
        family.hidden = !family.querySelector('.card:not([hidden])');
      });
      shown.textContent = String(count);
    });
  </script>
</body>
</html>
`);
}

function buildIndexMarkdown(
	waveDetails: Array<{ id: string; count: number }>,
	itemCount: number
): Buffer {
	const sections = waveDetails
		.map(
			(wave) =>
				`## Wave ${wave.id.toUpperCase()}\n\n${wave.count} revised candidates. Blind reviewer: record verdicts by opaque token before consulting any map.\n\n![Wave ${wave.id.toUpperCase()} blind revisions](./wave-${wave.id}-blind.png)\n\nController-only reconciliation map: [wave-${wave.id}-blind-map.json](./wave-${wave.id}-blind-map.json).`
		)
		.join('\n\n');
	return Buffer.from(
		`# Enemy Normal-anchor revision review handoff\n\nThis folder contains candidate-only evidence for ${itemCount} active revised Normal anchors. It does not approve or promote pixels.\n\nReview order:\n\n1. Independent reviewers assess the label-hidden sheets below without opening the maps or named gallery.\n2. The owner reviews the [named revision gallery](./index.html) for identity, exact form/tier, combat role, anatomy, composition, finish, and affinity neutrality.\n3. The controller reconciles opaque tokens through the maps and records separately assigned immutable review receipts.\n4. Only mutually approved anchors may be activated.\n\n${sections}\n`
	);
}

async function buildArtifacts(
	items: RevisionItem[]
): Promise<Array<{ path: string; bytes: Buffer }>> {
	const waveDetails = WAVES.map((wave) => ({
		id: wave.id,
		count: items.filter((item) => wave.families.includes(item.familyId as never)).length
	})).filter((wave) => wave.count > 0);
	const artifacts: Array<{ path: string; bytes: Buffer }> = [
		{ path: `${OUTPUT_ROOT}/index.html`, bytes: buildOwnerHtml(items) },
		{ path: `${OUTPUT_ROOT}/index.md`, bytes: buildIndexMarkdown(waveDetails, items.length) },
		{
			path: `${OUTPUT_ROOT}/inventory.json`,
			bytes: Buffer.from(
				`${JSON.stringify(
					{
						schemaVersion: 'family-affinity-normal-revision-handoff-v2',
						stateCeiling: 'candidate-only',
						itemCount: items.length,
						items: items.map((item) => ({
							familyId: item.familyId,
							formId: item.formId,
							tier: item.tier,
							version: item.version,
							coordinateId: item.coordinateId,
							targetId: item.targetId,
							targetPath: item.targetPath,
							targetSha256: item.targetSha256,
							candidatePath: item.candidatePath,
							candidateSha256: item.candidateSha256,
							resultPath: item.resultPath,
							resultSha256: item.resultSha256
						}))
					},
					null,
					2
				)}\n`
			)
		}
	];
	for (const wave of WAVES) {
		const blindItems = items
			.filter((item) => wave.families.includes(item.familyId as never))
			.sort((left, right) =>
				sha256(
					`enemy-normal-anchor-review-v2:${wave.id}:${left.coordinateId}:${left.candidateSha256}`
				).localeCompare(
					sha256(
						`enemy-normal-anchor-review-v2:${wave.id}:${right.coordinateId}:${right.candidateSha256}`
					)
				)
			)
			.map((item, index) => ({
				...item,
				token: `R2-${wave.id.toUpperCase()}-${String(index + 1).padStart(2, '0')}`
			}));
		if (blindItems.length === 0) continue;
		artifacts.push(
			{
				path: `${OUTPUT_ROOT}/wave-${wave.id}-blind.png`,
				bytes: await renderBlindWave(wave.id, blindItems)
			},
			{
				path: `${OUTPUT_ROOT}/wave-${wave.id}-blind-map.json`,
				bytes: Buffer.from(
					`${JSON.stringify(
						{
							schemaVersion: 'family-affinity-normal-blind-map-v2',
							waveId: wave.id,
							warning:
								'Controller reconciliation only. Blind reviewers record token verdicts before opening this map or the named owner gallery.',
							entries: blindItems.map(
								({
									token,
									coordinateId,
									targetId,
									targetPath,
									targetSha256,
									candidatePath,
									candidateSha256,
									resultPath,
									resultSha256
								}) => ({
									token,
									coordinateId,
									targetId,
									targetPath,
									targetSha256,
									candidatePath,
									candidateSha256,
									resultPath,
									resultSha256
								})
							)
						},
						null,
						2
					)}\n`
				)
			}
		);
	}
	return artifacts;
}

async function assertOutputAbsent(repositoryRoot: string): Promise<void> {
	try {
		await lstat(ownedAbsolute(repositoryRoot, OUTPUT_ROOT));
		throw new Error(`Collision: review handoff output already exists: ${OUTPUT_ROOT}`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
		throw error;
	}
}

async function writeExclusive(
	repositoryRoot: string,
	artifacts: Array<{ path: string; bytes: Buffer }>
): Promise<void> {
	await assertOutputAbsent(repositoryRoot);
	const outputAbsolute = ownedAbsolute(repositoryRoot, OUTPUT_ROOT);
	await mkdir(dirname(outputAbsolute), { recursive: true });
	await mkdir(outputAbsolute);
	for (const artifact of artifacts) {
		await writeFile(ownedAbsolute(repositoryRoot, artifact.path), artifact.bytes, { flag: 'wx' });
	}
}

async function checkExact(
	repositoryRoot: string,
	artifacts: Array<{ path: string; bytes: Buffer }>
): Promise<void> {
	const expectedNames = artifacts.map((artifact) => artifact.path.split('/').at(-1)!).sort();
	const actualNames = (await readdir(ownedAbsolute(repositoryRoot, OUTPUT_ROOT))).sort();
	if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
		throw new Error('Revision handoff output inventory is stale');
	}
	for (const artifact of artifacts) {
		const current = await requiredRealFile(repositoryRoot, artifact.path);
		if (!current.equals(artifact.bytes)) {
			throw new Error(`Revision handoff artifact is stale: ${artifact.path}`);
		}
	}
}

export async function exportNormalRevisionHandoff(
	repositoryRoot = process.cwd(),
	mode: ExportMode = 'dry-run'
): Promise<{
	mode: ExportMode;
	ready: boolean;
	revisedTargetCount: number;
	completeCandidateCount: number;
	artifactCount: number;
	writtenCount: number;
	blockers: string[];
	digest: string | null;
}> {
	const scan = await scanActiveRevisions(repositoryRoot);
	if (mode === 'dry-run') {
		return {
			mode,
			ready: scan.blockers.length === 0,
			revisedTargetCount: scan.revisedTargetCount,
			completeCandidateCount: scan.items.length,
			artifactCount: 0,
			writtenCount: 0,
			blockers: scan.blockers,
			digest: null
		};
	}
	if (scan.blockers.length > 0) {
		throw new Error(`Revision handoff is not ready:\n- ${scan.blockers.join('\n- ')}`);
	}
	const artifacts = await buildArtifacts(scan.items);
	if (mode === 'write') await writeExclusive(repositoryRoot, artifacts);
	else await checkExact(repositoryRoot, artifacts);
	const digest = sha256(
		artifacts.map((artifact) => `${artifact.path}\0${sha256(artifact.bytes)}`).join('\n')
	);
	return {
		mode,
		ready: true,
		revisedTargetCount: scan.revisedTargetCount,
		completeCandidateCount: scan.items.length,
		artifactCount: artifacts.length,
		writtenCount: mode === 'write' ? artifacts.length : 0,
		blockers: [],
		digest
	};
}

async function main(): Promise<void> {
	const arguments_ = process.argv.slice(2);
	const known = new Set(['--dry-run', '--write', '--check']);
	const unknown = arguments_.filter((argument) => !known.has(argument));
	if (unknown.length > 0) throw new Error(`Unknown arguments: ${unknown.join(' ')}`);
	const selected = arguments_.filter((argument) => known.has(argument));
	if (selected.length > 1)
		throw new Error('Choose exactly one mode: --dry-run, --write, or --check');
	const mode: ExportMode = arguments_.includes('--write')
		? 'write'
		: arguments_.includes('--check')
			? 'check'
			: 'dry-run';
	const report = await exportNormalRevisionHandoff(process.cwd(), mode);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (mode === 'dry-run' && !report.ready) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
