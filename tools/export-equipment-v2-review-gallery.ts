import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import {
	EquipmentV2ImageResultSchema,
	EquipmentV2ImageTargetSchema
} from './equipment-image-production-contract-v2.js';
import { EquipmentV2RunPlanSchema } from './equipment-image-run-activation-v2.js';

const RUN_PATH =
	'assets/equipment/experiments/material-equipment-v2/runs/material-equipment-v2-run-001/plan.json';

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
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(' ');
}

export async function exportEquipmentV2ReviewGallery(input: {
	readonly workspaceRoot: string;
	readonly outputPath: string;
}) {
	const plan = EquipmentV2RunPlanSchema.parse(
		JSON.parse(await readFile(path.join(input.workspaceRoot, RUN_PATH), 'utf8')) as unknown
	);
	const cards: string[] = [];
	for (const binding of plan.rootPackets) {
		const target = EquipmentV2ImageTargetSchema.parse(
			JSON.parse(
				await readFile(path.join(input.workspaceRoot, binding.targetPath), 'utf8')
			) as unknown
		);
		const result = EquipmentV2ImageResultSchema.parse(
			JSON.parse(
				await readFile(path.join(input.workspaceRoot, target.output.provenanceResultPath), 'utf8')
			) as unknown
		);
		const label = `${target.material.name} ${title(target.equipment.class)}${target.presentation.mode === 'complete-armour-set' ? ' Set' : ''}`;
		const concern = result.findings.find(
			({ outcome }) => outcome === 'concern' || outcome === 'fail'
		);
		let visual: string;
		if (result.candidate === null) {
			visual = `<div class="missing" aria-hidden="true"><span>×</span><small>No image</small></div>`;
		} else {
			const thumbnail = await sharp(path.join(input.workspaceRoot, result.candidate.path))
				.resize(280, 280, { fit: 'contain', background: '#070b12' })
				.jpeg({ quality: 62, chromaSubsampling: '4:2:0' })
				.toBuffer();
			visual = `<img src="data:image/jpeg;base64,${thumbnail.toString('base64')}" alt="${escapeHtml(label)}">`;
		}
		cards.push(`<button type="button" class="asset" data-rank="${target.material.rank}" data-status="${result.status}" data-name="${escapeHtml(label)}" data-note="${escapeHtml(concern?.criterionId ?? 'All producer checks passed')}" aria-label="Open ${escapeHtml(label)}">
			${visual}
			<span class="meta"><strong>${escapeHtml(label)}</strong><span><b>${target.material.rank}</b> · ${result.humanReviewLabel}${concern ? ` · ${escapeHtml(concern.criterionId)}` : ''}</span></span>
		</button>`);
	}
	const fragment = `<div id="equipment-v2-gallery">
	<style>
		#equipment-v2-gallery { color: var(--foreground); font: 13px/1.35 ui-sans-serif, system-ui, sans-serif; }
		#equipment-v2-gallery .summary { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 18px; margin:0 0 14px; }
		#equipment-v2-gallery h2 { font-size:20px; margin:0 auto 0 0; }
		#equipment-v2-gallery .counts { color:var(--muted-foreground); }
		#equipment-v2-gallery .filters { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 14px; }
		#equipment-v2-gallery .filters button { color:var(--foreground); background:transparent; border:1px solid var(--border); border-radius:6px; padding:5px 9px; cursor:pointer; }
		#equipment-v2-gallery .filters button[aria-pressed="true"] { border-color:var(--foreground); }
		#equipment-v2-gallery .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:9px; }
		#equipment-v2-gallery .asset { color:var(--foreground); background:var(--background); border:2px solid var(--border); border-radius:8px; overflow:hidden; padding:0; text-align:left; cursor:pointer; min-width:0; }
		#equipment-v2-gallery .asset[data-status="candidate"] { border-color:#2f855a; }
		#equipment-v2-gallery .asset[data-status="revise"] { border-color:#b7791f; }
		#equipment-v2-gallery .asset[data-status="failed"] { border-color:#c53030; }
		#equipment-v2-gallery .asset[hidden] { display:none; }
		#equipment-v2-gallery .asset img, #equipment-v2-gallery .missing { display:block; width:100%; aspect-ratio:1; object-fit:contain; background:#070b12; }
		#equipment-v2-gallery .missing { display:grid; place-content:center; text-align:center; color:#fc8181; }
		#equipment-v2-gallery .missing span { font-size:52px; line-height:.8; }
		#equipment-v2-gallery .missing small { margin-top:8px; }
		#equipment-v2-gallery .meta { display:grid; gap:3px; padding:8px; }
		#equipment-v2-gallery .meta strong { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
		#equipment-v2-gallery .meta span { color:var(--muted-foreground); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
		#equipment-v2-gallery .viewer { position:fixed; inset:0; z-index:50; display:grid; place-items:center; background:rgba(0,0,0,.78); padding:24px; }
		#equipment-v2-gallery .viewer[hidden] { display:none; }
		#equipment-v2-gallery .viewer-panel { position:relative; width:min(760px,92vw); max-height:90vh; overflow:auto; background:var(--popover); color:var(--popover-foreground); border:1px solid var(--border); border-radius:10px; padding:14px; }
		#equipment-v2-gallery .viewer img { display:block; max-width:100%; max-height:72vh; margin:auto; image-rendering:auto; }
		#equipment-v2-gallery .viewer h3 { margin:10px 0 2px; }
		#equipment-v2-gallery .viewer p { margin:0; color:var(--muted-foreground); }
		#equipment-v2-gallery .close { position:absolute; top:8px; right:8px; width:32px; height:32px; border:1px solid var(--border); border-radius:6px; background:var(--popover); color:var(--popover-foreground); cursor:pointer; }
	</style>
	<div class="summary"><h2>Equipment v2 · 77 root attempts</h2><span class="counts">37 Pass · 33 Check · 7 No image</span></div>
	<div class="filters" aria-label="Gallery filters">
		<button type="button" data-filter="rank" data-value="all" aria-pressed="true">All ranks</button>
		${['F', 'E', 'D', 'C', 'B', 'A', 'S'].map((rank) => `<button type="button" data-filter="rank" data-value="${rank}" aria-pressed="false">${rank}</button>`).join('')}
		<button type="button" data-filter="status" data-value="all" aria-pressed="true">All states</button>
		<button type="button" data-filter="status" data-value="candidate" aria-pressed="false">Pass</button>
		<button type="button" data-filter="status" data-value="revise" aria-pressed="false">Check</button>
		<button type="button" data-filter="status" data-value="failed" aria-pressed="false">No image</button>
	</div>
	<div class="grid">${cards.join('')}</div>
	<div class="viewer" hidden role="dialog" aria-modal="true" aria-labelledby="equipment-v2-viewer-title"><div class="viewer-panel"><button type="button" class="close" aria-label="Close">×</button><img alt=""><h3 id="equipment-v2-viewer-title"></h3><p></p></div></div>
	<script>
		(() => {
			const root = document.getElementById('equipment-v2-gallery');
			const state = { rank: 'all', status: 'all' };
			const apply = () => root.querySelectorAll('.asset').forEach((card) => { card.hidden = !((state.rank === 'all' || card.dataset.rank === state.rank) && (state.status === 'all' || card.dataset.status === state.status)); });
			root.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { const kind = button.dataset.filter; state[kind] = button.dataset.value; root.querySelectorAll('[data-filter="' + kind + '"]').forEach((peer) => peer.setAttribute('aria-pressed', String(peer === button))); apply(); }));
			const viewer = root.querySelector('.viewer');
			root.querySelectorAll('.asset').forEach((card) => card.addEventListener('click', () => { const source = card.querySelector('img'); const image = viewer.querySelector('img'); image.hidden = !source; if (source) image.src = source.src; viewer.querySelector('h3').textContent = card.dataset.name; viewer.querySelector('p').textContent = card.dataset.status === 'failed' ? 'No image returned in the single permitted call.' : (card.dataset.status === 'candidate' ? 'Pass · awaits human approval' : 'Check · ' + card.dataset.note); viewer.hidden = false; }));
			const close = () => { viewer.hidden = true; };
			viewer.querySelector('.close').addEventListener('click', close);
			viewer.addEventListener('click', (event) => { if (event.target === viewer) close(); });
		})();
	</script>
</div>`;
	await mkdir(path.dirname(input.outputPath), { recursive: true });
	await writeFile(input.outputPath, fragment, 'utf8');
	return { outputPath: input.outputPath, bytes: Buffer.byteLength(fragment), cards: cards.length };
}

const outputIndex = process.argv.indexOf('--output');
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
	const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
	if (!outputPath) throw new Error('Missing --output');
	process.stdout.write(
		`${JSON.stringify(await exportEquipmentV2ReviewGallery({ workspaceRoot: process.cwd(), outputPath: path.resolve(outputPath) }), null, 2)}\n`
	);
}
