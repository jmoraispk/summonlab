<script lang="ts">
	import { onMount } from 'svelte';
	import {
		declinePlaytestAnalytics,
		grantPlaytestAnalytics,
		loadLocalPlaytestConsent,
		loadPlaytestConsentSummary,
		withdrawPlaytestAnalytics,
		type LocalPlaytestConsent
	} from '$lib/playtest-analytics';

	let { compact = false }: { compact?: boolean } = $props();
	let consent = $state<LocalPlaytestConsent>({ decision: 'undecided' });
	let retainedEventCount = $state<number | null>(null);
	let pending = $state(false);
	let message = $state('');
	let errorMessage = $state('');

	onMount(() => {
		consent = loadLocalPlaytestConsent();
		if (consent.decision === 'granted') void refreshSummary();
	});

	async function refreshSummary() {
		const summary = await loadPlaytestConsentSummary();
		retainedEventCount = summary?.retainedEventCount ?? null;
	}

	async function grant() {
		pending = true;
		message = '';
		errorMessage = '';
		try {
			consent = await grantPlaytestAnalytics();
			message = 'Sharing is on for this device. You can withdraw and delete it here at any time.';
			await refreshSummary();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Consent could not be saved.';
		} finally {
			pending = false;
		}
	}

	function decline() {
		consent = declinePlaytestAnalytics();
		message = 'Sharing is off. The game remains fully playable.';
		errorMessage = '';
	}

	async function withdraw() {
		pending = true;
		message = '';
		errorMessage = '';
		try {
			const result = await withdrawPlaytestAnalytics();
			consent = { decision: 'declined' };
			retainedEventCount = 0;
			message = `${result.deletedEventCount} stored event${result.deletedEventCount === 1 ? '' : 's'} deleted. Sharing is off.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Stored data could not be deleted.';
		} finally {
			pending = false;
		}
	}
</script>

<section class:compact class="consent" data-testid="playtest-consent">
	<header>
		<div>
			<span>Optional · private playtest</span>
			<h3>Share a small journey record?</h3>
		</div>
		<strong class:active={consent.decision === 'granted'}>
			{consent.decision === 'granted' ? 'Sharing on' : 'Sharing off'}
		</strong>
	</header>

	{#if consent.decision === 'undecided'}
		<p>
			If you are 18 or older, you may share a random run ID, route milestones, phone/desktop
			category, selected control mode, and reconnect timing for 30 days. This is voluntary and does
			not change the game.
		</p>
	{:else if consent.decision === 'granted'}
		<p>
			Sharing is active until {new Date(consent.expiresAt).toLocaleDateString()}. {retainedEventCount ===
			null
				? 'Stored-event count is loading.'
				: `${retainedEventCount} allowlisted events are currently stored.`}
		</p>
	{:else}
		<p>No playtest analytics are sent. You can change this choice whenever you are ready.</p>
	{/if}

	<details>
		<summary>Exactly what is—and is not—shared</summary>
		<ul>
			<li>
				Shared: random run ID, journey stage, coarse viewport, selected control mode, and bounded
				timing.
			</li>
			<li>Never shared: names, seed, questions, hero replies, IP address, or user agent.</li>
			<li>No third-party analytics, advertising identifiers, cookies, or canonical game events.</li>
			<li>Withdraw here to delete retained sessions and events immediately.</li>
		</ul>
	</details>

	<div class="actions">
		{#if consent.decision === 'granted'}
			<button type="button" onclick={withdraw} disabled={pending}>Withdraw and delete</button>
		{:else}
			<button class="primary" type="button" onclick={grant} disabled={pending}>
				{pending ? 'Saving…' : 'I’m 18+ · share playtest data'}
			</button>
			{#if consent.decision === 'undecided'}
				<button type="button" onclick={decline}>Play without sharing</button>
			{/if}
		{/if}
	</div>
	{#if message}<p class="message" role="status">{message}</p>{/if}
	{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
</section>

<style>
	.consent {
		padding: 1rem 0;
		border-top: 1px solid rgba(238, 211, 154, 0.15);
		border-bottom: 1px solid rgba(238, 211, 154, 0.15);
		color: rgba(245, 234, 212, 0.68);
	}
	.consent header {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		justify-content: space-between;
	}
	.consent span {
		display: block;
		color: #d0733b;
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.consent h3 {
		margin: 0.25rem 0 0;
		color: #f5ead4;
		font-family: Georgia, serif;
		font-size: 1.05rem;
		font-weight: 400;
	}
	.consent header strong {
		padding: 0.3rem 0.45rem;
		border: 1px solid rgba(238, 211, 154, 0.2);
		color: rgba(245, 234, 212, 0.5);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.consent header strong.active {
		border-color: rgba(92, 188, 128, 0.55);
		color: #82d5a2;
	}
	.consent > p,
	.consent li {
		font-size: 0.7rem;
		line-height: 1.55;
	}
	.consent > p {
		margin: 0.65rem 0;
	}
	.consent details {
		font-size: 0.65rem;
	}
	.consent summary {
		color: #e0a66e;
		cursor: pointer;
	}
	.consent ul {
		margin: 0.55rem 0 0;
		padding-left: 1.2rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.8rem;
	}
	.actions button {
		padding: 0.58rem 0.72rem;
		border: 1px solid rgba(238, 211, 154, 0.24);
		background: transparent;
		color: rgba(245, 234, 212, 0.72);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.actions button.primary {
		border-color: rgba(224, 139, 68, 0.72);
		background: rgba(190, 76, 28, 0.18);
		color: #ffe1ad;
	}
	.actions button:disabled {
		cursor: wait;
		opacity: 0.55;
	}
	.message {
		color: #82d5a2;
	}
	.error {
		color: #ff987c;
	}
	.compact {
		margin-top: 1rem;
		padding: 0.8rem;
		border: 1px solid rgba(238, 211, 154, 0.15);
		background: rgba(8, 8, 8, 0.7);
	}
	@media (max-width: 650px) {
		.actions {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
