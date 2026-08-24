<script lang="ts">
	import { resolve } from '$app/paths';
	import maraAnchor from '../../../../../../assets/heroes/ember-01-anchor-v1.png';
	import remyAnchor from '../../../../../../assets/heroes/visuals/hearth-02-anchor-v1.png';
	import type { SummonCardGenerationResult, SummonCardGenerationSpec } from '@summonlab/contracts';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let selectedAssetKey = $state(data.subjects[0]!.asset.assetKey);
	// svelte-ignore state_referenced_locally
	let spec = $state<SummonCardGenerationSpec>(data.subjects[0]!.initialSpec);
	let direction = $state('');
	let costAcknowledged = $state(false);
	let busy = $state(false);
	let message = $state('');
	let error = $state('');
	let result = $state<SummonCardGenerationResult | null>(null);

	const selected = $derived(
		data.subjects.find((subject) => subject.asset.assetKey === selectedAssetKey) ??
			data.subjects[0]!
	);
	const referenceUrl = $derived(
		selectedAssetKey === 'ember-01-anchor-v1' ? maraAnchor : remyAnchor
	);
	const canGenerate = $derived(
		data.generation.enabled &&
			data.generation.keyConfigured &&
			costAcknowledged &&
			spec.estimatedOutputCostUsd > 0 &&
			!busy
	);

	function requestBody() {
		return {
			assetKey: selected.asset.assetKey,
			catalogVersion: data.catalogVersion,
			assetContentHash: selected.asset.contentHash,
			manifestHash: selected.draft.manifestHash,
			direction
		};
	}

	function selectSubject(assetKey: string) {
		selectedAssetKey = assetKey;
		const next = data.subjects.find((subject) => subject.asset.assetKey === assetKey)!;
		spec = next.initialSpec;
		direction = '';
		costAcknowledged = false;
		result = null;
		message = '';
		error = '';
	}

	async function preview() {
		if (busy) return;
		busy = true;
		message = '';
		error = '';
		result = null;
		try {
			const response = await fetch('/api/dev/summon-card/preview', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(requestBody())
			});
			const body = (await response.json()) as SummonCardGenerationSpec & { message?: string };
			if (!response.ok || !body.promptHash) throw new Error(body.message ?? 'Preview failed.');
			spec = body;
			costAcknowledged = false;
			message = 'Preview rebuilt. No provider call was made.';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Preview failed.';
		} finally {
			busy = false;
		}
	}

	async function generate() {
		if (!canGenerate) return;
		busy = true;
		message = '';
		error = '';
		result = null;
		try {
			const response = await fetch('/api/dev/summon-card/generate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					...requestBody(),
					requestId: crypto.randomUUID(),
					costAcknowledged: true
				})
			});
			const body = (await response.json()) as SummonCardGenerationResult & { message?: string };
			if (!response.ok || !body.image) throw new Error(body.message ?? 'Generation failed.');
			result = body;
			message = 'One ephemeral candidate returned. Nothing was saved or approved.';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Generation failed.';
		} finally {
			busy = false;
			costAcknowledged = false;
		}
	}
</script>

