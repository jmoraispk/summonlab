<script lang="ts">
	let { kind, label } = $props<{ kind: 'sword' | 'spear' | 'bow'; label: string }>();
</script>

<svg viewBox="0 0 160 92" role="img" aria-label={label}>
	{#if kind === 'sword'}
		<path d="M28 72 117 19l17-4-11 14-88 51z" />
		<path d="m28 67 12 14M17 78l24-18M15 80l8 8" />
	{:else if kind === 'spear'}
		<path d="m20 79 111-58" />
		<path d="m126 14 21-4-12 18-9-14zM25 76l-9 9" />
	{:else}
		<path d="M47 14c39 17 39 47 0 64M47 14c-13 18-13 46 0 64M47 14v64" />
		<path d="m40 46 89 0M121 40l10 6-10 6" />
	{/if}
</svg>

<style>
	svg {
		width: min(100%, 10rem);
		filter: drop-shadow(0 0 0.7rem color-mix(in srgb, currentColor 18%, transparent));
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2.2;
	}
</style>
