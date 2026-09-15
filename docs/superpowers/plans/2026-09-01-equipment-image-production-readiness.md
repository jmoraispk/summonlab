# Equipment Image Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and dry-validate the Equipment-local production layer that can safely run the 161 canonical material images with up to 16 available workers.

**Architecture:** Strict Equipment-only schemas, prompt packets, persistence, review receipts, and an append-only run controller live under `tools/equipment-*` and `assets/equipment/experiments/material-equipment-v1`. The reusable allocation remains planning evidence; a separately accepted visual profile authorizes deterministic root packets, and a receipt-last immutable run controls claims and resume. The root Codex orchestrator spawns workers; repository code only validates, claims, records, and reports.

**Tech Stack:** TypeScript 6, Node.js 24, Zod 4, Vitest 4, Sharp 0.35, JSON Schema draft 2020-12, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-09-01-equipment-image-production-readiness-design.md`

## Global Constraints

- Keep production files under `assets/equipment/experiments/material-equipment-v1` and implementation files under `tools/equipment-*`.
- Do not modify `packages/contracts/src/image-production.ts`, `tools/persist-image-production-output.ts`, `tools/affinity-*`, `assets/enemies`, the installed `summonlab-image-production` skill, runtime catalogs, or unrelated visual domains.
- Produce exactly 161 planned jobs: 77 roots, 84 review-gated Armor pieces, and 21 four-child gates.
- Admit `min(16 - activeEquipmentWorkers, availableWorkerSlots, readyUnclaimedJobs)`; reserve no worker slot and apply no voluntary throttling for unrelated tasks.
- Use 1024×1024 PNG for isolated items and pieces and 1024×1536 PNG for complete sets on a featureless charcoal display form.
- Treat every study as Standard craftsmanship (`+0`); material supplies the visible base rank.
- Never infer approval from generation success or file existence.
- Never overwrite a candidate, result, review receipt, run plan, activation receipt, or journal event.
- Write tests first, observe the expected failure, then add the minimum implementation.
- Commit each task independently with only its in-scope files, then push the branch.

---

### Task 1: Correct the allocation policy and define strict Equipment contracts

**Files:**
- Modify: `tools/equipment-material-production-lib.spec.ts`
- Modify: `tools/equipment-material-production-lib.ts`
- Create: `tools/equipment-image-production-contract.spec.ts`
- Create: `tools/equipment-image-production-contract.ts`
- Modify: `tools/tsconfig.equipment-material-production.json`
- Regenerate: `assets/equipment/experiments/material-equipment-v1/allocation-plan.json`

**Interfaces:**
- Consumes: `buildEquipmentMaterialProductionManifest()` and `buildEquipmentMaterialAllocationPlan()` from `tools/equipment-material-production-lib.ts`.
- Produces: `EquipmentVisualProfileSchema`, `EquipmentVisualProfileAcceptanceSchema`, `EquipmentImageTargetSchema`, `EquipmentImageAssignmentSchema`, `EquipmentImageResultSchema`, `EquipmentArmorSourceReviewReceiptSchema`, `EquipmentRunPlanSchema`, `EquipmentRunActivationSchema`, `EquipmentRunEventRequestSchema`, `EquipmentRunEventSchema`, `EquipmentRunReadinessReportSchema`, `EquipmentRunReportSchema`, and inferred public types.

- [ ] **Step 1: Write the failing allocation-policy test**

Replace the old scheduler-intent assertion with the accepted capacity policy:

```ts
expect(plan.schedulerIntent).toEqual({
	mode: 'dependency-aware-ready-queue',
	logicalProductionRunCount: 1,
	configuredMaximumConcurrency: 16,
	admissionFormula:
		'min(16 - activeEquipmentWorkers, availableWorkerSlots, readyUnclaimedJobs)',
	parallelWorkPolicy: 'no-voluntary-throttling-for-unrelated-work',
	technicalFailureCircuitBreaker: {
		failureCountPerEpoch: 3,
		action: 'stop-new-starts-drain-active-resume-with-backoff',
		synchronousRetry: false
	}
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm exec vitest run tools/equipment-material-production-lib.spec.ts
```

Expected: FAIL because the current allocation still contains `reservedOrchestratorSlots`, the probe ladder, and the old admission formula.

- [ ] **Step 3: Implement the minimal allocation-policy change**

Update only `schedulerIntent` in `buildEquipmentMaterialAllocationPlan()` and regenerate both checked artifacts:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-material-production.ts
```

- [ ] **Step 4: Write failing schema tests**

Add tests that parse one valid object per schema and reject:

```ts
expect(() => EquipmentImageTargetSchema.parse({ ...validTarget, extra: true })).toThrow();
expect(() => EquipmentImageTargetSchema.parse({
	...validTarget,
	output: { ...validTarget.output, candidatePath: 'assets/enemies/bad.png' }
})).toThrow();
expect(() => EquipmentVisualProfileSchema.parse({
	...validProfile,
	isolatedPresentation: { ...validProfile.isolatedPresentation, width: 1536 }
})).toThrow();
expect(() => EquipmentArmorSourceReviewReceiptSchema.parse({
	...validReceipt,
	decision: 'accepted',
	candidateSha256: 'not-a-hash'
})).toThrow();
```

The production change that makes these tests pass is the existence of strict schemas with Equipment-root path refinements, exact canvas literals, lowercase SHA-256 fields, and `.strict()` objects.

- [ ] **Step 5: Run the contract test and verify RED**

Run:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm exec vitest run tools/equipment-image-production-contract.spec.ts
```

Expected: FAIL because `tools/equipment-image-production-contract.ts` does not exist.

- [ ] **Step 6: Implement the strict schema module**

Define these shared primitives and exact discriminators:

```ts
export const EQUIPMENT_PRODUCTION_ROOT =
	'assets/equipment/experiments/material-equipment-v1' as const;

const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,119}$/u);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const RankSchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']);
const FamilySchema = z.enum(['metal', 'wood', 'hide-scale', 'cloth-fiber']);
const SlotSchema = z.enum(['head', 'torso', 'legs', 'boots']);
```

Use these schema versions:

```ts
'equipment-visual-profile-v1'
'equipment-visual-profile-acceptance-v1'
'equipment-image-target-v1'
'equipment-image-assignment-v1'
'equipment-image-result-v1'
'equipment-armor-source-review-receipt-v1'
'equipment-production-run-plan-v1'
'equipment-production-run-activation-v1'
'equipment-production-event-request-v1'
'equipment-production-event-v1'
'equipment-production-run-readiness-report-v1'
'equipment-production-run-report-v1'
```

Target output contains only `candidatePath` and `resultPath`. Assignment `permittedOutputs` must
match that shape. The result status is `candidate | revise | failed`. Event request kinds are:

```ts
z.enum([
	'run-started',
	'job-claimed',
	'claim-released',
	'worker-started',
	'job-terminal',
	'armor-source-reviewed',
	'epoch-paused',
	'epoch-resumed'
]);
```

Add the new production and spec files to the dedicated tsconfig include list.

- [ ] **Step 7: Run Task 1 validation and commit**

Run:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm exec vitest run \
    tools/equipment-material-production-lib.spec.ts \
    tools/equipment-image-production-contract.spec.ts
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm exec tsc -p tools/tsconfig.equipment-material-production.json --noEmit
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-material-production.ts --check
git diff --check
```

