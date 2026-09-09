<script lang="ts">
	import CityScreen from '$lib/components/city/CityScreen.svelte';
	import LabBackLink from '$lib/components/living-village/LabBackLink.svelte';

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
	<div class="prototype-note">
		<LabBackLink />
		<strong>Prototype migration preview</strong>
	</div>
	<CityScreen view={data.city} />
</main>

<style>
	main {
		min-height: 100vh;
		background: #080b0f;
	}

	.prototype-note {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.35rem 0.65rem;
		background: #050b10;
		color: #d9b982;
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
</style>
