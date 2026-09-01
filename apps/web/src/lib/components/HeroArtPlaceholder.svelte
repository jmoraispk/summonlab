<script lang="ts">
	let { name, compact = false }: { name: string; compact?: boolean } = $props();
</script>

<div
	class:compact
	class="hero-art-placeholder"
	role="img"
	aria-label={`${name} portrait pending`}
	data-testid="hero-art-placeholder"
>
	<span aria-hidden="true">✦</span>
	<strong>Portrait pending</strong>
	<small>{name}</small>
</div>

<style>
	.hero-art-placeholder {
		display: grid;
		width: 100%;
		height: 100%;
		min-height: 8rem;
		place-content: center;
		gap: 0.45rem;
		padding: 1rem;
		border: 1px solid rgba(213, 170, 89, 0.28);
		color: rgba(241, 235, 223, 0.78);
		text-align: center;
		text-transform: uppercase;
		background:
			linear-gradient(135deg, transparent 48%, rgba(213, 170, 89, 0.08) 49%, transparent 51%),
			radial-gradient(circle at 50% 46%, rgba(213, 170, 89, 0.11), transparent 38%), #090b10;
	}
	.hero-art-placeholder span {
		color: #d5aa59;
		font-size: 1.5rem;
	}
	.hero-art-placeholder strong,
	.hero-art-placeholder small {
		display: block;
	}
	.hero-art-placeholder strong {
		font:
			600 0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
	}
	.hero-art-placeholder small {
		max-width: 16rem;
		overflow: hidden;
		color: rgba(241, 235, 223, 0.72);
		font:
			500 0.65rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hero-art-placeholder.compact {
		min-height: 100%;
		padding: 0.45rem;
	}
	.hero-art-placeholder.compact span {
		font-size: 1rem;
	}
	.hero-art-placeholder.compact strong {
		font-size: 0.45rem;
	}
	.hero-art-placeholder.compact small {
		display: none;
	}
</style>
