<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let seed = $state('the-bridge-remembers');
	let busy = $state(false);
	let errorMessage = $state('');

	async function createRun() {
		busy = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/dev/story-patch-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ seed })
			});
			const body = (await response.json()) as { runId?: string; message?: string; detail?: string };
			if (!response.ok || !body.runId) {
				throw new Error(body.detail ?? body.message ?? 'Run creation failed.');
			}
			await goto(resolve('/story-patch/[runId]', { runId: body.runId }));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Run creation failed.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>StoryDirector Aperture · summonlab</title>
	<meta
		name="description"
		content="Commit one bounded agent story choice without surrendering game truth."
	/>
</svelte:head>

<main>
	<section class="launch-card">
		<div class="index">MIS—015 / RUNTIME NARRATIVE AUTHORITY</div>
		<div class="hero">
			<div>
				<p>Floor 04 · The Severed Relay</p>
				<h1>Let the story<br /><em>breathe.</em></h1>
			</div>
			<div class="aperture" aria-hidden="true"><i></i><span>04</span><i></i></div>
		</div>
		<div class="rules">
			<article>
				<span>01</span><strong>Agents choose expression.</strong><small
					>One optional beat. One open slot. One recorded intent.</small
				>
			</article>
			<article>
				<span>02</span><strong>The engine keeps truth.</strong><small
					>Objectives, arena, rewards, anchors, and finale remain immutable.</small
				>
			</article>
			<article>
				<span>03</span><strong>Knowledge has a holder.</strong><small
					>A role can speak only through a living summon who owns the evidence.</small
				>
			</article>
		</div>
		<div class="launch">
			<label
				><span>Company seed</span><input
					bind:value={seed}
					maxlength="256"
					data-testid="story-patch-seed"
				/></label
			>
			<button
				disabled={busy || !seed.trim()}
				onclick={createRun}
				data-testid="create-story-patch-run"
			>
				{busy ? 'Opening aperture…' : 'Enter the severed relay'}
			</button>
		</div>
		{#if errorMessage}<div class="error" role="alert">{errorMessage}</div>{/if}
	</section>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #05080a;
		color: #f1eadc;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: clamp(1.2rem, 5vw, 5rem);
		background:
			radial-gradient(circle at 82% 22%, #143438 0, transparent 27rem),
			repeating-linear-gradient(117deg, transparent 0 5rem, rgba(204, 156, 69, 0.025) 5rem 5.05rem),
			#05080a;
	}
	.launch-card {
		width: min(78rem, 100%);
		border: 1px solid #364144;
		background: rgba(8, 12, 14, 0.94);
		box-shadow: 0 2.5rem 8rem #000;
	}
	.index {
		border-bottom: 1px solid #313b3e;
		padding: 0.75rem 1rem;
		color: #73807f;
		font: 0.58rem monospace;
		letter-spacing: 0.18em;
	}
	.hero {
		padding: clamp(2rem, 6vw, 5rem);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
	}
	p {
		color: #d8a44d;
		margin: 0;
		font-size: 0.65rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	h1 {
		margin: 1rem 0 0;
		font:
			400 clamp(4.5rem, 10vw, 8.7rem)/0.78 Georgia,
			serif;
		letter-spacing: -0.065em;
		text-transform: uppercase;
	}
	h1 em {
		color: transparent;
		font-style: normal;
		-webkit-text-stroke: 1px #c8b892;
	}
	.aperture {
		width: clamp(8rem, 16vw, 12rem);
		aspect-ratio: 1;
		border: 1px solid #50b9b4;
		border-radius: 50%;
		display: grid;
		place-content: center;
		text-align: center;
		color: #67d6d0;
		box-shadow:
			0 0 4rem rgba(65, 195, 187, 0.12),
			inset 0 0 0 0.6rem #080d0f,
			inset 0 0 0 calc(0.6rem + 1px) #264d4c;
		animation: breathe 4s ease-in-out infinite;
	}
	.aperture span {
		font:
			3rem Georgia,
			serif;
	}
	.aperture i {
		display: block;
		width: 3.5rem;
		height: 1px;
		background: #4caaa5;
		margin: 0.45rem;
	}
	.rules {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-block: 1px solid #303a3c;
	}
	article {
		min-height: 10rem;
		padding: 1.3rem;
		border-right: 1px solid #303a3c;
		display: grid;
		align-content: space-between;
	}
	article:last-child {
		border: 0;
	}
	article span {
		color: #5dcbc5;
		font:
			1.3rem Georgia,
			serif;
	}
	article strong {
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	article small {
		color: #7e8a89;
		line-height: 1.5;
	}
	.launch {
		padding: 1.5rem;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: end;
	}
	label {
		display: grid;
		gap: 0.55rem;
	}
	label span {
		color: #9c8a66;
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	input {
		min-width: 0;
		border: 1px solid #354143;
		background: #0b1113;
		color: #f1eadc;
		padding: 0.95rem;
		font: inherit;
	}
	button {
		border: 1px solid #dca64b;
		background: #dca64b;
		color: #171008;
		padding: 1rem 1.4rem;
		font-weight: 850;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: wait;
	}
	.error {
		margin: 0 1.5rem 1.5rem;
		color: #ff927d;
	}
	@keyframes breathe {
		50% {
			transform: scale(1.035);
			box-shadow:
				0 0 6rem rgba(65, 195, 187, 0.22),
				inset 0 0 0 0.6rem #080d0f,
				inset 0 0 0 calc(0.6rem + 1px) #39706e;
		}
	}
	@media (max-width: 760px) {
		.hero {
			align-items: end;
		}
		.aperture {
			width: 7rem;
		}
		.rules {
			grid-template-columns: 1fr;
		}
		article {
			border-right: 0;
			border-bottom: 1px solid #303a3c;
			min-height: 8rem;
		}
		.launch {
			grid-template-columns: 1fr;
		}
	}
</style>
