<script lang="ts">
	import { resolve } from '$app/paths';

	import { CITY_MODES, cityModeHref, type CityMode } from '$lib/city';

	import CityModeIcon from './CityModeIcon.svelte';

	let { current }: { current: CityMode } = $props();
</script>

<nav class="city-mode-dock" aria-label="City destinations" data-testid="city-mode-dock">
	{#each CITY_MODES as mode (mode.id)}
		<a
			href={resolve(cityModeHref(mode.id))}
			class:active={current === mode.id}
			aria-current={current === mode.id ? 'page' : undefined}
			data-sound-cue="menu"
		>
			<span class="icon-frame"><CityModeIcon mode={mode.id} /></span>
			<span>{mode.label}</span>
		</a>
	{/each}
</nav>

<style>
	.city-mode-dock {
		position: relative;
		z-index: 50;
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
		min-width: 44px;
		min-height: 4.1rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-inline-end: 1px solid rgba(184, 143, 84, 0.2);
		color: #b99a70;
		font:
			0.72rem Georgia,
			serif;
		letter-spacing: 0.09em;
		text-decoration: none;
		text-transform: uppercase;
	}

	a:first-child {
		border-inline-start: 1px solid rgba(184, 143, 84, 0.2);
	}

	a:hover,
	a:focus-visible,
	a.active {
		color: #55d6ec;
		outline: none;
		box-shadow: inset 0 0 0 1px #3dc5de;
	}

	.icon-frame {
		display: block;
		width: 2.75rem;
		height: 2.75rem;
		overflow: hidden;
	}

	@media (max-width: 650px) {
		.city-mode-dock {
			position: fixed;
			right: 0;
			bottom: 0;
			left: 0;
			z-index: 80;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			padding-bottom: env(safe-area-inset-bottom);
			border-top: 1px solid rgba(195, 151, 87, 0.42);
			border-bottom: 0;
			background: #04080a;
			box-shadow: 0 -1.2rem 3rem rgba(0, 0, 0, 0.46);
		}

		a {
			min-height: 5.65rem;
			flex-direction: column;
			gap: 0;
			font-size: 0.62rem;
			letter-spacing: 0.04em;
		}

		.icon-frame {
			width: 3.25rem;
			height: 3.25rem;
		}
	}
</style>
