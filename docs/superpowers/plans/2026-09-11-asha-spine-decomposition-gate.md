# Asha Spine Decomposition Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and review one identity-bound, three-layer Asha decomposition candidate at the owner-selected 84 px exploration scale without rigging, animating, promoting, or changing the approved source artwork.

**Architecture:** A strict brief locks the approved source, one 2×2 provider board, output ownership, and a maximum of one correction. A deterministic Sharp materializer uses the provider board only for semantic mattes and hidden-overlap repair: visible near-arm and braid pixels always come from the approved raster, and all source pixels outside the two mattes remain equal at decoded RGBA level. A review extension displays the layers, recomposition, and 84 px calibration without granting the candidate runtime or exploration authority.

**Tech Stack:** TypeScript 6, Node 24.14.1, Vitest 4, Sharp 0.35, SvelteKit 2, PixiJS 8.20.0, Playwright, the manifest-bound `summonlab-image-production` workflow, and the raster `imagegen` provider.

**Spec:** `docs/superpowers/specs/2026-09-10-asha-spine-exploration-canary-design.md`

## Global Constraints

- Work only on `codex/asha-spine-art-pipeline`; do not merge or copy Floor One implementation files.
- Treat `apps/web/static/runtime/combat/realtime-study-v1/hero-saffron-braid-ready-v1.png` at SHA-256 `9f6704c825a642c1664cc34573a2e2264a9d3d2f0cf85c5f65ee6c09f4bb5a2b` as immutable.
- Preserve Asha's right shaved temple and marking, left braid, saffron-and-cream costume, adult proportions, palette, up-field presentation, orientation, and bottom-center feet anchor.
- Use 84 px visible character height as the configurable exploration default. Keep 72 px and 96 px as calibration evidence.
- The first provider call is the initial candidate. At most one targeted correction call is allowed.
- Never overwrite a provider result, candidate part, receipt, or review artifact. A correction uses `v2` sibling paths.
- No Blender, CSS/SVG/canvas character drawing, manual `.spine` editing, rig, mesh, weights, IK, physics, animation, mirroring, alternate direction, runtime promotion, or production navigation.
- Generated imagery remains `candidate`. Technical checks cannot approve artwork.
- If decomposition fails after one correction, record `failed` and stop before Gate 3.
- Keep `Spine/`, activation material, provider credentials, launcher settings, and license identity ignored and out of logs, manifests, commits, and evidence.

## File and ownership map

- `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/brief.json` — immutable authority, prompt, attempt ceiling, layer semantics, protected regions, and owned paths.
- `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/provider/board-v1.png` — exact first provider return; `board-v2.png` exists only after an owner-requested correction.
- `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/parts/vN/*.png` — normalized 768×768 `body-core`, `near-arm`, and `braid` layers.
- `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/recomposed/asha-setup-vN.png` — deterministic setup-pose recomposition, never a replacement for the approved cutout.
- `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/results/result-vN.json` — prompt, provider return path/hash, output hashes, reconstructed regions, measurements, and disposition.
- `tools/asha-spine-decomposition-lib.ts` — strict schema, secure preflight, board normalization, matte validation, materialization, and result validation.
- `tools/asha-spine-decomposition.ts` — `preflight`, `materialize`, and `check` CLI only.
- `tools/asha-spine-decomposition-lib.spec.ts` — unit and adversarial tests using geometric fixtures, never player-facing stand-in art.
- `tools/tsconfig.asha-spine-decomposition.json` — isolated TypeScript surface.
- `apps/web/src/lib/components/living-village/spine-canary/asha-spine-decomposition.ts` — candidate asset paths and 84 px configuration.
- `apps/web/src/lib/components/living-village/spine-canary/AshaSpineDecompositionReview.svelte` — raster-only source/layer/recomposition review.
- `apps/web/src/routes/living-village-lab/asha-spine-transport/+page.svelte` — mounts Gate 2 below the unchanged Gate 1 calibration.
- `docs/evidence/asha-spine-decomposition/desktop-vN.png` and `mobile-vN.png` — browser evidence for the reviewable candidate.

---

### Task 1: Lock authority and collision-safe preflight

**Files:**

