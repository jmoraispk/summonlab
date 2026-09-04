# Equipment Promotion and Runtime Integration Implementation Plan

> **For agentic workers:** Execute this plan continuously through the Definition of Done. Prefer
> subagent-driven execution for independent test, audit, and UI work, but keep generated outputs
> collision-safe and preserve each task's ownership boundary. Capture intermediate evidence without
> waiting for human review; present the complete implementation for one final review.

**Goal:** Promote the 161 accepted Equipment candidates, export 140 equippable runtime visuals,
define the 140 material/form combinations once, and prove Standard Forging plus an uncommon-drop
seam without multiplying item catalogs or image variants.

**Architecture:** Exact selected PNG bytes move from immutable v3 candidate evidence into a new
approved-source manifest. An Equipment-only exporter derives lazy 256px and 512px WebP assets. A
strict content catalog generates all legal material/form definitions. A new engine-v24 state adds
definition-backed item instances, six loadout slots, and material lots while preserving every older
schema and replay. Forging and drops call one item factory; only provenance differs.

**Tech stack:** TypeScript 6, Node.js 24, Zod 4, Vitest 4, Sharp 0.35, SvelteKit 2, pnpm 10.

**Spec:**
`docs/superpowers/specs/2026-09-03-equipment-promotion-runtime-integration-design.md`

## Global constraints

- Promote exactly 161 source images: 140 item sources and 21 reference-only full Armour sets.
- Export exactly 280 runtime files: `card` and `detail` for each of the 140 items.
- Generate exactly 140 content definitions from canonical material/form rules.
- Copy approved PNGs byte-for-byte; never regenerate or normalize them during promotion.
- Never modify v1/v2/v3 candidates, results, selections, checkpoints, or closeout evidence.
- Runtime export may read only approved sources, never `assets/equipment/experiments` directly.
- Do not add Equipment files to the character visual catalog or initial phone image payload.
- Material and form select artwork. Craftsmanship never selects another material's artwork.
- Enable Standard (`+0`) forging only. Fine/Masterwork thresholds, benefits, and quality-specific
  visual treatment remain deferred.
- Armour sets remain reference evidence. Only Head, Torso, Legs, and Boots become definitions.
- Keep the existing top-level `/forge` Character Forge unchanged; gameplay Forging belongs inside
  the play/workshop surface.
- Preserve all engine schemas and replays through v23. Add v24 rather than mutating old schemas.
- Implement one deterministic drop fixture, not a global chance or broad loot table.
- Write tests first and observe the intended RED state before implementation.
- Commit and push each task independently. Do not mix unrelated files into a batch.

## Continuous execution policy

- Execute Tasks 1–9 in order without pausing for intermediate approval, visual review, playtesting,
  or commit review.
- Treat Milestones A–C as evidence captures, not human gates. Record their outputs in the final
  integration report and continue immediately to the next task.
- When a test, validator, typecheck, export, or visual inspection fails, diagnose and correct the
  failure within the task, rerun the relevant validation, and continue.
- Keep the per-task commits and pushes so the run remains recoverable and auditable; they do not
  create handoff points.
- Stop early only when safe progress is impossible without new authority or external coordination,
  including an unresolved destructive collision, incompatible concurrent changes to a shared
  contract, unavailable required credentials or infrastructure, or a requirement that would expand
  scope beyond this approved plan. Ordinary implementation defects and review findings are not
  blockers.
- Request owner review only after Task 9 passes the complete Definition of Done. Serve the final
  galleries and report together with the runnable implementation at that time.

---

### Task 1: Define approved-source promotion contracts and a zero-write planner

**Files:**

- Create: `tools/equipment-approved-source-contract.ts`
- Create: `tools/equipment-approved-source-contract.spec.ts`
- Create: `tools/equipment-approved-source-promotion.ts`
- Create: `tools/equipment-approved-source-promotion.spec.ts`
- Create: `tools/promote-equipment-approved-sources.ts`
- Create: `tools/tsconfig.equipment-promotion.json`