Expected: all commands exit 0.

Commit:

```bash
git add tools/equipment-material-production-lib.ts \
  tools/equipment-material-production-lib.spec.ts \
  tools/equipment-image-production-contract.ts \
  tools/equipment-image-production-contract.spec.ts \
  tools/tsconfig.equipment-material-production.json \
  assets/equipment/experiments/material-equipment-v1/allocation-plan.json
git commit -m "feat(equipment): define image production contracts"
```

---

### Task 2: Export the visual-profile candidate and JSON schemas

**Files:**
- Create: `tools/equipment-image-profile.spec.ts`
- Create: `tools/equipment-image-profile.ts`
- Create: `tools/export-equipment-image-profile.ts`
- Modify: `tools/tsconfig.equipment-material-production.json`
- Create: `assets/equipment/experiments/material-equipment-v1/visual-profile/profile.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/profile.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/profile-acceptance.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/target.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/assignment.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/result.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/armor-source-review-receipt.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/run-plan.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/run-activation.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/run-event-request.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/run-event.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/run-readiness-report.schema.json`
- Create: `assets/equipment/experiments/material-equipment-v1/schemas/run-report.schema.json`

**Interfaces:**
- Consumes: schemas and constants from Task 1.
- Produces: `buildEquipmentVisualProfile()`, `serializeEquipmentVisualProfile()`, `createEquipmentSchemaArtifacts()`, and a write/check exporter.

- [ ] **Step 1: Write the failing profile test**

Assert the exact approved visual decisions:

```ts
const profile = buildEquipmentVisualProfile();
expect(profile.status).toBe('approval-candidate');
expect(profile.craftsmanship).toEqual({ grade: 'Standard', rankAdjustment: 0 });
expect(profile.isolatedPresentation.canvas).toEqual({
	width: 1024,
	height: 1024,
	mediaType: 'image/png',
	safeMarginPercent: 8
});
expect(profile.fullSetPresentation.canvas).toEqual({
	width: 1024,
	height: 1536,
	mediaType: 'image/png',
	safeMarginPercent: 8
});
expect(profile.fullSetPresentation.subject).toBe('featureless-charcoal-display-form');
expect(profile.references).toEqual([{
	path: 'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png',
	contentHash: '9c726ad578a6a6d8ed510a7e7117443ce471e553d233b36a8c20afedddd1040d',
	purpose: expect.stringContaining('finish')
}]);
```

