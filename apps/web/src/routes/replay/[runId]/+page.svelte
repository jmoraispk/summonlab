<script lang="ts">
	let { data } = $props();
	const report = $derived(data.report);
	const state = $derived(report.snapshot.state);
	const heroCount = $derived(Object.keys(state.heroes).length);
</script>

<svelte:head>
	<title>Replay {report.runId.slice(0, 8)} · summonlab</title>
</svelte:head>

<main>
	<header>
		<p>Development replay inspector</p>
		<h1>Public audit projection</h1>
		<span class:failed={!report.verified} data-testid="replay-status">
			{report.verified ? 'Verified' : 'Failed'} · {report.hashMatchesPersistedSnapshot
				? 'snapshot agrees'
				: 'snapshot differs'}
		</span>
	</header>

	<section class="facts">
		<article><small>Run</small><code>{report.runId}</code></article>
		<article><small>Schema</small><strong>v{state.schemaVersion}</strong></article>
		<article><small>Version</small><strong>{state.version}</strong></article>
		<article><small>Cursor</small><strong data-testid="replay-event-cursor">{state.eventCursor}</strong></article>
		<article><small>Heroes</small><strong>{heroCount}</strong></article>
		<article><small>Events</small><strong>{report.eventCount}</strong></article>
	</section>

	<section>
		<h2>Public state</h2>
		<p>
			{state.status} · {state.simulatedAt} · mission {state.mission.binding.missionId}
		</p>
		<code>{report.snapshot.stateHash}</code>
	</section>

	<section>
		<h2>Replay checks</h2>
		<ol>
			{#each report.checks as check (check.sequence)}
				<li>
					<span>#{check.sequence} · {check.eventType}</span>
					<p>{check.summary}</p>
					<code>{check.afterStateHash.slice(0, 16)}</code>
				</li>
			{/each}
		</ol>
	</section>
</main>

<style>
	:global(body) { margin: 0; background: #090c12; color: #eee9df; font-family: Inter, sans-serif; }
	main { width: min(72rem, calc(100% - 2rem)); margin: 0 auto; padding: 3rem 0 6rem; }
	header { display: flex; align-items: baseline; gap: 1rem; border-bottom: 1px solid #2c3544; }
	header p, header h1 { margin: 0 0 1rem; }
	header p, small { color: #bca36e; text-transform: uppercase; letter-spacing: .1em; font-size: .7rem; }
	header span { margin-left: auto; color: #7bdba6; }
	header span.failed { color: #ef8b82; }
	.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: .75rem; margin: 1.5rem 0; }
	article, section { border: 1px solid #283140; background: #101722; padding: 1rem; }
	article { display: grid; gap: .5rem; }
	section + section { margin-top: 1rem; }
	code { color: #85cde0; overflow-wrap: anywhere; }
	ol { margin: 0; padding: 0; list-style: none; }
	li { display: grid; grid-template-columns: minmax(10rem, .6fr) 1fr auto; gap: 1rem; padding: .8rem 0; border-top: 1px solid #283140; }
	li p { margin: 0; color: #aeb6c2; }
	@media (max-width: 42rem) { li { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } header span { margin: 0 0 1rem; } }
</style>
