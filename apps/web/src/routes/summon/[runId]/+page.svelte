<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		DecisionJobClientView,
		HeroConversationPresentation,
		HeroDecisionPreview,
		HeroPolicyResult,
		ProofRunSnapshot
	} from '@summonlab/contracts';
	import { onDestroy } from 'svelte';
	import EventJournal from '$lib/components/EventJournal.svelte';
	import HeroArtPlaceholder from '$lib/components/HeroArtPlaceholder.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let snapshot = $state<ProofRunSnapshot>(data.snapshot);
	// svelte-ignore state_referenced_locally
	let conversation = $state<HeroConversationPresentation | null>(data.conversation);
	// svelte-ignore state_referenced_locally
	let decisionPreview = $state<HeroDecisionPreview | null>(data.decisionPreview);
	let decisionPacket = $derived(decisionPreview?.packet ?? null);
	let modelResult = $state<HeroPolicyResult | null>(null);
	let requestingModel = $state(false);
	let modelRequestError = $state('');
	let decisionJob = $state<DecisionJobClientView | null>(null);
	let decisionJobError = $state('');
	let queueingDecisionJob = $state(false);
	let stage = $state(0);
	// svelte-ignore state_referenced_locally
	let directive = $state(snapshot.directive);
	let directiveScope = $state<'decision' | 'mission' | 'day' | 'until_revoked'>('decision');
	let directiveSending = $state(false);
	let directiveStatus = $state('');
	let countdown = $state(5);
	let deciding = $state(false);
	let errorMessage = $state('');
	let communicationError = $state('');
	let communicating = $state(false);
	let communicationKind = $state<'explain' | 'tell' | 'ask'>('explain');
	let communicationTopic = $state<
		'master-role' | 'summoning-situation' | 'tower-mission' | 'hero-memory'
	>('master-role');
	let communicationTone = $state<'neutral' | 'reassuring' | 'firm' | 'urgent' | 'apologetic'>(
		'reassuring'
	);
	let communicationDelivery = $state<'private' | 'open'>('private');
	let communicationText = $state(
		'I am the Master of Hearth 01. You were summoned here, but you are free to ask what this place demands.'
	);
	let conversationKind = $state<'say' | 'ask' | 'order'>('say');
	let conversationOrderIntent = $state<'train' | 'rest' | 'eat' | 'work' | 'prepare-tower'>(
		'train'
	);
	let conversationText = $state('Tell me what you think we should do next.');
	let conversationSending = $state(false);
	let conversationError = $state('');
	let countdownTimer: number | undefined;
	let decisionJobPollTimer: number | undefined;
	const outerRunes = Array.from({ length: 12 }, (_, index) => index);
	const innerRunes = Array.from({ length: 8 }, (_, index) => index);
	const destinationLabel = $derived(
		snapshot.destination === 'kitchen' ? 'the kitchen' : 'the training ground'
	);

	function beginReveal() {
		if (stage !== 0) return;
		stage = 1;
		window.setTimeout(() => (stage = 2), 850);
		window.setTimeout(() => {
			stage = 3;
			if (snapshot.destination) window.setTimeout(() => (stage = 4), 650);
			else if (snapshot.controlMode === 'countdown') beginCountdown();
		}, 1_650);
	}

	function beginCountdown() {
		if (countdownTimer) return;
		countdown = 5;
		countdownTimer = window.setInterval(() => {
			countdown -= 1;
			if (countdown <= 0) {
				window.clearInterval(countdownTimer);
				countdownTimer = undefined;
				void resolveDecision('countdown');
			}
		}, 1_000);
	}

	function chooseCommunicationTopic(
		topic: 'master-role' | 'summoning-situation' | 'tower-mission' | 'hero-memory'
	) {
		communicationTopic = topic;
		if (topic === 'hero-memory') {
			communicationKind = 'ask';
			communicationText = 'What is the last thing you remember before awakening here?';
		} else {
			communicationKind = topic === 'summoning-situation' ? 'tell' : 'explain';
			communicationText = {
				'master-role':
					'I am the Master of Hearth 01. You were summoned here, but you are free to ask what this place demands.',
				'summoning-situation':
					'You arrived through this gate as a new summon. I do not expect you to remember a life in this settlement.',
				'tower-mission':
					'Hearth 01 is preparing to climb a one-hundred-floor tower. Each floor is dangerous, and your choices can change how we face it.'
			}[topic];
		}
	}

	async function sendCommunication() {
		if (!conversation?.canCommunicate || communicating || !communicationText.trim()) return;
		communicating = true;
		communicationError = '';
		if (countdownTimer) {
			window.clearInterval(countdownTimer);
			countdownTimer = undefined;
		}
		try {
			const response = await fetch(`/api/runs/${snapshot.runId}/communications`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					targetHeroId: snapshot.manifest.characterId,
					kind: communicationKind,
					topic: communicationTopic,
					exactText: communicationText.trim(),
					tone: communicationTone,
					delivery: communicationDelivery
				})
			});
			const result = (await response.json()) as HeroConversationPresentation & {
				message?: string;
			};
			if (!response.ok) throw new Error(result.message ?? 'Those words could not be recorded.');
			conversation = result;
			await refreshDecisionPacket();
		} catch (error) {
			communicationError = error instanceof Error ? error.message : 'Communication failed.';
		} finally {
			communicating = false;
			if (snapshot.controlMode === 'countdown' && !snapshot.destination) beginCountdown();
		}
	}

	function chooseConversationKind(kind: 'say' | 'ask' | 'order') {
		conversationKind = kind;
		conversationText =
			kind === 'say'
				? 'We need to survive this place together. Tell me what you think we should do next.'
				: kind === 'ask'
					? 'What do you want to do next, and why?'
					: {
							train: 'Train at the practice ring before we enter the tower.',
							rest: 'Rest and recover before you take another risk.',
							eat: 'Eat a proper meal before making another decision.',
							work: 'Take a settlement duty and help stabilize Hearth 01.',
							'prepare-tower': 'Prepare yourself for our first tower mission.'
						}[conversationOrderIntent];
	}

	function chooseOrderIntent(intent: typeof conversationOrderIntent) {
		conversationOrderIntent = intent;
		if (conversationKind === 'order') chooseConversationKind('order');
	}

	async function sendConversation() {
		if (!conversation?.canCommunicate || conversationSending || !conversationText.trim()) return;
		conversationSending = true;
		conversationError = '';
		if (countdownTimer) {
			window.clearInterval(countdownTimer);
			countdownTimer = undefined;
		}
		try {
			const response = await fetch(`/api/runs/${snapshot.runId}/conversations`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					targetHeroId: snapshot.manifest.characterId,
					kind: conversationKind,
					exactText: conversationText.trim(),
					tone: communicationTone,
					delivery: communicationDelivery,
					orderIntent: conversationKind === 'order' ? conversationOrderIntent : null
				})
			});
			const result = (await response.json()) as HeroConversationPresentation & {
				message?: string;
			};
			if (!response.ok) throw new Error(result.message ?? 'The hero could not answer.');
			conversation = result;
			await refreshDecisionPacket();
		} catch (error) {
			conversationError = error instanceof Error ? error.message : 'Conversation failed.';
		} finally {
			conversationSending = false;
			if (snapshot.controlMode === 'countdown' && !snapshot.destination) beginCountdown();
		}
	}

	async function refreshDecisionPacket() {
		modelResult = null;
		modelRequestError = '';
		const response = await fetch(
			`/api/runs/${snapshot.runId}/decision-preview?heroId=${snapshot.manifest.characterId}`
		);
		if (!response.ok) {
			decisionPreview = null;
			return;
		}
		decisionPreview = (await response.json()) as HeroDecisionPreview;
	}

	async function recordScopedDirective() {
		if (!directive.trim() || directiveSending) return;
		directiveSending = true;
		directiveStatus = '';
		try {
			const priorities = [
				...new Set(
					directive
						.toLowerCase()
						.split(/[^a-z0-9]+/)
						.filter((term) => term.length >= 4)
				)
			].slice(0, 6);
			const response = await fetch(`/api/runs/${snapshot.runId}/directives`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'issue',
					text: directive.trim(),
					scope: directiveScope,
					recipientIds: [snapshot.manifest.characterId],
					priorities,
					tone: communicationTone,
					delivery: communicationDelivery
				})
			});
			const result = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(result.message ?? 'The direction could not be recorded.');
			directiveStatus = `Recorded as ${directiveScope.replaceAll('_', ' ')} · witnessed delivery`;
			await refreshDecisionPacket();
		} catch (error) {
			directiveStatus = error instanceof Error ? error.message : 'Direction failed.';
		} finally {
			directiveSending = false;
		}
	}

	async function requestModelDecision() {
		if (!decisionPacket || !data.modelPolicy.enabled || requestingModel) return;
		requestingModel = true;
		modelRequestError = '';
		modelResult = null;
		try {
			const response = await fetch(`/api/runs/${snapshot.runId}/model-preview`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					heroId: snapshot.manifest.characterId,
					packetHash: decisionPacket.packetHash,
					costAcknowledged: true
				})
			});
			const result = (await response.json()) as HeroPolicyResult & { message?: string };
			if (!response.ok) throw new Error(result.message ?? 'The model preview failed.');
			modelResult = result;
		} catch (error) {
			modelRequestError = error instanceof Error ? error.message : 'The model preview failed.';
		} finally {
			requestingModel = false;
		}
	}

	function stopDecisionJobPolling() {
		if (decisionJobPollTimer) window.clearTimeout(decisionJobPollTimer);
		decisionJobPollTimer = undefined;
	}

	async function loadDecisionJob(jobId: string): Promise<DecisionJobClientView> {
		const response = await fetch(`/api/runs/${snapshot.runId}/decision-jobs/${jobId}`);
		const result = (await response.json()) as DecisionJobClientView & { message?: string };
		if (!response.ok) throw new Error(result.message ?? 'The decision job could not be loaded.');
		return result;
	}

	async function pollDecisionJob() {
		if (!decisionJob) return;
		stopDecisionJobPolling();
		try {
			let current = await loadDecisionJob(decisionJob.decisionJobId);
			if (current.status === 'replanned' && current.replacementJobId) {
				current = await loadDecisionJob(current.replacementJobId);
			}
			decisionJob = current;
			if (current.status === 'applied') {
				const runResponse = await fetch(`/api/runs/${snapshot.runId}`);
				if (runResponse.ok) snapshot = (await runResponse.json()) as ProofRunSnapshot;
				stage = 4;
				await refreshDecisionPacket();
				return;
			}
			if (current.status === 'failed' || current.status === 'stale') return;
			decisionJobPollTimer = window.setTimeout(() => void pollDecisionJob(), 350);
		} catch (error) {
			decisionJobError = error instanceof Error ? error.message : 'Decision polling failed.';
		}
	}

	async function queueDecisionJob(policy: 'scripted' | 'model') {
		if (!decisionPacket || queueingDecisionJob || snapshot.destination) return;
		queueingDecisionJob = true;
		decisionJobError = '';
		if (countdownTimer) {
			window.clearInterval(countdownTimer);
			countdownTimer = undefined;
		}
		try {
			const response = await fetch(`/api/runs/${snapshot.runId}/decision-jobs`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					heroId: snapshot.manifest.characterId,
					packetHash: decisionPacket.packetHash,
					policy,
					costAcknowledged: policy === 'model'
				})
			});
			const result = (await response.json()) as DecisionJobClientView & { message?: string };
			if (!response.ok) throw new Error(result.message ?? 'The decision job could not be queued.');
			decisionJob = result;
			await pollDecisionJob();
		} catch (error) {
			decisionJobError = error instanceof Error ? error.message : 'Decision job creation failed.';
			if (snapshot.controlMode === 'countdown' && !snapshot.destination) beginCountdown();
		} finally {
			queueingDecisionJob = false;
		}
	}

	function policyActionLabel(result: HeroPolicyResult): string {
		return (
			decisionPacket?.legalActions.find((action) => action.actionId === result.decision.actionId)
				?.label ?? result.decision.actionId
		);
	}

	function selectedScriptedScore(result: HeroPolicyResult) {
		return result.trace.kind === 'scripted'
			? result.trace.actionScores.find((score) => score.actionId === result.decision.actionId)
			: undefined;
	}

	function strongestScriptedReason(result: HeroPolicyResult): string {
		const score = selectedScriptedScore(result);
		return (
			[...(score?.contributions ?? [])]
				.sort(
					(left, right) =>
						Math.abs(right.value) - Math.abs(left.value) || left.key.localeCompare(right.key)
				)
				.find((item) => item.key !== 'decision.legal-baseline')?.reason ??
			'The stable action-id tie-break resolved equal scores.'
		);
	}

	async function resolveDecision(trigger: 'step' | 'countdown') {
		if (deciding || snapshot.destination) return;
		deciding = true;
		errorMessage = '';
		if (countdownTimer) {
			window.clearInterval(countdownTimer);
			countdownTimer = undefined;
		}
		try {
			const response = await fetch(`/api/runs/${snapshot.runId}/decide`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ directive: directive.trim(), trigger })
			});
			const result = (await response.json()) as ProofRunSnapshot & { message?: string };
			if (!response.ok) throw new Error(result.message ?? 'The decision could not be resolved.');
			snapshot = result;
			stage = 4;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'The decision failed.';
			if (snapshot.controlMode === 'countdown') beginCountdown();
		} finally {
			deciding = false;
		}
	}

	onDestroy(() => {
		if (countdownTimer) window.clearInterval(countdownTimer);
		stopDecisionJobPolling();
	});