- Create: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/brief.json`
- Create: `tools/asha-spine-decomposition-lib.ts`
- Create: `tools/asha-spine-decomposition-lib.spec.ts`
- Create: `tools/asha-spine-decomposition.ts`
- Create: `tools/tsconfig.asha-spine-decomposition.json`
- Modify: `package.json`

**Interfaces:**

- Consumes: the approved source path/hash and Gate 1 source canvas/feet anchor.
- Produces: `AshaSpineDecompositionBrief`, `loadDecompositionBrief(path)`, `resolveDecompositionPaths(brief, workspaceRoot, version)`, and `preflightDecomposition(brief, workspaceRoot, mode, version, io?)`.

- [ ] **Step 1: Write failing strict-schema and preflight tests**

Prove unknown keys fail, version 3 fails, changed source hashes fail, symlinked sources fail, non-RGBA or non-768×768 sources fail, an occupied owned path fails in `write` mode, and every required artifact must exist in `check` mode. Use an injected IO fixture rather than copying Asha.

```ts
describe('Asha Spine decomposition preflight', () => {
	it('rejects changed authority before checking outputs', async () => {
		const brief = decompositionBriefFixture({
			acceptedCutoutSha256: '0'.repeat(64)
		});
		await expect(
			preflightDecomposition(brief, '/workspace', 'write', 1, decompositionIoFixture())
		).rejects.toThrow('accepted cutout hash mismatch');
	});

	it('refuses every occupied v1 output before production starts', async () => {
		const io = decompositionIoFixture({
			existing: new Set(['/workspace/assets/canary/provider/board-v1.png'])
		});
		await expect(
			preflightDecomposition(decompositionBriefFixture(), '/workspace', 'write', 1, io)
		).rejects.toThrow('owned output already exists');
	});
});
```

- [ ] **Step 2: Run the focused test and observe the red state**

Run:

```bash
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run tools/asha-spine-decomposition-lib.spec.ts
```

Expected: FAIL because the decomposition module does not exist.

- [ ] **Step 3: Create the strict brief**

Write this authority exactly. The prompt is committed before generation so the receipt can hash exact bytes rather than reconstructing a prompt from logs.

```json
{
  "schemaVersion": "asha-spine-decomposition-brief-v1",
  "status": "planned",
  "acceptedCutout": "apps/web/static/runtime/combat/realtime-study-v1/hero-saffron-braid-ready-v1.png",
  "acceptedCutoutSha256": "9f6704c825a642c1664cc34573a2e2264a9d3d2f0cf85c5f65ee6c09f4bb5a2b",
  "identitySource": "assets/heroes/visuals/realtime-combat-study-v1/saffron-braid-source-v1.png",
  "identitySourceSha256": "3cc917c4b0b15bfce012bb2fcdbf01d1cb4977871fdc222b4db3afd32120fa77",
  "sourceCanvas": { "width": 768, "height": 768 },
  "feetAnchor": { "x": 384, "y": 738 },
  "direction": "up-field",
  "mirrored": false,
  "defaultVisibleHeight": 84,
  "attemptPolicy": { "initial": 1, "corrections": 1, "maximumVersion": 2 },
  "providerBoard": {
    "layout": "quadrants-v1",
    "minimumSquareSize": 1024,
    "panels": ["body-core-repair", "near-arm-matte", "braid-matte", "setup-preview"]
  },
  "protectedRegions": {
    "faceAndMarking": { "left": 314, "top": 91, "width": 157, "height": 181 },
    "feetAndAnchor": { "left": 218, "top": 554, "width": 359, "height": 214 }
  },
  "partEnvelopes": {
    "nearArm": { "left": 421, "top": 183, "width": 137, "height": 306 },
    "braid": { "left": 156, "top": 0, "width": 305, "height": 515 }
  },
  "initialPrompt": "Edit only the supplied Asha raster into a strict square 2-by-2 technical decomposition board on transparency. Every quadrant uses the identical full-body framing, scale, orientation, and bottom-center feet registration as the reference. Top-left: Asha's otherwise complete setup-pose body/core with the image-right foreground arm and the long image-left braid removed; reconstruct only the shoulder, clothing, head hair, and silhouette pixels hidden behind those two pieces. Top-right: only an opaque white semantic matte for the complete image-right foreground arm from shoulder overlap through fist, at its original coordinates; everything else transparent. Bottom-left: only an opaque white semantic matte for the complete long image-left braid and its head overlap, at its original coordinates; do not include face, eyebrow, eye, ear, temple marking, torso, or robe. Bottom-right: a registration preview of the three pieces recomposed into the original setup pose. Preserve Asha's face, shaved right temple and marking, left braid, saffron-and-cream costume, adult proportions, palette, lighting, up-field presentation, and anatomy. No labels, dividers, borders, background, shadow, alternate pose, mirroring, extra anatomy, equipment, redesign, or crop.",
  "outputs": {
    "root": "assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1",
    "reviewRoot": "docs/evidence/asha-spine-decomposition"
  }
}
```

- [ ] **Step 4: Implement secure schema and path handling**

Use strict Zod objects and repository-contained paths. Read both authority images with `O_NOFOLLOW`
on Linux and verify both SHA-256 values. Require 768×768 RGBA only for the accepted cutout being
decomposed; the immutable normal-proportion identity portrait is hash-locked at its native
1024×1536 RGB format.

```ts
export type DecompositionMode = 'write' | 'check';
export type DecompositionVersion = 1 | 2;
export type AshaSpineDecompositionBrief = z.infer<typeof decompositionBriefSchema>;

