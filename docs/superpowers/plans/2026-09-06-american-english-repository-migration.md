# American English Repository Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every repository-owned spelling, identifier, and tracked path to conventional
American English, preserve only approved proper names and external identifiers, and enforce the
policy automatically.

**Architecture:** A finite policy module derives each retired spelling from its American form so the
checker can scan itself without retaining prohibited literals. A read-only audit inventories tracked
text and paths. A transactional migration planner consumes that inventory, blocks collisions and
unowned integrity bindings, performs scoped text edits and `git mv` operations, and records a
hash-only migration ledger. Domain adapters reuse each production system's canonical serializers and
hash functions to issue internally consistent successor metadata before generated outputs are rebuilt.

**Tech Stack:** TypeScript 6, Node.js 24, Git, Vitest 4, Prettier 3, pnpm 10, existing Summonlab
exporters and validators.

**Spec:** `docs/superpowers/specs/2026-09-06-american-english-repository-migration-design.md`

## Global Constraints

- Treat this as a clean break. Do not add aliases, fallback IDs, redirects, save migrations, or other
  compatibility literals for retired spellings.
- Preserve character and proper names. Preserve only the required package/API identifiers enumerated
  in the specification; every exception must identify an exact token, exact path or narrow path
  pattern, and reason.
- Scan every path returned by `git ls-files -z`. Inspect all path components, and inspect file content
  unless Git classifies the file as binary. Do not skip a directory.
- Keep the policy finite and reviewable. This is a spelling policy, not a general dictionary or style
  checker.
- Keep prohibited literals out of the checker, its tests, this plan, and the final migration ledger.
  Tests construct retired forms through the policy's derivation helper.
- Default every migration command to read-only. Require `--write`, a clean working tree, the recorded
  baseline commit as an ancestor, preimages matching either that baseline or an earlier migration
  receipt, zero path collisions, zero unowned integrity bindings, and a fresh inventory before any
  mutation.
- Use `git mv` for tracked path changes. Sort file moves deepest-first, and reject a destination that
  is tracked, untracked, duplicated, or escapes the repository.
- Preserve bytes for renamed binary source assets. Only an owning exporter may create different image
  bytes.
- Never hand-edit a hash. Recompute prompt, path, ID, raw-file, canonical-object, manifest, and receipt
  hashes through the owning serializer or exporter.
- A production record whose canonical metadata changes becomes a language-migration successor. The
  hash-only ledger binds its pre-migration Git blob ID, successor path, successor blob ID, rule IDs,
  and owner; Git retains the original record at the baseline commit.
- Commit and push after every completed task. Before the final activation, an audit may fail only for
  rule IDs explicitly deferred to later tasks; never commit a stale generated output, unresolved
  binding, unexpected rule ID, or unexplained binary change.
- Rebase on the current `origin/main` both before producing the baseline inventory and immediately
  before final validation. Resolve source conflicts semantically and regenerate derived conflicts.

## File Map

| File or generated set | Responsibility |
| --- | --- |
| `tools/american-english-policy.ts` | Finite American forms, derivations, matching, case preservation, and scoped exceptions |
| `tools/american-english-policy.spec.ts` | Prose, identifier, path, exception, and false-positive policy tests |
| `tools/check-american-english.ts` | Git-tracked text/path audit CLI with text and JSON output |
| `tools/american-english-migration.ts` | Collision-safe plan/apply engine and hash-only ledger builder |
| `tools/american-english-migration.spec.ts` | Temporary-repository tests for planning, moves, edits, rollback, and binary preservation |
| `tools/american-english-integrity.ts` | Integrity-binding registry, owner dispatch, and unresolved-binding gate |
| `tools/american-english-integrity.spec.ts` | Binding ownership and topological successor tests |
| `tools/american-english-equipment-successors.ts` | Equipment v1-v3 prompt, packet, review, approval, and runtime successor adapter |
| `tools/american-english-visual-successors.ts` | Enemy, hero, and skill-image target/assignment/result successor adapter |
| `tools/american-english-runtime-successors.ts` | Engine fixtures, wiki catalogs, and runtime-manifest successor adapter |
| `docs/audits/american-english-migration-v1.json` | Final hash-only migration receipt; contains no retired spelling or baseline path text |
| `package.json` | Audit, migration preflight, and required `check` scripts |
| `tools/tsconfig.image-production.json` | Type coverage for new migration and visual-successor modules |
| `tools/tsconfig.equipment-rank-first-v3.json` | Type coverage for the equipment successor adapter |
| `tools/tsconfig.playtest-package.json` | Type coverage for the runtime successor adapter if not already included |
| Paths selected by `check:american-english --format json` | Complete, machine-derived set of source edits and path moves |
| Existing exporter-owned JSON, HTML, WebP, and runtime manifests | Rebuilt derivatives after their canonical source owners change |

