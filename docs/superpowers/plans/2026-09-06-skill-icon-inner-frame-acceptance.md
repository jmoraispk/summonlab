# Skill Icon Inner-Frame Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote exactly the 23 owner-approved V12 inner-frame corrections through an immutable accepted overlay and prevent future agentic icon workflows from baking or mis-layering frames.

**Architecture:** Publish byte-identical accepted copies and a hash-bound manifest without replacing historical cleanup outputs. A fail-closed resolver activates those 23 overrides and preserves 433 baseline composites; the producer skill remains frameless and the creation skill owns deterministic 90% centered assembly with the canonical frame last.

**Tech Stack:** TypeScript, Zod, Sharp, Vitest, Python `unittest`, Markdown agent skills, PNPM.

**Spec:** `docs/superpowers/specs/2026-09-06-skill-icon-inner-frame-acceptance-design.md`

## Global Constraints

- Accept exactly 23 V12 candidates and preserve their exact bytes.
- Preserve all historical V10/V11/V12 evidence, original composites, and original receipts.
- Leave exactly five V10 borderline targets and every unrelated target on baseline composites.
- Use scale `0.9`, prepared size `922x922`, offset `(51,51)`, profile `frame-opening-v3`, and the canonical frame as the final layer.
- Publication is create-only; validation is zero-write and fails closed on any authority or raster drift.
- Individual image producers never resize, composite, promote, or generate rarity-frame content.

---

### Task 1: Acceptance contract, publisher, and resolver

**Files:**
- Create: `packages/contracts/src/skill-icon-inner-frame-acceptance.ts`
- Create: `tools/skill-icon-inner-frame-acceptance.ts`
- Create: `tools/skill-icon-inner-frame-acceptance.spec.ts`
- Create: `tools/accept-skill-icon-inner-frame-regeneration.ts`
- Modify: `tools/tsconfig.skill-icon-production.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: V10 report, V12 report, cleanup manifest, original composites, and V12 candidate bytes.
- Produces: `loadSkillIconInnerFrameAcceptance`, `resolveAcceptedSkillIconComposite`, and
  `syncSkillIconInnerFrameAcceptance({ repositoryRoot, mode })`.

- [ ] **Step 1: Write failing manifest, publication, and resolver tests**

Create tests that import the not-yet-existing module and assert:

```ts
expect(acceptance.records).toHaveLength(23);
expect(acceptance.scope).toEqual({
  catalogSkills: 456,
  acceptedOverrides: 23,
  unchanged: 433,
  borderlineUntouched: 5
});
expect(new Set(resolved.map(({ source }) => source))).toEqual(
  new Set(['baseline', 'inner-frame-v1'])
);
expect(borderlineResolved.every(({ source }) => source === 'baseline')).toBe(true);
expect(await readFile(record.accepted.path)).toEqual(await readFile(record.candidate.path));
```

Also mutate one V12 hash, add one target, delete one target, substitute a baseline hash, preseed a
different accepted byte sequence, and alter each assembly gate. Every case must reject before any
publication write.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm vitest run tools/skill-icon-inner-frame-acceptance.spec.ts
```

Expected: FAIL because `tools/skill-icon-inner-frame-acceptance.ts` does not exist.

- [ ] **Step 3: Add the strict schema and deterministic implementation**

Define the immutable paths and exact decision literals:

```ts
export const ACTIVE_SKILL_ICON_INNER_FRAME_OVERLAY_PATH =
  'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/accepted-overlays/inner-frame-v1/manifest.json';
export const INNER_FRAME_ACCEPTANCE_DECISION = {
  decision: 'accepted',
  reviewerRole: 'owner',
  acceptedOn: '2026-09-06'
} as const;
```

Implement raw-byte SHA-256 validation, regular-file/no-symlink reads, exact 23-record and five-ID
sets, V12 gate validation, exact candidate-to-accepted copying, create-only atomic writes, check
mode, and caller-bound resolution. Keep the CLI as argument parsing only:

```ts
await syncSkillIconInnerFrameAcceptance({
  repositoryRoot: process.cwd(),
  mode: process.argv.includes('--write') ? 'write' : 'check'
});
```