**Inputs:**

- `assets/equipment/experiments/material-equipment-v3/manifest.json`
- `assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-2-roots.json`
- `assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-3-armour-pieces.json`
- `assets/equipment/experiments/material-equipment-v3/reviews/proposed-promotions/candidate-promotion-v1.json`

**Produces:** Strict schemas, inferred types, a deterministic 161-entry promotion plan, and CLI
`--plan`, `--write`, and `--check` modes. `--plan` and tests write nothing to the real repository.

- [ ] **Step 1: Write contract tests and verify RED**

Cover strict rejection of unknown fields, unsafe paths, invalid hashes, duplicate asset keys,
candidate/approved hash mismatch, wrong dimensions, and role-count drift. Require schema versions:

```text
equipment-approved-source-manifest-v1
equipment-approved-source-record-v1
equipment-approved-promotion-receipt-v1
equipment-approved-promotion-plan-v1
```

Run:

```bash
corepack pnpm vitest run tools/equipment-approved-source-contract.spec.ts
```

Expected RED: the contract module does not exist.

- [ ] **Step 2: Implement strict contracts**

The approved record discriminates `item` and `armour-set-reference`. Require stable asset key,
target ID, rank, material, class, optional slot, exact candidate/checkpoint provenance, approved
path, width, height, bytes, and SHA-256. Path refinements allow only:

```text
assets/equipment/approved/material-equipment-v1/items/**.png
assets/equipment/approved/material-equipment-v1/armour-set-references/**.png
```

- [ ] **Step 3: Write planner tests and verify RED**

In a temporary Equipment workspace, assert:

```ts
expect(plan.entries).toHaveLength(161);
expect(plan.entries.filter(({ role }) => role === 'item')).toHaveLength(140);
expect(plan.entries.filter(({ role }) => role === 'armour-set-reference')).toHaveLength(21);
expect(new Set(plan.entries.map(({ approvedPath }) => approvedPath)).size).toBe(161);
```

Test one revised candidate and one base candidate. Prove that all 84 Armour pieces use checkpoint 3,
all 56 other items and 21 set sources use checkpoint 2, and every path/hash matches the proposal.

- [ ] **Step 4: Implement the deterministic planner and CLI shell**

`--plan` prints counts, total bytes, and planned paths. It performs all reads and verification but
creates no approved directory. `--write` remains guarded behind the exact plan hash. `--check`
rebuilds expected metadata and compares existing files without writing.

- [ ] **Step 5: Validate and commit Task 1**

```bash
corepack pnpm vitest run \
  tools/equipment-approved-source-contract.spec.ts \
  tools/equipment-approved-source-promotion.spec.ts
corepack pnpm tsc -p tools/tsconfig.equipment-promotion.json --noEmit
corepack pnpm tsx tools/promote-equipment-approved-sources.ts --plan
git diff --check
```

Expected plan: `161 total / 140 item / 21 reference`, with zero repository writes.

Commit:

```bash
git commit -m "feat(equipment): define approved source promotion"
```

---

### Task 2: Materialize and verify all approved Equipment sources

**Files:**

- Create: `assets/equipment/approved/material-equipment-v1/manifest.json`
- Create: `assets/equipment/approved/material-equipment-v1/receipts/promotion-v1.json`
- Create: 140 PNGs under `assets/equipment/approved/material-equipment-v1/items/`
- Create: 21 PNGs under
  `assets/equipment/approved/material-equipment-v1/armour-set-references/`
- Modify: `assets/equipment/README.md` if present; otherwise create it with lifecycle boundaries

- [ ] **Step 1: Capture the clean-tree basis and plan hash**

Require a clean worktree and verify the Equipment closeout and proposal before writing. Record the
branch, basis commit, source proposal canonical hash, v3 manifest canonical hash, and all three
checkpoint canonical hashes.

