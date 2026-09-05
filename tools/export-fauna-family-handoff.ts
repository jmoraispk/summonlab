import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FAUNA_FAMILY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityResultSchema,
	FamilyAffinityTargetSchema,
	FamilyPacketSchema,
	FaunaFamilyManifestSchema,
	familyAffinityRawSha256,
	familyAffinitySha256,
	familyAffinitySourcePacketBinding,
	stableFamilyAffinityJson,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityCandidateEvidence
} from './family-affinity-production-lib.js';

const INVENTORY_PATH = `${FAUNA_FAMILY_ROOT}/inventory.json`;
const EVIDENCE_INVENTORY_PATH = 'docs/evidence/fauna-family-v1/inventory.json';
const GALLERY_PATH = 'docs/evidence/fauna-family-v1/index.html';
const AFFINITIES = ['normal', 'fire', 'earth', 'wind', 'water'] as const;
const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;
const EXPECTED_COUNTS = {
	familyCount: 8,
	formCount: 40,
	affinityCount: 5,
	coordinateCount: 200,
	targetCount: 200,
	assignmentCount: 200,
	candidateCount: 200,
	resultCount: 200,
	provenanceRecordCount: 200,
	unresolvedProviderFailureCount: 0,
	approvedCount: 0,
	runtimeCount: 0
} as const;

type HandoffArtifact = { path: string; bytes: Buffer };
type ManifestCoordinate = {
	namespace: 'canonical';
	coordinateId: string;
	familyId: string;
	formId: string;
	affinity: (typeof AFFINITIES)[number];
	activeVersion: number;
	targetPath: string;
	targetSha256: string;
	assignmentPath: string;
	assignmentSha256: string;
	status: string;
};
type CoordinateInventory = {
	coordinateId: string;
	affinity: (typeof AFFINITIES)[number];
	activeVersion: number;
	dispatchStatus: string;
	state: 'candidate-only';
	target: { path: string; sha256: string };
	assignment: { path: string; sha256: string };
	candidate: { path: string; sha256: string };
	provenance: {
		path: string;
		sha256: string;
		schemaVersion: 'family-affinity-result-v1';
		producerId: string;
		promptSha256: string;
		sourcePath: string;
		sourceSha256: string;
	};
	unresolvedProviderFailure: null;
	approved: false;
	runtime: false;
};
type FormInventory = {
	formId: string;
	displayName: string;
	tier: (typeof TIERS)[number];
	coordinates: CoordinateInventory[];
};
type FamilyInventory = {
	familyId: string;
	displayName: string;
	sourceRaceNumber: number;
	counts: {
		formCount: 5;
		coordinateCount: 25;
		targetCount: 25;
		assignmentCount: 25;
		candidateCount: 25;
		resultCount: 25;
		provenanceRecordCount: 25;
		unresolvedProviderFailureCount: 0;
		approvedCount: 0;
		runtimeCount: 0;
	};
	forms: FormInventory[];
};

