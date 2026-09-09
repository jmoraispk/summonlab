<section class="tower-boundary" data-testid="village-tower" aria-labelledby="tower-title">
	<div class="portal" aria-hidden="true"><i></i><span></span></div>
	<div class="copy">
		<p>Tower threshold · Expedition contract pending</p>
		<h1 id="tower-title">Choose the work beyond the Portal.</h1>
		<strong role="status">Expedition controls are not connected yet.</strong>
		<span>
			The Tower will begin with floor choice. It stays separate from Missions, which remains the
			company's objective and story record.
		</span>
		<div class="paths" aria-label="Planned Tower paths">
			<article>
				<small>Conquered floor repeat</small>
				<h2>Train and gather materials</h2>
				<p>Idle-repeat timing and rewards require an authoritative campaign contract.</p>
			</article>
			<article>
				<small>Next unconquered floor</small>
				<h2>Prepare an active expedition</h2>
				<p>Party, cargo, and departure remain unavailable until the exploration handoff exists.</p>
			</article>
		</div>
	</div>
</section>

<style>
	.tower-boundary {
		display: grid;
		grid-template-columns: minmax(15rem, 26rem) minmax(0, 42rem);
		min-height: calc(100vh - 8.55rem);
		align-items: center;
		justify-content: center;
		gap: clamp(2rem, 6vw, 7rem);
		padding: clamp(2rem, 7vw, 7rem) clamp(1.2rem, 6vw, 6rem) 10rem;
		background:
			radial-gradient(circle at 27% 44%, rgba(38, 188, 219, 0.13), transparent 24rem),
			linear-gradient(180deg, #0b1117, #06080c);
	}

	.portal {
		position: relative;
		aspect-ratio: 0.78;
		border: 1px solid rgba(85, 214, 236, 0.28);
		background:
			radial-gradient(ellipse at 50% 50%, rgba(51, 201, 231, 0.3), transparent 36%),
			linear-gradient(90deg, transparent 46%, rgba(65, 205, 231, 0.2) 50%, transparent 54%), #070d12;
		box-shadow: inset 0 0 4rem rgba(34, 186, 214, 0.09);
		clip-path: polygon(12% 100%, 12% 26%, 25% 8%, 50% 0, 75% 8%, 88% 26%, 88% 100%);
	}

	.portal::before,
	.portal::after,
	.portal i,
	.portal span {
		position: absolute;
		content: '';
	}

	.portal::before {
		inset: 12% 23% 8%;
		border: 1px solid #45cce6;
		border-radius: 48% 48% 0 0;
		box-shadow: 0 0 2rem rgba(67, 201, 225, 0.35);
	}

	.portal::after {
		top: 47%;
		left: 24%;
		width: 52%;
		height: 1px;
		background: #45cce6;
	}

	.portal i {
		top: 22%;
		left: 50%;
		width: 1px;
		height: 67%;
		background: #45cce6;
	}

	.portal span {
		top: 36%;
		left: 36%;
		width: 28%;
		aspect-ratio: 1;
		border: 1px solid #e0ad68;
		transform: rotate(45deg);
	}

	.copy > p,
	.paths small {
		margin: 0 0 0.7rem;
		color: #55d6ec;
		font-family: ui-monospace, monospace;
		font-size: 0.61rem;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	h1,
	h2 {
		margin: 0;
		font-family: Georgia, serif;
		font-weight: 400;
	}

	h1 {
		max-width: 38rem;
		font-size: clamp(2.4rem, 5vw, 4.8rem);
		line-height: 0.94;
	}

	.copy > strong,
	.copy > span {
		display: block;
		max-width: 36rem;
	}

	.copy > strong {
		margin-top: 1.4rem;
		color: #e2a15d;
		font:
			400 1rem/1.5 Georgia,
			serif;
	}

	.copy > span {
		margin-top: 0.7rem;
		color: rgba(239, 233, 221, 0.56);
		font-size: 0.8rem;
		line-height: 1.65;
	}

	.paths {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1px;
		margin-top: 2rem;
		background: rgba(224, 173, 104, 0.18);
		border: 1px solid rgba(224, 173, 104, 0.18);
	}

	.paths article {
		padding: 1.2rem;
		background: #090d11;
	}

	.paths small {
		display: block;
		color: #c27b3c;
	}

	.paths h2 {
		font-size: 1.25rem;
	}

	.paths p {
		margin: 0.65rem 0 0;
		color: rgba(239, 233, 221, 0.45);
		font-size: 0.72rem;
		line-height: 1.55;
	}

	@media (max-width: 650px) {
		.tower-boundary {
			grid-template-columns: 1fr;
			align-content: center;
			gap: 1.7rem;
			padding-bottom: 11rem;
		}

		.portal {
			width: min(46vw, 12rem);
			margin: auto;
		}

		.paths {
			grid-template-columns: 1fr;
		}
	}
</style>
