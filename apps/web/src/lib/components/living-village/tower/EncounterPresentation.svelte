<script lang="ts">
	import beasts from '../../../../../../../assets/enemies/review/beasts-v1.webp';
	import goblinoids from '../../../../../../../assets/enemies/review/goblinoids-v1.webp';
	import elementals from '../../../../../../../assets/enemies/review/pack-2/elementals-v1.png';
	import type { CombatReceipt, HuntFixtureResult } from './tower-combat';
	import { speciesById, type HeroFixture, type SpeciesFixture } from './tower-fixtures';

	let {
		result,
		receipt,
		party,
		species,
		visibleEventCount,
		playing,
		speed,
		onEncounter,
		onPlayPause,
		onReplay,
		onSpeed
	}: {
		result: HuntFixtureResult;
		receipt: CombatReceipt;
		party: HeroFixture[];
		species: SpeciesFixture;
		visibleEventCount: number;
		playing: boolean;
		speed: number;
		onEncounter: (encounterIndex: number) => void;
		onPlayPause: () => void;
		onReplay: () => void;
		onSpeed: (speed: number) => void;
	} = $props();

	const artBySpecies: Record<SpeciesFixture['id'], string> = {
		'goblin-skirmisher': goblinoids,
		'gray-wolf': beasts,
		'ember-wisp': elementals
	};

	function heroResource(heroId: HeroFixture['id']) {
		return receipt.finalResources.find((resource) => resource.unitId === heroId)!;
	}
</script>

