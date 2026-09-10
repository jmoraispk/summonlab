<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy, tick } from 'svelte';
	import connectionArt from '../../../../../../docs/design-proposals/living-village-ui/mockups/opening-master-connection-desktop.png';
	import arrivalsArt from '../../../../../../docs/design-proposals/living-village-ui/mockups/opening-three-arrivals-desktop.png';
	import weaponsArt from '../../../../../../docs/design-proposals/living-village-ui/mockups/opening-weapon-assignment-desktop.png';
	import objectiveArt from '../../../../../../docs/design-proposals/living-village-ui/mockups/opening-first-tower-objective-desktop.png';
	import { openingHeroes } from './heroes';
	import WeaponGlyph from './WeaponGlyph.svelte';

	type Stage = 'connection' | 'arrivals' | 'weapons' | 'briefing';
	type Weapon = 'sword' | 'spear' | 'bow';

	const weaponOrder = ['sword', 'spear', 'bow'] as const;
	const weaponLabels = { sword: 'Sword', spear: 'Spear', bow: 'Bow' } as const;
	const reasons = [
		'I can hold the front.',
		'I can keep it away from us.',
		'I would rather see it coming.'
	] as const;
	const firstLines = [
		'Where are we?',
		'Something is moving beyond the gate.',
		'Are you the one who brought us here?'
	] as const;
	const quickReplies = [
		{
			label: 'Tell the truth',
			text: 'I summoned you. I know very little, but I will tell you everything I learn.'
		},
		{
			label: 'Reassure them',
			text: 'You are not alone. We will understand this place together.'
		},
		{
			label: 'Give a clear order',
			text: 'Take a weapon and stay together. I will explain while we move.'
		}
	] as const;
	const company = openingHeroes.map((hero, index) => ({
		...hero,
		firstLine: firstLines[index]!,
		reason: reasons[index]!
	}));
	const artByStage = {
		connection: connectionArt,
		arrivals: arrivalsArt,
		weapons: weaponsArt,
		briefing: objectiveArt
	} as const;
	const altByStage = {
		connection: 'An empty stone summoning chamber opens toward a small Village at night.',
		arrivals: 'Three newly summoned adults stand alert inside a softly glowing seal.',
		weapons: 'Three summoned heroes wait behind an engraved weapon-assignment surface.',
		briefing: 'Three equipped heroes face the Village Tower beneath a moonlit breach.'
	} as const;

	let stage = $state<Stage>('connection');
	let reply = $state('');
	let sentReply = $state('');
	let gateSeconds = $state(38);
	let departing = $state(false);
	let replyField = $state<HTMLTextAreaElement>(null!);
	let stageHeading = $state<HTMLElement>(null!);
	let countdownTimer: number | undefined;
	let departureTimer: number | undefined;
	let assignments = $state<Record<string, Weapon>>(
		Object.fromEntries(company.map((hero, index) => [hero.id, weaponOrder[index]!]))
	);

	const stageNumber = $derived(
		stage === 'connection' ? 1 : stage === 'arrivals' ? 2 : stage === 'weapons' ? 3 : 4
	);
	const gateTime = $derived(`00:${gateSeconds.toString().padStart(2, '0')}`);

	onDestroy(() => {
		if (countdownTimer) window.clearInterval(countdownTimer);
		if (departureTimer) window.clearTimeout(departureTimer);
	});

	async function moveTo(nextStage: Stage) {
		stage = nextStage;
		await tick();
		if (nextStage === 'arrivals') replyField?.focus();
		else stageHeading?.focus();
	}

	function beginDanger() {
		if (countdownTimer) return;
		countdownTimer = window.setInterval(() => {
			gateSeconds = Math.max(0, gateSeconds - 1);
			if (gateSeconds === 0 && countdownTimer) {
				window.clearInterval(countdownTimer);
				countdownTimer = undefined;
			}
		}, 1_000);
	}

	async function sendReply(exactText = reply) {
		const cleanReply = exactText.trim();
		if (!cleanReply) return;
		reply = cleanReply;
		sentReply = cleanReply;
		beginDanger();
		await moveTo('weapons');
	}

	function assignWeapon(heroId: string, weapon: Weapon) {
		const currentWeapon = assignments[heroId];
		if (!currentWeapon || currentWeapon === weapon) return;
		const currentHolder = company.find((hero) => assignments[hero.id] === weapon);
		assignments = {
			...assignments,
			[heroId]: weapon,
			...(currentHolder ? { [currentHolder.id]: currentWeapon } : {})
		};
	}

	async function confirmEquipment() {
		if (countdownTimer) {
			window.clearInterval(countdownTimer);
			countdownTimer = undefined;
		}
		await moveTo('briefing');
	}

	async function enterVillage() {
		if (departing) return;
		departing = true;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		departureTimer = window.setTimeout(
			() => void goto(resolve('/village')),
			reducedMotion ? 80 : 720
		);
	}

	async function restart() {
		if (countdownTimer) {
			window.clearInterval(countdownTimer);
			countdownTimer = undefined;
		}
		gateSeconds = 38;
		reply = '';
		sentReply = '';
		assignments = Object.fromEntries(company.map((hero, index) => [hero.id, weaponOrder[index]!]));
		departing = false;
		await moveTo('connection');
	}
