<script lang="ts">
	import { onDestroy } from 'svelte';

	import type { EquipmentWorkshopProjection } from '$lib/server/equipment-runtime';

	let {
		runId,
		initialProjection,
		onChanged
	}: {
		runId: string;
		initialProjection: EquipmentWorkshopProjection;
		onChanged?: () => void | Promise<void>;
	} = $props();

	// svelte-ignore state_referenced_locally
	let projection = $state(initialProjection);
	// svelte-ignore state_referenced_locally
	let selectedMaterialId = $state(
		initialProjection.materials[0]?.materialId ??
			initialProjection.currentForging?.materialId ??
			null
	);
	// svelte-ignore state_referenced_locally
	let selectedDefinitionId = $state(
		initialProjection.currentForging?.definitionId ??
			initialProjection.definitions.find(
				(definition) =>
					definition.materialId ===
					(initialProjection.materials[0]?.materialId ??
						initialProjection.currentForging?.materialId)
			)?.definitionId ??
			null
	);
	let inspectionState = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let busyAction = $state<string | null>(null);
	let feedback = $state('');
	let errorMessage = $state('');
	let inspectionRequest: AbortController | null = null;

	const materialDefinitions = $derived(
		projection.definitions.filter((definition) => definition.materialId === selectedMaterialId)
	);
	const selectedDefinition = $derived(
		projection.definitions.find((definition) => definition.definitionId === selectedDefinitionId) ??
			null
	);
	const selectedInspection = $derived(
		projection.inspection?.definitionId === selectedDefinitionId ? projection.inspection : null
	);
	const workshopReady = $derived(
		projection.workshop.powered && projection.workshop.assigned && projection.workshop.atForge
	);

	$effect(() => {
		if (initialProjection.eventCursor <= projection.eventCursor) return;
		projection = {
			...initialProjection,
			inspection:
				projection.inspection?.definitionId === selectedDefinitionId
					? projection.inspection
					: initialProjection.inspection
		};
		if (!projection.currentForging && busyAction === null) {
			feedback = 'The forge ledger is current.';
		}
	});

	onDestroy(() => inspectionRequest?.abort());

	function chooseMaterial(materialId: typeof selectedMaterialId) {
		selectedMaterialId = materialId;
		const definitionId =
			projection.definitions.find((definition) => definition.materialId === materialId)
				?.definitionId ?? null;
		selectedDefinitionId = definitionId;
		feedback = '';
		errorMessage = '';
		if (definitionId) void inspectDefinition(definitionId);
	}

	function chooseDefinition(definitionId: string) {
		selectedDefinitionId = definitionId;
		feedback = '';
		errorMessage = '';
		void inspectDefinition(definitionId);
	}

	async function inspectDefinition(definitionId: string) {
		inspectionRequest?.abort();
		const request = new AbortController();
		inspectionRequest = request;
		inspectionState = 'loading';
		try {
			const query = new URLSearchParams({
				heroId: projection.heroId,
				inspect: definitionId
			});
			const response = await fetch(`/api/runs/${runId}/equipment?${query}`, {
				signal: request.signal
			});
			const result = (await response.json()) as EquipmentWorkshopProjection & { message?: string };
			if (!response.ok) throw new Error(result.message ?? 'The assay plate could not be read.');
			if (request.signal.aborted) return;
			projection = result;
			inspectionState = 'ready';
		} catch (error) {
			if (request.signal.aborted) return;
			inspectionState = 'error';
			errorMessage = error instanceof Error ? error.message : 'The assay plate could not be read.';
		}
	}

	async function submitAction(
		action:
			| { action: 'forge'; heroId: string; definitionId: string }
			| { action: 'equip'; heroId: string; itemId: string },
		busyKey: string
	) {
		if (busyAction) return;
		busyAction = busyKey;
		feedback = '';
		errorMessage = '';
		try {
			const response = await fetch(`/api/runs/${runId}/equipment`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'Idempotency-Key': crypto.randomUUID()
				},
				body: JSON.stringify(action)
			});
			const result = (await response.json()) as {
				projection?: EquipmentWorkshopProjection;
				message?: string;
			};
			if (!response.ok || !result.projection) {
				throw new Error(result.message ?? 'The workshop action did not resolve.');
			}
			projection = result.projection;
			feedback =
				action.action === 'forge'
					? 'Standard forging started. The reserved lot will become one item at completion.'
					: 'Equipment loadout updated.';
			await onChanged?.();
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'The workshop action did not resolve.';
		} finally {
			busyAction = null;
		}
	}

	function forgeSelected() {
		if (!selectedDefinition) return;
		return submitAction(
			{
				action: 'forge',
				heroId: projection.heroId,
				definitionId: selectedDefinition.definitionId
			},
			'forge'
		);
	}

	function equipItem(itemId: string) {
		return submitAction({ action: 'equip', heroId: projection.heroId, itemId }, `equip:${itemId}`);
	}

	function loadoutName(itemId: string | null) {
		if (!itemId) return 'Empty';
		return (
			projection.inventory.find((item) => item.itemId === itemId)?.displayName ?? 'Unknown item'
		);
	}

	function readable(value: string) {
		return value.replaceAll('-', ' ');
	}
