<script lang="ts">
	import { resolve } from '$app/paths';
	import { VILLAGE_MODES, type VillageMode } from '$lib/village-shell';
	import VillageModeIcon from './VillageModeIcon.svelte';

	let { runId, current }: { runId: string; current: VillageMode } = $props();
</script>

<nav class="village-mode-nav" aria-label="Village destinations" data-testid="village-mode-nav">
	{#each VILLAGE_MODES as mode (mode.id)}
		<a
			href={resolve(mode.route, { runId })}
			class:active={current === mode.id}
			aria-current={current === mode.id ? 'page' : undefined}
			data-sound-cue="menu"
		>
			<span class="icon-frame"><VillageModeIcon mode={mode.id} /></span>
			<span class="label">{mode.label}</span>
		</a>
	{/each}
</nav>

<style>
	.village-mode-nav {
		position: relative;
		z-index: 35;
		display: grid;
		grid-template-columns: repeat(5, minmax(7.5rem, 10rem));
		justify-content: center;
		border-bottom: 1px solid rgba(194, 152, 89, 0.28);
		background:
			radial-gradient(circle at 50% 0%, rgba(31, 70, 80, 0.12), transparent 55%),
			linear-gradient(180deg, #070b0d, #030607);
	}

	a {
		position: relative;
		display: flex;
		min-height: 4.1rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-right: 1px solid rgba(184, 143, 84, 0.2);
		color: #b99a70;
		font-family: Georgia, serif;
		font-size: 0.72rem;
		letter-spacing: 0.09em;
		text-decoration: none;
		text-transform: uppercase;
		transition: color 140ms ease;
	}

	a:first-child {
		border-left: 1px solid rgba(184, 143, 84, 0.2);
	}

	a::before,
	a::after {
		position: absolute;
		content: '';
		opacity: 0;
		pointer-events: none;
	}

	a::before {
		top: -0.28rem;
		left: 50%;
		z-index: 1;
		width: 0.52rem;
		height: 0.52rem;
		border: 1px solid #43c9e1;
		background: #071116;
		box-shadow: 0 0 0.7rem rgba(48, 203, 229, 0.28);
		transform: translateX(-50%) rotate(45deg);
	}

	a::after {
		inset: 0;
		border: 1px solid #3dc5de;
		box-shadow:
			inset 0 0 1.1rem rgba(34, 186, 214, 0.08),
			0 0 0.85rem rgba(34, 186, 214, 0.08);
	}

	a:hover,
	a:focus-visible,
	a.active {
		color: #55d6ec;
		outline: none;
	}

	a.active::before,
	a.active::after {
		opacity: 1;
	}

	a:focus-visible {
		box-shadow: inset 0 0 0 2px #e5aa73;
	}

	.icon-frame {
		display: block;
		width: 2.75rem;
		height: 2.75rem;
		overflow: hidden;
	}

	@media (max-width: 650px) {
		.village-mode-nav {
			position: fixed;
			right: 0;
			bottom: 0;
			left: 0;
			z-index: 80;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			padding-bottom: env(safe-area-inset-bottom);
			border-top: 1px solid rgba(195, 151, 87, 0.42);
			border-bottom: 0;
			background:
				radial-gradient(circle at 50% 0%, rgba(30, 75, 84, 0.14), transparent 66%), #04080a;
			box-shadow: 0 -1.2rem 3rem rgba(0, 0, 0, 0.46);
		}

		a {
			min-width: 0;
			min-height: 5.65rem;
			flex-direction: column;
			gap: 0;
			border-right-color: rgba(187, 144, 82, 0.24);
			font-size: 0.69rem;
			letter-spacing: 0.07em;
		}

		a:first-child {
			border-left: 0;
		}

		.icon-frame {
			width: 3.45rem;
			height: 3.45rem;
		}
	}
</style>
