<section
	class="inventory-boundary"
	data-testid="village-inventory"
	aria-labelledby="inventory-title"
>
	<div class="chest" aria-hidden="true"><i></i><span></span></div>
	<div>
		<p>Custody ledger · No authoritative projection</p>
		<h1 id="inventory-title">The storeroom has no keeper yet.</h1>
		<strong>Shared Village Inventory is not established for this campaign yet.</strong>
		<span>
			The forge workshop tracks a different equipment history. It will not be presented here as
			shared supplies until custody, packing, and mission-return rules are part of the campaign.
		</span>
	</div>
</section>

<style>
	.inventory-boundary {
		display: grid;
		grid-template-columns: minmax(14rem, 24rem) minmax(0, 34rem);
		min-height: calc(100vh - 8.55rem);
		align-items: center;
		justify-content: center;
		gap: clamp(2rem, 6vw, 7rem);
		padding: clamp(2rem, 7vw, 7rem) clamp(1.2rem, 6vw, 6rem) 10rem;
		background:
			radial-gradient(circle at 28% 45%, rgba(180, 111, 50, 0.13), transparent 23rem),
			linear-gradient(180deg, #121115, #08090b);
	}

	.chest {
		position: relative;
		aspect-ratio: 1.35;
		border: 1px solid rgba(224, 181, 108, 0.25);
		background:
			linear-gradient(90deg, transparent 46%, rgba(224, 181, 108, 0.2) 46% 54%, transparent 54%),
			repeating-linear-gradient(0deg, #241a15 0 2.4rem, #171214 2.4rem 2.55rem);
		box-shadow:
			inset 0 0 0 0.5rem #0d0d10,
			0 2rem 5rem rgba(0, 0, 0, 0.55);
		clip-path: polygon(0 22%, 8% 4%, 92% 4%, 100% 22%, 100% 100%, 0 100%);
	}

	.chest::before {
		position: absolute;
		top: 20%;
		right: 0;
		left: 0;
		height: 0.6rem;
		border-top: 1px solid rgba(224, 181, 108, 0.3);
		border-bottom: 1px solid rgba(224, 181, 108, 0.18);
		background: #0c0d10;
		content: '';
	}

	.chest i {
		position: absolute;
		top: 13%;
		left: 50%;
		z-index: 1;
		width: 2.6rem;
		height: 3.7rem;
		border: 1px solid #aa7139;
		background: #161313;
		transform: translateX(-50%);
	}

	.chest span {
		position: absolute;
		right: 8%;
		bottom: 8%;
		left: 8%;
		height: 1px;
		background: rgba(224, 181, 108, 0.12);
	}

	p {
		margin: 0 0 0.7rem;
		color: #be7739;
		font-family: ui-monospace, monospace;
		font-size: 0.61rem;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0 0 1.3rem;
		font:
			400 clamp(2.4rem, 5vw, 4.8rem)/0.94 Georgia,
			serif;
	}

	strong,
	.inventory-boundary > div:last-child > span {
		display: block;
		max-width: 31rem;
	}

	strong {
		margin-bottom: 0.8rem;
		color: #e0b16f;
		font:
			400 1rem/1.5 Georgia,
			serif;
	}

	.inventory-boundary > div:last-child > span {
		color: rgba(239, 233, 221, 0.5);
		font-size: 0.78rem;
		line-height: 1.65;
	}

	@media (max-width: 650px) {
		.inventory-boundary {
			grid-template-columns: 1fr;
			align-content: center;
			gap: 2rem;
			padding-bottom: 11rem;
		}

		.chest {
			width: min(68vw, 16rem);
			margin: auto;
		}
	}
</style>
