<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let seed = $state('first-ember-recovery');
	let busy = $state(false);
	let errorMessage = $state('');

	async function createRun() {
		busy = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/dev/first-band-archive-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ seed })
			});
			const body = (await response.json()) as { runId?: string; message?: string; detail?: string };
			if (!response.ok || !body.runId) {
				throw new Error(body.detail ?? body.message ?? 'Archive checkpoint creation failed.');
			}
			await goto(resolve('/first-band-archive/[runId]', { runId: body.runId }));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Archive checkpoint creation failed.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>The First Ember · summonlab</title>
	<meta
		name="description"
		content="Defeat the Foundry Warden, extract the first-band rewards, and open the archive."
	/>
</svelte:head>

<main>
	<div class="grain" aria-hidden="true"></div>
	<section class="brief">
		<header>
			<span>FIN—002</span><span>FLOOR 05 / AFTERMATH</span><span>HEARTH 01</span>
		</header>
		<div class="title-lockup">
			<div>
				<p>The Living Foundry is silent.</p>
				<h1>THE FIRST<br /><i>EMBER</i></h1>
			</div>
			<div class="relic" aria-hidden="true">
				<div class="orbit one"></div>
				<div class="orbit two"></div>
				<b></b><span>V</span>
			</div>
		</div>
		<div class="law-grid">
			<article>
				<b>01</b>
				<h2>Defeat is not enough.</h2>
				<p>The Warden must fall, and the company must cross the extraction boundary alive.</p>
			</article>
			<article>
				<b>02</b>
				<h2>Truth stays authored.</h2>
				<p>No agent or StoryDirector can replace the archive’s fixed message.</p>
			</article>
			<article>
				<b>03</b>
				<h2>Voice stays human.</h2>
				<p>You choose a survivor. Personality, values, style, and habit shape how they read it.</p>
			</article>
		</div>
		<div class="launch">
			<label
				><span>Company seed</span><input
					bind:value={seed}
					maxlength="128"
					data-testid="first-band-archive-seed"
				/></label
			>
			<button
				onclick={createRun}
				disabled={busy || !seed.trim()}
				data-testid="create-first-band-archive-run"
			>
				{busy ? 'Running the Foundry…' : 'Recover the sealed fragment'}
			</button>
		</div>
		{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
	</section>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #070706;
		color: #eee8da;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: clamp(1rem, 4vw, 4rem);
		overflow: hidden;
		position: relative;
		background:
			radial-gradient(circle at 69% 36%, rgba(206, 83, 27, 0.18), transparent 28rem),
			linear-gradient(135deg, #080908, #11100d 52%, #080706);
	}
	main::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(108deg, transparent 49.8%, rgba(229, 165, 81, 0.12) 50%, transparent 50.2%),
			repeating-linear-gradient(0deg, transparent 0 4.9rem, rgba(255, 255, 255, 0.018) 5rem);
		pointer-events: none;
	}
	.grain {
		position: fixed;
		inset: 0;
		opacity: 0.18;
		pointer-events: none;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.2'/%3E%3C/svg%3E");
	}
	.brief {
		width: min(78rem, 100%);
		position: relative;
		border: 1px solid #34332e;
		background: rgba(10, 10, 8, 0.89);
		box-shadow: 0 3rem 10rem #000;
	}
	header {
		display: flex;
		justify-content: space-between;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid #34332e;
		color: #867e70;
		font:
			0.6rem ui-monospace,
			monospace;
		letter-spacing: 0.18em;
	}
	.title-lockup {
		min-height: 28rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 3rem;
		padding: clamp(2rem, 6vw, 5.5rem);
	}
	.title-lockup p {
		margin: 0 0 1rem;
		color: #d88843;
		font:
			0.72rem ui-monospace,
			monospace;
		letter-spacing: 0.24em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font:
			400 clamp(4.7rem, 10vw, 9rem)/0.76 Georgia,
			serif;
		letter-spacing: -0.065em;
	}
	h1 i {
		color: transparent;
		font-style: normal;
		-webkit-text-stroke: 1px #e3c996;
	}
	.relic {
		width: clamp(12rem, 25vw, 20rem);
		aspect-ratio: 1;
		position: relative;
		display: grid;
		place-items: center;
		filter: drop-shadow(0 0 3rem rgba(238, 91, 24, 0.34));
	}
	.relic b {
		width: 28%;
		aspect-ratio: 0.72;
		background: linear-gradient(150deg, #fff1b9, #f35918 43%, #47150a 78%);
		clip-path: polygon(50% 0, 100% 40%, 72% 100%, 20% 88%, 0 34%);
		box-shadow: inset 0 0 2rem #fff;
	}
	.relic span {
		position: absolute;
		color: #22130b;
		font: 2rem Georgia;
	}
	.orbit {
		position: absolute;
		inset: 12%;
		border: 1px solid #9d6b36;
		border-radius: 50%;
		animation: turn 12s linear infinite;
	}
	.orbit::before {
		content: '';
		position: absolute;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: #ffd484;
		left: 10%;
		top: 16%;
		box-shadow: 0 0 1rem #f06a28;
	}
	.orbit.two {
		inset: 1%;
		border-style: dashed;
		animation-direction: reverse;
		animation-duration: 19s;
	}
	@keyframes turn {
		to {
			transform: rotate(360deg);
		}
	}
	.law-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-top: 1px solid #34332e;
		border-bottom: 1px solid #34332e;
	}
	.law-grid article {
		padding: 1.4rem;
		min-height: 9rem;
		border-right: 1px solid #34332e;
	}
	.law-grid article:last-child {
		border-right: 0;
	}
	.law-grid b {
		color: #be6e36;
		font:
			0.65rem ui-monospace,
			monospace;
	}
	.law-grid h2 {
		margin: 0.8rem 0 0.35rem;
		font:
			500 1rem Georgia,
			serif;
		text-transform: uppercase;
		letter-spacing: 0.07em;
	}
	.law-grid p {
		color: #918b80;
		margin: 0;
		font-size: 0.74rem;
		line-height: 1.55;
	}
	.launch {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		padding: 1.25rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
		color: #7f786b;
		font:
			0.6rem ui-monospace,
			monospace;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	input {
		width: 100%;
		border: 0;
		border-bottom: 1px solid #625b4f;
		padding: 0.5rem 0;
		background: transparent;
		color: #eee8da;
		font:
			1rem Georgia,
			serif;
		outline: none;
	}
	button {
		border: 1px solid #c47739;
		padding: 0 1.5rem;
		background: #b75522;
		color: #fff5dc;
		font:
			700 0.66rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.error {
		color: #ff9b7a;
		padding: 0 1.25rem 1.25rem;
	}
	@media (max-width: 760px) {
		.title-lockup {
			min-height: 22rem;
		}
		.relic {
			position: absolute;
			right: 1rem;
			opacity: 0.35;
		}
		.law-grid {
			grid-template-columns: 1fr;
		}
		.law-grid article {
			border-right: 0;
			border-bottom: 1px solid #34332e;
			min-height: auto;
		}
		.launch {
			grid-template-columns: 1fr;
		}
		button {
			min-height: 3.3rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.orbit {
			animation: none;
		}
	}
</style>
