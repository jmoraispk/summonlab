<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let selectedFloor = $state(0);
	let selectedCheckpoint = $state(2);
	const floor = $derived(data.report.floors[selectedFloor]!);
	const checkpoint = $derived(data.report.eligibilitySnapshots[selectedCheckpoint]!);

	function short(value: string) {
		return value.slice(0, 12);
	}

	function label(value: string) {
		return value.replaceAll('-', ' ');
	}
</script>

<svelte:head>
	<title>The Authority No One Gave You · summonlab</title>
	<meta
		name="description"
		content="A deterministic five-floor story envelope with knowledge-safe character expression."
	/>
</svelte:head>

<main data-testid="story-envelope-proof">
	<nav>
		<a href={resolve('/')} class="wordmark">summonlab</a>
		<span>narrative systems / band 01</span>
		<a href={resolve('/story-workshop')}>Story workshop</a>
		<code>{data.report.contentVersion}</code>
	</nav>

	<header>
		<div class="eyebrow">
			<span>MIS-011</span><i></i><span>authored spine · living voices</span>
		</div>
		<div class="title-block">
			<h1>The authority<br /><em>no one gave you.</em></h1>
			<div class="question">
				<span>Emotional question / 01</span>
				<p>{data.report.emotionalQuestion}</p>
			</div>
		</div>
		<div class="proof-strip">
			<div><strong>{data.report.requiredBeatCount}</strong><span>fixed beats</span></div>
			<div><strong>{data.report.optionalBeatCount}</strong><span>optional beats</span></div>
			<div><strong>{data.report.patchSlotCount}</strong><span>bounded slots</span></div>
			<div><strong>{data.report.rewardBudgetPoints}</strong><span>reward points</span></div>
			<div class="verified"><strong>✓</strong><span>hash verified</span></div>
		</div>
	</header>

	<section class="spine" aria-label="Five-floor story spine">
		<div class="section-heading">
			<div>
				<span>Five-floor authored envelope</span>
				<h2>A story can bend<br />without becoming smoke.</h2>
			</div>
			<p>{data.report.theme}</p>
		</div>

		<div class="floor-rail">
			{#each data.report.floors as item, index (item.missionId)}
				<button
					class:active={selectedFloor === index}
					onclick={() => (selectedFloor = index)}
					aria-pressed={selectedFloor === index}
					data-testid={`story-floor-${item.floor}`}
				>
					<span class="floor-number">0{item.floor}</span>
					<i></i>
					<strong>{item.displayName}</strong>
					<small>{item.requiredBeatCount} fixed · {item.optionalBeatCount} optional</small>
				</button>
			{/each}
		</div>

		<article class="floor-detail" data-testid="selected-story-floor">
			<div class="floor-mark">0{floor.floor}<small>/ 05</small></div>
			<div class="floor-copy">
				<span>{floor.missionId}</span>
				<h3>{floor.displayName}</h3>
				<div class="jobs">
					<div>
						<small>Narrative job</small>
						<p>{floor.narrativeJob}</p>
					</div>
					<div>
						<small>Mechanical job</small>
						<p>{floor.mechanicalJob}</p>
					</div>
				</div>
			</div>
			<div class="beat-window">
				<span>Required route</span>
				<strong>{floor.openingTitle}</strong>
				<i></i>
				<strong>{floor.finaleTitle}</strong>
				<small>Patch aperture: {label(floor.patchSlotId)}</small>
			</div>
		</article>
	</section>

	<section class="laws">
		<div class="laws-title">
			<span>What the director cannot change</span>
			<h2>Five laws.<br /><em>Zero exceptions.</em></h2>
			<p>Agents may alter route and expression. The engine keeps causality.</p>
		</div>
		<div class="law-list">
			{#each data.report.worldLaws as law, index (law.lawId)}
				<article>
					<code>0{index + 1}</code>
					<div>
						<strong>{label(law.lawId)}</strong>
						<p>{law.statement}</p>
					</div>
					<span>{law.enforcedBy}</span>
				</article>
			{/each}
		</div>
	</section>

	<section class="eligibility">
		<div class="section-heading compact">
			<div>
				<span>Deterministic beat eligibility</span>
				<h2>The next beat is earned,<br />not hallucinated.</h2>
			</div>
			<p>
				Completed history, floor access, dependencies, and one bounded proposal produce the same
				result every time.
			</p>
		</div>
		<div class="checkpoint-tabs">
			{#each data.report.eligibilitySnapshots as item, index (item.snapshotId)}
				<button
					class:active={selectedCheckpoint === index}
					onclick={() => (selectedCheckpoint = index)}
					aria-pressed={selectedCheckpoint === index}
				>
					<code>0{index + 1}</code><span>{item.label}</span>
				</button>
			{/each}
		</div>
		<article class="checkpoint" data-testid="story-eligibility-checkpoint">
			<div class="checkpoint-orbit">
				<span>FLOOR</span><strong>0{checkpoint.unlockedFloor}</strong><small>UNLOCKED</small>
			</div>
			<div class="checkpoint-main">
				<span>{checkpoint.label}</span>
				<h3>{label(checkpoint.nextDefaultBeatId ?? 'band complete')}</h3>
				<p>Next default beat</p>
				<div class="eligible-beats">
					{#each checkpoint.eligibleBeatIds as beatId (beatId)}
						<span>{label(beatId)}</span>
					{/each}
				</div>
			</div>
			<div class="checkpoint-proof">
				<div><small>Completed</small><strong>{checkpoint.completedBeatCount}</strong></div>
				<div>
					<small>Active patch</small><strong>{checkpoint.activatedProposalIds.length}</strong>
				</div>
				<div><small>Eligibility hash</small><code>{short(checkpoint.eligibilityHash)}</code></div>
			</div>
		</article>
	</section>

	<section class="voices" data-testid="story-expression-proof">
		<div class="voices-heading">
			<span>Character-aware expression hook</span>
			<h2>Facts do not bend.<br /><em>Voices do.</em></h2>
			<p>
				Both summons know the same anchor. Personality, value, habit, and social style change how
				they carry it—never what happened.
			</p>
		</div>
		<div class="immutable-fact">
			<span>Immutable anchor / {label(data.report.expressionProof.anchorId)}</span>
			<p>{data.report.expressionProof.immutableFact}</p>
			<div><i></i><strong>verbatim in both voices</strong><i></i></div>
		</div>
		<div class="voice-pair">
			{#each data.report.expressionProof.voices as voice, index (voice.characterId)}
				<article class:second={index === 1} data-testid="story-voice">
					<div
						class="portrait"
						style={`--cloth:${voice.clothColor}; --accent:${voice.accentColor}`}
					>
						<span
							>{voice.displayName
								.split(' ')
								.map((part) => part[0])
								.join('')}</span
						>
						<i></i>
						<small>{voice.adultAge} · {voice.pronouns}</small>
					</div>
					<div class="voice-copy">
						<div class="voice-meta">
							<span>{voice.frame}</span><code>score {voice.selectionScore}</code>
						</div>
						<h3>{voice.displayName}</h3>
						<p class="traits">{voice.primaryValue} · {voice.primaryDrive} · {voice.socialStyle}</p>
						<blockquote>“{voice.spokenLine}”</blockquote>
						<div class="gesture">
							<span>Habit in frame</span>
							<p>{voice.habitGesture}</p>
						</div>
					</div>
				</article>
			{/each}
		</div>
		<div class="knowledge-gate">
			<strong>∅</strong>
			<div>
				<span>Knowledge gate</span>
				<p>No living holder, no voice. The system returns nothing rather than inventing access.</p>
			</div>
			<code>PASS</code>
		</div>
	</section>

	<section class="finale">
		<div>
			<span>Finale constraints</span>
			<h2>The Foundry still waits.</h2>
		</div>
		<div class="constraint-list">
			{#each data.report.finaleConstraints as constraint, index (constraint.constraintId)}
				<article>
					<code>0{index + 1}</code>
					<p>{constraint.summary}</p>
					<span>{constraint.enforcedBy}</span>
				</article>
			{/each}
		</div>
	</section>

	<footer>
		<div><span>Envelope hash</span><code>{data.report.contentHash.slice(0, 16)}</code></div>
		<div><span>Evidence hash</span><code>{data.report.evidenceHash.slice(0, 16)}</code></div>
		<div><span>Anchor count</span><strong>{data.report.anchorCount}</strong></div>
		<div><span>Reward drift</span><strong>0</strong></div>
		<div class="final-seal"><strong>✓</strong><span>strict recompute</span></div>
	</footer>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #080b0d;
		color: #eee9df;
	}
	:global(button) {
		font: inherit;
	}
	main {
		--ink: #080b0d;
		--paper: #eee9df;
		--muted: #989995;
		--line: #ffffff17;
		--gold: #d5a85d;
		--ember: #d65b2a;
		--cyan: #72c0c4;
		min-height: 100vh;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
		background:
			radial-gradient(circle at 82% 8%, #19303566, transparent 28rem),
			radial-gradient(circle at 9% 24%, #3d171344, transparent 34rem), #080b0d;
	}
	nav {
		height: 72px;
		padding: 0 5vw;
		display: flex;
		align-items: center;
		gap: 25px;
		border-bottom: 1px solid var(--line);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-size: 10px;
		color: #7f8385;
	}
	nav span {
		margin-right: auto;
	}
	nav code {
		color: var(--cyan);
	}
	.wordmark {
		color: var(--paper);
		font:
			18px Georgia,
			serif;
		text-transform: lowercase;
		text-decoration: none;
		letter-spacing: -0.02em;
	}
	header {
		padding: 86px 6vw 0;
	}
	.eyebrow,
	.section-heading > div > span,
	.laws-title > span,
	.voices-heading > span,
	.finale > div > span {
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 10px;
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 13px;
	}
	.eyebrow i {
		width: 52px;
		height: 1px;
		background: var(--gold);
	}
	.title-block {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 420px);
		align-items: end;
		gap: 6vw;
	}
	h1 {
		margin: 30px 0 46px;
		font:
			400 clamp(66px, 8.6vw, 130px)/0.84 Georgia,
			serif;
		letter-spacing: -0.065em;
	}
	h1 em,
	.laws h2 em,
	.voices h2 em {
		color: transparent;
		-webkit-text-stroke: 1px #d8d1c4;
	}
	.question {
		margin-bottom: 54px;
		padding: 25px 0 5px 26px;
		border-left: 1px solid var(--cyan);
	}
	.question span,
	.floor-copy > span,
	.beat-window > span,
	.checkpoint-main > span,
	.immutable-fact > span,
	.gesture span,
	.knowledge-gate span {
		text-transform: uppercase;
		letter-spacing: 0.16em;
		color: #7c8688;
		font-size: 9px;
	}
	.question p {
		margin: 12px 0 0;
		font:
			17px/1.65 Georgia,
			serif;
		color: #bbb9b2;
	}
	.proof-strip {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		border: 1px solid var(--line);
		border-bottom: 0;
	}
	.proof-strip > div {
		padding: 23px 25px;
		border-right: 1px solid var(--line);
		display: flex;
		align-items: baseline;
		gap: 12px;
	}
	.proof-strip > div:last-child {
		border: 0;
	}
	.proof-strip strong {
		color: var(--gold);
		font:
			28px Georgia,
			serif;
	}
	.proof-strip span {
		color: #777d7e;
		text-transform: uppercase;
		letter-spacing: 0.13em;
		font-size: 9px;
	}
	.proof-strip .verified strong {
		color: var(--cyan);
	}
	.spine,
	.eligibility,
	.voices {
		padding: 110px 6vw;
		border-top: 1px solid var(--line);
	}
	.section-heading {
		display: grid;
		grid-template-columns: 1fr minmax(300px, 520px);
		gap: 8vw;
		align-items: end;
		margin-bottom: 65px;
	}
	.section-heading h2,
	.laws h2,
	.voices h2,
	.finale h2 {
		margin: 16px 0 0;
		font:
			400 clamp(40px, 5vw, 72px)/0.94 Georgia,
			serif;
		letter-spacing: -0.045em;
	}
	.section-heading > p,
	.laws-title > p,
	.voices-heading > p {
		margin: 0;
		color: #8f9290;
		line-height: 1.7;
		max-width: 520px;
	}
	.floor-rail {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		border-top: 1px solid #ffffff23;
	}
	.floor-rail button {
		position: relative;
		min-height: 155px;
		padding: 30px 18px;
		color: #777;
		background: transparent;
		border: 0;
		border-right: 1px solid var(--line);
		text-align: left;
		cursor: pointer;
	}
	.floor-rail button:last-child {
		border-right: 0;
	}
	.floor-rail button::before {
		content: '';
		position: absolute;
		top: -2px;
		left: 0;
		width: 0;
		height: 3px;
		background: var(--gold);
		transition: width 0.3s ease;
	}
	.floor-rail button.active::before {
		width: 100%;
	}
	.floor-rail button.active {
		color: var(--paper);
		background: #ffffff05;
	}
	.floor-number {
		display: block;
		color: var(--gold);
		font:
			29px Georgia,
			serif;
	}
	.floor-rail i {
		display: block;
		height: 16px;
		border-left: 1px solid #ffffff20;
		margin: 10px 0;
	}
	.floor-rail strong,
	.floor-rail small {
		display: block;
	}
	.floor-rail strong {
		font:
			15px Georgia,
			serif;
	}
	.floor-rail small {
		margin-top: 8px;
		font-size: 8px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #686d6e;
	}
	.floor-detail {
		display: grid;
		grid-template-columns: 190px 1fr minmax(300px, 0.75fr);
		border: 1px solid var(--line);
		min-height: 310px;
		background: linear-gradient(120deg, #111419, #0b0f12);
	}
	.floor-mark {
		display: grid;
		place-content: center;
		color: var(--cyan);
		border-right: 1px solid var(--line);
		font:
			86px/0.8 Georgia,
			serif;
		letter-spacing: -0.07em;
	}
	.floor-mark small {
		font:
			10px Inter,
			sans-serif;
		color: #666;
		letter-spacing: 0.15em;
		margin-top: 18px;
		text-align: center;
	}
	.floor-copy {
		padding: 52px 48px;
	}
	.floor-copy h3 {
		margin: 13px 0 35px;
		font:
			38px Georgia,
			serif;
	}
	.jobs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
	}
	.jobs small {
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-size: 8px;
	}
	.jobs p {
		color: #a5a6a2;
		line-height: 1.6;
		margin: 9px 0;
	}
	.beat-window {
		padding: 52px 42px;
		border-left: 1px solid var(--line);
		display: flex;
		flex-direction: column;
	}
	.beat-window strong {
		font:
			20px Georgia,
			serif;
		margin-top: 19px;
	}
	.beat-window i {
		width: 1px;
		height: 35px;
		background: linear-gradient(var(--ember), var(--cyan));
		margin: 15px 0 0 5px;
	}
	.beat-window small {
		margin-top: auto;
		color: #646a6c;
		line-height: 1.5;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 8px;
	}
	.laws {
		padding: 110px 6vw;
		border-top: 1px solid var(--line);
		display: grid;
		grid-template-columns: 0.8fr 1.4fr;
		gap: 8vw;
		background: #09090b;
	}
	.laws-title {
		position: sticky;
		top: 40px;
		align-self: start;
	}
	.laws-title p {
		margin-top: 30px;
	}
	.law-list {
		border-top: 1px solid var(--line);
	}
	.law-list article {
		display: grid;
		grid-template-columns: 50px 1fr 90px;
		gap: 24px;
		align-items: start;
		padding: 25px 0;
		border-bottom: 1px solid var(--line);
	}
	.law-list code {
		color: var(--gold);
	}
	.law-list strong {
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 11px;
	}
	.law-list p {
		margin: 8px 0 0;
		color: #969895;
		line-height: 1.6;
	}
	.law-list > article > span {
		color: var(--cyan);
		text-transform: uppercase;
		text-align: right;
		font-size: 8px;
		letter-spacing: 0.15em;
	}
	.compact {
		margin-bottom: 45px;
	}
	.checkpoint-tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border: 1px solid var(--line);
	}
	.checkpoint-tabs button {
		padding: 20px;
		border: 0;
		border-right: 1px solid var(--line);
		background: transparent;
		color: #707677;
		text-align: left;
		cursor: pointer;
	}
	.checkpoint-tabs button:last-child {
		border: 0;
	}
	.checkpoint-tabs button.active {
		background: #13171a;
		color: var(--paper);
	}
	.checkpoint-tabs code {
		color: var(--gold);
		margin-right: 12px;
	}
	.checkpoint-tabs span {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.checkpoint {
		min-height: 330px;
		display: grid;
		grid-template-columns: 230px 1fr 260px;
		border: 1px solid var(--line);
		border-top: 0;
		background: radial-gradient(circle at 15% 50%, #2c1716, transparent 22rem), #0c1013;
	}
	.checkpoint-orbit {
		display: grid;
		place-content: center;
		text-align: center;
		border-right: 1px solid var(--line);
	}
	.checkpoint-orbit::before {
		content: '';
		position: absolute;
	}
	.checkpoint-orbit span,
	.checkpoint-orbit small {
		font-size: 8px;
		letter-spacing: 0.2em;
		color: #777;
	}
	.checkpoint-orbit strong {
		font:
			80px Georgia,
			serif;
		color: var(--ember);
		line-height: 0.95;
	}
	.checkpoint-main {
		padding: 55px;
	}
	.checkpoint-main h3 {
		margin: 17px 0 5px;
		font:
			39px Georgia,
			serif;
		text-transform: capitalize;
	}
	.checkpoint-main > p {
		color: #757a7b;
	}
	.eligible-beats {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 35px;
	}
	.eligible-beats span {
		border: 1px solid #72c0c444;
		padding: 8px 11px;
		color: var(--cyan);
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.checkpoint-proof {
		padding: 42px 32px;
		border-left: 1px solid var(--line);
		display: grid;
	}
	.checkpoint-proof div {
		border-bottom: 1px solid var(--line);
		padding: 14px 0;
	}
	.checkpoint-proof div:last-child {
		border: 0;
	}
	.checkpoint-proof small {
		display: block;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 8px;
		margin-bottom: 8px;
	}
	.checkpoint-proof strong {
		font:
			27px Georgia,
			serif;
		color: var(--gold);
	}
	.checkpoint-proof code {
		color: var(--cyan);
	}
	.voices {
		background: radial-gradient(circle at 50% 45%, #1a242655, transparent 34rem), #090c0e;
	}
	.voices-heading {
		text-align: center;
		max-width: 780px;
		margin: 0 auto 55px;
	}
	.voices-heading p {
		margin: 25px auto 0;
	}
	.immutable-fact {
		max-width: 940px;
		margin: 0 auto;
		padding: 28px 45px;
		text-align: center;
		border: 1px solid #d5a85d55;
		background: #d5a85d08;
	}
	.immutable-fact p {
		font:
			20px/1.5 Georgia,
			serif;
		margin: 13px 0;
	}
	.immutable-fact > div {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 12px;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-size: 8px;
	}
	.immutable-fact i {
		width: 40px;
		height: 1px;
		background: #d5a85d66;
	}
	.voice-pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		max-width: 1180px;
		margin: 45px auto 0;
		border: 1px solid var(--line);
	}
	.voice-pair article {
		min-height: 470px;
		display: grid;
		grid-template-columns: 155px 1fr;
		border-right: 1px solid var(--line);
	}
	.voice-pair article:last-child {
		border: 0;
	}
	.portrait {
		position: relative;
		overflow: hidden;
		border-right: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: linear-gradient(160deg, color-mix(in srgb, var(--cloth) 75%, #090c0e), #090c0e);
	}
	.portrait::before {
		content: '';
		width: 92px;
		height: 118px;
		border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
		border-radius: 48% 48% 42% 42%;
		position: absolute;
		background: #090b0d88;
	}
	.portrait::after {
		content: '';
		position: absolute;
		width: 160px;
		height: 180px;
		border-radius: 50% 50% 0 0;
		top: 53%;
		background: var(--cloth);
		border-top: 1px solid var(--accent);
	}
	.portrait > span {
		z-index: 1;
		color: var(--accent);
		font:
			24px Georgia,
			serif;
	}
	.portrait > i {
		width: 30px;
		height: 1px;
		background: var(--accent);
		margin: 10px;
		z-index: 1;
	}
	.portrait > small {
		position: absolute;
		bottom: 18px;
		z-index: 2;
		font-size: 8px;
		letter-spacing: 0.1em;
		color: #aaa;
	}
	.voice-copy {
		padding: 40px 34px;
		display: flex;
		flex-direction: column;
	}
	.voice-meta {
		display: flex;
		justify-content: space-between;
		color: var(--cyan);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-size: 8px;
	}
	.voice-copy h3 {
		margin: 18px 0 4px;
		font:
			32px Georgia,
			serif;
	}
	.traits {
		margin: 0;
		color: #777;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 8px;
	}
	blockquote {
		margin: 36px 0;
		color: #d8d3ca;
		font:
			19px/1.6 Georgia,
			serif;
	}
	.gesture {
		margin-top: auto;
		padding-top: 18px;
		border-top: 1px solid var(--line);
	}
	.gesture p {
		color: #8d918f;
		font-size: 12px;
		line-height: 1.5;
		margin: 8px 0;
	}
	.knowledge-gate {
		max-width: 1180px;
		margin: 0 auto;
		padding: 20px 28px;
		display: grid;
		grid-template-columns: 40px 1fr 60px;
		gap: 20px;
		align-items: center;
		border: 1px solid var(--line);
		border-top: 0;
	}
	.knowledge-gate > strong {
		color: var(--ember);
		font-size: 28px;
	}
	.knowledge-gate p {
		margin: 6px 0 0;
		color: #8b8e8d;
		font-size: 12px;
	}
	.knowledge-gate code {
		color: var(--cyan);
	}
	.finale {
		padding: 100px 6vw;
		display: grid;
		grid-template-columns: 0.8fr 1.3fr;
		gap: 8vw;
		border-top: 1px solid var(--line);
	}
	.constraint-list {
		border-top: 1px solid var(--line);
	}
	.constraint-list article {
		display: grid;
		grid-template-columns: 45px 1fr 80px;
		gap: 20px;
		padding: 22px 0;
		border-bottom: 1px solid var(--line);
		align-items: center;
	}
	.constraint-list code {
		color: var(--ember);
	}
	.constraint-list p {
		margin: 0;
		color: #aaa9a4;
		line-height: 1.5;
	}
	.constraint-list span {
		text-align: right;
		color: var(--gold);
		text-transform: uppercase;
		font-size: 8px;
		letter-spacing: 0.12em;
	}
	footer {
		display: grid;
		grid-template-columns: repeat(4, 1fr) 180px;
		margin-top: 20px;
		padding: 0 6vw 55px;
	}
	footer > div {
		min-height: 72px;
		border: 1px solid var(--line);
		border-right: 0;
		padding: 19px 22px;
	}
	footer > div:last-child {
		border-right: 1px solid var(--line);
	}
	footer span {
		display: block;
		color: #606566;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 7px;
		margin-bottom: 8px;
	}
	footer code {
		color: #aaa;
		font-size: 10px;
	}
	footer strong {
		color: var(--gold);
	}
	.final-seal {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.final-seal strong {
		color: var(--cyan);
		font-size: 22px;
	}
	.final-seal span {
		margin: 0;
		color: var(--cyan);
	}

	@media (max-width: 900px) {
		.title-block,
		.section-heading,
		.laws,
		.finale {
			grid-template-columns: 1fr;
		}
		.question {
			margin-bottom: 40px;
		}
		.proof-strip {
			grid-template-columns: repeat(2, 1fr);
		}
		.floor-rail {
			grid-template-columns: 1fr;
		}
		.floor-rail button {
			min-height: auto;
			border-bottom: 1px solid var(--line);
		}
		.floor-detail,
		.checkpoint {
			grid-template-columns: 1fr;
		}
		.floor-mark {
			min-height: 150px;
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
		.beat-window,
		.checkpoint-proof {
			border-left: 0;
			border-top: 1px solid var(--line);
		}
		.checkpoint-tabs {
			grid-template-columns: 1fr 1fr;
		}
		.voice-pair {
			grid-template-columns: 1fr;
		}
		.voice-pair article {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
		footer {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 560px) {
		nav span {
			display: none;
		}
		header,
		.spine,
		.laws,
		.eligibility,
		.voices,
		.finale {
			padding-left: 22px;
			padding-right: 22px;
		}
		h1 {
			font-size: 54px;
		}
		.proof-strip,
		.jobs,
		.checkpoint-tabs {
			grid-template-columns: 1fr;
		}
		.floor-copy,
		.beat-window,
		.checkpoint-main {
			padding: 32px 25px;
		}
		.voice-pair article {
			grid-template-columns: 110px 1fr;
		}
		.voice-copy {
			padding: 30px 20px;
		}
		blockquote {
			font-size: 16px;
		}
		.knowledge-gate {
			grid-template-columns: 30px 1fr;
		}
		.knowledge-gate code {
			display: none;
		}
		footer {
			grid-template-columns: 1fr;
			padding-left: 22px;
			padding-right: 22px;
		}
		footer > div {
			border-right: 1px solid var(--line);
			border-bottom: 0;
		}
		footer > div:last-child {
			border-bottom: 1px solid var(--line);
		}
	}
</style>
