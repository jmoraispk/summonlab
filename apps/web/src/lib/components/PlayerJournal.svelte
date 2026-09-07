<script lang="ts">
	import type {
		DecisionSource,
		PlayerJournalEntry,
		PlayerJournalFacet
	} from '@summonlab/contracts';
	import type { PublicPlayerJournalReport } from '$lib/public-engine';

	let {
		journal,
		actorLabels = {}
	}: { journal: PublicPlayerJournalReport; actorLabels?: Record<string, string> } = $props();

	let facet = $state<'all' | PlayerJournalFacet>('all');
	let day = $state('all');
	let mission = $state('all');
	let floor = $state('all');
	let hero = $state('all');
	let eventType = $state('all');
	let source = $state<'all' | DecisionSource>('all');

	const visibleEntries = $derived(
		journal.entries
			.filter((entry) => {
				if (facet !== 'all' && !entry.facets.includes(facet)) return false;
				if (day !== 'all' && entry.dayNumber !== Number(day)) return false;
				if (mission !== 'all' && entry.mission?.missionId !== mission) return false;
				if (floor !== 'all' && entry.mission?.floor !== Number(floor)) return false;
				if (hero !== 'all' && !entry.participantIds.includes(hero)) return false;
				if (eventType !== 'all' && entry.eventType !== eventType) return false;
				if (source !== 'all' && entry.source.source !== source) return false;
				return true;
			})
			.slice()
			.reverse()
	);

	const facets: Array<{ id: 'all' | PlayerJournalFacet; label: string }> = [
		{ id: 'all', label: 'All' },
		{ id: 'action', label: 'Actions' },
		{ id: 'combat', label: 'Combat' },
		{ id: 'reward', label: 'Rewards' },
		{ id: 'progression', label: 'Growth' },
		{ id: 'party', label: 'Party' },
		{ id: 'control', label: 'Control' },
		{ id: 'direction', label: 'Direction' },
		{ id: 'story', label: 'Story' },
		{ id: 'failure', label: 'Losses' }
	];

	function deltaTotal(kind: PlayerJournalEntry['deltas'][number]['kind']) {
		return journal.deltaTotals
			.filter((delta) => delta.kind === kind)
			.reduce((total, delta) => total + delta.delta, 0);
	}

	function signed(value: number) {
		return `${value >= 0 ? '+' : ''}${value}`;
	}

	function labelFor(actorId: string) {
		return actorLabels[actorId] ?? actorId.slice(0, 8);
	}

	function readable(value: string) {
		return value.replaceAll('-', ' ').replaceAll('.', ' ');
	}

	function stamp(value: string) {
		return `${value.slice(0, 10)} · ${value.slice(11, 16)} UTC`;
	}

	function resetFilters() {
		facet = 'all';
		day = 'all';
		mission = 'all';
		floor = 'all';
		hero = 'all';
		eventType = 'all';
		source = 'all';
	}
</script>

