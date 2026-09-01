<script lang="ts">
	type Affinity = 'fire' | 'earth' | 'wind' | 'water';

	let { affinity }: { affinity: Affinity } = $props();

	const iconNames: Record<Affinity, string> = {
		fire: 'fire-flame',
		earth: 'earth-crystal',
		wind: 'wind-current',
		water: 'water-drop'
	};
	const iconName = $derived(iconNames[affinity]);
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	data-affinity-icon={iconName}
>
	{#if affinity === 'fire'}
		<path
			d="M12.6 2.8c.6 3.25-1.2 4.6-2.5 6.15-1.15 1.38-1.8 2.55-1.15 4.4.55-1.25 1.45-2.1 2.75-2.85-.15 2.1.95 3.35 2.55 4.65"
		/>
		<path
			d="M16.15 7.25c2.05 2.15 3.1 4.4 2.65 7.05-.55 3.2-3.25 5.4-6.75 5.4-3.85 0-6.85-2.5-6.85-6.25 0-2.15.95-4.15 2.8-6.05-.05 2.05.5 3.5 1.75 4.45"
		/>
	{:else if affinity === 'earth'}
		<path d="m12 2.8 6.6 5.7-2.1 9.2L12 21.2l-4.5-3.5-2.1-9.2L12 2.8Z" />
		<path d="m5.4 8.5 6.6 3.2 6.6-3.2M12 11.7v9.5" />
	{:else if affinity === 'water'}
		<path
			d="M12 2.8c-2.5 3.4-6.15 7.3-6.15 11.05A6.15 6.15 0 0 0 12 20a6.15 6.15 0 0 0 6.15-6.15C18.15 10.1 14.5 6.2 12 2.8Z"
		/>
		<path d="M8.7 14.1c.25 1.65 1.25 2.65 3 2.95" />
	{:else}
		<path d="M3 8.25h10.2c1.8 0 2.8-.9 2.8-2.2 0-1.15-.8-1.9-1.9-1.9-.95 0-1.65.45-2.05 1.3" />
		<path d="M3 12h15.1c1.85 0 2.9 1 2.9 2.35 0 1.45-1.05 2.45-2.5 2.45-1.15 0-2.05-.6-2.45-1.65" />
		<path d="M3 15.75h7.5" />
	{/if}
</svg>

<style>
	svg {
		display: block;
		width: 1.65rem;
		height: 1.65rem;
	}
</style>