---

### Task 1: Build the self-hosting spelling policy and complete tracked-tree audit

**Files:**

- Create: `tools/american-english-policy.ts`
- Create: `tools/american-english-policy.spec.ts`
- Create: `tools/check-american-english.ts`
- Modify: `tools/tsconfig.image-production.json`
- Modify: `package.json`

**Interfaces:**

```ts
export type AmericanEnglishRuleId =
  | 'armor'
  | 'ocher'
  | 'gray'
  | 'behavior'
  | 'fiber'
  | 'catalog'
  | 'vigor'
  | 'practice'
  | 'center'
  | 'mustache'
  | 'acknowledgment'
  | 'color'
  | 'math'
  | 'channel'
  | 'draft'
  | 'immobilize'
  | 'neighbor'
  | 'specialize'
  | 'defense'
  | 'flavor'
  | 'cancel'
  | 'favor'
  | 'crystallize'
  | 'label'
  | 'level'
  | 'luster'
  | 'realize'
  | 'recognize'
  | 'saber'
  | 'vapor';

export interface AmericanEnglishViolation {
  kind: 'content' | 'path';
  ruleId: AmericanEnglishRuleId;
  found: string;
  recommended: string;
  path: string;
  line: number | null;
  column: number | null;
}

export function deriveRetiredForms(ruleId: AmericanEnglishRuleId): readonly string[];
export function replaceRetiredForms(source: string): string;
export async function auditTrackedTree(
  repositoryRoot?: string
): Promise<readonly AmericanEnglishViolation[]>;
```

- [ ] **Step 1: Refresh the branch before creating the baseline**

```bash
test -z "$(git status --porcelain)"
git fetch origin main
git rebase origin/main
git rev-parse origin/main > /tmp/summonlab-american-english-baseline-head.txt
```

Require the recorded commit to equal `git merge-base HEAD origin/main`. This is the data baseline;
the audit and migration-tool commits added afterward may be descendants, but all preexisting files
must still match this baseline or a recorded migration receipt before they are changed.

- [ ] **Step 2: Write policy tests and verify RED**

Use `deriveRetiredForms()` to construct fixtures. Cover lowercase prose, title case, all-uppercase
text, snake case, kebab case, camel case, Pascal case, plurals, inflections, and path components.
Prove that near matches such as `checkerboard`, valid American words, character names, and the two
external identifiers from the specification are not reported. Require exceptions to match both their
token and their narrow path condition.

```bash
corepack pnpm vitest run tools/american-english-policy.spec.ts
```

Expected RED: the policy module does not exist.

- [ ] **Step 3: Implement finite derivations without embedding prohibited literals**

Represent every approved conversion as an American headword plus a transparent operation such as
insert, remove, replace, transpose, or double. Include explicit inflected entries where one root rule
cannot preserve grammar. Compile case-insensitive matchers from the derived strings and restore the
matched case convention in the recommended form.

Reject duplicate derived forms, duplicate rule IDs, empty patterns, exceptions that match no rule,
and broad directory exceptions at module initialization.

- [ ] **Step 4: Implement the Git-tracked audit CLI**

Read a NUL-delimited tracked-path list with `git ls-files -z`. Inspect every path before content.
Classify content through `git check-attr -z --stdin text`; when the attribute is unspecified, use the
same NUL-byte heuristic Git uses for practical binary detection. Decode text as UTF-8, retaining line
and column positions. Sort violations by path, kind, line, column, and rule ID.

Support exactly:

