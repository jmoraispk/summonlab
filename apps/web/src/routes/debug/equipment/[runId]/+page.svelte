<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	import EquipmentWorkshop from '$lib/components/EquipmentWorkshop.svelte';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Equipment workshop preview · summonlab</title>
</svelte:head>

<main>
	<EquipmentWorkshop
		runId={data.runId}
		initialProjection={data.projection}
		onChanged={invalidateAll}
	/>
</main>

<style>
	main {
		min-height: 100vh;
		padding: 1rem;
		background: #080a0e;
	}
</style>
