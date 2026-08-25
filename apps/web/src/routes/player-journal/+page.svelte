<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let seed = $state('the-ledger-remembers');
	let busy = $state(false);
	let errorMessage = $state('');

	async function createRun() {
		busy = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/dev/player-journal-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ seed })
			});
			const body = (await response.json()) as { runId?: string; message?: string; detail?: string };
			if (!response.ok || !body.runId) {
				throw new Error(body.detail ?? body.message ?? 'Run creation failed.');
			}
			await goto(resolve('/mission/[runId]', { runId: body.runId }));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Run creation failed.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Company Journal · summonlab</title>
	<meta
		name="description"
		content="Create a local company with authoritative growth, control, story, and replay records."
	/>
</svelte:head>

<main>
	<section class="masthead">
		<div class="folio">MIS—014 / REPLAY CURSOR 0001</div>
		<div class="title-row">
			<div>
				<p>Local engineering slice · The Company Ledger</p>
				<h1>Deeds become<br /><em>history.</em></h1>
			</div>
			<div class="seal" aria-hidden="true"><span>SL</span><small>AUTH</small></div>
		</div>
		<div class="principles" aria-label="Journal principles">
			<article>
				<span>01 · Numbers</span>
				<strong>Before. After. Delta.</strong>
				<small>Experience, levels, rewards, and party progress come from engine events.</small>
			</article>
			<article>
				<span>02 · Agency</span>
				<strong>Who chose—and why.</strong>
				<small>Manual, timer, model, habit, direction, and fallback sources remain visible.</small>
			</article>
			<article>
				<span>03 · Proof</span>
				<strong>Every line has a cursor.</strong>
				<small>The exact state hash binds a readable memory to deterministic replay.</small>
			</article>
		</div>
		<div class="launch">
			<label>
				<span>Company seed</span>
				<input bind:value={seed} maxlength="256" data-testid="journal-seed" />
			</label>
			<button disabled={busy || !seed.trim()} onclick={createRun} data-testid="create-journal-run">
				{busy ? 'Writing the first page…' : 'Open a prepared company'}
			</button>
		</div>
		<p class="note">
			Creates one adult hero, records two training sessions, binds a fallback doctrine, and prepares
			Floor 01 so every journal lens has something honest to show.
		</p>
		{#if errorMessage}<div class="error" role="alert">{errorMessage}</div>{/if}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #070a0b;
		color: #eee6d6;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	:global(*) {
		box-sizing: border-box;
	}
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: clamp(1.2rem, 5vw, 4rem);
		background:
			linear-gradient(90deg, transparent 49.9%, rgba(211, 162, 78, 0.08) 50%, transparent 50.1%),
			radial-gradient(circle at 76% 18%, rgba(65, 188, 180, 0.14), transparent 28rem), #070a0b;
	}
	.masthead {
		width: min(78rem, 100%);
		border: 1px solid #313839;
		background: rgba(10, 14, 15, 0.94);
		box-shadow: 0 2rem 7rem #000;
	}
	.folio {
		padding: 0.7rem 1rem;
		border-bottom: 1px solid #313839;
		color: #697472;
		font: 0.58rem monospace;
		letter-spacing: 0.16em;
	}
	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
		padding: clamp(1.5rem, 4vw, 4rem);
	}
	p,
	.principles span,
	label span {
		color: #d3a14e;
		font-size: 0.64rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.8rem 0 0;
		font:
			400 clamp(4rem, 9vw, 8rem) / 0.78 Georgia,
			serif;
		letter-spacing: -0.065em;
		text-transform: uppercase;
	}
	h1 em {
		color: transparent;
		font-style: normal;
		-webkit-text-stroke: 1px #cdb98f;
	}
	.seal {
		width: clamp(6rem, 12vw, 9rem);
		aspect-ratio: 1;
		border: 1px solid #478f8a;
		border-radius: 50%;
		display: grid;
		place-content: center;
		text-align: center;
		box-shadow:
			inset 0 0 0 0.5rem #0a0e0f,
			inset 0 0 0 calc(0.5rem + 1px) #284b49;
		transform: rotate(-7deg);
	}
	.seal span {
		color: #59c9c2;
		font:
			400 2rem Georgia,
			serif;
	}
	.seal small {
		color: #72817e;
		font-size: 0.5rem;
		letter-spacing: 0.2em;
	}
	.principles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-top: 1px solid #313839;
		border-bottom: 1px solid #313839;
	}
	.principles article {
		min-height: 9rem;
		padding: 1rem;
		border-right: 1px solid #313839;
		display: grid;
		align-content: space-between;
		gap: 0.75rem;
	}
	.principles article:last-child {
		border: 0;
	}
	.principles strong {
		font:
			400 1.15rem Georgia,
			serif;
	}
	.principles small,
	.note {
		color: #7f8987;
		font-size: 0.68rem;
		line-height: 1.55;
	}
	.launch {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.75rem;
		padding: 1.2rem;
	}
	label {
		display: grid;
		gap: 0.4rem;
	}
	input {
		width: 100%;
		border: 1px solid #313839;
		background: #0d1213;
		color: #e9e1d2;
		padding: 0.85rem 1rem;
		font: inherit;
	}
	button {
		align-self: end;
		border: 1px solid #d5a34e;
		background: #d5a34e;
		color: #181108;
		padding: 0.9rem 1.2rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: wait;
	}
	.note {
		margin: 0;
		padding: 0 1.2rem 1.2rem;
		letter-spacing: normal;
		text-transform: none;
	}
	.error {
		margin: 0 1.2rem 1.2rem;
		border-left: 2px solid #e8775f;
		background: rgba(232, 119, 95, 0.08);
		padding: 0.8rem;
		color: #ef927e;
		font-size: 0.72rem;
	}
	@media (max-width: 720px) {
		.seal {
			display: none;
		}
		.principles,
		.launch {
			grid-template-columns: 1fr;
		}
		.principles article {
			border-right: 0;
			border-bottom: 1px solid #313839;
		}
	}
</style>