```text
tsx tools/check-american-english.ts [--repository-root PATH] [--format text|json]
```

Exit 0 with a zero-count summary, exit 1 when violations exist, and exit 2 for configuration or Git
errors. JSON output must include `head`, `counts.byRule`, `counts.byRoot`, `violations`, and
`exceptionsUsed`.

- [ ] **Step 5: Add a non-required root command and verify the known failing baseline**

Add:

```json
"check:american-english": "tsx tools/check-american-english.ts"
```

Do not add it to `check` yet. Run:

```bash
corepack pnpm vitest run tools/american-english-policy.spec.ts
corepack pnpm check:american-english -- --format json > /tmp/summonlab-american-english-baseline.json
```

Expected: tests pass; the audit exits 1 and the JSON inventory reports all known text and path
violations from the refreshed branch.

- [ ] **Step 6: Validate and freeze the real inventory**

```bash
corepack pnpm check:american-english -- --format json > /tmp/summonlab-american-english-baseline.json
```

The audit is expected to exit 1. Confirm the JSON parses, contains both content and path violations,
has no unknown rule IDs, and records zero unscoped exceptions. Save the baseline JSON and HEAD file
outside the repository for the rest of the migration.

- [ ] **Step 7: Commit and push the audit foundation**

```bash
git add package.json tools/american-english-policy.ts tools/american-english-policy.spec.ts \
  tools/check-american-english.ts tools/tsconfig.image-production.json
git commit -m "test(repo): inventory non-US spellings"
git push
```

---

### Task 2: Build the transactional migration planner and collision gate

**Files:**

- Create: `tools/american-english-migration.ts`
- Create: `tools/american-english-migration.spec.ts`
- Modify: `package.json`
- Modify: `tools/tsconfig.image-production.json`

**Interfaces:**

```ts
export interface AmericanEnglishPathMove {
  source: string;
  destination: string;
  sourceBlobId: string;
  binary: boolean;
}

export interface AmericanEnglishMigrationPlan {
  baselineCommit: string;
  ruleIds: readonly AmericanEnglishRuleId[];
  textEdits: readonly { path: string; violationCount: number }[];
  pathMoves: readonly AmericanEnglishPathMove[];
  collisions: readonly { destination: string; sources: readonly string[] }[];
  unownedIntegrityBindings: readonly IntegrityBindingProblem[];
}

export async function planAmericanEnglishMigration(
  options: PlanAmericanEnglishMigrationOptions
): Promise<AmericanEnglishMigrationPlan>;
export async function applyAmericanEnglishMigration(
  plan: AmericanEnglishMigrationPlan,
  options: ApplyAmericanEnglishMigrationOptions
): Promise<AmericanEnglishMigrationReceipt>;
```

- [ ] **Step 1: Write temporary-Git-repository tests and verify RED**

Build fixtures containing tracked text, mixed-case identifiers, a binary file, nested path changes,
an untracked destination collision, two sources converging on one destination, an allowed external
identifier, and a dirty worktree. Assert that dry-run is byte-preserving and that every unsafe state
blocks `--write` before the first file changes.

Also inject a failure after the first move and require rollback to restore every source path and byte.
Do not put retired literals in the test source; construct them with `deriveRetiredForms()`.

```bash
corepack pnpm vitest run tools/american-english-migration.spec.ts
```

Expected RED: the migration module does not exist.

- [ ] **Step 2: Implement deterministic planning**

Consume the audit API directly; do not parse human-readable output. Support `--rules` and `--roots`
filters, but compute path destinations across the complete tracked set before filtering so a partial
operation cannot hide a collision. Record every source blob with `git rev-parse
<baseline>:<path>`. Reject case-folded collisions as well as byte-exact collisions.

- [ ] **Step 3: Implement transactional application**

Use a temporary journal under `.git/american-english-migration/`. Verify that the baseline is an
ancestor and every source blob matches either `baseline:path` or the latest earlier migration receipt,
then apply deepest-first `git mv` operations and rewrite tracked text at its destination. Preserve
UTF-8 BOMs, newline style, final-newline state, and file mode. Treat a tracked symlink target as its
text blob and rewrite it only when the audit selected that target. Never decode or rewrite a binary
file.

