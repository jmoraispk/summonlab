# Character Action and Animation Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit five-beat character-action prerequisite, teach animation production to
route known and undefined actions correctly, and replace Toma's one-legged run with a validated v4
candidate.

**Architecture:** `summonlab-character-action-creation` owns motion intent and emits an approved
five-beat action contract; `summonlab-character-animations` consumes either that contract or a saved
known-action reference and owns raster production. A deterministic skill validator protects the
cross-skill routing language, while versioned support evidence and the existing atlas pipeline protect
Toma's runtime artifact.

**Tech Stack:** Markdown Codex skills, SVG instructional reference, Node.js 24, `node:test`, Sharp,
PixiJS v8, Svelte 5, Playwright, Codex image generation.

**Spec:** `docs/superpowers/specs/2026-09-04-character-action-animation-contract-design.md`

## Global Constraints

- The new skill name is exactly `summonlab-character-action-creation`.
- Newly defined actions use exactly five ordered beats in this slice.
- Known actions cite a saved motion contract; undefined actions must be approved through action
  creation before raster generation.
- Classical running uses `left, left, none, right, right` support in its five-frame reference.
- Toma v1-v3 and their runtime derivatives remain immutable; all corrected outputs use version 4.
- Toma's face, proportions, camera, left-arm bronze shield, right-hand mace, scale, lighting, and
  non-run clips remain locked.
- Generated animation art remains `candidate` until owner review.
- Do not change combat simulation, target selection, timing, navigation, or other character clips.

---

### Task 1: Add the Character-Action Skill and Known-Action Routing

**Files:**

- Create: `skills/summonlab-character-action-creation/SKILL.md`
- Create: `skills/summonlab-character-action-creation/agents/openai.yaml`
- Create: `skills/summonlab-character-action-creation/references/action-contract.md`
- Create: `skills/summonlab-character-animations/references/classical-human-run.svg`
- Create: `skills/summonlab-character-animations/references/known-actions.md`
- Modify: `skills/summonlab-character-animations/SKILL.md`
- Modify: `skills/summonlab-character-animations/references/clip-contracts.md`
- Create: `tools/validate-character-animation-skills.mjs`
- Create: `tools/validate-character-animation-skills.spec.mjs`

**Interfaces:**

- Consumes: the approved design and the existing animation clip brief.
- Produces: an action brief with `Character / action`, `Gameplay intent`, `Motion sentence`, five
  numbered beats, `Acting limb / delivery`, `Contacts / center of mass`, `Loop seam or terminal
  state`, and `Forbidden alternatives`; a known-action reference with ID
  `classical-human-run-5`; and a zero-exit validator for their cross-links.

- [ ] **Step 1: Read the required skill-authoring instructions**

Read `skill-creator`, `superpowers:writing-skills`, and the complete existing
`summonlab-character-animations` skill before editing. Use their scaffold, trigger, description, and
validation rules as authority where they are stricter than this plan.

- [ ] **Step 2: Write the failing skill-contract tests**

Create `tools/validate-character-animation-skills.spec.mjs` using `node:test`. The positive test runs
the validator against the repository. Negative fixtures are produced in temporary directories by
copying the skills and then removing, one at a time:

```js
it('requires undefined actions to route through action creation', () => {
	const result = runValidatorWithAnimationSkill(
		animationSkill.replace('summonlab-character-action-creation', 'missing-action-authority')
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /undefined action.*action creation/i);
});

it('requires the classical run support sequence', () => {
	const result = runValidatorWithKnownActions(
		knownActions.replace('left, left, none, right, right', 'left, left, left, left, right')
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /classical human run.*support/i);
});
```

- [ ] **Step 3: Run the tests and verify the contract is absent**

Run:

```bash
node --test tools/validate-character-animation-skills.spec.mjs
```

Expected: FAIL because `tools/validate-character-animation-skills.mjs` and the new action skill do
not exist.

- [ ] **Step 4: Scaffold the action-creation skill**

Create the new skill with this trigger boundary:

```yaml
---
name: summonlab-character-action-creation
description: Use when a Summonlab character action does not already have an explicit known motion contract and its gameplay intent, acting limb or delivery mechanism, five ordered beats, contacts, or ending must be defined before animation production.
---
```

Its workflow must inspect existing mechanics and character authority, propose exactly one coherent
five-beat action brief, obtain owner approval, and hand the approved brief to
`summonlab-character-animations`. It must explicitly forbid raster generation and pose-variation
discovery.

