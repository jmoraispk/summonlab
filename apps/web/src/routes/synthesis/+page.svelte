<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let seed = $state('private-chamber-01');
	let creating = $state(false);
	let errorMessage = $state('');

	async function createRun() {
		creating = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/dev/synthesis-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ seed })
			});
			const body = (await response.json()) as { runId?: string; message?: string };
			if (!response.ok || !body.runId) throw new Error(body.message ?? 'Run creation failed.');
			await goto(resolve('/synthesis/[runId]', { runId: body.runId }));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Run creation failed.';
		} finally {
			creating = false;
		}
	}
</script>

<svelte:head><title>Synthesis Chamber · summonlab</title></svelte:head>

<main>
	<div class="lens" aria-hidden="true"><i></i><i></i><span>VII</span></div>
	<section>
		<a href={resolve('/')} class="wordmark">summonlab</a>
		<p class="eyebrow">FIN—001 / IRREVERSIBLE SOCIAL TRANSACTION</p>
		<h1>What does a<br />company <em>remember?</em></h1>
		<p class="lead">
			Open one four-summon checkpoint. Choose who becomes essence, who carries it, and who is
			allowed to know.
		</p>
		<label>
			<span>Deterministic seed</span>
			<input bind:value={seed} data-testid="synthesis-seed" />
		</label>
		<button onclick={createRun} disabled={creating} data-testid="create-synthesis-run">
			{creating ? 'Opening chamber…' : 'Enter the chamber'}
		</button>
		{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
	</section>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #080604;
		color: #f2eadc;
		font-family: Inter, system-ui, sans-serif;
	}
	main {
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(20rem, 42rem) 1fr;
		align-items: center;
		gap: 8vw;
		padding: clamp(2rem, 7vw, 7rem);
		overflow: hidden;
		background: radial-gradient(circle at 75% 50%, #3d260f 0, #140d07 18%, #080604 43%);
	}
	section {
		position: relative;
		z-index: 2;
	}
	.wordmark {
		color: #f2eadc;
		text-decoration: none;
		font-weight: 800;
		letter-spacing: -0.03em;
	}
	.eyebrow {
		color: #d7a453;
		margin-top: 5rem;
		font:
			0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.18em;
	}
	h1 {
		margin: 1rem 0;
		font:
			300 clamp(3.5rem, 8vw, 7.5rem)/0.86 Georgia,
			serif;
		letter-spacing: -0.065em;
	}
	h1 em {
		color: #d7a453;
		font-weight: 300;
	}
	.lead {
		max-width: 36rem;
		color: #9f978b;
		font-size: 1rem;
		line-height: 1.7;
	}
	label {
		display: block;
		max-width: 30rem;
		margin-top: 2.5rem;
	}
	label span {
		display: block;
		color: #8e7c65;
		margin-bottom: 0.55rem;
		font:
			0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	input {
		width: 100%;
		border: 1px solid #574125;
		background: #0f0b07;
		color: #ede2d1;
		padding: 0.95rem;
	}
	button {
		margin-top: 1rem;
		border: 1px solid #d7a453;
		background: #c88e38;
		color: #110b05;
		padding: 0.95rem 1.3rem;
		font-weight: 800;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.55;
	}
	.error {
		color: #e78467;
	}
	.lens {
		width: min(52vw, 44rem);
		aspect-ratio: 1;
		border: 1px solid #7b5527;
		border-radius: 50%;
		display: grid;
		place-items: center;
		position: relative;
		box-shadow:
			0 0 9rem #9b5e171c,
			inset 0 0 5rem #000;
	}
	.lens::before,
	.lens::after,
	.lens i {
		content: '';
		position: absolute;
		border: 1px solid #9a6d35;
		border-radius: 50%;
		inset: 9%;
	}
	.lens::after {
		inset: 24%;
		box-shadow:
			0 0 4rem #e5a94b55,
			inset 0 0 3rem #e5a94b33;
	}
	.lens i:first-child {
		inset: 38%;
		background: radial-gradient(circle, #f6cf81 0 5%, #bb7c25 8%, #1d1208 35%, #050403 70%);
	}
	.lens i:last-child {
		inset: 2%;
		border-style: dashed;
		animation: turn 26s linear infinite;
	}
	.lens span {
		z-index: 2;
		color: #f1c671;
		font: 3rem Georgia;
		text-shadow: 0 0 1rem #f6a52c;
	}
	@keyframes turn {
		to {
			transform: rotate(360deg);
		}
	}
	@media (max-width: 800px) {
		main {
			grid-template-columns: 1fr;
		}
		.lens {
			position: absolute;
			right: -45vw;
			opacity: 0.42;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.lens i:last-child {
			animation: none;
		}
	}
</style>
