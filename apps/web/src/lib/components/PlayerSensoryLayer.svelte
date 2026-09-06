<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		captionForSoundCue,
		playerAudio,
		soundProfileForPath,
		type PlayerSoundCue
	} from '$lib/player-audio';
	import {
		DEFAULT_PLAYER_SETTINGS,
		loadPlayerSettings,
		PLAYER_SETTINGS_EVENT,
		savePlayerSettings,
		type PlayerSettings
	} from '$lib/player-settings';

	let settings = $state<PlayerSettings>(DEFAULT_PLAYER_SETTINGS);
	let active = $state(false);
	let caption = $state('');
	let captionCue = $state<PlayerSoundCue | null>(null);
	let visualCue = $state<PlayerSoundCue | null>(null);
	let captionTimer: ReturnType<typeof setTimeout> | null = null;
	let visualTimer: ReturnType<typeof setTimeout> | null = null;
	const profile = $derived(soundProfileForPath(page.url.pathname));
	const available = $derived(profile !== 'silence');
	const showControls = $derived(available && page.url.pathname !== '/');
	const buttonLabel = $derived(
		settings.sound === 'muted' ? 'Turn sound on' : active ? 'Mute sound' : 'Start sound'
	);

	$effect(() => {
		playerAudio.setProfile(profile);
	});

	onMount(() => {
		settings = loadPlayerSettings();
		const onSettings = (event: Event) => {
			settings = (event as CustomEvent<PlayerSettings>).detail;
			if (settings.sound === 'muted') {
				active = false;
				playerAudio.setMode('muted');
			} else {
				void activate();
			}
		};
		const onClick = (event: MouseEvent) => {
			const target =
				event.target instanceof Element
					? event.target.closest<HTMLElement>('[data-sound-cue]')
					: null;
			const cue = target?.dataset.soundCue as PlayerSoundCue | undefined;
			if (cue) presentCue(cue);
		};
		window.addEventListener(PLAYER_SETTINGS_EVENT, onSettings);
		document.addEventListener('click', onClick);
		return () => {
			window.removeEventListener(PLAYER_SETTINGS_EVENT, onSettings);
			document.removeEventListener('click', onClick);
			if (captionTimer) clearTimeout(captionTimer);
			if (visualTimer) clearTimeout(visualTimer);
			playerAudio.stop();
		};
	});

	async function activate() {
		if (settings.sound === 'muted') return;
		active = await playerAudio.activate(settings.sound, profile);
	}

	function toggleSound() {
		if (active) {
			savePlayerSettings({ ...settings, sound: 'muted' });
			return;
		}
		const sound = settings.sound === 'muted' ? 'ambient' : settings.sound;
		settings = { ...settings, sound };
		savePlayerSettings(settings);
	}

	function presentCue(cue: PlayerSoundCue) {
		playerAudio.playCue(cue);
		visualCue = cue;
		if (settings.soundCaptions) {
			caption = captionForSoundCue(cue);
			captionCue = cue;
		}
		if (captionTimer) clearTimeout(captionTimer);
		if (visualTimer) clearTimeout(visualTimer);
		captionTimer = setTimeout(() => {
			caption = '';
			captionCue = null;
		}, 3_200);
		visualTimer = setTimeout(() => (visualCue = null), 900);
	}
</script>

{#if showControls}
	<div
		class={`sensory-layer profile-${profile}`}
		class:active
		data-testid="sensory-controls"
		data-audio-state={active ? 'active' : settings.sound === 'muted' ? 'muted' : 'ready'}
	>
		<button
			type="button"
			onclick={toggleSound}
			aria-label={buttonLabel}
			aria-pressed={active}
			title={buttonLabel}
		>
			<span aria-hidden="true">{active ? '◖))' : '◖×'}</span>
			<small>{active ? 'Sound on' : settings.sound === 'muted' ? 'Sound off' : 'Sound ready'}</small
			>
		</button>
	</div>

	{#if visualCue}
		<div
			class={`sensory-effect cue-${visualCue}`}
			data-testid="sensory-effect"
			aria-hidden="true"
		></div>
	{/if}

	<div
		class:visible={Boolean(caption)}
		class={`sound-caption caption-${captionCue ?? 'none'}`}
		role="status"
		aria-live="polite"
	>
		{caption}
	</div>
{/if}

<style>
	.sensory-layer {
		position: fixed;
		top: 5.3rem;
		right: 0.75rem;
		z-index: 85;
	}
	.sensory-layer button {
		display: flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.45rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(244, 226, 190, 0.22);
		background: rgba(7, 8, 10, 0.88);
		box-shadow: 0 0.7rem 2rem rgba(0, 0, 0, 0.28);
		color: rgba(250, 239, 218, 0.72);
		cursor: pointer;
	}
	.sensory-layer.active button {
		border-color: rgba(211, 126, 64, 0.56);
		color: #ffe2b0;
	}
	.sensory-layer span {
		color: #dc884d;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
	}
	.sensory-layer small {
		font-size: 0.5rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.sound-caption {
		position: fixed;
		top: 8.55rem;
		right: 0.75rem;
		z-index: 90;
		width: min(20rem, calc(100% - 2rem));
		padding: 0.68rem 0.9rem;
		border: 1px solid rgba(239, 190, 119, 0.32);
		background: rgba(5, 5, 5, 0.94);
		color: #fff0d1;
		font:
			italic 0.78rem/1.4 Georgia,
			serif;
		opacity: 0;
		pointer-events: none;
		transform: translateY(-0.4rem);
		transition:
			opacity 160ms ease,
			transform 160ms ease;
	}
	.sound-caption.visible {
		opacity: 1;
		transform: translateY(0);
	}
	.sensory-effect {
		position: fixed;
		inset: 0;
		z-index: 75;
		pointer-events: none;
		animation: sensory-flare 850ms ease-out both;
	}
	.cue-gate,
	.cue-threshold {
		background: radial-gradient(circle at 50% 48%, rgba(230, 132, 61, 0.28), transparent 36%);
	}
	.cue-bell,
	.cue-voice {
		box-shadow: inset 0 0 8rem rgba(221, 160, 82, 0.12);
	}
	.cue-warning {
		box-shadow: inset 0 0 0 2px rgba(208, 66, 38, 0.38);
	}
	@keyframes sensory-flare {
		from {
			opacity: 0;
		}
		32% {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
	:global(html[data-player-motion='reduced']) .sensory-effect {
		animation: none;
		opacity: 0.55;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(html:not([data-player-motion='full'])) .sensory-effect {
			animation: none;
			opacity: 0.55;
		}
	}
	@media (max-width: 650px) {
		.sensory-layer {
			top: 4.25rem;
			right: 0.45rem;
		}
		.sensory-layer small {
			display: none;
		}
		.sensory-layer.profile-hearth {
			top: 6.75rem;
			right: auto;
			left: 0.45rem;
		}
		.sound-caption {
			top: 7.35rem;
			right: 0.45rem;
			width: min(15rem, calc(100% - 1rem));
			font-size: 0.7rem;
		}
		.sound-caption.caption-gate {
			top: 14.3rem;
		}
		.profile-hearth + .sensory-effect + .sound-caption,
		.profile-hearth + .sound-caption {
			top: 9.7rem;
			right: auto;
			left: 0.45rem;
		}
	}
</style>
