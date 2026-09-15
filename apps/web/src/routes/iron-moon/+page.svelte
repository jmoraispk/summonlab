<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let opening = $state(false);
	let failure = $state('');

	async function openPortal() {
		opening = true;
		failure = '';
		try {
			const response = await fetch('/api/dev/iron-moon-runs', { method: 'POST' });
			const body = (await response.json()) as { runId?: string; message?: string };
			if (!response.ok || !body.runId) throw new Error(body.message ?? 'The scar would not open.');
			await goto(resolve('/tower'));
		} catch (error) {
			failure = error instanceof Error ? error.message : 'The scar would not open.';
			opening = false;
		}
	}
</script>

<svelte:head>
	<title>Iron Moon · summonlab</title>
	<meta
		name="description"
		content="Open a database-backed eight-round Iron Moon extraction mission."
	/>
</svelte:head>

<main>
	<nav>
		<a href={resolve('/')}>summonlab</a>
		<span>MIS-007 / portal mission checkpoint</span>
		<a href={resolve('/tower')}>tower</a>
	</nav>
	<section>
		<div class="moon" aria-hidden="true"><i></i><i></i><i></i></div>
		<div class="copy">
			<p>Portal World 01 · The Closing Scar</p>
			<h1>Iron<br /><em>Moon</em></h1>
			<blockquote>
				Eight rounds. Four ore. Every hand must make it back through the same wound in the sky.
			</blockquote>
			<button type="button" onclick={openPortal} disabled={opening} data-testid="open-iron-moon">
				<span>{opening ? 'Binding a new event stream…' : 'Open the silver scar'}</span>
				<small>creates a local persisted run</small>
			</button>
			{#if failure}<p class="failure" role="alert">{failure}</p>{/if}
		</div>
	</section>
	<footer>
		<div><span>Clock</span><strong>08 rounds</strong></div>
		<div><span>Quota</span><strong>04 iron ore</strong></div>
		<div><span>Law</span><strong>cargo credits on return</strong></div>
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #05080b;
		color: #e8ece9;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	:global(*) {
		box-sizing: border-box;
	}
	main {
		min-height: 100vh;
		overflow: hidden;
		background:
			linear-gradient(90deg, rgba(255, 255, 255, 0.022) 1px, transparent 1px) 0 0 / 6rem 6rem,
			radial-gradient(circle at 25% 48%, rgba(87, 151, 164, 0.14), transparent 32rem);
	}
	nav {
		height: 4.5rem;
		padding: 0 4vw;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		border-bottom: 1px solid #263136;
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		color: #748188;
	}
	nav a {
		color: #c5a86f;
		text-decoration: none;
		font-weight: 700;
	}
	nav a:last-child {
		justify-self: end;
		color: #748188;
	}
	section {
		width: min(92vw, 1300px);
		min-height: calc(100vh - 13rem);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		align-items: center;
		gap: 7vw;
	}
	.moon {
		width: min(44vw, 34rem);
		aspect-ratio: 1;
		justify-self: center;
		border-radius: 50%;
		position: relative;
		background:
			radial-gradient(
				circle at 64% 35%,
				transparent 0 7%,
				rgba(10, 15, 18, 0.46) 7.5% 10%,
				transparent 10.5%
			),
			radial-gradient(
				circle at 39% 64%,
				transparent 0 11%,
				rgba(8, 13, 16, 0.4) 11.5% 15%,
				transparent 15.5%
			),
			linear-gradient(135deg, #d9e0d7, #788f91 48%, #293a40 83%);
		box-shadow:
			0 0 0 1px #a8c1c2,
			0 0 5rem rgba(114, 192, 200, 0.3),
			-3rem 2rem 8rem rgba(42, 111, 122, 0.24);
	}
	.moon:after {
		content: '';
		position: absolute;
		inset: -7%;
		border: 1px solid rgba(154, 211, 214, 0.18);
		border-radius: 50%;
		transform: scaleX(0.24) rotate(18deg);
		box-shadow: 0 0 1.5rem #7fe1e4;
	}
	.moon i {
		position: absolute;
		left: 18%;
		right: 14%;
		height: 1px;
		background: rgba(22, 37, 41, 0.8);
		transform: rotate(-24deg);
	}
	.moon i:nth-child(1) {
		top: 32%;
	}
	.moon i:nth-child(2) {
		top: 51%;
		left: 7%;
	}
	.moon i:nth-child(3) {
		top: 71%;
		left: 29%;
	}
	.copy > p {
		color: #80a7a9;
		font-size: 0.62rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	h1 {
		margin: 1rem 0 2rem;
		font:
			400 clamp(5rem, 10vw, 9rem)/0.7 Georgia,
			serif;
		text-transform: uppercase;
		letter-spacing: -0.07em;
	}
	h1 em {
		font-style: normal;
		color: transparent;
		-webkit-text-stroke: 1px #b9cfd0;
	}
	blockquote {
		margin: 0 0 2rem;
		padding-left: 1.4rem;
		border-left: 1px solid #506266;
		color: #9da8a6;
		font:
			1.05rem/1.6 Georgia,
			serif;
		max-width: 31rem;
	}
	button {
		width: min(100%, 31rem);
		padding: 1.1rem 1.2rem;
		border: 1px solid #93c8c8;
		background: linear-gradient(100deg, #b9e0dc, #6fa5a7);
		color: #071012;
		display: flex;
		justify-content: space-between;
		align-items: center;
		text-align: left;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	button span {
		font-weight: 800;
	}
	button small {
		font-size: 0.55rem;
	}
	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.failure {
		color: #e58c7f;
		font-size: 0.72rem;
	}
	footer {
		height: 8.5rem;
		border-top: 1px solid #263136;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		padding: 0 4vw;
	}
	footer div {
		padding: 1.8rem 2rem;
		border-right: 1px solid #263136;
		display: grid;
		gap: 0.5rem;
	}
	footer div:last-child {
		border: 0;
	}
	footer span {
		color: #637276;
		font-size: 0.56rem;
		text-transform: uppercase;
		letter-spacing: 0.16em;
	}
	footer strong {
		font:
			1.1rem Georgia,
			serif;
		text-transform: uppercase;
	}
	@media (max-width: 760px) {
		nav {
			grid-template-columns: 1fr auto;
		}
		nav span {
			display: none;
		}
		section {
			grid-template-columns: 1fr;
			padding: 3rem 0;
			gap: 3rem;
		}
		.moon {
			width: min(76vw, 25rem);
		}
		h1 {
			font-size: clamp(4.5rem, 22vw, 7rem);
		}
		footer {
			height: auto;
			grid-template-columns: 1fr;
		}
		footer div {
			border-right: 0;
			border-bottom: 1px solid #263136;
		}
	}
</style>
