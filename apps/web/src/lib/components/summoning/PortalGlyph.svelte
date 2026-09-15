<script lang="ts">
	let { kind, size = 18 }: { kind: 'sigil' | 'gem' | 'ember' | 'star'; size?: number } = $props();
</script>

<span
	class="glyph"
	class:sigil={kind === 'sigil'}
	class:gem={kind === 'gem'}
	style:--size={`${size}px`}
	aria-hidden="true"
>
	{#if kind === 'sigil'}
		<span class="sigil-mark">⌁</span>
	{:else if kind === 'gem'}
		<span class="gem-mark"></span>
	{:else if kind === 'ember'}
		<span class="ember-mark">✦</span>
	{:else}
		<span class="star-mark">✧</span>
	{/if}
</span>

<style>
	.glyph {
		display: inline-grid;
		width: var(--size);
		height: var(--size);
		flex: 0 0 var(--size);
		place-items: center;
		color: #dcad68;
		filter: drop-shadow(0 0 8px color-mix(in srgb, currentColor 42%, transparent));
	}

	.sigil-mark,
	.ember-mark,
	.star-mark {
		font-size: calc(var(--size) * 0.9);
		line-height: 1;
	}

	.gem-mark {
		width: 66%;
		height: 82%;
		transform: rotate(45deg);
		border: 1px solid #98ddd6;
		border-radius: 3px 6px 3px 6px;
		background: linear-gradient(135deg, #d8fff7 0 18%, #58bcb5 20% 55%, #163c46 58%);
		box-shadow:
			inset 2px 2px 3px #fff8,
			0 0 10px #56d8cc55;
	}
</style>
