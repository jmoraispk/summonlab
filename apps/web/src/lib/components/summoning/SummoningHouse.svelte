<script lang="ts">
	import { onMount, tick } from 'svelte';

	import type { CityIntroduction, CitySummonHero, CitySummonIntent } from '$lib/city';
	import { focusDialog, handleModalKeydown } from '$lib/modal-focus';

	import SummonedHeroDossier from './SummonedHeroDossier.svelte';
	import SummonReveal from './SummonReveal.svelte';

	let {
		introduction,
		onSummon,
		onAskFirstQuestion,
		onCompleteIntroduction,
		onClose
	}: {
		introduction: CityIntroduction;
		onSummon: (intent: CitySummonIntent) => Promise<void>;
		onAskFirstQuestion: (heroId: string, exactText: string) => Promise<void>;
		onCompleteIntroduction: () => Promise<void>;
		onClose: () => void;
	} = $props();

	let dialog: HTMLDialogElement;
	let pending = $state(false);
	let errorMessage = $state('');
	let revealHero = $state<CitySummonHero | null>(null);
	let revealComplete = $state(false);
	let runToken = $state(0);
	let detailsHero = $state<CitySummonHero | null>(null);
	let question = $state('What do you need to understand before you can decide what comes next?');
	const reducedMotion = $derived(
		typeof document !== 'undefined' &&
			(document.documentElement.dataset.playerMotion === 'reduced' ||
				window.matchMedia('(prefers-reduced-motion: reduce)').matches)
	);

	onMount(() => void tick().then(() => focusDialog(dialog)));

	function close() {
		if (pending || (revealHero && !revealComplete)) return;
		onClose();
	}

	async function summonNext() {
		const hero = introduction.nextHero;
		if (!hero || pending) return;
		pending = true;
		errorMessage = '';
		try {
			await onSummon({
				ordinal: hero.ordinal,
				expectedSummonedHeroCount: introduction.summonedHeroCount as 0 | 1 | 2
			});
			revealHero = hero;
			revealComplete = false;
			runToken += 1;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The summoning failed.';
		} finally {
			pending = false;
		}
	}

	async function ask(hero: CitySummonHero) {
		if (pending || hero.firstReply || !question.trim()) return;
		pending = true;
		errorMessage = '';
		try {
			await onAskFirstQuestion(hero.heroId, question.trim());
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The hero did not answer.';
		} finally {
			pending = false;
		}
	}

	async function finishIntroductions() {
		if (pending || introduction.answeredHeroCount !== 3) return;
		pending = true;
		errorMessage = '';
		try {
			await onCompleteIntroduction();
			onClose();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The introductions stayed open.';
		} finally {
			pending = false;
		}
	}
</script>