<section class="journal-shell" data-testid="player-journal">
	<header>
		<div>
			<span>Authoritative player journal</span>
			<h2>The company remembers</h2>
			<p>Every number is projected from replayable events—not generated narration.</p>
		</div>
		<div class="binding">
			<small>Event stream</small>
			<code>{journal.publicJournalHash.slice(0, 12)}</code>
			<strong>{journal.entryCount} transitions</strong>
			<small>cursor #{journal.fromCursor}—#{journal.toCursor}</small>
		</div>
	</header>

	<div class="totals" aria-label="Party progression totals">
		<article>
			<span>Experience</span>
			<strong>{signed(deltaTotal('experience'))} XP</strong>
			<small>{signed(deltaTotal('level'))} levels</small>
		</article>
		<article>
			<span>Rewards</span>
			<strong>{signed(deltaTotal('resource'))}</strong>
			<small>{signed(deltaTotal('item'))} items</small>
		</article>
		<article>
			<span>Tower cadence</span>
			<strong>{journal.partyTotals.roundsResolved} rounds</strong>
			<small>{journal.partyTotals.attemptsStarted} attempts</small>
		</article>
		<article>
			<span>Discovery</span>
			<strong>{journal.partyTotals.discoveries} found</strong>
			<small>{journal.partyTotals.objectivesCompleted} objectives</small>
		</article>
		<article class:danger={journal.partyTotals.casualties > 0}>
			<span>Outcomes</span>
			<strong>{journal.partyTotals.successfulExtractions} cleared</strong>
			<small>{journal.partyTotals.casualties} casualties</small>
		</article>
	</div>

	<nav class="facet-bar" aria-label="Journal facets">
		{#each facets as option (option.id)}
			<button
				type="button"
				class:active={facet === option.id}
				onclick={() => (facet = option.id)}
				data-testid={`journal-filter-facet-${option.id}`}
			>
				{option.label}
			</button>
		{/each}
	</nav>

	<div class="filter-grid">
		<label>
			<span>Day</span>
			<select bind:value={day} data-testid="journal-filter-day">
				<option value="all">Any day</option>
				{#each journal.filterOptions.days as option (option)}
					<option value={String(option)}>Day {option}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Mission</span>
			<select bind:value={mission} data-testid="journal-filter-mission">
				<option value="all">Any mission</option>
				{#each journal.filterOptions.missionIds as option (option)}
					<option value={option}>{readable(option)}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Floor</span>
			<select bind:value={floor} data-testid="journal-filter-floor">
				<option value="all">Any floor</option>
				{#each journal.filterOptions.floors as option (option)}
					<option value={String(option)}>Floor {String(option).padStart(2, '0')}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Hero</span>
			<select bind:value={hero} data-testid="journal-filter-hero">
				<option value="all">Any hero</option>
				{#each journal.filterOptions.heroIds as option (option)}
					<option value={option}>{labelFor(option)}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Event</span>
			<select bind:value={eventType} data-testid="journal-filter-event">
				<option value="all">Any event</option>
				{#each journal.filterOptions.eventTypes as option (option)}
					<option value={option}>{readable(option)}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Control source</span>
			<select bind:value={source} data-testid="journal-filter-source">
				<option value="all">Any source</option>
				{#each journal.filterOptions.sources as option (option)}
					<option value={option}>{readable(option)}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="result-bar">
		<strong data-testid="journal-visible-count">{visibleEntries.length}</strong>
		<span>of {journal.entryCount} entries visible</span>
		<button type="button" onclick={resetFilters}>Clear filters</button>
	</div>

	{#if visibleEntries.length === 0}
		<div class="empty">
			<strong>No events match this lens.</strong>
			<p>The event stream is intact. Clear one or more filters to widen the view.</p>
		</div>
	{:else}
		<div class="entries">
			{#each visibleEntries as entry (entry.journalEntryId)}
				<article class="entry" data-testid="journal-entry">
					<div class="cursor">
						<strong>#{entry.replayCursor}</strong>
						<span>DAY {String(entry.dayNumber).padStart(2, '0')}</span>
					</div>
					<div class="entry-body">
						<div class="entry-meta">
							<span>{stamp(entry.gameTime)}</span>
							<span class="event-type">{entry.eventType}</span>
							{#if entry.mission}
								<span>{readable(entry.mission.missionId)}</span>
								{#if entry.mission.floor}<span>FLOOR {entry.mission.floor}</span>{/if}
								{#if entry.mission.roundNumber !== null}
									<span>ROUND {entry.mission.roundNumber}</span>
								{/if}
							{/if}
						</div>
						<h3>{entry.title}</h3>
						<p class="summary">{entry.summary}</p>

						{#if entry.actions.length > 0}
							<div class="action-list">
								{#each entry.actions as action (`${action.actorId}:${action.actionId}`)}
									<div>
										<span>{action.actorKind} · {action.decisionSource}</span>
										<strong>{labelFor(action.actorId)} → {readable(action.actionId)}</strong>
										<small>{action.publicIntent}</small>
									</div>
								{/each}
							</div>
						{/if}

						{#if entry.deltas.length > 0 || entry.partyProgressDeltas.length > 0}
							<div class="delta-list">
								{#each entry.deltas as delta (`${delta.ownerId}:${delta.kind}:${delta.key}`)}
									<div data-testid="journal-delta">
										<span>{labelFor(delta.ownerId)} · {readable(delta.kind)}</span>
										<strong>{readable(delta.key)}</strong>
										<code>{delta.before} → {delta.after} ({signed(delta.delta)})</code>
									</div>
								{/each}
								{#each entry.partyProgressDeltas as delta (`party:${delta.kind}:${delta.key}`)}
									<div data-testid="journal-delta">
										<span>Company · party progress</span>
										<strong>{readable(delta.kind)}</strong>
										<code>{delta.before} → {delta.after} ({signed(delta.delta)})</code>
									</div>
								{/each}
							</div>
						{/if}

						{#if entry.directions.length > 0}
							<div class="direction-list">
								{#each entry.directions as direction (direction.directionId)}
									<blockquote data-testid="journal-direction">
										<span>{direction.kind} · {readable(direction.outcome)}</span>
										<p>“{direction.text}”</p>
										<small>{direction.rationale}</small>
									</blockquote>
								{/each}
							</div>
						{/if}

						{#if entry.storyChanges.length > 0}
							<div class="story-list">
								{#each entry.storyChanges as change (`${change.kind}:${change.key}:${change.after}`)}
									<div data-testid="journal-story-change">
										<span>{readable(change.kind)}</span>
										<strong>{change.summary}</strong>
										<small>{change.before ?? 'Unwritten'} → {change.after}</small>
									</div>
								{/each}
							</div>
						{/if}
					</div>
					<aside>
						<div class="facets">
							{#each entry.facets as tag (tag)}<span class:failure={tag === 'failure'}>{tag}</span
								>{/each}
						</div>
						<code>{entry.publicEntryHash.slice(0, 10)}</code>
						<small>
							{entry.source.source}{entry.source.timing ? ` · ${entry.source.timing}` : ''}
						</small>
					</aside>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.journal-shell {
		margin: clamp(2rem, 5vw, 5rem) 4vw;
		border: 1px solid #2b3334;
		background:
			linear-gradient(90deg, rgba(220, 164, 71, 0.035) 1px, transparent 1px) 0 0 / 4rem 100%,
			#0b0f10;
		box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, 0.35);
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		padding: clamp(1.4rem, 3vw, 2.6rem);
		border-bottom: 1px solid #2b3334;
	}
	header span,
	.totals span,
	.filter-grid label > span,
	.entry-meta,
	.action-list span,
	.delta-list span,
	.direction-list span,
	.story-list span {
		color: #ca9a4b;
		font-size: 0.61rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	header h2 {
		margin: 0.3rem 0;
		font:
			400 clamp(2.2rem, 4vw, 4.3rem) / 0.95 Georgia,
			serif;
		letter-spacing: -0.045em;
	}
	header p {
		margin: 0;
		color: #87908e;
		font-size: 0.78rem;
	}
	.binding {
		min-width: 10rem;
		display: grid;
		align-content: center;
		gap: 0.35rem;
		text-align: right;
	}
	.binding small,
	.binding code {
		color: #74807e;
		font-size: 0.62rem;
	}
	.binding strong {
		color: #58c8c3;
		font:
			400 1.15rem Georgia,
			serif;
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		border-bottom: 1px solid #2b3334;
	}
	.totals article {
		min-height: 7rem;
		padding: 1rem;
		border-right: 1px solid #242b2c;
		display: grid;
		align-content: space-between;
	}
	.totals article:last-child {
		border: 0;
	}
	.totals strong {
		font:
			400 clamp(1.35rem, 2.5vw, 2.1rem) Georgia,
			serif;
	}
	.totals small {
		color: #7c8785;
	}
	.totals .danger strong,
	.totals .danger small {
		color: #ef8068;
	}
	.facet-bar {
		display: flex;
		gap: 0.4rem;
		padding: 1rem;
		overflow-x: auto;
		border-bottom: 1px solid #242b2c;
	}
	.facet-bar button,
	.result-bar button {
		border: 1px solid #30393a;
		background: #101516;
		color: #8c9795;
		padding: 0.55rem 0.75rem;
		font: inherit;
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.facet-bar button.active {
		border-color: #d09d4b;
		background: #d09d4b;
		color: #171108;
		font-weight: 800;
	}
	.filter-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.75rem;
		padding: 1rem;
		border-bottom: 1px solid #242b2c;
	}
	.filter-grid label {
		display: grid;
		gap: 0.35rem;
	}
	.filter-grid select {
		min-width: 0;
		border: 1px solid #30393a;
		background: #101516;
		color: #d8d4ca;
		padding: 0.55rem;
		font: inherit;
		font-size: 0.68rem;
	}
	.result-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		color: #74807e;
		font-size: 0.65rem;
	}
	.result-bar strong {
		color: #5dcdc7;
		font-size: 1rem;
	}
	.result-bar button {
		margin-left: auto;
		padding: 0.4rem 0.6rem;
	}
	.entries {
		border-top: 1px solid #242b2c;
	}
	.entry {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr) minmax(8rem, 13rem);
		border-bottom: 1px solid #242b2c;
	}
	.entry:last-child {
		border-bottom: 0;
	}
	.cursor {
		padding: 1.2rem 1rem;
		border-right: 1px solid #242b2c;
		display: grid;
		align-content: start;
		gap: 0.25rem;
	}
	.cursor strong {
		color: #d8a452;
		font:
			400 1.35rem Georgia,
			serif;
	}
	.cursor span {
		color: #616c6b;
		font-size: 0.55rem;
		letter-spacing: 0.12em;
	}
	.entry-body {
		padding: 1.2rem 1.4rem;
	}
	.entry-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		color: #667170;
	}
	.entry-body h3 {
		margin: 0.45rem 0 0.3rem;
		font:
			400 1.35rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.summary {
		margin: 0;
		color: #9ca5a2;
		font-size: 0.78rem;
		line-height: 1.55;
	}
	.action-list,
	.delta-list,
	.story-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.55rem;
		margin-top: 0.9rem;
	}
	.action-list > div,
	.delta-list > div,
	.story-list > div {
		border-left: 2px solid #385f5d;
		background: #101617;
		padding: 0.65rem 0.75rem;
		display: grid;
		gap: 0.2rem;
	}
	.delta-list > div {
		border-color: #bc8d45;
	}
	.story-list > div {
		border-color: #75649c;
	}
	.action-list strong,
	.delta-list strong,
	.story-list strong {
		font-size: 0.72rem;
		font-weight: 650;
		text-transform: capitalize;
	}
	.action-list small,
	.story-list small {
		color: #7c8785;
		font-size: 0.65rem;
		line-height: 1.4;
	}
	.delta-list code {
		color: #d8c394;
		font-size: 0.67rem;
	}
	.direction-list {
		margin-top: 0.9rem;
	}
	.direction-list blockquote {
		margin: 0;
		border: 1px solid #385f5d;
		background: linear-gradient(120deg, rgba(72, 175, 168, 0.08), transparent);
		padding: 0.8rem 1rem;
	}
	.direction-list p {
		margin: 0.35rem 0;
		font:
			italic 1rem Georgia,
			serif;
	}
	.direction-list small {
		color: #7c8785;
	}
	.entry aside {
		padding: 1.2rem 1rem;
		border-left: 1px solid #242b2c;
		display: grid;
		align-content: start;
		justify-items: end;
		gap: 0.75rem;
		text-align: right;
	}
	.facets {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.25rem;
	}
	.facets span {
		border: 1px solid #34403f;
		color: #76b8b3;
		padding: 0.2rem 0.35rem;
		font-size: 0.52rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.facets span.failure {
		border-color: #743f35;
		color: #ec806b;
	}
	.entry aside code,
	.entry aside small {
		color: #667170;
		font-size: 0.58rem;
	}
	.empty {
		padding: 3rem;
		text-align: center;
		border-top: 1px solid #242b2c;
	}
	.empty p {
		color: #74807e;
	}
	@media (max-width: 1050px) {
		.totals {
			grid-template-columns: repeat(3, 1fr);
		}
		.filter-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@media (max-width: 720px) {
		header {
			flex-direction: column;
		}
		.binding {
			text-align: left;
		}
		.totals {
			grid-template-columns: repeat(2, 1fr);
		}
		.filter-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.entry {
			grid-template-columns: 4.5rem 1fr;
		}
		.entry aside {
			grid-column: 2;
			border: 0;
			border-top: 1px solid #242b2c;
			justify-items: start;
			text-align: left;
		}
		.facets {
			justify-content: flex-start;
		}
	}
</style>