Also assert the profile forbids subject transfer, rarity rainbow, gold inflation, full-object glow,
oversized silhouettes, text, UI, frames, logos, and watermarks.

- [ ] **Step 2: Run the profile test and verify RED**

Run the single spec and expect module-not-found failure for `equipment-image-profile.ts`.

- [ ] **Step 3: Implement the deterministic profile and schema exporter**

Use `z.toJSONSchema(schema, { target: 'draft-2020-12' })` and stable schema IDs rooted at
`https://summonlab.local/schemas/equipment/`. The exporter accepts only zero arguments or one
`--check`, writes formatted JSON in write mode, and compares exact bytes in check mode.

The reference purpose must state:

```ts
'Use only for painterly finish, honest wear, material response, cold key with restrained warm rim, floor, and midnight-charcoal background. Do not transfer Remy, her body, clothing, hammer, or design.'
```

- [ ] **Step 4: Export, check, validate, and commit**

Run:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm exec vitest run tools/equipment-image-profile.spec.ts
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-image-profile.ts
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-image-profile.ts --check
sha256sum assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm exec tsc -p tools/tsconfig.equipment-material-production.json --noEmit
git diff --check
```

Expected reference hash:

```text
9c726ad578a6a6d8ed510a7e7117443ce471e553d233b36a8c20afedddd1040d
```

Commit all Task 2 files with:

```bash
git commit -m "feat(equipment): add material visual profile"
```

- [ ] **Step 5: Stop for exact profile review**

Report the profile path and canonical SHA-256 to the user. Do not create
`visual-profile/acceptance.json`, targets, assignments, or a run until the user explicitly accepts
that exact profile hash.

---

### Task 3: Record profile acceptance and build deterministic root packets

**Files:**
- Create: `tools/equipment-image-packets.spec.ts`
- Create: `tools/equipment-image-packets.ts`
- Create: `tools/equipment-image-production.ts`
- Modify: `tools/tsconfig.equipment-material-production.json`
- Create after explicit approval: `assets/equipment/experiments/material-equipment-v1/visual-profile/acceptance.json`
- Generate after explicit approval: 77 exact manifest-derived JSON files beneath `assets/equipment/experiments/material-equipment-v1/targets/`
- Generate after explicit approval: 77 matching JSON files beneath `assets/equipment/experiments/material-equipment-v1/assignments/`

**Interfaces:**
- Consumes: manifest, allocation, strict schemas, exact profile bytes, and an owner-approved profile hash.
- Produces: `canonicalJsonSha256(value)`, `buildEquipmentProfileAcceptance(input)`, `buildRootEquipmentPackets(input)`, `validateEquipmentPacket(input)`, `renderEquipmentPrompt(target)`, `materializeRootEquipmentPackets(options)`, and the `accept-profile`, `validate-packet`, `render-prompt`, `export-root-packets`, and `check-root-packets` CLI commands.

- [ ] **Step 1: Write failing acceptance and packet tests**

Use a fixed clock and owner identity:

```ts
const acceptance = buildEquipmentProfileAcceptance({
	profile,
	profilePath: `${ROOT}/visual-profile/profile.json`,
	reviewer: 'owner',
	acceptedAt: '2026-09-01T23:00:00.000Z',
	acknowledgedProfileSha256: canonicalJsonSha256(profile)
});
expect(acceptance.decision).toBe('accepted');
expect(() => buildEquipmentProfileAcceptance({
	profile,
	profilePath,
	reviewer: 'owner',
	acceptedAt,
	acknowledgedProfileSha256: '0'.repeat(64)
})).toThrow('acknowledged profile hash');
```

Then assert:

```ts
const packets = buildRootEquipmentPackets({ manifest, allocation, profile, acceptance });
expect(packets).toHaveLength(77);
expect(packets.every(({ target }) => target.consistencySource === null)).toBe(true);
expect(new Set(packets.flatMap(({ target }) => [
	target.output.candidatePath,
	target.output.resultPath
])).size).toBe(154);
expect(() => buildRootEquipmentPackets({
	manifest,
	allocation,
	profile,
	acceptance: { ...acceptance, profileCanonicalSha256: '0'.repeat(64) }
})).toThrow();
```

- [ ] **Step 2: Run packet tests and verify RED**

Run the single spec. Expected: FAIL because packet and acceptance builders do not exist.

- [ ] **Step 3: Implement acceptance, targets, assignments, and exact prompts**

For each root target, bind:

```ts
{
	manifestCanonicalSha256,
	allocationCanonicalSha256,
	profileCanonicalSha256,
	profileAcceptanceCanonicalSha256,
	material: { id, name, family, rank, craftsmanship: 'Standard' },
	equipment: { class: equipmentClass, artifactRole, slot },
	references: profile.references,
	output: { candidatePath, resultPath: provenanceResultPath }
}
```

Assignments use `retryCeiling: 0`, match the exact two outputs, and forbid:

```ts
[
	`${ROOT}/manifest.json`,
	`${ROOT}/allocation-plan.json`,
	`${ROOT}/visual-profile`,
	`${ROOT}/reviews`,
	`${ROOT}/runs`,
	'assets/enemies',
	'packages/contracts/src/image-production.ts',
	'tools/persist-image-production-output.ts',
	'skills/summonlab-image-production'
]
```

The prompt renderer emits no terminal newline and uses three explicit branches: isolated item,
complete set, and dependent piece. Snapshot the first two branches now; Task 8 adds the third packet
fixture after an accepted source exists.

`validateEquipmentPacket()` parses both strict schemas, proves matching IDs and outputs, verifies
every ordered reference byte hash, checks the profile and acceptance hashes, rejects pre-existing
candidate/result outputs, and returns the exact two owned paths plus the rendered prompt hash.

- [ ] **Step 4: Test exclusive packet materialization**

Using `mkdtemp`, assert the first write creates 77 targets and 77 assignments, a second write fails
on collision, and `check-root-packets` performs zero writes. Use `open(path, 'wx')`; do not use
ordinary overwrite semantics.

- [ ] **Step 5: After explicit user approval, create live acceptance and packets**

Copy the exact 64-character digest from the user's approval into the task-specific shell variable
`EQUIPMENT_APPROVED_PROFILE_SHA256`; never derive that variable inside the acceptance command. Then
run:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts accept-profile \
  --reviewer owner \
  --acknowledge-profile-sha256 "$EQUIPMENT_APPROVED_PROFILE_SHA256"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts export-root-packets
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts check-root-packets
```

