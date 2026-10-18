<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	let { children } = $props();

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
	<meta name="theme-color" content="#090805" />
</svelte:head>

<a class="skip-link" href="#main-content">Skip to main content</a>
<div id="main-content" tabindex="-1">{@render children()}</div>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(html) {
		background: #090805;
		color-scheme: dark;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	:global(body) {
		min-width: 320px;
		min-height: 100vh;
		margin: 0;
		background: #090805;
		color: #f3ead9;
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
	}
	.skip-link:focus {
		top: 0.75rem;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(*) {
			scroll-behavior: auto !important;
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0s !important;
		}
	}
</style>
