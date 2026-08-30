<script lang="ts">
	type IconKind =
		'body' | 'mind' | 'ember' | 'tide' | 'gale' | 'grove' | 'martial' | 'magic' | 'crafting';

	let { kind, size = 18 }: { kind: IconKind; size?: number } = $props();
</script>

<span class="icon" data-kind={kind} data-icon={kind} style:--size={`${size}px`} aria-hidden="true">
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		{#if kind === 'body'}
			<path
				d="M8.3 4.6 5.7 7.2l2.1 3.3-2 4.4 2.5 4.5M15.7 4.6l2.6 2.6-2.1 3.3 2 4.4-2.5 4.5M8 9.5h8M9 15h6M12 3v18"
			/>
		{:else if kind === 'mind'}
			<path
				d="M9 18.8c-2.8-.3-4.8-2.5-4.8-5.2 0-1.6.7-3.1 2-4.1-.1-.4-.2-.8-.2-1.2A3.8 3.8 0 0 1 9.8 4.5c.8 0 1.5.2 2.2.7.6-.5 1.4-.7 2.2-.7A3.8 3.8 0 0 1 18 8.3c0 .4-.1.8-.2 1.2a5 5 0 0 1 2 4.1c0 2.7-2 4.9-4.8 5.2M12 5.2v13.6M8.3 9.2c1.8.2 3 1.2 3.7 2.8M15.7 9.2c-1.8.2-3 1.2-3.7 2.8"
			/>
		{:else if kind === 'ember'}
			<path
				d="M13.7 2.8c.7 3.3-2.1 4.5-2.1 7.1-1.4-1-1.8-2.4-1.2-4.2-3.2 2.2-5 5-5 8.1A6.6 6.6 0 0 0 12 20.4a6.6 6.6 0 0 0 6.6-6.6c0-4-2.1-7.7-4.9-11Z"
			/><path d="M12 11.4c1.5 1.8 2.3 3 2.3 4.2a2.3 2.3 0 1 1-4.6 0c0-1.2.8-2.4 2.3-4.2Z" />
		{:else if kind === 'tide'}
			<path
				d="M3 9.2c2.7 0 2.7-1.8 5.3-1.8s2.7 1.8 5.4 1.8 2.6-1.8 5.3-1.8M3 14.2c2.7 0 2.7-1.8 5.3-1.8s2.7 1.8 5.4 1.8 2.6-1.8 5.3-1.8M5 18.8c2 0 2-1.4 4-1.4s2 1.4 4 1.4 2-1.4 4-1.4"
			/>
		{:else if kind === 'gale'}
			<path
				d="M3 8h10.5c2.4 0 2.4-3.5.2-3.5-1 0-1.7.5-2.1 1.2M3 12h15c2.7 0 2.7 4-.1 4-1.2 0-2.1-.7-2.4-1.7M3 16h7"
			/>
		{:else if kind === 'grove'}
			<path
				d="M19.2 4.8C11 4.5 5.9 8.3 5.7 14.2c-.1 2.7 2 4.9 4.7 4.9 5.7 0 8.8-6.1 8.8-14.3Z"
			/><path d="M5 20c2.5-4.4 5.7-7.3 10.7-10" />
		{:else if kind === 'martial'}
			<path
				d="m5 19 14-14M12.7 5.3l2.1-2.1 4 4-2.1 2.1M4.2 16.8l3 3M14 10l4.9 4.9M18.9 14.9l-4 4-2.5-2.5"
			/>
		{:else if kind === 'magic'}
			<path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z" /><path
				d="m18.5 16 .6 2.4 2.4.6-2.4.6-.6 2.4-.6-2.4-2.4-.6 2.4-.6.6-2.4Z"
			/>
		{:else}
			<path
				d="M14.8 4.2a4.5 4.5 0 0 0-5.6 5.6L3.5 15.5a2.1 2.1 0 0 0 3 3l5.7-5.7a4.5 4.5 0 0 0 5.6-5.6l-2.7 2.7-2.9-.7-.7-2.9 3.3-2.1Z"
			/>
		{/if}
	</svg>
</span>

<style>
	.icon {
		display: inline-grid;
		width: var(--size);
		height: var(--size);
		flex: 0 0 var(--size);
		place-items: center;
	}
	svg {
		width: 100%;
		height: 100%;
	}
	.icon[data-kind='ember'] {
		color: #f2a34f;
	}
	.icon[data-kind='tide'] {
		color: #71c9e8;
	}
	.icon[data-kind='gale'] {
		color: #98e1d1;
	}
	.icon[data-kind='grove'] {
		color: #8ccb7b;
	}
	.icon[data-kind='martial'] {
		color: #e4a66f;
	}
	.icon[data-kind='magic'] {
		color: #b99af5;
	}
	.icon[data-kind='crafting'] {
		color: #ddc078;
	}
</style>
