<script lang="ts">
	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let view = $state(data.view);
	// svelte-ignore state_referenced_locally
	let selectedReaderId = $state(view.survivors[0]?.heroId ?? '');
	let busy = $state(false);
	let errorMessage = $state('');

	async function revealArchive() {
		busy = true;
		errorMessage = '';
		try {
			const response = await fetch(`/api/runs/${view.runId}/first-band-archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'reveal', readerHeroId: selectedReaderId })
			});
			const body = (await response.json()) as { view?: typeof view; message?: string };
			if (!response.ok || !body.view) throw new Error(body.message ?? 'Archive reveal failed.');
			view = body.view;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Archive reveal failed.';
		} finally {
			busy = false;
		}
	}

	function short(hash: string) {
		return hash.slice(0, 12).toUpperCase();
	}
</script>

<svelte:head>
	<title>Archive Fragment · Hearth 01</title>
	<meta name="description" content="A replay-bound first-band story reveal." />
</svelte:head>

<main data-testid="first-band-archive">
	<div class="embers" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
	<header>
		<div><span>HEARTH 01 / ARCHIVE CHAMBER</span><b>FIN—002</b></div>
		<div class="proof"><span>REPLAY BOUND</span><code>{short(view.stateHash)}</code></div>
	</header>

	<section class="stage">
		<div class="story-copy">
			<p>Floor 05 · The Living Foundry</p>
			<h1>{view.status === 'revealed' ? 'THE RECORD SPEAKS' : 'A SEALED MEMORY'}</h1>
			<p class="theme">{view.story.theme}</p>
		</div>
		<div
			class:open={view.status === 'revealed'}
			class="fragment"
			aria-label="Recovered archive fragment"
		>
			<div class="ring outer"></div>
			<div class="ring inner"></div>
			<div class="shard"><span>{view.status === 'revealed' ? 'I' : '?'}</span></div>
			<small>{view.status.toUpperCase()}</small>
		</div>
	</section>

	<section class="causal" data-testid="archive-causal-proof">
		<div><span>WARDEN</span><strong>DEFEATED</strong></div>
		<i>→</i>
		<div><span>PARTY</span><strong>EXTRACTED</strong></div>
		<i>→</i>
		<div><span>REWARDS</span><strong>2 CANONICAL</strong></div>
		<i>→</i>
		<div><span>ARCHIVE</span><strong>{view.status.toUpperCase()}</strong></div>
	</section>

	<section class="beat-rail">
		{#each view.story.beats as beat, index (beat.beatId)}
			<article class:complete={beat.completed} data-testid="first-band-story-beat">
				<span>0{index + 1} / {beat.kind}</span>
				<h2>{beat.title}</h2>
				<p>{beat.summary}</p>
			</article>
		{/each}
	</section>

	{#if view.status !== 'revealed'}
		<section class="reader-console" data-testid="archive-reader-console">
			<div class="console-copy">
				<span>SELECT A LIVING VOICE</span>
				<h2>The fact is fixed.<br />Its delivery is not.</h2>
				<p>
					The selected survivor becomes the first holder. Everyone present hears the same authored
					truth.
				</p>
			</div>
			<div class="survivors">
				{#each view.survivors as hero (hero.heroId)}
					<button
						class:selected={selectedReaderId === hero.heroId}
						onclick={() => (selectedReaderId = hero.heroId)}
						data-testid="archive-reader"
					>
						<div class="portrait"><span>{hero.displayName.slice(0, 1)}</span></div>
						<div>
							<strong>{hero.displayName}</strong><small
								>{hero.primaryValue} · {hero.primaryDrive}</small
							><em>{hero.frame} voice</em>
						</div>
						<b>{hero.health}</b>
					</button>
				{/each}
			</div>
			<button
				class="reveal"
				onclick={revealArchive}
				disabled={busy || !selectedReaderId || !view.canReveal}
				data-testid="reveal-first-band-archive"
			>
				{busy ? 'Breaking the seal…' : 'Ask this survivor to read'}
			</button>
			{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
		</section>
	{:else if view.reveal}
		<section class="revelation" data-testid="first-band-archive-reveal">
			<span class="eyebrow">ARCHIVE FRAGMENT / FIXED RECORD</span>
			<blockquote>“{view.reveal.canonicalMessage}”</blockquote>
			<div class="delivery">
				<div>
					<span>THE SURVIVOR SAYS</span>
					<p>{view.reveal.expression.spokenLine}</p>
				</div>
				<div>
					<span>HABIT</span>
					<p>{view.reveal.expression.habitGesture}</p>
				</div>
				<div>
					<span>FRAME</span>
					<p>{view.reveal.expression.frame}</p>
				</div>
			</div>
			<div class="knowledge">
				{#each view.survivors as hero (hero.heroId)}
					<div data-testid="archive-knowledge">
						<b>{hero.displayName}</b><span>{hero.knowledge?.role ?? 'unaware'}</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<footer>
		<div><span>EXTRACTION EVENT</span><code>{view.recovery?.sourceEventId}</code></div>
		<div><span>CONTENT</span><code>{view.contentVersion}</code></div>
		<div><span>MESSAGE COMMITMENT</span><code>{short(view.canonicalMessageHash)}</code></div>
	</footer>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #060606;
		color: #ece6d9;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	main {
		min-height: 100vh;
		background:
			radial-gradient(circle at 72% 14%, rgba(214, 74, 20, 0.15), transparent 28rem),
			repeating-linear-gradient(
				90deg,
				transparent 0 calc(25% - 1px),
				rgba(255, 255, 255, 0.025) 25%
			),
			#090908;
		position: relative;
		overflow: hidden;
	}
	header {
		min-height: 4rem;
		border-bottom: 1px solid #34312c;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.8rem clamp(1rem, 4vw, 4rem);
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.15em;
	}
	header div {
		display: flex;
		align-items: center;
		gap: 1.4rem;
	}
	header span {
		color: #8d8678;
	}
	header b {
		color: #d57738;
	}
	code {
		color: #aaa293;
		font-size: 0.65rem;
	}
	.proof span {
		color: #8fc2a5;
	}
	.stage {
		min-height: 27rem;
		padding: clamp(2.5rem, 7vw, 6rem) clamp(1rem, 7vw, 7rem);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
	}
	.story-copy {
		max-width: 45rem;
		position: relative;
		z-index: 2;
	}
	.story-copy > p:first-child,
	.eyebrow {
		color: #d4773c;
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.7rem 0 1rem;
		max-width: 50rem;
		font:
			400 clamp(4rem, 9vw, 8rem)/0.83 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	.theme {
		max-width: 42rem;
		color: #918b80;
		font:
			1rem/1.65 Georgia,
			serif;
	}
	.fragment {
		width: clamp(12rem, 23vw, 21rem);
		aspect-ratio: 1;
		position: relative;
		display: grid;
		place-items: center;
		filter: drop-shadow(0 0 2.5rem rgba(208, 70, 14, 0.22));
	}
	.ring {
		position: absolute;
		border: 1px solid #5b4937;
		border-radius: 50%;
		inset: 7%;
		transform: rotate(-18deg);
	}
	.ring.outer::after {
		content: 'I  II  III  IV  V';
		position: absolute;
		inset: 12%;
		border: 1px dashed #493d31;
		border-radius: 50%;
		color: #81603f;
		font:
			0.55rem ui-monospace,
			monospace;
		padding: 1rem;
		letter-spacing: 0.3em;
	}
	.ring.inner {
		inset: 26%;
		border-color: #9a572f;
		transform: rotate(28deg);
	}
	.shard {
		width: 24%;
		aspect-ratio: 0.7;
		display: grid;
		place-items: center;
		background: linear-gradient(145deg, #f3d49a, #9a3d18 48%, #28100a);
		clip-path: polygon(45% 0, 100% 26%, 77% 100%, 9% 82%, 0 20%);
		box-shadow: inset 0 0 1.5rem #fff1b6;
		transition:
			filter 0.7s,
			transform 0.7s;
	}
	.fragment.open .shard {
		filter: brightness(1.5);
		transform: scale(1.08);
	}
	.shard span {
		color: #28150c;
		font: 2rem Georgia;
	}
	.fragment small {
		position: absolute;
		bottom: 0;
		color: #aa6a41;
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.25em;
	}
	.causal {
		display: grid;
		grid-template-columns: repeat(4, 1fr auto);
		align-items: center;
		padding: 1rem clamp(1rem, 4vw, 4rem);
		border-block: 1px solid #34312c;
		background: rgba(0, 0, 0, 0.24);
	}
	.causal div {
		display: grid;
		gap: 0.3rem;
	}
	.causal span {
		color: #706b62;
		font:
			0.52rem ui-monospace,
			monospace;
		letter-spacing: 0.15em;
	}
	.causal strong {
		font:
			0.72rem ui-monospace,
			monospace;
		color: #d4c8b4;
	}
	.causal i {
		color: #7d482d;
		padding: 0 1rem;
	}
	.beat-rail {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		border-bottom: 1px solid #34312c;
	}
	.beat-rail article {
		min-height: 11rem;
		padding: 1.2rem;
		border-right: 1px solid #34312c;
		opacity: 0.46;
	}
	.beat-rail article.complete {
		opacity: 1;
		background: linear-gradient(180deg, rgba(176, 77, 32, 0.06), transparent);
	}
	.beat-rail span {
		color: #aa6940;
		font:
			0.52rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	.beat-rail h2 {
		margin: 0.75rem 0 0.5rem;
		font:
			1rem Georgia,
			serif;
		text-transform: uppercase;
	}
	.beat-rail p {
		margin: 0;
		color: #827c72;
		font-size: 0.7rem;
		line-height: 1.5;
	}
	.reader-console {
		padding: clamp(2rem, 5vw, 4rem);
		display: grid;
		grid-template-columns: minmax(15rem, 0.7fr) 1.4fr;
		gap: 2rem 4rem;
	}
	.console-copy span,
	.delivery span {
		color: #bd7145;
		font:
			0.55rem ui-monospace,
			monospace;
		letter-spacing: 0.15em;
	}
	.console-copy h2 {
		font:
			2.1rem/1.05 Georgia,
			serif;
		margin: 0.8rem 0;
		text-transform: uppercase;
	}
	.console-copy p {
		color: #827c72;
		font-size: 0.78rem;
		line-height: 1.6;
	}
	.survivors {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}
	.survivors button {
		text-align: left;
		min-height: 6rem;
		border: 1px solid #34312c;
		background: #0e0e0c;
		color: #ddd4c5;
		display: grid;
		grid-template-columns: 3rem 1fr auto;
		gap: 0.8rem;
		align-items: center;
		padding: 0.7rem;
		cursor: pointer;
	}
	.survivors button.selected {
		border-color: #c66c38;
		background: #1d120d;
		box-shadow: inset 3px 0 #dd7a3e;
	}
	.portrait {
		width: 3rem;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border: 1px solid #514b40;
		background: radial-gradient(circle, #743317, #17100c);
		font: 1.4rem Georgia;
	}
	.survivors strong,
	.survivors small,
	.survivors em {
		display: block;
	}
	.survivors strong {
		font:
			0.72rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
	}
	.survivors small {
		color: #817b71;
		font-size: 0.62rem;
		margin: 0.25rem 0;
	}
	.survivors em {
		color: #b8663b;
		font:
			normal 0.56rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	.survivors button > b {
		font:
			0.75rem ui-monospace,
			monospace;
		color: #8db69a;
	}
	.reveal {
		grid-column: 2;
		min-height: 3.5rem;
		border: 1px solid #d2783d;
		background: #a54620;
		color: #fff0db;
		font:
			700 0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.reveal:disabled {
		opacity: 0.5;
		cursor: wait;
	}
	.error {
		grid-column: 2;
		color: #ff9b7a;
	}
	.revelation {
		padding: clamp(3rem, 7vw, 7rem);
		text-align: center;
		background: radial-gradient(circle at 50% 30%, rgba(220, 100, 35, 0.12), transparent 30rem);
	}
	blockquote {
		margin: 2rem auto 3rem;
		max-width: 70rem;
		font:
			italic 400 clamp(3rem, 7vw, 6.5rem)/0.95 Georgia,
			serif;
		letter-spacing: -0.045em;
		color: #f1dfbd;
		text-shadow: 0 0 2rem rgba(225, 109, 45, 0.18);
	}
	.delivery {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		max-width: 72rem;
		margin: auto;
		text-align: left;
		border: 1px solid #3e382f;
	}
	.delivery div {
		padding: 1rem;
		border-right: 1px solid #3e382f;
	}
	.delivery p {
		color: #aaa193;
		font:
			0.82rem/1.5 Georgia,
			serif;
		margin: 0.6rem 0 0;
	}
	.delivery div:last-child p {
		color: #d5783f;
		text-transform: uppercase;
	}
	.knowledge {
		max-width: 72rem;
		margin: 1rem auto 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: #3e382f;
	}
	.knowledge div {
		background: #0b0b0a;
		padding: 0.8rem;
		display: flex;
		justify-content: space-between;
		font:
			0.58rem ui-monospace,
			monospace;
	}
	.knowledge span {
		color: #8fc2a5;
		text-transform: uppercase;
	}
	footer {
		padding: 1rem clamp(1rem, 4vw, 4rem);
		border-top: 1px solid #34312c;
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 1rem;
	}
	footer div {
		display: grid;
		gap: 0.35rem;
		overflow: hidden;
	}
	footer span {
		color: #6e685f;
		font:
			0.5rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
	}
	footer code {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.embers i {
		position: absolute;
		width: 2px;
		height: 2px;
		background: #e8773a;
		box-shadow: 0 0 0.5rem #ff7b34;
		animation: rise 7s linear infinite;
		left: var(--x);
		bottom: -1rem;
	}
	.embers i:nth-child(1) {
		--x: 12%;
		animation-delay: -1s;
	}
	.embers i:nth-child(2) {
		--x: 31%;
		animation-delay: -4s;
	}
	.embers i:nth-child(3) {
		--x: 59%;
		animation-delay: -2s;
	}
	.embers i:nth-child(4) {
		--x: 78%;
		animation-delay: -6s;
	}
	.embers i:nth-child(5) {
		--x: 91%;
		animation-delay: -3s;
	}
	@keyframes rise {
		to {
			transform: translate(4rem, -105vh);
			opacity: 0;
		}
	}
	@media (max-width: 800px) {
		header .proof {
			display: none;
		}
		.stage {
			min-height: 22rem;
		}
		.fragment {
			position: absolute;
			right: -2rem;
			opacity: 0.42;
		}
		.causal {
			grid-template-columns: 1fr 1fr;
		}
		.causal i {
			display: none;
		}
		.beat-rail {
			grid-template-columns: 1fr;
		}
		.beat-rail article {
			min-height: auto;
			border-bottom: 1px solid #34312c;
		}
		.reader-console {
			grid-template-columns: 1fr;
		}
		.survivors {
			grid-template-columns: 1fr;
		}
		.reveal,
		.error {
			grid-column: 1;
		}
		.delivery,
		.knowledge,
		footer {
			grid-template-columns: 1fr;
		}
		.delivery div {
			border-bottom: 1px solid #3e382f;
		}
		.knowledge {
			gap: 1px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.embers {
			display: none;
		}
		.shard {
			transition: none;
		}
	}
</style>
