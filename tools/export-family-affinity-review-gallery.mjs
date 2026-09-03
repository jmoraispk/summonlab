import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

const ROOT = 'assets/enemies/experiments/family-affinity-v1';
const OUTPUT = 'docs/evidence/enemy-image-review-gallery-v1/index.html';
const AFFINITIES = ['normal', 'fire', 'earth', 'wind', 'water'];
const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5', 'bridge-only'];

function ownedAbsolute(repositoryRoot, ownedPath) {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, ownedPath);
	if (!absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Path escapes repository: ${ownedPath}`);
	}
	return absolute;
}

async function requiredRealFile(repositoryRoot, ownedPath) {
	const absolute = ownedAbsolute(repositoryRoot, ownedPath);
	const metadata = await lstat(absolute);
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error(`Gallery source must be a real file: ${ownedPath}`);
	}
	return readFile(absolute);
}

async function readJson(repositoryRoot, ownedPath) {
	return JSON.parse((await requiredRealFile(repositoryRoot, ownedPath)).toString('utf8'));
}

async function walkPngs(repositoryRoot, ownedDirectory) {
	const paths = [];
	async function visit(directory) {
		const entries = await readdir(ownedAbsolute(repositoryRoot, directory), {
			withFileTypes: true
		});
		for (const entry of entries) {
			const path = `${directory}/${entry.name}`;
			if (entry.isDirectory()) await visit(path);
			else if (entry.isFile() && entry.name.endsWith('.png')) paths.push(path);
			else if (entry.isSymbolicLink())
				throw new Error(`Gallery source cannot be a symlink: ${path}`);
		}
	}
	await visit(ownedDirectory);
	return paths.sort();
}

function versionedAffinity(fileName) {
	const match = /^(normal|fire|earth|wind|water)-v(\d+)\.png$/.exec(fileName);
	if (!match) throw new Error(`Unexpected candidate filename: ${fileName}`);
	return { affinity: match[1], version: Number(match[2]) };
}

function titleCase(value) {
	return value
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function safeJson(value) {
	return JSON.stringify(value).replaceAll('</script', '<\\/script');
}

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

async function loadGalleryData(repositoryRoot) {
	const catalog = await readJson(repositoryRoot, `${ROOT}/review/catalog.json`);
	const manifest = await readJson(repositoryRoot, `${ROOT}/manifest.json`);
	const familyOrder = new Map(catalog.families.map((family, index) => [family.familyId, index]));
	const canonicalActive = new Map();

	for (const family of catalog.families) {
		const summary = await readJson(repositoryRoot, family.summaryPath);
		for (const cell of summary.cells) {
			if (!cell.candidatePath) continue;
			canonicalActive.set(cell.candidatePath, {
				familyId: family.familyId,
				formId: cell.formId,
				affinity: cell.affinity,
				version: cell.activeVersion,
				tier: cell.tier,
				state: cell.state,
				active: true,
				namespace: 'canonical',
				coordinateId: cell.coordinateId
			});
		}
	}

	const bridgeActive = new Map();
	const bridgeByClassAffinity = new Map();
	for (const coordinate of manifest.bridge.activeCoordinates) {
		const target = await readJson(repositoryRoot, coordinate.targetPath);
		const metadata = {
			familyId: coordinate.familyId,
			formId: coordinate.formId,
			classId: coordinate.currentClassId,
			affinity: coordinate.affinity,
			version: coordinate.activeVersion,
			tier: target.tier,
			state: 'candidate',
			active: true,
			namespace: 'bridge',
			coordinateId: coordinate.coordinateId
		};
		bridgeActive.set(target.ownedPaths.candidate, metadata);
		bridgeByClassAffinity.set(`${coordinate.currentClassId}/${coordinate.affinity}`, metadata);
	}

	const canonicalPaths = await walkPngs(repositoryRoot, `${ROOT}/candidates`);
	const bridgePaths = await walkPngs(repositoryRoot, `${ROOT}/bridge/candidates`);
	const images = [];

	for (const imagePath of canonicalPaths) {
		const active = canonicalActive.get(imagePath);
		const segments = imagePath.split('/');
		const familyId = segments.at(-3);
		const formId = segments.at(-2);
		const parsed = versionedAffinity(segments.at(-1));
		const coordinate = `${familyId}/${formId}/${parsed.affinity}`;
		const current = [...canonicalActive.values()].find((item) => item.coordinateId === coordinate);
		images.push({
			...(active ?? {
				familyId,
				formId,
				affinity: parsed.affinity,
				version: parsed.version,
				tier: current?.tier ?? 'unknown',
				state: 'historical',
				active: false,
				namespace: 'canonical',
				coordinateId: coordinate
			}),
			imagePath
		});
	}

	for (const imagePath of bridgePaths) {
		const active = bridgeActive.get(imagePath);
		const segments = imagePath.split('/');
		const classId = segments.at(-2);
		const parsed = versionedAffinity(segments.at(-1));
		const current = bridgeByClassAffinity.get(`${classId}/${parsed.affinity}`);
		images.push({
			...(active ?? {
				familyId: current?.familyId ?? 'bridge-legacy',
				formId: current?.formId ?? classId,
				classId,
				affinity: parsed.affinity,
				version: parsed.version,
				tier: current?.tier ?? 'bridge-only',
				state: 'historical',
				active: false,
				namespace: 'bridge',
				coordinateId: current?.coordinateId ?? `${classId}/bridge-legacy/${parsed.affinity}`
			}),
			imagePath
		});
	}

	images.sort((left, right) => {
		const leftFamily = familyOrder.get(left.familyId) ?? 10_000;
		const rightFamily = familyOrder.get(right.familyId) ?? 10_000;
		return (
			leftFamily - rightFamily ||
			left.familyId.localeCompare(right.familyId) ||
			TIERS.indexOf(left.tier) - TIERS.indexOf(right.tier) ||
			left.formId.localeCompare(right.formId) ||
			AFFINITIES.indexOf(left.affinity) - AFFINITIES.indexOf(right.affinity) ||
			left.version - right.version
		);
	});

	const activeCanonicalCount = images.filter(
		(image) => image.active && image.namespace === 'canonical'
	).length;
	const activeBridgeCount = images.filter(
		(image) => image.active && image.namespace === 'bridge'
	).length;
	const historicalCount = images.filter((image) => !image.active).length;
	if (activeCanonicalCount !== catalog.generatedCount) {
		throw new Error(
			`Expected ${catalog.generatedCount} active canonical images, found ${activeCanonicalCount}`
		);
	}
	if (activeBridgeCount !== catalog.bridgeGeneratedCount) {
		throw new Error(
			`Expected ${catalog.bridgeGeneratedCount} active bridge images, found ${activeBridgeCount}`
		);
	}
	if (images.length !== activeCanonicalCount + activeBridgeCount + historicalCount) {
		throw new Error('Gallery image cardinality is inconsistent');
	}

	return {
		images: images.map((image) => ({
			...image,
			familyLabel: titleCase(image.familyId),
			formLabel: titleCase(image.formId),
			affinityLabel: titleCase(image.affinity),
			imageUrl: `../../../${image.imagePath}`
		})),
		summary: {
			totalCoordinates: catalog.coordinateCount,
			activeCanonicalCount,
			activeBridgeCount,
			activeCount: activeCanonicalCount + activeBridgeCount,
			approvedReviewCount: catalog.approvedReviewCount,
			historicalCount,
			runtimeCount: catalog.runtimeCount,
			familyCount: catalog.familyCount,
			stateCeiling: catalog.stateCeiling
		}
	};
}

function buildHtml(data) {
	const digest = sha256(safeJson(data));
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Summonlab Enemy Image Review</title>
  <style>
    :root {
      color-scheme: dark;
      --ground: #090805;
      --surface: #0c0b08;
      --paper: #f3ead9;
      --muted: #aaa08e;
      --ember: #d4773d;
      --focus: #e5aa73;
      --line: rgba(231, 206, 164, 0.14);
      --line-strong: rgba(231, 206, 164, 0.3);
      --approved: #84ad8f;
      --historical: #8d8793;
      --danger: #d97968;
      --serif: Georgia, 'Times New Roman', serif;
      --utility: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    html { scrollbar-color: #554f43 var(--ground); scrollbar-width: thin; }
    body {
      margin: 0;
      min-width: 20rem;
      background: var(--ground);
      color: var(--paper);
      font-family: var(--serif);
      line-height: 1.5;
    }
    button, input { font: inherit; }
    button, a { -webkit-tap-highlight-color: transparent; }
    button { cursor: pointer; }
    button:focus-visible, input:focus-visible, a:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 3px;
    }
    .shell { width: min(100% - 2rem, 96rem); margin: 0 auto; }
    header { padding: clamp(2.5rem, 6vw, 5.5rem) 0 2rem; border-bottom: 1px solid var(--line); }
    .eyebrow, .utility, .count, .badge, .filter-label, code {
      font-family: var(--utility);
      letter-spacing: 0.06em;
    }
    .eyebrow { color: var(--ember); font-size: 0.76rem; text-transform: uppercase; }
    h1 { max-width: 15ch; margin: 0.55rem 0 0; font-size: clamp(2.5rem, 7vw, 6.5rem); font-weight: 400; line-height: 0.93; }
    .lede { max-width: 66rem; margin: 1.5rem 0 0; color: var(--muted); font-size: clamp(1rem, 1.6vw, 1.28rem); }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-bottom: 1px solid var(--line); }
    .stat { min-height: 7rem; padding: 1.2rem 1rem 1rem 0; border-right: 1px solid var(--line); }
    .stat + .stat { padding-left: 1rem; }
    .stat:last-child { border-right: 0; }
    .stat strong { display: block; font-size: clamp(1.8rem, 4vw, 3.5rem); font-weight: 400; line-height: 1; }
    .stat span { display: block; margin-top: 0.55rem; color: var(--muted); font-family: var(--utility); font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; }
    .review-note { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 0.6fr); gap: 2rem; padding: 1.5rem 0; border-bottom: 1px solid var(--line); }
    .review-note p { margin: 0; }
    .review-note .warning { color: var(--focus); font-family: var(--utility); font-size: 0.76rem; }
    .toolbar { position: sticky; top: 0; z-index: 5; padding: 1rem 0; background: color-mix(in srgb, var(--ground) 94%, transparent); border-bottom: 1px solid var(--line); backdrop-filter: blur(12px); }
    .search-wrap { position: relative; max-width: 34rem; }
    .search-wrap input { width: 100%; min-height: 2.8rem; padding: 0.6rem 3rem 0.6rem 0.8rem; color: var(--paper); background: var(--surface); border: 1px solid var(--line-strong); border-radius: 0.2rem; }
    .search-wrap input::placeholder { color: #857d70; }
    .clear-search { position: absolute; inset: 0.28rem 0.28rem 0.28rem auto; width: 2.2rem; color: var(--muted); background: transparent; border: 0; }
    .clear-search[hidden] { display: none; }
    .filters { display: grid; gap: 0.8rem; margin-top: 1rem; }
    .filter-row { display: flex; align-items: center; gap: 0.45rem; overflow-x: auto; padding: 0.15rem 0 0.35rem; scrollbar-gutter: stable; }
    .filter-label { flex: 0 0 5.5rem; color: var(--muted); font-size: 0.66rem; text-transform: uppercase; }
    .filter-button { min-height: 2.4rem; padding: 0.45rem 0.72rem; color: var(--muted); background: transparent; border: 1px solid var(--line); border-radius: 0.2rem; font-family: var(--utility); font-size: 0.72rem; white-space: nowrap; }
    .filter-button:hover { color: var(--paper); border-color: var(--line-strong); }
    .filter-button[aria-pressed="true"] { color: var(--paper); background: rgba(212, 119, 61, 0.13); border-color: var(--ember); }
    .history-toggle { display: inline-flex; align-items: center; gap: 0.6rem; min-height: 2.4rem; padding: 0.4rem 0.7rem; color: var(--muted); border-left: 1px solid var(--line-strong); font-family: var(--utility); font-size: 0.72rem; white-space: nowrap; }
    .history-toggle input { width: 1.1rem; height: 1.1rem; accent-color: var(--ember); }
    .result-line { display: flex; justify-content: space-between; gap: 1rem; padding: 1.1rem 0; color: var(--muted); border-bottom: 1px solid var(--line); font-family: var(--utility); font-size: 0.75rem; }
    main { padding-bottom: 8rem; }
    .family { border-bottom: 1px solid var(--line); }
    .family-head { display: grid; grid-template-columns: minmax(12rem, 0.75fr) minmax(0, 2.25fr); gap: 1rem; padding: 2.3rem 0 1rem; }
    .family h2 { margin: 0; font-size: clamp(1.6rem, 3vw, 2.8rem); font-weight: 400; }
    .family-meta { align-self: end; color: var(--muted); font-family: var(--utility); font-size: 0.72rem; }
    .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: 1px; margin: 0 0 2.5rem; background: var(--line); border: 1px solid var(--line); }
    .plate { position: relative; min-width: 0; padding: 0; color: inherit; text-align: left; background: var(--surface); border: 0; }
    .plate:hover .image-frame::after { border-color: var(--ember); }
    .image-frame { position: relative; display: block; aspect-ratio: 1 / 1; overflow: hidden; background: #050504; }
    .image-frame::after { content: ''; position: absolute; inset: 0; border: 1px solid transparent; pointer-events: none; }
    .image-frame img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform 180ms ease; }
    .plate:hover img { transform: scale(1.018); }
    .plate-copy { display: grid; grid-template-columns: 1fr auto; gap: 0.7rem; min-height: 6.6rem; padding: 0.85rem; border-top: 1px solid var(--line); }
    .plate h3 { margin: 0; overflow-wrap: anywhere; font-size: 1rem; font-weight: 400; }
    .plate .sub { display: block; margin-top: 0.32rem; color: var(--muted); font-family: var(--utility); font-size: 0.66rem; }
    .tier { color: var(--ember); font-family: var(--utility); font-size: 0.72rem; }
    .badge { position: absolute; top: 0.65rem; left: 0.65rem; padding: 0.25rem 0.38rem; color: var(--paper); background: rgba(9, 8, 5, 0.84); border: 1px solid var(--line-strong); font-size: 0.58rem; text-transform: uppercase; }
    .badge.approved-review { color: #c9e3cd; border-color: rgba(132, 173, 143, 0.7); }
    .badge.historical { color: #c6c0cb; border-color: rgba(141, 135, 147, 0.7); }
    .badge.bridge { top: auto; bottom: 0.65rem; color: var(--focus); }
    .empty { padding: 5rem 0; color: var(--muted); border-bottom: 1px solid var(--line); }
    dialog { width: min(92vw, 86rem); max-height: 92vh; padding: 0; color: var(--paper); background: var(--surface); border: 1px solid var(--line-strong); border-radius: 0.2rem; }
    dialog::backdrop { background: rgba(0, 0, 0, 0.84); }
    .dialog-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 26rem); min-height: min(76vh, 58rem); }
    .dialog-image { display: grid; place-items: center; min-height: 20rem; background: #050504; }
    .dialog-image img { width: 100%; height: 100%; max-height: 86vh; object-fit: contain; }
    .dialog-copy { display: flex; flex-direction: column; gap: 1rem; padding: clamp(1.2rem, 3vw, 2.2rem); border-left: 1px solid var(--line); }
    .dialog-copy h2 { margin: 0; font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 400; line-height: 1; }
    .dialog-copy dl { display: grid; grid-template-columns: 7rem 1fr; gap: 0.6rem; margin: 0; font-family: var(--utility); font-size: 0.72rem; }
    .dialog-copy dt { color: var(--muted); }
    .dialog-copy dd { margin: 0; overflow-wrap: anywhere; }
    .dialog-copy code { display: block; padding: 0.8rem; overflow-wrap: anywhere; color: var(--muted); background: var(--ground); border: 1px solid var(--line); font-size: 0.66rem; }
    .dialog-actions { display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: auto; }
    .dialog-actions a, .dialog-actions button { min-height: 2.6rem; padding: 0.62rem 0.82rem; color: var(--paper); background: transparent; border: 1px solid var(--line-strong); border-radius: 0.2rem; font-family: var(--utility); font-size: 0.72rem; text-decoration: none; }
    .dialog-actions a:hover, .dialog-actions button:hover { border-color: var(--ember); }
    footer { padding: 1.5rem 0 3rem; color: var(--muted); border-top: 1px solid var(--line); font-family: var(--utility); font-size: 0.68rem; }
    @media (max-width: 54rem) {
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .stat:nth-child(2n) { border-right: 0; }
      .stat:last-child { grid-column: 1 / -1; border-top: 1px solid var(--line); }
      .review-note, .family-head { grid-template-columns: 1fr; gap: 0.65rem; }
      .dialog-grid { grid-template-columns: 1fr; }
      .dialog-copy { border-top: 1px solid var(--line); border-left: 0; }
    }
    @media (max-width: 34rem) {
      .shell { width: min(100% - 1rem, 96rem); }
      .summary { grid-template-columns: 1fr 1fr; }
      .stat { min-height: 6rem; }
      .filter-label { flex-basis: 4.25rem; }
      .image-grid { grid-template-columns: 1fr 1fr; }
      .plate-copy { grid-template-columns: 1fr; min-height: 7.4rem; }
      .dialog-copy dl { grid-template-columns: 5.5rem 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
    @media (forced-colors: active) {
      .badge, .filter-button, .dialog-actions a, .dialog-actions button { forced-color-adjust: auto; }
    }
  </style>
</head>
<body>
  <header>
    <div class="shell">
      <div class="eyebrow">Enemy visual production · candidate review</div>
      <h1>The living bestiary</h1>
      <p class="lede">Every generated enemy image in the family-affinity experiment, gathered into one review surface. Active candidates are shown first; superseded attempts remain available for comparison.</p>
    </div>
  </header>

  <section class="shell summary" aria-label="Production summary">
    <div class="stat"><strong>${data.summary.activeCount}</strong><span>Active review candidates</span></div>
    <div class="stat"><strong>${data.summary.activeCanonicalCount}</strong><span>Canonical candidates</span></div>
    <div class="stat"><strong>${data.summary.activeBridgeCount}</strong><span>Bridge candidates</span></div>
    <div class="stat"><strong>${data.summary.approvedReviewCount}</strong><span>Approved for review</span></div>
    <div class="stat"><strong>${data.summary.runtimeCount}</strong><span>Runtime assets</span></div>
  </section>

  <section class="shell review-note" aria-label="Review guidance">
    <p>Review family identity, T1–T5 escalation, combat readability, anatomy, composition, finish, and whether each elemental construction feels physically integrated rather than recolored.</p>
    <p class="warning">Candidate-only evidence. This page cannot approve or promote an image. Historical attempts are hidden by default.</p>
  </section>

  <div class="toolbar">
    <div class="shell">
      <div class="search-wrap">
        <input id="search" type="search" autocomplete="off" aria-label="Search families and forms" placeholder="Search family or form">
        <button class="clear-search" id="clear-search" type="button" aria-label="Clear search" hidden>×</button>
      </div>
      <div class="filters">
        <div class="filter-row" aria-label="Affinity filter">
          <span class="filter-label">Affinity</span>
          ${['all', ...AFFINITIES].map((affinity) => `<button class="filter-button" type="button" data-filter="affinity" data-value="${affinity}" aria-pressed="${affinity === 'all'}">${titleCase(affinity)}</button>`).join('')}
        </div>
        <div class="filter-row" aria-label="Review state filter">
          <span class="filter-label">State</span>
          <button class="filter-button" type="button" data-filter="state" data-value="all" aria-pressed="true">All active</button>
          <button class="filter-button" type="button" data-filter="state" data-value="candidate" aria-pressed="false">Needs review</button>
          <button class="filter-button" type="button" data-filter="state" data-value="approved-review" aria-pressed="false">Approved review</button>
          <label class="history-toggle"><input id="show-history" type="checkbox"> Show ${data.summary.historicalCount} historical attempts</label>
        </div>
      </div>
    </div>
  </div>

  <main class="shell">
    <div class="result-line"><span id="result-count" role="status" aria-live="polite"></span><span>${data.summary.familyCount} canonical families · ${data.summary.totalCoordinates} target coordinates</span></div>
    <div id="gallery"></div>
    <div id="empty" class="empty" hidden>No images match these filters. Clear the search or choose another affinity.</div>
  </main>

  <dialog id="detail" aria-labelledby="detail-title">
    <div class="dialog-grid">
      <div class="dialog-image"><img id="detail-image" alt=""></div>
      <div class="dialog-copy">
        <div class="eyebrow" id="detail-eyebrow"></div>
        <h2 id="detail-title"></h2>
        <dl>
          <dt>Family</dt><dd id="detail-family"></dd>
          <dt>Tier</dt><dd id="detail-tier"></dd>
          <dt>Affinity</dt><dd id="detail-affinity"></dd>
          <dt>Version</dt><dd id="detail-version"></dd>
          <dt>Namespace</dt><dd id="detail-namespace"></dd>
          <dt>Review state</dt><dd id="detail-state"></dd>
        </dl>
        <code id="detail-path"></code>
        <div class="dialog-actions">
          <a id="detail-original" href="" target="_blank" rel="noreferrer">Open original PNG</a>
          <button id="detail-close" type="button">Close</button>
        </div>
      </div>
    </div>
  </dialog>

  <footer><div class="shell">Manifest-bound gallery · ${digest.slice(0, 16)} · generated from review catalog and active manifest</div></footer>

  <script id="gallery-data" type="application/json">${safeJson(data)}</script>
  <script>
    const data = JSON.parse(document.querySelector('#gallery-data').textContent);
    const gallery = document.querySelector('#gallery');
    const empty = document.querySelector('#empty');
    const resultCount = document.querySelector('#result-count');
    const search = document.querySelector('#search');
    const clearSearch = document.querySelector('#clear-search');
    const showHistory = document.querySelector('#show-history');
    const dialog = document.querySelector('#detail');
    const state = { q: '', affinity: 'all', reviewState: 'all', history: false };

    const params = new URLSearchParams(location.search);
    state.q = params.get('q') ?? '';
    state.affinity = params.get('affinity') ?? 'all';
    state.reviewState = params.get('state') ?? 'all';
    state.history = params.get('history') === '1';
    search.value = state.q;
    showHistory.checked = state.history;

    function syncPressed() {
      document.querySelectorAll('[data-filter]').forEach((button) => {
        const key = button.dataset.filter === 'state' ? 'reviewState' : button.dataset.filter;
        button.setAttribute('aria-pressed', String(state[key] === button.dataset.value));
      });
      clearSearch.hidden = state.q.length === 0;
    }

    function syncUrl() {
      const next = new URLSearchParams();
      if (state.q) next.set('q', state.q);
      if (state.affinity !== 'all') next.set('affinity', state.affinity);
      if (state.reviewState !== 'all') next.set('state', state.reviewState);
      if (state.history) next.set('history', '1');
      history.replaceState(null, '', next.size ? '?' + next.toString() : location.pathname);
    }

    function matches(image) {
      const query = state.q.trim().toLocaleLowerCase();
      const searchText = [image.familyLabel, image.formLabel, image.affinityLabel, image.tier, image.coordinateId].join(' ').toLocaleLowerCase();
      return (!query || searchText.includes(query))
        && (state.affinity === 'all' || image.affinity === state.affinity)
        && (state.reviewState === 'all' || image.state === state.reviewState)
        && (image.active || state.history);
    }

    function badgeLabel(image) {
      if (!image.active) return 'Historical';
      if (image.state === 'approved-review') return 'Approved review';
      return 'Candidate';
    }

    function render() {
      const visible = data.images.filter(matches);
      const groups = new Map();
      visible.forEach((image) => {
        if (!groups.has(image.familyId)) groups.set(image.familyId, []);
        groups.get(image.familyId).push(image);
      });
      gallery.replaceChildren();
      for (const [familyId, images] of groups) {
        const section = document.createElement('section');
        section.className = 'family';
        const head = document.createElement('div');
        head.className = 'family-head';
        const title = document.createElement('h2');
        title.textContent = images[0].familyLabel;
        const meta = document.createElement('div');
        meta.className = 'family-meta';
        meta.textContent = images.length + (images.length === 1 ? ' image' : ' images');
        head.append(title, meta);
        const grid = document.createElement('div');
        grid.className = 'image-grid';
        images.forEach((image) => {
          const plate = document.createElement('button');
          plate.type = 'button';
          plate.className = 'plate';
          plate.setAttribute('aria-label', 'Inspect ' + image.formLabel + ', ' + image.affinityLabel + ', ' + image.tier);
          const frame = document.createElement('span');
          frame.className = 'image-frame';
          const img = document.createElement('img');
          img.src = image.imageUrl;
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          const badge = document.createElement('span');
          badge.className = 'badge ' + image.state;
          badge.textContent = badgeLabel(image);
          frame.append(img, badge);
          if (image.namespace === 'bridge') {
            const bridgeBadge = document.createElement('span');
            bridgeBadge.className = 'badge bridge';
            bridgeBadge.textContent = 'Bridge';
            frame.append(bridgeBadge);
          }
          const copy = document.createElement('span');
          copy.className = 'plate-copy';
          const name = document.createElement('span');
          const heading = document.createElement('h3');
          heading.textContent = image.formLabel;
          const sub = document.createElement('span');
          sub.className = 'sub';
          sub.textContent = image.affinityLabel + ' · v' + image.version;
          name.append(heading, sub);
          const tier = document.createElement('span');
          tier.className = 'tier';
          tier.textContent = image.tier;
          copy.append(name, tier);
          plate.append(frame, copy);
          plate.addEventListener('click', () => openDetail(image, plate));
          grid.append(plate);
        });
        section.append(head, grid);
        gallery.append(section);
      }
      empty.hidden = visible.length > 0;
      resultCount.textContent = visible.length + (visible.length === 1 ? ' image shown' : ' images shown');
      syncPressed();
      syncUrl();
    }

    let returnFocus = null;
    function openDetail(image, trigger) {
      returnFocus = trigger;
      document.querySelector('#detail-image').src = image.imageUrl;
      document.querySelector('#detail-image').alt = image.formLabel + ', ' + image.affinityLabel + ' affinity';
      document.querySelector('#detail-eyebrow').textContent = badgeLabel(image);
      document.querySelector('#detail-title').textContent = image.formLabel;
      document.querySelector('#detail-family').textContent = image.familyLabel;
      document.querySelector('#detail-tier').textContent = image.tier;
      document.querySelector('#detail-affinity').textContent = image.affinityLabel;
      document.querySelector('#detail-version').textContent = 'v' + image.version;
      document.querySelector('#detail-namespace').textContent = image.namespace;
      document.querySelector('#detail-state').textContent = badgeLabel(image);
      document.querySelector('#detail-path').textContent = image.imagePath;
      document.querySelector('#detail-original').href = image.imageUrl;
      dialog.showModal();
      document.querySelector('#detail-close').focus();
    }

    dialog.addEventListener('close', () => {
      document.querySelector('#detail-image').removeAttribute('src');
      returnFocus?.focus();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.querySelector('#detail-close').addEventListener('click', () => dialog.close());
    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.filter === 'state') state.reviewState = button.dataset.value;
        else state.affinity = button.dataset.value;
        render();
      });
    });
    search.addEventListener('input', () => { state.q = search.value; render(); });
    clearSearch.addEventListener('click', () => { search.value = ''; state.q = ''; render(); search.focus(); });
    showHistory.addEventListener('change', () => { state.history = showHistory.checked; render(); });
    render();
  </script>
</body>
</html>
`;
}