On any error, reverse completed moves and restore edited files from the captured preimage. Remove the
journal only after the receipt has been written successfully.

- [ ] **Step 4: Produce a hash-only receipt model**

The receipt must contain the baseline commit, policy version, rule counts, owner counts, source blob
IDs, successor paths, successor blob IDs, and unchanged-binary confirmations. It must not contain old
path strings or retired text. The final ledger is written only in Task 7; intermediate runs write to
`/tmp`.

- [ ] **Step 5: Add and verify the preflight command**

Add:

```json
"plan:american-english": "tsx tools/american-english-migration.ts --format json"
```

```bash
corepack pnpm vitest run tools/american-english-migration.spec.ts
corepack pnpm plan:american-english -- --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  > /tmp/summonlab-american-english-plan.json
```

Expected at this checkpoint: collision count is zero. Integrity bindings may still be listed because
their registry is Task 3.

- [ ] **Step 6: Commit and push the planner**

```bash
git add package.json tools/american-english-migration.ts \
  tools/american-english-migration.spec.ts tools/tsconfig.image-production.json
git commit -m "feat(repo): add safe spelling migration planner"
git push
```

---

### Task 3: Register every integrity owner before changing canonical data

**Files:**

- Create: `tools/american-english-integrity.ts`
- Create: `tools/american-english-integrity.spec.ts`
- Create: `tools/american-english-equipment-successors.ts`
- Create: `tools/american-english-visual-successors.ts`
- Create: `tools/american-english-runtime-successors.ts`
- Modify: `tools/tsconfig.image-production.json`
- Modify: `tools/tsconfig.equipment-rank-first-v3.json`
- Modify: `tools/tsconfig.playtest-package.json`
- Modify: the American-spelled successor paths for equipment owner modules selected by the audit
- Modify: `tools/family-affinity-production-lib.ts`
- Modify: `tools/image-production-lib.ts`
- Modify: `packages/characters/src/index.ts`
- Modify: `packages/engine/src/hash.ts`

**Interfaces:**

```ts
export type IntegrityBindingKind =
  | 'raw-file'
  | 'utf8-string'
  | 'canonical-json'
  | 'path-and-content'
  | 'event-chain'
  | 'generated-output';

export interface AmericanEnglishIntegrityOwner {
  id: 'equipment' | 'visual-production' | 'runtime-and-engine';
  owns(path: string, jsonPointer: string): boolean;
  planSuccessors(context: IntegrityPlanningContext): Promise<readonly IntegritySuccessor[]>;
  verify(context: IntegrityVerificationContext): Promise<readonly IntegrityProblem[]>;
}

export function classifyIntegrityBindings(
  before: TrackedTreeSnapshot,
  proposed: AmericanEnglishMigrationPlan
): Promise<IntegrityBindingReport>;
```

- [ ] **Step 1: Write ownership and resealing tests and verify RED**

For each owner, create a minimal target → assignment → result → review/manifest chain. Change a
prompt term, an ID, and a referenced path. Assert that the adapter recomputes values using the same
exported canonical serializer as the live validator and updates dependents in topological order.

Assert that unknown 64-character digest fields, cycles, ambiguous owners, changed binary hashes,
missing source nodes, and validators without a registered regeneration command all block the plan.

```bash
corepack pnpm vitest run tools/american-english-integrity.spec.ts
```

Expected RED: the integrity registry does not exist.

- [ ] **Step 2: Export canonical helpers instead of copying algorithms**

Expose the existing canonical JSON and digest helpers from the named owner modules where necessary.
The adapters import these functions; they must not implement a second serializer. Add characterization
tests proving pre-migration fixture hashes are unchanged by the export-only refactor.

- [ ] **Step 3: Implement equipment ownership**

Own all changed JSON and prompt bindings below `assets/equipment/`, plus approved-source and equipment
runtime manifests. Plan successors in this order: profiles/schemas; production manifests and
allocation plans; targets; assignments and prompt files; results; reviews/checkpoints/journals;
approved catalog; runtime catalog; integration report.

