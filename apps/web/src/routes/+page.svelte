<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import PlayerSettingsPanel from '$lib/components/PlayerSettingsPanel.svelte';
	import { loadPlayerSettings } from '$lib/player-settings';
	import { focusDialog, handleModalKeydown } from '$lib/modal-focus';
	import playerVisualManifest from '../../static/runtime/player/manifest.json';

	const titlePhone = playerVisualManifest.assets.find((asset) => asset.usage === 'title-phone')!;
	const titleDesktop = playerVisualManifest.assets.find(
		(asset) => asset.usage === 'title-desktop'
	)!;

	let { data } = $props();
	let seed = $state('hearth-01');
	let beginning = $state(false);
	let errorMessage = $state('');
	let settingsOpen = $state(false);
	let settingsDialog = $state<HTMLDivElement>(null!);
	let settingsTrigger = $state<HTMLButtonElement>(null!);
	let returnFocus: HTMLElement | null = null;

	onMount(() => loadPlayerSettings());

	async function openSettings() {
		returnFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : settingsTrigger;
		settingsOpen = true;
		await tick();
		focusDialog(settingsDialog);
	}

	async function closeSettings() {
		settingsOpen = false;
		await tick();
		returnFocus?.focus();
	}

	async function beginCampaign() {
		beginning = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/campaigns', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ seed, controlMode: loadPlayerSettings().controlMode })
			});
			const body = (await response.json()) as {
				campaign?: { runId: string };
				message?: string;
			};
			if (!response.ok || !body.campaign) throw new Error(body.message ?? 'The gate stayed dark.');
			await goto(resolve('/onboarding/[runId]', { runId: body.campaign.runId }));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The gate stayed dark.';
			beginning = false;
		}
	}
</script>

<svelte:head>
	<title>Summonlab · Every hero chooses</title>
	<meta
		name="description"
		content="Lead an autonomous summoned company through a hundred-floor tower and a living settlement."
	/>
</svelte:head>

