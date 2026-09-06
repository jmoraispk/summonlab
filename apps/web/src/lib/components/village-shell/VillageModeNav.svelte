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
		grid-template-columns: repeat(4, minmax(7.5rem, 10rem));
		justify-content: center;
		border-bottom: 1px solid rgba(234, 202, 142, 0.12);
		background:
			linear-gradient(90deg, transparent, rgba(211, 159, 80, 0.045), transparent), #0b0c10;
	}

	a {
		position: relative;
		display: flex;
		min-height: 3.55rem;
		align-items: center;
		justify-content: center;
		gap: 0.62rem;
		border-right: 1px solid rgba(255, 255, 255, 0.055);
		color: rgba(238, 231, 218, 0.46);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.62rem;
		letter-spacing: 0.13em;
		text-decoration: none;
		text-transform: uppercase;
		transition:
			color 140ms ease,
			background 140ms ease;
	}

	a:first-child {
		border-left: 1px solid rgba(255, 255, 255, 0.055);
	}

	a::after {
		position: absolute;
		right: 24%;
		bottom: -1px;
		left: 24%;
		height: 2px;
		background: #d29a4b;
		box-shadow: 0 -0.35rem 1rem rgba(210, 154, 75, 0.35);
		content: '';
		opacity: 0;
	}

	a:hover,
	a:focus-visible,
	a.active {
		background: rgba(211, 159, 80, 0.07);
		color: #f1d7a5;
	}

	a.active::after {
		opacity: 1;
	}

	.icon-frame {
		display: grid;
		width: 1.8rem;
		height: 1.8rem;
		place-items: center;
		border: 1px solid currentColor;
		background: rgba(0, 0, 0, 0.22);
		clip-path: polygon(
			0.3rem 0,
			100% 0,
			100% calc(100% - 0.3rem),
			calc(100% - 0.3rem) 100%,
			0 100%,
			0 0.3rem
		);
		opacity: 0.82;
	}

	@media (max-width: 650px) {
		.village-mode-nav {
			position: fixed;
			right: 0;
			bottom: 0;
			left: 0;
			z-index: 80;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			padding-bottom: env(safe-area-inset-bottom);
			border-top: 1px solid rgba(234, 202, 142, 0.2);
			border-bottom: 0;
			background: rgba(8, 9, 12, 0.97);
			box-shadow: 0 -1.2rem 3rem rgba(0, 0, 0, 0.46);
			backdrop-filter: blur(18px);
		}

		a {
			min-width: 0;
			min-height: 4.7rem;
			flex-direction: column;
			gap: 0.32rem;
			border-right-color: rgba(255, 255, 255, 0.06);
			font-size: 0.55rem;
			letter-spacing: 0.04em;
		}

		a::after {
			top: -1px;
			right: 20%;
			bottom: auto;
			left: 20%;
		}

		.icon-frame {
			width: 2rem;
			height: 2rem;
		}
	}
</style>