- [ ] **Step 5: Add the reusable action-contract reference**

Create `references/action-contract.md` with the exact brief fields from the `Interfaces` block and
acceptance gates for one action verb, one acting limb or delivery mechanism, causal beat order,
tracked contacts, monotonic terminal actions, and a coherent loop seam.

- [ ] **Step 6: Add the classical human-run reference**

Create an original SVG with five labeled panels, a shared ground line, left/right foot labels,
support markers, a center-of-mass arc, travel arrow, and the loop arrow. The panels must encode:

```text
1 Contact A      support=left
2 Compression A  support=left
3 Airborne pass  support=none
4 Contact B      support=right
5 Recovery B     support=right
```

Create `known-actions.md` with ID `classical-human-run-5`, the same support sequence, beat prose,
reference link, and rejection rules. Do not copy a photograph or third-party game image.

- [ ] **Step 7: Revise the animation skill routing**

Add `Action authority` and `Support/contact sequence` to its clip brief. Before image generation, it
must classify the action:

```text
known + referenced -> copy the saved beats into the clip brief
undefined/ambiguous -> stop; invoke summonlab-character-action-creation; await approved contract
```

Update `clip-contracts.md` to point human locomotion to `classical-human-run-5` and reject more than
two consecutive frames with the same planted foot, a missing opposite-foot contact, and pose
duplication/reordering presented as progression.

- [ ] **Step 8: Implement and run the deterministic skill validator**

`tools/validate-character-animation-skills.mjs` must accept optional `--animation-skill`,
`--action-skill`, and `--known-actions` paths for negative tests. It validates names/frontmatter,
five-beat language, cross-skill name, known/undefined routing, the exact classical support sequence,
and every relative Markdown/SVG link.

Run:

```bash
node --test tools/validate-character-animation-skills.spec.mjs
node tools/validate-character-animation-skills.mjs
```

Expected: all tests pass and the validator prints `{ "valid": true }`.

- [ ] **Step 9: Validate both skills with the skill-authoring tooling**

Run the exact validation commands required by `skill-creator` and `superpowers:writing-skills`, then:

```bash
pnpm exec prettier --check \
  skills/summonlab-character-action-creation \
  skills/summonlab-character-animations \
  tools/validate-character-animation-skills.mjs \
  tools/validate-character-animation-skills.spec.mjs
git diff --check
```

Expected: all checks pass.

- [ ] **Step 10: Commit the skill contract**

```bash
git add skills/summonlab-character-action-creation \
  skills/summonlab-character-animations \
  tools/validate-character-animation-skills.mjs \
  tools/validate-character-animation-skills.spec.mjs
git commit -m "feat(skills): define character action workflow"
```

### Task 2: Add Versioned Locomotion-Support Evidence

**Files:**

- Modify: `tools/validate-realtime-combat-motion-pack.mjs`
- Modify: `tools/validate-realtime-combat-motion-pack.spec.mjs`
- Create: `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json`

**Interfaces:**

- Consumes: a motion manifest plus `--advance-support-evidence path/to/evidence.json`.
- Produces: validation of `actionAuthority`, the exact five support labels, five unique per-cell
  SHA-256 values, and evidence status `candidate`.

- [ ] **Step 1: Write failing evidence tests**

Extend `tools/validate-realtime-combat-motion-pack.spec.mjs` with temporary evidence fixtures:

```js
it('rejects a five-frame run without alternating support', () => {
	const evidence = {
		actionAuthority: 'classical-human-run-5',
		support: ['left', 'left', 'left', 'left', 'right'],
		cellSha256: ['a', 'b', 'c', 'd', 'e'],
		status: 'candidate'
	};
	const result = validateWithEvidence(evidence);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /support sequence/i);
});
```

Also test rejection of repeated cell hashes and acceptance of
`['left', 'left', 'none', 'right', 'right']` with five distinct 64-character lowercase hashes.

- [ ] **Step 2: Run the focused validator tests and verify failure**

Run:

```bash
node --test tools/validate-realtime-combat-motion-pack.spec.mjs
```

Expected: FAIL because `--advance-support-evidence` is not implemented.

- [ ] **Step 3: Implement support-evidence validation**

Extend the validator without weakening its existing atlas, anchor, or ground-artifact checks. Parse
the optional evidence file and require:

```js
evidence.actionAuthority === 'classical-human-run-5';
evidence.support.join(',') === 'left,left,none,right,right';
new Set(evidence.cellSha256).size === 5;
evidence.cellSha256.every((value) => /^[a-f0-9]{64}$/.test(value));
evidence.status === 'candidate';
```

- [ ] **Step 4: Run the focused validator tests**

Run:

```bash
node --test tools/validate-realtime-combat-motion-pack.spec.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the evidence gate**

```bash
git add tools/validate-realtime-combat-motion-pack.mjs \
  tools/validate-realtime-combat-motion-pack.spec.mjs
git commit -m "test(combat): require run support evidence"
```

### Task 3: Produce and Build Toma v4

**Files:**

- Create: `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v4.png`
- Create: `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png`
- Create: `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json`
- Create: `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.png`
- Create: `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v4.json`
- Create: `apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json`
- Modify: `assets/heroes/visuals/realtime-combat-study-v1/PROVENANCE.md`

**Interfaces:**

- Consumes: Toma v3 source, Toma's accepted identity reference, and action authority
  `classical-human-run-5`.
- Produces: a complete v4 source sheet whose row 2 is a new five-frame run and whose other rows are
  preserved, plus the existing 5-by-4, 256-pixel-cell runtime atlas contract.

- [ ] **Step 1: Read and fill the animation clip brief**

Use `summonlab-character-animations` and `imagegen`. Record the accepted v3 source and identity image
with SHA-256 values, the exact five beats, support sequence, equipment locks, three-quarter up-field
camera, white matte, runtime geometry, output paths, and candidate status before generation.

- [ ] **Step 2: Generate the five-frame run as one temporal strip**

Use Toma's v3 sheet and accepted identity art as image references. The prompt must explicitly require
all five full-body poses in one horizontal strip:

```text
left contact; left compression; compact airborne passing pose with neither foot planted;
unmistakable right-foot contact; right-foot recovery preparing the left-foot loop return
```

Lock his gray topknot, beard, stocky adult proportions, navy-and-teal armor, left-arm bronze shield,
right-hand mace, camera, lighting, scale, ground line, cell clearance, and painterly 2.5D finish.
Forbid shadows, scenery, text, mirroring, equipment swaps, hidden feet, duplicate poses, and extra
limbs.

- [ ] **Step 3: Inspect and reject until the support sequence is visible**

Use source-resolution inspection. Each planted foot must be visible; frame 3 must show clear air
under both feet; frames 1 and 4 must be opposite contacts. Reject any strip that relies on prompt
intent rather than visible anatomy. Keep only the selected generated original and record its source
identifier and SHA-256.

- [ ] **Step 4: Assemble v4 without changing unrelated rows**

Run:

```bash
node tools/compose-realtime-combat-motion-rows.mjs \
  --base assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v3.png \
  --out assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png \
  --replace 1:assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-run-strip-source-v4.png
```

Compare rows 1, 3, and 4 of v3 and v4 after extraction and require identical SHA-256 values.

- [ ] **Step 5: Build the v4 runtime atlas**

Run:

```bash
node tools/build-realtime-combat-motion-pack.mjs \
  --actor iron-guardian \
  --input assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png \
  --out-dir apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian \
  --version 4
```

Expected: v4 PNG, atlas JSON, and manifest JSON are created without modifying v1-v3.

- [ ] **Step 6: Write support evidence from the selected cells**

Hash each assembled source run cell independently and create:

Serialize the evidence with this construction after computing `computedCellHashes` from the five
source cells in playback order:

```js
JSON.stringify({
	version: 4,
	actorId: 'iron-guardian',
	clip: 'advance',
	actionAuthority: 'classical-human-run-5',
	support: ['left', 'left', 'none', 'right', 'right'],
	cellSha256: computedCellHashes,
	status: 'candidate'
});
```

Require five distinct 64-character lowercase hashes before writing the file.

- [ ] **Step 7: Validate the built artifact**

Run:

```bash
node tools/validate-realtime-combat-motion-pack.mjs \
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json \
  --max-advance-ground-artifact-pixels 500 \
  --advance-support-evidence assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json
```

Expected: valid v4 result, five unique run cells, correct action authority, correct support sequence,
and no baked ground ellipse.

- [ ] **Step 8: Record complete provenance**

Append Toma v4's accepted source binding, identity binding, generated original identifier, exact
prompt, generation mode, selected-strip hash, v4 source/runtime hashes, row-preservation results,
support sequence, validator command/result, visual inspection result, and `candidate` status to
`PROVENANCE.md`.

- [ ] **Step 9: Commit the candidate pack**

```bash
git add assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian \
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian \
  assets/heroes/visuals/realtime-combat-study-v1/PROVENANCE.md
