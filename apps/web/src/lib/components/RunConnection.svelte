<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		AuthoritativeEvent,
		EngineCursorGap,
		EngineStreamReady,
		ReturnRecap
	} from '@summonlab/contracts';
	import { onMount } from 'svelte';

	let {
		runId,
		initialCursor,
		onRefresh,
		onEvent
	}: {
		runId: string;
		initialCursor: number;
		onRefresh?: () => void | Promise<void>;
		onEvent?: (event: AuthoritativeEvent) => void;
	} = $props();

	let status = $state<'connecting' | 'live' | 'reconnecting' | 'offline' | 'resyncing'>(
		'connecting'
	);
	// svelte-ignore state_referenced_locally
	let currentCursor = $state(initialCursor);
	let recap = $state<ReturnRecap | null>(null);
	let recapOpen = $state(false);
	let eventSource: EventSource | null = null;
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	let disposed = false;
	// svelte-ignore state_referenced_locally
	const seenKey = `summonlab:observed-cursor:${runId}`;

	const statusLabel = $derived(
		status === 'live'
			? 'Live'
			: status === 'offline'
				? 'Offline · read only'
				: status === 'resyncing'
					? 'Refreshing history'
					: status === 'reconnecting'
						? 'Reconnecting'
						: 'Connecting'
	);

	function storedCursor(): number | null {
		const raw = localStorage.getItem(seenKey);
		if (raw === null || !/^\d+$/u.test(raw)) return null;
		const value = Number(raw);
		return Number.isSafeInteger(value) ? value : null;
	}

	function remember(cursor: number) {
		const existing = storedCursor() ?? 0;
		localStorage.setItem(seenKey, String(Math.max(existing, cursor)));
	}

	function scheduleRefresh() {
		if (!onRefresh) return;
		if (refreshTimer) clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => void onRefresh(), 120);
	}

	async function loadRecap(afterCursor: number) {
		const response = await fetch(`/api/runs/${runId}/recap?after=${afterCursor}`);
		if (response.status === 409) {
			remember(initialCursor);
			return;
		}
		if (!response.ok) return;
		const result = (await response.json()) as ReturnRecap;
		if (result.eventCount > 0 && result.toCursor > afterCursor) {
			recap = result;
			recapOpen = true;
		}
	}

	function connect(afterCursor: number) {
		if (disposed) return;
		status = navigator.onLine ? 'connecting' : 'offline';
		eventSource = new EventSource(`/api/runs/${runId}/events?after=${afterCursor}`);
		eventSource.addEventListener('ready', (message) => {
			const ready = JSON.parse((message as MessageEvent<string>).data) as EngineStreamReady;
			if (ready.runId !== runId) return;
			status = 'live';
		});
		eventSource.addEventListener('engine-event', (message) => {
			const event = JSON.parse((message as MessageEvent<string>).data) as AuthoritativeEvent;
			if (event.runId !== runId || !Number.isSafeInteger(event.sequence)) return;
			currentCursor = Math.max(currentCursor, event.sequence);
			if (!recapOpen) remember(currentCursor);
			status = 'live';
			onEvent?.(event);
			scheduleRefresh();
		});
		eventSource.addEventListener('cursor-gap', (message) => {
			const gap = JSON.parse((message as MessageEvent<string>).data) as EngineCursorGap;
			status = 'resyncing';
			eventSource?.close();
			remember(gap.latestCursor);
			window.location.reload();
		});
		eventSource.addEventListener('stream-error', () => {
			status = navigator.onLine ? 'reconnecting' : 'offline';
		});
		eventSource.onerror = () => {
			status = navigator.onLine ? 'reconnecting' : 'offline';
		};
	}

	function dismissRecap() {
		if (recap) remember(Math.max(recap.toCursor, currentCursor));
		recapOpen = false;
	}

	onMount(() => {
		const boot = async () => {
			const prior = storedCursor();
			if (prior === null) remember(initialCursor);
			else if (prior <= initialCursor) await loadRecap(prior);
			else localStorage.setItem(seenKey, String(initialCursor));
			connect(initialCursor);
		};
		void boot();
		const online = () => {
			if (status === 'offline') status = 'reconnecting';
		};
		const offline = () => (status = 'offline');
		window.addEventListener('online', online);
		window.addEventListener('offline', offline);
		return () => {
			disposed = true;
			if (!recapOpen) remember(currentCursor);
			eventSource?.close();
			if (refreshTimer) clearTimeout(refreshTimer);
			window.removeEventListener('online', online);
			window.removeEventListener('offline', offline);
		};
	});
