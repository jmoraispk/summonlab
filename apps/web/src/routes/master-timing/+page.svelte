<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let seed = $state('four-command-sigils');
	let busy = $state(false);
	let errorMessage = $state('');

	async function createRun() {
		busy = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/dev/master-timing-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ seed })
			});
			const body = (await response.json()) as { runId?: string; message?: string };
			if (!response.ok || !body.runId) throw new Error(body.message ?? 'Run creation failed.');
			await goto(resolve('/tower'));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Run creation failed.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Master Timing Console · summonlab</title>
	<meta
		name="description"
		content="Create a local mission run with authoritative Wait, Countdown, Step, and Continuous control."
	/>
</svelte:head>

<main>
	<section>
		<p>Local engineering slice · MIS-012</p>
		<h1>Four ways<br />to <em>command.</em></h1>
		<div class="modes" aria-label="Master timing modes">
			{#each [['Wait', 'No action happens until you commit.'], ['Countdown', 'Five visible seconds, then the baseline acts.'], ['Step', 'Resolve one baseline choice, then return to Wait.'], ['Continuous', 'Keep resolving until you pause or the mission ends.']] as mode (mode[0])}
				<article><span>{mode[0]}</span><small>{mode[1]}</small></article>
			{/each}
		</div>
		<label>
			<span>Summoning seed</span>
			<input bind:value={seed} maxlength="256" />
		</label>
		<button
			disabled={busy || !seed.trim()}
			onclick={createRun}
			data-testid="create-master-timing-run"
		>
			{busy ? 'Opening the threshold…' : 'Create timing run'}
		</button>
		{#if errorMessage}<div class="error" role="alert">{errorMessage}</div>{/if}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #07090b;
		color: #ebe3d3;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem;
		background:
			radial-gradient(circle at 68% 20%, rgba(68, 207, 201, 0.13), transparent 30rem),
			linear-gradient(145deg, transparent 49.8%, rgba(224, 170, 81, 0.08) 50%, transparent 50.2%);
	}
	section {
		width: min(68rem, 100%);
	}
	p {
		color: #d8a554;
		font-size: 0.68rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	h1 {
		margin: 1rem 0 3rem;
		font:
			400 clamp(4rem, 10vw, 8rem) / 0.78 Georgia,
			serif;
		letter-spacing: -0.07em;
		text-transform: uppercase;
	}
	h1 em {
		color: transparent;
		font-style: normal;
		-webkit-text-stroke: 1px #cfbc96;
	}
	.modes {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border: 1px solid #293033;
		margin-bottom: 2rem;
	}
	article {
		min-height: 7.5rem;
		padding: 1rem;
		border-right: 1px solid #293033;
		display: grid;
		align-content: space-between;
		background: rgba(13, 17, 19, 0.86);
	}
	article:last-child {
		border: 0;
	}
	article span {
		color: #62d4cf;
		font-family: Georgia, serif;
		font-size: 1.15rem;
	}
	article small,
	label span {
		color: #7e8988;
		line-height: 1.45;
	}
	label {
		display: grid;
		gap: 0.5rem;
		margin-bottom: 0.8rem;
		font-size: 0.65rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	input {
		border: 1px solid #30383a;
		background: #0d1113;
		color: #e9e0cf;
		padding: 0.9rem 1rem;
		font: inherit;
	}
	button {
		border: 1px solid #dfa94f;
		background: #dca447;
		color: #160f08;
		padding: 1rem 1.5rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: wait;
	}
	.error {
		margin-top: 1rem;
		color: #ef8b72;
	}
	@media (max-width: 720px) {
		.modes {
			grid-template-columns: 1fr 1fr;
		}
		article:nth-child(2) {
			border-right: 0;
		}
		article:nth-child(-n + 2) {
			border-bottom: 1px solid #293033;
		}
	}
</style>
