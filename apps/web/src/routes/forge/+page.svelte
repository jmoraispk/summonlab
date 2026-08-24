<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { generateCharacterDraft, recipeFromSeed, rerollRecipe } from '@summonlab/characters';
	import type {
		CharacterGenerationCursors,
		ProofControlMode,
		ProofRunCreateRequest
	} from '@summonlab/contracts';
	import maraAnchor from '../../../../../assets/heroes/ember-01-anchor-v1.png';
	import remyAnchor from '../../../../../assets/heroes/visuals/hearth-02-anchor-v1.png';
	import HeroRig from '$lib/components/HeroRig.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let drafts = $state(data.drafts);
	let selectedIndex = $state(0);
	let locks = $state<Record<keyof CharacterGenerationCursors, boolean>>({
		identity: true,
		body: false,
		features: false,
		styling: false,
		mind: false,
		rarity: true
	});
	let controlMode = $state<ProofControlMode>('autonomous');
	let directive = $state('');
	let seedInput = $state('ember-01');
	let busy = $state(false);
	let errorMessage = $state('');

	const selected = $derived(drafts[selectedIndex]!);
	const selectedAnchor = $derived(
		selected.manifest.artKey === 'ember-01-anchor-v1'
			? maraAnchor
			: selected.manifest.artKey === 'hearth-02-anchor-v1'
				? remyAnchor
				: null
	);
	const channels = [
		{ key: 'identity', label: 'Name & voice' },
		{ key: 'body', label: 'Age & build' },
		{ key: 'features', label: 'Face & phenotype' },
		{ key: 'styling', label: 'Hair & bearing' },
		{ key: 'mind', label: 'Mind & habits' },
		{ key: 'rarity', label: 'Rarity' }
	] as const;
	const modeOptions: ReadonlyArray<{
		value: ProofControlMode;
		label: string;
		detail: string;
	}> = [
		{
			value: 'autonomous',
			label: 'Autonomous',
			detail: 'Hero decides immediately from traits + direction.'
		},
		{
			value: 'random',
			label: 'Seeded random',
			detail: 'A legal destination is replayably random.'
		},
		{
			value: 'wait',
			label: 'Wait for step',
			detail: 'Hold the decision until you ask the hero to act.'
		},
		{
			value: 'countdown',
			label: '5-second handoff',
			detail: 'A short window to add direction, then the hero acts.'
		}
	];

	async function rerollUnlocked() {
		busy = true;
		errorMessage = '';
		try {
			const locked = new Set(
				channels.filter((channel) => locks[channel.key]).map((channel) => channel.key)
			);
			drafts[selectedIndex] = await generateCharacterDraft(rerollRecipe(selected.recipe, locked));
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'The forge failed to resolve this seed.';
		} finally {
			busy = false;
		}
	}

	async function applySeed() {
		if (!seedInput.trim()) return;
		busy = true;
		errorMessage = '';
		try {
			drafts[selectedIndex] = await generateCharacterDraft(recipeFromSeed(seedInput.trim()));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'That seed could not be forged.';
		} finally {
			busy = false;
		}
	}

	async function summon() {
		busy = true;
		errorMessage = '';
		try {
			const payload: ProofRunCreateRequest = {
				recipe: selected.recipe,
				controlMode,
				directive: directive.trim()
			};
			const response = await fetch('/api/runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const result = (await response.json()) as { runId?: string; message?: string };
			if (!response.ok || !result.runId)
				throw new Error(result.message ?? 'The gate did not answer.');
			await goto(resolve('/summon/[runId]', { runId: result.runId }));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The summoning request failed.';
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Character Forge · summonlab</title>
	<meta
		name="description"
		content="Inspect deterministic adult hero seeds, lock traits, and begin the summon-to-choice proof."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div class="chapter">
			<span>Story envelope</span>
			<strong>00 · The First Ember</strong>
		</div>
		<a class="phase" href={resolve('/visual-lab')}><span></span> Phase 3 · visual lab</a>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">Character forge / {selected.manifest.generationVersion}</p>
			<h1>One seed.<br />One persistent self.</h1>
		</div>
		<p>
			Appearance, mind, habits, and rarity use separate deterministic streams. Lock what you believe
			belongs to the same person; reroll the rest. Every summon is adult in this slice.
		</p>
	</section>

	<section class="forge-shell">
		<div class="roster-panel">
			<div class="panel-heading">
				<div>
					<p>Seed cohort</p>
					<h2>12 possible arrivals</h2>
				</div>
				<span>select to inspect</span>
			</div>
			<div class="seed-grid">
				{#each drafts as draft, index (draft.manifest.characterId)}
					<button
						class:selected={selectedIndex === index}
						type="button"
						onclick={() => {
							selectedIndex = index;
							seedInput = draft.recipe.seed;
						}}
						aria-label={`Inspect ${draft.manifest.displayName}`}
					>
						<div class="mini-rig">
							<HeroRig manifest={draft.manifest} compact />
						</div>
						<div class="card-copy">
							<span>{'✦'.repeat(draft.manifest.rarityStars)}</span>
							<strong>{draft.manifest.displayName}</strong>
							<small>{draft.manifest.adultAge} · {draft.manifest.heightCm} cm</small>
						</div>
					</button>
				{/each}
			</div>
		</div>

		<article class="selected-hero">
			<div class="portrait-stage">
				<div class="scanline"></div>
				{#if selectedAnchor}
					<img
						src={selectedAnchor}
						alt={`${selected.manifest.displayName}, original full-body hero concept`}
					/>
				{:else}
					<HeroRig manifest={selected.manifest} />
				{/if}
				<div class="portrait-caption">
					<span>Approved visual seed</span>
					<strong>{selected.manifest.assetProvenance}</strong>
				</div>
			</div>

			<div class="identity-sheet">
				<div class="hero-title">
					<div>
						<p>
							{'✦'.repeat(selected.manifest.rarityStars)}
							{selected.manifest.rarityStars}-star summon
						</p>
						<h2>{selected.manifest.displayName}</h2>
					</div>
					<code>{selected.manifestHash.slice(0, 12)}</code>
				</div>

				<dl class="physicality">
					<div>
						<dt>Age</dt>
						<dd>{selected.manifest.adultAge}</dd>
					</div>
					<div>
						<dt>Height</dt>
						<dd>{selected.manifest.heightCm} cm</dd>
					</div>
					<div>
						<dt>Build</dt>
						<dd>{selected.manifest.bodyFrame} / {selected.manifest.bodyBuild}</dd>
					</div>
					{#if selected.manifest.physiology}
						<div>
							<dt>Physiology</dt>
							<dd>
								{selected.manifest.physiology.massKg} kg · tone {selected.manifest.physiology
									.muscleTone}/10
							</dd>
						</div>
						<div>
							<dt>Proportions</dt>
							<dd>
								{selected.manifest.physiology.limbProportion} limbs · hand {selected.manifest
									.physiology.handScale}
							</dd>
						</div>
					{/if}
					<div>
						<dt>Skin</dt>
						<dd>{selected.manifest.phenotype.skinTone}</dd>
					</div>
					<div>
						<dt>Hair</dt>
						<dd>
							{selected.manifest.phenotype.hairTexture}, {selected.manifest.phenotype.hairStyle}
						</dd>
					</div>
					<div>
						<dt>Bearing</dt>
						<dd>{selected.manifest.posture}</dd>
					</div>
				</dl>

				<div class="mind-preview">
					<div>
						<span>Value</span><strong>{selected.mind.primaryValue}</strong>
					</div>
					<div>
						<span>Drive</span><strong>{selected.mind.primaryDrive}</strong>
					</div>
					<div>
						<span>Habit</span><strong>{selected.mind.dailyHabit.replaceAll('-', ' ')}</strong>
					</div>
					<div>
						<span>Social</span><strong>{selected.mind.socialStyle}</strong>
					</div>
				</div>

				<div class="seed-control">
					<label for="seed">Appearance seed</label>
					<div>
						<input id="seed" bind:value={seedInput} maxlength="128" />
						<button type="button" onclick={applySeed} disabled={busy}>Apply</button>
					</div>
				</div>

				<div class="locks">
					{#each channels as channel (channel.key)}
						<button
							type="button"
							class:locked={locks[channel.key]}
							aria-pressed={locks[channel.key]}
							onclick={() => (locks[channel.key] = !locks[channel.key])}
						>
							<span>{locks[channel.key] ? '◆' : '◇'}</span>{channel.label}
							<small>r{selected.recipe.cursors[channel.key]}</small>
						</button>
					{/each}
				</div>
				<button class="reroll" type="button" onclick={rerollUnlocked} disabled={busy}>
					<span>↻</span> Reroll unlocked channels
				</button>
			</div>
		</article>
	</section>

	<section class="control-contract">
		<div class="contract-copy">
			<p class="eyebrow">First decision contract</p>
			<h2>You set the tempo.<br />The hero keeps the choice.</h2>
			<p>
				The opening plot is fixed: summon, orient, choose a first destination. The selected
				destination opens a durable branch inside that envelope; it cannot invent rewards or bypass
				world rules.
			</p>
		</div>
		<div class="mode-grid" role="radiogroup" aria-label="First decision control mode">
			{#each modeOptions as mode (mode.value)}
				<button
					type="button"
					class:selected={controlMode === mode.value}
					onclick={() => (controlMode = mode.value)}
					role="radio"
					aria-checked={controlMode === mode.value}
				>
					<span>{mode.label}</span>
					<small>{mode.detail}</small>
				</button>
			{/each}
		</div>
		<label class="directive">
			<span>Optional direction · best effort, never direct control</span>
			<textarea
				bind:value={directive}
				maxlength="500"
				placeholder="Example: Learn who lives here before thinking about the tower."></textarea>
			<small>{directive.length}/500 · recorded in the decision log</small>
		</label>
		{#if errorMessage}
			<p class="error" role="alert">{errorMessage}</p>
		{/if}
		<button class="summon" type="button" onclick={summon} disabled={busy}>
			<span>{busy ? 'Opening gate…' : `Summon ${selected.manifest.displayName}`}</span>
			<small>Persist recipe → observation → choice → branch</small>
		</button>
	</section>
</main>

<style>
	:global(body) {
		background:
			radial-gradient(circle at 76% 12%, rgba(95, 73, 166, 0.2), transparent 31rem),
			linear-gradient(180deg, #080a10, #0d0e14 60%, #08090d);
	}

	main {
		min-height: 100vh;
		background-image: linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px);
		background-size: 100% 4px;
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	.topbar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 2rem;
		padding: 1.4rem clamp(1.2rem, 3vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(7, 8, 13, 0.8);
		backdrop-filter: blur(20px);
	}

	.wordmark {
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.24em;
		text-transform: uppercase;
	}

	.chapter {
		text-align: center;
	}

	.chapter span,
	.chapter strong {
		display: block;
	}

	.chapter span {
		margin-bottom: 0.25rem;
		color: rgba(246, 241, 231, 0.38);
		font-size: 0.52rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.chapter strong {
		font-family: Georgia, serif;
		font-size: 0.9rem;
		font-weight: 400;
	}

	.phase {
		justify-self: end;
		color: rgba(246, 241, 231, 0.55);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.phase span {
		display: inline-block;
		width: 0.35rem;
		height: 0.35rem;
		margin-right: 0.45rem;
		border-radius: 50%;
		background: #74d6ae;
		box-shadow: 0 0 0.75rem #74d6ae;
	}

	.intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.55fr);
		align-items: end;
		gap: 4rem;
		max-width: 100rem;
		margin: 0 auto;
		padding: clamp(3rem, 7vw, 7rem) clamp(1.2rem, 4vw, 4rem) 3rem;
	}

	.eyebrow,
	.panel-heading p {
		margin: 0 0 0.7rem;
		color: #d2a04d;
		font-size: 0.62rem;
		font-weight: 750;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0;
		font-family: Georgia, serif;
		font-size: clamp(3.2rem, 7vw, 7rem);
		font-weight: 400;
		line-height: 0.88;
		letter-spacing: -0.055em;
	}

	.intro > p,
	.contract-copy > p:last-child {
		margin-bottom: 0;
		color: rgba(246, 241, 231, 0.62);
		font-size: 0.96rem;
		line-height: 1.75;
	}

	.forge-shell {
		display: grid;
		grid-template-columns: minmax(23rem, 0.75fr) minmax(0, 1.25fr);
		max-width: 100rem;
		margin: 0 auto;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(9, 11, 17, 0.74);
		box-shadow: 0 3rem 8rem rgba(0, 0, 0, 0.3);
	}

	.roster-panel {
		padding: 1.5rem;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}

	.panel-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1.2rem;
	}

	.panel-heading p {
		margin-bottom: 0.25rem;
	}

	.panel-heading h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: 1.45rem;
		font-weight: 400;
	}

	.panel-heading > span {
		color: rgba(246, 241, 231, 0.3);
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.seed-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.seed-grid button {
		position: relative;
		min-width: 0;
		padding: 0;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: linear-gradient(165deg, rgba(255, 255, 255, 0.05), rgba(3, 4, 8, 0.6));
		color: inherit;
		cursor: pointer;
		text-align: left;
		transition:
			border-color 180ms ease,
			transform 180ms ease;
	}

	.seed-grid button:hover,
	.seed-grid button:focus-visible {
		border-color: rgba(210, 160, 77, 0.45);
		transform: translateY(-2px);
	}

	.seed-grid button.selected {
		border-color: #d2a04d;
		box-shadow:
			inset 0 0 0 1px rgba(210, 160, 77, 0.3),
			0 0 2rem rgba(210, 160, 77, 0.12);
	}

	.mini-rig {
		height: 9rem;
		padding: 0.4rem 1rem 0;
		overflow: hidden;
		background: radial-gradient(circle at 50% 40%, rgba(104, 87, 164, 0.18), transparent 65%);
	}

	.card-copy {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.65rem;
		background: rgba(5, 6, 10, 0.92);
	}

	.card-copy span {
		color: #d2a04d;
		font-size: 0.5rem;
		letter-spacing: 0.12em;
	}

	.card-copy strong {
		overflow: hidden;
		font-size: 0.72rem;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-copy small {
		color: rgba(246, 241, 231, 0.38);
		font-size: 0.55rem;
	}

	.selected-hero {
		display: grid;
		grid-template-columns: minmax(18rem, 0.9fr) minmax(22rem, 1.1fr);
		min-width: 0;
	}

	.portrait-stage {
		position: relative;
		display: flex;
		min-height: 48rem;
		align-items: flex-end;
		justify-content: center;
		overflow: hidden;
		background:
			radial-gradient(circle at 50% 35%, rgba(76, 71, 133, 0.28), transparent 45%), #080a11;
	}

	.portrait-stage > img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		filter: saturate(0.88) contrast(1.05);
	}

	.scanline {
		position: absolute;
		z-index: 2;
		inset: 0;
		background-image: linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px);
		background-size: 100% 4px;
		mix-blend-mode: overlay;
		pointer-events: none;
	}

	.portrait-caption {
		position: absolute;
		z-index: 3;
		right: 1rem;
		bottom: 1rem;
		left: 1rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(6, 7, 12, 0.74);
		backdrop-filter: blur(12px);
		font-size: 0.54rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.portrait-caption span {
		color: rgba(246, 241, 231, 0.42);
	}

	.portrait-caption strong {
		color: #d2a04d;
		font-weight: 600;
	}

	.identity-sheet {
		padding: clamp(1.4rem, 3vw, 3rem);
		background: rgba(10, 12, 19, 0.94);
	}

	.hero-title {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.hero-title p {
		margin-bottom: 0.35rem;
		color: #d2a04d;
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.hero-title h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(2.2rem, 4vw, 4.2rem);
		font-weight: 400;
		letter-spacing: -0.045em;
	}

	.hero-title code {
		color: #76d2e3;
		font-family: ui-monospace, monospace;
		font-size: 0.6rem;
	}

	.physicality {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin: 1.5rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		border-left: 1px solid rgba(255, 255, 255, 0.07);
	}

	.physicality div {
		min-width: 0;
		padding: 0.8rem;
		border-right: 1px solid rgba(255, 255, 255, 0.07);
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}

	dt,
	.mind-preview span,
	.seed-control > label,
	.directive > span {
		margin-bottom: 0.35rem;
		color: rgba(246, 241, 231, 0.34);
		font-size: 0.52rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	dd {
		margin: 0;
		overflow: hidden;
		font-size: 0.68rem;
		text-overflow: ellipsis;
		text-transform: capitalize;
		white-space: nowrap;
	}

	.mind-preview {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
		margin-bottom: 1.5rem;
	}

	.mind-preview div {
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.035);
	}

	.mind-preview span,
	.mind-preview strong {
		display: block;
	}

	.mind-preview strong {
		font-size: 0.72rem;
		font-weight: 550;
		text-transform: capitalize;
	}

	.seed-control > label {
		display: block;
	}

	.seed-control > div {
		display: grid;
		grid-template-columns: 1fr auto;
	}

	input,
	textarea {
		width: 100%;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0;
		outline: 0;
		background: rgba(2, 3, 7, 0.45);
		color: #f6f1e7;
	}

	input {
		padding: 0.75rem;
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
	}

	input:focus,
	textarea:focus {
		border-color: #d2a04d;
	}

	.seed-control button {
		padding: 0 1rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		cursor: pointer;
		font-size: 0.62rem;
	}

	.locks {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
		margin-top: 1rem;
	}

	.locks button {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: transparent;
		color: rgba(246, 241, 231, 0.5);
		cursor: pointer;
		font-size: 0.58rem;
		text-align: left;
	}

	.locks button.locked {
		border-color: rgba(210, 160, 77, 0.32);
		background: rgba(210, 160, 77, 0.07);
		color: #f6f1e7;
	}

	.locks button > span {
		color: #d2a04d;
	}

	.locks small {
		color: rgba(246, 241, 231, 0.3);
		font-family: ui-monospace, monospace;
	}

	.reroll {
		width: 100%;
		margin-top: 0.7rem;
		padding: 0.85rem;
		border: 1px solid rgba(118, 210, 227, 0.25);
		background: rgba(118, 210, 227, 0.05);
		color: #86d5e3;
		cursor: pointer;
		font-size: 0.62rem;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	button:disabled {
		cursor: wait;
		opacity: 0.55;
	}

	.control-contract {
		display: grid;
		grid-template-columns: 0.7fr 1.3fr;
		gap: 3rem;
		max-width: 100rem;
		margin: 3rem auto 0;
		padding: clamp(2rem, 5vw, 5rem) clamp(1.2rem, 4vw, 4rem) 6rem;
	}

	.contract-copy h2 {
		margin-bottom: 1rem;
		font-family: Georgia, serif;
		font-size: clamp(2rem, 4vw, 4rem);
		font-weight: 400;
		line-height: 1;
		letter-spacing: -0.04em;
	}

	.mode-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.mode-grid button {
		min-height: 6.5rem;
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(255, 255, 255, 0.025);
		color: inherit;
		cursor: pointer;
		text-align: left;
	}

	.mode-grid button.selected {
		border-color: #d2a04d;
		background: linear-gradient(135deg, rgba(210, 160, 77, 0.12), rgba(210, 160, 77, 0.02));
	}

	.mode-grid span,
	.mode-grid small {
		display: block;
	}

	.mode-grid span {
		margin-bottom: 0.55rem;
		font-family: Georgia, serif;
		font-size: 1rem;
	}

	.mode-grid small {
		color: rgba(246, 241, 231, 0.48);
		font-size: 0.65rem;
		line-height: 1.45;
	}

	.directive {
		display: block;
		grid-column: 2;
	}

	.directive > span {
		display: block;
	}

	textarea {
		min-height: 6rem;
		padding: 0.85rem;
		resize: vertical;
		font: inherit;
		font-size: 0.76rem;
		line-height: 1.5;
	}

	.directive > small {
		display: block;
		margin-top: 0.4rem;
		color: rgba(246, 241, 231, 0.3);
		font-size: 0.58rem;
		text-align: right;
	}

	.summon {
		grid-column: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
		padding: 1.2rem 1.4rem;
		border: 1px solid #d2a04d;
		background: linear-gradient(100deg, #d2a04d, #ae6d38);
		color: #090a0f;
		cursor: pointer;
		text-align: left;
	}

	.summon span {
		font-family: Georgia, serif;
		font-size: 1.2rem;
	}

	.summon small {
		font-size: 0.58rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.error {
		grid-column: 2;
		margin: 0;
		padding: 0.8rem;
		border: 1px solid rgba(240, 110, 104, 0.35);
		color: #f2938f;
		font-size: 0.72rem;
	}

	@media (max-width: 1180px) {
		.forge-shell {
			grid-template-columns: 1fr;
			margin-inline: 1rem;
		}

		.roster-panel {
			border-right: 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		}

		.seed-grid {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}

	@media (max-width: 800px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}

		.chapter {
			display: none;
		}

		.intro,
		.control-contract,
		.selected-hero {
			grid-template-columns: 1fr;
		}

		.intro {
			gap: 1.5rem;
		}

		.seed-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.portrait-stage {
			min-height: 75vh;
		}

		.directive,
		.summon,
		.error {
			grid-column: 1;
		}
	}

	@media (max-width: 520px) {
		.seed-grid,
		.mode-grid,
		.physicality,
		.mind-preview,
		.locks {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.portrait-stage {
			min-height: 38rem;
		}

		.summon {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.5rem;
		}
	}
</style>
