<script lang="ts">
	import {
		DEFAULT_PLAYER_SETTINGS,
		loadPlayerSettings,
		savePlayerSettings,
		type PlayerSettings
	} from '$lib/player-settings';
	import { onMount } from 'svelte';
	import PlaytestConsentPanel from './PlaytestConsentPanel.svelte';

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

	const readingOptions: ReadonlyArray<readonly [PlayerSettings['textScale'], string]> = [
		['compact', 'Compact'],
		['standard', 'Standard'],
		['large', 'Large']
	];
	const motionOptions: ReadonlyArray<readonly [PlayerSettings['motion'], string]> = [
		['system', 'System'],
		['full', 'Full'],
		['reduced', 'Reduced']
	];
	const soundOptions: ReadonlyArray<readonly [PlayerSettings['sound'], string]> = [
		['muted', 'Muted'],
		['ambient', 'Ambient'],
		['full', 'Full mix']
	];
</script>

<section class="settings" data-testid="player-settings">
	<div class="group">
		<div>
			<span>Reading scale</span>
			<small>Applies immediately and stays on this device.</small>
		</div>
		<div class="choices" role="radiogroup" aria-label="Reading scale">
			{#each readingOptions as option (option[0])}
				<label class:selected={settings.textScale === option[0]}>
					<input
						type="radio"
						name="reading-scale"
						value={option[0]}
						checked={settings.textScale === option[0]}
						onchange={() => update({ textScale: option[0] })}
					/>
					<span>{option[1]}</span>
				</label>
			{/each}
		</div>
	</div>

	<div class="group">
		<div>
			<span>Motion</span>
			<small>Reduced removes camera drift, embers, and long transitions.</small>
		</div>
		<div class="choices" role="radiogroup" aria-label="Motion preference">
			{#each motionOptions as option (option[0])}
				<label class:selected={settings.motion === option[0]}>
					<input
						type="radio"
						name="motion-preference"
						value={option[0]}
						checked={settings.motion === option[0]}
						onchange={() => update({ motion: option[0] })}
					/>
					<span>{option[1]}</span>
				</label>
			{/each}
		</div>
	</div>

	<div class="group">
		<div>
			<span>Soundscape</span>
			<small>Muted by default. Ambient adds atmosphere; Full mix also adds interface cues.</small>
		</div>
		<div class="choices" role="radiogroup" aria-label="Soundscape">
			{#each soundOptions as option (option[0])}
				<label class:selected={settings.sound === option[0]}>
					<input
						type="radio"
						name="soundscape"
						value={option[0]}
						checked={settings.sound === option[0]}
						onchange={() => update({ sound: option[0] })}
					/>
					<span>{option[1]}</span>
				</label>
			{/each}
		</div>
	</div>

	<div class="group">
		<div>
			<span>Sound captions</span>
			<small>Shows a short readable equivalent whenever the interface presents a sound cue.</small>
		</div>
		<label class="switch">
			<input
				type="checkbox"
				checked={settings.soundCaptions}
				onchange={(event) =>
					update({ soundCaptions: (event.currentTarget as HTMLInputElement).checked })}
			/>
			<span>{settings.soundCaptions ? 'Captions on' : 'Captions off'}</span>
		</label>
	</div>

	<div class="group">
		<div>
			<span>Unattended Master decisions</span>
			<small>Heroes stay autonomous. This only sets the default window for your own choices.</small>
		</div>
		<div class="choices two" role="radiogroup" aria-label="Master decision timing">
			<label class:selected={settings.controlMode === 'wait'}>
				<input
					type="radio"
					name="master-decision-timing"
					value="wait"
					checked={settings.controlMode === 'wait'}
					onchange={() => update({ controlMode: 'wait' })}
				/>
				<span>Wait for me</span>
			</label>
			<label class:selected={settings.controlMode === 'countdown'}>
				<input
					type="radio"
					name="master-decision-timing"
					value="countdown"
					checked={settings.controlMode === 'countdown'}
					onchange={() => update({ controlMode: 'countdown' })}
				/>
				<span>5-second handoff</span>
			</label>
		</div>
	</div>

	<PlaytestConsentPanel />
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

	.group > div:first-child > span {
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

	.choices label,
	.switch {
		position: relative;
		display: grid;
		min-height: 2.7rem;
		place-items: center;
		padding: 0.4rem;
		border: 1px solid rgba(238, 211, 154, 0.16);
		background: rgba(255, 255, 255, 0.025);
		color: rgba(245, 234, 212, 0.6);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-align: center;
		text-transform: uppercase;
		cursor: pointer;
	}

	.choices label:hover,
	.choices label:focus-within,
	.choices label.selected,
	.switch:hover,
	.switch:focus-within {
		border-color: rgba(224, 139, 68, 0.72);
		background: rgba(190, 76, 28, 0.18);
		color: #ffe1ad;
	}

	.choices input,
	.switch input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		opacity: 0;
	}

	.switch {
		justify-self: stretch;
	}

	@media (max-width: 650px) {
		.group {
			grid-template-columns: 1fr;
			gap: 0.8rem;
		}

		.choices {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.choices.two {
			grid-template-columns: 1fr 1fr;
		}

		.choices label,
		.switch {
			font-size: 0.58rem;
			letter-spacing: 0.045em;
		}
	}
</style>
