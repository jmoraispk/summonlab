<script lang="ts">
	import type { Availability, HeroFixture } from './tower-fixtures';

	let {
		heroes,
		activeHeroIds,
		availability,
		onToggleMember,
		onToggleAvailability
	}: {
		heroes: HeroFixture[];
		activeHeroIds: HeroFixture['id'][];
		availability: Record<HeroFixture['id'], Availability>;
		onToggleMember: (id: HeroFixture['id']) => void;
		onToggleAvailability: (id: HeroFixture['id']) => void;
	} = $props();

	function heroById(id: HeroFixture['id'] | undefined): HeroFixture | undefined {
		return heroes.find((hero) => hero.id === id);
	}
</script>

<section class="party" aria-labelledby="party-heading">
	<header>
		<div>
			<p class="eyebrow">03 · Party confirmation</p>
			<h2 id="party-heading">Three return together</h2>
		</div>
		<span>{activeHeroIds.length}/3 slots filled</span>
	</header>

	<div
		class:complete={activeHeroIds.length === 3}
		class="party-dock"
		aria-label="Selected party slots"
	>
		{#each [0, 1, 2] as slot (slot)}
			{@const slotHero = heroById(activeHeroIds[slot])}
			<div class:filled={slotHero !== undefined}>
				<span aria-hidden="true">{slotHero ? '✓' : slot + 1}</span>
				<small>Party slot {slot + 1}</small>
				<strong>{slotHero?.name ?? 'Empty'}</strong>
			</div>
		{/each}
	</div>

	<div class="hero-grid">
		{#each heroes as hero (hero.id)}
			{@const active = activeHeroIds.includes(hero.id)}
			{@const currentAvailability = availability[hero.id]}
			<article
				class:selected={active}
				class:excluded={!active}
				class:unavailable={currentAvailability !== 'idle'}
			>
				<div class:active class="membership">
					<span aria-hidden="true">{active ? '✓' : '+'}</span>
					<strong
						>{active
							? `In party · slot ${activeHeroIds.indexOf(hero.id) + 1}`
							: 'Not selected'}</strong
					>
				</div>
				<div class="identity">
					<span aria-hidden="true"
						>{hero.name
							.split(' ')
							.map((part) => part[0])
							.join('')}</span
					>
					<div>
						<strong>{hero.name}</strong>
						<small>Lv {hero.level} · {hero.role} · {hero.affinity}</small>
					</div>
				</div>
				<div class="resources">
					<div>
						<span>Health</span><strong>{hero.maxHealth}/{hero.maxHealth}</strong>
						<progress class="health" value={hero.maxHealth} max={hero.maxHealth}>100%</progress>
					</div>
					<div>
						<span>Mana</span><strong>{hero.maxMana}/{hero.maxMana}</strong>
						<progress class="mana" value={hero.maxMana} max={hero.maxMana}>100%</progress>
					</div>
				</div>
				<div class="state-row">
					<span class:ready={currentAvailability === 'idle'}>{currentAvailability}</span>
					<span>{active ? 'Selected' : 'Available hero'}</span>
				</div>
				<div class="actions">
					<button type="button" onclick={() => onToggleMember(hero.id)}>
						{active ? `Remove ${hero.name}` : `Add ${hero.name}`}
					</button>
					<button type="button" onclick={() => onToggleAvailability(hero.id)}>
						{currentAvailability === 'idle' ? 'Mark training' : 'Recall to idle'}
					</button>
				</div>
			</article>
		{/each}
	</div>
	<p class="fixture-note">
		Availability controls are route-local rejection fixtures. They do not alter Court assignments.
	</p>
</section>

<style>
	.party {
		padding: clamp(1.25rem, 3vw, 2.25rem);
		border: 1px solid rgba(225, 188, 121, 0.22);
		background: rgba(11, 13, 16, 0.95);
	}
	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.2rem;
	}
	header > span {
		color: #d9a965;
		font:
			0.72rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.party-dock {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin-bottom: 0.8rem;
		padding: 0.55rem;
		border: 1px solid #68432d;
		background: #17120e;
	}
	.party-dock.complete {
		border-color: #477451;
		background: #0f1b13;
	}
	.party-dock > div {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0 0.55rem;
		align-items: center;
		min-width: 0;
		padding: 0.55rem;
		border: 1px dashed #6b4a33;
		background: #0c0e11;
	}
	.party-dock > div.filled {
		border-style: solid;
		border-color: #4f8c5d;
	}
	.party-dock > div > span {
		grid-row: 1 / 3;
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 50%;
		background: #4e2f20;
		color: #f0b76b;
		font-weight: 900;
	}
	.party-dock > div.filled > span {
		background: #39834c;
		color: white;
	}
	.party-dock small,
	.party-dock strong {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.party-dock small {
		color: #86817a;
		font-size: 0.58rem;
		text-transform: uppercase;
	}
	.party-dock strong {
		font-size: 0.75rem;
	}
	.eyebrow {
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
		font-size: clamp(1.65rem, 3vw, 2.35rem);
		font-weight: 400;
	}
	.hero-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}
	article {
		position: relative;
		min-width: 0;
		padding: 3.1rem 1rem 1rem;
		border: 1px solid #3c3932;
		background: linear-gradient(160deg, #1d1d1e, #111317);
	}
	article.selected {
		border: 2px solid #60a76f;
		background: linear-gradient(160deg, #1b2b20, #101714 72%);
		box-shadow: inset 0 0 0 1px rgba(126, 219, 144, 0.12);
	}
	article.excluded,
	article.unavailable {
		border-style: dashed;
		border-color: #8b6140;
	}
	.membership {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.3rem;
		padding: 0.45rem 0.7rem;
		border-bottom: 1px dashed #795333;
		background: #24180f;
		color: #e1a55b;
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.membership.active {
		border-bottom-style: solid;
		border-color: #4f8c5d;
		background: #18301e;
		color: #9de3ab;
	}
	.membership span {
		display: grid;
		width: 1.3rem;
		height: 1.3rem;
		place-items: center;
		border: 1px solid currentColor;
		border-radius: 50%;
		font-weight: 900;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.identity > span {
		display: grid;
		width: 2.8rem;
		height: 2.8rem;
		place-items: center;
		border: 1px solid #7c684e;
		border-radius: 50%;
		background: #27231e;
		color: #e9c588;
		font-family: Georgia, serif;
	}
	.identity strong,
	.identity small {
		display: block;
	}
	.identity strong {
		font-family: Georgia, serif;
		font-size: 1.1rem;
		font-weight: 400;
	}
	.identity small {
		margin-top: 0.2rem;
		color: #96928a;
		font-size: 0.7rem;
	}
	.resources {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.resources > div {
		padding: 0.55rem;
		background: #0c0e11;
	}
	.resources span,
	.resources strong {
		display: block;
	}
	.resources progress {
		appearance: none;
		display: block;
		width: 100%;
		height: 0.36rem;
		margin-top: 0.35rem;
		border: 0;
		accent-color: #62b86f;
		background: #34383a;
	}
	.resources progress.mana {
		accent-color: #5799d0;
	}
	.resources progress::-webkit-progress-bar {
		background: #34383a;
	}
	.resources progress.health::-webkit-progress-value {
		background: #62b86f;
	}
	.resources progress.mana::-webkit-progress-value {
		background: #5799d0;
	}
	.resources progress.health::-moz-progress-bar {
		background: #62b86f;
	}
	.resources progress.mana::-moz-progress-bar {
		background: #5799d0;
	}
	.resources span {
		color: #8f8b84;
		font-size: 0.65rem;
		text-transform: uppercase;
	}
	.resources strong {
		margin-top: 0.2rem;
		font:
			0.78rem ui-monospace,
			monospace;
	}
	.state-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.8rem;
		color: #d49a67;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
	}
	.state-row span.ready {
		color: #8fca98;
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
		margin-top: 0.8rem;
	}
	button {
		min-height: 2.75rem;
		padding: 0.55rem;
		border: 1px solid #4a4640;
		background: #1e2024;
		color: #ded6c8;
		font-size: 0.7rem;
		cursor: pointer;
	}
	button:hover {
		border-color: #d99b54;
	}
	.fixture-note {
		min-height: 0;
		margin: 1rem 0 0;
		color: #817d76;
		font-size: 0.68rem;
	}
	@media (max-width: 820px) {
		.party {
			padding: 0.8rem;
		}
		header {
			margin-bottom: 0.7rem;
		}
		header h2 {
			font-size: 1.35rem;
		}
		.party-dock {
			gap: 0.3rem;
			padding: 0.35rem;
		}
		.party-dock > div {
			display: block;
			padding: 0.4rem;
			text-align: center;
		}
		.party-dock > div > span {
			width: 1.55rem;
			height: 1.55rem;
			margin: 0 auto 0.25rem;
		}
		.party-dock small {
			display: none;
		}
		.hero-grid {
			grid-template-columns: none;
			grid-auto-flow: column;
			grid-auto-columns: minmax(17rem, 86%);
			overflow-x: auto;
			padding-bottom: 0.4rem;
			scroll-snap-type: x mandatory;
		}
		article {
			scroll-snap-align: center;
		}
	}
</style>
