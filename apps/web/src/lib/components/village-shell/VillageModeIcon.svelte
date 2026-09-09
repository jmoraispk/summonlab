<script lang="ts">
	import type { VillageMode } from '$lib/village-shell';

	let { mode }: { mode: VillageMode } = $props();
	const source = $derived(`/ui/village-nav/${mode}.png`);
</script>

<!-- Raster artwork derived from the approved five-mode navigation reference. -->
<img src={source} width="130" height="130" alt="" aria-hidden="true" data-testid="plan-nav-icon" />

<style>
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
