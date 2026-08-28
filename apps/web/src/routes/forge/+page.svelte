<script lang="ts">
	import { resolve } from '$app/paths';
	import mara from '../../../../../assets/heroes/ember-01-anchor-v1.png';
	import dara from '../../../../../assets/heroes/visuals/owner-playtest-v1/dara-zev-anchor-v1.png';
	import elian from '../../../../../assets/heroes/visuals/owner-playtest-v1/elian-ro-anchor-v1.png';
	import jori from '../../../../../assets/heroes/visuals/owner-playtest-v1/jori-daro-anchor-v1.png';
	import remy from '../../../../../assets/heroes/visuals/hearth-02-anchor-v1.png';
	import kaviGaro from '../../../../../assets/heroes/visuals/forge-v1/kavi-garo-anchor-v1.webp';
	import kaviNor from '../../../../../assets/heroes/visuals/forge-v1/kavi-nor-anchor-v1.webp';
	import lio from '../../../../../assets/heroes/visuals/forge-v1/lio-senn-anchor-v1.webp';
	import noa from '../../../../../assets/heroes/visuals/forge-v1/noa-kest-anchor-v1.webp';

	let { data } = $props();
	let channelIndex = $state(0);
	let selectedHeroIndex = $state(0);
	let opening = $state(false);
	let summoned = $state(false);
	let summonCycle = $state(0);

	const portraits: Record<string, string> = {
		'jori-daro': jori,
		'mara-vey': mara,
		'remy-nahl': remy,
		'dara-zev': dara,
		'elian-ro': elian,
		'kavi-nor': kaviNor,
		'kavi-garo': kaviGaro,
		'lio-senn': lio,
		'noa-kest': noa
	};
	const aptitudeNames = {
		might: 'Force handling',
		finesse: 'Footwork & aim',
		insight: 'Ward reading',
		resolve: 'Guard discipline'
	} as const;
	const channel = $derived(data.channels[channelIndex]!);
	const selected = $derived(channel.heroes[selectedHeroIndex]!);
	const stars = (count: number) => '✦'.repeat(count);
	const words = (value: string) => value.replaceAll('-', ' ');
	const indices = (count: number) => Array.from({ length: count }, (_, index) => index);

	function chooseChannel(index: number) {
		channelIndex = index;
		selectedHeroIndex = 0;
		summoned = false;
		opening = false;
	}

	async function summonThree() {
		if (opening) return;
		opening = true;
		summoned = false;
		selectedHeroIndex = 0;
		summonCycle += 1;
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 720));
		summoned = true;
		opening = false;
	}
</script>

<svelte:head>
	<title>Summoning Forge · summonlab</title>
	<meta
		name="description"
		content="Compare three summon channels and inspect realistic deterministic hero cohorts."
	/>
</svelte:head>