- [ ] **Step 2: Run the guarded promotion once**

```bash
corepack pnpm tsx tools/promote-equipment-approved-sources.ts \
  --write \
  --expected-plan-sha256 "$EQUIPMENT_PROMOTION_PLAN_SHA256" \
  --created-at "$EQUIPMENT_PROMOTION_CREATED_AT" \
  --created-by summonlab-owner
```

Set the two task-specific variables from the exact `--plan` output and the recorded UTC promotion
time before invoking `--write`; the tool rejects missing or drifting values.

Use exclusive destination creation. On any collision or mismatch, stop without replacing a file.

- [ ] **Step 3: Verify exact-byte promotion**

```bash
corepack pnpm tsx tools/promote-equipment-approved-sources.ts --check
```

Require 161/161 files, approved SHA equal to candidate SHA, 140/21 role partition, zero unexpected
files, and a receipt whose manifest hash matches the checked manifest.

- [ ] **Step 4: Review the manifest rather than the unchanged pixels**

Inspect samples from a base candidate, a selected root revision, a base Armour piece, a selected
Armour-piece revision, and an Armour set reference. The image review is identity verification only;
the owner already accepted the pixels at checkpoints 2 and 3.

- [ ] **Step 5: Commit and push Task 2**

```bash
git commit -m "feat(equipment): promote approved visual sources"
git push
```

**Evidence Milestone A:** Record that approved sources are complete and inert and that no runtime or
engine file has changed. Continue directly to Task 3 without requesting review.

---

### Task 3: Export phone-sized Equipment runtime visuals

**Files:**

- Create: `packages/contracts/src/equipment-visual.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.spec.ts`
- Create: `tools/export-equipment-runtime-visuals.ts`
- Create: `tools/export-equipment-runtime-visuals.spec.ts`
- Modify: `package.json`
- Create: `apps/web/static/runtime/equipment-v1/manifest.json`
- Create: 280 content-hashed WebPs under `apps/web/static/runtime/equipment-v1/`
- Create: `assets/equipment/approved/material-equipment-v1/reviews/runtime-v1/index.html`

- [ ] **Step 1: Write runtime-manifest contract tests and verify RED**

Define strict schemas for `card` and `detail` records, bundles, encoder evidence, source approval,
per-file budget, total catalog bytes, and manifest hash. Reject experiment source paths and any
`armour-set-reference` runtime entry.

- [ ] **Step 2: Implement contracts and exports**

Export the new schemas from `@summonlab/contracts` without changing existing character visual
contracts.

- [ ] **Step 3: Write exporter tests and verify RED**

Cover deterministic re-encoding, metadata stripping, `256×256` card bounds, `512×512` detail
bounds, source hash verification, content-hashed names, missing/extra/stale files, and safe output
replacement. Test a transparent/empty-corner source and a dense S-rank source.

- [ ] **Step 4: Implement isolated Equipment export**

Add scripts:

```json
"export:equipment-runtime-visuals": "tsx tools/export-equipment-runtime-visuals.ts",
"validate:equipment-runtime-visuals": "tsx tools/export-equipment-runtime-visuals.ts --check"
```

The manifest loads independently from `runtime/visual-catalog-v1`. Runtime files are not included in
the initial phone bundle and are addressed directly through manifest public paths.

- [ ] **Step 5: Generate the 280 derivatives and hosted review page**

The gallery groups by rank, material, form, and usage and allows card/detail comparison at native
phone display size. It links each derivative to its approved source and hash evidence.

- [ ] **Step 6: Validate, commit, push, and capture visual evidence**

```bash
corepack pnpm vitest run \
  packages/contracts/src/contracts.spec.ts \
  tools/export-equipment-runtime-visuals.spec.ts
corepack pnpm typecheck
corepack pnpm validate:equipment-runtime-visuals
git diff --check
git commit -m "feat(equipment): export runtime visual catalog"
git push
```