<section class="presentation" aria-labelledby="presentation-heading">
	<header>
		<div>
			<p class="eyebrow">04 · Encounter record</p>
			<h2 id="presentation-heading">Representative encounter {receipt.encounterIndex}</h2>
		</div>
		<div class="fixture-badge">
			<span>Presentation fixture</span>
			<strong>Not accepted final combat math</strong>
		</div>
	</header>

	<nav class="encounter-rail" aria-label="Completed hunt encounters">
		{#each result.combatReceipts as candidate (candidate.receiptId)}
			<button
				type="button"
				class:active={candidate.encounterIndex === receipt.encounterIndex}
				aria-pressed={candidate.encounterIndex === receipt.encounterIndex}
				onclick={() => onEncounter(candidate.encounterIndex)}
			>
				<span>{String(candidate.encounterIndex).padStart(2, '0')}</span>
				<strong>{candidate.outcome}</strong>
				<small>{speciesById(candidate.encounterRef.speciesId).name}</small>
			</button>
		{/each}
	</nav>

	<div class="controls" aria-label="Encounter playback controls">
		<button type="button" aria-pressed={playing} onclick={onPlayPause}
			>{playing ? 'Pause' : 'Play'}</button
		>
		<button type="button" onclick={onReplay}>Replay encounter</button>
		<div role="group" aria-label="Playback speed">
			{#each [0.5, 1, 2] as candidate (candidate)}
				<button
					type="button"
					class:active={speed === candidate}
					aria-pressed={speed === candidate}
					onclick={() => onSpeed(candidate)}>{candidate}x</button
				>
			{/each}
		</div>
		<span aria-live="polite"
			>{Math.min(visibleEventCount, receipt.events.length)} of {receipt.events.length} events</span
		>
	</div>

	<div class="stage">
		<div class="party-side" aria-label="Party final resources for this encounter">
			<p>Party formation</p>
			{#each party as hero (hero.id)}
				{@const resource = heroResource(hero.id)}
				<article>
					<div><strong>{hero.name}</strong><small>{hero.role} · {hero.affinity}</small></div>
					<label>
						<span>Health {resource.health}/{resource.maxHealth}</span>
						<progress value={resource.health} max={resource.maxHealth}></progress>
					</label>
					<label>
						<span>Mana {resource.mana}/{resource.maxMana}</span>
						<progress class="mana" value={resource.mana} max={resource.maxMana}></progress>
					</label>
				</article>
			{/each}
		</div>

		<figure>
			<img
				src={artBySpecies[species.id]}
				alt={`${species.family} review plate used as a non-canon screen fixture`}
			/>
			<figcaption>
				<span>Existing review plate · fixture crop</span>
				<strong>{species.name}</strong>
				<small>{species.role} · {species.affinity}</small>
			</figcaption>
		</figure>
	</div>

	<div class="order" data-testid="initiative-order">
		<span>Initiative / action order</span>
		<ol>
			{#each receipt.events.filter((event) => event.verb === 'SKILL' || event.verb === 'STRIKE') as event (event.id)}
				<li><i>t{event.tick}</i><strong>{event.actorName}</strong><small>{event.title}</small></li>
			{/each}
		</ol>
	</div>

	<div class="chronicle" data-testid="combat-chronicle" aria-label="Encounter event chronicle">
		{#each receipt.events.slice(0, visibleEventCount) as event (event.id)}
			<article class:decisive={event.verb === 'VICTORY' || event.verb === 'DEFEAT'}>
				<div class="event-key"><span>t{event.tick}</span><strong>{event.verb}</strong></div>
				<div class="event-copy">
					<p><strong>{event.actorName}</strong> · {event.title}</p>
					<span>{event.detail}</span>
					{#if event.healthDelta || event.manaDelta || event.status}
						<div class="deltas">
							{#if event.healthDelta}<b>Health {event.healthDelta}</b>{/if}
							{#if event.manaDelta}<b>Mana {event.manaDelta > 0 ? '+' : ''}{event.manaDelta}</b
								>{/if}
							{#if event.status}<b>Status · {event.status}</b>{/if}
						</div>
					{/if}
					<ul>
						{#each event.contributions as contribution (contribution.label)}
							<li><span>{contribution.label}</span><strong>{contribution.value}</strong></li>
						{/each}
					</ul>
				</div>
			</article>
		{/each}
	</div>

	<div class="decisive-cause" data-testid="decisive-cause">
		<span>Decisive cause · {receipt.decisiveCause.code}</span>
		<strong>{receipt.decisiveCause.summary}</strong>
		<small>Trace {receipt.traceHash} · receipt {receipt.receiptId}</small>
	</div>
</section>

<style>
	.presentation {
		padding: clamp(1.25rem, 3vw, 2.25rem);
		border: 1px solid rgba(225, 188, 121, 0.22);
		background: #0d0f13;
	}
	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}
	.eyebrow,
	.fixture-badge span,
	.party-side > p,
	.order > span,
	.decisive-cause > span {
		margin: 0 0 0.45rem;
		color: #d99b54;
		font:
			0.7rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(1.75rem, 3vw, 2.6rem);
		font-weight: 400;
	}
	.fixture-badge {
		padding: 0.75rem 0.9rem;
		border: 1px solid #7c5531;
		background: #251a12;
		text-align: right;
	}
	.fixture-badge span,
	.fixture-badge strong {
		display: block;
	}
	.fixture-badge strong {
		font-size: 0.74rem;
	}
	.encounter-rail {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		margin: 1.25rem 0;
		padding-bottom: 0.4rem;
	}
	.encounter-rail button {
		min-width: 8.2rem;
		min-height: 4.2rem;
		padding: 0.65rem;
		border: 1px solid #37383a;
		background: #16181c;
		color: #dcd6cc;
		text-align: left;
		cursor: pointer;
	}
	.encounter-rail button.active {
		border-color: #d99b54;
		background: #2b2117;
	}
	.encounter-rail span,
	.encounter-rail strong,
	.encounter-rail small {
		display: block;
	}
	.encounter-rail span,
	.encounter-rail small {
		font:
			0.62rem ui-monospace,
			monospace;
	}
	.encounter-rail small {
		margin-top: 0.25rem;
		color: #86837d;
	}
	.stage {
		display: grid;
		grid-template-columns: minmax(15rem, 0.8fr) minmax(18rem, 1.2fr);
		gap: 1rem;
		min-height: 17rem;
	}
	.party-side {
		padding: 1rem;
		background: linear-gradient(145deg, #171d22, #101216);
	}
	.party-side article {
		padding: 0.8rem;
		border-left: 2px solid #55788a;
		background: #0d1014;
	}
	.party-side article + article {
		margin-top: 0.55rem;
	}
	.party-side article > div {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.party-side small {
		color: #858a8d;
		font-size: 0.65rem;
	}
	.party-side label {
		display: block;
		margin-top: 0.65rem;
	}
	.party-side label span {
		display: block;
		margin-bottom: 0.2rem;
		color: #aaa9a5;
		font-size: 0.65rem;
	}
	progress {
		appearance: none;
		width: 100%;
		height: 0.4rem;
		border: 0;
		accent-color: #ad584d;
		background: #34383a;
	}
	progress.mana {
		accent-color: #557ea2;
	}
	progress::-webkit-progress-bar {
		background: #34383a;
	}
	progress:not(.mana)::-webkit-progress-value {
		background: #62b86f;
	}
	progress.mana::-webkit-progress-value {
		background: #5799d0;
	}
	progress:not(.mana)::-moz-progress-bar {
		background: #62b86f;
	}
	progress.mana::-moz-progress-bar {
		background: #5799d0;
	}
	figure {
		position: relative;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		background: #090a0c;
	}
	figure img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.72) contrast(1.08) brightness(0.76);
	}
	figcaption {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		padding: 1rem;
		background: linear-gradient(transparent, rgba(5, 6, 8, 0.94));
	}
	figcaption span,
	figcaption strong,
	figcaption small {
		display: block;
	}
	figcaption span {
		color: #d99b54;
		font:
			0.62rem ui-monospace,
			monospace;
		text-transform: uppercase;
	}
	figcaption strong {
		margin-top: 0.25rem;
		font-family: Georgia, serif;
		font-size: 1.55rem;
		font-weight: 400;
	}
	figcaption small {
		color: #b9b4aa;
	}
	.order {
		margin-top: 1rem;
		padding: 1rem;
		border: 1px solid #323235;
		background: #121418;
	}
	.order ol {
		display: flex;
		gap: 0.45rem;
		overflow-x: auto;
		margin: 0.65rem 0 0;
		padding: 0;
		list-style: none;
	}
	.order li {
		display: grid;
		grid-template-columns: auto auto;
		min-width: 10rem;
		gap: 0.15rem 0.5rem;
		padding: 0.6rem;
		background: #0b0d10;
	}
	.order i {
		color: #d99b54;
		font:
			0.65rem ui-monospace,
			monospace;
		font-style: normal;
	}
	.order strong {
		font-size: 0.72rem;
	}
	.order small {
		grid-column: 1 / -1;
		color: #89867f;
	}
	.controls {
		position: sticky;
		top: -0.1rem;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin: 0 0 0.75rem;
		padding: 0.55rem;
		border: 1px solid #4b3b2b;
		background: rgba(16, 18, 22, 0.98);
		box-shadow: 0 0.65rem 1.2rem rgba(0, 0, 0, 0.35);
	}
	.controls button {
		min-height: 2.8rem;
		padding: 0.55rem 0.8rem;
		border: 1px solid #4a4741;
		background: #1a1c20;
		color: #e0d9cd;
		cursor: pointer;
	}
	.controls button.active,
	.controls button[aria-pressed='true'] {
		border-color: #d99b54;
		background: #332416;
	}
	.controls div {
		display: flex;
		gap: 0.25rem;
	}
	.controls > span {
		margin-left: auto;
		color: #8c8983;
		font:
			0.7rem ui-monospace,
			monospace;
	}
	.chronicle {
		display: grid;
		gap: 0.5rem;
		max-height: clamp(16rem, 38vh, 28rem);
		margin-top: 1rem;
		overflow-y: auto;
		padding-right: 0.35rem;
		scrollbar-gutter: stable;
		scrollbar-color: #9b6a39 #15171a;
	}
	.chronicle > article {
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		border: 1px solid #282a2d;
		background: #111317;
	}
	.chronicle > article.decisive {
		border-color: #aa7742;
		background: #211a13;
	}
	.event-key {
		padding: 0.8rem;
		border-right: 1px solid #282a2d;
	}
	.event-key span,
	.event-key strong {
		display: block;
	}
	.event-key span {
		color: #d99b54;
		font:
			0.68rem ui-monospace,
			monospace;
	}
	.event-key strong {
		margin-top: 0.2rem;
		font-size: 0.68rem;
	}
	.event-copy {
		padding: 0.8rem;
	}
	.event-copy p {
		margin: 0;
		font-size: 0.82rem;
	}
	.event-copy > span {
		display: block;
		margin-top: 0.25rem;
		color: #aaa69f;
		font-size: 0.76rem;
		line-height: 1.45;
	}
	.deltas {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-top: 0.55rem;
	}
	.deltas b {
		padding: 0.2rem 0.35rem;
		background: #27201a;
		color: #dfb77a;
		font-size: 0.65rem;
	}
	.event-copy ul {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		margin: 0.6rem 0 0;
		padding: 0;
		list-style: none;
	}
	.event-copy li {
		padding: 0.25rem 0.4rem;
		border: 1px solid #323237;
		font-size: 0.63rem;
	}
	.event-copy li span {
		color: #85827c;
	}
	.event-copy li strong {
		margin-left: 0.25rem;
		font-weight: 500;
	}
	.decisive-cause {
		margin-top: 1rem;
		padding: 1rem;
		border-left: 4px solid #d99b54;
		background: #231b13;
	}
	.decisive-cause strong,
	.decisive-cause small {
		display: block;
	}
	.decisive-cause strong {
		font-family: Georgia, serif;
		font-size: 1.05rem;
		font-weight: 400;
	}
	.decisive-cause small {
		margin-top: 0.45rem;
		color: #8e8980;
		font:
			0.63rem ui-monospace,
			monospace;
	}
	@media (max-width: 760px) {
		.presentation {
			padding: 0.65rem;
		}
		header {
			display: block;
		}
		.fixture-badge {
			margin-top: 1rem;
			text-align: left;
		}
		.stage {
			grid-template-columns: 1fr;
			min-height: 0;
		}
		figure {
			min-height: 12rem;
		}
		.chronicle > article {
			grid-template-columns: 4.8rem 1fr;
		}
		.controls > span {
			width: auto;
			margin-left: 0;
		}
		.controls {
			gap: 0.3rem;
		}
		.controls button {
			min-height: 2.55rem;
			padding: 0.45rem 0.55rem;
			font-size: 0.68rem;
		}
		.controls > span {
			width: 100%;
		}
	}
</style>
