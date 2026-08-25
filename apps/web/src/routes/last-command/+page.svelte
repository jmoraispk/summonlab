<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let opening = $state(false);
	let failure = $state('');
	let direction = $state('Stay with me. Guard the living, strike only when the path is clear.');

	async function descend() {
		opening = true;
		failure = '';
		try {
			const response = await fetch('/api/dev/master-death-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ direction })
			});
			const body = (await response.json()) as { runId?: string; message?: string };
			if (!response.ok || !body.runId) throw new Error(body.message ?? 'The seal held shut.');
			await goto(resolve('/mission/[runId]', { runId: body.runId }));
		} catch (error) {
			failure = error instanceof Error ? error.message : 'The seal held shut.';
			opening = false;
		}
	}
</script>

<svelte:head>
	<title>The Last Command · summonlab</title>
	<meta
		name="description"
		content="A database-backed summonlab checkpoint where the Master fights, bleeds, and can atomically end the run."
	/>
</svelte:head>

<main>
	<nav>
		<a href={resolve('/')}>summonlab</a>
		<span>MIS-009 / mortal Master checkpoint</span>
		<a href={resolve('/aftermath')}>the red tithe</a>
	</nav>

	<section class="threshold">
		<div class="omen" aria-hidden="true">
			<div class="halo"></div>
			<div class="blade"></div>
			<div class="master"></div>
			<div class="witness"></div>
			<div class="floor">03</div>
		</div>
		<div class="copy">
			<p class="eyebrow">Endless Tower · Floor 03 · life at stake</p>
			<h1>The Last<br /><em>Command</em></h1>
			<p class="lede">
				You are not a cursor above the battlefield. You enter it. Every movement and strike is
				yours—and if your body fails, the entire history closes around that moment.
			</p>
			<div class="law">
				<span>01</span>
				<p>Guard breaks before blood.</p>
			</div>
			<div class="law">
				<span>02</span>
				<p>Witnesses remember what they see.</p>
			</div>
			<div class="law fatal">
				<span>03</span>
				<p>The Master gets no second life.</p>
			</div>
			<label>
				<span>Your first order</span>
				<textarea bind:value={direction} maxlength="1000" rows="2"></textarea>
				<small>The summoned hero hears this before deployment; obedience remains best effort.</small
				>
			</label>
			<button
				type="button"
				onclick={descend}
				disabled={opening || !data.enabled}
				data-testid="open-last-command"
			>
				<span>{opening ? 'Writing the mortal ledger…' : 'Enter as the Master'}</span>
				<small
					>{data.enabled ? 'one life · persisted locally' : 'development routes disabled'}</small
				>
			</button>
			{#if failure}<p class="failure" role="alert">{failure}</p>{/if}
		</div>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #070707;
		color: #eee7d9;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	:global(*) {
		box-sizing: border-box;
	}
	main {
		min-height: 100vh;
		overflow: hidden;
		background:
			radial-gradient(circle at 24% 43%, #3b1912 0, #120c0a 24rem, transparent 48rem),
			linear-gradient(115deg, #090909 52%, #100b09);
	}
	nav {
		height: 4.5rem;
		padding: 0 4vw;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		border-bottom: 1px solid #30251f;
		color: #746a61;
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
	}
	nav a {
		color: #d7a158;
		text-decoration: none;
		font-weight: 800;
	}
	nav a:last-child {
		justify-self: end;
		color: #746a61;
	}
	.threshold {
		width: min(92vw, 1360px);
		min-height: calc(100vh - 4.5rem);
		margin: auto;
		display: grid;
		grid-template-columns: 1.08fr 0.92fr;
		align-items: center;
		gap: 7vw;
	}
	.omen {
		width: min(46vw, 39rem);
		aspect-ratio: 0.78;
		position: relative;
		justify-self: center;
		isolation: isolate;
	}
	.omen:before {
		content: '';
		position: absolute;
		inset: 3% 9%;
		border: 1px solid #70402b;
		clip-path: polygon(50% 0, 100% 18%, 90% 100%, 10% 100%, 0 18%);
		background:
			repeating-linear-gradient(160deg, transparent 0 9%, rgba(255, 255, 255, 0.025) 9.2%),
			linear-gradient(#20130f, #070707 72%);
		box-shadow:
			inset 0 0 7rem #020202,
			0 3rem 8rem #000;
		z-index: -2;
	}
	.halo {
		position: absolute;
		width: 45%;
		aspect-ratio: 1;
		top: 17%;
		left: 27.5%;
		border: 1px solid #d78a42;
		border-radius: 50%;
		box-shadow:
			0 0 0 1.3rem rgba(164, 68, 28, 0.07),
			0 0 6rem rgba(231, 100, 34, 0.23),
			inset 0 0 2.5rem rgba(219, 74, 25, 0.2);
	}
	.halo:after {
		content: '';
		position: absolute;
		inset: 23%;
		background: #0a0807;
		border-radius: 50%;
		box-shadow: 0 0 2rem #000;
	}
	.blade {
		position: absolute;
		width: 1px;
		height: 62%;
		top: 5%;
		left: 50%;
		transform: rotate(17deg);
		background: linear-gradient(transparent, #f2c77d 20%, #c63e23 78%, transparent);
		box-shadow: 0 0 1rem #ec6d2d;
		z-index: 3;
	}
	.master,
	.witness {
		position: absolute;
		bottom: 9%;
		background: #020202;
		filter: drop-shadow(0 0 1rem #000);
	}
	.master {
		left: 43%;
		width: 14%;
		height: 42%;
		clip-path: polygon(
			38% 0,
			62% 0,
			70% 12%,
			65% 29%,
			83% 45%,
			100% 100%,
			0 100%,
			18% 45%,
			35% 29%,
			30% 12%
		);
	}
	.witness {
		left: 66%;
		width: 8%;
		height: 29%;
		opacity: 0.82;
		clip-path: polygon(35% 0, 65% 0, 75% 17%, 100% 100%, 0 100%, 25% 17%);
	}
	.floor {
		position: absolute;
		left: 5%;
		bottom: 4%;
		color: transparent;
		-webkit-text-stroke: 1px #74442f;
		font:
			9rem/1 Georgia,
			serif;
		opacity: 0.42;
	}
	.eyebrow {
		margin: 0;
		color: #c87845;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
	}
	h1 {
		margin: 1rem 0 1.8rem;
		font:
			400 clamp(4rem, 7vw, 7.5rem)/0.8 Georgia,
			serif;
		letter-spacing: -0.065em;
		text-transform: uppercase;
	}
	h1 em {
		color: #bf3b27;
		font-style: normal;
		text-shadow: 0 0 3rem rgba(213, 62, 30, 0.28);
	}
	.lede {
		max-width: 34rem;
		margin: 0 0 1.6rem;
		color: #a99f93;
		font:
			1rem/1.65 Georgia,
			serif;
	}
	.law {
		width: min(100%, 33rem);
		padding: 0.55rem 0;
		display: grid;
		grid-template-columns: 2.5rem 1fr;
		align-items: center;
		border-top: 1px solid #312620;
		color: #c4b8a9;
	}
	.law span {
		color: #8b674b;
		font-size: 0.55rem;
		letter-spacing: 0.15em;
	}
	.law p {
		margin: 0;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.law.fatal {
		color: #e26d4e;
		border-bottom: 1px solid #312620;
	}
	label {
		width: min(100%, 33rem);
		margin: 1.5rem 0 0.8rem;
		display: grid;
		gap: 0.45rem;
	}
	label span,
	label small {
		color: #8f7968;
		font-size: 0.56rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	textarea {
		width: 100%;
		padding: 0.8rem 0.9rem;
		resize: vertical;
		border: 1px solid #4c3328;
		background: rgba(8, 7, 6, 0.86);
		color: #eee3d2;
		font: 0.78rem/1.5 inherit;
	}
	button {
		width: min(100%, 33rem);
		padding: 1.15rem 1.25rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border: 1px solid #a64c30;
		background: linear-gradient(100deg, #8e291d, #4f1712);
		color: #fff4df;
		cursor: pointer;
		text-align: left;
	}
	button:hover:not(:disabled) {
		filter: brightness(1.16);
	}
	button:disabled {
		cursor: wait;
		opacity: 0.62;
	}
	button span {
		font-weight: 800;
	}
	button small {
		color: #d7a38c;
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.failure {
		color: #ef8669;
	}
	@media (max-width: 820px) {
		nav {
			grid-template-columns: 1fr auto;
		}
		nav span {
			display: none;
		}
		.threshold {
			padding: 3rem 0;
			grid-template-columns: 1fr;
		}
		.omen {
			width: min(82vw, 31rem);
		}
	}
</style>