</script>

<svelte:head>
	<title>Opening prologue · Living Village</title>
	<meta
		name="description"
		content="Play through the Master connection, first summoning, equipment choice, and Tower purpose."
	/>
</svelte:head>

<main class:departing data-testid="opening-prologue">
	<img
		class="scene-art"
		src={artByStage[stage]}
		alt={altByStage[stage]}
		width="1672"
		height="941"
		draggable="false"
	/>
	<div class="scene-wash" aria-hidden="true"></div>

	<header class="prologue-header">
		<a
			href={resolve('/living-village-lab')}
			class="wordmark"
			aria-label="Return to the prototype screen index">SUMMON<span>LAB</span></a
		>
		<p aria-live="polite">PROLOGUE · {stageNumber}/4</p>
		<button type="button" onclick={restart}>Restart</button>
	</header>

	{#if stage === 'connection'}
		<section class="connection-panel" data-testid="stage-connection">
			<p class="eyebrow">Hearth 01 · Veyrath</p>
			<h1 bind:this={stageHeading} tabindex="-1">You are the Master of this Village.</h1>
			<p>Three people are waiting to be summoned.</p>
			<button class="primary-action" type="button" onclick={() => moveTo('arrivals')}>
				Begin summoning
			</button>
			<small><i></i>Outer seal: weakening</small>
		</section>
	{:else if stage === 'arrivals'}
		<section class="conversation-panel" data-testid="stage-arrivals">
			<h1 bind:this={stageHeading} tabindex="-1" class="visually-hidden">Three people arrive</h1>
			<div class="first-voices">
				{#each company as hero (hero.id)}
					<article>
						<div class="portrait-crop"><img src={hero.portrait} alt="" /></div>
						<div>
							<strong>{hero.name}</strong>
							<p>{hero.firstLine}</p>
						</div>
					</article>
				{/each}
			</div>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void sendReply();
				}}
			>
				<label for="master-reply">Explain what you know</label>
				<div class="reply-row">
					<textarea
						bind:this={replyField}
						id="master-reply"
						bind:value={reply}
						maxlength="360"
						placeholder="Speak to all three heroes…"></textarea>
					<button type="submit" disabled={!reply.trim()} aria-label="Send reply">Send</button>
				</div>
			</form>
			<div class="quick-replies" aria-label="Quick replies">
				{#each quickReplies as quickReply (quickReply.label)}
					<button type="button" onclick={() => sendReply(quickReply.text)}
						>{quickReply.label}</button
					>
				{/each}
			</div>
			<p class="quiet-status"><i></i>Threat clock begins after your reply</p>
		</section>
	{:else if stage === 'weapons'}
		<section class="equipment-panel" data-testid="stage-weapons">
			<header>
				<div>
					<p class="eyebrow">First decision</p>
					<h1 bind:this={stageHeading} tabindex="-1">Choose their weapons</h1>
				</div>
				<p class="danger-clock"><span>Gate breach</span><strong>{gateTime}</strong></p>
			</header>
			<p class="master-echo"><span>You told them</span>“{sentReply}”</p>
			<div class="equipment-grid">
				{#each company as hero (hero.id)}
					{@const currentWeapon = assignments[hero.id]!}
					<article class="equipment-card" class:selected={hero.id === company[0]?.id}>
						<header>
							<div class="portrait-crop"><img src={hero.portrait} alt="" /></div>
							<strong>{hero.name}</strong>
						</header>
						<div class="weapon-art" data-testid={`weapon-${hero.id}`}>
							<span>{weaponLabels[currentWeapon]}</span>
							<WeaponGlyph kind={currentWeapon} label={weaponLabels[currentWeapon]} />
						</div>
						<blockquote>“{hero.reason}”</blockquote>
						<div class="weapon-options" aria-label={`Weapon for ${hero.name}`}>
							{#each weaponOrder as weapon (weapon)}
								<button
									type="button"
									class:active={weapon === currentWeapon}
									aria-pressed={weapon === currentWeapon}
									onclick={() => assignWeapon(hero.id, weapon)}
								>
									{weaponLabels[weapon]}
								</button>
							{/each}
						</div>
					</article>
				{/each}
			</div>
			<footer>
				<p>Master decides the final assignment.</p>
				<button class="primary-action" type="button" onclick={confirmEquipment}>
					Confirm equipment
				</button>
			</footer>
		</section>
	{:else}
		<section class="briefing-panel" data-testid="stage-briefing">
			<p class="eyebrow">After the first defense</p>
			<h1 bind:this={stageHeading} tabindex="-1">The Tower holds the breach</h1>
			<div class="premise">
				<p>Its seals are failing.</p>
				<p>Reclaim each floor to hold back the invasions.</p>
				<p>Reach the summit to close the breach.</p>
			</div>
			<div class="tower-track" aria-label="Tower progress, Floor 01 ready">
				<span class="summit">Summit</span>
				<i></i><i></i><i></i><i class="active"></i>
				<strong>Floor 01</strong>
			</div>
			<section class="first-objective">
				<p class="eyebrow">First objective</p>
				<h2>Recover the First Ember</h2>
				<div class="ready-party" aria-label="Three ready heroes">
					{#each company as hero (hero.id)}
						<div class="portrait-crop" title={hero.name}>
							<img src={hero.portrait} alt={hero.name} />
						</div>
					{/each}
					<span>Three ready</span>
				</div>
			</section>
			<button class="primary-action" type="button" onclick={enterVillage} disabled={departing}>
				{departing ? 'Entering…' : 'Enter Village'}
			</button>
		</section>
	{/if}
</main>

<style>
	:global(html) {
		background: #05080a;
	}

	:global(body) {
		margin: 0;
		background: #05080a;
		color: #ede4d4;
	}

	:global(*) {
		box-sizing: border-box;
	}

	button,
	a,
	textarea {
		font: inherit;
	}

	button,
	a {
		cursor: pointer;
	}

	button:focus-visible,
	a:focus-visible,
	textarea:focus-visible,
	[tabindex='-1']:focus-visible {
		outline: 2px solid #69d6e6;
		outline-offset: 3px;
	}

	main {
		position: relative;
		min-height: 100svh;
		overflow: hidden;
		isolation: isolate;
		font-family: Georgia, 'Times New Roman', serif;
	}

	.scene-art,
	.scene-wash {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.scene-art {
		z-index: -3;
		object-fit: cover;
		object-position: center;
		filter: saturate(0.9) contrast(1.02);
		animation: scene-arrive 480ms ease-out both;
	}

	.scene-wash {
		z-index: -2;
		pointer-events: none;
		background: linear-gradient(180deg, rgba(3, 6, 8, 0.4), transparent 18%, rgba(3, 6, 8, 0.12));
	}

	.prologue-header {
		position: relative;
		z-index: 10;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		min-height: 4.7rem;
		padding: 0.8rem clamp(1rem, 3vw, 3.2rem);
		border-bottom: 1px solid rgba(208, 163, 93, 0.28);
		background: linear-gradient(180deg, rgba(3, 7, 9, 0.98), rgba(3, 7, 9, 0.84));
		backdrop-filter: blur(0.45rem);
	}

	.wordmark {
		justify-self: start;
		color: #e8ddca;
		font-size: 1rem;
		letter-spacing: 0.2em;
		text-decoration: none;
	}

	.wordmark span,
	.eyebrow,
	.danger-clock strong {
		color: #d2a35e;
	}

	.prologue-header > p,
	.prologue-header button,
	.quiet-status,
	.master-echo > span,
	.weapon-options button,
	.ready-party span {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.prologue-header > p {
		margin: 0;
		color: #a9a092;
		font-size: 0.68rem;
		letter-spacing: 0.16em;
	}

	.prologue-header button {
		justify-self: end;
		padding: 0.55rem 0.75rem;
		border: 1px solid rgba(210, 163, 94, 0.38);
		border-radius: 0.15rem;
		background: rgba(4, 9, 11, 0.72);
		color: #c7bba9;
		font-size: 0.67rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.prologue-header button:hover {
		border-color: #d2a35e;
		color: #fff4df;
	}

	.connection-panel,
	.conversation-panel,
	.equipment-panel,
	.briefing-panel {
		animation: panel-arrive 360ms ease-out both;
	}

	.connection-panel {
		position: absolute;
		left: 0;
		bottom: clamp(3.5rem, 7vh, 6rem);
		width: min(46rem, calc(100% - 1rem));
		padding: clamp(1.4rem, 2.7vw, 2.4rem) clamp(1.4rem, 5vw, 5rem);
		border: 1px solid rgba(210, 163, 94, 0.62);
		background: linear-gradient(135deg, #05090b, #081013);
		box-shadow: 0 1.8rem 5rem rgba(0, 0, 0, 0.48);
	}

	.eyebrow {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	h1,
	h2,
	p {
		text-wrap: balance;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.8rem, 3.2vw, 3.7rem);
		font-weight: 400;
		line-height: 1.03;
	}

	.connection-panel h1 {
		margin-top: 1rem;
		font-size: clamp(1.55rem, 2.6vw, 2.65rem);
	}

	.connection-panel > p:not(.eyebrow) {
		margin: 0.75rem 0 1.4rem;
		color: #ada597;
		font-size: 1.05rem;
	}

	.primary-action {
		min-height: 3.55rem;
		padding: 0.9rem 1.4rem;
		border: 1px solid #d2a35e;
		border-radius: 0.16rem;
		background: linear-gradient(180deg, rgba(17, 53, 64, 0.97), rgba(6, 30, 38, 0.98));
		box-shadow: inset 0 0 0 3px rgba(210, 163, 94, 0.12);
		color: #f0c87f;
		font-size: 1rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		transition:
			border-color 160ms ease,
			color 160ms ease,
			transform 160ms ease;
	}

	.primary-action:hover:not(:disabled) {
		border-color: #70d8e8;
		color: #d9f9ff;
		transform: translateY(-1px);
	}

	.primary-action:disabled {
		cursor: wait;
		opacity: 0.68;
	}

	.connection-panel > small {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 1.2rem;
		color: #8f887e;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
	}

	.connection-panel > small i,
	.quiet-status i {
		width: 0.38rem;
		height: 0.38rem;
		border-radius: 50%;
		background: #d2a35e;
		box-shadow: 0 0 0.8rem rgba(210, 163, 94, 0.65);
	}

	.conversation-panel {
		position: absolute;
		inset: auto 0 0;
		padding: clamp(1rem, 2vw, 1.6rem) clamp(1rem, 4.5vw, 4.5rem);
		border: 1px solid rgba(210, 163, 94, 0.5);
		background: linear-gradient(135deg, #05090b, #081013);
		box-shadow: 0 1.8rem 5rem rgba(0, 0, 0, 0.5);
	}

	.first-voices {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}

	.first-voices article {
		display: grid;
		grid-template-columns: 4.4rem 1fr;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
	}

	.portrait-crop {
		position: relative;
		flex: none;
		overflow: hidden;
		aspect-ratio: 1;
		border: 1px solid rgba(210, 163, 94, 0.55);
		border-radius: 50%;
		background: #0b1114;
	}

	.portrait-crop img {
		position: absolute;
		top: -9%;
		left: -35%;
		width: 170%;
		height: auto;
	}

	.first-voices .portrait-crop {
		width: 4.4rem;
	}

	.first-voices strong {
		color: #d2a35e;
		font-size: 0.8rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.first-voices p {
		margin: 0.35rem 0 0;
		color: #e0d7c9;
		font-size: clamp(0.84rem, 1.1vw, 1.05rem);
	}

	.conversation-panel form {
		margin-top: 1rem;
	}

	.conversation-panel label {
		display: block;
		margin-bottom: 0.35rem;
		color: #a9a092;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.reply-row {
		display: grid;
		grid-template-columns: 1fr auto;
		border: 1px solid rgba(210, 163, 94, 0.42);
		background: rgba(2, 6, 8, 0.8);
	}

	textarea {
		min-height: 3rem;
		resize: none;
		border: 0;
		background: transparent;
		color: #f1e9dc;
		padding: 0.85rem;
		line-height: 1.35;
	}

	textarea::placeholder {
		color: #746f68;
	}

	.reply-row button {
		min-width: 5.4rem;
		border: 0;
		border-left: 1px solid rgba(210, 163, 94, 0.42);
		background: rgba(28, 66, 76, 0.54);
		color: #bceef5;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.reply-row button:disabled {
		cursor: not-allowed;
		opacity: 0.42;
	}

	.quick-replies {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.65rem;
		margin-top: 0.65rem;
	}

	.quick-replies button,
	.weapon-options button {
		min-height: 2.6rem;
		border: 1px solid rgba(210, 163, 94, 0.34);
		border-radius: 0.12rem;
		background: rgba(5, 11, 14, 0.84);
		color: #d5cabb;
	}

	.quick-replies button:hover,
	.weapon-options button:hover,
	.weapon-options button.active {
		border-color: #62ccdd;
		background: rgba(24, 88, 101, 0.28);
		color: #d8f9ff;
	}

	.quiet-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.8rem 0 0;
		color: #8e8981;
		font-size: 0.64rem;
	}

	.equipment-panel {
		position: absolute;
		inset: clamp(12rem, 28vh, 18rem) 0 0;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		padding: clamp(1rem, 2vw, 1.65rem);
		border: 1px solid rgba(210, 163, 94, 0.6);
		background: linear-gradient(135deg, #05090b, #081013);
		box-shadow: 0 2rem 6rem rgba(0, 0, 0, 0.62);
	}

	.equipment-panel > header,
	.equipment-panel > footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.equipment-panel h1 {
		margin-top: 0.3rem;
		font-size: clamp(1.75rem, 3vw, 3.2rem);
	}

	.danger-clock {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.danger-clock span {
		color: #9d958a;
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.danger-clock strong {
		font-size: 1.25rem;
		font-weight: 500;
	}

	.master-echo {
		overflow: hidden;
		margin: 0.8rem 0;
		color: #b6ada0;
		font-size: 0.82rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.master-echo > span {
		margin-right: 0.65rem;
		color: #5fcddd;
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.equipment-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
		min-height: 0;
	}

	.equipment-card {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto auto;
		min-width: 0;
		padding: clamp(0.75rem, 1.4vw, 1.15rem);
		border: 1px solid rgba(210, 163, 94, 0.35);
		background: rgba(8, 15, 18, 0.78);
	}

	.equipment-card.selected {
		border-color: rgba(84, 206, 225, 0.72);
		box-shadow: inset 0 0 0 2px rgba(84, 206, 225, 0.08);
	}

	.equipment-card > header {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.equipment-card > header .portrait-crop {
		width: 2.8rem;
	}

	.equipment-card > header strong {
		font-size: 1.05rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.weapon-art {
		display: grid;
		place-items: center;
		align-content: center;
		min-height: 7.5rem;
		color: #d7c3a3;
	}

	.weapon-art span {
		font-size: clamp(1.05rem, 2vw, 1.65rem);
		text-transform: uppercase;
	}

	.equipment-card blockquote {
		min-height: 2.4rem;
		margin: 0 0 0.7rem;
		color: #b4aa9d;
		font-size: 0.8rem;
		text-align: center;
	}

	.weapon-options {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.3rem;
	}

	.weapon-options button {
		min-width: 0;
		padding: 0.45rem 0.25rem;
		font-size: 0.58rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.equipment-panel > footer {
		padding-top: 0.85rem;
	}

	.equipment-panel > footer p {
		margin: 0;
		color: #a59c90;
		font-size: 0.83rem;
	}

	.equipment-panel > footer .primary-action {
		min-width: min(25rem, 48vw);
	}

	.briefing-panel {
		position: absolute;
		top: 4.7rem;
		right: 0;
		bottom: 0;
		width: min(34rem, 38vw);
		display: flex;
		flex-direction: column;
		padding: clamp(1.3rem, 2.6vw, 2.6rem);
		border-left: 1px solid rgba(210, 163, 94, 0.64);
		background: linear-gradient(145deg, #05090b, #081013 70%, #06141a);
		box-shadow: -2rem 0 6rem rgba(0, 0, 0, 0.36);
	}

	.briefing-panel h1 {
		margin-top: 0.6rem;
		font-size: clamp(2rem, 3.4vw, 3.7rem);
	}

	.premise {
		margin-top: 1.2rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid rgba(210, 163, 94, 0.25);
	}

	.premise p {
		margin: 0.35rem 0;
		color: #c8bfb2;
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.tower-track {
		display: grid;
		grid-template-columns: 1fr repeat(4, auto) 1fr;
		align-items: center;
		gap: 0.5rem;
		margin-block: 1.3rem;
		color: #786f64;
	}

	.tower-track i {
		width: 0.65rem;
		height: 0.65rem;
		border: 1px solid currentColor;
		transform: rotate(45deg);
	}

	.tower-track i.active {
		color: #5fcddd;
		background: #5fcddd;
		box-shadow: 0 0 1rem rgba(95, 205, 221, 0.6);
	}

	.tower-track .summit,
	.tower-track strong {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.tower-track strong {
		justify-self: end;
		color: #5fcddd;
		font-weight: 600;
	}

	.first-objective {
		margin-top: auto;
		padding: 1.2rem;
		border: 1px solid rgba(210, 163, 94, 0.35);
		background: rgba(12, 21, 24, 0.66);
	}

	.first-objective h2 {
		margin: 0.35rem 0 1rem;
		font-size: clamp(1.45rem, 2.25vw, 2.25rem);
		font-weight: 400;
	}

	.ready-party {
		display: flex;
		align-items: center;
	}

	.ready-party .portrait-crop {
		width: 2.65rem;
		margin-right: -0.35rem;
	}

	.ready-party span {
		margin-left: 0.9rem;
		color: #5fcddd;
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.briefing-panel > .primary-action {
		width: 100%;
		margin-top: 1rem;
	}

	.departing .scene-art,
	.departing .briefing-panel {
		filter: brightness(1.35);
		opacity: 0;
		transform: scale(1.015);
		transition:
			filter 720ms ease,
			opacity 720ms ease,
			transform 720ms ease;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		clip-path: inset(50%);
	}

	@keyframes panel-arrive {
		from {
			transform: translateY(0.7rem);
		}
	}

	@keyframes scene-arrive {
		from {
			opacity: 0.45;
			transform: scale(1.008);
		}
	}

	@media (max-width: 860px) {
		main {
			min-height: 100svh;
			overflow-y: auto;
		}

		.scene-art,
		.scene-wash {
			position: fixed;
		}

		.scene-art {
			object-position: center top;
		}

		.prologue-header {
			grid-template-columns: 1fr auto 1fr;
			min-height: 4.2rem;
		}

		.prologue-header > p {
			font-size: 0.58rem;
			letter-spacing: 0.09em;
		}

		.connection-panel,
		.conversation-panel,
		.equipment-panel,
		.briefing-panel {
			position: relative;
			inset: auto;
			width: auto;
			margin: min(45svh, 27rem) 0.65rem 4.8rem;
		}

		.first-voices,
		.equipment-grid {
			grid-template-columns: 1fr;
		}

		.first-voices {
			gap: 0.7rem;
		}

		.first-voices article {
			grid-template-columns: 3.5rem 1fr;
		}

		.first-voices .portrait-crop {
			width: 3.5rem;
		}

		.quick-replies {
			grid-template-columns: 1fr;
		}

		.equipment-panel {
			display: block;
		}

		.master-echo {
			white-space: normal;
		}

		.equipment-grid {
			display: grid;
		}

		.equipment-card {
			margin-top: 0.65rem;
		}

		.equipment-panel > footer {
			align-items: stretch;
			flex-direction: column;
		}

		.equipment-panel > footer .primary-action {
			width: 100%;
			min-width: 0;
		}

		.briefing-panel {
			display: flex;
		}
	}

	@media (max-width: 520px) {
		.wordmark {
			font-size: 0.78rem;
		}

		.prologue-header {
			padding-inline: 0.75rem;
		}

		.prologue-header button {
			min-height: 2.7rem;
		}

		.reply-row {
			grid-template-columns: 1fr;
		}

		.reply-row button {
			min-height: 2.8rem;
			border-top: 1px solid rgba(210, 163, 94, 0.42);
			border-left: 0;
		}

		.equipment-panel > header {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			scroll-behavior: auto !important;
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