export type DecompositionPaths = Readonly<{
	providerBoard: string;
	bodyCore: string;
	nearArm: string;
	braid: string;
	recomposed: string;
	result: string;
}>;

export async function loadDecompositionBrief(
	path: string
): Promise<AshaSpineDecompositionBrief>;

export function resolveDecompositionPaths(
	brief: AshaSpineDecompositionBrief,
	workspaceRoot: string,
	version: DecompositionVersion
): DecompositionPaths;

export async function preflightDecomposition(
	brief: AshaSpineDecompositionBrief,
	workspaceRoot: string,
	mode: DecompositionMode,
	version: DecompositionVersion,
	io?: DecompositionPreflightIO
): Promise<DecompositionPaths>;
```

Resolve outputs as `provider/board-vN.png`, `parts/vN/body-core.png`, `parts/vN/near-arm.png`, `parts/vN/braid.png`, `recomposed/asha-setup-vN.png`, and `results/result-vN.json`. Reject version 2 unless v1 exists with disposition `revise`.
In `check` mode, a `failed` receipt requires the provider board and receipt but forbids part and
recomposition outputs; a `candidate` or `revise` receipt requires all six outputs.

- [ ] **Step 5: Add isolated commands and typecheck configuration**

Add these root scripts:

```json
"preflight:asha-spine-decomposition": "tsx tools/asha-spine-decomposition.ts preflight",
"validate:asha-spine-decomposition": "tsx tools/asha-spine-decomposition.ts check",
"test:asha-spine-decomposition": "vitest run tools/asha-spine-decomposition-lib.spec.ts",
"typecheck:asha-spine-decomposition": "tsc -p tools/tsconfig.asha-spine-decomposition.json"
```

The tsconfig includes only the decomposition library, CLI, and spec and extends `tsconfig.base.json`.

- [ ] **Step 6: Run tests and typecheck**

```bash
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm test:asha-spine-decomposition
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm typecheck:asha-spine-decomposition
```

Expected: all focused tests pass and TypeScript exits zero.

- [ ] **Step 7: Commit**

```bash
git add package.json tools/asha-spine-decomposition-lib.ts tools/asha-spine-decomposition-lib.spec.ts tools/asha-spine-decomposition.ts tools/tsconfig.asha-spine-decomposition.json assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/brief.json
git commit -m "feat(art): guard Asha Spine decomposition"
```

---

### Task 2: Materialize exact-source layers and bounded repair

**Files:**

- Modify: `tools/asha-spine-decomposition-lib.ts`
- Modify: `tools/asha-spine-decomposition-lib.spec.ts`
- Modify: `tools/asha-spine-decomposition.ts`

**Interfaces:**

- Consumes: a validated brief and one absolute provider-return path.
- Produces: `normalizeProviderBoard`, `extractDecompositionPanels`, `materializeDecompositionCandidate`, `measureDecompositionCandidate`, and `validateDecompositionCandidate`.

- [ ] **Step 1: Write failing normalization and preservation tests**

Generate a 16×16 RGBA fixture in memory with Sharp. Its 2×2 board has a colored repair quadrant and two one-channel mattes. Assert that visible parts use original RGB, body/core matches the original outside the matte union, recomposition matches outside the local repair envelope, protected regions reject mattes, and changing one byte invalidates the receipt.

```ts
it('uses provider alpha for semantics and approved RGB for visible parts', async () => {
	const result = await materializeDecompositionCandidate(fixtureInput);
	expect(result.measurements.visiblePartSourceMismatchPixels).toBe(0);
	expect(result.measurements.bodyOutsideMatteMismatchPixels).toBe(0);
	expect(result.measurements.recompositionOutsideRepairMismatchPixels).toBe(0);
});

