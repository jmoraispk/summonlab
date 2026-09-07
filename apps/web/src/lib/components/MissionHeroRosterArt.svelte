<script lang="ts">
	import CharacterArtMissing from './CharacterArtMissing.svelte';
	import HeroArtPlaceholder from './HeroArtPlaceholder.svelte';

	interface Portrait {
		readonly publicPath: string;
		readonly width: number;
		readonly height: number;
	}

	let {
		isCapabilityMission,
		name,
		portrait
	}: { isCapabilityMission: boolean; name: string; portrait: Portrait | null } = $props();
</script>

{#if portrait}
	<img
		src={portrait.publicPath}
		width={portrait.width}
		height={portrait.height}
		alt={`${name} roster portrait`}
	/>
{:else if isCapabilityMission}
	<CharacterArtMissing label={`${name} roster`} compact testId="hero-roster-art-missing" />
{:else}
	<HeroArtPlaceholder {name} compact />
{/if}

<style>
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 15%;
	}
</style>
