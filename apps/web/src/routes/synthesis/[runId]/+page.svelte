<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let committedView = $state<typeof data.view | null>(null);
	const view = $derived(committedView ?? data.view);
	let sourceHeroId = $state('');
	let recipientHeroId = $state('');
	let visibility = $state<'private' | 'open'>('private');
	let confirmOpen = $state(false);
	let busy = $state(false);
	let errorMessage = $state('');
	const activeHeroes = $derived(view.heroes.filter((hero) => hero.lifeState === 'active'));
	const receipt = $derived(view.latestReceipt);
	$effect(() => {
		if (!sourceHeroId) sourceHeroId = view.heroes[0]?.heroId ?? '';
		if (!recipientHeroId) recipientHeroId = view.heroes[1]?.heroId ?? '';
	});

	function hero(heroId: string) {
		return view.heroes.find((candidate) => candidate.heroId === heroId);
	}
	function label(value: string) {
		return value.replaceAll('-', ' ');
	}
	function delta(value: number | undefined) {
		if (!value) return '±0';
		return value > 0 ? `+${value}` : String(value);
	}

	async function post(payload: Record<string, unknown>) {
		busy = true;
		errorMessage = '';
		try {
			const response = await fetch(`/api/runs/${view.runId}/synthesis`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = (await response.json()) as { view?: typeof view; message?: string };
			if (!response.ok || !body.view) throw new Error(body.message ?? 'Synthesis action failed.');
			committedView = body.view;
			confirmOpen = false;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Synthesis action failed.';
		} finally {
			busy = false;
		}
	}

	async function synthesize() {
		await post({
			action: 'synthesize',
			sourceHeroId,
			recipientHeroId,
			visibility,
			warningVersion: view.warning.version,
			confirmedIrreversible: true,
			rationale: 'Prepare the company for the next tower threshold.'
		});
	}
</script>

<svelte:head>
	<title>Synthesis Receipt · summonlab</title>
	<meta
		name="description"
		content="An irreversible, witnessed, replay-bound synthesis checkpoint."
	/>
</svelte:head>

<main data-testid="synthesis-chamber">
	<nav>
		<a href={resolve('/')} class="wordmark">summonlab</a>
		<span>HEARTH—01 / SYNTHESIS CHAMBER</span>
		<code>CURSOR {String(view.eventCursor).padStart(4, '0')}</code>
	</nav>

	<header>
		<div>
			<p class="eyebrow">FIN—001 · THE COST HAS A WITNESS</p>
			<h1>Essence<br /><em>keeps no soul.</em></h1>
		</div>
		<div class="seal" class:committed={receipt}>
			<i></i><span>{receipt ? 'BOUND' : 'READY'}</span><small>{view.contentVersion}</small>
		</div>
	</header>

	<section class="chamber" class:resolved={receipt}>
		<div class="rail"></div>
		{#each view.heroes as member, index (member.heroId)}
			<article
				class:terminal={member.lifeState !== 'active'}
				class="hero hero-{index + 1}"
				data-testid="synthesis-hero"
			>
				<div class="portrait"><span>{member.callsign.slice(0, 1)}</span><i></i></div>
				<div class="hero-meta">
					<small
						>{member.lifeState === 'synthesized' ? 'SYNTHESIZED' : `SUMMON 0${index + 1}`}</small
					>
					<h2>{member.callsign}</h2>
					<p>{member.stars}★ · LV {member.level} · {member.experience} XP</p>
				</div>
				{#if member.knowledge}
					<div class="knowledge {member.knowledge}" data-testid="synthesis-knowledge">
						<strong>{label(member.knowledge)}</strong>
						<span>{member.beliefs.at(-1)?.confidence ?? 0}% confidence</span>
					</div>
				{/if}
			</article>
		{/each}
		<div class="core"><i></i><span>Σ</span><small>IDENTITY<br />DOES NOT PASS</small></div>
	</section>

	{#if !receipt}
		<section class="console" data-testid="synthesis-console">
			<div class="console-head">
				<div>
					<span>Bounded transaction</span>
					<h2>Choose the cost and its bearer.</h2>
				</div>
				<code>NO ENTROPY / EXACT REPLAY</code>
			</div>
			<div class="controls">
				<label
					><span>Consume permanently</span>
					<select bind:value={sourceHeroId} data-testid="synthesis-source">
						{#each activeHeroes as member (member.heroId)}<option value={member.heroId}
								>{member.callsign} · {member.stars}★ LV {member.level}</option
							>{/each}
					</select>
				</label>
				<div class="arrow">→</div>
				<label
					><span>Receive bounded essence</span>
					<select bind:value={recipientHeroId} data-testid="synthesis-recipient">
						{#each activeHeroes.filter((member) => member.heroId !== sourceHeroId) as member (member.heroId)}<option
								value={member.heroId}>{member.callsign} · {member.stars}★ LV {member.level}</option
							>{/each}
					</select>
				</label>
				<fieldset>
					<legend>Chamber visibility</legend>
					<label><input type="radio" bind:group={visibility} value="private" /> Private</label>
					<label><input type="radio" bind:group={visibility} value="open" /> Open</label>
				</fieldset>
			</div>
			<div class="preview">
				<div>
					<small>OUTPUT</small><strong
						>+{hero(sourceHeroId)?.synthesisEssenceExperience ?? 0} XP</strong
					><span>stars + level determine essence</span>
				</div>
				<div>
					<small>KNOWLEDGE</small><strong
						>{visibility === 'private' ? 'recipient only' : 'all present'}</strong
					><span>everyone else sees only absence</span>
				</div>
				<button
					onclick={() => (confirmOpen = true)}
					disabled={sourceHeroId === recipientHeroId}
					data-testid="open-synthesis-confirmation">Review synthesis</button
				>
			</div>
		</section>
	{:else}
		<section class="receipt" data-testid="synthesis-receipt">
			<div class="receipt-head">
				<span>Canonical receipt</span>
				<h2>One life ended. The company changed.</h2>
				<code>{receipt.receiptId.slice(0, 13)}</code>
			</div>
			<div class="receipt-grid">
				<article>
					<small>CONSUMED</small><strong>{hero(receipt.sourceHeroId)?.callsign}</strong>
					<p>{receipt.sourceProgression.stars}★ · LV {receipt.sourceProgression.level}</p>
				</article>
				<article class="gain">
					<small>RECIPIENT</small><strong>{hero(receipt.recipientHeroId)?.callsign}</strong>
					<p>
						+{receipt.essenceExperience} XP · LV {receipt.recipientProgressionBefore.level} → {receipt
							.recipientProgressionAfter.level}
					</p>
				</article>
				<article>
					<small>VISIBILITY</small><strong>{receipt.visibility.toUpperCase()}</strong>
					<p>
						{receipt.socialConsequences.filter((item) => item.knowledge !== 'absence').length} know ·
						{receipt.socialConsequences.filter((item) => item.knowledge === 'absence').length} infer absence
					</p>
				</article>
			</div>
			<div class="fallout">
				{#each receipt.socialConsequences as consequence (consequence.heroId)}
					<div>
						<strong>{hero(consequence.heroId)?.callsign}</strong><span
							>{label(consequence.knowledge)} · {consequence.confidence}%</span
						><code
							>trust {delta(consequence.relationshipDeltas.trust)} / fear {delta(
								consequence.relationshipDeltas.fear
							)} / resentment {delta(consequence.relationshipDeltas.resentment)}</code
						>
					</div>
				{/each}
			</div>
		</section>

		<section class="rumor" data-testid="synthesis-rumor-panel">
			<div>
				<span>Autonomous social aftermath</span>
				<h2>Truth can leave the chamber.</h2>
				<p>
					A hero who knows may choose to tell another. The engine records who spoke, who heard,
					confidence, and chain depth.
				</p>
			</div>
			{#if view.latestRumor}
				<article data-testid="synthesis-rumor-record">
					<small>RUMOR {view.rumorCount}</small><strong
						>{hero(view.latestRumor.speakerHeroId)?.callsign} → {hero(
							view.latestRumor.listenerHeroId
						)?.callsign}</strong
					>
					<p>{view.latestRumor.confidence}% confidence · chain {view.latestRumor.chainDepth}</p>
					<code>{view.latestRumor.rumorId.slice(0, 13)}</code>
				</article>
			{:else if view.rumorOptions[0]}
				{@const option = view.rumorOptions[0]}
				<button
					disabled={busy}
					onclick={() => post({ action: 'share-rumor', ...option })}
					data-testid="share-synthesis-rumor"
				>
					{busy
						? 'Speaking…'
						: `Let ${hero(option.speakerHeroId)?.callsign} tell ${hero(option.targetHeroId)?.callsign}`}
				</button>
			{:else}<p class="sealed">Everyone present already knows. No rumor target remains.</p>{/if}
		</section>
	{/if}

	<section class="proofline">
		<div><span>STATE</span><code>{view.stateHash.slice(0, 16)}</code></div>
		<div><span>EVENT CURSOR</span><strong>{view.eventCursor}</strong></div>
		<div><span>WARNING</span><strong>{view.warning.version}</strong></div>
		<div><span>REPLAY</span><strong>STRICT</strong></div>
	</section>

	{#if confirmOpen}
		<div class="modal-backdrop" role="presentation">
			<div
				class="modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="warning-title"
				data-testid="synthesis-confirmation"
			>
				<span>IRREVERSIBLE ACTION</span>
				<h2 id="warning-title">{view.warning.title}</h2>
				<p>{view.warning.body}</p>
				<div class="pair">
					<strong>{hero(sourceHeroId)?.callsign}</strong><i>→</i><strong
						>{hero(recipientHeroId)?.callsign}</strong
					>
				</div>
				<div class="modal-actions">
					<button class="cancel" onclick={() => (confirmOpen = false)}>Cancel</button><button
						class="confirm"
						onclick={synthesize}
						disabled={busy}
						data-testid="confirm-synthesis">{busy ? 'Binding…' : 'Confirm synthesis'}</button
					>
				</div>
			</div>
		</div>
	{/if}
	{#if errorMessage}<div class="error" role="alert">{errorMessage}</div>{/if}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #070605;
		color: #eee6d8;
		font-family: Inter, system-ui, sans-serif;
	}
	:global(button),
	:global(select),
	:global(input) {
		font: inherit;
	}
	main {
		min-height: 100vh;
		background:
			radial-gradient(circle at 50% 31rem, #4c2d0e2b, transparent 34rem),
			repeating-linear-gradient(90deg, transparent 0 8rem, #bc884106 8rem 8.05rem), #070605;
	}
	nav {
		height: 3.1rem;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 clamp(1rem, 4vw, 4rem);
		border-bottom: 1px solid #362c21;
		color: #82786c;
		font:
			0.58rem ui-monospace,
			monospace;
		letter-spacing: 0.14em;
	}
	nav code {
		justify-self: end;
		color: #c18b45;
	}
	.wordmark {
		color: #eee6d8;
		text-decoration: none;
		font: 800 0.75rem Inter;
	}
	header {
		max-width: 92rem;
		margin: auto;
		padding: clamp(2.5rem, 6vw, 5.5rem) clamp(1.2rem, 5vw, 5rem) 2rem;
		display: flex;
		justify-content: space-between;
		align-items: end;
	}
	.eyebrow,
	.console-head span,
	.receipt-head span,
	.rumor > div > span {
		color: #c8944a;
		font:
			0.62rem ui-monospace,
			monospace;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.8rem 0 0;
		font:
			300 clamp(3.6rem, 8vw, 7.4rem)/0.84 Georgia,
			serif;
		letter-spacing: -0.06em;
	}
	h1 em {
		color: #d3a256;
		font-weight: 300;
	}
	.seal {
		width: 8rem;
		height: 8rem;
		border: 1px solid #5d4930;
		border-radius: 50%;
		display: grid;
		place-items: center;
		position: relative;
		color: #8e7a60;
	}
	.seal i {
		position: absolute;
		inset: 15%;
		border: 1px dashed #5d4930;
		border-radius: 50%;
	}
	.seal span {
		z-index: 1;
		font: 700 0.7rem ui-monospace;
		letter-spacing: 0.18em;
	}
	.seal small {
		position: absolute;
		bottom: -1.6rem;
		font: 0.55rem ui-monospace;
	}
	.seal.committed {
		color: #edbc68;
		box-shadow: 0 0 3rem #c07e2233;
	}
	.chamber {
		height: 24rem;
		max-width: 100rem;
		margin: 0 auto;
		position: relative;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr)) 8rem repeat(2, minmax(0, 1fr));
		gap: clamp(0.5rem, 2vw, 2rem);
		align-items: center;
		padding: 2rem clamp(1rem, 5vw, 5rem);
		overflow: hidden;
	}
	.chamber::before {
		content: '';
		position: absolute;
		width: 14rem;
		height: 14rem;
		border: 1px solid #855d2a;
		border-radius: 50%;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		box-shadow:
			0 0 5rem #c8862a2b,
			inset 0 0 3rem #000;
	}
	.rail {
		position: absolute;
		left: 4%;
		right: 4%;
		top: 50%;
		height: 1px;
		background: linear-gradient(90deg, transparent, #735028, #d89b4b, #735028, transparent);
	}
	.hero {
		min-width: 0;
		position: relative;
		z-index: 2;
		display: flex;
		gap: 0.8rem;
		align-items: center;
		padding: 0.8rem;
		border: 1px solid #3f3326;
		background: #0c0a07e8;
	}
	.hero-1 {
		grid-column: 1;
	}
	.hero-2 {
		grid-column: 2;
	}
	.hero-3 {
		grid-column: 4;
	}
	.hero-4 {
		grid-column: 5;
	}
	.portrait {
		width: 3rem;
		height: 3.8rem;
		flex: none;
		display: grid;
		place-items: center;
		border: 1px solid #624a2c;
		background: linear-gradient(145deg, #3b2919, #100c08);
		position: relative;
		overflow: hidden;
	}
	.portrait span {
		color: #d9ac69;
		font: 1.5rem Georgia;
	}
	.portrait i {
		position: absolute;
		inset: auto -20% -40%;
		height: 70%;
		border-radius: 50%;
		background: #a96f2e33;
	}
	.hero-meta {
		min-width: 0;
	}
	.hero-meta small {
		color: #8c7963;
		font: 0.52rem ui-monospace;
		letter-spacing: 0.13em;
	}
	.hero-meta h2 {
		margin: 0.3rem 0;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.74rem;
		white-space: nowrap;
	}
	.hero-meta p {
		margin: 0;
		color: #a69c8f;
		font: 0.56rem ui-monospace;
	}
	.hero.terminal {
		opacity: 0.58;
		filter: grayscale(1);
		border-color: #6c3426;
	}
	.hero.terminal::after {
		content: 'TERMINAL';
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		color: #e07758;
		font: 700 0.48rem ui-monospace;
		letter-spacing: 0.14em;
		padding: 0.25rem 0.35rem;
		border: 1px solid #783728;
		background: #1b0805f0;
	}
	.knowledge {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		right: 0;
		padding: 0.42rem;
		border-left: 2px solid #6d5b43;
		background: #15110c;
		font: 0.5rem ui-monospace;
	}
	.knowledge strong,
	.knowledge span {
		display: block;
	}
	.knowledge span {
		color: #8d8378;
		margin-top: 0.2rem;
	}
	.knowledge.participant,
	.knowledge.witness {
		border-color: #d49c4d;
	}
	.knowledge.absence {
		border-color: #756a5b;
	}
	.core {
		position: absolute;
		z-index: 3;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 8rem;
		height: 8rem;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: radial-gradient(circle, #d7a658 0 3%, #5b3715 5%, #110b06 55%);
		border: 1px solid #be8540;
		box-shadow: 0 0 2rem #dc963f33;
		pointer-events: none;
	}
	.core i {
		position: absolute;
		inset: 12%;
		border: 1px dashed #795326;
		border-radius: 50%;
	}
	.core span {
		color: #efc477;
		font: 1.8rem Georgia;
	}
	.core small {
		position: absolute;
		top: 105%;
		width: 10rem;
		text-align: center;
		color: #746652;
		font: 0.48rem ui-monospace;
		letter-spacing: 0.12em;
	}
	.console,
	.receipt,
	.rumor,
	.proofline {
		max-width: 90rem;
		margin: 1rem auto;
		border: 1px solid #382d21;
		background: #0b0907;
	}
	.console {
		padding: clamp(1.2rem, 3vw, 2.5rem);
	}
	.console-head,
	.receipt-head {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
		border-bottom: 1px solid #34291e;
		padding-bottom: 1.2rem;
	}
	.console h2,
	.receipt h2,
	.rumor h2 {
		margin: 0.3rem 0 0;
		font: 300 clamp(1.8rem, 4vw, 3rem) Georgia;
	}
	.console-head code,
	.receipt-head code {
		color: #776956;
		font: 0.58rem ui-monospace;
	}
	.controls {
		display: grid;
		grid-template-columns: 1fr auto 1fr 13rem;
		gap: 1rem;
		align-items: end;
		padding: 1.5rem 0;
	}
	.controls > label > span,
	legend {
		display: block;
		margin-bottom: 0.5rem;
		color: #8c7e6b;
		font: 0.58rem ui-monospace;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}
	select {
		width: 100%;
		color: #eadfce;
		background: #110d09;
		border: 1px solid #594329;
		padding: 0.85rem;
	}
	.arrow {
		color: #c9954c;
		font-size: 1.5rem;
		padding-bottom: 0.55rem;
	}
	fieldset {
		min-height: 4.4rem;
		border: 1px solid #4c3a26;
		display: flex;
		gap: 1rem;
		align-items: center;
	}
	fieldset label {
		color: #b9ab98;
		font-size: 0.75rem;
	}
	.preview {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 1rem;
		align-items: center;
		padding-top: 1.2rem;
		border-top: 1px solid #34291e;
	}
	.preview div {
		display: grid;
		gap: 0.2rem;
	}
	.preview small,
	.receipt-grid small,
	.rumor article small {
		color: #8b7558;
		font: 0.54rem ui-monospace;
		letter-spacing: 0.12em;
	}
	.preview strong {
		font-size: 0.85rem;
	}
	.preview span {
		color: #867d72;
		font-size: 0.7rem;
	}
	button {
		border: 1px solid #bd8440;
		background: #b77931;
		color: #100a05;
		padding: 0.85rem 1rem;
		cursor: pointer;
		font-weight: 800;
	}
	button:disabled {
		opacity: 0.5;
	}
	.receipt {
		padding: clamp(1.2rem, 3vw, 2.5rem);
	}
	.receipt-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: #34291e;
		margin-top: 1.5rem;
	}
	.receipt-grid article {
		background: #0e0b08;
		padding: 1.2rem;
		display: grid;
		gap: 0.5rem;
	}
	.receipt-grid strong {
		font: 1rem ui-monospace;
	}
	.receipt-grid p {
		margin: 0;
		color: #978b7c;
		font-size: 0.75rem;
	}
	.receipt-grid .gain {
		box-shadow: inset 0 2px #d39a4b;
	}
	.fallout {
		margin-top: 1rem;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}
	.fallout div {
		padding: 0.8rem;
		border-left: 2px solid #846137;
		background: #12100c;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.3rem;
	}
	.fallout code {
		grid-column: 1/-1;
		color: #9b7750;
		font-size: 0.55rem;
	}
	.rumor {
		padding: clamp(1.2rem, 3vw, 2.5rem);
		display: grid;
		grid-template-columns: 1fr minmax(18rem, 30rem);
		gap: 2rem;
		align-items: center;
	}
	.rumor p {
		color: #8e857a;
		line-height: 1.6;
		max-width: 40rem;
	}
	.rumor article {
		border: 1px solid #72522e;
		padding: 1rem;
		display: grid;
		gap: 0.5rem;
		background: #181109;
	}
	.rumor article strong {
		font: 0.8rem ui-monospace;
	}
	.rumor article p {
		margin: 0;
	}
	.rumor code {
		color: #b98747;
	}
	.sealed {
		border-left: 2px solid #65543f;
		padding-left: 1rem;
	}
	.proofline {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-bottom: 4rem;
	}
	.proofline div {
		padding: 1rem;
		border-right: 1px solid #382d21;
		display: grid;
		gap: 0.3rem;
	}
	.proofline span {
		color: #756b5e;
		font: 0.5rem ui-monospace;
		letter-spacing: 0.12em;
	}
	.proofline strong,
	.proofline code {
		color: #b38a51;
		font: 0.65rem ui-monospace;
	}
	.modal-backdrop {
		position: fixed;
		z-index: 20;
		inset: 0;
		background: #030201dd;
		display: grid;
		place-items: center;
		padding: 1rem;
		backdrop-filter: blur(8px);
	}
	.modal {
		width: min(34rem, 100%);
		border: 1px solid #b07132;
		background: radial-gradient(circle at 50% 0, #3b230f, #100b07 45%);
		box-shadow: 0 2rem 8rem #000;
		padding: 2rem;
	}
	.modal > span {
		color: #e4a451;
		font: 0.62rem ui-monospace;
		letter-spacing: 0.17em;
	}
	.modal h2 {
		font: 2rem Georgia;
		margin: 0.7rem 0;
	}
	.modal p {
		color: #a99c8c;
		line-height: 1.6;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 1rem;
		align-items: center;
		padding: 1rem;
		border: 1px solid #4e3923;
		font: 0.7rem ui-monospace;
		text-align: center;
	}
	.pair i {
		color: #d59a4c;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.7rem;
		margin-top: 1.5rem;
	}
	.cancel {
		background: transparent;
		color: #b4a898;
		border-color: #514637;
	}
	.confirm {
		background: #bf7730;
	}
	.error {
		position: fixed;
		z-index: 30;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.8rem 1rem;
		background: #431d13;
		border: 1px solid #c06448;
		color: #ffd8c8;
	}
	@media (max-width: 900px) {
		nav {
			grid-template-columns: 1fr auto;
		}
		nav > span {
			display: none;
		}
		.chamber {
			height: auto;
			grid-template-columns: repeat(2, 1fr);
			padding-bottom: 8rem;
		}
		.hero-1,
		.hero-2,
		.hero-3,
		.hero-4 {
			grid-column: auto;
		}
		.core {
			top: auto;
			bottom: 0.5rem;
		}
		.controls,
		.preview,
		.rumor {
			grid-template-columns: 1fr;
		}
		.arrow {
			transform: rotate(90deg);
			justify-self: center;
		}
		.receipt-grid,
		.proofline {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 560px) {
		header {
			align-items: start;
		}
		.seal {
			width: 5rem;
			height: 5rem;
		}
		.chamber {
			grid-template-columns: 1fr;
		}
		.fallout,
		.receipt-grid,
		.proofline {
			grid-template-columns: 1fr;
		}
	}
</style>
