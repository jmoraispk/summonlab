<script lang="ts">
	import type { VillageMode } from '$lib/village-shell';

	let { mode }: { mode: VillageMode } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true">
	{#if mode === 'village'}
		<path d="M3 11.2 12 4l9 7.2v8.3H3zM8 20v-6h8v6M5.5 9.3V5.5h3" />
	{:else if mode === 'residents'}
		<circle cx="12" cy="8" r="3.2" />
		<path
			d="M5.5 20c.5-4.3 2.6-6.5 6.5-6.5s6 2.2 6.5 6.5M4 10.5a2.5 2.5 0 0 1 3.5-2.3M20 10.5a2.5 2.5 0 0 0-3.5-2.3"
		/>
	{:else if mode === 'inventory'}
		<path d="M3.5 8.5h17v11h-17zM5.5 8.5 7 4.5h10l1.5 4M3.5 12h17M10 12v2.5h4V12" />
	{:else}
		<path d="M5 20V4M6 5h12l-2.5 4L18 13H6M9 20h8M13 13v7" />
	{/if}
</svg>

<style>
	svg {
		width: 1.28rem;
		height: 1.28rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.45;
		stroke-linecap: square;
		stroke-linejoin: miter;
	}
</style>