The command must reject an unset, malformed, or mismatched variable.

- [ ] **Step 6: Validate and commit**

Run the focused specs, dedicated TypeScript check, ESLint on the new TypeScript files, packet check,
and `git diff --check`. Commit:

```bash
git commit -m "feat(equipment): materialize root image packets"
```

---

### Task 4: Add Equipment-root exclusive image persistence

**Files:**
- Create: `tools/persist-equipment-image-production-output.spec.ts`
- Create: `tools/persist-equipment-image-production-output.ts`
- Modify: `tools/tsconfig.equipment-material-production.json`

**Interfaces:**
- Consumes: one assignment-owned candidate path plus exact source path, width, height, and media type.
- Produces: `persistEquipmentImageProductionOutput(options): Promise<EquipmentPersistenceReceipt>` and a CLI requiring `--workspace-root`, `--source`, `--destination`, `--width`, `--height`, and `--media-type`.

- [ ] **Step 1: Write failing filesystem safety tests**

Cover these exact behaviors with temporary directories and Sharp-generated fixtures:

```ts
await expect(persist({ destinationPath: 'assets/enemies/bad.png' }))
	.rejects.toThrow('Equipment production root');
await expect(persist({ destinationPath: `${ROOT}/candidates/f/copper/sword-v1.png` }))
	.resolves.toMatchObject({ operation: 'exclusive-copy' });
await expect(persist({ destinationPath: `${ROOT}/candidates/f/copper/sword-v1.png` }))
	.rejects.toThrow();
```

Also reject absolute paths, parent traversal, backslashes, symlink ancestors, unsupported formats,
aspect-ratio error above 0.5%, source equal to destination, and incomplete metadata. Accept exact PNG,
format normalization to PNG, and supported near-match resize.

- [ ] **Step 2: Run persistence tests and verify RED**

Expected: module-not-found failure.

- [ ] **Step 3: Implement the Equipment-root helper**

Follow the proven safety order:

```ts
const sourceBytes = await readFile(sourcePath);
const normalized = await normalizeAndVerify(sourceBytes, declaredCanvas);
await ensureSafeDestinationParents(workspaceRoot, destinationPath);
await ensureSafeDestinationParents(workspaceRoot, destinationPath);
const handle = await open(destinationAbsolutePath, 'wx');
await handle.writeFile(normalized.bytes);
await handle.sync();
await handle.close();
```

On any write error, close the handle and unlink only the destination this invocation exclusively
created. Return source and retained byte counts, dimensions, media types, SHA-256 values, operation,
and elapsed milliseconds.

- [ ] **Step 4: Validate and commit**

Run the persistence spec, dedicated TypeScript check, ESLint, and `git diff --check`. Commit:

```bash
git commit -m "feat(equipment): add exclusive image persistence"
```

---

### Task 5: Verify worker results and document the worker protocol

**Files:**
- Create: `tools/equipment-image-result.spec.ts`
- Create: `tools/equipment-image-result.ts`
- Modify: `tools/equipment-image-production.ts`
- Modify: `tools/tsconfig.equipment-material-production.json`
- Create: `assets/equipment/experiments/material-equipment-v1/worker-protocol.md`

**Interfaces:**
- Consumes: exact target, assignment, result, profile/reference files, candidate bytes, and workspace root.
- Produces: `verifyEquipmentImageResult(input): Promise<VerifiedEquipmentImageResult>`, `persistEquipmentImageResult(input): Promise<VerifiedEquipmentImageResult>`, CLI command `persist-result` reading one JSON value from stdin, and CLI command `verify-result`; the copper Sword verification invocation uses `--target assets/equipment/experiments/material-equipment-v1/targets/f/copper/sword-v1.json --assignment assets/equipment/experiments/material-equipment-v1/assignments/f/copper/sword-v1.json --result assets/equipment/experiments/material-equipment-v1/results/f/copper/sword-v1.json`.

- [ ] **Step 1: Write failing result-verification tests**

Build a valid candidate fixture, then independently mutate each bound value:

```ts
await expect(verify({ result: validResult })).resolves.toMatchObject({
	status: 'candidate',
	candidateSha256: expectedHash
});
await expect(verify({
	result: { ...validResult, promptSha256: '0'.repeat(64) }
})).rejects.toThrow('prompt');
await expect(verify({
	result: { ...validResult, writtenOutputPaths: ['assets/enemies/bad.png'] }
})).rejects.toThrow('ownership');
```

Also reject mismatched IDs, wrong assignment outputs, unordered/missing reference provenance, more
than one attempt, wrong candidate dimensions or hash, missing required findings, candidate status
with any required objective criterion not passing, invalid timestamps, and `selfPromoted: true`.

- [ ] **Step 2: Run result tests and verify RED**

Expected: module-not-found failure.

- [ ] **Step 3: Implement result verification**

Re-render the canonical prompt and SHA-256 inside verification. Read reference and candidate bytes
through symlink-refusing helpers, inspect the PNG with Sharp, compare persistence receipt to the
stored candidate, and ensure `writtenOutputPaths` is exactly the assignment-owned paths actually
written by the result status.

`persistEquipmentImageResult()` accepts a parsed JSON value from stdin, performs the same complete
verification against the already persisted candidate before writing, exclusive-creates the
assignment-owned result with `open(path, 'wx')`, re-reads it, and verifies the persisted bytes. A
`failed` result with no candidate uses its declared failure findings and owns only the result path.
The command refuses empty stdin, multiple JSON values, an existing result, or a result whose target
and assignment do not match the supplied packet paths.

- [ ] **Step 4: Write the exact worker protocol**

The document commands one worker to:

```text
validate target + assignment
inspect ordered references for declared purposes only
submit byte-exact rendered prompt once
inspect against every criterion
persist only the exact returned source
pipe one structured result JSON value to the Equipment persist-result command
verify result
return status and owned paths
```

It must state that the general image-generation capability is used, the enemy production skill is
not used, retry ceiling is zero, candidates are not approved, and all non-owned files are forbidden.

- [ ] **Step 5: Validate and commit**

Run the result and packet specs, TypeScript, ESLint, Prettier on the protocol, and `git diff --check`.
Commit:

```bash
git commit -m "feat(equipment): verify image worker results"
```

---

### Task 6: Materialize immutable run activation and zero-write readiness

**Files:**
- Create: `tools/equipment-image-run-readiness.spec.ts`
- Create: `tools/equipment-image-run-readiness.ts`
- Modify: `tools/equipment-image-production.ts`
- Modify: `tools/tsconfig.equipment-material-production.json`
- Create at activation: `assets/equipment/experiments/material-equipment-v1/runs/material-equipment-v1-run-001/plan.json`
- Create at activation: `assets/equipment/experiments/material-equipment-v1/runs/material-equipment-v1-run-001/activation.json`

**Interfaces:**
- Consumes: all accepted static artifacts and the 77 root target/assignment packet pairs.
- Produces: `buildEquipmentRunPlan(input)`, `reportEquipmentRunReadiness(input)`, `activateEquipmentRun(input)`, plus `report-readiness` and `activate-run` CLI commands.

- [ ] **Step 1: Write failing readiness tests**

Assert the ready report binds exact counts and performs zero writes:

