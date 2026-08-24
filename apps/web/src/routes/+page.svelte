<script lang="ts">
	import { resolve } from '$app/paths';
	import summonArt from '../../../../assets/agent-summoning-concept.png';

	let { data } = $props();

	const checks = $derived([
		{ label: 'Web process', value: data.health.status === 'ok' ? 'Ready' : 'Degraded' },
		{ label: 'Policy mode', value: data.health.policyMode },
		{ label: 'Database', value: data.health.database.status },
		{ label: 'Commit', value: data.health.commit }
	]);
</script>

<svelte:head>
	<title>Summonlab · Foundation health</title>
	<meta
		name="description"
		content="Summonlab development health and foundation status for the agent-powered tower RPG."
	/>
</svelte:head>

<main>
	<section class="hero">
		<img src={summonArt} alt="A summoned agent hero steps through an arcane gate" />
		<div class="veil"></div>
		<header>
			<a class="wordmark" href={resolve('/')}>summonlab</a>
			<nav aria-label="Development links">
				<a href={resolve('/forge')}>Open forge</a>
				<a href={resolve('/design-reference')}>Design reference</a>
				<a href={resolve('/health')}>Health JSON</a>
			</nav>
		</header>

		<div class="hero-copy">
			<p class="eyebrow">Playable checkpoint · Phase 1</p>
			<h1>The gate is listening.</h1>
			<p class="lede">
				Forge one persistent identity, summon them face-to-face, and watch their first independent
				choice alter the route through Hearth 01.
			</p>
			<a class="launch" href={resolve('/forge')}>Begin at the character forge <span>→</span></a>
		</div>
	</section>

	<section class="status" aria-labelledby="status-heading">
		<div class="status-heading">
			<div>
				<p class="eyebrow">Runtime status</p>
				<h2 id="status-heading">System boundary</h2>
			</div>
			<span class:degraded={data.health.status !== 'ok'} class="state">
				<span></span>{data.health.status}
			</span>
		</div>

		<div class="checks">
			{#each checks as check (check.label)}
				<article>
					<p>{check.label}</p>
					<strong>{check.value}</strong>
				</article>
			{/each}
		</div>

		<div class="contract">
			<div class="rune" aria-hidden="true">◇</div>
			<div>
				<h3>Authority contract</h3>
				<p>state + legal action + seed → state + canonical events</p>
			</div>
			<div class="request">
				<span>request</span>
				<code>{data.health.requestId.slice(0, 12)}</code>
			</div>
		</div>

		<p class="note">
			{#if data.health.database.status === 'available'}
				PostgreSQL answered in {data.health.database.latencyMs} ms.
			{:else}
				PostgreSQL is offline. Run <code>pnpm dev</code> with Docker, or continue shell work with
				<code>pnpm dev:app</code>.
			{/if}
		</p>
	</section>
</main>

<style>
	:global(body) {
		background:
			radial-gradient(circle at 76% 8%, rgba(120, 86, 214, 0.18), transparent 34rem), #090b12;
	}

	main {
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(24rem, 0.65fr);
	}

	.hero {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		isolation: isolate;
	}

	.hero > img {
		position: absolute;
		inset: 0;
		z-index: -3;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 54% center;
		filter: saturate(0.88) contrast(1.08);
	}

	.veil {
		position: absolute;
		inset: 0;
		z-index: -2;
		background:
			linear-gradient(180deg, rgba(5, 6, 12, 0.66), transparent 38%, rgba(5, 7, 12, 0.9)),
			linear-gradient(90deg, rgba(5, 6, 12, 0.28), transparent 55%);
	}

	.hero::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image: linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px);
		background-size: 100% 4px;
		mix-blend-mode: overlay;
		opacity: 0.15;
		pointer-events: none;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
		padding: 2rem clamp(1.5rem, 4vw, 4.5rem);
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	.wordmark {
		font-size: 0.92rem;
		font-weight: 750;
		letter-spacing: 0.24em;
		text-transform: uppercase;
	}

	nav {
		display: flex;
		gap: 1.4rem;
		color: rgba(247, 242, 232, 0.7);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	nav a:hover,
	nav a:focus-visible {
		color: #f4ce7a;
	}

	.hero-copy {
		position: absolute;
		left: clamp(1.5rem, 5vw, 5.5rem);
		bottom: clamp(3rem, 9vh, 7rem);
		max-width: 41rem;
	}

	.eyebrow {
		margin: 0 0 0.8rem;
		color: #e9bd65;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}

	h1 {
		max-width: 11ch;
		margin-bottom: 1rem;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(3.4rem, 7vw, 7.5rem);
		font-weight: 400;
		line-height: 0.88;
		letter-spacing: -0.055em;
		text-wrap: balance;
	}

	.lede {
		max-width: 35rem;
		margin-bottom: 0;
		color: rgba(247, 242, 232, 0.78);
		font-size: clamp(1rem, 1.6vw, 1.25rem);
		line-height: 1.55;
	}

	.launch {
		display: inline-flex;
		align-items: center;
		gap: 2rem;
		margin-top: 1.5rem;
		padding: 0.8rem 1rem;
		border: 1px solid rgba(244, 206, 122, 0.5);
		background: rgba(6, 7, 12, 0.52);
		color: #f4ce7a;
		font-size: 0.68rem;
		font-weight: 650;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.launch span {
		font-size: 1rem;
	}

	.status {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: clamp(2rem, 5vw, 5.5rem);
		border-left: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(9, 11, 18, 0.94);
		box-shadow: -2rem 0 6rem rgba(0, 0, 0, 0.32);
	}

	.status-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 2rem;
		padding-bottom: 1.8rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.09);
	}

	h2 {
		margin-bottom: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2rem, 3.2vw, 3.4rem);
		font-weight: 400;
		letter-spacing: -0.04em;
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.7rem;
		border: 1px solid rgba(103, 220, 173, 0.24);
		border-radius: 999px;
		color: #79dfb4;
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.state > span {
		width: 0.38rem;
		height: 0.38rem;
		border-radius: 50%;
		background: currentColor;
		box-shadow: 0 0 0.8rem currentColor;
	}

	.state.degraded {
		border-color: rgba(244, 206, 122, 0.26);
		color: #f4ce7a;
	}

	.checks {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin-top: 2rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		border-left: 1px solid rgba(255, 255, 255, 0.07);
	}

	.checks article {
		min-height: 7.5rem;
		padding: 1.2rem;
		border-right: 1px solid rgba(255, 255, 255, 0.07);
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.025), transparent);
	}

	.checks p,
	.request span {
		margin-bottom: 1.8rem;
		color: rgba(247, 242, 232, 0.42);
		font-size: 0.64rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.checks strong {
		display: block;
		overflow: hidden;
		color: #f7f2e8;
		font-size: 1rem;
		font-weight: 550;
		text-overflow: ellipsis;
		text-transform: capitalize;
		white-space: nowrap;
	}

	.contract {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
		padding: 1.2rem;
		border: 1px solid rgba(157, 124, 255, 0.22);
		background: linear-gradient(100deg, rgba(157, 124, 255, 0.1), rgba(103, 217, 255, 0.03));
	}

	.rune {
		display: grid;
		width: 2.8rem;
		height: 2.8rem;
		place-items: center;
		border: 1px solid rgba(244, 206, 122, 0.35);
		color: #f4ce7a;
		font-size: 1.5rem;
		transform: rotate(45deg);
	}

	.rune + div {
		padding-left: 0.5rem;
	}

	h3 {
		margin-bottom: 0.3rem;
		font-size: 0.78rem;
		font-weight: 650;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.contract p {
		margin-bottom: 0;
		color: rgba(247, 242, 232, 0.55);
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 0.72rem;
		line-height: 1.5;
	}

	.request {
		text-align: right;
	}

	.request span {
		display: block;
		margin-bottom: 0.35rem;
	}

	code {
		color: #85dcff;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 0.72rem;
	}

	.note {
		margin: 1.5rem 0 0;
		color: rgba(247, 242, 232, 0.55);
		font-size: 0.78rem;
		line-height: 1.7;
	}

	@media (max-width: 1000px) {
		main {
			grid-template-columns: 1fr;
		}

		.hero {
			min-height: 72vh;
		}

		.status {
			border-top: 1px solid rgba(255, 255, 255, 0.08);
			border-left: 0;
		}
	}

	@media (max-width: 620px) {
		header {
			align-items: flex-start;
			padding: 1.4rem;
		}

		nav {
			flex-direction: column;
			align-items: flex-end;
			gap: 0.6rem;
		}

		.hero-copy {
			left: 1.4rem;
			right: 1.4rem;
			bottom: 2.4rem;
		}

		.checks {
			grid-template-columns: 1fr;
		}

		.contract {
			grid-template-columns: auto 1fr;
		}

		.request {
			grid-column: 2;
			text-align: left;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
		}
	}
</style>
