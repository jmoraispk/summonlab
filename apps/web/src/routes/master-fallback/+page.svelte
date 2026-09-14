<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let seed = $state('the-company-decides');
	let busy = $state(false);
	let errorMessage = $state('');

	async function createRun() {
		busy = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/dev/master-fallback-runs', {
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
	<title>Fallback Doctrine · summonlab</title>
	<meta
		name="description"
		content="Create a local mission run with directed and seeded-random Master fallback policies."
	/>
</svelte:head>

<main>
	<section>
		<p>Local engineering slice · MIS-013</p>
		<h1>Give intent.<br /><em>Keep agency.</em></h1>
		<div class="doctrines" aria-label="Fallback doctrines">
			<article>
				<span>Directed</span>
				<strong>Priorities shape the choice.</strong>
				<small>Deterministic scoring interprets a bounded direction against legal actions.</small>
			</article>
			<article>
				<span>Seeded random</span>
				<strong>The run seed decides.</strong>
				<small>The same state, window, and seed always produce the same recorded action.</small>
			</article>
			<article>
				<span>Safety</span>
				<strong>Wait remains sovereign.</strong>
				<small
					>Health, ambiguity, irreversible steps, or a fallback ceiling can force a pause.</small
				>
			</article>
		</div>
		<label>
			<span>Summoning seed</span>
			<input bind:value={seed} maxlength="256" />
		</label>
		<button
			disabled={busy || !seed.trim()}
			onclick={createRun}
			data-testid="create-master-fallback-run"
		>
			{busy ? 'Binding doctrine…' : 'Create fallback run'}
		</button>
		{#if errorMessage}<div class="error" role="alert">{errorMessage}</div>{/if}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #06090a;
		color: #eee5d4;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem;
		background:
			radial-gradient(circle at 76% 18%, rgba(76, 211, 196, 0.16), transparent 28rem),
			linear-gradient(112deg, transparent 55%, rgba(217, 164, 72, 0.07) 55.2%, transparent 55.4%);
	}
	section {
		width: min(72rem, 100%);
	}
	p {
		color: #d8a554;
		font-size: 0.68rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	h1 {
		margin: 1rem 0 2.5rem;
		font:
			400 clamp(3.7rem, 9vw, 7.5rem) / 0.82 Georgia,
			serif;
		letter-spacing: -0.065em;
		text-transform: uppercase;
	}
	h1 em {
		color: transparent;
		font-style: normal;
		-webkit-text-stroke: 1px #d2c09b;
	}
	.doctrines {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border: 1px solid #2d3739;
		margin-bottom: 2rem;
	}
	article {
		min-height: 10rem;
		padding: 1.1rem;
		border-right: 1px solid #2d3739;
		display: grid;
		align-content: space-between;
		background: rgba(13, 18, 19, 0.88);
	}
	article:last-child {
		border: 0;
	}
	article span {
		color: #62d4cf;
		font:
			1.2rem Georgia,
			serif;
	}
	article strong {
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
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
		.doctrines {
			grid-template-columns: 1fr;
		}
		article {
			border-right: 0;
			border-bottom: 1px solid #2d3739;
		}
	}
</style>