it('rejects a matte entering a protected region', async () => {
	await expect(materializeDecompositionCandidate(protectedFaceFixture)).rejects.toThrow(
		'near-arm matte intersects protected faceAndMarking region'
	);
});
```

- [ ] **Step 2: Run the focused test and observe the red state**

```bash
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run tools/asha-spine-decomposition-lib.spec.ts
```

Expected: FAIL because materialization exports are absent.

- [ ] **Step 3: Normalize and split the provider board**

Require square RGBA input, minimum 1024×1024, and even dimensions. Split it into four equal quadrants in row-major order and resize each to 768×768 with Lanczos3.

```ts
export type DecompositionPanels = Readonly<{
	bodyCoreRepair: Buffer;
	nearArmMatte: Buffer;
	braidMatte: Buffer;
	setupPreview: Buffer;
}>;
```

Convert matte alpha to one-channel masks. Reject empty mattes, pixels outside their named `partEnvelopes`, near-arm pixels inside `faceAndMarking`, either matte inside `feetAndAnchor`, and overlap greater than 64 decoded pixels between mattes. Never consume RGB from the matte quadrants.

- [ ] **Step 4: Create source-aligned parts**

Use the masks to select pixels from the immutable cutout. `near-arm.png` and `braid.png` are 768×768 RGBA canvases containing source pixels only under their mattes. Build `body-core.png` from the source: clear the matte union, then composite `bodyCoreRepair` only under that union. Provider pixels outside the union are always discarded.

Create `asha-setup-vN.png` by compositing body/core, braid, then near arm. Preserve the 768×768 canvas and feet anchor. Write to a temporary sibling directory, validate all buffers, then atomically rename into absent final paths. On error, remove staging and leave final outputs absent.

- [ ] **Step 5: Emit a deterministic receipt**

```ts
export type AshaSpineDecompositionResult = Readonly<{
	schemaVersion: 'asha-spine-decomposition-result-v1';
	version: DecompositionVersion;
	disposition: 'candidate' | 'revise' | 'failed';
	prompt: string;
	promptSha256: string;
	provider: Readonly<{
		mode: 'edit';
		returnedSourcePath: string;
		boardPath: string;
		boardSha256: string;
	}>;
	outputs: Readonly<Record<
		'bodyCore' | 'nearArm' | 'braid' | 'recomposed',
		{ path: string; sha256: string; width: 768; height: 768 }
	>>;
	reconstructedRegions: readonly ['near-arm overlap', 'braid/head overlap'];
	measurements: Readonly<{
		visiblePartSourceMismatchPixels: 0;
		bodyOutsideMatteMismatchPixels: 0;
		recompositionOutsideRepairMismatchPixels: 0;
		nearArmMattePixels: number;
		braidMattePixels: number;
	}>;
}>;
```

Stable-serialize with sorted keys and trailing newline. Redact the home username in the provider return path to `$PROVIDER_OUTPUT_ROOT/...`, while retaining the repository board path and raw hash.

A failed receipt keeps the same authority, prompt, and provider fields but sets `outputs` and
`measurements` to `null`, sets `reconstructedRegions` to `[]`, and records
`failure: { stage: 'provider-board' | 'decomposition', reason: string }`. In that state the raw board
and receipt are required and every part/recomposition path is forbidden.

- [ ] **Step 6: Extend the CLI**

Support only:

```text
asha-spine-decomposition.ts preflight --version 1
asha-spine-decomposition.ts materialize --version 1 --provider-output "$PROVIDER_OUTPUT_PATH"
asha-spine-decomposition.ts check --version 1
```

The CLI never invokes a provider, accepts a relative provider path, overwrites output, infers a new prompt, or advances v2 without a v1 `revise` receipt.

- [ ] **Step 7: Verify and commit**

```bash
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm test:asha-spine-decomposition
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm typecheck:asha-spine-decomposition
git diff --check
git add tools/asha-spine-decomposition-lib.ts tools/asha-spine-decomposition-lib.spec.ts tools/asha-spine-decomposition.ts
git commit -m "feat(art): materialize Asha decomposition layers"
```

---

### Task 3: Produce exactly one initial candidate

**Files:**

- Generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/provider/board-v1.png`
- Generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/parts/v1/body-core.png`
- Generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/parts/v1/near-arm.png`
- Generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/parts/v1/braid.png`
- Generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/recomposed/asha-setup-v1.png`
- Generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/results/result-v1.json`

**Interfaces:**

- Consumes: a green preflight and the exact `initialPrompt` from the brief.
- Produces: one collision-safe v1 `candidate`, `revise`, or `failed` receipt; never approved art.

- [ ] **Step 1: Read production instructions**

At execution time, read `summonlab-image-production/SKILL.md` and `imagegen/SKILL.md` completely, including directly required references. Use the former for manifest-bound persistence and the latter for one source-referenced raster edit. Do not use Blender or manually paint anatomy.

- [ ] **Step 2: Prove preflight before provider access**

```bash
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm preflight:asha-spine-decomposition -- --version 1
```

Expected: source/hash/alpha checks pass and all six v1 outputs are absent.

- [ ] **Step 3: Make one source-bound edit call**

Call the raster editor with only the immutable accepted cutout as the referenced image and the exact `initialPrompt` loaded from `brief.json`. Do not paraphrase, add references, or request variants. Persist the returned path immediately.

- [ ] **Step 4: Materialize once**

```bash
npx --yes node@24.14.1 node_modules/tsx/dist/cli.mjs tools/asha-spine-decomposition.ts materialize --version 1 --provider-output "$PROVIDER_OUTPUT_PATH"
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm validate:asha-spine-decomposition -- --version 1
```

Set `PROVIDER_OUTPUT_PATH` to the exact absolute path returned in Step 3 for this command only; it is
a runtime value, never committed into a script. If the board is non-square, too small, opaque,
missing a quadrant, or violates an envelope/protected region, persist the raw board and a `failed`
receipt without parts. Do not silently retry.

- [ ] **Step 5: Inspect every raster at original resolution**

Inspect source, board, all three parts, and recomposition for face/marking identity, braid side, missing or duplicate anatomy, shoulder/head reconstruction, alpha halos, clipped edges, costume/palette/silhouette drift, and feet registration.

A single local defect yields `revise` and one exact defect sentence. Multiple identity defects, broad redraw, or unusable layout yields `failed`. Otherwise retain `candidate`. Do not produce v2 during this task.

- [ ] **Step 6: Commit immutable v1 evidence**

```bash
git add assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1
git commit -m "feat(art): produce Asha decomposition candidate"
```

---

### Task 4: Add the 84 px decomposition review

**Files:**

- Create: `apps/web/src/lib/components/living-village/spine-canary/asha-spine-decomposition.ts`
- Create: `apps/web/src/lib/components/living-village/spine-canary/asha-spine-decomposition.spec.ts`
- Create: `apps/web/src/lib/components/living-village/spine-canary/AshaSpineDecompositionReview.svelte`
- Modify: `apps/web/src/lib/components/living-village/spine-canary/AshaSpineTransportStage.svelte`
- Modify: `apps/web/src/routes/living-village-lab/asha-spine-transport/+page.svelte`
- Modify: `apps/web/src/routes/living-village-lab/asha-spine-transport/asha-spine-transport.e2e.ts`
- Create: `docs/evidence/asha-spine-decomposition/desktop-v1.png`
- Create: `docs/evidence/asha-spine-decomposition/mobile-v1.png`

**Interfaces:**

- Consumes: checked v1 result and raster outputs; a failed result shows a named failure state instead of parts.
- Produces: `ASHA_EXPLORATION_VISIBLE_HEIGHT = 84`, `decompositionAssets(version)`, and a review panel with no production state.

- [ ] **Step 1: Write failing configuration and browser tests**

```ts
import { describe, expect, it } from 'vitest';
import {
	ASHA_EXPLORATION_VISIBLE_HEIGHT,
	decompositionAssets
} from './asha-spine-decomposition.js';

