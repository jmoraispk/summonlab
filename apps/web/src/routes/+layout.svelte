<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#090b12" />
</svelte:head>

{@render children()}

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
	:global(a) {
		font: inherit;
	}

	:global(html[data-player-motion='reduced'] *) {
		scroll-behavior: auto !important;
		animation-duration: 0.001ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 0.001ms !important;
	}
</style>
