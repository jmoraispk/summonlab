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
</script>

<section class="party" aria-labelledby="party-heading">
	<header>
		<div>
			<p class="eyebrow">03 · Party confirmation</p>
			<h2 id="party-heading">Three return together</h2>
		</div>
		<span>{activeHeroIds.length}/3 slots filled</span>
	</header>

	<div class="hero-grid">
		{#each heroes as hero (hero.id)}
			{@const active = activeHeroIds.includes(hero.id)}
			{@const currentAvailability = availability[hero.id]}
			<article class:excluded={!active} class:unavailable={currentAvailability !== 'idle'}>
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
					<div><span>Health</span><strong>{hero.maxHealth}/{hero.maxHealth}</strong></div>
					<div><span>Mana</span><strong>{hero.maxMana}/{hero.maxMana}</strong></div>
				</div>
				<p><strong>{hero.skill.name}</strong> · {hero.equipment}</p>
				<div class="state-row">
					<span class:ready={currentAvailability === 'idle'}>{currentAvailability}</span>
					<span>{active ? 'In party' : 'Slot empty'}</span>
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
		min-width: 0;
		padding: 1rem;
		border: 1px solid #3c3932;
		background: linear-gradient(160deg, #1d1d1e, #111317);
	}
	article.excluded,
	article.unavailable {
		border-style: dashed;
		border-color: #8b6140;
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
	article > p {
		min-height: 2.7rem;
		margin: 0.8rem 0;
		color: #aaa49b;
		font-size: 0.72rem;
		line-height: 1.45;
	}
	.state-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
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
		.hero-grid {
			grid-template-columns: 1fr;
		}
		article > p {
			min-height: 0;
		}
	}
</style>