describe('Asha decomposition review configuration', () => {
	it('keeps the owner-selected scale configurable at 84 px', () => {
		expect(ASHA_EXPLORATION_VISIBLE_HEIGHT).toBe(84);
		expect(decompositionAssets(1).recomposed).toEndWith('asha-setup-v1.png');
	});
});
```

Extend Playwright to assert `data-testid="asha-selected-scale"` contains `84 px`, each candidate image has `naturalWidth === 768`, the 84 px overlay is visible, reduced motion keeps the review visible, and route teardown produces no page error.

- [ ] **Step 2: Run the focused test and observe the red state**

```bash
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm --dir apps/web test -- src/lib/components/living-village/spine-canary/asha-spine-decomposition.spec.ts
```

Expected: FAIL because the configuration module does not exist.

- [ ] **Step 3: Implement a raster-only layer review**

Use approved/candidate `<img>` assets only. Show immutable source, body/core on checkerboard, near arm on checkerboard, braid on checkerboard, recomposition, and a source/recomposition toggle.

Below source-resolution views, place the recomposed candidate at exactly 84 px visible height over the existing 62 px diamond tile. Label it `Owner-selected default · configurable`. Keep the 72/84/96 Gate 1 comparison but style 84 as selected and export the shared constant instead of repeating the literal.

Read the result through a build-owned module or page data; never fetch arbitrary filesystem paths in the browser. Missing or failed outputs show a labeled non-character failure state.

- [ ] **Step 4: Run unit, Svelte, and browser checks**

```bash
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm --dir apps/web test -- src/lib/components/living-village/spine-canary/asha-spine-decomposition.spec.ts
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm --dir apps/web typecheck
PLAYWRIGHT_PORT=42792 npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm --dir apps/web test:e2e -- src/routes/living-village-lab/asha-spine-transport/asha-spine-transport.e2e.ts
```

Expected: unit tests pass, Svelte reports zero errors/warnings, and browser tests pass. If port 42792 is occupied, verify a free high port and record it.

- [ ] **Step 5: Capture and inspect evidence**

Serve from `apps/web`:

```bash
npx --yes node@24.14.1 node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port 5174
```

Capture 1440×1000 and 390×844 screenshots. Inspect both for clipping, opaque rectangles, label overlap, missing parts, wrong 84 px scale, and mobile overflow.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/components/living-village/spine-canary apps/web/src/routes/living-village-lab/asha-spine-transport docs/evidence/asha-spine-decomposition
git commit -m "feat(web): review Asha decomposition at 84px"
```