```ts
const report = await reportEquipmentRunReadiness(fixture);
expect(report).toMatchObject({
	status: 'ready',
	writesPerformed: 0,
	summary: {
		totalJobs: 161,
		materializedRootJobs: 77,
		gatedPieceJobs: 84,
		armorReviewGates: 21,
		maximumConcurrency: 16
	}
});
```

Reject stale manifest/allocation/profile/acceptance/packet hashes, duplicate paths, unexpected
candidate/result output, partial output, a symlinked artifact, missing packet, wrong 77/84 counts,
or a pre-existing run plan without a matching valid activation.

- [ ] **Step 2: Run readiness tests and verify RED**

Expected: module-not-found failure.

- [ ] **Step 3: Implement immutable plan and readiness report**

The plan binds the 161 target IDs, 77 packet hashes, 21 gates, maximum concurrency 16, contract and
tool versions, every reserved output path, and all accepted static hashes. It declares the 84 piece
packets unmaterialized and review-gated.

Readiness is a returned report and optional stdout output, not a mutable status file.

- [ ] **Step 4: Implement receipt-last activation**

Under an exclusive short-lived run lock:

```ts
await exclusiveCreate(planPath, serialize(runPlan));
await verifyPersistedRunPlan(planPath, expectedHash);
await exclusiveCreate(activationPath, serialize({
	schemaVersion: 'equipment-production-run-activation-v1',
	runId,
	runPlanCanonicalSha256: expectedHash,
	activatedAt,
	activatedBy
}));
```

If activation fails before the receipt exists, readiness reports an incomplete activation and does
not authorize claims. It never overwrites or cleans up ambiguous files automatically.

- [ ] **Step 5: Validate and commit**

Run readiness specs, packet checks, TypeScript, ESLint, and `git diff --check`. Do not activate the
live run until all later controller tasks exist. Commit:

```bash
git commit -m "feat(equipment): add immutable run activation"
```

---

### Task 7: Add append-only journal replay and capacity-filling claims

**Files:**
- Create: `tools/equipment-image-run-journal.spec.ts`
- Create: `tools/equipment-image-run-journal.ts`
- Create: `tools/equipment-image-run-recorder.spec.ts`
- Create: `tools/equipment-image-run-recorder.ts`
- Modify: `tools/equipment-image-production.ts`
- Modify: `tools/tsconfig.equipment-material-production.json`

**Interfaces:**
- Consumes: verified run plan/activation, sequenced event inputs, and `availableWorkerSlots` supplied by the root orchestrator.
- Produces: `replayEquipmentRunJournal(context, events)`, `recordEquipmentRunEvent(options)`, `claimNextEquipmentJobs(options)`, and CLI commands `claim-next`, `record-start`, `record-terminal`, `release-claim`, `pause-epoch`, and `resume-epoch`.

- [ ] **Step 1: Write failing replay tests**

Test legal and illegal lifecycle sequences:

```ts
expect(replay(context, [runStarted, claimed, workerStarted, terminal]).terminal.size).toBe(1);
expect(() => replay(context, [runStarted, workerStarted])).toThrow('claim');
expect(() => replay(context, [runStarted, claimed, claimReleased, workerStarted])).toThrow();
expect(replay(context, [runStarted, claimed, claimReleased]).reclaimableTargetIds)
	.toContain(targetId);
```

Also reject duplicate event IDs, non-contiguous sequence numbers, changing worker identity, two
active jobs for one worker, terminal events without starts, events after terminal, claims while an
epoch is paused, and a fourth technical failure without an `epoch-paused` event after the third.

- [ ] **Step 2: Run replay tests and verify RED**

Expected: module-not-found failure.

- [ ] **Step 3: Implement pure replay and the three-failure circuit breaker**

Derived state includes ready, claimed, active, terminal, reclaimable, accepted-gate, paused-epoch,
technical-failure-count, and peak-active-worker collections. A `claim-released` before
`worker-started` removes the active claim and permits later reclaim. A started worker never expires.

- [ ] **Step 4: Write failing recorder and admission tests**

Assert exact capacity behavior:

```ts
expect(await claimNext({ availableWorkerSlots: 20, activeEquipmentWorkers: 0 })).toHaveLength(16);
expect(await claimNext({ availableWorkerSlots: 20, activeEquipmentWorkers: 12 })).toHaveLength(4);
expect(await claimNext({ availableWorkerSlots: 3, activeEquipmentWorkers: 0 })).toHaveLength(3);
expect(await claimNext({ availableWorkerSlots: 0, activeEquipmentWorkers: 0 })).toHaveLength(0);
```

Populate fixture metadata describing unrelated active tasks and prove it does not change these
results; only the supplied available slots, current Equipment actives, and ready count are inputs.

Run two concurrent recorder calls and assert unique contiguous events. Test stale-lock recovery,
live-lock refusal, symlink refusal, exclusive event creation, and replay after every append.