Require unchanged hashes for candidate/source image bytes. Use the v1, v2, and v3 canonical helpers
already consumed by equipment validators. Mark records as language-migration successors in the
central receipt rather than weakening their immutable production rules.

- [ ] **Step 4: Implement visual-production ownership**

Own changed metadata below `assets/enemies/`, `assets/heroes/`, and `assets/wiki/`. Reuse
`stableFamilyAffinityJson`, `canonicalJson`, and the current skill/hero production schemas. Recompute
prompt and reference-path bindings before target/assignment/result hashes, then rebuild review,
promotion, and catalog bindings.

Treat provider/source image hashes as raw-byte bindings: renamed files keep the old digest; exporter-
generated derivatives must match their newly generated digest.

- [ ] **Step 5: Implement runtime and engine ownership**

Own remaining content hashes, engine state/event fixtures, wiki catalog bindings, web runtime
manifests, and release/package receipts. Rebuild engine fixtures through their existing fixture
builders and runtime outputs through their exporters. Do not replace digest strings mechanically.

- [ ] **Step 6: Require complete ownership in migration preflight**

```bash
corepack pnpm vitest run tools/american-english-integrity.spec.ts \
  tools/american-english-migration.spec.ts
corepack pnpm plan:american-english -- --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  > /tmp/summonlab-american-english-plan.json
```

Expected: `collisions` and `unownedIntegrityBindings` are both empty. Every changed generated path has
one owner and one write/check command.

- [ ] **Step 7: Commit and push the integrity gate**

```bash
git add tools packages/characters/src/index.ts packages/engine/src/hash.ts
git commit -m "feat(repo): register spelling migration integrity owners"
git push
```

---

### Task 4: Migrate the low-coupling spelling families

**Files:**

- Modify/Rename: the exact tracked paths selected by the baseline inventory after excluding the
  `armor`, `ocher`, `gray`, `behavior`, and `fiber` rule IDs
- Modify: affected snapshots and generated files emitted by registered owners

- [ ] **Step 1: Preview the complete low-coupling diff**

```bash
corepack pnpm plan:american-english -- \
  --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  --exclude-rules armor,ocher,gray,behavior,fiber \
  --format json > /tmp/summonlab-american-english-low-coupling.json
```

Require zero collisions and zero unowned bindings. Review the path list, replacement counts, and
exception usage. Confirm the plan changes no binary bytes.

- [ ] **Step 2: Apply source and successor changes atomically**

```bash
corepack pnpm tsx tools/american-english-migration.ts \
  --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  --exclude-rules armor,ocher,gray,behavior,fiber --write
```

Inspect `git diff --summary`, `git diff --stat`, and representative prose, camel-case symbols, schema
literals, and renamed paths. Reject any semantic rewrite beyond spelling normalization.

- [ ] **Step 3: Rebuild owner-selected derivatives**

Run every `writeCommand` in the plan's owner section. Then run each paired `checkCommand`. This list is
machine-generated from the integrity registry so no affected owner can be omitted.

- [ ] **Step 4: Validate the slice**

```bash
corepack pnpm format
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm check:american-english -- --format json \
  > /tmp/summonlab-american-english-after-low-coupling.json
git diff --check
```

Expected: the audit still fails only for the five excluded rule IDs and approved exceptions. All
other rule counts are zero; tests and checks pass.

- [ ] **Step 5: Commit and push the low-coupling slice**

```bash
git add -A
git commit -m "refactor(repo): normalize American English spellings"
git push
```

---

### Task 5: Migrate equipment terminology and all equipment production lineages

**Files:**

- Rename: every tracked equipment path selected by the `armor` and `fiber` rule IDs to its planned
  destination
- Modify: `packages/contracts/src/equipment.ts`
- Modify: `packages/content/src/equipment.ts`
- Modify: `packages/content/src/equipment.spec.ts`
- Modify/Rename: every audit-selected equipment owner module and its colocated test
- Modify: `skills/summonlab-item-production/**`
- Modify: `assets/equipment/**`
- Modify: `docs/wiki/mechanics/equipment/**`
- Modify: `apps/web/src/lib/components/EquipmentWorkshop.svelte`
- Regenerate: `apps/web/static/runtime/equipment-v1/**`
- Regenerate: `assets/equipment/approved/material-equipment-v1/reviews/runtime-v1/index.html`

