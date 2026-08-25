<script lang="ts">
	import {
		DEFAULT_PLAYER_SETTINGS,
		loadPlayerSettings,
		savePlayerSettings,
		type PlayerSettings
	} from '$lib/player-settings';
	import { onMount } from 'svelte';

	let { onChange }: { onChange?: (settings: PlayerSettings) => void } = $props();
	let settings = $state<PlayerSettings>(DEFAULT_PLAYER_SETTINGS);

	onMount(() => {
		settings = loadPlayerSettings();
		onChange?.(settings);
	});

	function update(patch: Partial<PlayerSettings>) {
		settings = { ...settings, ...patch };
		savePlayerSettings(settings);
		onChange?.(settings);
	}
</script>

<section class="settings" data-testid="player-settings">
	<div class="group">
		<div>
			<span>Reading scale</span>
			<small>Applies immediately and stays on this device.</small>
		</div>
		<div class="choices" role="radiogroup" aria-label="Reading scale">
			{#each [['compact', 'Compact'], ['standard', 'Standard'], ['large', 'Large']] as option (option[0])}
				<button
					type="button"
					class:selected={settings.textScale === option[0]}
					onclick={() => update({ textScale: option[0] as PlayerSettings['textScale'] })}
					aria-pressed={settings.textScale === option[0]}>{option[1]}</button
				>
			{/each}
		</div>
	</div>

	<div class="group">
		<div>
			<span>Motion</span>
			<small>Reduced removes camera drift, embers, and long transitions.</small>
		</div>
		<div class="choices" role="radiogroup" aria-label="Motion preference">
			{#each [['system', 'System'], ['full', 'Full'], ['reduced', 'Reduced']] as option (option[0])}
				<button
					type="button"
					class:selected={settings.motion === option[0]}
					onclick={() => update({ motion: option[0] as PlayerSettings['motion'] })}
					aria-pressed={settings.motion === option[0]}>{option[1]}</button
				>
			{/each}
		</div>
	</div>

	<div class="group">
		<div>
			<span>Unattended Master decisions</span>
			<small>Heroes stay autonomous. This only sets the default window for your own choices.</small>
		</div>
		<div class="choices two" role="radiogroup" aria-label="Master decision timing">
			<button
				type="button"
				class:selected={settings.controlMode === 'wait'}
				onclick={() => update({ controlMode: 'wait' })}
				aria-pressed={settings.controlMode === 'wait'}>Wait for me</button
			>
			<button
				type="button"
				class:selected={settings.controlMode === 'countdown'}
				onclick={() => update({ controlMode: 'countdown' })}
				aria-pressed={settings.controlMode === 'countdown'}>5-second handoff</button
			>
		</div>
	</div>
</section>

<style>
	.settings {
		display: grid;
		gap: 0;
		border-top: 1px solid rgba(238, 211, 154, 0.15);
	}

	.group {
		display: grid;
		grid-template-columns: minmax(12rem, 0.8fr) minmax(18rem, 1.2fr);
		gap: 1.5rem;
		align-items: center;
		padding: 1.3rem 0;
		border-bottom: 1px solid rgba(238, 211, 154, 0.12);
	}

	.group span {
		display: block;
		margin-bottom: 0.35rem;
		color: #f5ead4;
		font-family: Georgia, serif;
		font-size: 1rem;
	}

	.group small {
		display: block;
		color: rgba(245, 234, 212, 0.5);
		font-size: 0.68rem;
		line-height: 1.5;
	}

	.choices {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.choices.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	button {
		min-height: 2.7rem;
		border: 1px solid rgba(238, 211, 154, 0.16);
		background: rgba(255, 255, 255, 0.025);
		color: rgba(245, 234, 212, 0.6);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	button:hover,
	button:focus-visible,
	button.selected {
		border-color: rgba(224, 139, 68, 0.72);
		background: rgba(190, 76, 28, 0.18);
		color: #ffe1ad;
	}

	@media (max-width: 650px) {
		.group {
			grid-template-columns: 1fr;
			gap: 0.8rem;
		}

		.choices {
			grid-template-columns: 1fr;
		}

		.choices.two {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