- [ ] **Step 5: Implement locking, recording, and claims**

Use one per-run lock with owner ID, process ID, and acquisition time. Re-read and verify plan,
activation, and every event while holding the lock. Determine claim count with:

```ts
Math.max(0, Math.min(
	16 - state.activeWorkerIds.size,
	availableWorkerSlots,
	state.readyUnclaimedTargetIds.length
));
```

Write one `job-claimed` event per admitted target in stable production priority and return the exact
target and assignment paths with their canonical hashes.

- [ ] **Step 6: Validate and commit**

Run both journal specs, readiness specs, TypeScript, ESLint, and `git diff --check`. Commit:

```bash
git commit -m "feat(equipment): add resumable job claiming"
```

---

### Task 8: Verify Armor receipts and materialize the 84 dependent packets

**Files:**
- Create: `tools/equipment-armor-review.spec.ts`
- Create: `tools/equipment-armor-review.ts`
- Modify: `tools/equipment-image-packets.ts`
- Modify: `tools/equipment-image-packets.spec.ts`
- Modify: `tools/equipment-image-production.ts`
- Modify: `tools/tsconfig.equipment-material-production.json`
- Create after each human decision: one of the 21 manifest-reserved full-set review JSON paths beneath `assets/equipment/experiments/material-equipment-v1/reviews/`
- Create after each accepted decision: four target and assignment JSON files beneath the existing material packet directories

**Interfaces:**
- Consumes: verified candidate/result, current run hashes, gate definition, reviewer, decision, and timestamp.
- Produces: `buildArmorSourceReviewReceipt(input)`, `verifyArmorSourceReviewReceipt(input)`, `materializeDependentArmorPackets(input)`, and CLI command `review-armor-source`.

- [ ] **Step 1: Write failing receipt tests**

Assert that only an exact accepted receipt unlocks children:

```ts
expect(await verifyReceipt(validAcceptedReceipt)).toMatchObject({
	decision: 'accepted',
	unlocksTargetIds: expectedFourIds
});
await expect(verifyReceipt({ ...validAcceptedReceipt, candidateSha256: '0'.repeat(64) }))
	.rejects.toThrow('candidate');
await expect(verifyReceipt({ ...validAcceptedReceipt, decision: 'rejected' }))
	.resolves.toMatchObject({ unlocksTargetIds: [] });
```

Also prove that an empty file, path existence without valid JSON, wrong plan/profile/result hash,
wrong source target, non-candidate source result, reviewer omission, stale timestamp, or gate with
other than four declared children cannot unlock anything.

- [ ] **Step 2: Run review tests and verify RED**

Expected: module-not-found failure.

- [ ] **Step 3: Implement receipt creation and verification**

Bind these exact values:

```ts
{
	runId,
	runPlanCanonicalSha256,
	manifestCanonicalSha256,
	allocationCanonicalSha256,
	profileCanonicalSha256,
	gateId,
	sourceTargetId,
	sourceResultCanonicalSha256,
	candidateSha256,
	decision,
	reviewer,
	reviewedAt
}
```

Receipt creation uses exclusive write. The CLI requires the reviewer and an explicit
`--accept-candidate-sha256` or `--reject-candidate-sha256` matching the stored source bytes.

- [ ] **Step 4: Write failing child-packet tests**

For one accepted copper Heavy Armor source, assert exactly four packets in Head, Torso, Legs,
Boots order. The first reference must be:

```ts
{
	path: sourceTarget.output.candidatePath,
	contentHash: receipt.candidateSha256,
	purpose: 'Authoritative accepted full-set continuity source; preserve material, silhouette language, palette, trim, fastenings, wear, ornament, and exact slot boundary.'
}
```

The shared profile style reference follows it. Assert the dependent prompt names exactly one slot,
forbids redesign, and uses a 1024×1024 canvas.

- [ ] **Step 5: Implement receipt-driven exclusive child materialization**

Hold the run lock, verify the receipt and current run state, exclusive-create four targets and four
assignments, verify all eight persisted hashes, then append `armor-source-reviewed`. A crash before
the event is reconciled only when all eight exact files verify; partial materialization blocks.

- [ ] **Step 6: Validate and commit**

Run review, packet, journal, and readiness specs, plus TypeScript, ESLint, and `git diff --check`.
Commit:

```bash
git commit -m "feat(equipment): gate armor piece production"
```

---

### Task 9: Reconciliation, dry activation, documentation, and final validation

**Files:**
- Create: `tools/equipment-image-run-reconcile.spec.ts`
- Create: `tools/equipment-image-run-reconcile.ts`
- Create: `tools/equipment-image-production.integration.spec.ts`
- Modify: `tools/equipment-image-production.ts`
- Modify: `tools/tsconfig.equipment-material-production.json`
- Modify: `assets/equipment/experiments/material-equipment-v1/README.md`
- Modify: `docs/wiki/mechanics/equipment/README.md`