<main>
	<header class="topbar">
		<a class="wordmark" href={resolve('/')}>summonlab</a>
		<div><span>Development component</span><strong>Summoning Forge</strong></div>
		<nav>
			<a href={resolve('/forge/enemies')}>Enemy roster</a>
			<a href={resolve('/forge/contact-sheet')}>Seed audit</a>
		</nav>
	</header>

	<section class="intro">
		<div>
			<p class="eyebrow">Component test · no campaign state</p>
			<h1>Choose a gate.<br /><em>Meet the arrivals.</em></h1>
		</div>
		<div class="intro-copy">
			<p>
				This room isolates the part that matters first: choose a summon, watch three people arrive,
				then inspect who they are. Nothing here spends resources or changes a chronicle.
			</p>
			<span>Fixed review cohorts · economy and final odds are still open</span>
		</div>
	</section>

	<section class="channel-picker" aria-labelledby="channel-heading">
		<div class="section-heading">
			<div>
				<span>01</span>
				<h2 id="channel-heading">Select a summon</h2>
			</div>
			<p>The minimum starting star rank changes. Promotion potential does not.</p>
		</div>
		<div class="channels" role="radiogroup" aria-label="Summon channel">
			{#each data.channels as option, index (option.id)}
				<button
					type="button"
					class:selected={channelIndex === index}
					onclick={() => chooseChannel(index)}
					role="radio"
					aria-checked={channelIndex === index}
					data-testid={`summon-channel-${option.id}`}
				>
					<div class="channel-top">
						<span>{String(index + 1).padStart(2, '0')}</span>
						<b>{option.resonance}</b>
					</div>
					<h3>{option.label}</h3>
					<strong>{option.minimumStars}★+ minimum</strong>
					<p>{option.detail}</p>
					<small>{option.cost}</small>
				</button>
			{/each}
		</div>
	</section>

	<section class="gate-lab" class:opening class:summoned data-testid="forge-gate">
		<div class="gate-stage">
			<div class="gate-machine" aria-hidden="true">
				{#each indices(channel.minimumStars) as ring (ring)}<i></i>{/each}
				<div class="gate-core"></div>
			</div>
			<div class="gate-copy">
				<p class="eyebrow">{channel.label} · {channel.resonance}</p>
				<h2>
					{opening
						? 'The gate is resolving…'
						: summoned
							? 'Three people arrived.'
							: 'The gate is ready.'}
				</h2>
				<p>
					{summoned
						? 'Select any arrival to inspect resonance, temperament, and aptitude signals.'
						: `This review pull guarantees ${channel.minimumStars}★ or higher. The identities are deterministic and the portraits are bound to this cohort.`}
				</p>
				<button type="button" onclick={summonThree} disabled={opening} data-testid="summon-three">
					<span
						>{opening ? 'Opening…' : summoned ? 'Replay this summon' : 'Summon three heroes'}</span
					>
					<small>{summoned ? `Review pass ${summonCycle}` : 'No resource cost in the Forge'}</small>
				</button>
			</div>
		</div>

		<div class="arrivals" aria-live="polite" aria-label="Summon results">
			{#if summoned}
				{#each channel.heroes as entry, index (entry.draft.manifestHash)}
					<button
						type="button"
						class:selected={selectedHeroIndex === index}
						onclick={() => (selectedHeroIndex = index)}
						style={`--arrival-index: ${index}`}
						data-testid="summoned-hero"
					>
						<div class="portrait">
							<img
								src={portraits[entry.portraitKey]}
								alt={`${entry.draft.manifest.displayName}, realistic summon portrait`}
							/>
							<div class="resonance" aria-hidden="true">
								{#each indices(entry.draft.manifest.rarityStars) as ring (ring)}<i></i>{/each}
							</div>
						</div>
						<div class="arrival-copy">
							<span>{stars(entry.draft.manifest.rarityStars)}</span>
							<strong>{entry.draft.manifest.displayName}</strong>
							<small>Level cap {entry.draft.manifest.rarityStars * 10}</small>
						</div>
					</button>
				{/each}
			{:else}
				{#each indices(3) as index (index)}
					<div class="arrival-placeholder">
						<span>0{index + 1}</span>
						<p>Unresolved</p>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	{#if summoned}
		<section class="dossier" data-testid="hero-dossier">
			<div class="section-heading">
				<div>
					<span>02</span>
					<h2>Understand the hero</h2>
				</div>
				<p>Personality and aptitude are independent from rarity.</p>
			</div>
			<div class="dossier-grid">
				<div class="identity-card">
					<p class="eyebrow">Selected arrival</p>
					<h3>{selected.draft.manifest.displayName}</h3>
					<p>
						{stars(selected.draft.manifest.rarityStars)} · {selected.draft.manifest.rarityStars}★
						resonance
					</p>
					<dl>
						<div>
							<dt>Age</dt>
							<dd>{selected.draft.manifest.adultAge}</dd>
						</div>
						<div>
							<dt>Height</dt>
							<dd>{selected.draft.manifest.heightCm} cm</dd>
						</div>
						<div>
							<dt>Build</dt>
							<dd>{words(selected.draft.manifest.bodyBuild)}</dd>
						</div>
						<div>
							<dt>Bearing</dt>
							<dd>{words(selected.draft.manifest.posture)}</dd>
						</div>
						<div>
							<dt>Level cap</dt>
							<dd>{selected.draft.manifest.rarityStars * 10}</dd>
						</div>
						<div>
							<dt>Promotion</dt>
							<dd>Up to 7★</dd>
						</div>
					</dl>
				</div>
				<div class="personality-card">
					<p class="eyebrow">Observable personality</p>
					<div><span>Values</span><strong>{words(selected.draft.mind.primaryValue)}</strong></div>
					<div>
						<span>Driven to</span><strong>{words(selected.draft.mind.primaryDrive)}</strong>
					</div>
					<div>
						<span>Social style</span><strong>{words(selected.draft.mind.socialStyle)}</strong>
					</div>
					<div>
						<span>Under stress</span><strong>{words(selected.draft.mind.stressResponse)}</strong>
					</div>
					<div class="habit">
						<span>Emerging habit</span><strong>{words(selected.draft.mind.dailyHabit)}</strong>
					</div>
				</div>
				<div class="aptitude-card">
					<p class="eyebrow">Aptitude scan · not learned skills</p>
					{#each Object.entries(selected.draft.mind.aptitudes) as [key, value] (key)}
						<div>
							<span>{aptitudeNames[key as keyof typeof aptitudeNames]}</span>
							<div class="meter"><i style={`--score: ${value}`}></i></div>
							<strong>{value}/9</strong>
						</div>
					{/each}
					<small>
						The Forge can read potential. Actual sword, bow, magic, craft, and social skills must be
						learned or authored separately.
					</small>
				</div>
			</div>
		</section>
	{/if}

	<section class="boundaries">
		<div>
			<p class="eyebrow">What to judge now</p>
			<h2>Does summoning feel understandable—and worth repeating?</h2>
		</div>
		<ul>
			<li>
				<span>In scope</span> Channel choice, minimum stars, reveal rhythm, realistic people, readable
				identity.
			</li>
			<li>
				<span>Held back</span> Currency prices, final odds, pity counters, on-demand portrait generation.
			</li>
			<li><span>Next component</span> Enemy families and floor-by-floor combat pressure.</li>
		</ul>
		<a href={resolve('/forge/enemies')}>Review 16 realistic enemy archetypes <span>→</span></a>
	</section>
</main>

<style>
	:global(body) {
		background: #07090e;
	}
	main {
		min-height: 100vh;
		color: #f5f0e5;
		background:
			radial-gradient(circle at 50% 26rem, rgba(116, 77, 185, 0.16), transparent 34rem),
			linear-gradient(180deg, #080a10 0%, #0d0d12 55%, #07080c 100%);
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
		min-height: 5rem;
		padding: 0 clamp(1rem, 3vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(6, 8, 12, 0.82);
		backdrop-filter: blur(18px);
	}
	.wordmark {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.23em;
		text-transform: uppercase;
	}
	.topbar > div {
		text-align: center;
	}
	.topbar > div span,
	.topbar > div strong {
		display: block;
	}
	.topbar > div span {
		color: #d2a04d;
		font-size: 0.48rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.topbar > div strong {
		margin-top: 0.2rem;
		font:
			400 1rem Georgia,
			serif;
	}
	.topbar nav {
		display: flex;
		justify-self: end;
		gap: 1.2rem;
		color: rgba(245, 240, 229, 0.5);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.intro,
	.channel-picker,
	.gate-lab,
	.dossier,
	.boundaries {
		max-width: 92rem;
		margin-inline: auto;
	}
	.intro {
		display: grid;
		grid-template-columns: 1.15fr 0.85fr;
		align-items: end;
		gap: 5rem;
		padding: clamp(4rem, 8vw, 8rem) clamp(1.2rem, 4vw, 4rem) 4rem;
	}
	.eyebrow {
		margin: 0 0 0.7rem;
		color: #d2a04d;
		font-size: 0.58rem;
		font-weight: 750;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 0;
		font:
			400 clamp(3.6rem, 7vw, 7.4rem)/0.88 Georgia,
			serif;
		letter-spacing: -0.055em;
	}
	h1 em {
		color: #d9b875;
		font-weight: 400;
	}
	.intro-copy > p {
		color: rgba(245, 240, 229, 0.64);
		font-size: 1rem;
		line-height: 1.75;
	}
	.intro-copy > span {
		color: #76d2e3;
		font-size: 0.58rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}
	.channel-picker {
		padding: 0 clamp(1.2rem, 4vw, 4rem) 3rem;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1.25rem;
	}
	.section-heading > div {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
	}
	.section-heading > div > span {
		color: #d2a04d;
		font:
			400 0.72rem ui-monospace,
			monospace;
	}
	.section-heading h2 {
		margin: 0;
		font:
			400 clamp(1.7rem, 3vw, 2.8rem) Georgia,
			serif;
	}
	.section-heading > p {
		max-width: 28rem;
		margin-bottom: 0.25rem;
		color: rgba(245, 240, 229, 0.45);
		font-size: 0.75rem;
		text-align: right;
	}
	.channels {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.channels button {
		padding: 1.25rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(13, 16, 23, 0.84);
		color: inherit;
		cursor: pointer;
		text-align: left;
		transition:
			transform 180ms ease,
			border-color 180ms ease,
			background 180ms ease;
	}
	.channels button:hover,
	.channels button:focus-visible {
		border-color: rgba(210, 160, 77, 0.5);
		transform: translateY(-2px);
	}
	.channels button.selected {
		border-color: #d2a04d;
		background: linear-gradient(145deg, rgba(210, 160, 77, 0.12), rgba(14, 16, 24, 0.94));
		box-shadow: inset 0 0 0 1px rgba(210, 160, 77, 0.2);
	}
	.channel-top {
		display: flex;
		justify-content: space-between;
		color: rgba(245, 240, 229, 0.35);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.channels h3 {
		margin: 2rem 0 0.35rem;
		font:
			400 1.55rem Georgia,
			serif;
	}
	.channels button > strong {
		color: #d9b875;
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.channels p {
		min-height: 2.8rem;
		margin: 0.8rem 0 1rem;
		color: rgba(245, 240, 229, 0.5);
		font-size: 0.68rem;
		line-height: 1.55;
	}
	.channels small {
		color: #76d2e3;
		font-size: 0.5rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.gate-lab {
		margin-bottom: 4rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(8, 10, 15, 0.88);
		box-shadow: 0 3rem 8rem rgba(0, 0, 0, 0.36);
	}
	.gate-stage {
		display: grid;
		grid-template-columns: minmax(19rem, 0.8fr) minmax(22rem, 1.2fr);
		min-height: 31rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.gate-machine {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 31rem;
		overflow: hidden;
		background: radial-gradient(
			circle,
			rgba(205, 154, 74, 0.1),
			rgba(67, 52, 112, 0.12) 32%,
			transparent 64%
		);
	}
	.gate-machine > i {
		position: absolute;
		width: min(73%, 23rem);
		aspect-ratio: 1;
		border: 1px solid rgba(210, 160, 77, 0.38);
		border-radius: 50%;
		box-shadow:
			0 0 2rem rgba(210, 160, 77, 0.12),
			inset 0 0 2rem rgba(210, 160, 77, 0.08);
	}
	.gate-machine > i:nth-child(2) {
		width: min(58%, 18rem);
		border-style: dashed;
		transform: rotate(24deg);
	}
	.gate-machine > i:nth-child(3) {
		width: min(43%, 13rem);
		transform: rotate(-17deg);
	}
	.gate-core {
		width: min(30%, 9rem);
		aspect-ratio: 1;
		border: 1px solid rgba(118, 210, 227, 0.45);
		border-radius: 50%;
		background: #05060a;
		box-shadow: 0 0 4rem rgba(113, 86, 185, 0.3);
	}
	.opening .gate-machine > i {
		animation: gate-spin 720ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.opening .gate-core {
		animation: gate-open 720ms ease;
	}
	.gate-copy {
		align-self: center;
		padding: clamp(2rem, 5vw, 5rem);
	}
	.gate-copy h2 {
		margin-bottom: 1rem;
		font:
			400 clamp(2.5rem, 5vw, 5.2rem)/0.94 Georgia,
			serif;
		letter-spacing: -0.04em;
	}
	.gate-copy > p:not(.eyebrow) {
		max-width: 38rem;
		color: rgba(245, 240, 229, 0.56);
		line-height: 1.7;
	}
	.gate-copy button {
		display: flex;
		width: min(100%, 28rem);
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 2rem;
		padding: 1rem 1.2rem;
		border: 1px solid #d2a04d;
		background: #d2a04d;
		color: #15100a;
		cursor: pointer;
		text-align: left;
	}
	.gate-copy button:disabled {
		cursor: wait;
		opacity: 0.7;
	}
	.gate-copy button span {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.gate-copy button small {
		font-size: 0.5rem;
		opacity: 0.68;
	}
	.arrivals {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		min-height: 26rem;
	}
	.arrivals > button {
		position: relative;
		display: grid;
		grid-template-columns: 1fr;
		min-width: 0;
		padding: 0;
		overflow: hidden;
		border: 0;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
		background: #090b10;
		color: inherit;
		cursor: pointer;
		text-align: left;
		animation: arrive 520ms calc(var(--arrival-index) * 120ms) both;
	}
	.arrivals > button:last-child {
		border-right: 0;
	}
	.arrivals > button.selected {
		box-shadow: inset 0 0 0 2px #d2a04d;
	}
	.portrait {
		position: relative;
		height: 23rem;
		overflow: hidden;
		background: radial-gradient(circle at 50% 35%, rgba(102, 77, 164, 0.22), transparent 58%);
	}
	.portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 20%;
		filter: saturate(0.86) contrast(1.05);
		transition:
			transform 220ms ease,
			filter 220ms ease;
	}
	.arrivals button:hover img,
	.arrivals button:focus-visible img {
		transform: scale(1.025);
		filter: saturate(1) contrast(1.05);
	}
	.resonance {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}
	.resonance i {
		position: absolute;
		width: 76%;
		aspect-ratio: 1;
		border: 1px solid rgba(210, 160, 77, 0.28);
		border-radius: 50%;
		box-shadow: 0 0 2rem rgba(210, 160, 77, 0.12);
	}
	.resonance i:nth-child(2) {
		width: 62%;
		border-style: dashed;
	}
	.resonance i:nth-child(3),
	.resonance i:nth-child(4) {
		width: 48%;
	}
	.arrival-copy {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 2;
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: 0.2rem 1rem;
		padding: 1rem;
		background: linear-gradient(transparent, rgba(4, 5, 8, 0.95) 35%);
	}
	.arrival-copy span {
		grid-column: 1/-1;
		color: #d2a04d;
		font-size: 0.62rem;
		letter-spacing: 0.14em;
	}
	.arrival-copy strong {
		font:
			400 1.2rem Georgia,
			serif;
	}
	.arrival-copy small {
		color: rgba(245, 240, 229, 0.46);
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.arrival-placeholder {
		display: grid;
		min-height: 26rem;
		place-items: center;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		color: rgba(245, 240, 229, 0.16);
	}
	.arrival-placeholder span {
		position: absolute;
		font:
			400 5rem Georgia,
			serif;
	}
	.arrival-placeholder p {
		margin: 5rem 0 0;
		font-size: 0.52rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.dossier {
		padding: 0 clamp(1.2rem, 4vw, 4rem) 5rem;
	}
	.dossier-grid {
		display: grid;
		grid-template-columns: 0.85fr 1fr 1.15fr;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(10, 12, 18, 0.82);
	}
	.dossier-grid > div {
		min-width: 0;
		padding: clamp(1.4rem, 3vw, 2.6rem);
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}
	.dossier-grid > div:last-child {
		border-right: 0;
	}
	.identity-card h3 {
		margin-bottom: 0.35rem;
		font:
			400 clamp(2rem, 4vw, 4rem) Georgia,
			serif;
		letter-spacing: -0.04em;
	}
	.identity-card > p:not(.eyebrow) {
		color: #d9b875;
		font-size: 0.7rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin: 2rem 0 0;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		border-left: 1px solid rgba(255, 255, 255, 0.08);
	}
	dl > div {
		padding: 0.75rem;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	dt,
	.personality-card span,
	.aptitude-card span {
		color: rgba(245, 240, 229, 0.35);
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	dd {
		margin: 0.25rem 0 0;
		font-size: 0.72rem;
		text-transform: capitalize;
	}
	.personality-card {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
		align-content: start;
	}
	.personality-card .eyebrow {
		grid-column: 1/-1;
	}
	.personality-card > div {
		padding: 0.85rem;
		background: rgba(255, 255, 255, 0.035);
	}
	.personality-card span,
	.personality-card strong {
		display: block;
	}
	.personality-card strong {
		margin-top: 0.35rem;
		font-size: 0.76rem;
		text-transform: capitalize;
	}
	.personality-card .habit {
		grid-column: 1/-1;
	}
	.aptitude-card > div {
		display: grid;
		grid-template-columns: 7.6rem 1fr auto;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.8rem;
	}
	.aptitude-card > div > strong {
		color: #76d2e3;
		font-size: 0.58rem;
	}
	.meter {
		height: 0.25rem;
		background: rgba(255, 255, 255, 0.08);
	}
	.meter i {
		display: block;
		width: calc(var(--score) / 9 * 100%);
		height: 100%;
		background: linear-gradient(90deg, #6d5aa8, #d2a04d);
	}
	.aptitude-card > small {
		display: block;
		margin-top: 1.5rem;
		color: rgba(245, 240, 229, 0.42);
		font-size: 0.58rem;
		line-height: 1.65;
	}
	.boundaries {
		display: grid;
		grid-template-columns: 0.9fr 1.1fr;
		gap: 5rem;
		padding: 4rem clamp(1.2rem, 4vw, 4rem) 7rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.boundaries h2 {
		max-width: 35rem;
		font:
			400 clamp(2.3rem, 4vw, 4.5rem)/1 Georgia,
			serif;
	}
	.boundaries ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.boundaries li {
		padding: 1rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		color: rgba(245, 240, 229, 0.56);
		font-size: 0.72rem;
		line-height: 1.6;
	}
	.boundaries li span {
		display: inline-block;
		width: 7rem;
		color: #d2a04d;
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.boundaries > a {
		grid-column: 2;
		display: flex;
		justify-content: space-between;
		padding: 1rem 0;
		color: #76d2e3;
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	@keyframes gate-spin {
		0% {
			transform: scale(0.8) rotate(-30deg);
			opacity: 0.25;
		}
		55% {
			opacity: 1;
		}
		100% {
			transform: scale(1) rotate(120deg);
			opacity: 0.4;
		}
	}
	@keyframes gate-open {
		0%,
		100% {
			transform: scale(0.72);
			box-shadow: 0 0 2rem rgba(113, 86, 185, 0.2);
		}
		55% {
			transform: scale(1.3);
			background: #e5bd77;
			box-shadow: 0 0 7rem rgba(229, 189, 119, 0.8);
		}
	}
	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateY(1rem);
			filter: blur(8px);
		}
		to {
			opacity: 1;
			transform: none;
			filter: none;
		}
	}
	@media (max-width: 900px) {
		.topbar {
			grid-template-columns: 1fr auto;
		}
		.topbar > div {
			display: none;
		}
		.intro {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
		.channels {
			grid-template-columns: 1fr;
		}
		.channels p {
			min-height: 0;
		}
		.gate-stage {
			grid-template-columns: 1fr;
		}
		.gate-machine {
			min-height: 20rem;
		}
		.arrivals {
			grid-template-columns: 1fr;
		}
		.arrivals > button {
			min-height: 26rem;
			border-right: 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		}
		.dossier-grid {
			grid-template-columns: 1fr;
		}
		.dossier-grid > div {
			border-right: 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		}
		.boundaries {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
		.boundaries > a {
			grid-column: 1;
		}
	}
	@media (max-width: 560px) {
		.topbar nav {
			gap: 0.7rem;
			font-size: 0.48rem;
		}
		.section-heading {
			display: block;
		}
		.section-heading > p {
			margin-top: 0.7rem;
			text-align: left;
		}
		h1 {
			font-size: 3.4rem;
		}
		.aptitude-card > div {
			grid-template-columns: 6rem 1fr auto;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			scroll-behavior: auto !important;
			animation-duration: 1ms !important;
			transition-duration: 1ms !important;
		}
	}
</style>
