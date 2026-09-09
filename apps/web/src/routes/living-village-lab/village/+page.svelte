<script lang="ts">
	import CityScreen from '$lib/components/city/CityScreen.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>City migration preview · Summonlab</title>
	<meta
		name="description"
		content="Temporary migration preview of the campaign-backed City component."
	/>
</svelte:head>

<main>
	<CityScreen view={data.city} />
</main>

<style>
	main {
		min-height: 100vh;
		background: #080b0f;
	}
</style>
