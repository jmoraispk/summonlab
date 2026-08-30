<script lang="ts">
	import type { HuntFixtureResult } from './tower-combat';
	import type { FloorFixture, HeroFixture } from './tower-fixtures';

	let {
		result,
		floor,
		party,
		handoff,
		onVillage,
		onTraining
	}: {
		result: HuntFixtureResult;
		floor: FloorFixture;
		party: HeroFixture[];
		handoff: 'none' | 'village' | 'training';
		onVillage: () => void;
		onTraining: () => void;
	} = $props();

	function heroName(heroId: HeroFixture['id']): string {
		return party.find((hero) => hero.id === heroId)?.name ?? heroId;
	}
</script>

<section class="report" aria-labelledby="report-heading" data-testid="hunt-report">
	<header>
		<div>
			<p class="eyebrow">05 · Automatic return</p>
			<h2 id="report-heading">Haul secured</h2>
			<p>
				Floor {floor.number} explored · {result.encountersCompleted} encounters resolved
			</p>
		</div>
		<div class="return-code">
			<span>Exact return reason</span>
			<strong>{result.returnReason.code}</strong>
		</div>
	</header>

	<div class="reason" data-testid="return-reason" role="status">
		<span>Why the party returned</span>
		<code>{result.returnReason.code}</code>
		<strong>{result.returnReason.summary}</strong>
		{#if result.contributingReturnReasons.length > 0}
			<small>Also true: {result.contributingReturnReasons.join(', ')}</small>
		{/if}
	</div>

	<div class="summary-grid">
		<article>
			<span>Monster kills</span><strong>{result.speciesKills}</strong><small
				>{result.speciesKillCounts
					.map((entry) => `${entry.name} ×${entry.quantity}`)
					.join(' · ')}</small
			>
		</article>
		<article>
			<span>Inventory</span><strong>{result.inventoryUsed}/{result.inventoryCapacity}</strong><small
				>material units</small
			>
		</article>
		<article>
			<span>Threshold</span><strong>{result.selectedThreshold}%</strong><small
				>checked post-encounter</small
			>
		</article>
		<article>
			<span>Haul hash</span><strong>{result.haulHash}</strong><small>same seed, same haul</small>
		</article>
	</div>

	<div class="report-grid">
		<section aria-labelledby="materials-heading">
			<h3 id="materials-heading">Every material</h3>
			<ul class="materials">
				{#each result.materialHaul as material (material.materialId)}
					<li><span>{material.name}</span><strong>×{material.quantity}</strong></li>
				{/each}
			</ul>
			{#if result.firstClearClaim}
				<div class="claim">
					<span>First-clear claim</span><strong>{result.firstClearClaim}</strong>
				</div>
			{:else}
				<div class="claim replay">
					<span>Repeat hunt</span><strong>No first-clear item or unlock claim</strong>
				</div>
			{/if}
		</section>

		<section aria-labelledby="progress-heading">
			<h3 id="progress-heading">Level XP and practical skills</h3>
			<ul class="progress-list">
				{#each result.levelXpClaims as xp (xp.heroId)}
					{@const practice = result.practicalSkillClaims.find(
						(claim) => claim.heroId === xp.heroId
					)!}
					<li>
						<div><strong>{heroName(xp.heroId)}</strong><small>{practice.skillName}</small></div>
						<div><span>+{xp.amount} level XP</span><span>{practice.uses} practical uses</span></div>
					</li>
				{/each}
			</ul>
		</section>
	</div>

	<section class="remaining" aria-labelledby="remaining-heading">
		<h3 id="remaining-heading">Remaining Health and Mana</h3>
		<div>
			{#each result.finalResources as resource (resource.unitId)}
				<article>
					<strong>{heroName(resource.unitId)}</strong>
					<span
						>Health {resource.health}/{resource.maxHealth} · {Math.round(
							(resource.health / resource.maxHealth) * 100
						)}%</span
					>
					<span>Mana {resource.mana}/{resource.maxMana}</span>
					<progress class="health" value={resource.health} max={resource.maxHealth}
						>{Math.round((resource.health / resource.maxHealth) * 100)}%</progress
					>
					<progress class="mana" value={resource.mana} max={resource.maxMana}
						>{Math.round((resource.mana / resource.maxMana) * 100)}%</progress
					>
				</article>
			{/each}
		</div>
		<p>
			Living Village resets Health and Mana after return. This fixture creates no injury, recovery
			timer, or death.
		</p>
	</section>

	<div class="actions">
		<button class="primary" type="button" onclick={onVillage}>Return to Village</button>
		<button type="button" onclick={onTraining}>Review safe Court training</button>
	</div>

	{#if handoff !== 'none'}
		<div class="handoff" data-testid="return-handoff" tabindex="-1">
			{#if handoff === 'village'}
				<span>Village return prepared</span>
				<strong>Destination · /living-village-lab</strong>
				<p>
					The party, haul claims, remaining-resource report, and return reason are ready for
					coordinator integration.
				</p>
			{:else}
				<span>Safe Court review prepared</span>
				<strong>Eligible heroes already selected</strong>
				<p>{result.trainingEligibleHeroIds.map(heroName).join(' · ')}</p>
				<small
					>Training remains a Village/Court-owned assignment; this route only prepares the handoff.</small
				>
			{/if}
		</div>
	{/if}
</section>

<style>
	.report {
		padding: clamp(1.25rem, 3vw, 2.25rem);
		border: 1px solid rgba(225, 188, 121, 0.28);
		background: linear-gradient(160deg, #17140f, #0c0e12 45%);
	}
	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}
	.eyebrow,
	.return-code span,
	.reason span,
	.summary-grid span,
	.claim span,
	.handoff span {
		margin: 0 0 0.45rem;
		color: #d99b54;
		font:
			0.68rem ui-monospace,
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	header h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: clamp(2.2rem, 5vw, 4rem);
		font-weight: 400;
	}
	header div > p:last-child {
		margin: 0.45rem 0 0;
		color: #99958c;
	}
	.return-code {
		padding: 0.9rem;
		border: 1px solid #8d6137;
		background: #281d13;
		text-align: right;
	}
	.return-code span,
	.return-code strong {
		display: block;
	}
	.return-code strong {
		font-size: 0.88rem;
	}
	.reason {
		margin-top: 1.2rem;
		padding: 1rem;
		border-left: 4px solid #d99b54;
		background: #231b13;
	}
	.reason strong,
	.reason small,
	.reason code {
		display: block;
	}
	.reason code {
		margin-bottom: 0.35rem;
		color: #e8b86f;
		font-size: 0.78rem;
	}
	.reason strong {
		font-family: Georgia, serif;
		font-size: 1.15rem;
		font-weight: 400;
		line-height: 1.45;
	}
	.reason small {
		margin-top: 0.4rem;
		color: #9b958b;
	}
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		margin-top: 1rem;
		background: #37332d;
	}
	.summary-grid article {
		padding: 1rem;
		background: #101216;
	}
	.summary-grid span,
	.summary-grid strong,
	.summary-grid small {
		display: block;
	}
	.summary-grid strong {
		font-family: Georgia, serif;
		font-size: 1.35rem;
		font-weight: 400;
	}
	.summary-grid small {
		margin-top: 0.2rem;
		color: #89857e;
		font-size: 0.65rem;
	}
	.report-grid {
		display: grid;
		grid-template-columns: 0.85fr 1.15fr;
		gap: 1rem;
		margin-top: 1rem;
	}
	.report-grid > section,
	.remaining {
		padding: 1rem;
		border: 1px solid #302f2d;
		background: #111317;
	}
	h3 {
		margin: 0 0 0.8rem;
		font-family: Georgia, serif;
		font-size: 1.15rem;
		font-weight: 400;
	}
	.materials,
	.progress-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.materials li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem;
		background: #0a0c0f;
	}
	.materials li + li {
		margin-top: 0.35rem;
	}
	.materials strong {
		color: #e8bd7c;
	}
	.claim {
		margin-top: 0.65rem;
		padding: 0.7rem;
		border: 1px solid #76502f;
		background: #211811;
	}
	.claim span,
	.claim strong {
		display: block;
	}
	.claim strong {
		font-size: 0.78rem;
	}
	.claim.replay {
		border-color: #3d3b37;
		background: #17181a;
	}
	.progress-list li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem;
		background: #0a0c0f;
	}
	.progress-list li + li {
		margin-top: 0.35rem;
	}
	.progress-list div strong,
	.progress-list div small,
	.progress-list div span {
		display: block;
	}
	.progress-list small,
	.progress-list div:last-child {
		color: #96918a;
		font-size: 0.68rem;
		text-align: right;
	}
	.remaining {
		margin-top: 1rem;
	}
	.remaining > div {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}
	.remaining article {
		padding: 0.8rem;
		background: #0a0c0f;
	}
	.remaining article strong,
	.remaining article span {
		display: block;
	}
	.remaining progress {
		appearance: none;
		display: block;
		width: 100%;
		height: 0.38rem;
		margin-top: 0.35rem;
		border: 0;
		accent-color: #5eb66d;
		background: #34383a;
	}
	.remaining progress.mana {
		accent-color: #5799d0;
	}
	.remaining progress::-webkit-progress-bar {
		background: #34383a;
	}
	.remaining progress.health::-webkit-progress-value {
		background: #5eb66d;
	}
	.remaining progress.mana::-webkit-progress-value {
		background: #5799d0;
	}
	.remaining progress.health::-moz-progress-bar {
		background: #5eb66d;
	}
	.remaining progress.mana::-moz-progress-bar {
		background: #5799d0;
	}
	.remaining article span {
		margin-top: 0.25rem;
		color: #99958d;
		font-size: 0.7rem;
	}
	.remaining > p {
		margin: 0.8rem 0 0;
		color: #88847d;
		font-size: 0.7rem;
	}
	.actions {
		position: sticky;
		bottom: -0.05rem;
		z-index: 5;
		display: flex;
		gap: 0.7rem;
		flex-wrap: wrap;
		margin-top: 1rem;
		padding: 0.65rem;
		border: 1px solid #4b3b2b;
		background: rgba(13, 15, 19, 0.98);
		box-shadow: 0 -0.75rem 1.5rem rgba(0, 0, 0, 0.35);
	}
	.actions button {
		min-height: 3.4rem;
		padding: 0.75rem 1.1rem;
		border: 1px solid #5c554b;
		background: #1a1b1e;
		color: #e6ded1;
		font-weight: 750;
		cursor: pointer;
	}
	.actions button.primary {
		min-width: min(20rem, 100%);
		border-color: #dda35c;
		background: #d99b54;
		color: #181006;
		font-size: 1rem;
	}
	.handoff {
		margin-top: 1rem;
		padding: 1rem;
		border: 1px solid #8c653d;
		background: #282016;
	}
	.handoff span,
	.handoff strong,
	.handoff small {
		display: block;
	}
	.handoff p {
		margin: 0.45rem 0 0;
		color: #b2aa9d;
	}
	.handoff small {
		margin-top: 0.4rem;
		color: #8e897f;
	}
	@media (max-width: 760px) {
		.report {
			padding: 0.75rem;
		}
		header {
			display: block;
		}
		.return-code {
			margin-top: 1rem;
			text-align: left;
		}
		.summary-grid,
		.report-grid,
		.remaining > div {
			grid-template-columns: 1fr;
		}
		.actions {
			display: grid;
			grid-template-columns: 1fr;
		}
		.actions button.primary {
			min-width: 0;
		}
	}
</style>