**Interfaces:**
- Consumes: all prior contracts, packets, persistence, verification, activation, journal, and review components.
- Produces: `reconcileEquipmentRun(input)`, `simulateEquipmentRun(input)`, CLI commands `reconcile`, `report`, and `simulate`, and the exact operator workflow.

- [ ] **Step 1: Write failing reconciliation tests**

Cover:

```ts
expect(await reconcile(completedCandidateAndResult)).toMatchObject({
	action: 'append-terminal-event',
	writesRequired: 1
});
expect(await reconcile(candidateWithoutResult)).toMatchObject({
	action: 'blocked-partial-output',
	writesRequired: 0
});
expect(await reconcile(resultWithoutCandidate)).toMatchObject({
	action: 'blocked-partial-output',
	writesRequired: 0
});
```

An active started worker is never reaped by elapsed time. Operator-confirmed failure requires an
exact target, worker, reason, and acknowledgment flag and appends evidence rather than deleting
anything.

- [ ] **Step 2: Write the failing end-to-end simulation test**

The zero-image simulation must prove:

```ts
expect(report.summary).toEqual({
	totalJobs: 161,
	initiallyReadyJobs: 77,
	gatedPieceJobs: 84,
	armorReviewGates: 21,
	maximumConcurrency: 16,
	generatedImages: 0
});
expect(report.firstAdmission.targetIds).toHaveLength(16);
expect(report.allAcceptedGateSimulation.unlockedPieceJobs).toBe(84);
expect(report.sharedFilesChanged).toEqual([]);
```

Simulate three technical failures and assert new claims pause until a later epoch resumes. Simulate
unrelated active work metadata and assert it does not alter admission when `availableWorkerSlots`
is unchanged.

- [ ] **Step 3: Implement reconciliation, report, and simulation**

`simulate` uses in-memory events and fixtures only. It never creates candidates, results, receipts,
live run plans, activations, or events. `report` is zero-write. `reconcile` writes only an explicitly
authorized event after verifying existing immutable evidence.

- [ ] **Step 4: Document the exact operator workflow**

Update the asset README and Equipment wiki with these phases:

```text
profile candidate → exact owner acceptance → 77 root packets
zero-write readiness → immutable activation → claim up to 16
worker generation → result verification → terminal journal event
human full-set receipt → four child packets → continued claims
candidate review remains separate from approval and runtime promotion
```

Include exact commands for profile export/check, packet check, readiness report, dry simulation,
activation, claim-next with available slots, start/terminal recording, full-set review, reconcile,
and run report.

- [ ] **Step 5: Run final focused validation**

Run:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm exec vitest run \
    tools/equipment-material-production-lib.spec.ts \
    tools/equipment-image-production-contract.spec.ts \
    tools/equipment-image-profile.spec.ts \
    tools/equipment-image-packets.spec.ts \
    tools/persist-equipment-image-production-output.spec.ts \
    tools/equipment-image-result.spec.ts \
    tools/equipment-image-run-readiness.spec.ts \
    tools/equipment-image-run-journal.spec.ts \
    tools/equipment-image-run-recorder.spec.ts \
    tools/equipment-armor-review.spec.ts \
    tools/equipment-image-run-reconcile.spec.ts \
    tools/equipment-image-production.integration.spec.ts
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm exec tsc -p tools/tsconfig.equipment-material-production.json --noEmit
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm exec eslint tools/equipment-*.ts tools/persist-equipment-image-production-output.ts
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-material-production.ts --check
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-image-profile.ts --check
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts check-root-packets
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts report-readiness
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts simulate --available-worker-slots 16
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm validate:wiki
git diff --check
```

Expected: all focused commands exit 0, the simulation reports zero generated images, and readiness
reports exactly 77 root packets plus 84 gated pieces.

- [ ] **Step 6: Run the repository-wide suite and classify unrelated failures**

Run:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH corepack pnpm test
```

If the existing two `tools/breadth-generation-readiness.spec.ts` assertions still fail because the
Affinity skill-tree realpath check reports `blocked`, record them verbatim as unrelated. Do not edit
Affinity files in this Equipment task. Any new Equipment failure must be fixed before completion.

- [ ] **Step 7: Commit and push the readiness layer**

Commit only Task 9 files and any deterministic live readiness artifacts explicitly authorized by
earlier profile approval:

```bash
git commit -m "feat(equipment): validate production readiness"
git push origin codex/equipment-material-cleanup
```

Report the branch, every task commit, focused validation, repository-wide status, exact readiness
state, and whether the live run remains blocked on profile acceptance or is ready for activation.