</script>

<svelte:head>
	<title>Summon {snapshot.manifest.displayName} · summonlab</title>
	<meta
		name="description"
		content={`A first-person deterministic summoning of ${snapshot.manifest.displayName}.`}
	/>
</svelte:head>

<main class:revealing={stage >= 1} class:manifested={stage >= 2} class:answered={stage >= 4}>
	<section class="summon-stage" aria-live="polite">
		<header>
			<a class="wordmark" href={resolve('/')}>summonlab</a>
			<div class="run-meta">
				<span>First Ember / Gate 00</span>
				<code>{snapshot.runId.slice(0, 8)}</code>
			</div>
			<nav class="gate-nav" aria-label="Run destinations">
				<a class="forge-link" href={resolve('/wiki/art/hero-identity-and-evolution')}>Hero roster</a
				>
				<a class="mission-link" href={resolve('/mission/[runId]', { runId: snapshot.runId })}
					>Floor 01</a
				>
			</nav>
		</header>

		<div class="chamber">
			<div class="architecture">
				<div class="pillar left"></div>
				<div class="pillar right"></div>
				<div class="gate-shell">
					<div class="rune-ring outer">
						{#each outerRunes as index (index)}
							<i style={`--i:${index}`}>{index % 2 === 0 ? '◇' : '·'}</i>
						{/each}
					</div>
					<div class="rune-ring inner">
						{#each innerRunes as index (index)}
							<i style={`--i:${index}`}>{index % 2 === 0 ? '⌁' : '✦'}</i>
						{/each}
					</div>
					<div class="gate-core"></div>
					<div class="seal">✦</div>
				</div>
				<div class="floor-sigil"></div>
			</div>

			<div class="hero-presence">
				{#if data.heroPortrait}
					<img
						src={data.heroPortrait.publicPath}
						width={data.heroPortrait.width}
						height={data.heroPortrait.height}
						alt={`${snapshot.manifest.displayName} steps out of the summoning gate`}
					/>
				{:else}
					<HeroArtPlaceholder name={snapshot.manifest.displayName} />
				{/if}
			</div>

			<div class="first-person">
				<div class="rail"></div>
				<div class="hand left-hand"></div>
				<div class="hand right-hand"></div>
			</div>
		</div>

		{#if stage === 0}
			<div class="seal-prompt">
				<p>Deterministic gate ready</p>
				<h1>A life waits<br />behind the seal.</h1>
				<button type="button" onclick={beginReveal}>
					<span>Break the seal</span>
					<small>manifest hash {snapshot.manifestHash.slice(0, 12)}</small>
				</button>
			</div>
		{/if}

		{#if stage === 1}
			<div class="system-callout">
				<span>01</span>
				<p>Recipe accepted</p>
				<code>{snapshot.recipe.seed} / {snapshot.recipe.generationVersion}</code>
			</div>
		{:else if stage === 2}
			<div class="system-callout">
				<span>02</span>
				<p>Identity made manifest</p>
				<code>{snapshot.manifestHash}</code>
			</div>
		{/if}

		{#if stage >= 3}
			<section class="identity-card">
				<div class="stars">{'✦'.repeat(snapshot.manifest.rarityStars)}</div>
				<p>Summoned hero / {snapshot.manifest.posture} bearing</p>
				<h1>{snapshot.manifest.displayName}</h1>
				<div class="traits">
					<span>{snapshot.manifest.adultAge} years</span>
					<span>{snapshot.manifest.heightCm} cm</span>
					<span>{snapshot.mind.primaryValue}</span>
					<span>{snapshot.mind.dailyHabit.replaceAll('-', ' ')}</span>
				</div>
				<blockquote>{snapshot.firstObservation}</blockquote>
			</section>
		{/if}

		{#if stage === 3 && !snapshot.destination}
			<section class="decision-window">
				<div class="window-heading">
					<div>
						<p>{snapshot.controlMode === 'countdown' ? 'Timed handoff' : 'Step mode'}</p>
						<h2>The hero is waiting to choose.</h2>
					</div>
					{#if snapshot.controlMode === 'countdown'}
						<div class="counter" style={`--remaining:${countdown}`}>
							<strong>{countdown}</strong><span>seconds</span>
						</div>
					{/if}
				</div>
				{#if conversation}
					<div class="onboarding">
						<div class="onboarding-title">
							<div>
								<p>Before the first choice</p>
								<h3>Speak into a clean slate.</h3>
							</div>
							<span class:available={conversation.canCommunicate}
								>{conversation.availability.replaceAll('-', ' ')}</span
							>
						</div>
						<div class="topic-row" aria-label="Communication topic">
							{#each ['master-role', 'summoning-situation', 'tower-mission', 'hero-memory'] as topic (topic)}
								<button
									type="button"
									class:active={communicationTopic === topic}
									onclick={() => chooseCommunicationTopic(topic as typeof communicationTopic)}
									>{topic.replaceAll('-', ' ')}</button
								>
							{/each}
						</div>
						<textarea
							class="communication-copy"
							bind:value={communicationText}
							maxlength="600"
							aria-label="Exact words to the summoned hero"></textarea>
						<div class="delivery-row">
							<label>
								<span>Tone</span>
								<select bind:value={communicationTone}>
									<option value="reassuring">reassuring</option>
									<option value="neutral">neutral</option>
									<option value="firm">firm</option>
									<option value="urgent">urgent</option>
									<option value="apologetic">apologetic</option>
								</select>
							</label>
							<label>
								<span>Witness rule</span>
								<select bind:value={communicationDelivery}>
									<option value="private">private</option>
									<option value="open">open / nearby heroes overhear</option>
								</select>
							</label>
							<button
								class="speak"
								type="button"
								onclick={sendCommunication}
								disabled={!conversation.canCommunicate ||
									communicating ||
									!communicationText.trim()}
								>{communicating
									? 'Recording…'
									: communicationKind === 'ask'
										? 'Ask hero'
										: 'Speak'}</button
							>
						</div>
						{#if communicationError}<p class="error" role="alert">{communicationError}</p>{/if}
						{#if conversation.acts.length > 0}
							{@const latestAct = conversation.acts.at(-1)!}
							<div class="witness-proof">
								<span>{latestAct.witnesses.length} witnessed</span>
								<span
									>{latestAct.witnesses.filter((witness) => witness.learnedBelief).length} learned a claim</span
								>
								<code>{latestAct.sourceEventId.slice(0, 8)}</code>
							</div>
						{/if}
						<small>Exact words are canonical. Free text cannot invent engine facts.</small>
						<section class="free-conversation" data-testid="hero-conversation">
							<header>
								<div>
									<p>Hero agency</p>
									<h3>Talk, ask, or try to persuade.</h3>
								</div>
								<small>Words influence; the engine still owns actions.</small>
							</header>
							<div class="topic-row" aria-label="Conversation kind">
								{#each ['say', 'ask', 'order'] as kind (kind)}
									<button
										type="button"
										class:active={conversationKind === kind}
										onclick={() => chooseConversationKind(kind as typeof conversationKind)}
										>{kind}</button
									>
								{/each}
							</div>
							{#if conversationKind === 'order'}
								<div class="order-intents" aria-label="Order intent">
									{#each ['train', 'rest', 'eat', 'work', 'prepare-tower'] as intent (intent)}
										<button
											type="button"
											class:active={conversationOrderIntent === intent}
											onclick={() => chooseOrderIntent(intent as typeof conversationOrderIntent)}
											>{intent.replaceAll('-', ' ')}</button
										>
									{/each}
								</div>
							{/if}
							<textarea
								class="communication-copy"
								bind:value={conversationText}
								maxlength="600"
								aria-label="Free text for the hero"></textarea>
							<button
								class="speak"
								type="button"
								onclick={sendConversation}
								disabled={!conversation.canCommunicate ||
									conversationSending ||
									!conversationText.trim()}
								>{conversationSending ? 'Listening…' : 'Send and hear reply'}</button
							>
							{#if conversationError}<p class="error" role="alert">{conversationError}</p>{/if}
							{#if conversation.turns.length > 0}
								{@const latestTurn = conversation.turns.at(-1)!}
								<article class="hero-reply" data-testid="hero-reply">
									<div class="speech-line">
										<span>Master</span>
										<blockquote>“{latestTurn.masterText}”</blockquote>
									</div>
									<div class="speech-line hero">
										<span>{snapshot.manifest.displayName}</span>
										<blockquote>“{latestTurn.heroResponse.exactText}”</blockquote>
									</div>
									{#if latestTurn.heroResponse.orderOutcome}
										<div class="order-outcome">
											<strong>{latestTurn.heroResponse.orderOutcome}</strong>
											<span>{latestTurn.orderIntent?.replaceAll('-', ' ')}</span>
											<em>+{latestTurn.heroResponse.preferenceWeight} preference</em>
										</div>
										<details>
											<summary>Why this outcome?</summary>
											<p>{latestTurn.heroResponse.publicReason}</p>
											{#if latestTurn.heroResponse.orderScore}
												<div class="score-grid">
													{#each Object.entries(latestTurn.heroResponse.orderScore) as [key, value] (key)}
														<span>{key}</span><strong>{value > 0 ? `+${value}` : value}</strong>
													{/each}
												</div>
											{/if}
										</details>
									{/if}
								</article>
							{/if}
						</section>
					</div>
				{/if}
				{#if decisionPacket && decisionPreview}
					<details class="context-preview" data-testid="decision-context">
						<summary>
							<div>
								<span>Context boundary</span>
								<strong>What reaches this hero</strong>
							</div>
							<small
								>{decisionPacket.legalActions.length} legal · {decisionPacket.knowledge
									.memoryRetrieval.selectedCount} memories · {decisionPacket.knowledge.beliefs
									.length} beliefs</small
							>
						</summary>
						<div class="context-body">
							<div class="context-proof">
								<span>packet</span><code>{decisionPacket.packetHash.slice(0, 12)}</code>
								<span>state</span><code>{decisionPacket.world.stateHash.slice(0, 12)}</code>
								<span>cursor</span><code>{decisionPacket.world.eventCursor}</code>
							</div>
							{#if decisionPacket.activeDirectives.length > 0}
								<div class="conversation-influence" data-testid="conversation-influence">
									<p>Witnessed preferences reaching this decision</p>
									{#each decisionPacket.activeDirectives as activeDirective (activeDirective.directiveId)}
										<div>
											<blockquote>“{activeDirective.text}”</blockquote>
											<code>{activeDirective.priorities.join(' · ')}</code>
										</div>
									{/each}
								</div>
							{/if}
							<div class="legal-context">
								<p>Only these actions can be chosen</p>
								{#each decisionPacket.legalActions as action (action.actionId)}
									<div>
										<strong>{action.label}</strong>
										<code>{action.actionId}</code>
									</div>
								{/each}
							</div>
							<div class="policy-context" data-testid="policy-baselines">
								<p>Same packet · two zero-cost baselines</p>
								<div>
									{#each [decisionPreview.policies.scripted, decisionPreview.policies.random] as result (result.policyId)}
										<article class:random={result.trace.kind === 'random'}>
											<div class="policy-header">
												<span
													>{result.trace.kind === 'scripted'
														? 'Personality script'
														: 'Seeded random'}</span
												>
												<em>0 model calls</em>
											</div>
											<strong>{policyActionLabel(result)}</strong>
											<code>{result.decision.actionId}</code>
											{#if result.trace.kind === 'scripted'}
												<small
													>score {selectedScriptedScore(result)?.total ?? 0} · {strongestScriptedReason(
														result
													)}</small
												>
											{:else if result.trace.kind === 'random'}
												<small
													>draw {result.trace.draw} → option {result.trace.selectedIndex + 1} · seed {result.trace.seedHash.slice(
														0,
														8
													)}</small
												>
											{:else}
												<small>Model result {result.trace.responseId}</small>
											{/if}
											<footer>
												<span>result</span><code>{result.resultHash.slice(0, 10)}</code>
											</footer>
										</article>
									{/each}
								</div>
							</div>
							<section
								class:ready={data.modelPolicy.enabled}
								class="model-policy"
								data-testid="model-policy-bench"
							>
								<div class="model-policy-head">
									<div>
										<span>Live model bench</span>
										<strong>{data.modelPolicy.model}</strong>
									</div>
									<em>{data.modelPolicy.enabled ? 'manual paid call' : 'adapter ready'}</em>
								</div>
								{#if modelResult && modelResult.trace.kind === 'model'}
									<div class="model-result">
										<span>Model chose</span>
										<strong>{policyActionLabel(modelResult)}</strong>
										<blockquote>“{modelResult.decision.publicIntent}”</blockquote>
										<div>
											<small>{modelResult.trace.usage.totalTokens} tokens</small>
											<code>{modelResult.trace.responseId}</code>
											<code>{modelResult.resultHash.slice(0, 10)}</code>
										</div>
									</div>
								{:else}
									<p>{data.modelPolicy.message}</p>
									<div class="model-settings">
										<span>{data.modelPolicy.reasoningEffort} reasoning</span>
										<span>≤ {data.modelPolicy.maxOutputTokens} output tokens</span>
										<span>preview only</span>
									</div>
									{#if data.modelPolicy.enabled}
										<button
											class="model-call"
											type="button"
											onclick={requestModelDecision}
											disabled={requestingModel}
										>
											{requestingModel ? 'Asking once…' : `Ask ${data.modelPolicy.model} once`}
										</button>
									{:else}
										<small>No provider request is sent in scripted mode.</small>
									{/if}
								{/if}
								{#if modelRequestError}<p class="error" role="alert">{modelRequestError}</p>{/if}
								<footer>
									One independent Responses request · strict schema · never applies state
								</footer>
							</section>
							<section class="decision-job" data-testid="decision-job-bench">
								<div class="decision-job-head">
									<div>
										<span>Durable decision job</span>
										<strong>Queue → validate → apply</strong>
									</div>
									<em>{decisionJob?.status.replaceAll('_', ' ') ?? 'not queued'}</em>
								</div>
								{#if decisionJob}
									<div class="job-proof">
										<div><span>job</span><code>{decisionJob.decisionJobId.slice(0, 10)}</code></div>
										<div><span>packet</span><code>{decisionJob.packetHash.slice(0, 10)}</code></div>
										<div><span>attempts</span><strong>{decisionJob.attemptCount}</strong></div>
										<div><span>replans</span><strong>{decisionJob.replanCount}</strong></div>
									</div>
									<div class="job-track" aria-label="Decision job transitions">
										{#each decisionJob.transitions.slice(-5) as transition (transition.sequence)}
											<span class:current={transition.toStatus === decisionJob.status}
												>{transition.toStatus.replaceAll('_', ' ')}</span
											>
										{/each}
									</div>
									{#if decisionJob.failure}
										<small
											>{decisionJob.failure.code} · {decisionJob.failure.retryable
												? 'retryable'
												: 'terminal'}</small
										>
									{:else if decisionJob.result}
										<small
											>{decisionJob.resolution} policy chose {decisionJob.result.actionId}</small
										>
									{:else}
										<small
											>The worker owns execution; this browser only observes lifecycle state.</small
										>
									{/if}
									<a
										class="trace-link"
										href={resolve('/debug/decisions/[jobId]', {
											jobId: decisionJob.decisionJobId
										})}>Open redacted decision trace →</a
									>
								{:else}
									<p>
										Create one packet-bound job. A stale completion is rejected and replanned; only
										the engine can commit its selected legal action.
									</p>
									<div class="job-actions">
										<button
											type="button"
											onclick={() => queueDecisionJob('scripted')}
											disabled={queueingDecisionJob}
										>
											{queueingDecisionJob ? 'Queuing…' : 'Queue scripted + apply'}
										</button>
										{#if data.modelPolicy.enabled}
											<button
												type="button"
												onclick={() => queueDecisionJob('model')}
												disabled={queueingDecisionJob}
											>
												Queue model + apply
											</button>
										{/if}
									</div>
								{/if}
								{#if decisionJobError}<p class="error" role="alert">{decisionJobError}</p>{/if}
								<footer>
									One provider retry maximum · scripted fallback · stale state never applies
								</footer>
							</section>
							<div class="memory-context">
								<p>Retrieved personal memory</p>
								{#each decisionPacket.knowledge.memoryRetrieval.memories as memory (memory.memoryId)}
									<article>
										<div>
											<span>{memory.kind.replaceAll('-', ' ')}</span>
											<strong>score {memory.score.total}</strong>
										</div>
										{#if memory.exactCommunication}
											<blockquote>“{memory.exactCommunication.exactText}”</blockquote>
										{:else}
											<p>{memory.summary}</p>
										{/if}
										<code
											>{memory.sourceEventId.slice(0, 8)} → {memory.observationId.slice(0, 8)}</code
										>
									</article>
								{/each}
							</div>
							<small
								>Fresh packet, deterministic retrieval, witnessed knowledge only. Hidden state and
								the full run log stay out.</small
							>
						</div>
					</details>
				{/if}
				<label>
					<span>Give direction before the choice · best effort, never direct control</span>
					<textarea
						bind:value={directive}
						maxlength="500"
						placeholder="Try: meet people first, or prepare for danger."></textarea>
				</label>
				<div class="directive-tools">
					<label>
						<span>Lifetime</span>
						<select bind:value={directiveScope}>
							<option value="decision">Next decision</option>
							<option value="mission">Mission</option>
							<option value="day">Current day</option>
							<option value="until_revoked">Until revoked</option>
						</select>
					</label>
					<button
						type="button"
						onclick={recordScopedDirective}
						disabled={directiveSending || !directive.trim()}
					>
						{directiveSending ? 'Recording…' : 'Record witnessed direction'}
					</button>
				</div>
				{#if directiveStatus}<p class="directive-status">{directiveStatus}</p>{/if}
				{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
				<button
					type="button"
					onclick={() =>
						resolveDecision(snapshot.controlMode === 'countdown' ? 'countdown' : 'step')}
					disabled={deciding}
				>
					{deciding
						? 'Resolving legal choices…'
						: `Let ${snapshot.manifest.displayName.split(' ')[0]} decide now`}
				</button>
				<small
					>The player does not select the destination. The policy scores only legal moves.</small
				>
			</section>
		{/if}

		{#if stage >= 4 && snapshot.destination && snapshot.firstLine}
			<section class="answer-panel">
				<div class="speaker">
					<span>{snapshot.manifest.displayName}</span>
					<small>{snapshot.controlMode} / {snapshot.events[2]?.decisionSource ?? 'policy'}</small>
				</div>
				<blockquote>“{snapshot.firstLine}”</blockquote>
				<div class="branch">
					<div>
						<span>Fixed spine</span>
						<strong>Form a company before Floor 01 opens.</strong>
					</div>
					<div>
						<span>Hero-altered route</span>
						<strong>{snapshot.storyBranch?.replaceAll('-', ' ')} → {destinationLabel}</strong>
					</div>
				</div>
				{#if decisionJob?.application}
					<div class="applied-job" data-testid="applied-decision-job">
						<div>
							<span>Decision job applied</span>
							<code>{decisionJob.decisionJobId.slice(0, 10)}</code>
						</div>
						<strong>{decisionJob.result?.actionId}</strong>
						<small
							>cursor {decisionJob.application.eventCursor} · version {decisionJob.application
								.runVersion} · {decisionJob.resolution}</small
						>
						<div class="applied-track" aria-label="Applied decision lifecycle">
							{#each decisionJob.transitions as transition (transition.sequence)}
								<span>{transition.toStatus.replaceAll('_', ' ')}</span>
							{/each}
						</div>
					</div>
				{/if}
				<a class="follow" href={resolve('/play/[runId]', { runId: snapshot.runId })}>
					<span>Follow to {destinationLabel}</span>
					<small>Continue with the same manifest-bound identity in the settlement</small>
				</a>
			</section>
		{/if}
	</section>

	{#if stage >= 3}
		<section class="journal-wrap">
			<EventJournal events={snapshot.events} />
			<aside>
				<p>Replay identity</p>
				<code>{snapshot.manifestHash}</code>
				<span>Same recipe → same manifest bytes, mind, and policy choice.</span>
			</aside>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		overflow-x: hidden;
		background: #05060a;
	}

	main {
		min-height: 100vh;
		background: #05060a;
	}

	.summon-stage {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		isolation: isolate;
		background:
			radial-gradient(circle at 50% 46%, rgba(30, 31, 60, 0.72), transparent 34rem),
			linear-gradient(180deg, #090b13, #040509);
	}

	.summon-stage::after {
		content: '';
		position: absolute;
		z-index: 20;
		inset: 0;
		background-image: linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px);
		background-size: 100% 4px;
		mix-blend-mode: overlay;
		opacity: 0.4;
		pointer-events: none;
	}

	header {
		position: absolute;
		z-index: 30;
		top: 0;
		right: 0;
		left: 0;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 2rem;
		padding: 1.5rem clamp(1.2rem, 3vw, 3rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		background: linear-gradient(180deg, rgba(3, 4, 7, 0.8), transparent);
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	.wordmark {
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.24em;
		text-transform: uppercase;
	}

	.gate-nav {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.mission-link {
		padding: 0.55rem 0.75rem;
		border: 1px solid rgba(102, 211, 207, 0.42);
		color: #83d9d5;
		background: rgba(30, 97, 96, 0.14);
	}

	.run-meta {
		text-align: center;
	}

	.run-meta span,
	.run-meta code {
		display: block;
	}

	.run-meta span {
		margin-bottom: 0.25rem;
		color: rgba(246, 241, 231, 0.5);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.run-meta code {
		color: #70c8d9;
		font-family: ui-monospace, monospace;
		font-size: 0.54rem;
	}

	.forge-link {
		justify-self: end;
		color: rgba(246, 241, 231, 0.5);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.chamber,
	.architecture {
		position: absolute;
		inset: 0;
	}

	.architecture {
		perspective: 900px;
	}

	.architecture::before,
	.architecture::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 30%;
		background:
			linear-gradient(90deg, #07080d, transparent),
			repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 4rem);
	}

	.architecture::before {
		left: 0;
	}

	.architecture::after {
		right: 0;
		transform: scaleX(-1);
	}

	.pillar {
		position: absolute;
		z-index: 2;
		top: -2rem;
		bottom: -2rem;
		width: clamp(3rem, 7vw, 8rem);
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: linear-gradient(90deg, #08090e, #171922 45%, #07080d);
		box-shadow: 0 0 4rem rgba(0, 0, 0, 0.65);
	}

	.pillar::after {
		content: '';
		position: absolute;
		inset: 10% 42%;
		background: linear-gradient(180deg, transparent, rgba(112, 200, 217, 0.15), transparent);
	}

	.pillar.left {
		left: 13%;
	}

	.pillar.right {
		right: 13%;
	}

	.gate-shell {
		position: absolute;
		top: 48%;
		left: 50%;
		width: min(58vw, 40rem);
		aspect-ratio: 1;
		transform: translate(-50%, -50%);
	}

	.rune-ring,
	.gate-core,
	.seal {
		position: absolute;
		border-radius: 50%;
	}

	.rune-ring {
		inset: 0;
		border: 1px solid rgba(112, 200, 217, 0.25);
		box-shadow:
			inset 0 0 3rem rgba(112, 200, 217, 0.08),
			0 0 4rem rgba(89, 64, 157, 0.12);
	}

	.rune-ring.inner {
		inset: 9%;
		transform: rotate(12deg);
	}

	.rune-ring i {
		position: absolute;
		top: 50%;
		left: 50%;
		color: rgba(112, 200, 217, 0.48);
		font-style: normal;
		font-size: 1rem;
		transform: rotate(calc(var(--i) * 30deg)) translateY(-19rem);
		transform-origin: 0 0;
	}

	.rune-ring.inner i {
		transform: rotate(calc(var(--i) * 45deg)) translateY(-13.8rem);
	}

	.gate-core {
		inset: 15%;
		background:
			radial-gradient(circle, rgba(118, 220, 226, 0.08), rgba(34, 29, 66, 0.88) 57%, #05060a 72%),
			repeating-conic-gradient(from 20deg, rgba(255, 255, 255, 0.04) 0 1deg, transparent 1deg 15deg);
		box-shadow: inset 0 0 5rem #000;
	}

	.seal {
		top: 50%;
		left: 50%;
		display: grid;
		width: 5rem;
		height: 5rem;
		place-items: center;
		border: 1px solid rgba(210, 160, 77, 0.5);
		background: #0d0d15;
		box-shadow: 0 0 4rem rgba(210, 160, 77, 0.3);
		color: #e0b968;
		font-size: 1.5rem;
		transform: translate(-50%, -50%) rotate(45deg);
	}

	.floor-sigil {
		position: absolute;
		bottom: -34%;
		left: 50%;
		width: 65vw;
		aspect-ratio: 1.8;
		border: 1px solid rgba(112, 200, 217, 0.15);
		border-radius: 50%;
		background: repeating-radial-gradient(
			circle,
			transparent 0 11%,
			rgba(112, 200, 217, 0.06) 11.4% 11.7%
		);
		transform: translateX(-50%) rotateX(68deg);
	}

	.hero-presence {
		position: absolute;
		z-index: 5;
		top: 8vh;
		bottom: 3vh;
		left: 50%;
		display: flex;
		width: min(42rem, 52vw);
		align-items: flex-end;
		justify-content: center;
		opacity: 0;
		filter: blur(18px) brightness(2.2);
		transform: translateX(-50%) scale(0.84);
		transition:
			opacity 900ms ease,
			filter 1.1s ease,
			transform 1.1s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.hero-presence > img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		mix-blend-mode: screen;
		mask-image: radial-gradient(ellipse 48% 58% at 50% 49%, #000 55%, transparent 100%);
	}

	.manifested .hero-presence {
		opacity: 1;
		filter: blur(0) brightness(1);
		transform: translateX(-50%) scale(1);
	}

	.manifested .hero-presence > img {
		mix-blend-mode: normal;
	}

	.revealing .rune-ring.outer {
		animation: rotate-ring 12s linear infinite;
		border-color: rgba(112, 200, 217, 0.72);
		box-shadow: 0 0 5rem rgba(89, 177, 207, 0.35);
	}

	.revealing .rune-ring.inner {
		animation: rotate-ring-back 8s linear infinite;
	}

	.revealing .gate-core {
		animation: gate-bloom 1.3s ease both;
	}

	.revealing .seal {
		animation: seal-break 700ms ease both;
	}

	.first-person {
		position: absolute;
		z-index: 15;
		right: 0;
		bottom: 0;
		left: 0;
		height: 20vh;
		pointer-events: none;
	}

	.rail {
		position: absolute;
		right: -5%;
		bottom: 2vh;
		left: -5%;
		height: 3rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: linear-gradient(180deg, #2b2a29, #09090b 60%);
		box-shadow: 0 -1rem 4rem rgba(0, 0, 0, 0.5);
		transform: perspective(30rem) rotateX(52deg);
	}

	.hand {
		position: absolute;
		bottom: -2rem;
		width: 6rem;
		height: 11rem;
		border-radius: 60% 45% 30% 30%;
		background: linear-gradient(90deg, #211a18, #564039 52%, #1c1717);
		box-shadow: 0 0 2rem rgba(0, 0, 0, 0.6);
	}

	.left-hand {
		left: 18%;
		transform: rotate(22deg);
	}

	.right-hand {
		right: 18%;
		transform: scaleX(-1) rotate(22deg);
	}

	.seal-prompt {
		position: absolute;
		z-index: 25;
		top: 50%;
		left: clamp(1.5rem, 7vw, 8rem);
		width: min(32rem, 38vw);
		transform: translateY(-50%);
	}

	.seal-prompt > p,
	.identity-card > p,
	.decision-window p,
	.journal-wrap aside p {
		margin: 0 0 0.7rem;
		color: #d2a04d;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	.seal-prompt h1,
	.identity-card h1 {
		margin-bottom: 1.8rem;
		font-family: Georgia, serif;
		font-size: clamp(3rem, 6vw, 6.5rem);
		font-weight: 400;
		line-height: 0.9;
		letter-spacing: -0.055em;
	}

	.seal-prompt button {
		display: flex;
		min-width: min(24rem, 100%);
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
		padding: 1rem 1.2rem;
		border: 1px solid #d2a04d;
		background: rgba(10, 10, 15, 0.82);
		color: #f6f1e7;
		cursor: pointer;
		text-align: left;
	}

	.seal-prompt button span {
		font-family: Georgia, serif;
		font-size: 1.05rem;
	}

	.seal-prompt button small {
		color: rgba(246, 241, 231, 0.38);
		font-family: ui-monospace, monospace;
		font-size: 0.52rem;
	}

	.system-callout {
		position: absolute;
		z-index: 25;
		top: 50%;
		left: 50%;
		width: min(32rem, 80vw);
		padding: 1.2rem;
		border: 1px solid rgba(112, 200, 217, 0.35);
		background: rgba(4, 5, 10, 0.84);
		box-shadow: 0 0 5rem rgba(112, 200, 217, 0.12);
		transform: translate(-50%, -50%);
		text-align: center;
	}

	.system-callout span {
		color: rgba(112, 200, 217, 0.45);
		font-family: ui-monospace, monospace;
		font-size: 0.6rem;
	}

	.system-callout p {
		margin: 0.5rem 0;
		font-family: Georgia, serif;
		font-size: 1.5rem;
	}

	.system-callout code {
		display: block;
		overflow: hidden;
		color: #70c8d9;
		font-family: ui-monospace, monospace;
		font-size: 0.6rem;
		text-overflow: ellipsis;
	}

	.identity-card {
		position: absolute;
		z-index: 25;
		top: 16%;
		left: clamp(1.2rem, 4vw, 4rem);
		width: min(24rem, 30vw);
		padding: 1.4rem;
		border-left: 1px solid rgba(210, 160, 77, 0.5);
		background: linear-gradient(90deg, rgba(5, 6, 10, 0.8), transparent);
		animation: slide-in 600ms ease both;
	}

	.stars {
		margin-bottom: 0.6rem;
		color: #d2a04d;
		font-size: 0.7rem;
		letter-spacing: 0.22em;
	}

	.identity-card > p {
		margin-bottom: 0.4rem;
	}

	.identity-card h1 {
		margin-bottom: 1rem;
		font-size: clamp(2.6rem, 4.6vw, 5rem);
	}

	.traits {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 1rem;
	}

	.traits span {
		padding: 0.35rem 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.03);
		font-size: 0.55rem;
		text-transform: capitalize;
	}

	.identity-card blockquote {
		margin: 0;
		color: rgba(246, 241, 231, 0.55);
		font-size: 0.7rem;
		line-height: 1.65;
	}

	.decision-window,
	.answer-panel {
		position: absolute;
		z-index: 26;
		top: 18%;
		right: clamp(1.2rem, 4vw, 4rem);
		width: min(28rem, 34vw);
		border: 1px solid rgba(255, 255, 255, 0.11);
		background: rgba(7, 8, 13, 0.88);
		box-shadow: 0 2rem 7rem rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(18px);
		animation: slide-in-right 600ms ease both;
	}

	.decision-window {
		padding: 1.4rem;
		max-height: 76vh;
		overflow: auto;
	}

	.window-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 1rem;
	}

	.decision-window p {
		margin-bottom: 0.3rem;
	}

	.decision-window h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: 1.5rem;
		font-weight: 400;
	}

	.onboarding {
		margin: 0 -0.25rem 1rem;
		padding: 1rem;
		border: 1px solid rgba(112, 200, 217, 0.2);
		background:
			linear-gradient(135deg, rgba(112, 200, 217, 0.08), transparent 55%), rgba(2, 4, 8, 0.72);
	}

	.onboarding-title,
	.delivery-row,
	.witness-proof {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
	}

	.onboarding-title h3 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: 1.05rem;
		font-weight: 400;
	}

	.onboarding-title > span {
		padding: 0.3rem 0.45rem;
		border: 1px solid rgba(242, 147, 143, 0.35);
		color: #f2938f;
		font-size: 0.47rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.onboarding-title > span.available {
		border-color: rgba(112, 200, 217, 0.45);
		color: #70c8d9;
	}

	.topic-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.35rem;
		margin: 0.75rem 0 0.55rem;
	}

	.topic-row button,
	.speak {
		padding: 0.48rem 0.55rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.025);
		color: rgba(246, 241, 231, 0.55);
		cursor: pointer;
		font-size: 0.51rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.topic-row button.active {
		border-color: rgba(112, 200, 217, 0.55);
		background: rgba(112, 200, 217, 0.12);
		color: #bcebf2;
	}

	.communication-copy {
		min-height: 4.4rem;
	}

	.delivery-row {
		align-items: end;
		margin-top: 0.55rem;
	}

	.delivery-row label {
		flex: 1;
	}

	.delivery-row select {
		width: 100%;
		padding: 0.45rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: #090b10;
		color: rgba(246, 241, 231, 0.7);
		font-size: 0.58rem;
	}

	.speak {
		min-width: 5rem;
		border-color: #70c8d9;
		background: #70c8d9;
		color: #071014;
		font-weight: 800;
	}

	.speak:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	.witness-proof {
		justify-content: flex-start;
		margin-top: 0.55rem;
		color: #70c8d9;
		font-size: 0.52rem;
	}

	.witness-proof code {
		margin-left: auto;
		color: rgba(246, 241, 231, 0.32);
	}

	.onboarding > small {
		display: block;
		margin-top: 0.55rem;
		color: rgba(246, 241, 231, 0.3);
		font-size: 0.52rem;
	}

	.free-conversation {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(210, 160, 77, 0.24);
	}

	.free-conversation header,
	.order-outcome,
	.speech-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.7rem;
	}

	.free-conversation header h3 {
		margin: 0;
		font-family: Georgia, serif;
		font-size: 1.05rem;
		font-weight: 400;
	}

	.free-conversation header > small {
		max-width: 12rem;
		color: rgba(246, 241, 231, 0.36);
		font-size: 0.48rem;
		text-align: right;
	}

	.free-conversation > .speak {
		width: 100%;
		margin-top: 0.55rem;
	}

	.order-intents {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: -0.2rem 0 0.55rem;
	}

	.order-intents button {
		padding: 0.35rem 0.5rem;
		border: 1px solid rgba(210, 160, 77, 0.22);
		background: transparent;
		color: rgba(246, 241, 231, 0.45);
		cursor: pointer;
		font-size: 0.48rem;
		text-transform: uppercase;
	}

	.order-intents button.active {
		border-color: #d2a04d;
		background: rgba(210, 160, 77, 0.13);
		color: #f1cf8b;
	}

	.hero-reply {
		margin-top: 0.75rem;
		padding: 0.75rem;
		border-left: 2px solid #d2a04d;
		background: rgba(210, 160, 77, 0.06);
	}

	.speech-line {
		align-items: flex-start;
		justify-content: flex-start;
	}

	.speech-line + .speech-line {
		margin-top: 0.55rem;
	}

	.speech-line > span {
		min-width: 4.3rem;
		color: rgba(246, 241, 231, 0.35);
		font-size: 0.48rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.speech-line blockquote {
		margin: 0;
		color: rgba(246, 241, 231, 0.65);
		font-family: Georgia, serif;
		font-size: 0.76rem;
		line-height: 1.45;
	}

	.speech-line.hero blockquote {
		color: #f6f1e7;
	}

	.order-outcome {
		justify-content: flex-start;
		margin-top: 0.75rem;
		padding-top: 0.55rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		font-size: 0.53rem;
		text-transform: uppercase;
	}

	.order-outcome strong {
		color: #70c8d9;
		letter-spacing: 0.1em;
	}

	.order-outcome em {
		margin-left: auto;
		color: #d2a04d;
		font-style: normal;
	}

	.hero-reply details {
		margin-top: 0.55rem;
		color: rgba(246, 241, 231, 0.5);
		font-size: 0.55rem;
	}

	.score-grid {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.2rem 1rem;
		margin-top: 0.45rem;
	}

	.score-grid strong {
		color: #f1cf8b;
	}

	.context-preview {
		margin: 0 0 1rem;
		border: 1px solid rgba(210, 160, 77, 0.28);
		background: linear-gradient(145deg, rgba(210, 160, 77, 0.08), rgba(3, 5, 8, 0.82));
	}

	.context-preview summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.8rem 0.9rem;
		cursor: pointer;
		list-style: none;
	}

	.context-preview summary::-webkit-details-marker {
		display: none;
	}

	.context-preview summary::after {
		content: '+';
		color: #d2a04d;
		font-family: ui-monospace, monospace;
	}

	.context-preview[open] summary::after {
		content: '−';
	}

	.context-preview summary span,
	.context-preview summary strong {
		display: block;
	}

	.context-preview summary span,
	.legal-context > p,
	.memory-context > p,
	.policy-context > p,
	.model-policy-head span {
		margin: 0 0 0.2rem;
		color: #d2a04d;
		font-size: 0.46rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.context-preview summary strong {
		font-family: Georgia, serif;
		font-size: 0.9rem;
		font-weight: 400;
	}

	.context-preview summary small {
		margin-left: auto;
		color: rgba(246, 241, 231, 0.42);
		font-size: 0.48rem;
	}

	.context-body {
		padding: 0 0.9rem 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}

	.context-proof {
		display: grid;
		grid-template-columns: auto 1fr auto 1fr auto auto;
		gap: 0.35rem;
		align-items: center;
		padding: 0.55rem 0;
		color: rgba(246, 241, 231, 0.3);
		font-size: 0.45rem;
		text-transform: uppercase;
	}

	.context-proof code {
		color: #70c8d9;
		font-size: 0.48rem;
	}

	.conversation-influence {
		margin-bottom: 0.65rem;
		padding: 0.6rem;
		border: 1px solid rgba(210, 160, 77, 0.28);
		background: rgba(210, 160, 77, 0.06);
	}

	.directive-tools {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: 0.55rem;
		align-items: end;
		margin: 0.55rem 0;
	}

	.directive-tools label {
		margin: 0;
	}

	.directive-tools select {
		width: 100%;
		padding: 0.62rem;
		border: 1px solid rgba(210, 160, 77, 0.28);
		background: rgba(6, 8, 12, 0.82);
		color: #f6f1e7;
	}

	.directive-status {
		margin: 0 0 0.6rem;
		color: rgba(112, 200, 217, 0.84);
		font-size: 0.52rem;
		letter-spacing: 0.05em;
	}

	.conversation-influence blockquote {
		margin: 0.2rem 0;
		font-family: Georgia, serif;
		font-size: 0.62rem;
	}

	.conversation-influence code {
		color: #d2a04d;
		font-size: 0.44rem;
	}

	.legal-context {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem;
	}

	.legal-context > p,
	.memory-context > p {
		grid-column: 1 / -1;
	}

	.legal-context > div {
		padding: 0.5rem;
		border: 1px solid rgba(112, 200, 217, 0.16);
		background: rgba(112, 200, 217, 0.04);
	}

	.legal-context strong,
	.legal-context code {
		display: block;
	}

	.legal-context strong {
		margin-bottom: 0.25rem;
		font-size: 0.58rem;
	}

	.legal-context code,
	.memory-context article > code {
		color: rgba(112, 200, 217, 0.58);
		font-size: 0.44rem;
	}

	.memory-context {
		margin-top: 0.65rem;
	}

	.policy-context {
		margin-top: 0.75rem;
	}

	.policy-context > p {
		margin: 0 0 0.35rem;
	}

	.policy-context > div {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45rem;
	}

	.policy-context article {
		padding: 0.6rem;
		border: 1px solid rgba(210, 160, 77, 0.2);
		background: linear-gradient(145deg, rgba(210, 160, 77, 0.08), rgba(6, 8, 12, 0.52));
	}

	.policy-context article.random {
		border-color: rgba(112, 200, 217, 0.2);
		background: linear-gradient(145deg, rgba(112, 200, 217, 0.07), rgba(6, 8, 12, 0.52));
	}

	.policy-header,
	.policy-context footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.policy-header span,
	.policy-header em,
	.policy-context footer {
		font-size: 0.43rem;
		font-style: normal;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.policy-header span {
		color: #d2a04d;
	}

	.policy-context article.random .policy-header span {
		color: #70c8d9;
	}

	.policy-header em,
	.policy-context footer {
		color: rgba(246, 241, 231, 0.3);
	}

	.policy-context article > strong,
	.policy-context article > code,
	.policy-context article > small {
		display: block;
	}

	.policy-context article > strong {
		margin-top: 0.45rem;
		font-family: Georgia, serif;
		font-size: 0.72rem;
		font-weight: 400;
	}

	.policy-context article > code {
		margin-top: 0.2rem;
		color: rgba(112, 200, 217, 0.64);
		font-size: 0.43rem;
	}

	.policy-context article > small {
		min-height: 2.4rem;
		margin-top: 0.42rem;
		color: rgba(246, 241, 231, 0.52);
		font-size: 0.49rem;
		line-height: 1.45;
	}

	.policy-context footer {
		margin-top: 0.45rem;
		padding-top: 0.4rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.policy-context footer code {
		color: rgba(246, 241, 231, 0.44);
		font-size: 0.42rem;
	}

	.model-policy {
		margin-top: 0.55rem;
		padding: 0.65rem;
		border: 1px solid rgba(126, 114, 176, 0.2);
		background:
			linear-gradient(135deg, rgba(126, 114, 176, 0.08), rgba(6, 8, 12, 0.66)),
			repeating-linear-gradient(90deg, transparent 0 16px, rgba(255, 255, 255, 0.015) 16px 17px);
	}

	.model-policy.ready {
		border-color: rgba(112, 200, 217, 0.3);
		box-shadow: inset 2px 0 rgba(112, 200, 217, 0.55);
	}

	.model-policy-head,
	.model-settings,
	.model-result > div,
	.model-policy > footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.45rem;
	}

	.model-policy-head strong,
	.model-policy-head span {
		display: block;
	}

	.model-policy-head strong {
		margin-top: 0.18rem;
		font-family: ui-monospace, monospace;
		font-size: 0.6rem;
		font-weight: 500;
	}

	.model-policy-head em {
		color: rgba(112, 200, 217, 0.6);
		font-size: 0.42rem;
		font-style: normal;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.model-policy > p {
		margin: 0.55rem 0;
		color: rgba(246, 241, 231, 0.58);
		font-size: 0.52rem;
		line-height: 1.5;
	}

	.model-settings {
		justify-content: flex-start;
		flex-wrap: wrap;
	}

	.model-settings span {
		padding: 0.18rem 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: rgba(246, 241, 231, 0.4);
		font-size: 0.42rem;
		text-transform: uppercase;
	}

	.model-call {
		width: 100%;
		margin-top: 0.55rem;
		padding: 0.45rem;
		border: 1px solid rgba(112, 200, 217, 0.35);
		background: rgba(112, 200, 217, 0.08);
		color: #bce7ef;
		font-size: 0.52rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.model-call:disabled {
		cursor: wait;
		opacity: 0.55;
	}

	.model-policy > small,
	.model-policy > footer {
		color: rgba(246, 241, 231, 0.3);
		font-size: 0.43rem;
	}

	.model-policy > small {
		display: block;
		margin-top: 0.5rem;
	}

	.model-policy > footer {
		justify-content: flex-start;
		margin-top: 0.55rem;
		padding-top: 0.45rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.model-result > span,
	.model-result > strong {
		display: block;
	}

	.model-result > span {
		margin-top: 0.6rem;
		color: rgba(112, 200, 217, 0.58);
		font-size: 0.43rem;
		text-transform: uppercase;
	}

	.model-result > strong {
		margin-top: 0.18rem;
		font-family: Georgia, serif;
		font-size: 0.8rem;
		font-weight: 400;
	}

	.model-result blockquote {
		margin: 0.4rem 0;
		color: rgba(246, 241, 231, 0.62);
		font-family: Georgia, serif;
		font-size: 0.57rem;
		line-height: 1.45;
	}

	.model-result > div {
		justify-content: flex-start;
		flex-wrap: wrap;
		color: rgba(246, 241, 231, 0.35);
		font-size: 0.42rem;
	}

	.model-result code {
		color: rgba(112, 200, 217, 0.52);
		font-size: 0.41rem;
	}

	.decision-job {
		margin-top: 0.55rem;
		padding: 0.7rem;
		border: 1px solid rgba(210, 160, 77, 0.28);
		background:
			linear-gradient(135deg, rgba(210, 160, 77, 0.08), rgba(4, 6, 10, 0.78)),
			repeating-linear-gradient(90deg, transparent 0 12px, rgba(255, 255, 255, 0.012) 12px 13px);
	}

	.decision-job-head,
	.job-proof,
	.job-track,
	.job-actions,
	.applied-job {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.45rem;
	}

	.decision-job-head span,
	.decision-job-head strong,
	.job-proof span,
	.job-proof strong,
	.applied-job span,
	.applied-job small {
		display: block;
	}

	.decision-job-head span,
	.job-proof span,
	.applied-job span {
		color: #d2a04d;
		font-size: 0.42rem;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.decision-job-head strong {
		margin-top: 0.16rem;
		font-family: ui-monospace, monospace;
		font-size: 0.58rem;
		font-weight: 500;
	}

	.decision-job-head em {
		padding: 0.22rem 0.35rem;
		border: 1px solid rgba(112, 200, 217, 0.25);
		color: #70c8d9;
		font-size: 0.42rem;
		font-style: normal;
		text-transform: uppercase;
	}

	.decision-job > p,
	.decision-job > small,
	.decision-job > footer {
		color: rgba(246, 241, 231, 0.45);
		font-size: 0.47rem;
		line-height: 1.5;
	}

	.trace-link {
		display: block;
		margin-top: 0.55rem;
		color: #70c8d9;
		font-size: 0.45rem;
		letter-spacing: 0.06em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.trace-link:hover {
		color: #bce7ef;
	}

	.decision-job > p {
		margin: 0.55rem 0;
	}

	.job-proof {
		margin-top: 0.55rem;
		align-items: stretch;
	}

	.job-proof > div {
		min-width: 0;
		flex: 1;
		padding: 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.02);
	}

	.job-proof code,
	.job-proof strong {
		margin-top: 0.15rem;
		color: rgba(112, 200, 217, 0.7);
		font-size: 0.45rem;
	}

	.job-track {
		justify-content: flex-start;
		margin: 0.5rem 0;
		overflow: hidden;
	}

	.job-track span {
		padding: 0.2rem 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.07);
		color: rgba(246, 241, 231, 0.3);
		font-size: 0.4rem;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.job-track span.current {
		border-color: rgba(112, 200, 217, 0.4);
		color: #bce7ef;
	}

	.job-actions button {
		flex: 1;
		padding: 0.45rem;
		border: 1px solid rgba(210, 160, 77, 0.45);
		background: rgba(210, 160, 77, 0.1);
		color: #f0c87f;
		cursor: pointer;
		font-size: 0.48rem;
		text-transform: uppercase;
	}

	.job-actions button:last-child {
		border-color: rgba(112, 200, 217, 0.4);
		background: rgba(112, 200, 217, 0.08);
		color: #bce7ef;
	}

	.job-actions button:disabled {
		cursor: wait;
		opacity: 0.5;
	}

	.decision-job > footer {
		margin-top: 0.55rem;
		padding-top: 0.45rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		font-size: 0.4rem;
		text-transform: uppercase;
	}

	.applied-job {
		align-items: flex-start;
		flex-direction: column;
		margin: 0 1.25rem;
		padding: 0.7rem;
		border-left: 2px solid #70c8d9;
		background: rgba(112, 200, 217, 0.06);
	}

	.applied-job code {
		color: #70c8d9;
		font-size: 0.5rem;
	}

	.applied-job strong {
		color: rgba(246, 241, 231, 0.82);
		font-family: ui-monospace, monospace;
		font-size: 0.52rem;
		font-weight: 500;
	}

	.applied-job small {
		color: rgba(246, 241, 231, 0.42);
		font-size: 0.46rem;
	}

	.applied-track {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.applied-track span {
		padding: 0.16rem 0.26rem;
		border: 1px solid rgba(112, 200, 217, 0.18);
		color: rgba(188, 231, 239, 0.6);
		font-size: 0.36rem;
		letter-spacing: 0.04em;
	}

	.memory-context article {
		padding: 0.5rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.memory-context article > div {
		display: flex;
		justify-content: space-between;
		color: rgba(246, 241, 231, 0.4);
		font-size: 0.48rem;
		text-transform: uppercase;
	}

	.memory-context blockquote,
	.memory-context article > p {
		margin: 0.35rem 0;
		color: rgba(246, 241, 231, 0.68);
		font-size: 0.58rem;
		line-height: 1.45;
	}

	.memory-context blockquote {
		font-family: Georgia, serif;
	}

	.context-body > small {
		display: block;
		margin-top: 0.5rem;
		color: rgba(246, 241, 231, 0.3);
		font-size: 0.49rem;
		line-height: 1.45;
	}

	.counter {
		display: grid;
		width: 4.8rem;
		height: 4.8rem;
		place-content: center;
		border: 1px solid rgba(210, 160, 77, 0.35);
		border-radius: 50%;
		background: conic-gradient(#d2a04d calc(var(--remaining) * 20%), rgba(255, 255, 255, 0.06) 0);
		box-shadow: inset 0 0 0 0.35rem #090a0f;
		text-align: center;
	}

	.counter strong,
	.counter span {
		display: block;
	}

	.counter strong {
		font-family: Georgia, serif;
		font-size: 1.2rem;
	}

	.counter span {
		color: rgba(246, 241, 231, 0.4);
		font-size: 0.45rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.decision-window label > span {
		display: block;
		margin-bottom: 0.45rem;
		color: rgba(246, 241, 231, 0.36);
		font-size: 0.52rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	textarea {
		width: 100%;
		min-height: 6rem;
		padding: 0.8rem;
		resize: vertical;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0;
		outline: 0;
		background: rgba(2, 3, 6, 0.65);
		color: #f6f1e7;
		font: inherit;
		font-size: 0.72rem;
		line-height: 1.5;
	}

	textarea:focus {
		border-color: #d2a04d;
	}

	.decision-window > button {
		width: 100%;
		margin-top: 0.7rem;
		padding: 0.85rem;
		border: 1px solid #d2a04d;
		background: #d2a04d;
		color: #090a0f;
		cursor: pointer;
		font-weight: 700;
	}

	.decision-window > small {
		display: block;
		margin-top: 0.55rem;
		color: rgba(246, 241, 231, 0.35);
		font-size: 0.55rem;
		line-height: 1.45;
	}

	.error {
		margin: 0.6rem 0 0;
		color: #f2938f;
		font-size: 0.65rem;
	}

	.answer-panel {
		padding: 0;
	}

	.speaker,
	.branch,
	.follow {
		padding: 1.1rem 1.25rem;
	}

	.speaker {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.speaker span {
		color: #d2a04d;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.speaker small {
		color: rgba(246, 241, 231, 0.32);
		font-size: 0.5rem;
		text-transform: uppercase;
	}

	.answer-panel > blockquote {
		margin: 0;
		padding: 1.5rem 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		font-family: Georgia, serif;
		font-size: clamp(1.2rem, 2vw, 1.7rem);
		line-height: 1.35;
	}

	.branch {
		display: grid;
		gap: 0.7rem;
	}

	.branch div {
		padding-left: 0.8rem;
		border-left: 1px solid rgba(255, 255, 255, 0.12);
	}

	.branch div:last-child {
		border-left-color: #d2a04d;
	}

	.branch span,
	.branch strong {
		display: block;
	}

	.branch span {
		margin-bottom: 0.25rem;
		color: rgba(246, 241, 231, 0.32);
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.branch strong {
		font-size: 0.66rem;
		font-weight: 500;
		text-transform: capitalize;
	}

	.follow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-top: 1px solid rgba(210, 160, 77, 0.25);
		background: linear-gradient(100deg, rgba(210, 160, 77, 0.2), rgba(210, 160, 77, 0.05));
	}

	.follow span,
	.follow small {
		display: block;
	}

	.follow span {
		font-family: Georgia, serif;
		font-size: 0.95rem;
		text-transform: capitalize;
	}

	.follow small {
		max-width: 12rem;
		color: rgba(246, 241, 231, 0.4);
		font-size: 0.5rem;
		line-height: 1.4;
		text-align: right;
	}

	.journal-wrap {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.35fr);
		gap: 1rem;
		max-width: 82rem;
		margin: 0 auto;
		padding: 4rem 1rem 6rem;
	}

	.journal-wrap aside {
		align-self: start;
		padding: 1.4rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.025);
	}

	.journal-wrap aside code {
		display: block;
		margin-bottom: 1rem;
		overflow-wrap: anywhere;
		color: #70c8d9;
		font-family: ui-monospace, monospace;
		font-size: 0.62rem;
		line-height: 1.55;
	}

	.journal-wrap aside span {
		color: rgba(246, 241, 231, 0.42);
		font-size: 0.65rem;
		line-height: 1.55;
	}

	@keyframes rotate-ring {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes rotate-ring-back {
		to {
			transform: rotate(-348deg);
		}
	}

	@keyframes gate-bloom {
		0% {
			filter: brightness(1);
		}
		35% {
			filter: brightness(5);
		}
		100% {
			filter: brightness(1.5);
		}
	}

	@keyframes seal-break {
		to {
			opacity: 0;
			filter: blur(12px);
			transform: translate(-50%, -50%) rotate(135deg) scale(2.4);
		}
	}

	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(-2rem);
		}
	}

	@keyframes slide-in-right {
		from {
			opacity: 0;
			transform: translateX(2rem);
		}
	}

	@media (max-width: 900px) {
		.pillar.left {
			left: 4%;
		}

		.pillar.right {
			right: 4%;
		}

		.gate-shell {
			width: 80vw;
		}

		.rune-ring i,
		.rune-ring.inner i {
			display: none;
		}

		.hero-presence {
			top: 10vh;
			width: 82vw;
		}

		.identity-card {
			top: 11%;
			width: 42vw;
		}

		.decision-window,
		.answer-panel {
			top: auto;
			right: 1rem;
			bottom: 8rem;
			width: calc(100% - 2rem);
			max-width: 30rem;
		}
	}

	@media (max-width: 620px) {
		header {
			grid-template-columns: 1fr auto;
			padding: 1rem;
		}

		.run-meta {
			display: none;
		}

		.seal-prompt {
			top: auto;
			right: 1.2rem;
			bottom: 7rem;
			left: 1.2rem;
			width: auto;
			transform: none;
		}

		.seal-prompt h1 {
			font-size: 3.2rem;
		}

		.identity-card {
			top: 5.5rem;
			right: 1rem;
			left: 1rem;
			width: auto;
			padding: 0.9rem;
		}

		.identity-card h1 {
			margin-bottom: 0.5rem;
			font-size: 2.5rem;
		}

		.identity-card blockquote {
			display: none;
		}

		.decision-window,
		.answer-panel {
			bottom: 5.5rem;
			max-height: 52vh;
			overflow: auto;
		}

		.answer-panel > blockquote {
			font-size: 1.15rem;
		}

		.branch {
			display: none;
		}

		.policy-context > div {
			grid-template-columns: 1fr;
		}

		.first-person {
			height: 12vh;
		}

		.hand {
			display: none;
		}

		.journal-wrap {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 1ms !important;
			transition-duration: 1ms !important;
		}
	}
</style>