function ownedAbsolute(repositoryRoot: string, repositoryPath: string): string {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, repositoryPath);
	if (!absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Fauna handoff path escapes repository: ${repositoryPath}`);
	}
	return absolute;
}

async function readRealFile(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const root = resolve(repositoryRoot);
	const absolute = ownedAbsolute(root, repositoryPath);
	let cursor = root;
	for (const part of relative(root, absolute).split(sep).filter(Boolean)) {
		cursor = join(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) {
			throw new Error(`Fauna handoff source cannot be a symlink: ${repositoryPath}`);
		}
	}
	const metadata = await lstat(absolute);
	if (!metadata.isFile()) throw new Error(`Fauna handoff source is not a file: ${repositoryPath}`);
	return readFile(absolute);
}

async function listFiles(repositoryRoot: string, repositoryDirectory: string): Promise<string[]> {
	const root = resolve(repositoryRoot);
	const output: string[] = [];
	async function visit(repositoryPath: string): Promise<void> {
		let entries;
		try {
			entries = await readdir(ownedAbsolute(root, repositoryPath), { withFileTypes: true });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw error;
		}
		for (const entry of entries) {
			const child = `${repositoryPath}/${entry.name}`;
			if (entry.isSymbolicLink())
				throw new Error(`Fauna handoff source cannot be a symlink: ${child}`);
			if (entry.isDirectory()) await visit(child);
			else if (entry.isFile()) output.push(child);
		}
	}
	await visit(repositoryDirectory);
	return output.sort();
}

function assertExactFileSet(label: string, actual: string[], expected: string[]): void {
	const sortedExpected = [...expected].sort();
	if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
		const expectedSet = new Set(sortedExpected);
		const actualSet = new Set(actual);
		const missing = sortedExpected.filter((path) => !actualSet.has(path));
		const unexpected = actual.filter((path) => !expectedSet.has(path));
		throw new Error(
			`${label} inventory mismatch: ${missing.length} missing, ${unexpected.length} unexpected` +
				(missing[0] ? `; first missing ${missing[0]}` : '') +
				(unexpected[0] ? `; first unexpected ${unexpected[0]}` : '')
		);
	}
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function buildGallery(inventory: {
	counts: typeof EXPECTED_COUNTS;
	families: FamilyInventory[];
}): Buffer {
	const inventoryDigest = createHash('sha256')
		.update(stableFamilyAffinityJson(inventory))
		.digest('hex');
	const familySections = inventory.families
		.map((family) => {
			const forms = family.forms
				.map((form) => {
					const cards = form.coordinates
						.map((coordinate) => {
							const imageUrl = `../../../${coordinate.candidate.path}`;
							return `<a class="candidate-card" href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener" data-affinity="${coordinate.affinity}">
  <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${form.displayName}, ${coordinate.affinity} candidate`)}" loading="lazy" decoding="async">
  <span><strong>${escapeHtml(coordinate.affinity[0]!.toUpperCase() + coordinate.affinity.slice(1))}</strong><small>v${coordinate.activeVersion} · candidate-only</small></span>
</a>`;
						})
						.join('\n');
					return `<section class="form" id="${escapeHtml(form.formId)}">
  <div class="form-heading"><span>${form.tier}</span><h3>${escapeHtml(form.displayName)}</h3></div>
  <div class="candidate-grid">${cards}</div>
</section>`;
				})
				.join('\n');
			return `<section class="family" id="family-${escapeHtml(family.familyId)}">
  <header class="family-heading"><p>${String(family.sourceRaceNumber).padStart(2, '0')} · fauna family</p><h2>${escapeHtml(family.displayName)}</h2><span>5 forms · 25 candidates</span></header>
  ${forms}
</section>`;
		})
		.join('\n');
	return Buffer.from(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="fauna-inventory-sha256" content="${inventoryDigest}">
  <title>Summonlab Fauna Candidate Matrix</title>
  <style>
    :root { color-scheme: dark; --ground:#090805; --surface:#12100c; --paper:#f1e6d4; --muted:#aa9f8d; --ember:#d4773d; --line:rgba(231,206,164,.17); font-family:Georgia,'Times New Roman',serif; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--ground); color:var(--paper); line-height:1.45; }
    a { color:inherit; }
    .shell { width:min(100% - 2rem, 104rem); margin:auto; }
    .hero { padding:4rem 0 2rem; border-bottom:1px solid var(--line); }
    .hero p, .family-heading p, small, .state, footer { color:var(--muted); font: .74rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em; text-transform:uppercase; }
    h1 { max-width:14ch; margin:.35rem 0 1rem; font-size:clamp(2.7rem,7vw,6.5rem); font-weight:400; line-height:.95; }
    .state { color:#ecc08a; }
    nav { display:flex; gap:.5rem; overflow:auto; padding:1rem 0; position:sticky; top:0; z-index:5; background:rgba(9,8,5,.95); border-bottom:1px solid var(--line); }
    nav a { padding:.45rem .65rem; border:1px solid var(--line); text-decoration:none; white-space:nowrap; font: .72rem ui-monospace,SFMono-Regular,Menlo,monospace; }
    .family { padding:3rem 0; border-bottom:1px solid var(--line); }
    .family-heading { display:grid; grid-template-columns:1fr auto; align-items:end; gap:.5rem 1rem; margin-bottom:1.5rem; }
    .family-heading p { grid-column:1 / -1; margin:0; color:var(--ember); }
    .family-heading h2 { margin:0; font-size:clamp(2rem,4vw,4rem); font-weight:400; }
    .family-heading span { color:var(--muted); }
    .form { display:grid; grid-template-columns:minmax(10rem,15rem) 1fr; gap:1rem; padding:1.2rem 0; border-top:1px solid var(--line); }
    .form-heading span { color:var(--ember); font: .75rem ui-monospace,SFMono-Regular,Menlo,monospace; }
    .form-heading h3 { margin:.3rem 0; font-size:1.45rem; font-weight:400; }
    .candidate-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:1px; background:var(--line); border:1px solid var(--line); }
    .candidate-card { min-width:0; background:var(--surface); text-decoration:none; }
    .candidate-card img { display:block; width:100%; aspect-ratio:5/4; object-fit:cover; background:#050504; }
    .candidate-card > span { display:block; padding:.65rem; }
    .candidate-card strong, .candidate-card small { display:block; overflow:hidden; text-overflow:ellipsis; }
    .candidate-card:hover { outline:1px solid var(--ember); outline-offset:-1px; }
    footer { padding:2rem 0 5rem; text-transform:none; overflow-wrap:anywhere; }
    @media (max-width:72rem) { .candidate-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
    @media (max-width:48rem) { .form { grid-template-columns:1fr; } .candidate-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:28rem) { .candidate-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="shell">
    <header class="hero">
      <p>Summonlab · Enemies visual production</p>
      <h1>Eight-family fauna matrix</h1>
      <p class="state">Candidate-only · 0 approved · 0 runtime</p>
      <p>200 individual images · 8 families · 40 T1–T5 forms · Normal, Fire, Earth, Wind, Water</p>
    </header>
    <nav aria-label="Family index">${inventory.families.map((family) => `<a href="#family-${escapeHtml(family.familyId)}">${escapeHtml(family.displayName)}</a>`).join('')}</nav>
    <main>${familySections}</main>
    <footer>Inventory SHA-256: ${inventoryDigest}. Select any image to open the original full-resolution candidate in a new tab.</footer>
  </div>
</body>
</html>
`);
}

export async function buildFaunaFamilyHandoff(repositoryRootInput: string): Promise<{
	manifestBytes: Buffer;
	inventoryBytes: Buffer;
	evidenceInventoryBytes: Buffer;
	galleryBytes: Buffer;
	artifacts: HandoffArtifact[];
}> {
	const repositoryRoot = resolve(repositoryRootInput);
	const manifestPath = `${FAUNA_FAMILY_ROOT}/manifest.json`;
	const manifestBytes = await readRealFile(repositoryRoot, manifestPath);
	const manifest = FaunaFamilyManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8'))) as {
		status: string;
		production: Record<string, unknown>;
		canonicalMatrix: { activeCoordinates: ManifestCoordinate[] };
	};
	const activeSources = JSON.parse(
		(await readRealFile(repositoryRoot, `${FAUNA_FAMILY_ROOT}/active-sources.json`)).toString(
			'utf8'
		)
	) as { familyPacketPaths: string[] };
	if (
		!Array.isArray(activeSources.familyPacketPaths) ||
		activeSources.familyPacketPaths.length !== 8
	) {
		throw new Error('Fauna handoff requires eight ordered family packets');
	}
	const families = await Promise.all(
		activeSources.familyPacketPaths.map(async (path) =>
			FamilyPacketSchema.parse(
				JSON.parse((await readRealFile(repositoryRoot, path)).toString('utf8'))
			)
		)
	);
	const coordinateById = new Map(
		manifest.canonicalMatrix.activeCoordinates.map((coordinate) => [
			coordinate.coordinateId,
			coordinate
		])
	);
	if (coordinateById.size !== 200) throw new Error('Fauna handoff requires 200 unique coordinates');

	const expectedTargetPaths: string[] = [];
	const expectedAssignmentPaths: string[] = [];
	const expectedCandidatePaths: string[] = [];
	const expectedResultPaths: string[] = [];
	const familyInventories: FamilyInventory[] = [];
	for (const family of families) {
		const forms: FormInventory[] = [];
		for (const form of family.forms) {
			const coordinates: CoordinateInventory[] = [];
			for (const affinity of AFFINITIES) {
				const coordinateId = `${family.familyId}/${form.formId}/${affinity}`;
				const coordinate = coordinateById.get(coordinateId);
				if (!coordinate) throw new Error(`Missing fauna manifest coordinate: ${coordinateId}`);
				const [targetBytes, assignmentBytes] = await Promise.all([
					readRealFile(repositoryRoot, coordinate.targetPath),
					readRealFile(repositoryRoot, coordinate.assignmentPath)
				]);
				const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
				const assignment = FamilyAffinityAssignmentSchema.parse(
					JSON.parse(assignmentBytes.toString('utf8'))
				);
				validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
				const source = familyAffinitySourcePacketBinding(target);
				const [sourceBytes, candidateBytes, resultBytes] = await Promise.all([
					readRealFile(repositoryRoot, source.path),
					readRealFile(repositoryRoot, target.ownedPaths.candidate),
					readRealFile(repositoryRoot, target.ownedPaths.result)
				]);
				const evidence = validateFamilyAffinityCandidateEvidence({
					target,
					assignment,
					familyPacketBytes: sourceBytes,
					candidateBytes,
					resultBytes
				});
				const result = FamilyAffinityResultSchema.parse(JSON.parse(resultBytes.toString('utf8')));
				expectedTargetPaths.push(coordinate.targetPath);
				expectedAssignmentPaths.push(coordinate.assignmentPath);
				expectedCandidatePaths.push(target.ownedPaths.candidate);
				expectedResultPaths.push(target.ownedPaths.result);
				coordinates.push({
					coordinateId,
					affinity,
					activeVersion: coordinate.activeVersion,
					dispatchStatus: coordinate.status,
					state: 'candidate-only',
					target: { path: coordinate.targetPath, sha256: familyAffinitySha256(target) },
					assignment: {
						path: coordinate.assignmentPath,
						sha256: familyAffinitySha256(assignment)
					},
					candidate: {
						path: target.ownedPaths.candidate,
						sha256: familyAffinityRawSha256(candidateBytes)
					},
					provenance: {
						path: target.ownedPaths.result,
						sha256: evidence.resultSha256,
						schemaVersion: 'family-affinity-result-v1',
						producerId: result.producerId,
						promptSha256: result.promptSha256,
						sourcePath: result.sourcePath,
						sourceSha256: result.sourceSha256
					},
					unresolvedProviderFailure: null,
					approved: false,
					runtime: false
				});
			}
			forms.push({
				formId: form.formId,
				displayName: form.displayName,
				tier: form.tier,
				coordinates
			});
		}
		familyInventories.push({
			familyId: family.familyId,
			displayName: family.displayName,
			sourceRaceNumber: family.sourceRaceNumber,
			counts: {
				formCount: 5,
				coordinateCount: 25,
				targetCount: 25,
				assignmentCount: 25,
				candidateCount: 25,
				resultCount: 25,
				provenanceRecordCount: 25,
				unresolvedProviderFailureCount: 0,
				approvedCount: 0,
				runtimeCount: 0
			},
			forms
		});
	}

	await Promise.all([
		listFiles(repositoryRoot, `${FAUNA_FAMILY_ROOT}/targets`).then((paths) =>
			assertExactFileSet('Fauna target', paths, expectedTargetPaths)
		),
		listFiles(repositoryRoot, `${FAUNA_FAMILY_ROOT}/assignments`).then((paths) =>
			assertExactFileSet('Fauna assignment', paths, expectedAssignmentPaths)
		),
		listFiles(repositoryRoot, `${FAUNA_FAMILY_ROOT}/candidates`).then((paths) =>
			assertExactFileSet('Fauna candidate', paths, expectedCandidatePaths)
		),
		listFiles(repositoryRoot, `${FAUNA_FAMILY_ROOT}/results`).then((paths) =>
			assertExactFileSet('Fauna result', paths, expectedResultPaths)
		)
	]);
	const failureFiles = await listFiles(repositoryRoot, `${FAUNA_FAMILY_ROOT}/generation-failures`);
	if (failureFiles.length !== 0) {
		throw new Error(`Fauna handoff has ${failureFiles.length} unresolved generation-failure files`);
	}

	const inventory = {
		schemaVersion: 'fauna-family-candidate-inventory-v1',
		experimentId: 'fauna-family-v1',
		stateCeiling: 'candidate-only',
		manifestPath,
		affinities: AFFINITIES,
		counts: EXPECTED_COUNTS,
		families: familyInventories
	};
	const inventoryOutputBytes = Buffer.from(stableFamilyAffinityJson(inventory));
	const finalManifest = {
		...manifest,
		status: 'candidate-matrix-complete',
		production: {
			...manifest.production,
			candidateCount: 200,
			resultCount: 200,
			provenanceRecordCount: 200,
			unresolvedProviderFailureCount: 0,
			approvedCount: 0,
			runtimeCount: 0,
			inventoryPath: INVENTORY_PATH,
			evidenceInventoryPath: EVIDENCE_INVENTORY_PATH,
			reviewGalleryPath: GALLERY_PATH
		}
	};
	const finalManifestBytes = Buffer.from(stableFamilyAffinityJson(finalManifest));
	const galleryBytes = buildGallery(inventory);
	const artifacts: HandoffArtifact[] = [
		{ path: INVENTORY_PATH, bytes: inventoryOutputBytes },
		{ path: EVIDENCE_INVENTORY_PATH, bytes: inventoryOutputBytes },
		{ path: GALLERY_PATH, bytes: galleryBytes },
		{ path: manifestPath, bytes: finalManifestBytes }
	];
	return {
		manifestBytes: finalManifestBytes,
		inventoryBytes: inventoryOutputBytes,
		evidenceInventoryBytes: inventoryOutputBytes,
		galleryBytes,
		artifacts
	};
}

async function replaceAtomic(
	repositoryRoot: string,
	repositoryPath: string,
	bytes: Buffer
): Promise<void> {
	const absolute = ownedAbsolute(repositoryRoot, repositoryPath);
	await mkdir(dirname(absolute), { recursive: true });
	const temporary = `${absolute}.fauna-handoff-${process.pid}`;
	try {
		await writeFile(temporary, bytes, { flag: 'wx' });
		await rename(temporary, absolute);
	} finally {
		await unlink(temporary).catch(() => undefined);
	}
}

export async function exportFaunaFamilyHandoff(
	repositoryRoot: string,
	mode: 'write' | 'check'
): Promise<{
	mode: 'write' | 'check';
	familyCount: 8;
	formCount: 40;
	candidateCount: 200;
	approvedCount: 0;
	runtimeCount: 0;
	artifacts: string[];
}> {
	const handoff = await buildFaunaFamilyHandoff(repositoryRoot);
	if (mode === 'write') {
		for (const artifact of handoff.artifacts) {
			await replaceAtomic(repositoryRoot, artifact.path, artifact.bytes);
		}
	} else {
		for (const artifact of handoff.artifacts) {
			const actual = await readRealFile(repositoryRoot, artifact.path);
			if (!actual.equals(artifact.bytes)) {
				throw new Error(`Fauna handoff artifact is stale: ${artifact.path}`);
			}
		}
	}
	return {
		mode,
		familyCount: 8,
		formCount: 40,
		candidateCount: 200,
		approvedCount: 0,
		runtimeCount: 0,
		artifacts: handoff.artifacts.map(({ path }) => path)
	};
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
	const write = process.argv.includes('--write');
	const check = process.argv.includes('--check');
	const unknown = process.argv
		.slice(2)
		.filter((argument) => argument !== '--write' && argument !== '--check');
	if (unknown.length > 0 || write === check) {
		throw new Error('Pass exactly one of --write or --check');
	}
	exportFaunaFamilyHandoff(process.cwd(), write ? 'write' : 'check')
		.then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		});
}