- [ ] **Step 1: Preview and verify equipment closure**

```bash
corepack pnpm plan:american-english -- \
  --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  --rules armor,fiber --format json > /tmp/summonlab-american-english-equipment.json
```

Confirm that every external reference to a renamed equipment ID or path is in the text-edit set. The
owner order must cover v1, v2, v3, approved sources, runtime outputs, and integration reports. Require
zero binary content changes in the proposed move set.

- [ ] **Step 2: Apply the equipment migration**

```bash
corepack pnpm tsx tools/american-english-migration.ts \
  --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  --rules armor,fiber --write
```

Require the equipment adapter to reissue prompts, packets, results, reviews, manifests, and receipts
in dependency order. Every preimage must match its baseline blob ID; divergent concurrent data stops
the task.

- [ ] **Step 3: Regenerate deterministic equipment artifacts**

Run the owner commands emitted by the plan, including the migrated equivalents of the v1/v2 profile,
schema, production, and v3 production exporters. Then rebuild active delivery artifacts:

```bash
corepack pnpm export:equipment-runtime-visuals
corepack pnpm export:equipment-integration-report
```

The runtime WebPs may be regenerated; compare their SHA-256 values with the baseline. Because source
pixels and encoder settings are unchanged, any changed WebP digest requires investigation.

- [ ] **Step 4: Run equipment checks**

```bash
corepack pnpm vitest run packages/content/src/equipment.spec.ts \
  tools/american-english-integrity.spec.ts
corepack pnpm validate:equipment-approved-sources
corepack pnpm validate:equipment-runtime-visuals
corepack pnpm validate:equipment-content-bindings
corepack pnpm validate:equipment-integration-report
corepack pnpm typecheck
corepack pnpm check:american-english -- --format json \
  > /tmp/summonlab-american-english-after-equipment.json
git diff --check
```

Expected: `armor` and `fiber` counts are zero in both content and paths. Remaining failures belong
only to the three deferred high-volume rule IDs and approved exceptions.

- [ ] **Step 5: Commit and push the equipment slice**

```bash
git add -A
git commit -m "refactor(equipment): adopt American English terminology"
git push
```

---

### Task 6: Migrate palette, creature, hero, and visual-production terminology

**Files:**

- Rename: every tracked path selected by the `ocher` and `gray` rule IDs
- Modify: `assets/enemies/**`
- Modify: `assets/heroes/**`
- Modify: `assets/wiki/**`
- Modify: `packages/content/src/enemy-roster.ts`
- Modify: `packages/content/src/affinity-workflow.ts`
- Modify: `tools/family-affinity-production-lib.ts`
- Modify: `tools/family-affinity-review-lib.ts`
- Modify: `tools/wiki-monster-database-lib.ts`
- Modify: audit-selected skill-icon and hero-roster owner modules
- Rename: `docs/wiki/creatures/monsters/wolf-gray-wolf.md` and every other planned wiki destination
- Regenerate: `docs/wiki/creatures/monsters/**`
- Regenerate: `apps/web/static/wiki-media/skills/visual-catalog-v1/**`
- Regenerate: active enemy, hero, skill-icon, and player runtime manifests selected by the owner plan

- [ ] **Step 1: Preview and verify visual-lineage closure**

```bash
corepack pnpm plan:american-english -- \
  --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  --rules ocher,gray --format json > /tmp/summonlab-american-english-visuals.json
```

Require all changed prompt, target, assignment, result, review, catalog, and runtime bindings to have
exactly one visual-production owner. Confirm every renamed PNG retains its baseline digest.

- [ ] **Step 2: Apply visual source and successor changes**

```bash
corepack pnpm tsx tools/american-english-migration.ts \
  --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  --rules ocher,gray --write
```

The adapter must preserve attempt timestamps, provider output IDs, inspection findings, statuses, and
image digests while updating only normalized prompt/path/ID fields and their dependent hashes. Record
every changed production JSON as a language-migration successor in the central receipt.

- [ ] **Step 3: Rebuild generated wiki and runtime data**

