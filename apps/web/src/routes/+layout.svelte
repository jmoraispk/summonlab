<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import PlaytestAnalyticsLayer from '$lib/components/PlaytestAnalyticsLayer.svelte';
	import PlayerSensoryLayer from '$lib/components/PlayerSensoryLayer.svelte';
	import { loadPlayerSettings } from '$lib/player-settings';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		loadPlayerSettings();
		document.documentElement.dataset.playerReady = 'true';
		performance.mark('summonlab:player-ready');
		return () => {
			delete document.documentElement.dataset.playerReady;
		};
	});

	afterNavigate(({ from, to }) => {
		if (!from || !to || from.url.pathname === to.url.pathname) return;
		requestAnimationFrame(() => {
			window.scrollTo({ top: 0, left: 0 });
			document.getElementById('main-content')?.focus({ preventScroll: true });
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#090b12" />
</svelte:head>

<a class="skip-link" href="#main-content">Skip to main content</a>
<div id="main-content" tabindex="-1">{@render children()}</div>
<PlayerSensoryLayer />
<PlaytestAnalyticsLayer />

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html) {
		background: #090b12;
		color-scheme: dark;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	:global(html[data-player-text='compact']) {
		font-size: 93.75%;
	}

	:global(html[data-player-text='large']) {
		font-size: 112.5%;
	}

	:global(body) {
		min-width: 320px;
		min-height: 100vh;
		margin: 0;
		background: #090b12;
		color: #f7f2e8;
	}

	:global(button),
	:global(a),
	:global(input),
	:global(textarea),
	:global(select) {
		font: inherit;
	}

	:global(:focus-visible) {
		outline: 3px solid #ffd17f;
		outline-offset: 3px;
	}

	.skip-link {
		position: fixed;
		top: -10rem;
		left: 0.75rem;
		z-index: 1000;
		padding: 0.75rem 1rem;
		background: #fff3d6;
		color: #16100a;
		font-weight: 800;
		opacity: 0;
		pointer-events: none;
	}

	.skip-link:focus {
		top: 0.75rem;
		opacity: 1;
		pointer-events: auto;
	}

	:global(html[data-player-motion='reduced'] *) {
		scroll-behavior: auto !important;
		animation-duration: 0.001ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 0s !important;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html:not([data-player-motion='full']) *) {
			scroll-behavior: auto !important;
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0s !important;
		}
	}

	@media (forced-colors: active) {
		:global(button),
		:global(a),
		:global(input),
		:global(textarea),
		:global(select) {
			forced-color-adjust: auto;
		}
	}
</style>
