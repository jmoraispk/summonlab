<script lang="ts">
	import LabBackLink from '$lib/components/living-village/LabBackLink.svelte';
	import PortalGlyph from '$lib/components/summoning/PortalGlyph.svelte';
	import RatesPanel from '$lib/components/living-village/summon/RatesPanel.svelte';
	import RevealStage from '$lib/components/living-village/summon/RevealStage.svelte';
	import {
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

	type ArrivalResult = HeroFixture & {
		arrivalId: string;
		unread: boolean;
		isBonus: boolean;
	};

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
	let guaranteeRenewed = $state(false);
	let spendFlash = $state<{ currency: 'sigil' | 'gem'; label: string } | null>(null);
	let currentHero = $state<HeroFixture>(featuredHero);
	let pendingResults = $state<ArrivalResult[]>([
		{ ...featuredHero, arrivalId: 'featured-preview', unread: false, isBonus: false }
	]);
	let sessionArrivals = $state<ArrivalResult[]>([]);
	let selectedHero = $state<HeroFixture | null>(null);
	let singleCursor = $state(0);
	let arrivalSerial = 0;
	let shouldRecordArrival = false;
	let ratesTrigger: HTMLButtonElement;
	let spendTimer: number | undefined;

	const progressPercent = $derived(`${(guaranteeProgress / guarantee.threshold) * 100}%`);
	const guaranteedHero = heroes.find((hero) => hero.stars === 3) ?? featuredHero;

	function flashSpend(currency: 'sigil' | 'gem', label: string) {
		if (spendTimer) window.clearTimeout(spendTimer);
		spendFlash = { currency, label };
		spendTimer = window.setTimeout(() => (spendFlash = null), 1200);
	}

	function createArrival(hero: HeroFixture, isBonus = false): ArrivalResult {
		arrivalSerial += 1;
		return { ...hero, arrivalId: `arrival-${arrivalSerial}`, unread: true, isBonus };
	}

	function resolveArrivals(receipt: readonly HeroFixture[]): ArrivalResult[] {
		let renewed = false;
		const arrivals = receipt.map((plannedHero, index) => {
			const nextProgress = guaranteeProgress + 1;
			const hero = nextProgress >= guarantee.threshold ? guaranteedHero : plannedHero;
			if (hero.stars >= 3) renewed = true;
			guaranteeProgress = hero.stars >= 3 ? 0 : nextProgress;
			return createArrival(hero, index === receipt.length - 1 && receipt.length > 1);
		});
		guaranteeRenewed = renewed;
		return arrivals;
	}

	function beginReveal(mode: OfferMode, receipt: ArrivalResult[]) {
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
			const hero = heroes[(singleCursor + 1) % heroes.length] ?? featuredHero;
			singleCursor += 1;
			beginReveal('single', resolveArrivals([hero]));
			return;
		}
		if (gems < 1600) return;
		gems -= 1600;
		flashSpend('gem', '−1,600');
		beginReveal('batch', resolveArrivals(batchReceipt));
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

	function selectArrival(arrival: ArrivalResult) {
		pendingResults = pendingResults.map((item) =>
			item.arrivalId === arrival.arrivalId ? { ...item, unread: false } : item
		);
		sessionArrivals = sessionArrivals.map((item) =>
			item.arrivalId === arrival.arrivalId ? { ...item, unread: false } : item
		);
		selectedHero = arrival;
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
	<LabBackLink />
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
				onselect={(hero) => selectArrival(hero as ArrivalResult)}
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
						{#each sessionArrivals as hero (hero.arrivalId)}
							<button
								type="button"
								class:unread={hero.unread}
								data-stars={hero.stars}
								onclick={() => selectArrival(hero)}
								aria-label={`View ${hero.name} stats${hero.unread ? ', new arrival' : ''}`}
							>
								{#if hero.unread}<i class="new-mark">New</i>{/if}
								<i class="star-mark">{hero.stars}★</i>
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
					<span
						>{guaranteeRenewed
							? '3★ arrived · guarantee renewed'
							: 'Next summon advances the bond'}</span
					><span>{guarantee.threshold - guaranteeProgress} remaining</span>
				</footer>
			</section>

			<button
				bind:this={ratesTrigger}
				type="button"
				class="rates-button"
				onclick={() => (ratesOpen = true)}
				aria-haspopup="dialog"
				data-recognition-ms={recognitionMs ?? undefined}
			>
				<span
					><PortalGlyph kind="star" size={18} /><span
						><small>Standard banner</small><strong>Rates &amp; details</strong></span
					></span
				><i>Open →</i>
			</button>

			<section class="offers" aria-label="Summon offers">
				<p><span>Open the gate</span><i>Costs shown before summon</i></p>
				<button
					type="button"
					class="single-offer"
					onclick={() => summon('single')}
					data-testid="summon-single"
				>
					<span><strong>Summon ×1</strong></span>
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
					<span><strong>Summon ×10</strong></span>
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
	progress={guaranteeProgress}
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
	.portal-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.62fr) minmax(350px, 0.7fr);
		gap: 17px;
		margin-top: 16px;
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
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		padding: 15px 16px 13px;
	}
	.offers > p {
		grid-column: 1 / -1;
		display: flex;
		justify-content: space-between;
		margin: 0 3px 1px;
		color: #7d8b85;
		font-size: 0.53rem;
	}
	.offers > p i {
		color: #a28656;
		font-style: normal;
	}
	.offers button {
		position: relative;
		display: grid;
		align-content: space-between;
		gap: 12px;
		min-height: 82px;
		width: 100%;
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
		display: flex;
		align-items: center;
	}
	.offers button strong {
		font:
			500 0.91rem Georgia,
			serif;
	}
	.offers .cost {
		justify-content: flex-start;
		gap: 6px;
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
		--rarity: #d9a956;
		position: relative;
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
	.arrival-rail button[data-stars='2'] {
		--rarity: #77bff1;
	}
	.arrival-rail button[data-stars='3'] {
		--rarity: #bd8cf4;
	}
	.arrival-rail button.unread {
		border-color: color-mix(in srgb, var(--rarity) 62%, transparent);
		box-shadow: inset 0 0 20px color-mix(in srgb, var(--rarity) 9%, transparent);
	}
	.arrival-rail .new-mark {
		position: absolute;
		z-index: 2;
		top: -1px;
		right: -1px;
		padding: 3px 6px;
		border-radius: 0 8px 0 7px;
		background: var(--rarity);
		color: #071014;
		font-size: 0.43rem;
		font-style: normal;
		font-weight: 850;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.arrival-rail .star-mark {
		position: absolute;
		z-index: 2;
		right: 5px;
		bottom: 4px;
		padding: 2px 5px;
		border: 1px solid color-mix(in srgb, var(--rarity) 55%, transparent);
		border-radius: 99px;
		background: #071014e8;
		color: var(--rarity);
		font-size: 0.43rem;
		font-style: normal;
		font-weight: 800;
		letter-spacing: 0.05em;
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
