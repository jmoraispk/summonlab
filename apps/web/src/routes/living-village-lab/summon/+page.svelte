<script lang="ts">
	import PortalGlyph from '$lib/components/living-village/summon/PortalGlyph.svelte';
	import RatesPanel from '$lib/components/living-village/summon/RatesPanel.svelte';
	import RevealStage from '$lib/components/living-village/summon/RevealStage.svelte';
	import {
		banners,
		batchReceipt,
		featuredHero,
		guarantee,
		heroes,
		offers,
		rates,
		revealDirections,
		wallets,
		type HeroFixture,
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
	let sigils = $state<number>(wallets[0].balance);
	let gems = $state<number>(wallets[1].balance);
	let guaranteeProgress = $state<number>(guarantee.current);
	let spendFlash = $state<{ currency: 'sigil' | 'gem'; label: string } | null>(null);
	let currentHero = $state<HeroFixture>(featuredHero);
	let pendingResults = $state<HeroFixture[]>([featuredHero]);
	let sessionArrivals = $state<HeroFixture[]>([]);
	let selectedHero = $state<HeroFixture | null>(null);
	let singleCursor = $state(0);
	let shouldRecordArrival = false;
	let ratesTrigger: HTMLButtonElement;
	let spendTimer: number | undefined;

	const progressPercent = $derived(`${(guaranteeProgress / guarantee.threshold) * 100}%`);
	const selectedDirection = $derived(revealDirections.find((item) => item.id === direction)!);

	function flashSpend(currency: 'sigil' | 'gem', label: string) {
		if (spendTimer) window.clearTimeout(spendTimer);
		spendFlash = { currency, label };
		spendTimer = window.setTimeout(() => (spendFlash = null), 1200);
	}

	function beginReveal(mode: OfferMode, receipt: HeroFixture[]) {
		offerMode = mode;
		pendingResults = receipt;
		currentHero = receipt[0] ?? featuredHero;
		selectedHero = null;
		resultVisible = false;
		recognitionMs = null;
		runToken += 1;
		shouldRecordArrival = true;
	}

	function summon(mode: OfferMode) {
		if (mode === 'single') {
			if (sigils > 0) {
				sigils -= 1;
				flashSpend('sigil', '−1');
			} else {
				if (gems < 160) return;
				gems -= 160;
				flashSpend('gem', '−160');
			}
			guaranteeProgress = Math.min(guarantee.threshold, guaranteeProgress + 1);
			const hero = heroes[(singleCursor + 1) % heroes.length] ?? featuredHero;
			singleCursor += 1;
			beginReveal('single', [hero]);
			return;
		}
		if (gems < 1600) return;
		gems -= 1600;
		guaranteeProgress = Math.min(guarantee.threshold, guaranteeProgress + 11);
		flashSpend('gem', '−1,600');
		beginReveal('batch', [...batchReceipt]);
	}

	function replay() {
		resultVisible = false;
		selectedHero = null;
		recognitionMs = null;
		runToken += 1;
		shouldRecordArrival = false;
	}

	function finishReveal() {
		resultVisible = true;
		if (!shouldRecordArrival) return;
		const next = pendingResults.map((hero) => hero);
		if (offerMode === 'single') sessionArrivals = [...sessionArrivals, ...next].slice(-11);
		else sessionArrivals = next;
		shouldRecordArrival = false;
	}

	function chooseDirection(next: RevealDirection) {
		direction = next;
		ratesOpen = false;
		replay();
	}

	function closeRates() {
		ratesOpen = false;
		requestAnimationFrame(() => ratesTrigger?.focus());
	}
</script>

<svelte:head>
	<title>Summoning Portal · Living Village</title>
	<meta name="description" content="Open the Hearth Gate and meet the people who answer." />
</svelte:head>

<main>
	<div class="ambient one"></div>
	<div class="ambient two"></div>
	<header class="portal-header">
		<div class="brand">
			<div class="brand-seal"><PortalGlyph kind="ember" size={24} /></div>
			<div>
				<p>Summonlab · Living Village</p>
				<strong>Summoning Portal</strong>
			</div>
		</div>
		<section class="wallets" aria-label="Currency balances">
			<div
				class="wallet"
				class:spending={spendFlash?.currency === 'sigil'}
				data-testid="wallet-sigil"
			>
				<PortalGlyph kind="sigil" size={20} /><span
					><small>Gate sigils</small>{#key sigils}<strong>{sigils.toLocaleString()}</strong
						>{/key}</span
				>
				{#if spendFlash?.currency === 'sigil'}<b>{spendFlash.label}</b>{/if}
			</div>
			<div
				class="wallet premium"
				class:spending={spendFlash?.currency === 'gem'}
				data-testid="wallet-gem"
			>
				<PortalGlyph kind="gem" size={20} /><span
					><small>Hearth gems</small>{#key gems}<strong>{gems.toLocaleString()}</strong>{/key}</span
				>
				{#if spendFlash?.currency === 'gem'}<b>{spendFlash.label}</b>{/if}
			</div>
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
					><PortalGlyph kind={banner.state === 'active' ? 'ember' : 'star'} size={16} /></span
				>
				<span
					><small>{banner.state === 'active' ? 'Now open' : 'Coming soon'}</small><strong
						>{banner.label}</strong
					></span
				>
				<i>{banner.state === 'active' ? 'Hearthbound' : banner.kicker}</i>
			</button>
		{/each}
	</nav>

	<section class="portal-grid">
		<div class="hero-column">
			<RevealStage
				hero={currentHero}
				{direction}
				{runToken}
				{reducedMotion}
				{muted}
				{resultVisible}
				resultMode={offerMode}
				results={pendingResults}
				{selectedHero}
				onselect={(hero) => (selectedHero = hero as HeroFixture)}
				onclosedossier={() => (selectedHero = null)}
				onreplay={replay}
				oncomplete={finishReveal}
				ontiming={(milliseconds) => (recognitionMs = milliseconds)}
			/>

			{#if sessionArrivals.length > 0}
				<section class="arrival-rail" aria-label="Recent arrivals" data-testid="arrival-history">
					<header>
						<div>
							<small>Recent arrivals</small><strong>{sessionArrivals.length} at the gate</strong>
						</div>
						<span>Choose a person</span>
					</header>
					<div>
						{#each sessionArrivals as hero, index (`history-${hero.id}-${index}`)}
							<button
								type="button"
								onclick={() => (selectedHero = hero)}
								aria-label={`View ${hero.name} stats`}
							>
								<img src={hero.image} alt="" width="1024" height="1536" /><span
									><strong>{hero.name}</strong><small>{hero.calling}</small></span
								>
							</button>
						{/each}
					</div>
				</section>
			{/if}
		</div>

		<aside class="decision-column" aria-label="Guarantee and summon actions">
			<section class="banner-copy">
				<div class="banner-kicker"><span></span>Standard · Hearthbound</div>
				<h2>A familiar soul,<br /><em>newly arrived.</em></h2>
				<p>
					Call to the six people bound to the Hearth Gate. Meet the person before you decide what
					comes next.
				</p>
				<div class="featured"><span>Featured</span><strong>Mara Vey</strong></div>
			</section>

			<section class="guarantee" data-testid="guarantee-progress">
				<header>
					<div><small>{guarantee.label}</small><strong>{guarantee.threshold} summons</strong></div>
					<span>{guaranteeProgress} / {guarantee.threshold}</span>
				</header>
				<div class="progress">
					<i style:width={progressPercent}></i><b style:left={progressPercent}></b>
				</div>
				<footer>
					<span>Next summon advances the bond</span><span
						>{guarantee.threshold - guaranteeProgress} remaining</span
					>
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
					><PortalGlyph kind="star" size={18} /><span
						><small>Standard banner</small><strong>Rates &amp; details</strong></span
					></span
				><i
					>{recognitionMs === null
						? `${selectedDirection.shortLabel} reveal →`
						: `${recognitionMs} ms to identity →`}</i
				>
			</button>

			<section class="offers" aria-label="Summon offers">
				<p><span>Open the gate</span><i>Costs shown before summon</i></p>
				<button
					type="button"
					class="single-offer"
					onclick={() => summon('single')}
					data-testid="summon-single"
				>
					<span><small>One arrival</small><strong>{offers.single.label}</strong></span>
					<span class="cost"
						><PortalGlyph kind="sigil" size={16} /><strong>{offers.single.cost}</strong></span
					>
				</button>
				<button
					type="button"
					class="batch-offer"
					onclick={() => summon('batch')}
					data-testid="summon-batch"
					disabled={gems < 1600}
				>
					<span class="ribbon">+1 bonus</span>
					<span><small>Eleven arrivals</small><strong>Summon ×10 <em>+ 1 bonus</em></strong></span>
					<span class="cost"
						><PortalGlyph kind="gem" size={17} /><strong>{offers.batch.cost}</strong></span
					>
				</button>
			</section>

			<div class="trust">
				<PortalGlyph kind="sigil" size={15} /><span
					>Demo economy values · final balance and rates pending</span
				>
			</div>
		</aside>
	</section>
</main>

<RatesPanel
	open={ratesOpen}
	{rates}
	{guarantee}
	directions={revealDirections}
	{direction}
	{reducedMotion}
	{muted}
	ondirection={chooseDirection}
	onreduced={() => (reducedMotion = !reducedMotion)}
	onmuted={() => (muted = !muted)}
	onclose={closeRates}
/>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(html) {
		background: #04080b;
	}
	:global(body) {
		min-width: 320px;
		margin: 0;
		background: #04080b;
	}
	:global(button) {
		font: inherit;
	}
	:global(button:focus-visible) {
		outline: 2px solid #8fd7c7;
		outline-offset: 3px;
	}
	main {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		padding: 20px clamp(16px, 3vw, 48px) 30px;
		background:
			radial-gradient(ellipse at 43% 22%, #145a5139, transparent 39%),
			radial-gradient(ellipse at 100% 75%, #6e421b2b, transparent 34%),
			linear-gradient(155deg, #081116, #04090c 60%, #080c0e);
		color: #eee9df;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	main::before {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image:
			linear-gradient(#87c4b608 1px, transparent 1px),
			linear-gradient(90deg, #87c4b608 1px, transparent 1px);
		background-size: 92px 92px;
		mask-image: linear-gradient(black, transparent 78%);
		content: '';
	}
	.ambient {
		position: absolute;
		pointer-events: none;
		border: 1px solid #68ae9f24;
		border-radius: 50%;
	}
	.ambient.one {
		top: 160px;
		left: -340px;
		width: 700px;
		height: 700px;
	}
	.ambient.two {
		right: -240px;
		bottom: -90px;
		width: 580px;
		height: 580px;
		border-color: #b27c3325;
	}
	.portal-header,
	.banner-rail,
	.portal-grid {
		position: relative;
		z-index: 2;
		width: min(1480px, 100%);
		margin-inline: auto;
	}
	.portal-header {
		display: flex;
		justify-content: space-between;
		gap: 20px;
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
		border: 1px solid #cca25d47;
		border-radius: 50%;
		background: radial-gradient(circle, #d99b3721, transparent 70%);
	}
	.brand p {
		margin: 0 0 3px;
		color: #71827c;
		font-size: 0.58rem;
		font-weight: 750;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	.brand strong {
		font:
			500 1.26rem Georgia,
			serif;
		letter-spacing: -0.02em;
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
		min-width: 150px;
		padding: 9px 24px 9px 12px;
		border: 1px solid #bdccc524;
		border-radius: 12px;
		background: linear-gradient(145deg, #152127cf, #0a1115ed);
		box-shadow: inset 0 1px #fff1;
	}
	.wallet.premium {
		border-color: #71bfb33b;
	}
	.wallet > span {
		display: grid;
		gap: 1px;
	}
	.wallet small {
		color: #7e8c87;
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.wallet strong {
		color: #ebe7de;
		font:
			500 1rem Georgia,
			serif;
		animation: wallet-number 480ms ease;
	}
	.wallet b {
		position: absolute;
		top: 3px;
		right: 6px;
		color: #efbd69;
		font-size: 0.65rem;
		animation: spend 1.15s ease-out both;
	}
	.wallet.spending {
		animation: wallet 720ms ease;
	}
	@keyframes wallet-number {
		from {
			opacity: 0;
			transform: translateY(-7px);
			color: #ffcf7c;
		}
	}
	@keyframes wallet {
		38% {
			border-color: #dca851;
			transform: translateY(-2px) scale(1.02);
			box-shadow: 0 0 25px #d99d3740;
		}
	}
	@keyframes spend {
		to {
			opacity: 0;
			transform: translate(20px, -23px);
		}
	}
	.banner-rail {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 7px;
		margin-top: 16px;
		padding: 5px;
		border: 1px solid #c3d3cb1a;
		border-radius: 15px;
		background: #080e12c4;
	}
	.banner-rail button {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 10px;
		align-items: center;
		min-width: 0;
		padding: 9px 12px;
		border: 1px solid transparent;
		border-radius: 11px;
		background: transparent;
		color: #66736e;
		text-align: left;
	}
	.banner-rail button.active {
		border-color: #d0a45d3d;
		background: linear-gradient(125deg, #ba7e2216, #17322b42);
		color: #e8e3d9;
	}
	.banner-rail button:disabled {
		opacity: 0.56;
	}
	.banner-glyph {
		display: grid;
		width: 31px;
		height: 31px;
		place-items: center;
		border: 1px solid #d0ddd723;
		border-radius: 50%;
	}
	.banner-rail button > span:nth-child(2) {
		display: grid;
		gap: 1px;
	}
	.banner-rail small {
		font-size: 0.49rem;
		font-weight: 730;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.banner-rail strong {
		font:
			500 0.84rem Georgia,
			serif;
	}
	.banner-rail i {
		overflow: hidden;
		font-size: 0.52rem;
		font-style: normal;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.banner-rail .active i {
		color: #84bbaa;
	}
	.portal-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.62fr) minmax(350px, 0.7fr);
		gap: 17px;
		margin-top: 12px;
	}
	.hero-column {
		display: grid;
		gap: 10px;
		min-width: 0;
	}
	.decision-column {
		min-width: 0;
		overflow: hidden;
		border: 1px solid #bfcec727;
		border-radius: 25px;
		background: linear-gradient(160deg, #121d22ed, #080e12f8 58%, #0c1114f8);
		box-shadow:
			inset 0 1px #fff1,
			0 26px 85px #0007;
	}
	.banner-copy {
		position: relative;
		padding: 27px 25px 21px;
		border-bottom: 1px solid #dbe8df16;
		background: radial-gradient(circle at 100% 0, #c8872730, transparent 48%);
	}
	.banner-copy::after {
		position: absolute;
		top: -45px;
		right: -25px;
		width: 145px;
		height: 145px;
		border: 1px solid #d2a65a25;
		border-radius: 50%;
		content: '';
		box-shadow: inset 0 0 30px #d09a4020;
	}
	.banner-kicker {
		display: flex;
		gap: 8px;
		align-items: center;
		color: #b18f59;
		font-size: 0.56rem;
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
			500 clamp(2rem, 3vw, 3rem)/0.94 Georgia,
			serif;
		letter-spacing: -0.05em;
	}
	.banner-copy h2 em {
		color: #d4a861;
		font-weight: 400;
	}
	.banner-copy > p {
		max-width: 390px;
		margin: 0;
		color: #89958f;
		font-size: 0.74rem;
		line-height: 1.55;
	}
	.featured {
		display: flex;
		justify-content: space-between;
		margin-top: 19px;
		padding-top: 13px;
		border-top: 1px solid #fff1;
	}
	.featured span {
		color: #65736e;
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.featured strong {
		font:
			500 0.78rem Georgia,
			serif;
	}
	.guarantee {
		padding: 18px 21px 16px;
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
		color: #79aa9e;
		font-size: 0.53rem;
		font-weight: 740;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.guarantee header strong {
		font:
			500 1.02rem Georgia,
			serif;
	}
	.guarantee header > span {
		color: #a8d4c8;
		font-size: 0.72rem;
		font-weight: 720;
	}
	.progress {
		position: relative;
		height: 4px;
		margin-top: 12px;
		border-radius: 99px;
		background: #d7ebe31b;
	}
	.progress i {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: inherit;
		background: linear-gradient(90deg, #287a6a, #80cdbb);
		box-shadow: 0 0 13px #68bdab66;
		transition: width 520ms ease;
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
		transition: left 520ms ease;
	}
	.guarantee footer {
		display: flex;
		justify-content: space-between;
		margin-top: 8px;
		color: #66766f;
		font-size: 0.5rem;
	}
	.rates-button {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: calc(100% - 32px);
		margin: 14px 16px 0;
		padding: 11px 12px;
		border: 1px solid #8acaba36;
		border-radius: 12px;
		background: #245f5412;
		color: #dce7e2;
		cursor: pointer;
	}
	.rates-button > span,
	.rates-button > span > span {
		display: flex;
		gap: 9px;
		align-items: center;
	}
	.rates-button > span > span {
		display: grid;
		gap: 1px;
		text-align: left;
	}
	.rates-button small {
		color: #6e837c;
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.rates-button strong {
		font-size: 0.68rem;
	}
	.rates-button i {
		color: #86b9ad;
		font-size: 0.55rem;
		font-style: normal;
	}
	.offers {
		padding: 15px 16px 13px;
	}
	.offers > p {
		display: flex;
		justify-content: space-between;
		margin: 0 3px 9px;
		color: #7d8b85;
		font-size: 0.53rem;
	}
	.offers > p i {
		color: #a28656;
		font-style: normal;
	}
	.offers button {
		position: relative;
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: center;
		width: 100%;
		margin-top: 8px;
		padding: 13px 14px;
		border: 1px solid #d1dfd822;
		border-radius: 13px;
		background: linear-gradient(145deg, #18252a, #0d1519);
		color: #ece9e1;
		text-align: left;
		cursor: pointer;
		transition:
			transform 180ms ease,
			border-color 180ms ease;
	}
	.offers button:hover:not(:disabled) {
		transform: translateY(-2px);
		border-color: #7cc7b66e;
	}
	.offers button:disabled {
		opacity: 0.48;
		cursor: not-allowed;
	}
	.offers button > span:not(.ribbon) {
		display: grid;
		gap: 2px;
	}
	.offers button small {
		color: #71807a;
		font-size: 0.5rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.offers button strong {
		font:
			500 0.91rem Georgia,
			serif;
	}
	.offers .cost {
		justify-items: end;
	}
	.offers .cost strong {
		color: #d6c8aa;
		font:
			650 0.6rem Inter,
			sans-serif;
	}
	.offers .batch-offer {
		overflow: hidden;
		border-color: #d0a2524e;
		background: linear-gradient(145deg, #2a2115, #111719);
		box-shadow: inset 0 0 28px #bb7e1815;
	}
	.batch-offer em {
		color: #edbd66;
		font-style: normal;
	}
	.ribbon {
		position: absolute;
		top: 0;
		right: 0;
		padding: 4px 8px;
		border-radius: 0 12px 0 9px;
		background: #d6a64f;
		color: #18130c;
		font-size: 0.47rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.trust {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 11px 18px 16px;
		color: #687770;
		font-size: 0.54rem;
	}
	.arrival-rail {
		overflow: hidden;
		padding: 11px 13px 13px;
		border: 1px solid #bed8d027;
		border-radius: 16px;
		background: #0a1216d9;
	}
	.arrival-rail header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 9px;
	}
	.arrival-rail header > div {
		display: grid;
		gap: 1px;
	}
	.arrival-rail header small {
		color: #72ad9f;
		font-size: 0.49rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.arrival-rail header strong {
		font:
			500 0.83rem Georgia,
			serif;
	}
	.arrival-rail header > span {
		color: #687770;
		font-size: 0.51rem;
	}
	.arrival-rail > div {
		display: flex;
		gap: 7px;
		overflow-x: auto;
		padding: 1px;
	}
	.arrival-rail button {
		display: grid;
		grid-template-columns: 38px auto;
		gap: 7px;
		align-items: center;
		flex: 0 0 auto;
		min-width: 128px;
		padding: 5px;
		border: 1px solid #caddd625;
		border-radius: 9px;
		background: #0d171c;
		color: #dce2df;
		text-align: left;
		cursor: pointer;
	}
	.arrival-rail button:hover {
		border-color: #75c8b55e;
	}
	.arrival-rail img {
		width: 38px;
		height: 44px;
		object-fit: cover;
		object-position: center 15%;
		border-radius: 6px;
	}
	.arrival-rail button span {
		display: grid;
		gap: 2px;
	}
	.arrival-rail button strong {
		font:
			500 0.66rem Georgia,
			serif;
	}
	.arrival-rail button small {
		color: #71817a;
		font-size: 0.48rem;
	}
	@media (max-width: 980px) {
		.portal-grid {
			grid-template-columns: 1fr;
		}
		.decision-column {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
		.banner-copy {
			grid-row: span 3;
		}
		.offers {
			grid-column: 2;
		}
		.trust {
			grid-column: 2;
		}
	}
	@media (max-width: 680px) {
		main {
			padding: 13px 10px 24px;
		}
		.portal-header {
			align-items: flex-start;
		}
		.brand p {
			display: none;
		}
		.brand strong {
			font-size: 1rem;
		}
		.brand-seal {
			width: 38px;
			height: 38px;
		}
		.wallets {
			gap: 5px;
		}
		.wallet {
			min-width: 0;
			padding: 7px 9px;
		}
		.wallet small {
			font-size: 0.44rem;
		}
		.wallet strong {
			font-size: 0.8rem;
		}
		.banner-rail button {
			grid-template-columns: auto 1fr;
			padding: 8px;
		}
		.banner-rail button > i {
			display: none;
		}
		.banner-glyph {
			display: none;
		}
		.portal-grid {
			margin-top: 8px;
		}
		.decision-column {
			display: block;
			border-radius: 20px;
		}
		.banner-copy {
			padding: 23px 20px 19px;
		}
		.banner-copy h2 {
			font-size: 2.25rem;
		}
		.guarantee {
			padding: 16px 18px;
		}
		.rates-button {
			width: calc(100% - 24px);
			margin-inline: 12px;
		}
		.offers {
			padding-inline: 12px;
		}
		.trust {
			padding-inline: 14px;
		}
	}
</style>