</script>

<div
	class:live={status === 'live'}
	class:offline={status === 'offline'}
	class="presence"
	data-testid="run-connection"
>
	<i></i><span>{statusLabel}</span><code>#{currentCursor}</code>
</div>

{#if recap && recapOpen}
	<div class="veil">
		<div
			class="recap"
			role="dialog"
			aria-modal="true"
			aria-labelledby="return-title"
			data-testid="return-recap"
		>
			<header>
				<div>
					<p>While you were away · events {recap.fromCursor + 1}–{recap.toCursor}</p>
					<h2 id="return-title">{recap.headline}</h2>
				</div>
				<span
					>{recap.spanGameMinutes >= 60
						? `${Math.round((recap.spanGameMinutes / 60) * 10) / 10}h`
						: `${recap.spanGameMinutes}m`} game time</span
				>
			</header>

			<p class="summary">{recap.summary}</p>

			<div class="metrics" aria-label="Return summary">
				<div><strong>{recap.counts.routinesCompleted}</strong><span>routines</span></div>
				<div><strong>{recap.counts.plansCreated}</strong><span>plans</span></div>
				<div><strong>{recap.counts.activitiesCompleted}</strong><span>activities</span></div>
				<div><strong>{recap.counts.travelArrivals}</strong><span>arrivals</span></div>
			</div>

			{#if recap.deltas.length > 0}
				<div class="deltas" aria-label="Net changes">
					<span>Net changes</span>
					{#each recap.deltas as delta (`${delta.ownerId}-${delta.kind}-${delta.key}`)}
						<code>{delta.key} <strong>{delta.delta > 0 ? '+' : ''}{delta.delta}</strong></code>
					{/each}
				</div>
			{/if}

			<ol>
				{#each recap.highlights as highlight (highlight.journalEntryId)}
					<li>
						<code>#{highlight.replayCursor}</code>
						<div>
							<strong>{highlight.title.replaceAll('.', ' ')}</strong>
							<p>{highlight.summary}</p>
						</div>
						<span>{highlight.source.source}</span>
					</li>
				{/each}
			</ol>

			{#if recap.omittedEventCount > 0}
				<small
					>{recap.omittedEventCount} additional events were condensed; the full authoritative log remains
					in Replay.</small
				>
			{/if}
			<footer>
				<a href={resolve('/replay/[runId]', { runId })} onclick={dismissRecap}>Inspect full log</a>
				<button type="button" onclick={dismissRecap}>Continue to settlement</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.presence {
		position: fixed;
		z-index: 70;
		top: 5.8rem;
		right: 1rem;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.42rem 0.62rem;
		border: 1px solid rgba(212, 166, 83, 0.22);
		background: rgba(8, 10, 15, 0.88);
		box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.25);
		backdrop-filter: blur(12px);
	}
	.presence i {
		width: 0.38rem;
		height: 0.38rem;
		border-radius: 50%;
		background: #d4a653;
		box-shadow: 0 0 0.7rem rgba(212, 166, 83, 0.75);
	}
	.presence.live i {
		background: #78d7af;
		box-shadow: 0 0 0.7rem rgba(120, 215, 175, 0.8);
	}
	.presence.offline i {
		background: #f2938f;
	}
	.presence span,
	.presence code {
		font-size: 0.5rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.presence span {
		color: rgba(244, 240, 232, 0.56);
	}
	.presence code {
		color: #78d7af;
	}
	.veil {
		position: fixed;
		z-index: 120;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background:
			radial-gradient(circle at 68% 18%, rgba(86, 157, 170, 0.2), transparent 30rem),
			rgba(4, 5, 8, 0.86);
		backdrop-filter: blur(16px);
	}
	.recap {
		width: min(56rem, 100%);
		max-height: calc(100vh - 3rem);
		overflow: auto;
		border: 1px solid rgba(212, 166, 83, 0.35);
		background: linear-gradient(135deg, rgba(212, 166, 83, 0.08), transparent 38%), #0a0c12;
		box-shadow: 0 3rem 9rem rgba(0, 0, 0, 0.72);
	}
	.recap header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		padding: clamp(1.5rem, 4vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.recap header p,
	.recap h2,
	.summary,
	.recap li p {
		margin: 0;
	}
	.recap header p {
		margin-bottom: 0.55rem;
		color: #d4a653;
		font-size: 0.56rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.recap h2 {
		max-width: 15ch;
		font:
			400 clamp(2rem, 5vw, 4rem)/0.94 Georgia,
			serif;
		letter-spacing: -0.045em;
	}
	.recap header > span {
		color: #7fd8e9;
		font:
			0.62rem ui-monospace,
			monospace;
		white-space: nowrap;
	}
	.summary {
		padding: 1.2rem clamp(1.5rem, 4vw, 3rem);
		color: rgba(244, 240, 232, 0.62);
		font:
			400 0.82rem/1.7 Georgia,
			serif;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin: 0 clamp(1.5rem, 4vw, 3rem) 1rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.metrics div {
		padding: 0.9rem;
		border-right: 1px solid rgba(255, 255, 255, 0.07);
	}
	.metrics div:last-child {
		border: 0;
	}
	.metrics strong,
	.metrics span {
		display: block;
	}
	.metrics strong {
		color: #7fd8e9;
		font:
			400 1.5rem Georgia,
			serif;
	}
	.metrics span {
		margin-top: 0.2rem;
		color: rgba(244, 240, 232, 0.34);
		font-size: 0.48rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.deltas {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
		padding: 0 clamp(1.5rem, 4vw, 3rem) 1rem;
	}
	.deltas > span {
		margin-right: 0.3rem;
		color: rgba(244, 240, 232, 0.35);
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.deltas code {
		padding: 0.38rem 0.5rem;
		border: 1px solid rgba(120, 215, 175, 0.2);
		color: rgba(244, 240, 232, 0.55);
		font-size: 0.56rem;
	}
	.deltas strong {
		color: #78d7af;
	}
	.recap ol {
		margin: 0;
		padding: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		list-style: none;
	}
	.recap li {
		display: grid;
		grid-template-columns: 2.6rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem clamp(1.5rem, 4vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.recap li > code {
		color: #6c8b95;
		font-size: 0.56rem;
	}
	.recap li strong {
		font:
			400 0.78rem Georgia,
			serif;
		text-transform: capitalize;
	}
	.recap li p {
		margin-top: 0.25rem;
		color: rgba(244, 240, 232, 0.43);
		font-size: 0.58rem;
		line-height: 1.45;
	}
	.recap li > span {
		color: #d4a653;
		font-size: 0.48rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.recap > small {
		display: block;
		padding: 0.8rem clamp(1.5rem, 4vw, 3rem) 0;
		color: rgba(244, 240, 232, 0.35);
		font-size: 0.56rem;
	}
	.recap footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.8rem;
		padding: 1.3rem clamp(1.5rem, 4vw, 3rem);
	}
	.recap footer a,
	.recap footer button {
		padding: 0.72rem 0.9rem;
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.recap footer a {
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: rgba(244, 240, 232, 0.55);
	}
	.recap footer button {
		border: 1px solid #d4a653;
		background: #d4a653;
		color: #090a0e;
		cursor: pointer;
	}
	@media (max-width: 620px) {
		.recap header {
			align-items: start;
			flex-direction: column;
		}
		.metrics {
			grid-template-columns: 1fr 1fr;
		}
		.metrics div:nth-child(2) {
			border-right: 0;
		}
		.metrics div:nth-child(-n + 2) {
			border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		}
		.recap li {
			grid-template-columns: 2.2rem 1fr;
		}
		.recap li > span {
			grid-column: 2;
		}
		.recap footer {
			align-items: stretch;
			flex-direction: column;
			text-align: center;
		}
	}
</style>
