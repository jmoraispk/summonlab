<script lang="ts">
	import { resolve } from '$app/paths';
	import HeroRig from '$lib/components/HeroRig.svelte';
	import type {
		RecognitionCueOutcome,
		RecognitionReviewRecord,
		RecognitionReviewVerdict,
		VisualRecognitionCue
	} from '@summonlab/contracts';
	import { onMount } from 'svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let selectedCaseId = $state(data.audit.cases[0]!.caseId);
	let observedFps = $state<number | null>(null);
	let interactionLatencyMs = $state<number | null>(null);
	let observedViewport = $state('measuring');
	let reducedMotion = $state(false);
	// svelte-ignore state_referenced_locally
	let reviewHistory = $state<RecognitionReviewRecord[]>([...data.recognitionReviews.reviews]);
	let outcomeDraft = $state<
		Partial<Record<VisualRecognitionCue, RecognitionCueOutcome['verdict']>>
	>({});
	let overallVerdict = $state<RecognitionReviewVerdict>('pass');
	let reviewer = $state('project-lead');
	let reviewNote = $state('');
	let reviewStatus = $state('');
	let reviewSubmitting = $state(false);

	const selectedCase = $derived(
		data.audit.cases.find((entry) => entry.caseId === selectedCaseId) ?? data.audit.cases[0]!
	);
	const encodedBudgetPercent = $derived(
		(data.audit.phoneDelivery.totalEncodedBytes /
			data.audit.phoneDelivery.visualPayloadBudgetBytes) *
			100
	);
	const decodedReferencePercent = $derived(
		(data.audit.phoneDelivery.totalDecodedRgbaBytes /
			data.audit.phoneDelivery.textureMemoryReferenceBytes) *
			100
	);
	const latestByCase = $derived.by(() => {
		const latest: Record<string, RecognitionReviewRecord> = {};
		for (const review of reviewHistory) latest[review.caseId] = review;
		return latest;
	});
	const selectedLatest = $derived(latestByCase[selectedCaseId]);
	const completedCaseCount = $derived(Object.keys(latestByCase).length);
	const allCuesAnswered = $derived(
		selectedCase.requiredCues.every((cue) => outcomeDraft[cue] !== undefined)
	);
	const allCuesPass = $derived(
		allCuesAnswered && selectedCase.requiredCues.every((cue) => outcomeDraft[cue] === 'pass')
	);
	const cues: readonly { key: VisualRecognitionCue; label: string }[] = [
		{ key: 'face', label: 'Face' },
		{ key: 'hair', label: 'Hair mass' },
		{ key: 'silhouette', label: 'Silhouette' },
		{ key: 'palette', label: 'Palette' },
		{ key: 'signature-traits', label: 'Clasp + posture' }
	];

	function kilobytes(bytes: number): string {
		return `${(bytes / 1000).toFixed(1)} KB`;
	}

	function megabytes(bytes: number): string {
		return `${(bytes / 1_000_000).toFixed(2)} MB`;
	}

	function chooseCase(caseId: string): void {
		const startedAt = performance.now();
		selectedCaseId = caseId;
		loadDraft(caseId);
		reviewStatus = '';
		requestAnimationFrame(() => {
			interactionLatencyMs = performance.now() - startedAt;
		});
	}

	function loadDraft(caseId: string): void {
		const latest = reviewHistory.findLast((review) => review.caseId === caseId);
		outcomeDraft = Object.fromEntries(
			(latest?.outcomes ?? []).map((outcome) => [outcome.cue, outcome.verdict])
		);
		overallVerdict = latest?.verdict ?? 'pass';
		reviewNote = '';
	}

	function setCue(cue: VisualRecognitionCue, verdict: RecognitionCueOutcome['verdict']): void {
		outcomeDraft = { ...outcomeDraft, [cue]: verdict };
		if (verdict === 'fail') overallVerdict = 'revise';
	}

	async function submitRecognitionReview(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!allCuesAnswered || !reviewNote.trim() || !reviewer.trim()) return;
		if (overallVerdict === 'pass' && !allCuesPass) {
			reviewStatus = 'Resolve each failed cue or record an overall revision.';
			return;
		}
		reviewSubmitting = true;
		reviewStatus = 'Recording hash-bound evidence…';
		try {
			const response = await fetch(resolve('/api/dev/recognition-reviews'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					reviewId: crypto.randomUUID(),
					auditHash: data.audit.auditHash,
					catalogVersion: data.audit.catalogVersion,
					characterId: data.audit.characterId,
					caseId: selectedCase.caseId,
					outcomes: selectedCase.requiredCues.map((cue) => ({
						cue,
						verdict: outcomeDraft[cue]
					})),
					verdict: overallVerdict,
					note: reviewNote.trim(),
					reviewer: reviewer.trim()
				})
			});
			const body = (await response.json()) as RecognitionReviewRecord & { message?: string };
			if (!response.ok) throw new Error(body.message ?? 'The review could not be recorded.');
			reviewHistory = [...reviewHistory, body];
			reviewNote = '';
			reviewStatus = `Recorded ${body.verdict} evidence for ${selectedCase.label}.`;
		} catch (error) {
			reviewStatus = error instanceof Error ? error.message : 'The review could not be recorded.';
		} finally {
			reviewSubmitting = false;
		}
	}

	onMount(() => {
		loadDraft(selectedCaseId);
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		observedViewport = `${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio.toFixed(1)}×`;
		let frames = 0;
		let startedAt = 0;
		let frameId = 0;
		const sample = (timestamp: number) => {
			if (startedAt === 0) startedAt = timestamp;
			frames += 1;
			const elapsed = timestamp - startedAt;
			if (elapsed >= 750) {
				observedFps = (frames * 1000) / elapsed;
				return;
			}
			frameId = requestAnimationFrame(sample);
		};
		frameId = requestAnimationFrame(sample);
		return () => cancelAnimationFrame(frameId);
	});
