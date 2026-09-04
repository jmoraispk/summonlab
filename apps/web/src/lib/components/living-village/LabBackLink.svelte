<script lang="ts">
	import { resolve } from '$app/paths';

	let { placement = 'bottom' }: { placement?: 'top' | 'bottom' } = $props();
</script>

<a
	href={resolve('/living-village-lab')}
	aria-label="All prototype screens"
	class:top={placement === 'top'}>← Screen index</a
>

<style>
	a {
		position: fixed;
		z-index: 90;
		bottom: 0.65rem;
		left: 0.65rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(131, 205, 211, 0.3);
		border-radius: 999px;
		background: rgba(7, 11, 15, 0.86);
		box-shadow: 0 0.45rem 1.6rem rgba(0, 0, 0, 0.3);
		color: #bce6e8;
		font:
			800 0.64rem/1 Inter,
			ui-sans-serif,
			system-ui,
			sans-serif;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
		backdrop-filter: blur(0.65rem);
	}

	a:hover,
	a:focus-visible {
		border-color: rgba(131, 205, 211, 0.75);
		color: #fff;
		outline: none;
	}

	a.top {
		top: 0.65rem;
		bottom: auto;
	}
</style>