<svelte:head>
	<title>Summon-card request lab · summonlab</title>
	<meta
		name="description"
		content="Preview a hash-bound, development-only, reference-driven summon-card request without changing canonical game state."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>ART-006</span><strong>Summon-card request lab</strong></div>
		<nav aria-label="Lab links">
			<a href={resolve('/visual-lab')}>Visual continuity</a>
			<a href={resolve('/forge')}>Character Forge</a>
		</nav>
	</header>

	<section class="opening">
		<div>
			<p class="eyebrow">One reference · one candidate · zero canonical writes</p>
			<h1>The image may imagine.<br /><em>The manifest decides.</em></h1>
			<p class="lede">
				This lab turns an exact identity anchor into one cinematic card request. The prompt is
				server-authored, the input bytes are SHA-256 checked before execution, and the returned
				image exists only in this browser session.
			</p>
		</div>
		<aside class="safety" data-testid="generation-state">
			<span class:live={data.generation.enabled && data.generation.keyConfigured}></span>
			<div>
				<small>Provider execution</small>
				<strong
					>{data.generation.enabled && data.generation.keyConfigured
						? 'Ready for explicit confirmation'
						: 'Disabled by default'}</strong
				>
			</div>
			<code>{data.generation.model}</code>
		</aside>
	</section>

	<section class="subject-tabs" aria-label="Identity anchor">
		{#each data.subjects as subject (subject.asset.assetKey)}
			<button
				type="button"
				class:selected={selectedAssetKey === subject.asset.assetKey}
				onclick={() => selectSubject(subject.asset.assetKey)}
			>
				<small
					>{subject.draft.manifest.rarityStars}★ · adult {subject.draft.manifest.adultAge}</small
				>
				<strong>{subject.draft.manifest.displayName}</strong>
				<span>{subject.asset.status}</span>
			</button>
		{/each}
	</section>

	<section class="workbench">
		<div class="card-stage">
			<div class="gate" aria-hidden="true"><i></i><i></i><i></i></div>
			<figure>
				<img
					src={result
						? `data:${result.image.mimeType};base64,${result.image.b64Json}`
						: referenceUrl}
					alt={result
						? `Ephemeral generated summon card for ${selected.draft.manifest.displayName}`
						: `${selected.draft.manifest.displayName} exact identity anchor`}
					width="1024"
					height="1536"
				/>
				<div class="card-vignette"></div>
				<figcaption>
					<span>{result ? 'Ephemeral candidate' : 'Exact identity anchor'}</span>
					<strong>{selected.draft.manifest.displayName}</strong>
					<small>{selected.draft.manifest.heightCm} cm · {selected.draft.manifest.posture}</small>
				</figcaption>
			</figure>
			<div class="card-status">
				<span>{result ? 'provider output' : 'reference input'}</span>
				<code
					>{result?.image.contentHash.slice(0, 12) ?? selected.asset.contentHash.slice(0, 12)}</code
				>
			</div>
		</div>

		<div class="controls">
			<header>
				<p class="eyebrow">Bound request</p>
				<h2>Direct the mood,<br />not the identity.</h2>
			</header>
			<label class="direction">
				<span>Optional art direction</span>
				<textarea
					bind:value={direction}
					maxlength="500"
					placeholder="Example: colder gate light; the hero has just heard a distant alarm."
				></textarea>
				<small>{direction.length}/500 · subordinate to identity locks</small>
			</label>
			<button class="preview" type="button" onclick={() => void preview()} disabled={busy}>
				{busy ? 'Working…' : 'Rebuild deterministic preview'}
			</button>

			<div class="execution-boundary">
				<div>
					<small>Estimated image output</small>
					<strong
						>{spec.estimatedOutputCostUsd > 0
							? `$${spec.estimatedOutputCostUsd.toFixed(3)} USD`
							: 'price check required'}</strong
					>
					<span>prompt + reference input tokens additional</span>
				</div>
				<label>
					<input
						type="checkbox"
						bind:checked={costAcknowledged}
						disabled={!data.generation.enabled || !data.generation.keyConfigured || busy}
					/>
					<span
						>I authorize exactly one paid candidate and understand there is no automatic retry.</span
					>
				</label>
				<button type="button" onclick={() => void generate()} disabled={!canGenerate}>
					Generate one candidate
				</button>
			</div>

			{#if message}<p class="message" data-testid="request-result">{message}</p>{/if}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</div>
	</section>

	<section class="specification">
		<header>
			<div>
				<p class="eyebrow">Request provenance</p>
				<h2>Read exactly what leaves the machine.</h2>
			</div>
			<strong data-testid="prompt-hash">prompt {spec.promptHash.slice(0, 16)}</strong>
		</header>
		<div class="spec-grid">
			<dl>
				<div>
					<dt>Endpoint</dt>
					<dd>{spec.endpoint}</dd>
				</div>
				<div>
					<dt>Model snapshot</dt>
					<dd>{spec.model}</dd>
				</div>
				<div>
					<dt>Output</dt>
					<dd>{spec.size} · {spec.quality} · PNG</dd>
				</div>
				<div>
					<dt>Moderation</dt>
					<dd>{spec.moderation}</dd>
				</div>
				<div>
					<dt>Candidates</dt>
					<dd>{spec.candidateCount}</dd>
				</div>
				<div>
					<dt>Retries</dt>
					<dd>{spec.retryPolicy}</dd>
				</div>
				<div>
					<dt>Persistence</dt>
					<dd>{spec.persistence}</dd>
				</div>
				<div>
					<dt>Canonical state</dt>
					<dd>{String(spec.canonical)}</dd>
				</div>
			</dl>
			<div class="hashes">
				<span>catalog</span><code>{spec.catalogVersion}</code>
				<span>asset SHA-256</span><code>{spec.assetContentHash}</code>
				<span>manifest SHA-256</span><code>{spec.manifestHash}</code>
			</div>
		</div>
		<details open>
			<summary>Deterministic provider prompt</summary>
			<pre>{spec.prompt}</pre>
		</details>
	</section>

	<footer>
		<p>
			This experiment cannot write the asset catalog, approve a visual, mutate an engine run, or
			change a character manifest. Saving a successful candidate requires a separate future review
			flow.
		</p>
		<a href={resolve('/visual-lab')}>Return to the human visual gate →</a>
	</footer>
</main>

<style>
	:global(body) {
		background:
			radial-gradient(circle at 16% 10%, rgba(46, 76, 104, 0.16), transparent 30rem),
			linear-gradient(180deg, #080a0f 0%, #0a0c12 54%, #07090d 100%);
	}
	main {
		min-height: 100vh;
		color: #f4efe5;
	}
	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		min-height: 4.5rem;
		padding: 0 clamp(1rem, 3vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(6, 8, 12, 0.82);
	}
	.wordmark {
		color: #f4efe5;
		font:
			600 1rem Georgia,
			serif;
		letter-spacing: 0.12em;
		text-decoration: none;
	}
	.topbar > div {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.topbar > div span {
		color: #d3a454;
	}
	.topbar nav {
		justify-self: end;
		display: flex;
		gap: 1.4rem;
	}
	.topbar nav a {
		color: #779da5;
		font-size: 0.58rem;
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.opening {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(18rem, 0.6fr);
		gap: 4rem;
		align-items: end;
		padding: clamp(4rem, 8vw, 8rem) clamp(1.2rem, 5vw, 6rem) 3rem;
	}
	.eyebrow {
		margin: 0 0 0.9rem;
		color: #d3a454;
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h1,
	h2 {
		margin: 0;
		font:
			400 clamp(2.8rem, 6vw, 6.6rem)/0.92 Georgia,
			serif;
		letter-spacing: -0.045em;
	}
	h1 em {
		color: #7ecbd9;
		font-weight: 400;
	}
	.lede {
		max-width: 48rem;
		margin: 2rem 0 0;
		color: rgba(244, 239, 229, 0.53);
		font-size: 0.82rem;
		line-height: 1.75;
	}
	.safety {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem 1rem;
		align-items: center;
		padding: 1.2rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(12, 15, 21, 0.84);
	}
	.safety > span {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: #d26462;
		box-shadow: 0 0 1rem rgba(210, 100, 98, 0.5);
	}
	.safety > span.live {
		background: #73d3a8;
		box-shadow: 0 0 1rem rgba(115, 211, 168, 0.5);
	}
	.safety small,
	.safety strong {
		display: block;
	}
	.safety small {
		color: rgba(244, 239, 229, 0.34);
		font-size: 0.48rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.safety strong {
		margin-top: 0.2rem;
		font-size: 0.68rem;
	}
	.safety code {
		grid-column: 2;
		color: #6e929b;
		font-size: 0.55rem;
	}
	.subject-tabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1px;
		margin: 0 clamp(1.2rem, 5vw, 6rem);
		padding: 1px;
		background: rgba(255, 255, 255, 0.1);
	}
	.subject-tabs button {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.3rem 1rem;
		padding: 1.2rem 1.4rem;
		border: 0;
		background: #0b0e14;
		color: #f4efe5;
		text-align: left;
		cursor: pointer;
	}
	.subject-tabs button.selected {
		background: #18202a;
		box-shadow: inset 0 -2px #d3a454;
	}
	.subject-tabs small {
		grid-column: 1/-1;
		color: rgba(244, 239, 229, 0.34);
		font-size: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.subject-tabs strong {
		font:
			400 1.1rem Georgia,
			serif;
	}
	.subject-tabs span {
		align-self: center;
		color: #7ecbd9;
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	.workbench {
		display: grid;
		grid-template-columns: minmax(24rem, 0.8fr) minmax(28rem, 1.2fr);
		gap: 1px;
		margin: 1px clamp(1.2rem, 5vw, 6rem) 0;
		background: rgba(255, 255, 255, 0.1);
	}
	.card-stage {
		position: relative;
		display: grid;
		min-height: 53rem;
		place-items: center;
		overflow: hidden;
		padding: 4rem;
		background:
			radial-gradient(circle at 50% 40%, rgba(58, 143, 164, 0.24), transparent 28%), #080a10;
	}
	.gate {
		position: absolute;
		inset: 9% 8%;
		border: 1px solid rgba(106, 205, 225, 0.17);
		border-radius: 50%;
		transform: perspective(800px) rotateX(4deg);
	}
	.gate::before,
	.gate::after,
	.gate i {
		content: '';
		position: absolute;
		inset: 7%;
		border: 1px solid rgba(211, 164, 84, 0.2);
		border-radius: 50%;
		transform: rotate(23deg);
	}
	.gate::after {
		inset: 15%;
		border-style: dashed;
		transform: rotate(-18deg);
	}
	.gate i:nth-child(1) {
		inset: -1%;
		border-color: rgba(126, 203, 217, 0.12);
		transform: rotate(55deg);
	}
	.gate i:nth-child(2) {
		inset: 23%;
		transform: rotate(-45deg);
	}
	.gate i:nth-child(3) {
		inset: 31%;
		border-color: rgba(126, 203, 217, 0.16);
	}
	.card-stage figure {
		position: relative;
		z-index: 1;
		width: min(74%, 26rem);
		aspect-ratio: 2/3;
		margin: 0;
		overflow: hidden;
		border: 1px solid rgba(225, 190, 121, 0.5);
		box-shadow:
			0 3rem 8rem rgba(0, 0, 0, 0.65),
			0 0 4rem rgba(77, 164, 184, 0.12);
	}
	.card-stage figure img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top center;
		filter: saturate(0.88) contrast(1.03);
	}
	.card-vignette {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 50%, rgba(4, 6, 10, 0.92));
		pointer-events: none;
	}
	figcaption {
		position: absolute;
		z-index: 2;
		right: 1.2rem;
		bottom: 1.2rem;
		left: 1.2rem;
	}
	figcaption span,
	figcaption small {
		display: block;
		color: #d3a454;
		font-size: 0.48rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	figcaption strong {
		display: block;
		margin: 0.3rem 0;
		font:
			400 1.7rem Georgia,
			serif;
	}
	figcaption small {
		color: rgba(244, 239, 229, 0.55);
	}
	.card-status {
		position: absolute;
		z-index: 2;
		right: 1rem;
		bottom: 1rem;
		left: 1rem;
		display: flex;
		justify-content: space-between;
		color: rgba(244, 239, 229, 0.3);
		font-size: 0.48rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.card-status code {
		color: #678b94;
	}
	.controls {
		padding: clamp(2rem, 4vw, 4.5rem);
		background: #0b0e14;
	}
	.controls h2,
	.specification h2 {
		font-size: clamp(2.3rem, 4vw, 4.5rem);
	}
	.direction {
		display: grid;
		gap: 0.6rem;
		margin-top: 2.5rem;
	}
	.direction > span {
		color: rgba(244, 239, 229, 0.46);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	textarea {
		min-height: 9rem;
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0;
		background: #07090d;
		color: #f4efe5;
		font: 400 0.82rem/1.6 inherit;
		resize: vertical;
	}
	.direction small {
		justify-self: end;
		color: rgba(244, 239, 229, 0.28);
		font-size: 0.52rem;
	}
	.preview,
	.execution-boundary button {
		width: 100%;
		min-height: 3.3rem;
		border: 0;
		background: #1a2630;
		color: #8bd6e2;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.preview {
		margin-top: 1rem;
	}
	.preview:disabled,
	.execution-boundary button:disabled {
		cursor: not-allowed;
		opacity: 0.35;
	}
	.execution-boundary {
		display: grid;
		gap: 1rem;
		margin-top: 2rem;
		padding: 1.4rem;
		border: 1px solid rgba(211, 164, 84, 0.2);
		background: rgba(211, 164, 84, 0.035);
	}
	.execution-boundary > div {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem 1rem;
	}
	.execution-boundary small,
	.execution-boundary span {
		color: rgba(244, 239, 229, 0.36);
		font-size: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.execution-boundary strong {
		color: #d3a454;
		font:
			400 1.1rem Georgia,
			serif;
	}
	.execution-boundary > div span {
		grid-column: 1/-1;
		text-transform: none;
		letter-spacing: 0;
	}
	.execution-boundary label {
		display: flex;
		gap: 0.7rem;
		align-items: flex-start;
		padding-top: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}
	.execution-boundary input {
		accent-color: #d3a454;
	}
	.execution-boundary label span {
		line-height: 1.5;
		text-transform: none;
		letter-spacing: 0;
	}
	.execution-boundary button {
		background: #d3a454;
		color: #090a0d;
	}
	.message,
	.error {
		margin: 1rem 0 0;
		font-size: 0.68rem;
	}
	.message {
		color: #73d3a8;
	}
	.error {
		color: #e9908c;
	}
	.specification {
		margin: 0 clamp(1.2rem, 5vw, 6rem);
		padding: clamp(4rem, 8vw, 8rem) 0;
	}
	.specification > header {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: end;
	}
	.specification > header > strong {
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(126, 203, 217, 0.2);
		color: #7ecbd9;
		font-size: 0.52rem;
		letter-spacing: 0.08em;
	}
	.spec-grid {
		display: grid;
		grid-template-columns: 1.15fr 0.85fr;
		gap: 1px;
		margin-top: 2rem;
		background: rgba(255, 255, 255, 0.08);
	}
	dl,
	.hashes {
		margin: 0;
		padding: 1.5rem;
		background: #0b0e14;
	}
	dl {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		padding: 1px;
		background: rgba(255, 255, 255, 0.07);
	}
	dl div {
		padding: 1rem;
		background: #0b0e14;
	}
	dt,
	.hashes span {
		color: rgba(244, 239, 229, 0.3);
		font-size: 0.48rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	dd {
		margin: 0.35rem 0 0;
		color: rgba(244, 239, 229, 0.72);
		font-size: 0.64rem;
		overflow-wrap: anywhere;
	}
	.hashes {
		display: grid;
		align-content: center;
		gap: 0.45rem;
	}
	.hashes code {
		margin-bottom: 0.8rem;
		color: #678b94;
		font-size: 0.52rem;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	details {
		margin-top: 1px;
		background: #0b0e14;
	}
	summary {
		padding: 1rem 1.5rem;
		color: #d3a454;
		cursor: pointer;
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	pre {
		max-height: 34rem;
		margin: 0;
		overflow: auto;
		padding: 0 1.5rem 1.5rem;
		color: rgba(244, 239, 229, 0.58);
		font:
			400 0.65rem/1.7 ui-monospace,
			monospace;
		white-space: pre-wrap;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: center;
		padding: 2rem clamp(1.2rem, 5vw, 6rem);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	footer p {
		max-width: 50rem;
		color: rgba(244, 239, 229, 0.42);
		font-size: 0.63rem;
		line-height: 1.6;
	}
	footer a {
		color: #7ecbd9;
		font-size: 0.58rem;
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	@media (max-width: 850px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.opening,
		.workbench,
		.spec-grid {
			grid-template-columns: 1fr;
		}
		.opening {
			gap: 2rem;
		}
		.subject-tabs {
			grid-template-columns: 1fr;
		}
		.workbench {
			margin-top: 1px;
		}
		.card-stage {
			min-height: 42rem;
			padding: 3rem 1rem;
		}
		.specification > header,
		footer {
			align-items: flex-start;
			flex-direction: column;
		}
		dl {
			grid-template-columns: 1fr;
		}
	}
</style>
