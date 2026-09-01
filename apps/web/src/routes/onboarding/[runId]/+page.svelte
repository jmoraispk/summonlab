<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import HeroArtPlaceholder from '$lib/components/HeroArtPlaceholder.svelte';
	import PlayerMenu from '$lib/components/PlayerMenu.svelte';
	import { trackPlaytestEvent } from '$lib/playtest-analytics';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let view = $state(data.view);
	let selectedOrdinal = $state(1);
	let question = $state('What do you need to understand before you can decide what comes next?');
	let direction = $state('Choose what you need before we enter the tower.');
	let pending = $state(false);
	let errorMessage = $state('');
	const selected = $derived(view.heroes.find((hero) => hero.ordinal === selectedOrdinal)!);
	const selectedPortrait = $derived(
		data.heroPortraits.find((portrait) => portrait.manifestHash === selected.draft.manifestHash)
	);
	const replyCount = $derived(view.heroes.filter((hero) => hero.firstReply !== null).length);
	const allAnswered = $derived(replyCount === view.heroes.length);
	const stars = (count: number) => '✦'.repeat(count);
	const words = (value: string) => value.replaceAll('-', ' ');

	function selectHero(ordinal: number) {
		selectedOrdinal = ordinal;
	}

	function handleHeroTabKeydown(event: KeyboardEvent, ordinal: number) {
		const index = view.heroes.findIndex((hero) => hero.ordinal === ordinal);
		if (index < 0) return;
		const nextIndex =
			event.key === 'ArrowRight' || event.key === 'ArrowDown'
				? (index + 1) % view.heroes.length
				: event.key === 'ArrowLeft' || event.key === 'ArrowUp'
					? (index - 1 + view.heroes.length) % view.heroes.length
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? view.heroes.length - 1
							: null;
		if (nextIndex === null) return;
		event.preventDefault();
		selectedOrdinal = view.heroes[nextIndex]!.ordinal;
		const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
			'[role="tab"]'
		);
		tabs?.[nextIndex]?.focus();
	}

	async function refreshView() {
		const response = await fetch(`/api/campaigns/${view.campaign.runId}`);
		if (!response.ok) throw new Error('The chronicle could not be refreshed.');
		view = (await response.json()) as typeof view;
	}

	async function advance(step: number) {
		pending = true;
		errorMessage = '';
		try {
			const response = await fetch(`/api/campaigns/${view.campaign.runId}/onboarding`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ step })
			});
			const body = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(body.message ?? 'The gate did not answer.');
			await refreshView();
			await trackPlaytestEvent({
				eventType: 'onboarding_step_completed',
				route: 'onboarding',
				runId: view.campaign.runId,
				step
			});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The gate did not answer.';
		} finally {
			pending = false;
		}
	}

	async function askHero() {
		if (pending || selected.firstReply || !question.trim()) return;
		pending = true;
		errorMessage = '';
		try {
			const response = await fetch(`/api/runs/${view.campaign.runId}/conversations`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					targetHeroId: selected.draft.manifest.characterId,
					kind: 'ask',
					exactText: question.trim(),
					tone: 'reassuring',
					delivery: 'private',
					orderIntent: null
				})
			});
			const body = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(body.message ?? 'The hero did not answer.');
			await refreshView();
			const next = view.heroes.find((hero) => !hero.firstReply);
			if (next) selectedOrdinal = next.ordinal;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The hero did not answer.';
		} finally {
			pending = false;
		}
	}

	async function enterHearth() {
		if (!allAnswered || pending) return;
		pending = true;
		errorMessage = '';
		try {
			const decision = await fetch(`/api/runs/${view.campaign.runId}/decide`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					directive: direction.trim(),
					trigger: 'step'
				})
			});
			const decisionBody = (await decision.json()) as {
				destination?: 'kitchen' | 'training-ground';
				message?: string;
			};
			if (!decision.ok) throw new Error(decisionBody.message ?? 'No first choice was recorded.');
			const completion = await fetch(`/api/campaigns/${view.campaign.runId}/onboarding`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ step: 3 })
			});
			const completionBody = (await completion.json()) as { message?: string };
			if (!completion.ok) throw new Error(completionBody.message ?? 'The prologue stayed open.');
			const arrival = await fetch(`/api/runs/${view.campaign.runId}/arrive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}'
			});
			const arrivalBody = (await arrival.json()) as { message?: string };
			if (!arrival.ok)
				throw new Error(arrivalBody.message ?? 'The company could not enter Hearth.');
			await trackPlaytestEvent({
				eventType: 'onboarding_step_completed',
				route: 'onboarding',
				runId: view.campaign.runId,
				step: 3
			});
			if (decisionBody.destination) {
				await trackPlaytestEvent({
					eventType: 'hearth_entered',
					route: 'hearth',
					runId: view.campaign.runId,
					destination: decisionBody.destination
				});
			}
			await goto(resolve('/play/[runId]', { runId: view.campaign.runId }));
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'The company could not enter Hearth 01.';
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>Summonlab · The last reserve</title>
	<meta name="description" content="Wake Hearth 01 and meet the first autonomous company." />
</svelte:head>

<main class:gate-open={view.campaign.onboardingStep >= 2} data-testid="campaign-onboarding">
	<div class="stone"></div>
	<div class="ash"></div>
	<header>
		<a href={resolve('/')}>SUMMON<span>LAB</span></a>
		<div data-testid="onboarding-step">PROLOGUE · {view.campaign.onboardingStep + 1}/4</div>
		<p>Seed / {view.campaign.campaignSeed}</p>
	</header>

	{#if view.campaign.onboardingStep === 0}
		<section class="wake panel">
			<div class="first-person-hands" aria-hidden="true"><i></i><i></i></div>
			<div class="signal"><span></span><b>RESERVE POWER · 03%</b></div>
			<p class="eyebrow">First objective · reach the gate</p>
			<h1>WAKE THE LAST<br /><em>SUMMONING GATE.</em></h1>
			<p class="narrative">
				You are alone in Hearth 01. The settlement has enough reserve power for one action: summon
				three adults who can help restore it. They will arrive without memories or allegiance.
			</p>
			<button
				type="button"
				onclick={() => advance(1)}
				disabled={pending}
				data-testid="answer-reserve-bell"
				data-sound-cue="bell"
			>
				Go to the summoning gate <span>→</span>
			</button>
		</section>
	{:else if view.campaign.onboardingStep === 1}
		<section class="gate panel">
			<div class="gate-machine" aria-hidden="true">
				<div class="ring outer"></div>
				<div class="ring inner"></div>
				<div class="black-sun"></div>
			</div>
			<div class="gate-copy">
				<p class="eyebrow">Summoning gate · three arrivals</p>
				<h1>SUMMON YOUR<br /><em>FIRST COMPANY.</em></h1>
				<p class="narrative">
					The gate will bring three stable adult heroes from this seed. They arrive with bodies,
					instincts, skills, and personalities—but no past, shared context, or reason to obey you.
				</p>
				<button
					type="button"
					onclick={() => advance(2)}
					disabled={pending}
					data-testid="open-summoning-gate"
					data-sound-cue="gate"
				>
					Summon three heroes <span>→</span>
				</button>
			</div>
		</section>
	{:else}
		<section class="company panel">
			<div class="company-heading">
				<div>
					<p class="eyebrow">Summoning complete · click a hero</p>
					<h1>THREE PEOPLE<br /><em>NEED ANSWERS.</em></h1>
				</div>
				<p aria-live="polite">{replyCount}/3 first voices witnessed</p>
			</div>

			<div class="hero-tabs" role="tablist" aria-label="Summoned heroes">
				{#each view.heroes as hero (hero.draft.manifest.characterId)}
					{@const portrait = data.heroPortraits.find(
						(entry) => entry.manifestHash === hero.draft.manifestHash
					)}
					<button
						class:selected={selectedOrdinal === hero.ordinal}
						class:answered={hero.firstReply !== null}
						type="button"
						onclick={() => selectHero(hero.ordinal)}
						oncontextmenu={(event) => {
							event.preventDefault();
							selectHero(hero.ordinal);
						}}
						onkeydown={(event) => handleHeroTabKeydown(event, hero.ordinal)}
						role="tab"
						id={`hero-tab-${hero.ordinal}`}
						aria-selected={selectedOrdinal === hero.ordinal}
						aria-controls={`hero-panel-${hero.ordinal}`}
						tabindex={selectedOrdinal === hero.ordinal ? 0 : -1}
						data-testid="campaign-hero"
						title={`Inspect ${hero.draft.manifest.displayName}`}
					>
						{#if portrait?.roster}
							<img
								src={portrait.roster.publicPath}
								width={portrait.roster.width}
								height={portrait.roster.height}
								alt=""
							/>
						{:else}
							<div
								class="tab-art-pending"
								role="img"
								aria-label={`${hero.draft.manifest.displayName} portrait pending`}
							>
								<span aria-hidden="true">✦</span>
							</div>
						{/if}
						<span>0{hero.ordinal}</span>
						<div>
							<strong>{hero.draft.manifest.displayName}</strong><small
								>{stars(hero.draft.manifest.rarityStars)}
								{hero.firstReply ? '· answered' : '· waiting'}</small
							>
						</div>
					</button>
				{/each}
			</div>

			<div class="hero-focus">
				<div class="portrait">
					{#key selected.draft.manifestHash}
						<div class="gate-glow"></div>
						{#if selectedPortrait?.summon}
							<img
								src={selectedPortrait.summon.publicPath}
								width={selectedPortrait.summon.width}
								height={selectedPortrait.summon.height}
								alt={`${selected.draft.manifest.displayName}, newly summoned at the gate`}
								data-testid="summoned-hero-portrait"
							/>
						{:else}
							<HeroArtPlaceholder name={selected.draft.manifest.displayName} />
						{/if}
					{/key}
				</div>
				<div
					class="dossier"
					role="tabpanel"
					id={`hero-panel-${selected.ordinal}`}
					aria-labelledby={`hero-tab-${selected.ordinal}`}
				>
					<div class="identity">
						<div>
							<span>Summon 0{selected.ordinal}</span>
							<h2>{selected.draft.manifest.displayName}</h2>
						</div>
						<b>{stars(selected.draft.manifest.rarityStars)}</b>
					</div>
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
							<dd>{selected.draft.manifest.bodyBuild}</dd>
						</div>
						<div>
							<dt>Voice</dt>
							<dd>{selected.draft.manifest.voice.cadence}</dd>
						</div>
					</dl>
					<section class="mind" aria-label="Observable personality">
						<p class="eyebrow">Observable mind · no hidden reasoning</p>
						<div><span>Values</span><strong>{words(selected.draft.mind.primaryValue)}</strong></div>
						<div>
							<span>Driven to</span><strong>{words(selected.draft.mind.primaryDrive)}</strong>
						</div>
						<div>
							<span>Social style</span><strong>{words(selected.draft.mind.socialStyle)}</strong>
						</div>
						<div>
							<span>Daily habit</span><strong>{words(selected.draft.mind.dailyHabit)}</strong>
						</div>
						<div>
							<span>Under stress</span><strong>{words(selected.draft.mind.stressResponse)}</strong>
						</div>
					</section>

					{#if selected.firstReply}
						<blockquote data-testid="first-reply">
							<p>“{selected.firstReply.exactText}”</p>
							<footer>{selected.firstReply.publicReason}</footer>
						</blockquote>
					{:else}
						<label for="first-question">Your first question</label>
						<textarea id="first-question" bind:value={question} maxlength="600"></textarea>
						<button
							class="ask"
							type="button"
							onclick={askHero}
							disabled={pending || !question.trim()}
							data-testid="ask-first-question"
							data-sound-cue="voice"
						>
							{pending ? 'Listening…' : `Ask ${selected.draft.manifest.displayName}`}
						</button>
					{/if}
				</div>
			</div>

			<div class="enter-row">
				<div class="first-direction">
					<label for="first-direction">Your first direction to the company</label>
					<textarea id="first-direction" bind:value={direction} maxlength="600"></textarea>
					<p>They decide how to act on it. Agreement is not guaranteed.</p>
				</div>
				<button
					type="button"
					disabled={!allAnswered || !direction.trim() || pending}
					onclick={enterHearth}
					data-testid="enter-hearth"
					data-sound-cue="threshold"
				>
					Issue direction and enter Hearth <span>→</span>
				</button>
			</div>
		</section>
	{/if}

	{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
	<PlayerMenu runId={view.campaign.runId} initialObjectives={view.objectives} />
</main>

<style>
	:global(body) {
		background: #080806;
		color: #f3e7ce;
	}
	main {
		position: relative;
		min-height: 100svh;
		overflow: hidden;
		background:
			radial-gradient(circle at 50% 42%, rgba(133, 51, 22, 0.16), transparent 30rem), #080806;
		isolation: isolate;
	}
	.stone {
		position: absolute;
		inset: 0;
		z-index: -3;
		opacity: 0.28;
		background:
			repeating-linear-gradient(91deg, transparent 0 8rem, rgba(234, 212, 174, 0.03) 8rem 8.08rem),
			repeating-linear-gradient(1deg, transparent 0 5rem, rgba(234, 212, 174, 0.025) 5rem 5.06rem);
	}
	.ash {
		position: absolute;
		inset: 0;
		z-index: -2;
		pointer-events: none;
		background: radial-gradient(circle at 50% 50%, transparent, rgba(0, 0, 0, 0.72));
	}
	main > header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 1.1rem clamp(1rem, 4vw, 4rem);
		border-bottom: 1px solid rgba(241, 205, 145, 0.12);
	}
	header a {
		color: #f3e7ce;
		font:
			0.88rem Georgia,
			serif;
		letter-spacing: 0.16em;
		text-decoration: none;
	}
	header a span {
		color: #c06131;
	}
	header div,
	header p {
		color: rgba(243, 231, 206, 0.42);
		font:
			0.56rem ui-monospace,
			monospace;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	header p {
		margin: 0;
		text-align: right;
	}
	.panel {
		box-sizing: border-box;
		width: min(74rem, calc(100% - 2rem));
		min-height: calc(100svh - 4rem);
		margin: 0 auto;
		padding-bottom: 7rem;
	}
	.wake {
		position: relative;
		display: grid;
		align-content: center;
		max-width: 58rem;
	}
	.signal {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		margin-bottom: 2.5rem;
		color: #d06d39;
		font:
			0.6rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
	}
	.signal span {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #d06d39;
		box-shadow: 0 0 1.2rem #d06d39;
		animation: pulse 1.2s infinite;
	}
	.eyebrow {
		margin: 0 0 0.8rem;
		color: #c46a39;
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font:
			clamp(3.2rem, 7vw, 7rem)/0.88 Georgia,
			serif;
		font-weight: 400;
		letter-spacing: -0.06em;
	}
	h1 em {
		color: #d5a166;
		font-weight: 400;
	}
	.narrative {
		max-width: 42rem;
		margin: 1.7rem 0;
		color: rgba(243, 231, 206, 0.62);
		font:
			1rem/1.7 Georgia,
			serif;
	}
	.panel > button,
	.gate-copy button,
	.enter-row button {
		justify-self: start;
		padding: 1rem 1.25rem;
		border: 1px solid #be5c2c;
		background: #96341d;
		color: #fff4dd;
		font:
			0.64rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}
	button span {
		color: #e7b16e;
	}
	.first-person-hands i {
		position: absolute;
		bottom: -10rem;
		width: 12rem;
		height: 27rem;
		border-radius: 50% 50% 12% 12%;
		background: linear-gradient(#9b6246, #44271f);
		filter: blur(1px);
		opacity: 0.42;
	}
	.first-person-hands i:first-child {
		left: -7rem;
		transform: rotate(-24deg);
	}
	.first-person-hands i:last-child {
		right: -7rem;
		transform: rotate(24deg);
	}
	.gate {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: clamp(2rem, 6vw, 7rem);
		align-items: center;
	}
	.gate-machine {
		position: relative;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
	}
	.ring {
		position: absolute;
		border-radius: 50%;
		border: 1px solid rgba(226, 129, 58, 0.68);
		box-shadow:
			inset 0 0 4rem rgba(168, 47, 19, 0.18),
			0 0 4rem rgba(168, 47, 19, 0.18);
		animation: turn 18s linear infinite;
	}
	.ring.outer {
		inset: 5%;
		border-style: dashed;
	}
	.ring.inner {
		inset: 17%;
		animation-direction: reverse;
		animation-duration: 11s;
	}
	.black-sun {
		width: 55%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			#050505 48%,
			#be5426 51%,
			rgba(204, 94, 37, 0.18) 56%,
			transparent 71%
		);
		box-shadow: 0 0 7rem rgba(192, 70, 29, 0.3);
	}
	.company {
		padding: 2.4rem 0 7rem;
	}
	.company-heading {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: end;
		margin-bottom: 1.4rem;
	}
	.company-heading h1 {
		font-size: clamp(2.4rem, 4.4vw, 4.5rem);
	}
	.company-heading > p {
		color: rgba(243, 231, 206, 0.45);
		font:
			0.6rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	.hero-tabs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border: 1px solid rgba(237, 198, 130, 0.13);
	}
	.hero-tabs button {
		display: grid;
		grid-template-columns: 3rem auto 1fr;
		align-items: center;
		gap: 0.15rem 0.8rem;
		padding: 0.55rem 0.75rem;
		border: 0;
		border-right: 1px solid rgba(237, 198, 130, 0.13);
		background: rgba(255, 255, 255, 0.02);
		color: rgba(243, 231, 206, 0.5);
		text-align: left;
		cursor: pointer;
	}
	.hero-tabs button:last-child {
		border-right: 0;
	}
	.hero-tabs button.selected {
		background: rgba(162, 58, 24, 0.22);
		color: #f3e7ce;
		box-shadow: inset 0 -2px #bf5b2c;
	}
	.hero-tabs button.answered small {
		color: #6fba8b;
	}
	.hero-tabs button > img {
		width: 3rem;
		height: 3.6rem;
		border: 1px solid rgba(237, 198, 130, 0.14);
		object-fit: cover;
		object-position: 50% 14%;
	}
	.hero-tabs .tab-art-pending {
		display: grid;
		width: 3rem;
		height: 3.6rem;
		place-items: center;
		border: 1px solid rgba(237, 198, 130, 0.24);
		color: #d5aa59;
		background: radial-gradient(circle, rgba(213, 170, 89, 0.13), transparent 58%), #090b10;
	}
	.hero-tabs .tab-art-pending span {
		font-size: 1rem;
	}
	.hero-tabs button > span {
		align-self: center;
		font:
			1.2rem Georgia,
			serif;
	}
	.hero-tabs button > div {
		display: grid;
		gap: 0.25rem;
	}
	.hero-tabs strong {
		font:
			0.95rem Georgia,
			serif;
		font-weight: 400;
	}
	.hero-tabs small {
		font:
			0.54rem ui-monospace,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.hero-focus {
		display: grid;
		grid-template-columns: minmax(18rem, 0.8fr) minmax(22rem, 1.2fr);
		min-height: 32rem;
		border: 1px solid rgba(237, 198, 130, 0.13);
		border-top: 0;
		background: rgba(6, 6, 5, 0.72);
	}
	.portrait {
		position: relative;
		overflow: hidden;
		display: grid;
		place-items: end center;
		min-height: 32rem;
		background: radial-gradient(circle at 50% 65%, rgba(210, 86, 37, 0.24), transparent 44%);
	}
	.portrait > img {
		position: relative;
		z-index: 1;
		display: block;
		width: min(92%, 27rem);
		height: 32rem;
		object-fit: cover;
		object-position: center top;
		filter: drop-shadow(0 1rem 2rem rgba(0, 0, 0, 0.8));
		animation: summon-arrival 850ms cubic-bezier(0.2, 0.75, 0.2, 1) both;
	}
	.gate-glow {
		position: absolute;
		bottom: -26%;
		width: 90%;
		aspect-ratio: 1;
		border: 2px solid rgba(213, 111, 49, 0.38);
		border-radius: 50%;
		box-shadow: 0 0 7rem rgba(200, 74, 29, 0.25);
		animation: gate-arrival 1.1s ease-out both;
	}
	.dossier {
		padding: clamp(1.2rem, 3vw, 2.4rem);
		border-left: 1px solid rgba(237, 198, 130, 0.13);
	}
	.identity {
		display: flex;
		justify-content: space-between;
		align-items: start;
	}
	.identity span,
	dt,
	.mind span,
	.enter-row span,
	label {
		color: rgba(243, 231, 206, 0.4);
		font:
			0.55rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.identity h2 {
		margin: 0.25rem 0 1rem;
		font:
			2.5rem Georgia,
			serif;
		font-weight: 400;
	}
	.identity b {
		color: #db9d56;
		letter-spacing: 0.08em;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin: 0 0 1.3rem;
		border-block: 1px solid rgba(237, 198, 130, 0.12);
	}
	dl div {
		padding: 0.75rem 0;
	}
	dt {
		margin-bottom: 0.3rem;
	}
	dd {
		margin: 0;
		color: rgba(243, 231, 206, 0.74);
		font-size: 0.72rem;
		text-transform: capitalize;
	}
	.mind {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.7rem;
		margin-bottom: 1.2rem;
	}
	.mind .eyebrow {
		grid-column: 1/-1;
	}
	.mind div {
		padding: 0.7rem;
		border-left: 1px solid rgba(209, 103, 48, 0.5);
		background: rgba(255, 255, 255, 0.02);
	}
	.mind strong {
		display: block;
		margin-top: 0.3rem;
		font:
			0.82rem Georgia,
			serif;
		font-weight: 400;
		text-transform: capitalize;
	}
	label {
		display: block;
		margin-bottom: 0.45rem;
	}
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 5.5rem;
		resize: vertical;
		padding: 0.8rem;
		border: 1px solid rgba(237, 198, 130, 0.18);
		background: rgba(255, 255, 255, 0.03);
		color: #f3e7ce;
		font:
			0.82rem/1.5 Georgia,
			serif;
	}
	.ask {
		width: 100%;
		padding: 0.8rem;
		border: 1px solid #b6542a;
		background: #8d301b;
		color: #fff1d7;
		font:
			0.6rem ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	blockquote {
		margin: 0;
		padding: 1.2rem;
		border-left: 2px solid #c36531;
		background: rgba(177, 62, 24, 0.12);
	}
	blockquote p {
		margin: 0;
		font:
			1.05rem/1.55 Georgia,
			serif;
	}
	blockquote footer {
		margin-top: 0.7rem;
		color: rgba(243, 231, 206, 0.45);
		font-size: 0.65rem;
		line-height: 1.45;
	}
	.enter-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		padding: 1.1rem;
		border: 1px solid rgba(237, 198, 130, 0.13);
		border-top: 0;
	}
	.first-direction {
		flex: 1;
		max-width: 46rem;
	}
	.first-direction textarea {
		min-height: 4.2rem;
	}
	.enter-row p {
		margin: 0.2rem 0 0;
		color: rgba(243, 231, 206, 0.55);
		font:
			0.8rem Georgia,
			serif;
	}
	button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.error {
		position: fixed;
		right: 1rem;
		top: 4.2rem;
		z-index: 80;
		max-width: 28rem;
		padding: 0.8rem 1rem;
		border: 1px solid #9f3f29;
		background: #2a100c;
		color: #ffb29b;
		font-size: 0.7rem;
	}
	@keyframes pulse {
		50% {
			opacity: 0.35;
		}
	}
	@keyframes turn {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes summon-arrival {
		from {
			opacity: 0;
			transform: translateY(1.5rem) scale(0.97);
			filter: brightness(1.8) drop-shadow(0 0 3rem rgba(226, 112, 52, 0.8));
		}
	}
	@keyframes gate-arrival {
		from {
			opacity: 0;
			transform: scale(0.78);
		}
	}
	:global(html[data-player-motion='reduced']) .ring,
	:global(html[data-player-motion='reduced']) .signal span,
	:global(html[data-player-motion='reduced']) .portrait > img,
	:global(html[data-player-motion='reduced']) .gate-glow {
		animation: none;
	}
	@media (max-width: 760px) {
		main > header {
			grid-template-columns: 1fr auto;
		}
		header p {
			display: none;
		}
		.gate {
			grid-template-columns: 1fr;
			padding: 2rem 0 7rem;
		}
		.gate-machine {
			width: min(80vw, 26rem);
			margin: 0 auto;
		}
		.company-heading {
			align-items: start;
			flex-direction: column;
		}
		.hero-tabs {
			grid-template-columns: 1fr;
		}
		.hero-tabs button {
			border-right: 0;
			border-bottom: 1px solid rgba(237, 198, 130, 0.13);
		}
		.hero-focus {
			grid-template-columns: 1fr;
		}
		.portrait {
			min-height: 25rem;
		}
		.dossier {
			border-top: 1px solid rgba(237, 198, 130, 0.13);
			border-left: 0;
		}
		dl {
			grid-template-columns: repeat(2, 1fr);
		}
		.enter-row {
			align-items: stretch;
			flex-direction: column;
		}
		.enter-row button {
			width: 100%;
		}
	}
</style>