</script>

<svelte:head>
	<title>Recognition stress lab · summonlab</title>
	<meta
		name="description"
		content="Stress one approved Summonlab identity across camera distance, expression, equipment, injury, and a measured phone delivery profile."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>ART-008</span><strong>Recognition stress lab</strong></div>
		<nav aria-label="Visual lab links">
			<a href={resolve('/visual-lab')}>Continuity</a>
			<a href={resolve('/visual-lab/runtime-bundles')}>Runtime</a>
			<a href={resolve('/forge')}>Forge</a>
		</nav>
	</header>

	<section class="opening">
		<div class="opening-copy">
			<p class="eyebrow">One approved identity · seven controlled stresses</p>
			<h1>Recognize her<br /><em>before the name.</em></h1>
			<p>
				This instrument never approves art automatically. It fixes the camera, expression, palette,
				equipment, motion, and required identity cues so a human can judge the same person under
				repeatable pressure.
			</p>
			<div class="identity-seal">
				<span>{data.character.manifest.displayName}</span>
				<code>{data.audit.manifestHash.slice(0, 16)}</code>
				<strong>{data.audit.humanReviewStatus.replaceAll('-', ' ')}</strong>
			</div>
		</div>

		<div class="stage" data-testid="recognition-stage">
			<div class="stage-grid" aria-hidden="true"></div>
			<div
				class="actual-scale"
				style={`--audit-width:${selectedCase.displayCssWidth}px;--audit-height:${selectedCase.displayCssHeight}px`}
			>
				<HeroRig
					manifest={data.character.manifest}
					profile={data.profile}
					expression={selectedCase.expression}
					equipment={selectedCase.equipment}
					paletteMode={selectedCase.paletteMode}
					walking={selectedCase.walking}
					compact
				/>
			</div>
			<div class="stage-caption">
				<div>
					<span>{selectedCase.cameraTier} camera</span>
					<strong>{selectedCase.label}</strong>
				</div>
				<code>{selectedCase.displayCssWidth}×{selectedCase.displayCssHeight} CSS px</code>
			</div>
			<div class="scale-mark" aria-hidden="true"><span>actual CSS scale</span></div>
		</div>
	</section>

	<section class="case-switcher" aria-labelledby="case-heading">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Controlled matrix</p>
				<h2 id="case-heading">Change one state.<br />Keep the person.</h2>
			</div>
			<strong
				>{data.audit.cases.length} cases · {data.audit.coverage.expressions.length} expressions</strong
			>
		</header>
		<div class="case-grid" role="radiogroup" aria-label="Recognition audit case">
			{#each data.audit.cases as entry, index (entry.caseId)}
				<button
					type="button"
					class:selected={entry.caseId === selectedCaseId}
					role="radio"
					aria-checked={entry.caseId === selectedCaseId}
					onclick={() => chooseCase(entry.caseId)}
				>
					<i>{String(index + 1).padStart(2, '0')}</i>
					<span>{entry.cameraTier}</span>
					<strong>{entry.label}</strong>
					<small>{entry.expression} · {entry.paletteMode}</small>
					<b class:passed={latestByCase[entry.caseId]?.verdict === 'pass'}
						>{latestByCase[entry.caseId]?.verdict ?? 'open'}</b
					>
				</button>
			{/each}
		</div>

		<div class="case-detail">
			<div class="cue-matrix" data-testid="recognition-cues">
				{#each cues as cue (cue.key)}
					{@const required = selectedCase.requiredCues.includes(cue.key)}
					<div class:required class:not-claimed={!required}>
						<span>{cue.label}</span>
						<strong>{required ? 'human check required' : 'not claimed at this distance'}</strong>
					</div>
				{/each}
			</div>
			<article class="review-prompt">
				<p class="eyebrow">Question for the eye</p>
				<blockquote>{selectedCase.reviewPrompt}</blockquote>
				<div>
					<span>State layers</span>
					{#each selectedCase.requiredStateLayers as layer (layer)}<code>{layer}</code>{/each}
				</div>
			</article>
		</div>

		<section class="review-console" aria-labelledby="review-heading" data-testid="review-console">
			<header>
				<div>
					<p class="eyebrow">Durable human evidence</p>
					<h3 id="review-heading">Judge every claimed cue.</h3>
				</div>
				<div class="review-progress">
					<strong>{completedCaseCount}/{data.audit.cases.length}</strong>
					<span>cases reviewed</span>
					<progress
						aria-label="Recognition cases reviewed"
						value={completedCaseCount}
						max={data.audit.cases.length}
					></progress>
				</div>
			</header>

			{#if !data.reviewPersistenceAvailable}
				<p class="persistence-warning" role="status">
					Review storage is offline. Start the local stack with <code>pnpm dev</code> before recording
					evidence.
				</p>
			{:else}
				<form onsubmit={submitRecognitionReview}>
					<div class="review-context">
						<div>
							<span>Selected case</span><strong>{selectedCase.label}</strong>
						</div>
						<div>
							<span>Latest evidence</span><strong class:passing={selectedLatest?.verdict === 'pass'}
								>{selectedLatest?.verdict ?? 'unreviewed'}</strong
							>
						</div>
					</div>

					<div class="cue-decisions">
						{#each selectedCase.requiredCues as cue (cue)}
							<fieldset>
								<legend>{cues.find((entry) => entry.key === cue)?.label ?? cue}</legend>
								<button
									type="button"
									class:active={outcomeDraft[cue] === 'pass'}
									aria-pressed={outcomeDraft[cue] === 'pass'}
									onclick={() => setCue(cue, 'pass')}>Pass</button
								>
								<button
									type="button"
									class:active={outcomeDraft[cue] === 'fail'}
									class:failed={outcomeDraft[cue] === 'fail'}
									aria-pressed={outcomeDraft[cue] === 'fail'}
									onclick={() => setCue(cue, 'fail')}>Fail</button
								>
							</fieldset>
						{/each}
					</div>

					<div class="overall-decision">
						<span>Overall evidence</span>
						<button
							type="button"
							class:active={overallVerdict === 'pass'}
							disabled={!allCuesPass}
							onclick={() => (overallVerdict = 'pass')}>Pass</button
						>
						<button
							type="button"
							class:active={overallVerdict === 'revise'}
							onclick={() => (overallVerdict = 'revise')}>Revise</button
						>
						<small>All cues must pass for an overall pass. This never approves the asset.</small>
					</div>

					<div class="review-fields">
						<label>
							<span>Reviewer</span>
							<input bind:value={reviewer} maxlength="80" required />
						</label>
						<label>
							<span>Observation</span>
							<textarea bind:value={reviewNote} maxlength="1000" rows="3" required></textarea>
						</label>
					</div>
					<div class="review-submit">
						<button
							type="submit"
							disabled={!allCuesAnswered ||
								!reviewNote.trim() ||
								!reviewer.trim() ||
								reviewSubmitting}
							>{reviewSubmitting ? 'Recording…' : `Record ${overallVerdict}`}</button
						>
						<p aria-live="polite">{reviewStatus}</p>
					</div>
				</form>
			{/if}
		</section>
	</section>

	<section class="phone-audit" aria-labelledby="phone-heading">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Measured delivery · 390×844 at 2×</p>
				<h2 id="phone-heading">Enough pixels.<br />No mystery weight.</h2>
			</div>
			<strong>{kilobytes(data.audit.phoneDelivery.totalEncodedBytes)} over the wire</strong>
		</header>

		<div class="phone-grid">
			<article class="device">
				<div class="device-screen">
					<div class="notch"></div>
					<div class="mini-stage">
						<HeroRig
							manifest={data.character.manifest}
							profile={data.profile}
							expression="alert"
							paletteMode="base"
							compact
						/>
					</div>
					<div class="phone-copy">
						<span>dialogue target</span><strong>160 × 240 CSS px</strong>
					</div>
				</div>
				<small>Scaled representation of the audited viewport</small>
			</article>

			<div class="texture-ledger" data-testid="phone-texture-ledger">
				{#each data.audit.phoneDelivery.textures as texture (texture.alias)}
					<article>
						<div class="texture-name">
							<span>{texture.usage}</span>
							<strong>{texture.width}×{texture.height}</strong>
						</div>
						<div class="density">
							<i style={`--density:${Math.min(texture.densityMargin / 2, 1) * 100}%`}></i>
						</div>
						<dl>
							<div>
								<dt>2× need</dt>
								<dd>{texture.requiredPixelWidth}×{texture.requiredPixelHeight}</dd>
							</div>
							<div>
								<dt>margin</dt>
								<dd>{texture.densityMargin.toFixed(2)}×</dd>
							</div>
							<div>
								<dt>wire</dt>
								<dd>{kilobytes(texture.encodedBytes)}</dd>
							</div>
							<div>
								<dt>RGBA</dt>
								<dd>{megabytes(texture.decodedRgbaBytes)}</dd>
							</div>
						</dl>
						<code>{texture.alias}</code>
					</article>
				{/each}
			</div>

			<aside class="budget-card">
				<p class="eyebrow">Budget truth</p>
				<div class="budget-ring" style={`--used:${Math.max(encodedBudgetPercent, 1.2)}%`}>
					<strong>{encodedBudgetPercent.toFixed(2)}%</strong><span>8 MB payload</span>
				</div>
				<dl>
					<div>
						<dt>Texture transfer</dt>
						<dd>{kilobytes(data.audit.phoneDelivery.totalEncodedBytes)}</dd>
					</div>
					<div>
						<dt>Decoded RGBA proxy</dt>
						<dd>{megabytes(data.audit.phoneDelivery.totalDecodedRgbaBytes)}</dd>
					</div>
					<div>
						<dt>300 MB reference</dt>
						<dd>{decodedReferencePercent.toFixed(2)}%</dd>
					</div>
					<div>
						<dt>Audit JS gzip</dt>
						<dd>
							{kilobytes(data.buildBudget.measurements.recognitionAuditLoadedJavaScriptGzipBytes)}
						</dd>
					</div>
				</dl>
				<p>
					The RGBA total is a texture-only proxy, not a claim about complete renderer or device
					memory.
				</p>
			</aside>
		</div>
	</section>

	<section class="telemetry" aria-labelledby="telemetry-heading">
		<div>
			<p class="eyebrow">Live browser observation</p>
			<h2 id="telemetry-heading">Measure this run.</h2>
			<p>
				These values describe the current browser, not the deterministic artifact. CI checks the
				structural budgets; real-device review remains a milestone gate.
			</p>
		</div>
		<div class="telemetry-grid">
			<article data-testid="observed-fps">
				<span>animation sample</span><strong
					>{observedFps === null ? '…' : `${observedFps.toFixed(1)} fps`}</strong
				>
				<small>750 ms requestAnimationFrame window</small>
			</article>
			<article data-testid="interaction-latency">
				<span>case switch → paint</span><strong
					>{interactionLatencyMs === null
						? 'tap a case'
						: `${interactionLatencyMs.toFixed(1)} ms`}</strong
				>
				<small>target under 150 ms on phone</small>
			</article>
			<article>
				<span>observed viewport</span><strong>{observedViewport}</strong>
				<small>{reducedMotion ? 'reduced motion active' : 'motion allowed'}</small>
			</article>
			<article>
				<span>audit identity</span><strong>{data.audit.auditHash.slice(0, 12)}</strong>
				<small>SHA-256 · catalog and runtime bound</small>
			</article>
		</div>
	</section>

	<footer>
		<p>Human verdict still required.</p>
		<a href={resolve('/visual-lab')}>Record the hash-bound asset decision →</a>
	</footer>
</main>

<style>
	:global(body) {
		background: #06080c;
	}
	main {
		min-height: 100vh;
		color: #f4f0e7;
		background:
			radial-gradient(circle at 78% 5%, rgba(78, 50, 101, 0.24), transparent 31rem),
			linear-gradient(180deg, #090b12 0, #07090e 45rem, #0b0d13 100%);
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		min-height: 5rem;
		padding: 0 clamp(1rem, 4vw, 4rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(5, 7, 11, 0.84);
		backdrop-filter: blur(18px);
	}
	.wordmark {
		font-size: 0.72rem;
		font-weight: 850;
		letter-spacing: 0.25em;
		text-transform: uppercase;
	}
	.topbar > div {
		text-align: center;
	}
	.topbar span,
	.topbar strong {
		display: block;
	}
	.topbar span {
		color: #d4a95c;
		font-size: 0.48rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.topbar strong {
		margin-top: 0.2rem;
		font:
			400 1rem Georgia,
			serif;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1.1rem;
	}
	.topbar nav a {
		color: rgba(244, 240, 231, 0.46);
		font-size: 0.54rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.opening,
	.case-switcher,
	.phone-audit,
	.telemetry,
	footer {
		max-width: 94rem;
		margin: 0 auto;
	}
	.opening {
		display: grid;
		grid-template-columns: minmax(20rem, 0.72fr) minmax(28rem, 1.28fr);
		align-items: stretch;
		gap: clamp(2rem, 6vw, 7rem);
		padding: clamp(3rem, 7vw, 7rem) clamp(1.2rem, 4vw, 4rem);
	}
	.opening-copy {
		align-self: center;
	}
	.eyebrow {
		margin: 0 0 0.65rem;
		color: #d4a95c;
		font-size: 0.54rem;
		font-weight: 750;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	h1,
	h2,
	p {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 1.4rem;
		font:
			400 clamp(3.8rem, 7vw, 7.6rem)/0.84 Georgia,
			serif;
		letter-spacing: -0.065em;
	}
	h1 em {
		color: #9cc9d4;
		font-weight: 400;
	}
	.opening-copy > p:not(.eyebrow) {
		max-width: 37rem;
		color: rgba(244, 240, 231, 0.57);
		font-size: 0.8rem;
		line-height: 1.75;
	}
	.identity-seal {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.35rem 1rem;
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}
	.identity-seal span {
		font:
			400 1.25rem Georgia,
			serif;
	}
	.identity-seal code {
		align-self: center;
		color: #78cddd;
		font-size: 0.52rem;
	}
	.identity-seal strong {
		grid-column: 1 / -1;
		color: #e2b264;
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.stage {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 42rem;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.11);
		background:
			radial-gradient(circle at 50% 45%, rgba(101, 62, 126, 0.3), transparent 45%),
			linear-gradient(145deg, #0d111b, #07090e);
		box-shadow: 0 2rem 7rem rgba(0, 0, 0, 0.35);
	}
	.stage-grid {
		position: absolute;
		inset: 0;
		opacity: 0.2;
		background-image:
			linear-gradient(rgba(127, 216, 233, 0.18) 1px, transparent 1px),
			linear-gradient(90deg, rgba(127, 216, 233, 0.18) 1px, transparent 1px);
		background-size: 24px 24px;
		mask-image: radial-gradient(circle at center, #000 0, transparent 70%);
	}
	.actual-scale {
		position: relative;
		z-index: 1;
		width: var(--audit-width);
		height: var(--audit-height);
		transition:
			width 240ms ease,
			height 240ms ease;
	}
	.actual-scale :global(figure) {
		width: 100%;
		height: 100%;
	}
	.stage-caption {
		position: absolute;
		right: 1.2rem;
		bottom: 1.2rem;
		left: 1.2rem;
		z-index: 2;
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(5, 7, 11, 0.82);
		backdrop-filter: blur(14px);
	}
	.stage-caption span,
	.stage-caption strong {
		display: block;
	}
	.stage-caption span {
		color: #d4a95c;
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.stage-caption strong {
		margin-top: 0.2rem;
		font:
			400 1rem Georgia,
			serif;
	}
	.stage-caption code {
		color: #7fd8e9;
		font-size: 0.55rem;
	}
	.scale-mark {
		position: absolute;
		top: 1rem;
		right: 1rem;
		bottom: 5rem;
		width: 1px;
		border-left: 1px dashed rgba(212, 169, 92, 0.4);
	}
	.scale-mark span {
		position: absolute;
		top: 0;
		right: 0.55rem;
		color: rgba(212, 169, 92, 0.55);
		font-size: 0.45rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		writing-mode: vertical-rl;
	}
	.case-switcher,
	.phone-audit,
	.telemetry {
		padding: clamp(4rem, 7vw, 7rem) clamp(1.2rem, 4vw, 4rem);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 2rem;
	}
	.section-heading h2,
	.telemetry h2 {
		margin: 0;
		font:
			400 clamp(2.5rem, 5vw, 5rem)/0.9 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	.section-heading > strong {
		color: #78d7af;
		font:
			500 0.58rem ui-monospace,
			monospace;
	}
	.case-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(8rem, 1fr));
		gap: 1px;
		background: rgba(255, 255, 255, 0.09);
	}
	.case-grid button {
		min-width: 0;
		padding: 1rem;
		border: 0;
		background: #0a0d14;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.case-grid button.selected {
		background: linear-gradient(150deg, rgba(57, 96, 106, 0.5), #11141d);
		box-shadow: inset 0 2px #7fd8e9;
	}
	.case-grid i,
	.case-grid span,
	.case-grid strong,
	.case-grid small,
	.case-grid b {
		display: block;
	}
	.case-grid i {
		margin-bottom: 1.6rem;
		color: rgba(212, 169, 92, 0.5);
		font:
			normal 0.52rem ui-monospace,
			monospace;
	}
	.case-grid span {
		color: #7fd8e9;
		font-size: 0.45rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.case-grid strong {
		margin: 0.35rem 0 0.7rem;
		font:
			400 0.86rem/1.15 Georgia,
			serif;
	}
	.case-grid small {
		color: rgba(244, 240, 231, 0.34);
		font-size: 0.48rem;
	}
	.case-grid b {
		width: fit-content;
		margin-top: 0.8rem;
		padding: 0.2rem 0.35rem;
		border: 1px solid rgba(227, 141, 137, 0.25);
		color: #e38d89;
		font-size: 0.4rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.case-grid b.passed {
		border-color: rgba(120, 215, 175, 0.25);
		color: #78d7af;
	}
	.case-detail {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(22rem, 0.6fr);
		gap: 1px;
		margin-top: 1px;
		background: rgba(255, 255, 255, 0.09);
	}
	.cue-matrix {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1px;
	}
	.cue-matrix div {
		padding: 1rem;
		background: #0a0d14;
	}
	.cue-matrix span,
	.cue-matrix strong {
		display: block;
	}
	.cue-matrix span {
		color: rgba(244, 240, 231, 0.36);
		font-size: 0.48rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.cue-matrix strong {
		margin-top: 0.45rem;
		color: #78d7af;
		font-size: 0.55rem;
		line-height: 1.35;
	}
	.cue-matrix .not-claimed strong {
		color: #e38d89;
	}
	.review-prompt {
		padding: 1.2rem;
		background: #0d1017;
	}
	.review-prompt blockquote {
		margin: 0;
		color: rgba(244, 240, 231, 0.72);
		font:
			400 1rem/1.5 Georgia,
			serif;
	}
	.review-prompt > div {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 1rem;
	}
	.review-prompt > div span {
		width: 100%;
		color: rgba(244, 240, 231, 0.3);
		font-size: 0.46rem;
		text-transform: uppercase;
	}
	.review-prompt code {
		padding: 0.25rem 0.4rem;
		border: 1px solid rgba(127, 216, 233, 0.16);
		color: #7fd8e9;
		font-size: 0.48rem;
	}
	.review-console {
		margin-top: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: #0a0d14;
	}
	.review-console > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		padding: 1.4rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.review-console h3 {
		margin: 0;
		font:
			400 clamp(1.6rem, 3vw, 2.8rem) Georgia,
			serif;
		letter-spacing: -0.035em;
	}
	.review-progress {
		display: grid;
		grid-template-columns: auto auto;
		align-items: baseline;
		gap: 0.2rem 0.5rem;
		min-width: 12rem;
	}
	.review-progress strong {
		color: #78d7af;
		font:
			400 1.5rem Georgia,
			serif;
	}
	.review-progress span {
		color: rgba(244, 240, 231, 0.4);
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	.review-progress progress {
		grid-column: 1 / -1;
		width: 100%;
		height: 3px;
		border: 0;
		background: rgba(255, 255, 255, 0.08);
		accent-color: #78d7af;
	}
	.review-console form {
		padding: 1.4rem;
	}
	.review-context {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
	.review-context > div {
		padding: 0.85rem;
		background: #0d1017;
	}
	.review-context span,
	.review-context strong {
		display: block;
	}
	.review-context span,
	.review-fields span,
	.overall-decision > span {
		color: rgba(244, 240, 231, 0.34);
		font-size: 0.46rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.review-context strong {
		margin-top: 0.25rem;
		color: #e38d89;
		font:
			400 0.85rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.review-context strong.passing {
		color: #78d7af;
	}
	.cue-decisions {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1px;
		margin-top: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
	.cue-decisions fieldset {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem;
		min-width: 0;
		margin: 0;
		padding: 0.85rem;
		border: 0;
		background: #0d1017;
	}
	.cue-decisions legend {
		grid-column: 1 / -1;
		width: 100%;
		margin-bottom: 0.45rem;
		color: #f4f0e7;
		font-size: 0.52rem;
		text-transform: capitalize;
	}
	.cue-decisions button,
	.overall-decision button {
		padding: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: rgba(244, 240, 231, 0.4);
		cursor: pointer;
		font-size: 0.48rem;
		text-transform: uppercase;
	}
	.cue-decisions button.active,
	.overall-decision button.active {
		border-color: rgba(120, 215, 175, 0.55);
		background: rgba(120, 215, 175, 0.12);
		color: #78d7af;
	}
	.cue-decisions button.failed,
	.overall-decision button.active:last-of-type {
		border-color: rgba(227, 141, 137, 0.55);
		background: rgba(227, 141, 137, 0.1);
		color: #e38d89;
	}
	.overall-decision {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.overall-decision > span {
		margin-right: 0.4rem;
	}
	.overall-decision button:disabled {
		cursor: not-allowed;
		opacity: 0.28;
	}
	.overall-decision small {
		margin-left: auto;
		color: rgba(244, 240, 231, 0.32);
		font-size: 0.48rem;
	}
	.review-fields {
		display: grid;
		grid-template-columns: minmax(10rem, 0.3fr) minmax(20rem, 1.7fr);
		gap: 1rem;
		padding-top: 1rem;
	}
	.review-fields label,
	.review-fields span {
		display: block;
	}
	.review-fields input,
	.review-fields textarea {
		box-sizing: border-box;
		width: 100%;
		margin-top: 0.4rem;
		padding: 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0;
		outline: none;
		background: #07090e;
		color: #f4f0e7;
		font: inherit;
	}
	.review-fields input:focus,
	.review-fields textarea:focus {
		border-color: rgba(127, 216, 233, 0.6);
	}
	.review-fields textarea {
		resize: vertical;
	}
	.review-submit {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
	}
	.review-submit button {
		padding: 0.75rem 1rem;
		border: 1px solid #d4a95c;
		background: transparent;
		color: #d4a95c;
		cursor: pointer;
		font-size: 0.52rem;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.review-submit button:disabled {
		cursor: not-allowed;
		opacity: 0.3;
	}
	.review-submit p,
	.persistence-warning {
		margin: 0;
		color: rgba(244, 240, 231, 0.48);
		font-size: 0.52rem;
	}
	.persistence-warning {
		padding: 1.4rem;
	}
	.phone-grid {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr) minmax(17rem, 0.56fr);
		gap: 1.5rem;
		align-items: stretch;
	}
	.device {
		margin: 0;
		text-align: center;
	}
	.device-screen {
		position: relative;
		height: 31rem;
		overflow: hidden;
		border: 6px solid #20242d;
		border-radius: 2rem;
		background:
			radial-gradient(circle at 50% 35%, rgba(91, 55, 112, 0.4), transparent 48%), #080b11;
		box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.42);
	}
	.notch {
		position: absolute;
		top: 0.45rem;
		left: 50%;
		z-index: 2;
		width: 4.6rem;
		height: 1rem;
		border-radius: 1rem;
		background: #20242d;
		transform: translateX(-50%);
	}
	.mini-stage {
		position: absolute;
		top: 4rem;
		left: 50%;
		width: 8rem;
		height: 14.4rem;
		transform: translateX(-50%);
	}
	.mini-stage :global(figure) {
		width: 100%;
		height: 100%;
	}
	.phone-copy {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		left: 1rem;
		padding: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		text-align: left;
	}
	.phone-copy span,
	.phone-copy strong {
		display: block;
	}
	.phone-copy span {
		color: #d4a95c;
		font-size: 0.48rem;
		text-transform: uppercase;
	}
	.phone-copy strong {
		margin-top: 0.3rem;
		font:
			400 0.85rem Georgia,
			serif;
	}
	.device > small {
		display: block;
		margin-top: 0.7rem;
		color: rgba(244, 240, 231, 0.3);
		font-size: 0.48rem;
	}
	.texture-ledger {
		display: grid;
		grid-template-rows: repeat(3, 1fr);
		gap: 1px;
		background: rgba(255, 255, 255, 0.09);
	}
	.texture-ledger article {
		display: grid;
		grid-template-columns: 7rem 1fr;
		align-content: center;
		gap: 0.6rem 1rem;
		padding: 1.1rem;
		background: #0a0d14;
	}
	.texture-name span,
	.texture-name strong {
		display: block;
	}
	.texture-name span {
		color: #d4a95c;
		font-size: 0.48rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.texture-name strong {
		margin-top: 0.25rem;
		font:
			400 1.05rem Georgia,
			serif;
	}
	.density {
		align-self: center;
		height: 3px;
		background: rgba(255, 255, 255, 0.08);
	}
	.density i {
		display: block;
		width: var(--density);
		height: 100%;
		background: linear-gradient(90deg, #467e8b, #78d7af);
	}
	.texture-ledger dl {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin: 0;
	}
	.texture-ledger dl div {
		padding-right: 0.5rem;
		border-right: 1px solid rgba(255, 255, 255, 0.07);
	}
	.texture-ledger dt {
		color: rgba(244, 240, 231, 0.28);
		font-size: 0.43rem;
		text-transform: uppercase;
	}
	.texture-ledger dd {
		margin: 0.2rem 0 0;
		font-size: 0.55rem;
	}
	.texture-ledger > article > code {
		grid-column: 1 / -1;
		overflow: hidden;
		color: rgba(127, 216, 233, 0.42);
		font-size: 0.45rem;
		text-overflow: ellipsis;
	}
	.budget-card {
		padding: 1.4rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background:
			radial-gradient(circle at 50% 25%, rgba(62, 98, 107, 0.25), transparent 50%), #0a0d14;
	}
	.budget-ring {
		display: grid;
		place-content: center;
		width: 9rem;
		aspect-ratio: 1;
		margin: 1.5rem auto;
		border-radius: 50%;
		background:
			radial-gradient(circle, #0a0d14 62%, transparent 64%),
			conic-gradient(#78d7af var(--used), rgba(255, 255, 255, 0.07) 0);
		text-align: center;
	}
	.budget-ring strong,
	.budget-ring span {
		display: block;
	}
	.budget-ring strong {
		font:
			400 1.4rem Georgia,
			serif;
	}
	.budget-ring span {
		margin-top: 0.25rem;
		color: rgba(244, 240, 231, 0.36);
		font-size: 0.45rem;
		text-transform: uppercase;
	}
	.budget-card dl {
		margin: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.budget-card dl div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.budget-card dt {
		color: rgba(244, 240, 231, 0.38);
		font-size: 0.52rem;
	}
	.budget-card dd {
		margin: 0;
		color: #7fd8e9;
		font:
			500 0.55rem ui-monospace,
			monospace;
	}
	.budget-card > p:last-child {
		margin: 1rem 0 0;
		color: rgba(244, 240, 231, 0.35);
		font-size: 0.52rem;
		line-height: 1.5;
	}
	.telemetry {
		display: grid;
		grid-template-columns: minmax(18rem, 0.55fr) minmax(0, 1.45fr);
		gap: 3rem;
	}
	.telemetry > div:first-child > p:last-child {
		max-width: 30rem;
		color: rgba(244, 240, 231, 0.42);
		font-size: 0.68rem;
		line-height: 1.6;
	}
	.telemetry-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
	.telemetry-grid article {
		padding: 1.2rem;
		background: #0a0d14;
	}
	.telemetry-grid span,
	.telemetry-grid strong,
	.telemetry-grid small {
		display: block;
	}
	.telemetry-grid span {
		color: rgba(244, 240, 231, 0.34);
		font-size: 0.48rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.telemetry-grid strong {
		margin: 0.75rem 0 0.3rem;
		color: #78d7af;
		font:
			400 1.4rem Georgia,
			serif;
	}
	.telemetry-grid small {
		color: rgba(244, 240, 231, 0.3);
		font-size: 0.48rem;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		padding: 2rem clamp(1.2rem, 4vw, 4rem) 5rem;
		color: rgba(244, 240, 231, 0.42);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	footer a {
		color: #d4a95c;
	}
	@media (max-width: 1050px) {
		.case-grid {
			overflow-x: auto;
			grid-template-columns: repeat(7, 9rem);
		}
		.phone-grid {
			grid-template-columns: 13rem 1fr;
		}
		.budget-card {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 760px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.topbar nav a:last-child {
			display: none;
		}
		.opening,
		.case-detail,
		.phone-grid,
		.telemetry {
			grid-template-columns: 1fr;
		}
		.opening {
			gap: 2rem;
		}
		h1 {
			font-size: clamp(3.2rem, 15vw, 5rem);
		}
		.stage {
			min-height: 34rem;
		}
		.section-heading {
			align-items: flex-start;
			flex-direction: column;
		}
		.cue-matrix {
			grid-template-columns: 1fr 1fr;
		}
		.review-console > header,
		.overall-decision,
		.review-submit {
			align-items: flex-start;
			flex-direction: column;
		}
		.cue-decisions {
			grid-template-columns: 1fr 1fr;
		}
		.review-fields {
			grid-template-columns: 1fr;
		}
		.overall-decision small {
			margin-left: 0;
		}
		.phone-grid {
			gap: 1rem;
		}
		.device {
			display: none;
		}
		.texture-ledger article {
			grid-template-columns: 5.5rem 1fr;
		}
		.texture-ledger dl {
			grid-template-columns: 1fr 1fr;
			gap: 0.7rem;
		}
		.telemetry {
			gap: 1.5rem;
		}
		footer {
			align-items: flex-start;
			flex-direction: column;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.actual-scale {
			transition: none;
		}
	}
</style>
