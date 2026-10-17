<script lang="ts">
	import type { CityMode } from '$lib/city';

	let { mode }: { mode: CityMode } = $props();
	const source = $derived(`/ui/village-nav/${mode}.webp`);
</script>

<!-- Raster artwork derived from the approved five-mode navigation reference. -->
<img src={source} width="130" height="130" alt="" aria-hidden="true" />

<style>
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