<div class="house-backdrop" data-no-pan>
	<dialog
		bind:this={dialog}
		open
		class="house"
		aria-modal="true"
		aria-label="Summoning House"
		tabindex="-1"
		onkeydown={(event) => handleModalKeydown(event, dialog, close)}
	>
		<header>
			<div>
				<span>Hearth 01 · Summoning Circle</span>
				<h2>Summoning House</h2>
			</div>
			<button
				type="button"
				onclick={close}
				disabled={pending || Boolean(revealHero && !revealComplete)}
				aria-label="Close Summoning House">×</button
			>
		</header>

		{#if revealHero}
			<SummonReveal
				hero={revealHero}
				{runToken}
				{reducedMotion}
				onComplete={() => (revealComplete = true)}
			/>
			{#if revealComplete}
				<footer class="reveal-actions">
					<button type="button" class="secondary" onclick={() => (detailsHero = revealHero)}
						>View details</button
					>
					<button type="button" onclick={close}>Return to Village</button>
				</footer>
			{/if}
		{:else if introduction.stage === 'village-entry' || introduction.stage === 'summoning'}
			<section class="summon-offer">
				<div>
					<span>The last reserve</span>
					<h3>
						{introduction.summonedHeroCount === 0
							? 'Three lives are waiting.'
							: `${3 - introduction.summonedHeroCount} summons remain.`}
					</h3>
					<p>
						Each hero arrives as a person, not a blank unit. Their identity is fixed before the
						threshold opens.
					</p>
				</div>
				{#if introduction.nextHero}
					<button type="button" onclick={summonNext} disabled={pending}>
						{pending ? 'Opening the threshold…' : 'Summon next hero'}
					</button>
				{/if}
			</section>
		{:else}
			<section class="voices">
				<div class="voices-copy">
					<span>{introduction.stage === 'complete' ? 'Company roster' : 'First voices'}</span>
					<h3>
						{introduction.stage === 'complete' ? 'The first company' : 'Ask who answered the call.'}
					</h3>
				</div>
				{#if introduction.stage === 'first-voices'}
					<label>
						<span>Your first question</span>
						<textarea bind:value={question} rows="3" maxlength="600"></textarea>
					</label>
				{/if}
				<div class="roster">
					{#each introduction.summonedHeroes as hero (hero.heroId)}
						<article>
							<img src={hero.rosterArt?.publicPath ?? hero.summonArt.publicPath} alt="" />
							<div><strong>{hero.name}</strong><small>{hero.role}</small></div>
							{#if hero.firstReply}
								<span class="answered">Answered</span>
							{:else if introduction.stage === 'first-voices'}
								<button
									type="button"
									onclick={() => ask(hero)}
									disabled={pending || !question.trim()}
									aria-label={`Ask ${hero.name} first question`}>Ask</button
								>
							{/if}
							<button
								type="button"
								class="details"
								onclick={() => (detailsHero = hero)}
								aria-label={`View ${hero.name} details`}>Details</button
							>
						</article>
					{/each}
				</div>
				{#if introduction.stage === 'first-voices' && introduction.answeredHeroCount === 3}
					<button class="finish" type="button" onclick={finishIntroductions} disabled={pending}
						>{pending ? 'Recording…' : 'Finish introductions'}</button
					>
				{/if}
			</section>
		{/if}

		{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
	</dialog>
</div>

{#if detailsHero}
	<SummonedHeroDossier hero={detailsHero} onClose={() => (detailsHero = null)} />
{/if}

<style>
	.house-backdrop {
		position: fixed;
		z-index: 140;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: #020405d9;
	}

	.house {
		width: min(68rem, 96vw);
		max-height: 92vh;
		margin: 0;
		padding: 0;
		overflow: auto;
		border: 1px solid #c5965266;
		background: #080a0b;
		color: #f2e9dc;
		box-shadow: 0 2rem 8rem #000;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #c596522b;
	}

	header span,
	.summon-offer span,
	.voices-copy span,
	label span {
		color: #d09a4f;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	header h2 {
		margin: 0.2rem 0 0;
		font-family: Georgia, serif;
		font-size: 1.45rem;
		font-weight: 400;
	}

	header button {
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid #f2e9dc33;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 1.4rem;
	}

	.summon-offer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 2rem;
		min-height: 25rem;
		padding: clamp(1.5rem, 6vw, 5rem);
		background:
			radial-gradient(circle at 80% 20%, #19615f44, transparent 40%),
			linear-gradient(135deg, #101211, #050708);
	}

	.summon-offer h3,
	.voices h3 {
		margin: 0.5rem 0;
		font-family: Georgia, serif;
		font-size: clamp(2rem, 6vw, 4.5rem);
		font-weight: 400;
	}

	.summon-offer p {
		max-width: 40rem;
		color: #d7ccbcaa;
		line-height: 1.6;
	}

	.summon-offer button,
	.reveal-actions button,
	.finish {
		min-height: 3rem;
		padding: 0.8rem 1.2rem;
		border: 1px solid #54d5ca;
		background: #176b67;
		color: white;
		cursor: pointer;
		font-weight: 800;
	}

	.reveal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem;
	}

	.reveal-actions .secondary {
		border-color: #d6c7b755;
		background: transparent;
	}

	.voices {
		padding: clamp(1.25rem, 4vw, 3rem);
	}

	.voices h3 {
		font-size: clamp(1.8rem, 4vw, 3rem);
	}

	label {
		display: grid;
		gap: 0.5rem;
		margin: 1.25rem 0;
	}

	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.85rem;
		border: 1px solid #d6c7b733;
		background: #0d1011;
		color: inherit;
		font: inherit;
	}

	.roster {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.roster article {
		display: grid;
		grid-template-columns: 3.5rem minmax(0, 1fr);
		align-items: center;
		gap: 0.7rem;
		padding: 0.65rem;
		border: 1px solid #d6c7b722;
		background: #0d0f10;
	}

	.roster img {
		grid-row: span 3;
		width: 3.5rem;
		height: 4.5rem;
		object-fit: cover;
		object-position: top;
	}

	.roster strong,
	.roster small {
		display: block;
	}

	.roster small {
		color: #bcae9a88;
		text-transform: capitalize;
	}

	.roster button,
	.answered {
		min-height: 2.25rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid #56cec455;
		background: #163e3b;
		color: #eaf9f7;
		cursor: pointer;
	}

	.roster .details {
		border-color: #d6c7b733;
		background: transparent;
	}

	.answered {
		display: grid;
		place-items: center;
		color: #70dbb4;
	}

	.finish {
		display: block;
		margin: 1.25rem 0 0 auto;
	}

	.error {
		margin: 0;
		padding: 0.75rem 1rem;
		border-top: 1px solid #d86e5066;
		background: #5d1d18;
		color: #ffd7c9;
	}

	button:disabled {
		cursor: wait;
		opacity: 0.5;
	}

	@media (max-width: 650px) {
		.house-backdrop {
			align-items: end;
			padding: 0;
		}

		.house {
			width: 100vw;
			max-height: calc(100svh - 4.8rem);
		}

		.summon-offer {
			grid-template-columns: 1fr;
			min-height: 28rem;
		}

		.roster {
			grid-template-columns: 1fr;
		}
	}
</style>