git commit -m "feat(combat): rebuild Toma run cycle"
```

### Task 4: Integrate and Playtest Toma v4

**Files:**

- Modify: `apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte`
- Modify: `apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts`

**Interfaces:**

- Consumes: `iron-guardian-motion-v4.json` with the unchanged motion-manifest interface.
- Produces: the combat route loading Toma v4 and reporting `iron-guardian:4` in its diagnostic
  motion-pack versions.

- [ ] **Step 1: Update the failing browser expectation first**

Change the E2E expected version string to:

```text
asha:2,iron-guardian:4,moss-archer:2,rat-brute:1,lesser-rat:2
```

- [ ] **Step 2: Run the focused E2E test and verify failure**

Run the route's focused Playwright test against the existing server configuration. Expected: FAIL
because the stage still reports Toma v3.

- [ ] **Step 3: Point the stage at v4**

Update only the Toma motion JSON URL and diagnostic version string from 3 to 4. Do not change clip
FPS, registration offsets, shadows, or simulation state.

- [ ] **Step 4: Run focused automated checks**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/actor-animator.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts
pnpm --filter @summonlab/web typecheck
```

Run the focused realtime-combat Playwright test. Expected: all focused checks pass.

- [ ] **Step 5: Inspect real playback**

Start or reuse a server bound to `0.0.0.0:5173`. At
`/living-village-lab/realtime-combat`, replay the encounter in 2D, 2.5D, and 2.5D V2. Watch at least
three uninterrupted Toma run loops in each mode and transition idle → run → attack. Confirm visible
left/right alternation, no one-legged skating, stable feet, unchanged shield/mace handedness, no
baked shadow, and no regression in scale or health-bar clearance.

- [ ] **Step 6: Commit the runtime integration**

```bash
git add apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte \
  apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
git commit -m "fix(combat): activate Toma run v4"
```

### Task 5: Final Verification and Delivery

**Files:**

- Modify only files already in scope if verification exposes a defect.

**Interfaces:**

- Consumes: completed skill, validator, asset, and runtime commits.
- Produces: pushed branch with a clean working tree and an owner-facing playtest checkpoint.

- [ ] **Step 1: Run the complete focused verification suite**

```bash
node --test tools/validate-character-animation-skills.spec.mjs
node tools/validate-character-animation-skills.mjs
node --test tools/validate-realtime-combat-motion-pack.spec.mjs
node tools/validate-realtime-combat-motion-pack.mjs \
  apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json \
  --max-advance-ground-artifact-pixels 500 \
  --advance-support-evidence assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json
pnpm --filter @summonlab/web typecheck
pnpm exec prettier --check \
  skills/summonlab-character-action-creation \
  skills/summonlab-character-animations \
  tools/validate-character-animation-skills.mjs \
  tools/validate-character-animation-skills.spec.mjs \
  tools/validate-realtime-combat-motion-pack.mjs \
  tools/validate-realtime-combat-motion-pack.spec.mjs \
  assets/heroes/visuals/realtime-combat-study-v1/PROVENANCE.md \
  apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte \
  apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
git diff --check
```

Expected: every focused check passes.

- [ ] **Step 2: Run broad repository checks and classify unrelated baselines**

Run `pnpm test` and `pnpm lint`. If they fail, verify whether each failure reproduces on the parent
commit. Fix in-scope regressions; report unrelated pre-existing failures precisely without editing
unrelated systems.

- [ ] **Step 3: Inspect the final diff and working tree**

Run:

```bash
git status --short
git diff HEAD~4 --check
git log -5 --oneline
```

Verify there are no unrelated edits, temporary generated files, copied third-party references, or
uncommitted in-scope changes.

- [ ] **Step 4: Push the branch**

```bash
git push origin codex/realtime-combat-study
```

- [ ] **Step 5: Deliver the playtest checkpoint**

Report all commit hashes and subjects, push destination, working-tree cleanliness, focused and broad
verification results, the exact preview URL, and candidate status. Ask the owner to watch Toma enter
combat in all three modes and decide whether the opposite-foot contact, airborne beat, and heavy
equipment lag now read correctly.
