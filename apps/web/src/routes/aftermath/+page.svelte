<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let opening = $state(false);
	let failure = $state('');
	let direction = $state('When threatened, attack and strike the nearest threat.');

	async function descend() {
		opening = true;
		failure = '';
		try {
			const response = await fetch('/api/dev/aftermath-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ direction })
			});
			const body = (await response.json()) as { runId?: string; message?: string };
			if (!response.ok || !body.runId) throw new Error(body.message ?? 'The lift refused us.');
			await goto(resolve('/tower'));
		} catch (error) {
			failure = error instanceof Error ? error.message : 'The lift refused us.';
			opening = false;
		}
	}
</script>

<svelte:head>
	<title>The Red Tithe · summonlab</title>
	<meta
		name="description"
		content="Enter a database-backed mission where exposed combat creates persistent injury, equipment wear, witnessed memory, and permadeath."
	/>
</svelte:head>

<main>
	<nav>
		<a href={resolve('/')}>summonlab</a>
		<span>MIS-008 / consequence checkpoint</span>
		<a href={resolve('/tower')}>tower</a>
	</nav>

	<section class="gate">
		<div class="shaft" aria-hidden="true">
			<div class="floor">03</div>
			<div class="door left"></div>
			<div class="door right"></div>
			<div class="salt"></div>
			<div class="figure"></div>
		</div>
		<div class="copy">
			<p>Endless Tower · Floor 03</p>
			<h1>The Red<br /><em>Tithe</em></h1>
			<blockquote>
				The tower does not forget a wound. Neither does the person who watched it happen.
			</blockquote>
			<label>
				<span>Direction to the summoned hero</span>
				<textarea bind:value={direction} maxlength="1000" rows="2"></textarea>
				<small>Witnessed now; followed as a best effort during the mission.</small>
			</label>
			<button
				type="button"
				onclick={descend}
				disabled={opening || !data.enabled}
				data-testid="open-aftermath"
			>
				<span>{opening ? 'Sealing the consequence ledger…' : 'Descend to Floor 03'}</span>
				<small
					>{data.enabled ? 'creates a local persisted run' : 'development routes disabled'}</small
				>
			</button>
			{#if failure}<p class="failure" role="alert">{failure}</p>{/if}
		</div>
	</section>

	<footer>
		<div><span>Defense</span><strong>guard breaks first</strong></div>
		<div><span>Body</span><strong>injury persists</strong></div>
		<div><span>Memory</span><strong>witnesses only</strong></div>
		<div><span>Death</span><strong>permanent</strong></div>
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #090707;
		color: #eee8dd;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	:global(*) {
		box-sizing: border-box;
	}
	main {
		min-height: 100vh;
		overflow: hidden;
		background:
			linear-gradient(90deg, transparent 49.9%, rgba(235, 220, 196, 0.035) 50%, transparent 50.1%),
			radial-gradient(circle at 30% 46%, rgba(130, 18, 22, 0.24), transparent 34rem), #090707;
	}
	nav {
		height: 4.5rem;
		padding: 0 4vw;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		border-bottom: 1px solid #302627;
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.17em;
		color: #786e6c;
	}
	nav a {
		color: #d8ae6e;
		text-decoration: none;
		font-weight: 750;
	}
	nav a:last-child {
		justify-self: end;
		color: #786e6c;
	}
	.gate {
		width: min(92vw, 1320px);
		min-height: calc(100vh - 13rem);
		margin: auto;
		display: grid;
		grid-template-columns: 1.08fr 0.92fr;
		align-items: center;
		gap: 7vw;
	}
	.shaft {
		width: min(48vw, 39rem);
		aspect-ratio: 0.82;
		position: relative;
		justify-self: center;
		border: 1px solid #4b3838;
		background:
			repeating-linear-gradient(0deg, transparent 0 11%, rgba(255, 255, 255, 0.022) 11.2%),
			linear-gradient(150deg, #1c1716, #080707 64%);
		box-shadow:
			inset 0 0 7rem #050404,
			0 2rem 7rem rgba(0, 0, 0, 0.5);
	}
	.shaft:before,
	.shaft:after {
		content: '';
		position: absolute;
		inset: 5%;
		border: 1px solid #4c3a37;
		clip-path: polygon(0 0, 100% 0, 92% 100%, 8% 100%);
	}
	.shaft:after {
		inset: 12% 14% 7%;
		border-color: #681f23;
		box-shadow: inset 0 0 4rem rgba(143, 21, 27, 0.3);
	}
	.floor {
		position: absolute;
		top: 4%;
		left: 7%;
		z-index: 4;
		font:
			7rem/1 Georgia,
			serif;
		color: transparent;
		-webkit-text-stroke: 1px #6c4140;
		opacity: 0.52;
	}
	.door {
		position: absolute;
		top: 15%;
		bottom: 7%;
		width: 36%;
		z-index: 2;
		background: linear-gradient(90deg, #110d0d, #312021);
		border: 1px solid #5d3334;
	}
	.door.left {
		left: 14%;
		transform: perspective(700px) rotateY(17deg);
		transform-origin: left;
	}
	.door.right {
		right: 14%;
		transform: perspective(700px) rotateY(-17deg);
		transform-origin: right;
	}
	.salt {
		position: absolute;
		left: 40%;
		top: 42%;
		z-index: 3;
		width: 20%;
		aspect-ratio: 1;
		background: #f4eee0;
		clip-path: polygon(50% 0, 86% 26%, 100% 74%, 55% 100%, 8% 79%, 0 31%);
		box-shadow: 0 0 2.6rem rgba(255, 244, 217, 0.36);
	}
	.figure {
		position: absolute;
		left: 48%;
		bottom: 7%;
		z-index: 4;
		width: 4%;
		height: 28%;
		background: #030303;
		clip-path: polygon(35% 0, 65% 0, 76% 17%, 100% 100%, 0 100%, 24% 17%);
	}
	.copy > p {
		margin: 0;
		color: #bd7f60;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
	}
	h1 {
		margin: 1rem 0 2.5rem;
		font:
			400 clamp(4rem, 7.5vw, 7.8rem)/0.79 Georgia,
			serif;
		letter-spacing: -0.065em;
		text-transform: uppercase;
	}
	h1 em {
		color: #8f1c23;
		font-style: normal;
		text-shadow: 0 0 3rem rgba(157, 21, 31, 0.4);
	}
	blockquote {
		max-width: 35rem;
		margin: 0 0 2.7rem;
		padding-left: 1.5rem;
		border-left: 1px solid #704244;
		font:
			1.15rem/1.55 Georgia,
			serif;
		color: #c7bdb0;
	}
	label {
		width: min(100%, 30rem);
		margin-bottom: 1rem;
		display: grid;
		gap: 0.5rem;
	}
	label span,
	label small {
		color: #9d7772;
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	textarea {
		width: 100%;
		padding: 0.85rem 0.95rem;
		resize: vertical;
		border: 1px solid #4a3031;
		background: rgba(12, 8, 9, 0.8);
		color: #e4d6c8;
		font: 0.8rem/1.5 inherit;
	}
	button {
		width: min(100%, 30rem);
		padding: 1.25rem 1.4rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border: 1px solid #8f3438;
		background: #721b21;
		color: #fff8ec;
		cursor: pointer;
		text-align: left;
	}
	button:hover:not(:disabled) {
		background: #8a2229;
	}
	button:disabled {
		cursor: wait;
		opacity: 0.62;
	}
	button span {
		font-weight: 760;
	}
	button small {
		color: #d5a8a5;
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.failure {
		color: #ef898b;
	}
	footer {
		height: 8.5rem;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border-top: 1px solid #302627;
	}
	footer div {
		padding: 1.6rem 3vw;
		display: grid;
		gap: 0.5rem;
		border-right: 1px solid #302627;
	}
	footer span {
		color: #786e6c;
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.15em;
	}
	footer strong {
		font:
			1rem Georgia,
			serif;
		text-transform: capitalize;
	}
	@media (max-width: 800px) {
		nav {
			grid-template-columns: 1fr auto;
		}
		nav span {
			display: none;
		}
		.gate {
			padding: 3rem 0;
			grid-template-columns: 1fr;
		}
		.shaft {
			width: min(82vw, 30rem);
		}
		footer {
			height: auto;
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