---

### Task 5: Apply the correction ceiling and close Gate 2

**Files:**

- Optional generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/provider/board-v2.png`
- Optional generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/parts/v2/*.png`
- Optional generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/recomposed/asha-setup-v2.png`
- Optional generate: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/results/result-v2.json`
- Create: `assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/GATE.md`
- Modify: `assets/heroes/visuals/spine-exploration-canary-v1/transport/README.md`

**Interfaces:**

- Consumes: owner feedback on v1 and, only for `revise`, one named correction.
- Produces: a `pass` or `fail` Gate 2 record and an explicit boundary before any Gate 3 plan.

- [ ] **Step 1: Stop for owner review**

Provide the remote route and ask for `accept`, one named local correction, or `reject`. Do not infer acceptance from technical checks and do not create v2 or a rig.

- [ ] **Step 2: If authorized, make exactly one correction**

Run only when v1 is `revise` and the owner names one local defect. Read the same production skills, run v2 preflight, then make one editor call using the immutable source, v1 board, original prompt, and one appended correction sentence. Materialize and validate v2 through the same CLI. No third call is permitted.

- [ ] **Step 3: Write the disposition**

For acceptance:

```markdown
# Asha Spine decomposition Gate 2

Disposition: **pass**
Gameplay calibration: **84 px visible height, configurable**
Accepted candidate for Gate 3 planning: **v1**
Art status: **candidate; not promoted to exploration runtime**
Scope completed: body/core, near arm, braid, setup-pose recomposition
Next authorization: owner approval before a minimum rigid-rig plan is written
```

Use v2 only if it was produced and accepted. For rejection or failed validation, record `Disposition: **fail**`, name the terminal defect, state that no candidate is accepted for Gate 3, and stop.

- [ ] **Step 4: Run final verification**

```bash
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm validate:asha-spine-transport
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm validate:asha-spine-decomposition -- --version 1
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm test:asha-spine-transport
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm test:asha-spine-decomposition
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm typecheck:asha-spine-decomposition
npx --yes -p node@24.14.1 -p pnpm@10.33.0 -- pnpm --dir apps/web typecheck
git diff --check
```

Also validate v2 when it exists. Report unrelated repository-suite failures separately; do not alter family-affinity approval seals in this gate.

- [ ] **Step 5: Commit and push**

```bash
git add assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/GATE.md assets/heroes/visuals/spine-exploration-canary-v1/transport/README.md
git commit -m "docs(art): record Asha decomposition gate"
git push origin codex/asha-spine-art-pipeline
```

Stop. Gate 3 requires a new plan and explicit owner authorization even when Gate 2 passes.
