<script lang="ts">
	type Hero = {
		id: string;
		name: string;
		calling: string;
		affinity: string;
		stars: number;
		image: string;
		arrivalId?: string;
		unread?: boolean;
		isBonus?: boolean;
	};

	let {
		mode,
		results,
		onselect
	}: {
		mode: 'single' | 'batch';
		results: readonly Hero[];
		onselect: (hero: Hero) => void;
	} = $props();
</script>

<section class="arrival" data-mode={mode} data-testid="summon-results" aria-live="polite">
	<header>
		<div>
			<p>{mode === 'single' ? 'The gate knows this name' : 'Eleven arrivals answer'}</p>
			<h2>{mode === 'single' ? results[0]?.name : 'The summoned company'}</h2>
		</div>
		<span>{mode === 'single' ? 'Select to inspect' : '10 summoned + 1 bonus'}</span>
	</header>

	<div class:single={mode === 'single'} class="result-grid">
		{#each results as hero, index (hero.arrivalId ?? `${hero.name}-${index}`)}
			<button
				type="button"
				class:bonus={hero.isBonus}
				class:unread={hero.unread}
				data-stars={hero.stars}
				style={`--slot:${index}`}
				onclick={() => onselect(hero)}
				data-testid="arrival-card"
				aria-label={`Inspect ${hero.name}${hero.isBonus ? ', bonus arrival' : ''}${hero.unread ? ', new arrival' : ''}`}
			>
				{#if hero.unread}<i class="new-mark">New</i>{/if}
				{#if hero.isBonus}<i class="bonus-mark">Bonus</i>{/if}
				<div class="portrait"><img src={hero.image} alt="" width="1024" height="1536" /></div>
				<div class="copy">
					<small class="stars"
						>{'✦'.repeat(hero.stars)} <i>{hero.stars}★</i> · {String(index + 1).padStart(
							2,
							'0'
						)}</small
					>
					<strong>{hero.name}</strong>
					<span>{hero.calling} · {hero.affinity}</span>
				</div>
			</button>
		{/each}
	</div>

	<footer>Choose any arrival to see attributes, aptitudes, and personality.</footer>
</section>

<style>
	.arrival {
		position: absolute;
		z-index: 10;
		inset: 58px 18px 68px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: 22px;
		border: 1px solid #b8e4d936;
		border-radius: 20px;
		background: linear-gradient(150deg, #101c22ed, #070c11f5 66%);
		box-shadow:
			0 30px 90px #000d,
			inset 0 1px #fff1;
		backdrop-filter: blur(18px);
		animation: arrive 520ms cubic-bezier(0.18, 0.82, 0.22, 1) both;
	}
	@keyframes arrive {
		from {
			opacity: 0;
			transform: scale(0.975) translateY(12px);
		}
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 16px;
		margin-bottom: 16px;
	}
	header p {
		margin: 0 0 4px;
		color: #82cdbc;
		font-size: 0.58rem;
		font-weight: 760;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	header h2 {
		margin: 0;
		font:
			500 clamp(1.7rem, 3.3vw, 2.7rem)/1 Georgia,
			serif;
		letter-spacing: -0.04em;
	}
	header > span {
		color: #d6b779;
		font-size: 0.61rem;
		font-weight: 720;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.result-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 8px;
		min-height: 0;
		overflow-y: auto;
		padding: 2px;
	}
	.result-grid.single {
		grid-template-columns: minmax(250px, 0.55fr);
		justify-content: center;
		margin: auto 0;
		overflow: visible;
	}
	.result-grid button {
		--rarity: #d9a956;
		--rarity-soft: #d9a95624;
		position: relative;
		min-width: 0;
		overflow: hidden;
		padding: 0;
		border: 1px solid #c9ddd529;
		border-radius: 12px;
		background: #080f14;
		color: #e8e9e3;
		text-align: left;
		cursor: pointer;
		animation: result-enter 540ms cubic-bezier(0.14, 0.78, 0.18, 1) calc(var(--slot) * 42ms) both;
		transition:
			transform 180ms ease,
			border-color 180ms ease,
			box-shadow 180ms ease;
	}
	@keyframes result-enter {
		0% {
			opacity: 0;
			transform: translateY(22px) scale(0.86);
			filter: brightness(2.4) saturate(0);
		}
		55% {
			opacity: 1;
			transform: translateY(-3px) scale(1.025);
			filter: brightness(1.25) saturate(1.2);
		}
		100% {
			opacity: 1;
			transform: none;
			filter: none;
		}
	}
	.result-grid button[data-stars='2'] {
		--rarity: #75c4f4;
		--rarity-soft: #488fca2e;
	}
	.result-grid button[data-stars='3'] {
		--rarity: #bd8cf4;
		--rarity-soft: #8857c438;
	}
	.result-grid button.unread {
		border-color: color-mix(in srgb, var(--rarity) 64%, transparent);
		box-shadow:
			inset 0 0 28px var(--rarity-soft),
			0 0 20px var(--rarity-soft);
	}
	.result-grid button:hover,
	.result-grid button:focus-visible {
		z-index: 2;
		transform: translateY(-4px);
		border-color: #7fd4c1a1;
		box-shadow:
			0 15px 35px #000b,
			0 0 26px #3b9d8b2b;
	}
	.result-grid button.bonus {
		grid-column: 3 / span 2;
		border-color: #e0b35b85;
		box-shadow: inset 0 0 24px #c98a271c;
	}
	.portrait {
		height: 137px;
		overflow: hidden;
		background: radial-gradient(circle at 50% 40%, #256e6461, transparent 60%);
	}
	.single .portrait {
		height: 260px;
	}
	.portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 15%;
		filter: saturate(0.86) contrast(1.03);
		transition: transform 500ms ease;
	}
	button:hover .portrait img {
		transform: scale(1.035);
	}
	.copy {
		display: grid;
		gap: 2px;
		padding: 9px;
	}
	.copy small {
		overflow: hidden;
		color: var(--rarity);
		font-size: 0.48rem;
		letter-spacing: 0.08em;
		white-space: nowrap;
	}
	.copy .stars i {
		font-style: normal;
		opacity: 0.72;
	}
	.copy strong {
		overflow: hidden;
		font:
			500 0.72rem Georgia,
			serif;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.copy span {
		overflow: hidden;
		color: #789089;
		font-size: 0.51rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.single .copy {
		padding: 14px;
	}
	.single .copy strong {
		font-size: 1.15rem;
	}
	.bonus-mark {
		position: absolute;
		z-index: 2;
		top: 7px;
		right: 7px;
		padding: 4px 7px;
		border-radius: 99px;
		background: #d5a14b;
		color: #13100b;
		font-size: 0.47rem;
		font-style: normal;
		font-weight: 820;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.new-mark {
		position: absolute;
		z-index: 3;
		top: 7px;
		left: 7px;
		padding: 4px 7px;
		border-radius: 99px;
		background: var(--rarity);
		box-shadow: 0 0 16px var(--rarity-soft);
		color: #071014;
		font-size: 0.47rem;
		font-style: normal;
		font-weight: 850;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		animation: new-settle 650ms cubic-bezier(0.18, 0.82, 0.2, 1) calc(var(--slot) * 42ms + 280ms)
			both;
	}
	@keyframes new-settle {
		from {
			opacity: 0;
			transform: scale(1.7);
			filter: brightness(2);
		}
	}
	footer {
		margin-top: auto;
		padding-top: 13px;
		color: #71817b;
		font-size: 0.6rem;
		text-align: center;
	}
	@media (max-width: 760px) {
		.arrival {
			inset: 52px 10px 66px;
			padding: 15px;
		}
		header {
			align-items: start;
		}
		header > span {
			max-width: 120px;
			text-align: right;
		}
		.result-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.result-grid button.bonus {
			grid-column: 2 / span 2;
		}
		.portrait {
			height: 105px;
		}
		.result-grid.single {
			grid-template-columns: minmax(210px, 0.82fr);
		}
		.single .portrait {
			height: 230px;
		}
	}
</style>