Add package scripts `accept:skill-icon-inner-frame-regeneration` and
`check:skill-icon-inner-frame-acceptance`, include the new spec in `test:skill-icons`, and include all
new TypeScript files in the skill-icon production tsconfig.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
corepack pnpm vitest run tools/skill-icon-inner-frame-acceptance.spec.ts
corepack pnpm typecheck:skill-icons
```

Expected: PASS.

- [ ] **Step 5: Review Task 1 against the spec**

Verify that no implementation path replaces `quality-cleanup-v1/composites/*.png`, no resolver can
activate an unbound disk artifact, and all 456 targets resolve exactly once.

### Task 2: Publish the immutable accepted overlay

**Files:**
- Create: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/accepted-overlays/inner-frame-v1/manifest.json`
- Create: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/accepted-overlays/inner-frame-v1/composites/*.png` (23 files)

**Interfaces:**
- Consumes: `syncSkillIconInnerFrameAcceptance` from Task 1.
- Produces: one immutable manifest and 23 V12-identical accepted composites.

- [ ] **Step 1: Prove the acceptance check fails before publication**

Run:

```bash
corepack pnpm check:skill-icon-inner-frame-acceptance
```

Expected: FAIL listing the absent accepted overlay outputs.

- [ ] **Step 2: Publish with the create-only command**

Run:

```bash
corepack pnpm accept:skill-icon-inner-frame-regeneration
```

Expected: exactly 24 files written: 23 composites and one manifest.

- [ ] **Step 3: Prove deterministic zero-write replay**

Run:

```bash
corepack pnpm check:skill-icon-inner-frame-acceptance
git diff --name-only -- assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites \
  assets/wiki/skills/icon-production-v1/quality-cleanup-v1/results
```

Expected: check passes and the second command prints nothing.

- [ ] **Step 4: Run the focused resolver test against published artifacts**

Run:

```bash
corepack pnpm vitest run tools/skill-icon-inner-frame-acceptance.spec.ts
```

Expected: PASS with 23 accepted and 433 baseline resolutions.

- [ ] **Step 5: Review Task 2 against the spec**

Compare every accepted composite hash with its V12 candidate hash and confirm all five borderline
IDs resolve to `source: 'baseline'`.

### Task 3: Correct and test the agentic skill workflow

**Files:**
- Modify: `skills/summonlab-skill-icon-production/SKILL.md`
- Modify: `skills/summonlab-skill-icon-production/references/review-rubric.md`
- Modify: `skills/summonlab-skill-creation/SKILL.md`
- Modify: `skills/summonlab-skill-creation/references/repository-workflow.md`
- Create: `tools/summonlab-skill-creation-skill.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: the accepted producer/coordinator ownership split in the design spec.
- Produces: testable agent instructions for frameless generation and deterministic final assembly.

- [ ] **Step 1: Run baseline skill evaluations and record RED behavior**

Dispatch one isolated evaluation per skill with the same prompt:

```text
Create a new E-rank skill icon from a generated individual image. Explain exactly which references
the image producer receives, whether the generated image contains a rarity frame, who performs any
resize, the exact default scale and offset, the layer order, and every required composition gate.
```

Expected baseline failures: `summonlab-skill-creation` asks individual production to retain a
complete frame and supplies the approved frame as generation content; neither skill jointly states
the exact deterministic 90% coordinator assembly and complete gate set.

- [ ] **Step 2: Write the failing static skill-contract test**

Require these exact concepts across the two skills:

```ts
for (const term of [
  'frameless artwork layer',
  'artworkScale: 0.9',
  '922x922',
  '(51,51)',
  "compositionProfile: 'frame-opening-v3'",
  'frame is the final layer',
  'complete aperture coverage',
  'protected-band'
]) expect(documentation).toContain(term);

expect(individualWorkflow).not.toContain('retain transparent exterior and all frame ornaments');
```

- [ ] **Step 3: Run the static test and verify RED**

Run:

```bash
corepack pnpm vitest run tools/summonlab-skill-creation-skill.spec.ts
```

Expected: FAIL because the old framed-individual workflow remains.

- [ ] **Step 4: Make the smallest coherent skill edits**

Keep `summonlab-skill-icon-production` generation-only. Add explicit frameless composition and
inspection guidance without authorizing resizing or composition. In `summonlab-skill-creation`,
replace the framed-individual steps with:

```text
Generate one frameless artwork layer from content, geometry, family, and immediate-parent
authorities. The coordinator centers the accepted provider artwork at artworkScale: 0.9, producing
922x922 pixels at (51,51) on the 1024x1024 canvas. It verifies complete aperture coverage, extracts
the aperture interior, adds canonical backing, and applies the canonical rarity frame as the final
layer with compositionProfile: 'frame-opening-v3'.
```

List all fail-closed composition gates from the design. Preserve complete frames on family sheets
as reference-only presentation.

- [ ] **Step 5: Run static and Python skill tests and verify GREEN**

Run:

```bash
corepack pnpm vitest run tools/summonlab-skill-creation-skill.spec.ts
python3 -m unittest skills/summonlab-skill-icon-production/scripts/test_verify_result.py
```

Expected: PASS.

- [ ] **Step 6: Run forward skill evaluations**

Repeat the exact Step 1 evaluation prompt in fresh isolated contexts. Expected: both agents keep
producer output frameless, assign resize/composition to the coordinator, state `0.9`, `922x922`,
`(51,51)`, backing-before-frame order, `frame-opening-v3`, and every gate without expanding producer
write authority.

- [ ] **Step 7: Review Task 3 against the spec**

Confirm the skills do not conflict: the producer never composites or promotes, while the creation
coordinator never asks image generation for a frame or treats a framed family sheet as crop content.

### Task 4: Full verification, independent review, and delivery

**Files:**
- Modify only files required to resolve findings that are in scope for this plan.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: a verified, committed, pushed acceptance slice.

- [ ] **Step 1: Run focused and aggregate verification**

Run:

```bash
corepack pnpm check:skill-icon-inner-frame-acceptance
corepack pnpm check:skill-icon-inner-frame-regeneration-review
corepack pnpm vitest run tools/skill-icon-inner-frame-acceptance.spec.ts \
  tools/summonlab-skill-creation-skill.spec.ts \
  tools/render-skill-icon-inner-frame-regeneration-review.spec.ts
python3 -m unittest skills/summonlab-skill-icon-production/scripts/test_verify_result.py
corepack pnpm typecheck:skill-icons
corepack pnpm prettier --check \
  packages/contracts/src/skill-icon-inner-frame-acceptance.ts \
  tools/skill-icon-inner-frame-acceptance.ts \
  tools/skill-icon-inner-frame-acceptance.spec.ts \
  tools/accept-skill-icon-inner-frame-regeneration.ts \
  tools/summonlab-skill-creation-skill.spec.ts \
  skills/summonlab-skill-icon-production \
  skills/summonlab-skill-creation \
  docs/superpowers/specs/2026-09-06-skill-icon-inner-frame-acceptance-design.md \
  docs/superpowers/plans/2026-09-06-skill-icon-inner-frame-acceptance.md
git diff --check
```

Expected: PASS with no writes from either check command.

- [ ] **Step 2: Request independent code review**

Ask the reviewer to inspect exact scope, immutable publication, authority binding, resolver
fail-closed behavior, 23/433/5 counts, byte equality, and producer/coordinator instruction
consistency. Resolve every Critical or Important finding and rerun Step 1.

- [ ] **Step 3: Commit the completed outcome**

Run:

```bash
git add packages/contracts/src/skill-icon-inner-frame-acceptance.ts \
  tools/skill-icon-inner-frame-acceptance.ts \
  tools/skill-icon-inner-frame-acceptance.spec.ts \
  tools/accept-skill-icon-inner-frame-regeneration.ts \
  tools/summonlab-skill-creation-skill.spec.ts \
  tools/tsconfig.skill-icon-production.json package.json \
  skills/summonlab-skill-icon-production skills/summonlab-skill-creation \
  assets/wiki/skills/icon-production-v1/quality-cleanup-v1/accepted-overlays/inner-frame-v1 \
  docs/superpowers/specs/2026-09-06-skill-icon-inner-frame-acceptance-design.md \
  docs/superpowers/plans/2026-09-06-skill-icon-inner-frame-acceptance.md
git commit -m "fix(skills): accept inner-frame corrections"
git push
```

Expected: the branch is pushed and the working tree is clean.

## Self-review

- Spec coverage: all scope, immutability, resolver, skill, testing, and delivery requirements map to
  Tasks 1-4.
- Placeholder scan: the plan contains no deferred implementation placeholders.
- Type consistency: the publisher, loader, resolver, mode names, manifest path, and decision literals
  are consistent across tasks.
