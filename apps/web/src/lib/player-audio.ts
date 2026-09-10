import type { PlayerSoundPreference } from './player-settings';

export type PlayerSoundCue = 'bell' | 'gate' | 'voice' | 'threshold' | 'menu' | 'warning';
export type PlayerSoundProfile = 'title' | 'gate' | 'hearth' | 'tower' | 'silence';

const cueCaptions: Record<PlayerSoundCue, string> = {
	bell: 'A distant reserve bell answers.',
	gate: 'The summoning rings rise into resonance.',
	voice: 'A new voice settles into the chronicle.',
	threshold: 'The company crosses into Hearth 01.',
	menu: 'The interface folds into quiet focus.',
	warning: 'A low warning tone marks an irreversible choice.'
};

const profileFrequencies: Record<
	Exclude<PlayerSoundProfile, 'silence'>,
	readonly [number, number]
> = {
	title: [55, 82.41],
	gate: [65.41, 98],
	hearth: [73.42, 110],
	tower: [46.25, 69.3]
};

export function soundProfileForPath(pathname: string): PlayerSoundProfile {
	if (pathname === '/') return 'title';
	if (['/village', '/residents', '/tower', '/inventory', '/missions'].includes(pathname)) {
		return 'hearth';
	}
	if (
		pathname.startsWith('/mission/') ||
		pathname.startsWith('/synthesis/') ||
		pathname.startsWith('/first-band-archive/') ||
		pathname.startsWith('/last-command') ||
		pathname.startsWith('/aftermath')
	)
		return 'tower';
	return 'silence';
}

export function captionForSoundCue(cue: PlayerSoundCue): string {
	return cueCaptions[cue];
}

class ProceduralPlayerAudio {
	private context: AudioContext | null = null;
	private master: GainNode | null = null;
	private ambience: GainNode | null = null;
	private oscillators: readonly OscillatorNode[] = [];
	private mode: PlayerSoundPreference = 'muted';
	private profile: PlayerSoundProfile = 'silence';

	async activate(mode: Exclude<PlayerSoundPreference, 'muted'>, profile: PlayerSoundProfile) {
		this.mode = mode;
		this.profile = profile;
		if (!this.context) this.createGraph();
		if (!this.context || !this.master || !this.ambience) return false;
		await this.context.resume();
		this.master.gain.setTargetAtTime(mode === 'full' ? 0.22 : 0.13, this.context.currentTime, 0.08);
		this.applyProfile(profile);
		return this.context.state === 'running';
	}

	setMode(mode: PlayerSoundPreference) {
		this.mode = mode;
		if (!this.context || !this.master) return;
		this.master.gain.setTargetAtTime(
			mode === 'muted' ? 0 : mode === 'full' ? 0.22 : 0.13,
			this.context.currentTime,
			0.06
		);
	}

	setProfile(profile: PlayerSoundProfile) {
		this.profile = profile;
		if (this.context) this.applyProfile(profile);
	}

	playCue(cue: PlayerSoundCue) {
		if (this.mode !== 'full' || !this.context || this.context.state !== 'running' || !this.master)
			return;
		const now = this.context.currentTime;
		const oscillator = this.context.createOscillator();
		const gain = this.context.createGain();
		const cueShape: Record<PlayerSoundCue, readonly [OscillatorType, number, number, number]> = {
			bell: ['sine', 523.25, 783.99, 0.8],
			gate: ['sawtooth', 98, 196, 1.15],
			voice: ['triangle', 220, 293.66, 0.34],
			threshold: ['sine', 146.83, 293.66, 0.9],
			menu: ['triangle', 246.94, 196, 0.18],
			warning: ['square', 92.5, 73.42, 0.48]
		};
		const [type, from, to, duration] = cueShape[cue];
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(from, now);
		oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(cue === 'warning' ? 0.08 : 0.045, now + 0.03);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		oscillator.connect(gain).connect(this.master);
		oscillator.start(now);
		oscillator.stop(now + duration + 0.02);
	}

	stop() {
		if (!this.context || !this.master) return;
		this.mode = 'muted';
		this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.04);
	}

	private createGraph() {
		const AudioContextConstructor = window.AudioContext;
		if (!AudioContextConstructor) return;
		this.context = new AudioContextConstructor();
		this.master = this.context.createGain();
		this.ambience = this.context.createGain();
		this.master.gain.value = 0;
		this.ambience.gain.value = 0;
		this.ambience.connect(this.master).connect(this.context.destination);

		const low = this.context.createOscillator();
		const high = this.context.createOscillator();
		low.type = 'sine';
		high.type = 'triangle';
		const lowGain = this.context.createGain();
		const highGain = this.context.createGain();
		lowGain.gain.value = 0.12;
		highGain.gain.value = 0.035;
		low.connect(lowGain).connect(this.ambience);
		high.connect(highGain).connect(this.ambience);
		low.start();
		high.start();
		this.oscillators = [low, high];
	}

	private applyProfile(profile: PlayerSoundProfile) {
		if (!this.context || !this.ambience) return;
		const now = this.context.currentTime;
		if (profile === 'silence') {
			this.ambience.gain.setTargetAtTime(0, now, 0.3);
			return;
		}
		const [low, high] = profileFrequencies[profile];
		this.oscillators[0]?.frequency.setTargetAtTime(low, now, 0.35);
		this.oscillators[1]?.frequency.setTargetAtTime(high, now, 0.35);
		this.ambience.gain.setTargetAtTime(profile === 'gate' ? 0.72 : 0.52, now, 0.4);
	}
}

export const playerAudio = new ProceduralPlayerAudio();