</script>

<section class="workshop" data-testid="equipment-workshop" aria-labelledby="equipment-title">
	<header class="workshop-heading">
		<div>
			<p>Hearth 01 · workshop record</p>
			<h1 id="equipment-title">The forge ledger</h1>
			<span>One material lot. One known form. One persistent Standard item.</span>
		</div>
		<dl aria-label="Workshop readiness">
			<div>
				<dt>Power</dt>
				<dd>{projection.workshop.powered ? 'routed' : 'dormant'}</dd>
			</div>
			<div>
				<dt>Artisan</dt>
				<dd>{projection.workshop.assigned ? 'assigned' : 'unassigned'}</dd>
			</div>
			<div>
				<dt>Bench</dt>
				<dd>{projection.workshop.atForge ? 'present' : 'absent'}</dd>
			</div>
		</dl>
	</header>

	<div class="workshop-grid">
		<div class="selection-column">
			<section class="ledger-section" aria-labelledby="materials-title">
				<div class="section-heading">
					<span>01</span>
					<div>
						<h2 id="materials-title">Choose a material</h2>
						<p>Owned gathering lots only.</p>
					</div>
				</div>
				{#if projection.materials.length > 0}
					<div class="material-ledger">
						{#each projection.materials as material (material.materialId)}
							<button
								type="button"
								class:selected={selectedMaterialId === material.materialId}
								aria-pressed={selectedMaterialId === material.materialId}
								onclick={() => chooseMaterial(material.materialId)}
							>
								<strong>{material.displayName}</strong>
								<span>{readable(material.family)} · rank {material.rank}</span>
								<code>{material.lots} {material.lots === 1 ? 'lot' : 'lots'}</code>
							</button>
						{/each}
					</div>
				{:else}
					<p class="empty-state">Gather a forging material before opening a recipe.</p>
				{/if}
			</section>

			<section class="ledger-section" aria-labelledby="forms-title">
				<div class="section-heading">
					<span>02</span>
					<div>
						<h2 id="forms-title">Choose a form</h2>
						<p>Every row consumes one matching lot.</p>
					</div>
				</div>
				{#if materialDefinitions.length > 0}
					<div class="form-ledger" aria-label="Compatible equipment">
						{#each materialDefinitions as definition (definition.definitionId)}
							<button
								type="button"
								class:selected={selectedDefinitionId === definition.definitionId}
								aria-pressed={selectedDefinitionId === definition.definitionId}
								onclick={() => chooseDefinition(definition.definitionId)}
							>
								<img
									src={definition.card.publicPath}
									width={definition.card.width}
									height={definition.card.height}
									loading="lazy"
									decoding="async"
									alt=""
								/>
								<span
									><strong>{definition.displayName}</strong><small
										>{readable(definition.equipmentClass)} · {readable(definition.slot)}</small
									></span
								>
								<code>{definition.materialRank} → {definition.finalRank}</code>
							</button>
						{/each}
					</div>
				{:else}
					<p class="empty-state">Select an owned material to reveal its compatible forms.</p>
				{/if}
			</section>
		</div>

		<aside class="assay-column" aria-labelledby="assay-title">
			<div class="section-heading">
				<span>03</span>
				<div>
					<h2 id="assay-title">Material assay</h2>
					<p>Approved art and source-bound rank.</p>
				</div>
			</div>
			{#if selectedDefinition}
				<figure class="assay-plate" data-testid="equipment-assay">
					<div class="assay-image">
						<img
							src={selectedInspection?.detail.publicPath ?? selectedDefinition.card.publicPath}
							width={selectedInspection?.detail.width ?? selectedDefinition.card.width}
							height={selectedInspection?.detail.height ?? selectedDefinition.card.height}
							decoding="async"
							alt={`${selectedDefinition.displayName}, approved Equipment rendering`}
						/>
						<strong class="rank-stamp" aria-label={`Rank ${selectedDefinition.finalRank}`}
							>{selectedDefinition.finalRank}</strong
						>
						{#if inspectionState === 'loading'}<span class="loading-mark">Reading assay…</span>{/if}
					</div>
					<figcaption>
						<p>{selectedDefinition.materialName} / {readable(selectedDefinition.equipmentClass)}</p>
						<h2>{selectedDefinition.displayName}</h2>
						<dl>
							<div>
								<dt>Craftsmanship</dt>
								<dd>Standard</dd>
							</div>
							<div>
								<dt>Rank</dt>
								<dd>
									{selectedDefinition.materialRank} base · {selectedDefinition.finalRank} final
								</dd>
							</div>
							<div>
								<dt>Handling</dt>
								<dd>
									{readable(selectedDefinition.handedness)} · {readable(selectedDefinition.slot)}
								</dd>
							</div>
							<div>
								<dt>Cost</dt>
								<dd>1 {selectedDefinition.materialName} lot</dd>
							</div>
						</dl>
						{#if selectedInspection}
							<small
								>Approved source · {selectedInspection.provenance.sourceContentHash.slice(0, 12)} · runtime
								{selectedInspection.provenance.runtimeManifestHash.slice(0, 12)}</small
							>
						{:else if inspectionState === 'error'}
							<small>Detail unavailable. The 256px card remains authoritative for selection.</small>
						{/if}
					</figcaption>
				</figure>

				{#if projection.currentForging}
					<div class="forge-status" data-testid="forging-status">
						<span>Standard forging in progress</span>
						<strong>{projection.currentForging.displayName}</strong>
						<small
							>Completes at {projection.currentForging.completesAt.slice(11, 16)} settlement time.</small
						>
					</div>
				{:else}
					<button
						class="forge-action"
						type="button"
						onclick={forgeSelected}
						disabled={!workshopReady || !selectedDefinition.canForge || busyAction !== null}
						aria-describedby="forge-help"
					>
						<span>{busyAction === 'forge' ? 'Reserving lot…' : 'Forge Standard item'}</span>
						<code>{selectedDefinition.finalRank}-rank</code>
					</button>
					<p id="forge-help" class="action-help">
						{workshopReady
							? selectedDefinition.canForge
								? 'The lot is consumed once when forging begins.'
								: 'This material lot is no longer available.'
							: 'Power the workshop, assign this artisan, and stand at the forge bench.'}
					</p>
				{/if}
			{:else}
				<p class="empty-state assay-empty">Choose a material and form to open the assay plate.</p>
			{/if}
		</aside>
	</div>

	<div class="feedback-region" aria-live="polite" aria-atomic="true">
		{#if errorMessage}<p class="error-state" role="alert">{errorMessage}</p>{/if}
		{#if feedback}<p class="success-state" role="status">{feedback}</p>{/if}
	</div>

	<section class="inventory-section" aria-labelledby="inventory-title">
		<div class="section-heading">
			<span>04</span>
			<div>
				<h2 id="inventory-title">Equipment inventory</h2>
				<p>Item provenance follows the instance.</p>
			</div>
		</div>
		{#if projection.inventory.length > 0}
			<div class="inventory-ledger">
				{#each projection.inventory as item (item.itemId)}
					<article data-testid="equipment-inventory-item">
						<img
							src={item.card.publicPath}
							width={item.card.width}
							height={item.card.height}
							loading="lazy"
							decoding="async"
							alt=""
						/>
						<div>
							<span>{item.materialName} · {item.craftsmanship}</span>
							<h3>{item.displayName}</h3>
							<small>{item.origin}</small>
						</div>
						<code>{item.finalRank} / {readable(item.slot)}</code>
						{#if item.equipped}
							<strong class="equipped-mark">Equipped</strong>
						{:else}
							<button
								type="button"
								onclick={() => equipItem(item.itemId)}
								disabled={!item.canEquip || busyAction !== null}
							>
								{busyAction === `equip:${item.itemId}` ? 'Equipping…' : 'Equip'}
							</button>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<p class="empty-state">Completed items will enter this ledger.</p>
		{/if}
	</section>

	<section class="loadout-section" aria-labelledby="loadout-title">
		<div class="section-heading">
			<span>05</span>
			<div>
				<h2 id="loadout-title">Six-slot loadout</h2>
				<p>The authoritative equipment state.</p>
			</div>
		</div>
		<dl class="loadout-ledger" data-testid="equipment-loadout">
			{#each Object.entries(projection.loadout) as [slot, itemId] (slot)}
				<div>
					<dt>{readable(slot)}</dt>
					<dd>{loadoutName(itemId)}</dd>
				</div>
			{/each}
		</dl>
	</section>
</section>

<style>
	.workshop {
		--forge-ground: #090805;
		--forge-surface: #0c0b08;
		--forge-paper: #f3ead9;
		--forge-muted: #aaa08e;
		--forge-ember: #d4773d;
		--forge-focus: #e5aa73;
		--forge-line: rgba(231, 206, 164, 0.14);
		min-height: calc(100vh - 4.5rem);
		padding: clamp(1rem, 3vw, 3rem);
		background: var(--forge-ground);
		color: var(--forge-paper);
		font-family: Georgia, serif;
	}

	.workshop-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		max-width: 86rem;
		margin: 0 auto 2rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--forge-line);
	}

	p,
	h1,
	h2,
	h3,
	dl,
	figure {
		margin: 0;
	}

	.workshop-heading p,
	.section-heading > span,
	.section-heading p,
	.workshop-heading dt,
	.workshop-heading dd,
	code,
	small,
	.feedback-region,
	.action-help,
	.forge-status span,
	.forge-status small,
	.assay-plate figcaption > p,
	.assay-plate figcaption > small,
	.inventory-ledger article > div > span,
	.inventory-ledger article > div > small,
	.loadout-ledger dt {
		font-family: ui-monospace, monospace;
	}

	.workshop-heading p,
	.section-heading > span,
	.assay-plate figcaption > p {
		color: var(--forge-ember);
		font-size: 0.7rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	.workshop-heading h1 {
		margin: 0.25rem 0 0.4rem;
		font-size: clamp(2rem, 5vw, 4.6rem);
		font-weight: 400;
		line-height: 0.95;
	}

	.workshop-heading > div > span,
	.section-heading p {
		color: var(--forge-muted);
	}

	.workshop-heading dl {
		display: grid;
		grid-template-columns: repeat(3, auto);
		border: 1px solid var(--forge-line);
	}

	.workshop-heading dl div {
		min-width: 7rem;
		padding: 0.65rem 0.8rem;
		border-left: 1px solid var(--forge-line);
	}

	.workshop-heading dl div:first-child {
		border-left: 0;
	}

	.workshop-heading dt {
		color: var(--forge-muted);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.workshop-heading dd {
		margin: 0.25rem 0 0;
		color: var(--forge-focus);
		font-size: 0.72rem;
	}

	.workshop-grid {
		display: grid;
		grid-template-columns: minmax(0, 0.95fr) minmax(22rem, 1.05fr);
		gap: clamp(1.5rem, 4vw, 4rem);
		max-width: 86rem;
		margin: 0 auto;
	}

	.selection-column {
		display: grid;
		align-content: start;
		gap: 2rem;
	}

	.ledger-section,
	.assay-column,
	.inventory-section,
	.loadout-section {
		min-width: 0;
	}

	.section-heading {
		display: grid;
		grid-template-columns: 2.25rem 1fr;
		gap: 0.75rem;
		align-items: start;
		margin-bottom: 0.8rem;
	}

	.section-heading > span {
		padding-top: 0.3rem;
	}

	.section-heading h2 {
		font-size: 1.25rem;
		font-weight: 400;
	}

	.section-heading p {
		margin-top: 0.2rem;
		font-size: 0.68rem;
	}

	.material-ledger,
	.form-ledger,
	.inventory-ledger,
	.loadout-ledger {
		border-top: 1px solid var(--forge-line);
	}

	.material-ledger button,
	.form-ledger button {
		width: 100%;
		border: 0;
		border-bottom: 1px solid var(--forge-line);
		border-radius: 0;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.material-ledger button {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.2rem 1rem;
		padding: 0.75rem;
	}

	.material-ledger button span {
		grid-column: 1;
		color: var(--forge-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.68rem;
	}

	.material-ledger button code {
		grid-column: 2;
		grid-row: 1 / span 2;
		align-self: center;
		color: var(--forge-focus);
		font-size: 0.7rem;
	}

	.material-ledger button:hover,
	.form-ledger button:hover,
	.material-ledger button.selected,
	.form-ledger button.selected {
		background: rgba(212, 119, 61, 0.09);
	}

	.material-ledger button.selected,
	.form-ledger button.selected {
		box-shadow: inset 3px 0 0 var(--forge-ember);
	}

	.form-ledger button {
		display: grid;
		grid-template-columns: 4.5rem 1fr auto;
		align-items: center;
		gap: 0.9rem;
		min-height: 5.25rem;
		padding: 0.4rem 0.75rem 0.4rem 0.4rem;
	}

	.form-ledger img,
	.inventory-ledger img {
		width: 4.5rem;
		height: 4.5rem;
		object-fit: contain;
		background: var(--forge-surface);
	}

	.form-ledger button > span {
		display: grid;
		gap: 0.3rem;
	}

	.form-ledger small {
		color: var(--forge-muted);
		font-size: 0.66rem;
	}

	.form-ledger code {
		color: var(--forge-focus);
		font-size: 0.72rem;
	}

	.assay-column {
		position: sticky;
		top: 5.5rem;
		align-self: start;
	}

	.assay-plate {
		border: 1px solid var(--forge-line);
		background: var(--forge-surface);
	}

	.assay-image {
		position: relative;
		aspect-ratio: 1;
		border-bottom: 1px solid var(--forge-line);
		background: #090805;
	}

	.assay-image::before,
	.assay-image::after {
		position: absolute;
		z-index: 1;
		content: '';
		pointer-events: none;
	}

	.assay-image::before {
		inset: 1rem;
		border: 1px solid var(--forge-line);
	}

	.assay-image::after {
		top: 0;
		bottom: 0;
		left: 50%;
		border-left: 1px solid rgba(231, 206, 164, 0.08);
	}

	.assay-image img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.rank-stamp {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		z-index: 2;
		display: grid;
		width: 3.5rem;
		height: 3.5rem;
		place-items: center;
		border: 1px solid var(--forge-focus);
		background: #090805;
		color: var(--forge-focus);
		font-family: ui-monospace, monospace;
		font-size: 1.7rem;
	}

	.loading-mark {
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		z-index: 2;
		padding: 0.35rem 0.45rem;
		background: #090805;
		color: var(--forge-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.66rem;
	}

	.assay-plate figcaption {
		padding: 1.2rem;
	}

	.assay-plate figcaption h2 {
		margin-top: 0.35rem;
		font-size: clamp(1.5rem, 3vw, 2.5rem);
		font-weight: 400;
	}

	.assay-plate figcaption dl {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin: 1rem 0;
		border-top: 1px solid var(--forge-line);
	}

	.assay-plate figcaption dl div {
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--forge-line);
	}

	.assay-plate figcaption dt {
		color: var(--forge-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.assay-plate figcaption dd {
		margin: 0.2rem 0 0;
	}

	.assay-plate figcaption > small {
		display: block;
		overflow-wrap: anywhere;
		color: var(--forge-muted);
		font-size: 0.62rem;
	}

	.forge-action {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 3.25rem;
		margin-top: 0.75rem;
		padding: 0.7rem 1rem;
		border: 1px solid var(--forge-ember);
		border-radius: 0;
		background: var(--forge-ember);
		color: #090805;
		font-family: Georgia, serif;
		font-weight: 700;
		cursor: pointer;
	}

	.forge-action code {
		font-size: 0.68rem;
	}

	.forge-action:hover:not(:disabled) {
		background: var(--forge-focus);
	}

	.forge-action:disabled,
	.inventory-ledger button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.action-help {
		min-height: 1.1rem;
		margin-top: 0.4rem;
		color: var(--forge-muted);
		font-size: 0.65rem;
	}

	.forge-status {
		display: grid;
		gap: 0.3rem;
		margin-top: 0.75rem;
		padding: 0.8rem 1rem;
		border: 1px solid var(--forge-focus);
		background: rgba(229, 170, 115, 0.06);
	}

	.forge-status span,
	.forge-status small {
		color: var(--forge-focus);
		font-size: 0.65rem;
	}

	.feedback-region {
		min-height: 2rem;
		max-width: 86rem;
		margin: 1rem auto 0;
		font-size: 0.7rem;
	}

	.error-state,
	.success-state {
		padding: 0.55rem 0.75rem;
		border-left: 3px solid var(--forge-ember);
		background: var(--forge-surface);
	}

	.success-state {
		border-color: var(--forge-focus);
	}

	.inventory-section,
	.loadout-section {
		max-width: 86rem;
		margin: 2rem auto 0;
		padding-top: 1.5rem;
		border-top: 1px solid var(--forge-line);
	}

	.inventory-ledger article {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 1rem;
		min-height: 5.4rem;
		padding: 0.4rem;
		border-bottom: 1px solid var(--forge-line);
	}

	.inventory-ledger article > div {
		min-width: 0;
	}

	.inventory-ledger h3 {
		margin: 0.15rem 0;
		font-size: 1rem;
		font-weight: 400;
	}

	.inventory-ledger article > div > span,
	.inventory-ledger article > div > small {
		display: block;
		overflow: hidden;
		color: var(--forge-muted);
		font-size: 0.62rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.inventory-ledger article > code {
		color: var(--forge-focus);
		font-size: 0.67rem;
	}

	.inventory-ledger button,
	.equipped-mark {
		min-width: 5.5rem;
		min-height: 2.5rem;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--forge-line);
		border-radius: 0;
		background: transparent;
		color: var(--forge-paper);
		font-family: ui-monospace, monospace;
		font-size: 0.65rem;
		text-align: center;
	}

	.inventory-ledger button {
		cursor: pointer;
	}

	.inventory-ledger button:hover:not(:disabled) {
		border-color: var(--forge-focus);
		color: var(--forge-focus);
	}

	.equipped-mark {
		display: grid;
		place-items: center;
		border-color: var(--forge-ember);
		color: var(--forge-ember);
		font-weight: 400;
	}

	.loadout-ledger {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.loadout-ledger div {
		min-width: 0;
		padding: 0.75rem;
		border-right: 1px solid var(--forge-line);
		border-bottom: 1px solid var(--forge-line);
	}

	.loadout-ledger dt {
		color: var(--forge-ember);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.loadout-ledger dd {
		overflow: hidden;
		margin: 0.3rem 0 0;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-state {
		padding: 1rem;
		border-top: 1px solid var(--forge-line);
		border-bottom: 1px solid var(--forge-line);
		color: var(--forge-muted);
	}

	.assay-empty {
		min-height: 18rem;
	}

	button:focus-visible {
		outline: 2px solid var(--forge-focus);
		outline-offset: 2px;
	}

	@media (max-width: 760px) {
		.workshop {
			padding: 1rem;
		}

		.workshop-heading {
			display: grid;
			gap: 1rem;
		}

		.workshop-heading dl {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.workshop-heading dl div {
			min-width: 0;
			padding: 0.55rem;
		}

		.workshop-grid {
			display: block;
		}

		.selection-column {
			gap: 1.5rem;
		}

		.assay-column {
			position: static;
			margin-top: 1.5rem;
		}

		.assay-empty {
			min-height: 9rem;
		}

		.form-ledger button {
			grid-template-columns: 4rem minmax(0, 1fr) auto;
			gap: 0.65rem;
			min-height: 4.75rem;
		}

		.form-ledger img,
		.inventory-ledger img {
			width: 4rem;
			height: 4rem;
		}

		.assay-image {
			max-height: calc(100svh - 8rem);
		}

		.assay-plate figcaption dl {
			grid-template-columns: 1fr;
		}

		.inventory-ledger article {
			grid-template-columns: 4rem minmax(0, 1fr) auto;
			gap: 0.65rem;
		}

		.inventory-ledger article > code {
			grid-column: 2;
		}

		.inventory-ledger article > button,
		.inventory-ledger article > .equipped-mark {
			grid-column: 3;
			grid-row: 1 / span 2;
		}

		.loadout-ledger {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.workshop *,
		.workshop *::before,
		.workshop *::after {
			scroll-behavior: auto !important;
			transition: none !important;
		}
	}
</style>