async function writeAtomic(repositoryRoot, ownedPath, bytes) {
	const absolute = ownedAbsolute(repositoryRoot, ownedPath);
	await mkdir(dirname(absolute), { recursive: true });
	const temporary = `${absolute}.controller-${process.pid}.tmp`;
	await writeFile(temporary, bytes, { flag: 'wx' });
	await rename(temporary, absolute);
}

async function exportGallery(repositoryRoot = process.cwd(), mode = 'check') {
	const data = await loadGalleryData(repositoryRoot);
	const bytes = Buffer.from(buildHtml(data));
	let current = null;
	try {
		current = await requiredRealFile(repositoryRoot, OUTPUT);
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	if (!current?.equals(bytes)) {
		if (mode === 'check') throw new Error(`Enemy review gallery is stale: ${OUTPUT}`);
		await writeAtomic(repositoryRoot, OUTPUT, bytes);
	}
	return {
		output: relative(repositoryRoot, ownedAbsolute(repositoryRoot, OUTPUT)),
		imageCount: data.images.length,
		activeCount: data.summary.activeCount,
		historicalCount: data.summary.historicalCount,
		digest: sha256(bytes)
	};
}

const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length > 0)
	throw new Error(`Unknown arguments: ${unknownArguments.join(' ')}`);
const mode = process.argv.includes('--check') ? 'check' : 'write';
const report = await exportGallery(process.cwd(), mode);
console.log(
	`family-affinity-review-gallery mode=${mode} images=${report.imageCount} active=${report.activeCount} historical=${report.historicalCount} output=${report.output} digest=${report.digest}`
);