Run all write commands emitted by the owner plan, including these active exporters when selected:

```bash
corepack pnpm export:wiki-monsters
corepack pnpm export:wiki-skill-visual-catalog
corepack pnpm export:runtime-visuals
corepack pnpm export:player-visuals
corepack pnpm tsx tools/export-summonable-hero-runtime.ts
corepack pnpm export:skill-icon-runtime
```

Do not run image generation. These commands may copy, compose, or encode already approved source
bytes only as their normal delivery contract requires.

- [ ] **Step 4: Run visual-domain checks**

```bash
corepack pnpm check:family-affinity-production
corepack pnpm check:fauna-family-production
corepack pnpm check:family-affinity-production-compatibility
corepack pnpm validate:affinity-workflow
corepack pnpm validate:wiki-monsters
corepack pnpm validate:runtime-visuals
corepack pnpm validate:player-visuals
corepack pnpm check:skill-icon-catalog
corepack pnpm check:skill-icon-catalog-v2
corepack pnpm check:skill-icon-runtime
corepack pnpm validate:skill-icons
corepack pnpm test:family-affinity-production
corepack pnpm test:affinity-workflow
corepack pnpm test:skill-icons
corepack pnpm check:american-english -- --format json \
  > /tmp/summonlab-american-english-after-visuals.json
git diff --check
```

Expected: `ocher` and `gray` counts are zero in content and paths. Only `behavior` remains from the
deferred high-volume set, plus approved exceptions.

- [ ] **Step 5: Commit and push the visual-production slice**

```bash
git add -A
git commit -m "refactor(visuals): normalize American palette terminology"
git push
```

---

### Task 7: Migrate the final behavior family and publish the migration receipt

**Files:**

- Modify/Rename: every remaining audit-selected path for the `behavior` rule ID
- Modify: affected application, package, tool, documentation, skill, fixture, and generated paths
- Create: `docs/audits/american-english-migration-v1.json`

- [ ] **Step 1: Require an exact final-rule plan**

```bash
corepack pnpm plan:american-english -- \
  --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  --rules behavior --format json > /tmp/summonlab-american-english-behavior.json
```

Require zero collisions and zero unowned bindings. Confirm the plan includes code symbols, schema
literals, prose, tests, fixtures, and paths—not only whole-word prose.

- [ ] **Step 2: Apply and regenerate the final family**

```bash
corepack pnpm tsx tools/american-english-migration.ts \
  --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  --rules behavior --write
```

Run all owner write/check commands returned by the plan. Run Prettier after generated outputs settle.

- [ ] **Step 3: Prove the tracked tree is clean of unapproved forms**

```bash
corepack pnpm format
corepack pnpm check:american-english -- --format json \
  > /tmp/summonlab-american-english-final.json
```

Expected: exit 0, zero content violations, zero path violations, and only the specification's scoped
external-identifier exceptions reported as used. Compare baseline and final rule totals; every
baseline violation must be accounted for by a successor or an explicitly reviewed exception.

- [ ] **Step 4: Write and validate the hash-only migration ledger**

```bash
corepack pnpm tsx tools/american-english-migration.ts \
  --baseline "$(cat /tmp/summonlab-american-english-baseline-head.txt)" \
  --write-receipt docs/audits/american-english-migration-v1.json
corepack pnpm check:american-english
```

Verify the ledger contains baseline and successor blob IDs, counts, owner IDs, and unchanged-binary
proofs, but no old path text or retired spelling. Validate every successor blob against the current
index before commit.

- [ ] **Step 5: Run broad pre-enforcement checks**

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
git diff --check
```

- [ ] **Step 6: Commit and push final normalization**

```bash
git add -A
git commit -m "refactor(repo): complete American English migration"
git push
```

---

### Task 8: Activate required enforcement

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add a regression test for the root command**

Extend `tools/american-english-policy.spec.ts` with a temporary Git repository that passes cleanly,
then add one derived violation in text and one in a filename and require the CLI to fail with both
locations. Verify text and JSON formatting.

- [ ] **Step 2: Make the audit part of the required pipeline**

Prefix the root `check` script with `pnpm check:american-english &&`. The current workflow runs its
quality commands separately, so add a `Validate American English` step immediately after dependency
installation:

```yaml
- name: Validate American English
  run: pnpm check:american-english
