<script lang="ts">
	import { tick } from 'svelte';
	import PortalGlyph from '$lib/components/living-village/summon/PortalGlyph.svelte';
	import RatesPanel from '$lib/components/living-village/summon/RatesPanel.svelte';
	import ResultPresentation from '$lib/components/living-village/summon/ResultPresentation.svelte';
	import RevealStage from '$lib/components/living-village/summon/RevealStage.svelte';

	import {
		FIXTURE_VERSION,
		banners,
		batchReceipt,
		featuredHero,
		guarantee,
		offers,
		rates,
		revealDirections,
		wallets,
		type OfferMode,
		type RevealDirection
	} from './fixtures';

	let direction = $state<RevealDirection>('gate');
	let offerMode = $state<OfferMode>('single');
	let runToken = $state(0);
	let resultVisible = $state(false);
	let recognitionMs = $state<number | null>(null);
	let ratesOpen = $state(false);
	let reducedMotion = $state(false);
	let muted = $state(true);
	let previewSigils = $state<number>(wallets[0].balance);
	let previewGems = $state<number>(wallets[1].balance);
	let previewGuarantee = $state<number>(guarantee.current);
	let spendFlash = $state<{ currency: 'sigil' | 'gem'; label: string } | null>(null);
	let walletNotice = $state('Ready for a reversible spend preview');
	let ratesTrigger: HTMLButtonElement;
	let stageAnchor = $state<HTMLElement>();
	let resultAnchor = $state<HTMLElement>();
	let spendTimer: number | undefined;

	const selectedDirection = $derived(revealDirections.find((item) => item.id === direction)!);
	const progressPercent = $derived(`${(previewGuarantee / guarantee.threshold) * 100}%`);

	function runReveal(mode: OfferMode) {
		offerMode = mode;
		resultVisible = false;
		recognitionMs = null;
		runToken += 1;
		requestAnimationFrame(() =>
			stageAnchor?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
		);
	}

	function flashSpend(currency: 'sigil' | 'gem', label: string) {
		if (spendTimer) window.clearTimeout(spendTimer);
		spendFlash = { currency, label };
		spendTimer = window.setTimeout(() => (spendFlash = null), 1250);
	}

	function summon(mode: OfferMode) {
		if (mode === 'single') {
			if (previewSigils > 0) {
				previewSigils -= 1;
				flashSpend('sigil', '−1');
				walletNotice = 'Single-summon spend previewed from Gate sigils';
			} else {
				if (previewGems < 160) previewGems = wallets[1].balance;
				previewGems -= 160;
				flashSpend('gem', '−160');
				walletNotice = 'Single-summon spend previewed from Hearth gems';
			}
			previewGuarantee = Math.min(guarantee.threshold, previewGuarantee + 1);
		} else {
			if (previewGems < 1600) previewGems = wallets[1].balance;
			previewGems -= 1600;
			previewGuarantee = Math.min(guarantee.threshold, previewGuarantee + 11);
			flashSpend('gem', '−1,600');
			walletNotice = 'Batch spend and eleven guarantee steps previewed';
		}
		runReveal(mode);
	}

	function chooseDirection(next: RevealDirection) {
		direction = next;
		runReveal(offerMode);
	}

	function replay() {
		runReveal(offerMode);
	}

	function resetFixture() {
		previewSigils = wallets[0].balance;
		previewGems = wallets[1].balance;
		previewGuarantee = guarantee.current;
		spendFlash = null;
		walletNotice = 'Fixture balances and guarantee restored';
	}

	async function finishReveal() {
		resultVisible = true;
		await tick();
		if (window.innerWidth <= 820) {
			window.setTimeout(
				() =>
					resultAnchor?.scrollIntoView({
						behavior: reducedMotion ? 'auto' : 'smooth',
						block: 'start'
					}),
				180
			);
		}
	}

	function closeRates() {
		ratesOpen = false;
		requestAnimationFrame(() => ratesTrigger?.focus());
	}
</script>

<svelte:head>
	<title>Summoning Portal · Living Village Lab</title>
	<meta
		name="description"
		content="A fixture-only Living Village summoning portal prototype for comparing identity reveal directions."
	/>
