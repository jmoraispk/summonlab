<script lang="ts">
	let {
		label,
		compact = false,
		testId
	}: { label: string; compact?: boolean; testId?: string } = $props();
</script>

<div
	class:compact
	class="character-art-missing"
	aria-label={`${label}: art pending`}
	data-character-art-status="missing"
	data-testid={testId}
>
	<strong>Art pending</strong>
	<small>{label}</small>
</div>

<style>
	.character-art-missing {
		display: grid;
		width: 100%;
		height: 100%;
		min-height: 5rem;
		place-content: center;
		gap: 0.3rem;
		padding: 0.7rem;
		border: 1px solid #343b3d;
		background: #0b0e10;
		color: #8a9291;
		text-align: center;
		text-transform: uppercase;
	}
	.character-art-missing strong,
	.character-art-missing small {
		display: block;
	}
	.character-art-missing strong {
		font:
			600 0.5rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
	}
	.character-art-missing small {
		max-width: 8rem;
		overflow: hidden;
		font:
			500 0.46rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.character-art-missing.compact {
		min-height: 2.8rem;
		padding: 0.35rem;
	}
	.character-art-missing.compact strong {
		font-size: 0.42rem;
	}
	.character-art-missing.compact small {
		font-size: 0.4rem;
	}
</style>