```

- [ ] **Step 3: Verify enforcement**

```bash
corepack pnpm vitest run tools/american-english-policy.spec.ts \
  tools/american-english-migration.spec.ts tools/american-english-integrity.spec.ts
corepack pnpm check:american-english
corepack pnpm check
corepack pnpm test:integration
corepack pnpm check:american-english
git diff --check
```

Expected: every command passes. The second audit catches any generated file created by `check` or the
integration suite.

- [ ] **Step 4: Commit and push enforcement**

```bash
git add package.json tools/american-english-policy.spec.ts .github/workflows/ci.yml
git commit -m "ci(repo): enforce American English"
git push
```

---

### Task 9: Rebase onto current main and perform atomic final validation

**Files:**

- Modify: conflict-resolved handwritten sources, if any
- Regenerate: every derived output whose source owner changed during rebase
- Refresh: `docs/audits/american-english-migration-v1.json`

- [ ] **Step 1: Capture the pre-rebase state and update from main**

```bash
test -z "$(git status --porcelain)"
git log --oneline --decorate origin/main..HEAD > /tmp/summonlab-american-english-commit-series.txt
git fetch origin main
git rebase origin/main
```

- [ ] **Step 2: Resolve conflicts by ownership**

For handwritten files, preserve incoming behavior and reapply American naming. For generated files,
accept neither side blindly: resolve their source owner, rerun the registered write command, and then
run its paired check. If main added a production lineage, extend the inventory and owner registry to
cover it before continuing.

Abort the rebase and reassess if a collision, unknown schema, unowned digest, or changed binary source
appears. Never weaken an integrity validator to finish the rebase.

- [ ] **Step 3: Refresh the audit and ledger against the rebased baseline**

Rerun the full plan in read-only mode against `origin/main`. Require zero violations, collisions, and
unowned bindings. Regenerate the ledger so its baseline commit and blob bindings refer to the actual
integration base, then verify it against the index.

```bash
corepack pnpm plan:american-english -- --baseline "$(git rev-parse origin/main)" \
  --format json > /tmp/summonlab-american-english-rebased-plan.json
corepack pnpm tsx tools/american-english-migration.ts \
  --baseline "$(git rev-parse origin/main)" \
  --write-receipt docs/audits/american-english-migration-v1.json
```

- [ ] **Step 4: Run final validation from a clean dependency state**

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check:american-english
corepack pnpm check
corepack pnpm test:integration
corepack pnpm check:american-english
git diff --check
git status --short
```

Expected: all commands pass and only the refreshed ledger is modified after the rebase. Amend the
appropriate migration commit with the ledger, then rerun the commands if amendment changes any blob
binding.

- [ ] **Step 5: Verify binary preservation and complete inventory accounting**

Use the ledger to compare every moved binary's baseline blob ID and successor blob ID. Require exact
equality for source moves. For exporter-produced binaries, require a registered owner, source binding,
and validator result. Confirm final violation counts are zero and exception use matches the scoped
specification exactly.

- [ ] **Step 6: Push the rebased series and record delivery evidence**

```bash
git push --force-with-lease
git status --short --branch
git log --oneline --decorate origin/main..HEAD
```

Expected: the branch tracks its remote, the worktree is clean, and the complete migration series is
present. Integrate the series atomically; do not cherry-pick only a subset into a deployable branch.

## Definition of Done

- Every Git-tracked text file and path component passes the finite American English policy.
- Character/proper names and required external identifiers are the only scoped exceptions.
- Every baseline finding is accounted for by a successor or approved exception.
- Every path rename is collision-free and every moved source binary is byte-identical.
- Every integrity binding has one owner and all prompt, canonical-object, path, manifest, runtime, and
  receipt hashes validate.
- Equipment, enemy, hero, skill, wiki, engine, release, and runtime generated checks pass.
- `pnpm check`, `pnpm test:integration`, and a post-generation spelling audit pass on the rebased
  branch.
- The branch is pushed, the working tree is clean, and the migration is ready for atomic integration.