</svelte:head>

<main>
	<div class="ambient ambient-one"></div>
	<div class="ambient ambient-two"></div>

	<header class="portal-header">
		<div class="brand">
			<div class="brand-seal"><PortalGlyph kind="ember" size={24} /></div>
			<div>
				<p>Summonlab · Living Village</p>
				<strong>Summoning Portal</strong>
			</div>
		</div>
		<div class="fixture-stamp">
			<span>Presentation lab</span>
			<small>{FIXTURE_VERSION}</small>
		</div>
		<section class="wallets" aria-label="Prototype currency balances">
			{#each wallets as wallet (wallet.id)}
				<div
					class="wallet"
					class:spending={spendFlash?.currency === wallet.id}
					data-kind={wallet.kind}
					data-testid={`wallet-${wallet.id}`}
				>
					<PortalGlyph kind={wallet.glyph} size={20} />
					<span>
						<small>{wallet.label}</small>
						{#key wallet.id === 'sigil' ? previewSigils : previewGems}
							<strong class="wallet-number"
								>{(wallet.id === 'sigil' ? previewSigils : previewGems).toLocaleString()}</strong
							>
						{/key}
					</span>
					<i>Preview</i>
					{#if spendFlash?.currency === wallet.id}<b class="spend-delta">{spendFlash.label}</b>{/if}
				</div>
			{/each}
		</section>
	</header>

	<nav class="banner-rail" aria-label="Summon banners">
		{#each banners as banner (banner.id)}
			<button
				type="button"
				class:active={banner.state === 'active'}
				disabled={banner.state === 'preview'}
				aria-current={banner.state === 'active' ? 'page' : undefined}
			>
				<span class="banner-glyph"
					><PortalGlyph kind={banner.state === 'active' ? 'ember' : 'star'} size={17} /></span
				>
				<span><small>{banner.kicker}</small><strong>{banner.label}</strong></span>
				<i>{banner.state === 'active' ? 'Active fixture' : 'Preview · not available'}</i>
			</button>
		{/each}
	</nav>

	<section class="portal-grid">
		<div class="hero-column">
			<div class="stage-anchor" bind:this={stageAnchor}>
				<RevealStage
					hero={featuredHero}
					{direction}
					{runToken}
					{reducedMotion}
					{muted}
					onreplay={replay}
					oncomplete={finishReveal}
					ontiming={(milliseconds) => (recognitionMs = milliseconds)}
				/>
			</div>

			<section class="experiment" aria-labelledby="experiment-title">
				<header>
					<div>
						<p>Owner animation experiment</p>
						<h2 id="experiment-title">Choose a reveal direction</h2>
					</div>
					<div class="experiment-toggles">
						<button
							type="button"
							class:enabled={reducedMotion}
							aria-pressed={reducedMotion}
							onclick={() => (reducedMotion = !reducedMotion)}
							data-testid="reduced-motion-toggle"
						>
							<i></i>Reduced motion: {reducedMotion ? 'on' : 'off'}
						</button>
						<button type="button" aria-pressed={!muted} onclick={() => (muted = !muted)}>
							<span aria-hidden="true">{muted ? '∕' : '♪'}</span>Sound: {muted ? 'muted' : 'armed'}
						</button>
					</div>
				</header>
				<div class="direction-list" data-testid="direction-selector">
					{#each revealDirections as item, index (item.id)}
						<button
							type="button"
							class:selected={direction === item.id}
							aria-pressed={direction === item.id}
							onclick={() => chooseDirection(item.id)}
						>
							<span class="direction-index">0{index + 1}</span>
							<span><strong>{item.label}</strong><small>{item.description}</small></span>
							<i>{item.recognitionTarget}</i>
						</button>
					{/each}
				</div>
				<div class="measurement" aria-live="polite" data-testid="recognition-timing">
					<span><i></i>Same fixed receipt · Mara Vey</span>
					<span>Selected: <strong>{selectedDirection.label}</strong></span>
					<span
						>Recognizable identity: <strong
							>{recognitionMs === null ? 'ready to measure' : `${recognitionMs} ms`}</strong
						></span
					>
				</div>
			</section>
		</div>

		<aside class="decision-column" aria-label="Guarantee and summon actions">
			<section class="banner-copy">
				<div class="banner-kicker"><span></span>Standard · Hearthbound</div>
				<h2>A familiar soul,<br /><em>newly arrived.</em></h2>
				<p>The Hearth Gate calls from six fixed identities. Every person remains unique.</p>
				<div class="featured-mark"><span>Featured presentation</span><strong>Mara Vey</strong></div>
			</section>

			<section class="guarantee" data-testid="guarantee-progress">
				<header>
					<div><small>{guarantee.label}</small><strong>{guarantee.threshold} summons</strong></div>
					<span>{previewGuarantee} / {guarantee.threshold}</span>
				</header>
				<div class="progress">
					<i style:width={progressPercent}></i><b style:left={progressPercent}></b>
				</div>
				<footer>
					<span>{guarantee.status}</span><span>Session preview · no durable progress</span>
				</footer>
			</section>

			<button
				bind:this={ratesTrigger}
				type="button"
				class="rates-button"
				onclick={() => (ratesOpen = true)}
				aria-haspopup="dialog"
			>
				<span
					><PortalGlyph kind="star" size={19} /><span
						><small>Disclosure</small><strong>Rates &amp; details</strong></span
					></span
				>
				<i>View once →</i>
			</button>

			<section class="offers" aria-label="Prototype summon offers">
				<p><span>Choose a presentation</span><i>Fixture costs</i></p>
				<button
					type="button"
					class="single-offer"
					onclick={() => summon('single')}
					data-testid="summon-single"
				>
					<span><small>Standard</small><strong>{offers.single.label}</strong></span>
					<span class="cost"
						><PortalGlyph kind="sigil" size={16} /><strong>{offers.single.cost}</strong><small
							>Fixture · no charge</small
						></span
					>
				</button>
				<button
					type="button"
					class="batch-offer"
					onclick={() => summon('batch')}
					data-testid="summon-batch"
				>
					<span class="value-ribbon">+1 bonus</span>
					<span
						><small>Eleven presentation slots</small><strong>Summon ×10 <em>+ 1 bonus</em></strong
						></span
					>
					<span class="cost"
						><PortalGlyph kind="gem" size={17} /><strong>{offers.batch.cost}</strong><small
							>Fixture · no charge</small
						></span
					>
				</button>
				<div class="offer-trust">
					<span>{walletNotice}</span>
					<button type="button" onclick={resetFixture}>Reset fixture</button>
				</div>
			</section>

			<section class="recommendation">
				<div><small>Current recommendation</small><strong>Gate ignition</strong></div>
				<p>Make the portal unmistakable, then reveal the person without a second delay.</p>
			</section>
		</aside>
	</section>

	{#if resultVisible}
		<section class="result-wrap" bind:this={resultAnchor}>
			<ResultPresentation mode={offerMode} hero={featuredHero} batch={batchReceipt} />
		</section>
	{/if}

	<footer class="lab-footer">
		<div>
			<PortalGlyph kind="sigil" size={18} /><span
				><strong>Fixture boundary</strong> · Browser-only presentation; no database, provider, or production
				economy writes.</span
			>
		</div>
		<span>Six identities · one comparison receipt · zero persisted copies</span>
	</footer>
</main>

<RatesPanel open={ratesOpen} {rates} {guarantee} onclose={closeRates} />

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(html) {
		background: #05090c;
	}
	:global(body) {
		margin: 0;
		min-width: 320px;
		background: #05090c;
	}
	:global(button) {
		font: inherit;
	}
	:global(button:focus-visible) {
		outline: 2px solid #9ad8c9;
		outline-offset: 3px;
	}

	main {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		padding: 22px clamp(18px, 3.4vw, 58px) 28px;
		background:
			radial-gradient(ellipse at 48% 22%, #175d5430 0, transparent 38%),
			radial-gradient(ellipse at 95% 70%, #6d411829 0, transparent 32%),
			linear-gradient(155deg, #081116 0%, #050a0d 58%, #080c0e 100%);
		color: #eee9df;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			sans-serif;
	}

	main::before {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image:
			linear-gradient(#7fb7aa0a 1px, transparent 1px),
			linear-gradient(90deg, #7fb7aa08 1px, transparent 1px);
		background-size: 88px 88px;
		mask-image: linear-gradient(to bottom, black, transparent 72%);
		content: '';
	}

	.ambient {
		position: absolute;
		pointer-events: none;
		border: 1px solid #5c9f9030;
		border-radius: 50%;
	}
	.ambient-one {
		top: 195px;
		left: -350px;
		width: 760px;
		height: 760px;
	}
	.ambient-two {
		right: -170px;
		bottom: 12%;
		width: 520px;
		height: 520px;
		border-color: #a8743230;
	}

	.portal-header,
	.banner-rail,
	.portal-grid,
	.result-wrap,
	.lab-footer {
		position: relative;
		z-index: 2;
		width: min(1460px, 100%);
		margin-inline: auto;
	}

	.portal-header {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 24px;
		align-items: center;
	}
	.brand {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.brand-seal {
		display: grid;
		width: 45px;
		height: 45px;
		place-items: center;
		border: 1px solid #c89c5847;
		border-radius: 50%;
		background: radial-gradient(circle, #d69a3f20, transparent 70%);
		box-shadow: inset 0 0 16px #d7953022;
	}
	.brand p {
		margin: 0 0 3px;
		color: #71827c;
		font-size: 0.59rem;
		font-weight: 750;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	.brand strong {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.25rem;
		font-weight: 500;
		letter-spacing: -0.02em;
	}
	.fixture-stamp {
		display: grid;
		gap: 2px;
		padding: 5px 18px;
		border-left: 1px solid #abbfb626;
	}
	.fixture-stamp span {
		color: #c2a16c;
		font-size: 0.62rem;
		font-weight: 750;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	.fixture-stamp small {
		color: #65736e;
		font-size: 0.61rem;
	}

	.wallets {
		display: flex;
		gap: 8px;
	}
	.wallet {
		position: relative;
		display: flex;
		gap: 10px;
		align-items: center;
		min-width: 151px;
		padding: 9px 38px 9px 12px;
		border: 1px solid #bdccc522;
		border-radius: 12px;
		background: linear-gradient(145deg, #152026b8, #0b1114e8);
		box-shadow: inset 0 1px #ffffff0c;
	}
	.wallet > span {
		display: grid;
		gap: 1px;
	}
	.wallet small {
		color: #7e8c87;
		font-size: 0.57rem;
		font-weight: 680;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.wallet strong {
		color: #e9e6dc;
		font:
			500 1rem/1.1 Georgia,
			serif;
	}
	.wallet i {
		position: absolute;
		top: 7px;
		right: 7px;
		color: #90764c;
		font-size: 0.47rem;
		font-style: normal;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.wallet[data-kind='premium'] {
		border-color: #6dbcb13d;
	}
	.wallet.spending {
		animation: wallet-spend 760ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.wallet-number {
		display: block;
		animation: wallet-number 520ms cubic-bezier(0.18, 0.78, 0.24, 1);
	}
	.spend-delta {
		position: absolute;
		z-index: 3;
		top: 50%;
		right: 9px;
		transform: translateY(-50%);
		color: #f1c06f;
		font:
			740 0.75rem/1 Inter,
			ui-sans-serif,
			system-ui;
		animation: spend-delta 1.2s ease-out both;
	}
	@keyframes wallet-spend {
		0%,
		100% {
			border-color: #bdccc522;
			box-shadow: inset 0 1px #ffffff0c;
		}
		32% {
			border-color: #e2af5a;
			box-shadow:
				inset 0 0 24px #e5a64231,
				0 0 24px #d99b3740;
			transform: translateY(-2px) scale(1.025);
		}
	}
	@keyframes wallet-number {
		from {
			opacity: 0;
			transform: translateY(-9px);
			color: #ffd994;
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes spend-delta {
		0% {
			opacity: 0;
			transform: translate(0, -20%);
		}
		25% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(34px, -160%);
		}
	}

	.banner-rail {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		margin-top: 18px;
		padding: 5px;
		border: 1px solid #baccc31a;
		border-radius: 15px;
		background: #080e12b8;
	}
	.banner-rail button {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 10px;
		align-items: center;
		min-width: 0;
		padding: 10px 13px;
		border: 1px solid transparent;
		border-radius: 11px;
		background: transparent;
		color: #6f7a76;
		text-align: left;
	}
	.banner-rail button.active {
		border-color: #d1a66042;
		background: linear-gradient(125deg, #bb7f2418, #16302945);
		color: #e8e4da;
		box-shadow: inset 0 1px #fff1;
	}
	.banner-rail button:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}
	.banner-glyph {
		display: grid;
		width: 32px;
		height: 32px;
		place-items: center;
		border: 1px solid #cddcd41d;
		border-radius: 50%;
		background: #ffffff08;
	}
	.banner-rail button > span:nth-child(2) {
		display: grid;
		gap: 1px;
	}
	.banner-rail small {
		font-size: 0.51rem;
		font-weight: 720;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.banner-rail strong {
		font:
			500 0.85rem Georgia,
			serif;
	}
	.banner-rail i {
		overflow: hidden;
		font-size: 0.53rem;
		font-style: normal;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.banner-rail .active i {
		color: #87bcae;
	}

	.portal-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.63fr) minmax(360px, 0.72fr);
		gap: 18px;
		margin-top: 12px;
	}
	.hero-column {
		display: grid;
		gap: 12px;
		min-width: 0;
	}
	.stage-anchor {
		min-width: 0;
	}
	.decision-column {
		min-width: 0;
		overflow: hidden;
		border: 1px solid #bfcec727;
		border-radius: 24px;
		background: linear-gradient(160deg, #121d22e8, #080e12f5 55%, #0c1114f5);
		box-shadow:
			inset 0 1px #ffffff0f,
			0 24px 80px #0006;
	}

	.banner-copy {
		position: relative;
		padding: 27px 26px 22px;
		border-bottom: 1px solid #dbe8df16;
		background: radial-gradient(circle at 95% 0, #c8862630, transparent 47%);
	}
	.banner-copy::after {
		position: absolute;
		top: -45px;
		right: -24px;
		width: 140px;
		height: 140px;
		border: 1px solid #d4a85c27;
		border-radius: 50%;
		box-shadow: inset 0 0 30px #d09a4021;
		content: '';
	}
	.banner-kicker {
		display: flex;
		gap: 8px;
		align-items: center;
		color: #ae8f5d;
		font-size: 0.58rem;
		font-weight: 760;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.banner-kicker span {
		width: 18px;
		height: 1px;
		background: #cfa45c;
	}
	.banner-copy h2 {
		margin: 13px 0 10px;
		font:
			500 clamp(2rem, 3vw, 3.1rem)/0.95 Georgia,
			'Times New Roman',
			serif;
		letter-spacing: -0.05em;
	}
	.banner-copy h2 em {
		color: #d6aa64;
		font-weight: 400;
	}
	.banner-copy > p {
		max-width: 390px;
		margin: 0;
		color: #89948f;
		font-size: 0.76rem;
		line-height: 1.55;
	}
	.featured-mark {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		margin-top: 20px;
		padding-top: 14px;
		border-top: 1px solid #ffffff0d;
	}
	.featured-mark span {
		color: #65736e;
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.featured-mark strong {
		color: #dcd8ce;
		font:
			500 0.78rem Georgia,
			serif;
	}

	.guarantee {
		padding: 19px 22px 17px;
		border-bottom: 1px solid #dbe8df14;
		background: #2e6f630c;
	}
	.guarantee header {
		display: flex;
		justify-content: space-between;
		align-items: end;
	}
	.guarantee header > div {
		display: grid;
		gap: 3px;
	}
	.guarantee small {
		color: #7ba99e;
		font-size: 0.55rem;
		font-weight: 740;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.guarantee header strong {
		color: #e5e5dd;
		font:
			500 1.05rem Georgia,
			serif;
	}
	.guarantee header > span {
		color: #a8d3c8;
		font-size: 0.75rem;
		font-weight: 720;
	}
	.progress {
		position: relative;
		height: 4px;
		margin-top: 13px;
		border-radius: 99px;
		background: #d7ebe31b;
	}
	.progress i {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: inherit;
		background: linear-gradient(90deg, #287a6a, #80cdbb);
		box-shadow: 0 0 13px #68bdab66;
		transition: width 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.progress b {
		position: absolute;
		top: 50%;
		width: 8px;
		height: 8px;
		transform: translate(-50%, -50%);
		border: 2px solid #c9f0e5;
		border-radius: 50%;
		background: #0c191b;
		box-shadow: 0 0 12px #74c9b8;
		transition: left 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.guarantee footer {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		margin-top: 9px;
		color: #64746e;
		font-size: 0.52rem;
	}
	.guarantee footer span:first-child {
		color: #9b7e4f;
	}

	.rates-button {
		display: flex;
		width: calc(100% - 32px);
		align-items: center;
		justify-content: space-between;
		margin: 14px 16px;
		padding: 12px;
		border: 1px solid #75b9aa3b;
		border-radius: 11px;
		background: linear-gradient(90deg, #214d4638, #11191d);
		color: #cde1da;
		cursor: pointer;
	}
	.rates-button > span {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.rates-button > span > span {
		display: grid;
		gap: 1px;
		text-align: left;
	}
	.rates-button small {
		color: #6f9d92;
		font-size: 0.51rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.rates-button strong {
		font-size: 0.76rem;
	}
	.rates-button i {
		color: #76aa9e;
		font-size: 0.6rem;
		font-style: normal;
	}
	.rates-button:hover {
		border-color: #83cdbc;
		background: #244e47;
	}

	.offers {
		padding: 4px 16px 15px;
	}
	.offers > p {
		display: flex;
		justify-content: space-between;
		margin: 0 1px 8px;
		color: #6c7873;
		font-size: 0.55rem;
		font-weight: 720;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.offers > p i {
		color: #a77c3f;
		font-style: normal;
	}
	.offers > button {
		position: relative;
		display: flex;
		width: 100%;
		min-height: 74px;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 13px 14px;
		border: 1px solid #d4c29938;
		border-radius: 12px;
		color: #eee8dc;
		cursor: pointer;
		text-align: left;
		transition:
			transform 170ms ease,
			border-color 170ms ease,
			filter 170ms ease;
	}
	.offers > button:hover {
		transform: translateY(-2px);
		filter: brightness(1.12);
	}
	.offers > button + button {
		margin-top: 8px;
	}
	.offers > button > span:not(.cost):not(.value-ribbon) {
		display: grid;
		gap: 3px;
	}
	.offers button small {
		color: #9b8a6f;
		font-size: 0.5rem;
		font-weight: 760;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.offers button > span > strong {
		font:
			500 0.88rem Georgia,
			serif;
	}
	.single-offer {
		background: linear-gradient(120deg, #272722, #171b1c 65%, #20251f);
	}
	.batch-offer {
		overflow: hidden;
		background: linear-gradient(125deg, #72491f, #3c2b20 50%, #18332e);
		box-shadow:
			inset 0 1px #fff2,
			0 8px 24px #0004;
	}
	.batch-offer::after {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(110deg, transparent 0 35%, #fff1 50%, transparent 65%);
		content: '';
		transform: translateX(-110%);
		transition: transform 600ms ease;
	}
	.batch-offer:hover::after {
		transform: translateX(110%);
	}
	.batch-offer em {
		color: #f2c879;
		font-size: 0.76rem;
		font-style: normal;
	}
	.cost {
		display: grid;
		grid-template-columns: auto auto;
		gap: 1px 6px;
		align-items: center;
		justify-items: end;
		flex: 0 0 auto;
	}
	.cost strong {
		color: #f0e1c9;
		font-size: 0.68rem;
		white-space: nowrap;
	}
	.cost small {
		grid-column: 1 / -1;
		color: #86745a !important;
		font-size: 0.45rem !important;
	}
	.value-ribbon {
		position: absolute;
		top: -1px;
		right: -1px;
		padding: 4px 8px;
		border-radius: 0 11px 0 9px;
		background: #e0ad5b;
		color: #20170c;
		font-size: 0.47rem;
		font-weight: 850;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.offer-trust {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-top: 10px;
		color: #71807a;
		font-size: 0.51rem;
	}
	.offer-trust span::before {
		margin-right: 5px;
		color: #6eb5a5;
		content: '✓';
	}
	.offer-trust button {
		flex: 0 0 auto;
		padding: 3px 0;
		border: 0;
		border-bottom: 1px solid #b8955c55;
		background: transparent;
		color: #a98b5a;
		font-size: 0.5rem;
		cursor: pointer;
	}

	.recommendation {
		display: flex;
		gap: 15px;
		align-items: center;
		padding: 15px 18px;
		border-top: 1px solid #dae9e218;
		background: #050a0d66;
	}
	.recommendation > div {
		display: grid;
		min-width: 112px;
		gap: 2px;
	}
	.recommendation small {
		color: #95794c;
		font-size: 0.47rem;
		font-weight: 750;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.recommendation strong {
		color: #ddc79f;
		font:
			500 0.7rem Georgia,
			serif;
	}
	.recommendation p {
		margin: 0;
		padding-left: 14px;
		border-left: 1px solid #d7e7df1c;
		color: #697670;
		font-size: 0.58rem;
		line-height: 1.4;
	}

	.experiment {
		overflow: hidden;
		border: 1px solid #b7ccc326;
		border-radius: 18px;
		background: #0a1115d9;
	}
	.experiment > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 15px;
		padding: 14px 16px;
		border-bottom: 1px solid #cbded516;
	}
	.experiment header p {
		margin: 0 0 2px;
		color: #8a724d;
		font-size: 0.5rem;
		font-weight: 760;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	.experiment h2 {
		margin: 0;
		font:
			500 0.95rem Georgia,
			serif;
	}
	.experiment-toggles {
		display: flex;
		gap: 6px;
	}
	.experiment-toggles button {
		min-height: 31px;
		padding: 0 9px;
		border: 1px solid #b9cdc425;
		border-radius: 8px;
		background: #10191d;
		color: #7e8a85;
		font-size: 0.56rem;
		cursor: pointer;
	}
	.experiment-toggles button.enabled {
		border-color: #79c1b1;
		color: #a8d8cd;
	}
	.experiment-toggles button i {
		display: inline-block;
		width: 5px;
		height: 5px;
		margin-right: 4px;
		border-radius: 50%;
		background: currentColor;
	}

	.direction-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.direction-list button {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 10px;
		min-width: 0;
		min-height: 79px;
		padding: 12px 14px;
		border: 0;
		border-right: 1px solid #d6e6de14;
		background: transparent;
		color: #798681;
		cursor: pointer;
		text-align: left;
	}
	.direction-list button:last-child {
		border-right: 0;
	}
	.direction-list button.selected {
		background: linear-gradient(140deg, #305f5435, #b27a2310);
		color: #e7e5dd;
		box-shadow: inset 0 2px #70bead;
	}
	.direction-index {
		color: #a88754;
		font:
			500 0.7rem Georgia,
			serif;
	}
	.direction-list button > span:nth-child(2) {
		display: grid;
		align-content: start;
		gap: 4px;
		min-width: 0;
	}
	.direction-list strong {
		font-size: 0.65rem;
	}
	.direction-list small {
		display: -webkit-box;
		overflow: hidden;
		color: #707c77;
		font-size: 0.53rem;
		line-height: 1.35;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}
	.direction-list i {
		grid-column: 2;
		color: #9e8051;
		font-size: 0.5rem;
		font-style: normal;
	}
	.measurement {
		display: flex;
		gap: 12px 20px;
		flex-wrap: wrap;
		padding: 9px 14px;
		border-top: 1px solid #d6e6de12;
		background: #050a0d7d;
		color: #67756f;
		font-size: 0.53rem;
	}
	.measurement span:first-child {
		margin-right: auto;
	}
	.measurement span:first-child i {
		display: inline-block;
		width: 5px;
		height: 5px;
		margin-right: 6px;
		border-radius: 50%;
		background: #68bdab;
		box-shadow: 0 0 8px #68bdab;
	}
	.measurement strong {
		color: #a8b6b0;
		font-weight: 650;
	}

	.result-wrap {
		margin-top: 18px;
	}
	.lab-footer {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		margin-top: 18px;
		padding-top: 15px;
		border-top: 1px solid #bed2c923;
		color: #62716b;
		font-size: 0.58rem;
	}
	.lab-footer > div {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.lab-footer strong {
		color: #a28658;
		font-weight: 720;
	}

	@media (max-width: 1100px) {
		.portal-header {
			grid-template-columns: 1fr auto;
		}
		.fixture-stamp {
			display: none;
		}
		.portal-grid {
			grid-template-columns: minmax(0, 1.35fr) minmax(330px, 0.8fr);
		}
		.banner-copy {
			padding: 22px 20px 18px;
		}
		.guarantee {
			padding-inline: 18px;
		}
	}

	@media (max-width: 820px) {
		main {
			padding: 14px 12px 22px;
		}
		.portal-header {
			grid-template-columns: 1fr;
			gap: 12px;
		}
		.wallets {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
		.wallet {
			min-width: 0;
		}
		.banner-rail {
			margin-top: 12px;
		}
		.banner-rail button {
			grid-template-columns: auto 1fr;
			padding: 8px;
		}
		.banner-rail i {
			grid-column: 2;
		}
		.portal-grid {
			grid-template-columns: 1fr;
		}
		.hero-column {
			display: contents;
		}
		.stage-anchor {
			order: 1;
		}
		.decision-column {
			order: 2;
			border-radius: 19px;
		}
		.experiment {
			order: 3;
		}
		.banner-copy {
			padding: 18px;
		}
		.banner-copy h2 {
			font-size: 2.35rem;
		}
		.recommendation {
			display: none;
		}
	}

	@media (max-width: 560px) {
		.brand-seal {
			width: 40px;
			height: 40px;
		}
		.wallets {
			gap: 6px;
		}
		.wallet {
			padding: 8px 25px 8px 9px;
		}
		.wallet i {
			font-size: 0.41rem;
		}
		.banner-rail {
			gap: 3px;
			padding: 4px;
		}
		.banner-rail button {
			display: flex;
			min-height: 56px;
			justify-content: center;
			padding: 7px 5px;
			text-align: center;
		}
		.banner-rail .banner-glyph,
		.banner-rail i {
			display: none;
		}
		.banner-rail small {
			font-size: 0.43rem;
		}
		.banner-rail strong {
			font-size: 0.73rem;
		}
		.portal-grid {
			gap: 10px;
			margin-top: 8px;
		}
		.banner-copy > p {
			font-size: 0.7rem;
		}
		.offers > button {
			min-height: 72px;
			padding: 11px;
		}
		.offers button > span > strong {
			font-size: 0.77rem;
		}
		.cost strong {
			font-size: 0.58rem;
		}
		.guarantee footer {
			font-size: 0.47rem;
		}
		.experiment > header {
			display: grid;
		}
		.experiment-toggles {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
		.direction-list {
			grid-template-columns: 1fr;
		}
		.direction-list button {
			grid-template-columns: 30px 1fr auto;
			min-height: 66px;
			border-right: 0;
			border-bottom: 1px solid #d6e6de14;
		}
		.direction-list i {
			grid-column: 3;
			grid-row: 1;
			align-self: center;
		}
		.direction-list small {
			-webkit-line-clamp: 1;
			line-clamp: 1;
		}
		.measurement span:first-child {
			width: 100%;
		}
		.lab-footer {
			display: grid;
		}
		.lab-footer > span {
			display: none;
		}
	}
</style>