<main data-testid="campaign-title" inert={settingsOpen}>
	<img
		class="key-art"
		src={titleDesktop.publicPath}
		srcset={`${titlePhone.publicPath} ${titlePhone.width}w, ${titleDesktop.publicPath} ${titleDesktop.width}w`}
		sizes="(max-width: 650px) 100vw, 78vw"
		width={titleDesktop.width}
		height={titleDesktop.height}
		fetchpriority="high"
		decoding="async"
		alt="An agent hero crossing an arcane summoning gate"
	/>
	<div class="wash"></div>
	<div class="grain"></div>

	<header>
		<a class="wordmark" href={resolve('/')}>SUMMON<span>LAB</span></a>
		<div class="system-state" class:offline={data.health.database.status !== 'available'}>
			<i></i>{data.health.database.status === 'available' ? 'Hearth online' : 'Hearth offline'}
		</div>
		<button bind:this={settingsTrigger} type="button" onclick={openSettings} data-sound-cue="menu"
			>Settings</button
		>
	</header>

	<section class="title-copy">
		<p class="kicker">A 100-floor autonomous RPG</p>
		<h1>They were summoned.<br /><em>They still choose.</em></h1>
		<p class="premise">
			Wake the last settlement. Call three strangers through the gate. Earn their trust—or lead
			alone—while every habit, fear, promise, and death becomes history.
		</p>

		{#if data.campaign && data.resumePath}
			<a class="continue" href={data.resumePath} data-testid="continue-campaign">
				<span>Continue chronicle</span>
				<strong>{data.campaign.campaignSeed}</strong>
				<small
					>Onboarding {data.campaign.onboardingStep}/3 · {data.campaign.heroes.length} summoned</small
				>
				<b>→</b>
			</a>
		{/if}

		<form
			onsubmit={(event) => {
				event.preventDefault();
				void beginCampaign();
			}}
		>
			<label for="campaign-seed">New chronicle seed</label>
			<div class="seed-row">
				<input id="campaign-seed" bind:value={seed} minlength="1" maxlength="128" required />
				<button
					type="submit"
					disabled={beginning}
					data-testid="begin-campaign"
					data-sound-cue="gate"
				>
					{beginning ? 'Opening…' : 'Begin'}
				</button>
			</div>
			<p>
				One seed binds physiology, personality, habits, and the first company. Reuse it to replay.
			</p>
		</form>

		{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
	</section>

	<aside class="tower-mark" aria-hidden="true">
		<span>FLOOR</span><strong>001</strong><i>／100</i>
	</aside>

	<footer>
		<p>Adult heroes · permanent history · autonomous lives</p>
		<nav aria-label="Development tools">
			<a href={resolve('/forge')}>Forge</a>
			<a href={resolve('/mission-lab')}>Mission lab</a>
			<a href={resolve('/design-reference')}>Design notes</a>
		</nav>
	</footer>
</main>

{#if settingsOpen}
	<div class="settings-backdrop">
		<div
			bind:this={settingsDialog}
			class="settings-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="settings-title"
			tabindex="-1"
			onkeydown={(event) => handleModalKeydown(event, settingsDialog, closeSettings)}
		>
			<header>
				<div>
					<span>Local preferences</span>
					<h2 id="settings-title">Settings</h2>
				</div>
				<button type="button" onclick={closeSettings} data-sound-cue="menu">Close ×</button>
			</header>
			<PlayerSettingsPanel />
		</div>
	</div>
{/if}

<style>
	:global(body) {
		background: #070707;
		color: #f4ead6;
	}
	main {
		position: relative;
		min-height: 100svh;
		overflow: hidden;
		background: #080806;
		isolation: isolate;
	}
	.key-art {
		position: absolute;
		inset: 0 0 0 auto;
		z-index: -4;
		width: min(78vw, 92rem);
		height: 100%;
		object-fit: cover;
		object-position: 64% center;
		filter: saturate(0.78) contrast(1.06);
		animation: breathe 14s ease-in-out infinite alternate;
	}
	.wash {
		position: absolute;
		inset: 0;
		z-index: -3;
		background:
			linear-gradient(
				90deg,
				#070707 0%,
				#070707 28%,
				rgba(7, 7, 7, 0.87) 47%,
				rgba(7, 7, 7, 0.14) 78%
			),
			linear-gradient(0deg, rgba(4, 4, 4, 0.82), transparent 42%);
	}
	.grain {
		position: absolute;
		inset: 0;
		z-index: -2;
		opacity: 0.18;
		pointer-events: none;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.25'/%3E%3C/svg%3E");
	}
	main > header {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 1.35rem clamp(1rem, 4vw, 4rem);
		border-bottom: 1px solid rgba(242, 210, 154, 0.12);
	}
	.wordmark {
		margin-right: auto;
		color: #f4ead6;
		font-family: Georgia, serif;
		font-size: 1.06rem;
		letter-spacing: 0.17em;
		text-decoration: none;
	}
	.wordmark span {
		color: #bd5a2b;
	}
	main > header button {
		border: 0;
		background: transparent;
		color: rgba(244, 234, 214, 0.7);
		font: inherit;
		font-size: 0.65rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.system-state {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		color: rgba(244, 234, 214, 0.48);
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.system-state i {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: #5fbc83;
		box-shadow: 0 0 1rem #5fbc83;
	}
	.system-state.offline i {
		background: #a84832;
		box-shadow: none;
	}
	.title-copy {
		width: min(38rem, calc(100% - 2rem));
		margin: clamp(4rem, 10vh, 8rem) 0 8rem clamp(1rem, 9vw, 9rem);
	}
	.kicker,
	form label,
	.settings-modal span {
		margin: 0 0 0.9rem;
		color: #d0733b;
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.19em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(3.3rem, 7vw, 7rem);
		font-weight: 400;
		line-height: 0.86;
		letter-spacing: -0.065em;
		text-shadow: 0 0.3rem 2rem rgba(0, 0, 0, 0.7);
	}
	h1 em {
		color: #e0a66e;
		font-weight: 400;
	}
	.premise {
		max-width: 35rem;
		margin: 1.8rem 0 2rem;
		color: rgba(244, 234, 214, 0.65);
		font-family: Georgia, serif;
		font-size: clamp(0.92rem, 1.3vw, 1.1rem);
		line-height: 1.7;
	}
	.continue {
		position: relative;
		display: grid;
		grid-template-columns: 1fr auto;
		margin-bottom: 1rem;
		padding: 1rem 3.2rem 1rem 1.1rem;
		border: 1px solid rgba(229, 158, 88, 0.45);
		background: linear-gradient(90deg, rgba(158, 57, 24, 0.32), rgba(20, 15, 10, 0.76));
		color: #f4ead6;
		text-decoration: none;
	}
	.continue span,
	.continue small {
		grid-column: 1;
		color: #d0733b;
		font:
			0.56rem ui-monospace,
			monospace;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	.continue strong {
		margin: 0.25rem 0;
		font:
			1.15rem Georgia,
			serif;
	}
	.continue small {
		color: rgba(244, 234, 214, 0.44);
		letter-spacing: 0.04em;
		text-transform: none;
	}
	.continue b {
		position: absolute;
		right: 1.2rem;
		top: 50%;
		color: #e0a66e;
		transform: translateY(-50%);
	}
	form {
		padding: 1rem 1.1rem;
		border: 1px solid rgba(244, 234, 214, 0.14);
		background: rgba(6, 6, 5, 0.72);
		backdrop-filter: blur(12px);
	}
	form label {
		display: block;
		margin-bottom: 0.65rem;
	}
	.seed-row {
		display: grid;
		grid-template-columns: 1fr auto;
	}
	.seed-row input {
		min-width: 0;
		padding: 0.9rem 1rem;
		border: 1px solid rgba(244, 234, 214, 0.18);
		border-right: 0;
		background: rgba(255, 255, 255, 0.035);
		color: #f4ead6;
		font:
			0.78rem ui-monospace,
			monospace;
		outline: 0;
	}
	.seed-row input:focus {
		border-color: #ce6e38;
	}
	.seed-row button {
		min-width: 7.5rem;
		border: 1px solid #c56230;
		background: #a43d20;
		color: white;
		font:
			0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}
	form p {
		margin: 0.65rem 0 0;
		color: rgba(244, 234, 214, 0.38);
		font-size: 0.63rem;
		line-height: 1.4;
	}
	.error {
		color: #ff9a7c;
		font-size: 0.75rem;
	}
	.tower-mark {
		position: absolute;
		right: clamp(1rem, 4vw, 4rem);
		bottom: 5rem;
		display: grid;
		text-align: right;
		text-shadow: 0 0.2rem 1rem #000;
	}
	.tower-mark span {
		color: rgba(244, 234, 214, 0.45);
		font:
			0.55rem ui-monospace,
			monospace;
		letter-spacing: 0.22em;
	}
	.tower-mark strong {
		font:
			4.6rem/0.9 Georgia,
			serif;
		font-weight: 400;
	}
	.tower-mark i {
		color: #d0733b;
		font:
			0.72rem ui-monospace,
			monospace;
	}
	main > footer {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		display: flex;
		justify-content: space-between;
		padding: 1.1rem clamp(1rem, 4vw, 4rem);
		border-top: 1px solid rgba(242, 210, 154, 0.1);
		color: rgba(244, 234, 214, 0.35);
		font:
			0.55rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	footer p {
		margin: 0;
	}
	footer nav {
		display: flex;
		gap: 1rem;
	}
	footer a {
		color: inherit;
		text-decoration: none;
	}
	.settings-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.82);
		backdrop-filter: blur(14px);
	}
	.settings-modal {
		width: min(50rem, 100%);
		max-height: calc(100svh - 2rem);
		overflow: auto;
		padding: 1.5rem;
		border: 1px solid rgba(229, 158, 88, 0.3);
		background: #0c0b09;
		color: #f4ead6;
	}
	.settings-modal header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	.settings-modal h2 {
		margin: 0.2rem 0 1rem;
		font:
			2.4rem Georgia,
			serif;
		font-weight: 400;
	}
	.settings-modal button {
		border: 0;
		background: none;
		color: rgba(244, 234, 214, 0.6);
		cursor: pointer;
	}
	@keyframes breathe {
		from {
			transform: scale(1.01);
		}
		to {
			transform: scale(1.055) translateX(-0.4%);
		}
	}
	:global(html[data-player-motion='reduced']) .key-art {
		animation: none;
	}
	@media (max-width: 700px) {
		.key-art {
			inset: 0;
			width: 100%;
			object-position: 62% center;
			opacity: 0.55;
		}
		.wash {
			background: linear-gradient(0deg, #070707 0%, rgba(7, 7, 7, 0.74) 62%, rgba(7, 7, 7, 0.24));
		}
		.system-state {
			display: none;
		}
		.title-copy {
			margin: clamp(5rem, 12vh, 8rem) auto 8rem;
			padding: 0 0.1rem;
		}
		h1 {
			font-size: clamp(3.2rem, 16vw, 5rem);
		}
		.tower-mark {
			display: none;
		}
		main > footer {
			align-items: flex-start;
			gap: 0.8rem;
		}
		footer nav {
			flex-wrap: wrap;
			justify-content: flex-end;
		}
	}
</style>