**Evidence Milestone B:** Inspect and record card readability, detail quality,
transparency/background behavior, and file budgets at phone display size. Correct objective defects
and continue directly to Task 4 without requesting review. This milestone does not reopen Equipment
design approval.

---

### Task 4: Generate the 140-definition Equipment content catalog

**Files:**

- Create: `packages/contracts/src/equipment.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/equipment.spec.ts`
- Create: `packages/content/src/equipment.ts`
- Create: `packages/content/src/equipment.spec.ts`
- Modify: `packages/content/src/index.ts`
- Create: `tools/validate-equipment-content-bindings.ts`
- Create: `tools/validate-equipment-content-bindings.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Write strict Equipment contract tests and verify RED**

Define canonical schemas for rank, material family, 28 material IDs, equipment class, Armour slot,
handedness, weight class, definition, definition catalog, craftsmanship label/bonus, origin, and
recipe descriptor. Enforce `standard→0`, `fine→1`, and `masterwork→2` structurally without defining
the Forging-level thresholds that award them.

- [ ] **Step 2: Implement contracts without engine state changes**

Keep these contracts engine-independent. Do not edit `packages/contracts/src/engine/**` in this
task.

- [ ] **Step 3: Write content-generation tests and verify RED**

Require:

```text
70 metal definitions
14 wood definitions
28 hide/scale definitions
28 cloth/fibre definitions
140 total definitions
```

Assert stable IDs, legal material/form pairs, exactly 84 Armour pieces, no full-set definition, and
correct base rank inherited from material.

- [ ] **Step 4: Implement the generated catalog**

Expose immutable lookup by definition ID and helper functions for material compatibility and the
derived Standard recipe descriptor. Use one normalized material lot per recipe in this slice.

- [ ] **Step 5: Bind content to approved/runtime visuals**

The validator reads the content catalog and both visual manifests. Require exactly one approved item
asset and one card/detail pair per definition, with no orphan item source or runtime derivative.

- [ ] **Step 6: Validate and commit Task 4**

```bash
corepack pnpm vitest run \
  packages/contracts/src/equipment.spec.ts \
  packages/content/src/equipment.spec.ts \
  tools/validate-equipment-content-bindings.spec.ts
corepack pnpm tsx tools/validate-equipment-content-bindings.ts
corepack pnpm typecheck
git diff --check
git commit -m "feat(equipment): define material item catalog"
git push
```

---

### Task 5: Add engine-v24 item instances, material lots, and loadout slots

**Shared-surface authorization:** The approved design and this plan authorize the scoped
engine/contracts integration below. Inspect current ownership and concurrent changes before editing,
preserve all v1–v23 contracts, and continue without waiting for an owner checkpoint. Stop only if an
incompatible concurrent change cannot be isolated safely.

**Files:**

- Modify: `packages/contracts/src/engine/base-state.ts`
- Modify: `packages/contracts/src/engine/settlement-state.ts`
- Modify: `packages/contracts/src/engine/game-state.ts`
- Modify: `packages/contracts/src/engine/commands.ts`
- Modify: `packages/contracts/src/engine/runtime.ts`
- Modify: `packages/contracts/src/engine/index.ts`
- Modify: `packages/contracts/src/engine-compatibility.spec.ts`
- Modify: `packages/contracts/src/engine-compatibility-states.snapshot.ts`
- Modify: `packages/engine/src/core/versions.ts`
- Modify: `packages/engine/src/core/content-bindings.ts`
- Modify: `packages/engine/src/orchestration/bootstrap.ts`
- Modify: `packages/engine/src/compatibility/replay-vectors.ts`
- Modify: `packages/engine/src/compatibility/public-api.snapshot.ts` only if a new public constant is
  intentionally exported
- Create: `packages/engine/src/domains/settlement/equipment.ts`
- Create: `packages/engine/src/domains/settlement/equipment.spec.ts`
- Modify database/web state-version consumers identified by the compatibility search

- [ ] **Step 1: Characterize v23 before adding v24**

Add focused assertions that v23 accepts only its legacy item/loadout shape and that existing replay
vectors and serialized fixtures remain byte-stable.

- [ ] **Step 2: Write v24 schema tests and verify RED**

Add v24-only item instances, structured origin, material-lot balances, and loadout:

```text
mainHand, offHand, head, torso, legs, boots
```

Reject unknown definition IDs at the engine content-binding layer, illegal rank/bonus pairs,
durability overflow, non-owner equipment, and duplicate slot occupancy.

- [ ] **Step 3: Implement v24 composition and version capability**

Add `EQUIPMENT_ENGINE_CONTENT_VERSION = 'engine-v24'`. Extend the discriminated state union and all
capability predicates without editing V1–V23 schema definitions.

- [ ] **Step 4: Implement the pure item factory and equip legality**

The factory takes definition ID, owner, craftsmanship, origin, and deterministic item ID. It looks up
authored facts through immutable content binding and computes final rank. Standard is the only
craftable input, but Fine/Masterwork fixtures prove schema and rank calculation only.

Equip legality covers six slots, Shield/off-hand, two-handed occupancy, and current Dual Wield
restrictions. Do not implement combat-stat effects in this task.

- [ ] **Step 5: Add deterministic legacy adaptation**

Map `practice-blade` and `short-bow` into explicit legacy definitions/origin when a v24 bootstrap or
migration is created. Do not rewrite old snapshots or events.

- [ ] **Step 6: Run compatibility and focused engine validation**

```bash
corepack pnpm vitest run \
  packages/contracts/src/engine-compatibility.spec.ts \
  packages/engine/src/domains/settlement/equipment.spec.ts \
  packages/engine/src/compatibility/public-api.spec.ts
corepack pnpm typecheck
git diff --check
```

- [ ] **Step 7: Commit and push Task 5**

```bash
git commit -m "feat(engine): add versioned equipment state"
git push
```

---

### Task 6: Implement Standard Forging as a deterministic workshop activity

**Files:**

- Create: `packages/engine/src/domains/settlement/forging.ts`
- Create: `packages/engine/src/domains/settlement/forging.spec.ts`
- Modify: `packages/contracts/src/engine/commands.ts`
- Modify: `packages/contracts/src/engine/settlement-state.ts`
- Modify: `packages/engine/src/domains/settlement/commands.ts`
- Modify: `packages/engine/src/domains/settlement/reducer.ts`
- Modify: `packages/engine/src/domains/settlement/routines.ts`
- Modify: `packages/engine/src/domains/settlement/actions.ts`
- Modify: `packages/engine/src/orchestration/command-registry.ts`
- Modify: `packages/engine/src/orchestration/event-registry.ts`
- Modify: `packages/engine/src/orchestration/legal-actions.ts`
- Modify: `packages/engine/src/orchestration/scheduling.ts`
- Modify: `packages/engine/src/orchestration/bootstrap.ts`
- Modify: focused engine/domain tests and compatibility inventories

- [ ] **Step 1: Write the complete Forging behavior test and verify RED**

Prove one v24 hero at the powered workshop can select a known definition, reserve one matching
material lot, start a scheduled activity, resolve it once, and receive one Standard item in company
inventory. The event must contain the bound definition/catalog hash and deterministic item ID.

- [ ] **Step 2: Add rejection and atomicity tests**

Reject wrong location, dormant forge system, missing Forging permission, missing/mismatched material,
unknown definition, non-forgeable definition, unsupported Fine/Masterwork request, duplicate command,
and replay mismatch. No rejected command consumes a material lot or creates an item.

- [ ] **Step 3: Implement commands, events, scheduling, and reduction**

Follow existing settlement activity patterns. Reserve or consume the lot exactly once and resolve
the resulting item through the Task 5 item factory. Preserve event registry uniqueness and legal
action ordering.

- [ ] **Step 4: Add a bounded material-lot fixture**

Seed only the deterministic development/playtest lots needed to exercise the forge. Do not invent a
full Gathering node, yield, or respawn economy in this plan. The state and command seams must allow a
future Gathering result to credit the same lot balance.

- [ ] **Step 5: Validate, commit, and push Task 6**

```bash
corepack pnpm vitest run \
  packages/engine/src/domains/settlement/forging.spec.ts \
  packages/engine/src/domains/settlement/equipment.spec.ts \
  packages/engine/src/compatibility/public-api.spec.ts
corepack pnpm validate:settlement-content
corepack pnpm typecheck
git diff --check
git commit -m "feat(forging): create standard equipment"
git push
```

---

### Task 7: Add inventory and workshop presentation to the play surface

**Files:**

- Create: `apps/web/src/lib/server/equipment-runtime.ts`
- Create: `apps/web/src/lib/server/equipment-runtime.spec.ts`
- Modify or create the play/workshop server loader under `apps/web/src/routes/play/[runId]/`
- Modify the corresponding Svelte play/workshop components
- Create: `apps/web/src/routes/equipment-forging.e2e.ts`

- [ ] **Step 1: Write runtime-resolution tests and verify RED**

Resolve a definition to its card/detail public paths through the checked Equipment runtime manifest.
Reject missing aliases, source-hash drift, and Armour-set-reference keys.

- [ ] **Step 2: Implement the minimal workshop UI**

On phone and desktop, show:

- owned material lots;
- compatible item choices;
- card image, name, class/slot, material, and base/final rank;
- one Standard craft action;
- pending/completed/error activity states;
- resulting inventory item and provenance;
- equip action and six-slot loadout summary.

Do not add a top-level route named `/forge`, quality selection, animated effects, enchantment,
repair, full-set crafting, or hero-body compositing.

- [ ] **Step 3: Protect layout and loading behavior**

Use 256px card images in lists and request 512px detail only when inspecting or confirming. Reserve
image aspect ratio before loading and provide explicit unavailable/error states. Assert the initial
play response does not preload the 280 Equipment binaries.

- [ ] **Step 4: Add end-to-end coverage**

At a phone viewport:

1. enter the workshop with one material lot;
2. choose a compatible item;
3. forge and await completion;
4. inspect its material visual and Standard rank;
5. equip it into the correct slot;
6. reload and confirm persistence.

- [ ] **Step 5: Validate, commit, push, and capture playtest evidence**

```bash
corepack pnpm vitest run apps/web/src/lib/server/equipment-runtime.spec.ts
corepack pnpm --filter @summonlab/web typecheck
corepack pnpm --filter @summonlab/web test:e2e -- apps/web/src/routes/equipment-forging.e2e.ts
corepack pnpm validate:phone-performance
git diff --check
git commit -m "feat(web): add workshop equipment flow"
git push
```

**Evidence Milestone C:** Exercise material recognition, card/detail resolution, forge clarity,
one-piece Armour semantics, inventory readability, and equip behavior at phone dimensions. Capture
the results, correct objective defects, and continue directly to Task 8 without requesting review.

---

### Task 8: Add the uncommon standard-equipment drop seam

**Files:**

- Modify: `packages/contracts/src/mission.ts`
- Modify: `packages/content/src/tower-band-01.ts`
- Modify: `packages/content/src/tower-band-01.spec.ts`
- Modify: `packages/engine/src/domains/mission/lifecycle.ts`
- Modify: `packages/engine/src/domains/mission/reducer.ts`
- Modify: `packages/engine/src/domains/mission/mission-runtime.spec.ts`
- Modify: the playtest UI only if drop provenance is not already visible through inventory

- [ ] **Step 1: Write one deterministic drop test and verify RED**

The fixture grants an existing Equipment definition after a fixed authored outcome. Require exactly
one item created through the shared item factory with `origin.kind = 'dropped'`, source mission/reward
IDs, the same visual aliases as a forged copy, legal equipment behavior, and replay-stable identity.

- [ ] **Step 2: Implement the narrow content/event seam**

Do not add random global drop chances. The reward record references a definition ID and initial
condition; the engine validates it through the same content binding as Forging.

- [ ] **Step 3: Prove forged/drop equivalence**

Given the same definition, assert identical authored material, class, slot, handedness, rank base,
and visuals. Only origin and allowed initial condition differ.

- [ ] **Step 4: Validate, commit, and push Task 8**

```bash
corepack pnpm vitest run \
  packages/content/src/tower-band-01.spec.ts \
  packages/engine/src/domains/mission/mission-runtime.spec.ts \
  packages/engine/src/domains/settlement/equipment.spec.ts
corepack pnpm typecheck
git diff --check
git commit -m "feat(equipment): support authored item drops"
git push
```

---

### Task 9: Reconcile documentation, exports, and full release evidence

**Files:**

- Modify: `docs/wiki/mechanics/equipment/README.md`
- Modify: `docs/wiki/mechanics/equipment/materials.md` only if runtime terminology needs clarification
- Modify: `docs/wiki/mechanics/equipment/rarity-and-weight.md`
- Modify: `docs/wiki/mechanics/equipment/armour-and-shields.md` only if implementation differs from
  the accepted prose
- Modify: `docs/wiki/roadmap/living-village-v1.md`
- Modify: `docs/system-architecture/system-map.md`
- Modify: `assets/equipment/README.md`
- Create: `assets/equipment/approved/material-equipment-v1/integration-report.json`
- Modify: root validation scripts only to add new zero-write validators

- [ ] **Step 1: Build the deterministic integration report**

Record exact approved/runtime/content counts, manifest hashes, engine/content versions, validation
commands, commits, evidence milestones, deferred quality decisions, and no-image-generation evidence.

- [ ] **Step 2: Update current-state documentation**

State clearly:

- standard Equipment is primarily forged from one rank-bearing material lot;
- uncommon standard drops reuse the same definitions;
- 140 equippable definitions exist;
- 21 full-set images are approved references, not items;
- Standard is enabled while Fine/Masterwork resolution and visual quality treatment remain deferred;
- full Gathering economy, monster-derived Equipment, and broad loot balancing remain later work.

- [ ] **Step 3: Run focused and full validation**

```bash
corepack pnpm validate:equipment-runtime-visuals
corepack pnpm tsx tools/validate-equipment-content-bindings.ts
corepack pnpm validate:runtime-visuals
corepack pnpm validate:phone-performance
corepack pnpm check
git diff --check
```

Expected: all commands exit 0, and `pnpm check` creates no uncommitted output.

- [ ] **Step 4: Commit and push closeout**

```bash
git commit -m "docs(equipment): close runtime integration"
git push
```

## Definition of done

The implementation is complete when:

- all 161 accepted candidate selections exist as exact, hash-bound approved sources;
- 140 equippable sources have deterministic card/detail runtime derivatives;
- all 140 legal material/form combinations have one content definition and visual binding;
- engine-v24 stores definition-backed Equipment without invalidating V1–V23;
- one Standard item can be forged, persisted, inspected, and equipped through the phone play surface;
- one deterministic authored drop produces the same kind of item through the same factory;
- candidate, approved, runtime, content, and item-instance states remain distinguishable;
- no craftsmanship image variants, global drop economy, broad Gathering economy, monster-derived
  Equipment, or unrelated runtime catalogs have been added;
- every batch is validated, committed, pushed, and linked from the final integration report;
- Tasks 1–9 have run continuously without intermediate human review gates, and the complete gallery,
  report, and runnable implementation are ready for the owner's single final review.
