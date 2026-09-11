# Asha Spine Transport Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Prove the complete Spine 4.3.26 → Spine Pixi 4.3.13 → PixiJS 8.20 transport chain with
Asha's unmodified approved cutout before generating or decomposing any new character artwork.

**Architecture:** A manifest-bound CLI validates immutable sources, creates one mechanically padded
transport image and deterministic Spine import JSON, invokes the locally installed editor, and
validates its exported JSON/atlas/PNG. An isolated SvelteKit route loads those validated exports with
the official Spine Pixi runtime and exposes a deliberately non-production animation probe. This plan
implements only Gates 0–1 of the design; Gate 2 artwork decomposition gets its own plan after this
transport gate passes.

**Tech Stack:** TypeScript 6, Node 24.14.1, Vitest 4, Sharp 0.35, Spine Professional 4.3.26,
`@esotericsoftware/spine-pixi-v8` 4.3.13, PixiJS 8.20.0, SvelteKit 2, Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-09-10-asha-spine-exploration-canary-design.md` (Gates 0–1)

## Global Constraints

- The canonical identity source hash is
  `3cc917c4b0b15bfce012bb2fcdbf01d1cb4977871fdc222b4db3afd32120fa77`.
- The accepted transport cutout hash is
  `9f6704c825a642c1664cc34573a2e2264a9d3d2f0cf85c5f65ee6c09f4bb5a2b`.
- The existing Asha motion sheet hash is
  `3a8ebfd62479c95aec94b934e5cebb24770ad9bea019b96f7388d5bdd0e4902f`.
- Never overwrite, regenerate, or promote any of those three inputs.
- Pin the editor to `4.3.26`, the runtime to `4.3.13`, and PixiJS to `8.20.0`.
- Run repository JavaScript validation with Node `24.14.1`; the system `/usr/bin/node` is currently
  version 18 and is outside the repository engine contract.
- Keep `Spine/`, `Spine.tar.gz`, launcher settings, activation data, and license identity untracked
  and absent from logs.
- New outputs are versioned and collision-safe. `--write` fails when an owned output exists;
  `--check` validates tracked outputs without rewriting them.
- Use Asha's approved raster cutout. Never replace her with CSS, SVG, canvas geometry, emoji, text, or
  procedural character art.
- One authored up-field orientation only; never mirror Asha.
- The probe is not an approved idle and must always be labeled `idle_transport_probe`.

---

## File map

- `assets/heroes/visuals/spine-exploration-canary-v1/transport/manifest.json`: immutable authority,
  version, source, output, anchor, and probe contract.
- `assets/heroes/visuals/spine-exploration-canary-v1/transport/README.md`: candidate status and exact
  reproduction/review commands.
- `assets/heroes/visuals/spine-exploration-canary-v1/transport/images/asha-transport-v1.png`: exact
  source pixels mechanically placed on a padded transparent canvas.
- `assets/heroes/visuals/spine-exploration-canary-v1/transport/asha-transport-import-v1.json`:
  deterministic Spine 4.3.26 import data.
- `assets/heroes/visuals/spine-exploration-canary-v1/transport/asha-transport-v1.spine`: imported
  project product; never edited manually.
- `apps/web/static/runtime/exploration/spine-canary-v1/asha/`: exported runtime JSON, atlas, and PNG.
- `tools/asha-spine-transport-lib.ts`: manifest parsing, source validation, deterministic generation,
  editor command construction, and export validation.
- `tools/asha-spine-transport-lib.spec.ts`: pure and filesystem-level contract tests.
- `tools/asha-spine-transport.ts`: thin `--write`/`--check` command.
- `tools/tsconfig.asha-spine-transport.json`: isolated tool typecheck.
- `apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.ts`: asset aliases,
  Spine construction, animation selection, and instance-local state.
- `apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.spec.ts`: runtime
  binding tests without WebGL.
- `apps/web/src/lib/components/living-village/spine-canary/AshaSpineTransportStage.svelte`: isolated
  Pixi lifecycle and calibration presentation.
- `apps/web/src/routes/living-village-lab/asha-spine-transport/+page.svelte`: owner review page.
- `apps/web/src/routes/living-village-lab/asha-spine-transport/asha-spine-transport.e2e.ts`: browser
  loading, playback, scale, reduced-motion, and teardown evidence.

---

### Task 1: Define the immutable transport contract and preflight

**Files:**

- Create: `assets/heroes/visuals/spine-exploration-canary-v1/transport/manifest.json`
- Create: `tools/asha-spine-transport-lib.ts`
- Create: `tools/asha-spine-transport-lib.spec.ts`
- Create: `tools/tsconfig.asha-spine-transport.json`
- Modify: `package.json`

**Interfaces:**

- Consumes: repository root and the three authority files listed in Global Constraints.
- Produces: `AshaSpineTransportManifest`, `loadTransportManifest(path)`,
  `preflightTransport(manifest, workspaceRoot, mode)`, and `TransportPaths`.

- [ ] **Step 1: Write failing manifest and preflight tests**

Add tests that pin the literal contract and prove source mismatch and output collisions stop before a
write callback can run:

```ts
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  defaultTransportPreflightIO,
  loadTransportManifest,
  preflightTransport
} from './asha-spine-transport-lib.js';

const manifestPath =
  'assets/heroes/visuals/spine-exploration-canary-v1/transport/manifest.json';

describe('Asha Spine transport preflight', () => {
  it('pins the owned sources and 4.3 toolchain', async () => {
    const manifest = await loadTransportManifest(manifestPath);
    expect(manifest).toMatchObject({
      schemaVersion: 'asha-spine-transport-v1',
      editorVersion: '4.3.26',
      runtimeVersion: '4.3.13',
      pixiVersion: '8.20.0',
      direction: 'up-field',
      mirrored: false,
      animation: { name: 'idle_transport_probe', durationSeconds: 1 }
    });
  });

  it('rejects a changed authority hash before invoking a writer', async () => {
    const exists = vi.fn(defaultTransportPreflightIO.exists);
    await expect(
      preflightTransport(
        { ...(await loadTransportManifest(manifestPath)), acceptedCutoutSha256: '0'.repeat(64) },
        process.cwd(),
        'write',
        { ...defaultTransportPreflightIO, exists }
      )
    ).rejects.toThrow('accepted transport cutout hash mismatch');
    expect(exists).not.toHaveBeenCalled();
  });

  it('rejects an existing owned output in write mode', async () => {
    const manifest = await loadTransportManifest(manifestPath);
    const occupied = resolve(process.cwd(), manifest.outputs.image);
    const exists = vi.fn(async (path: string) => path === occupied);
    await expect(
      preflightTransport(manifest, process.cwd(), 'write', {
        ...defaultTransportPreflightIO,
        exists
      })
    ).rejects.toThrow('owned output already exists');
  });
});
```

- [ ] **Step 2: Run the focused test with the repository Node version**

Run:

```bash
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run tools/asha-spine-transport-lib.spec.ts
```

Expected: FAIL because `asha-spine-transport-lib.ts` and its manifest do not exist.

- [ ] **Step 3: Add the exact v1 manifest**

Create the manifest with these literal values:

```json
{
  "schemaVersion": "asha-spine-transport-v1",
  "status": "candidate",
  "editorVersion": "4.3.26",
  "runtimeVersion": "4.3.13",
  "pixiVersion": "8.20.0",
  "direction": "up-field",
  "mirrored": false,
  "identitySource": "assets/heroes/visuals/realtime-combat-study-v1/saffron-braid-source-v1.png",
  "identitySourceSha256": "3cc917c4b0b15bfce012bb2fcdbf01d1cb4977871fdc222b4db3afd32120fa77",
  "acceptedCutout": "apps/web/static/runtime/combat/realtime-study-v1/hero-saffron-braid-ready-v1.png",
  "acceptedCutoutSha256": "9f6704c825a642c1664cc34573a2e2264a9d3d2f0cf85c5f65ee6c09f4bb5a2b",
  "comparisonMotionSheet": "assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/asha/asha-motion-sheet-source-v2.png",
  "comparisonMotionSheetSha256": "3a8ebfd62479c95aec94b934e5cebb24770ad9bea019b96f7388d5bdd0e4902f",
  "sourceCanvas": { "width": 768, "height": 768 },
  "transportCanvas": { "width": 1024, "height": 1024, "left": 128, "top": 128 },
  "feetAnchor": { "sourceX": 384, "sourceY": 738, "normalizedX": 0.5, "normalizedY": 0.845703125 },
  "animation": { "name": "idle_transport_probe", "durationSeconds": 1, "loop": true },
  "outputs": {
    "image": "assets/heroes/visuals/spine-exploration-canary-v1/transport/images/asha-transport-v1.png",
    "importJson": "assets/heroes/visuals/spine-exploration-canary-v1/transport/asha-transport-import-v1.json",
    "project": "assets/heroes/visuals/spine-exploration-canary-v1/transport/asha-transport-v1.spine",
    "runtimeDirectory": "apps/web/static/runtime/exploration/spine-canary-v1/asha"
  }
}
```

- [ ] **Step 4: Implement strict loading and preflight**

Use Zod to reject unknown keys, `crypto.createHash('sha256')` for all three inputs, Sharp metadata to
require the accepted cutout to be 768×768 RGBA, `fs.lstat` to reject symbolic-link inputs, and
`fs.constants.O_NOFOLLOW` when opening them on Linux. `preflightTransport(..., 'write')` checks every
owned output before invoking the optional callback; `check` requires every output instead.

Export these exact types:

```ts
export type TransportMode = 'write' | 'check';
export type TransportPaths = Readonly<{
  image: string;
  importJson: string;
  project: string;
  runtimeDirectory: string;
}>;

export async function loadTransportManifest(path: string): Promise<AshaSpineTransportManifest>;
export type TransportPreflightIO = Readonly<{
  exists: (path: string) => Promise<boolean>;
  lstat: typeof import('node:fs/promises').lstat;
  readFile: typeof import('node:fs/promises').readFile;
  metadata: (path: string) => Promise<Readonly<{
    width?: number;
    height?: number;
    channels?: number;
  }>>;
}>;
export const defaultTransportPreflightIO: TransportPreflightIO;
export async function preflightTransport(
  manifest: AshaSpineTransportManifest,
  workspaceRoot: string,
  mode: TransportMode,
  io?: TransportPreflightIO
): Promise<TransportPaths>;
```

- [ ] **Step 5: Add isolated scripts and typecheck configuration**

Add root scripts:

```json
"build:asha-spine-transport": "tsx tools/asha-spine-transport.ts --write",
"validate:asha-spine-transport": "tsx tools/asha-spine-transport.ts --check",
"test:asha-spine-transport": "vitest run tools/asha-spine-transport-lib.spec.ts",
"typecheck:asha-spine-transport": "tsc -p tools/tsconfig.asha-spine-transport.json"
```

The tool tsconfig includes only the library, CLI, and spec and extends `tsconfig.base.json`.

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run tools/asha-spine-transport-lib.spec.ts
npx --yes node@24.14.1 node_modules/typescript/bin/tsc -p tools/tsconfig.asha-spine-transport.json
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add package.json tools/asha-spine-transport-lib.ts tools/asha-spine-transport-lib.spec.ts tools/tsconfig.asha-spine-transport.json assets/heroes/visuals/spine-exploration-canary-v1/transport/manifest.json
git commit -m "feat(art): guard Asha Spine transport inputs"
```

---

### Task 2: Generate and round-trip the transport project

**Files:**

- Modify: `tools/asha-spine-transport-lib.ts`
- Modify: `tools/asha-spine-transport-lib.spec.ts`
- Create: `tools/asha-spine-transport.ts`
- Create: `assets/heroes/visuals/spine-exploration-canary-v1/transport/README.md`
- Generate: `assets/heroes/visuals/spine-exploration-canary-v1/transport/images/asha-transport-v1.png`
- Generate: `assets/heroes/visuals/spine-exploration-canary-v1/transport/asha-transport-import-v1.json`
- Generate: `assets/heroes/visuals/spine-exploration-canary-v1/transport/asha-transport-v1.spine`
- Generate: `apps/web/static/runtime/exploration/spine-canary-v1/asha/*`

**Interfaces:**

- Consumes: validated `AshaSpineTransportManifest` and `TransportPaths` from Task 1.
- Produces: `resolveTransportPaths`, `buildTransportImage`, `extractedPixelHash`,
  `buildTransportImport`, `spineTransportCommands`, `validateTransportExport`, and CLI
  `--write`/`--check`.

- [ ] **Step 1: Add failing deterministic-generation tests**

```ts
import { afterAll, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const manifest = await loadTransportManifest(manifestPath);
const paths = resolveTransportPaths(manifest, process.cwd());
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'asha-spine-transport-test.'));
afterAll(() => rm(temporaryDirectory, { recursive: true, force: true }));

it('pads the approved cutout without changing a source pixel', async () => {
  const output = await buildTransportImage(manifest, process.cwd(), temporaryDirectory);
  expect(output).toMatchObject({ width: 1024, height: 1024, left: 128, top: 128 });
  expect(await extractedPixelHash(output.path, 128, 128, 768, 768)).toBe(
    await extractedPixelHash(resolve(process.cwd(), manifest.acceptedCutout), 0, 0, 768, 768)
  );
});

it('creates a one-slot import with no root translation keys', () => {
  const data = buildTransportImport(manifest);
  expect(data.bones.map((bone) => bone.name)).toEqual(['root', 'body']);
  expect(data.slots).toEqual([{ name: 'body', bone: 'body', attachment: 'asha_transport' }]);
  expect(data.animations.idle_transport_probe.bones.root).toBeUndefined();
  expect(data.animations.idle_transport_probe.bones.body.rotate).toEqual([
    { value: 0 },
    { time: 0.5, value: 0.35 },
    { time: 1, value: 0 }
  ]);
});

it('pins every Spine invocation to 4.3.26 and hides the license identity', () => {
  expect(spineTransportCommands('/workspace/Spine/Spine.sh', manifest, paths)).toEqual([
    expect.arrayContaining(['--hide-license', '--update', '4.3.26', '--import']),
    expect.arrayContaining(['--hide-license', '--update', '4.3.26', '--export', 'json+pack'])
  ]);
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run tools/asha-spine-transport-lib.spec.ts
```

Expected: FAIL because the generation exports are absent.

- [ ] **Step 3: Implement mechanical padding and import JSON**

`buildTransportImage` uses Sharp `extend({ top: 128, bottom: 128, left: 128, right: 128 })` with a
fully transparent background. It reads from the already-opened validated source and writes the owned
path using exclusive creation. Compare the raw RGBA bytes in the 768×768 embedded region to the raw
source bytes; do not compare PNG container hashes after re-encoding.

`buildTransportImport` emits this structure through `JSON.stringify(data, null, 2) + '\n'`:

```ts
{
  skeleton: {
    hash: 'asha-spine-transport-v1',
    spine: '4.3.26',
    x: -512,
    y: -158,
    width: 1024,
    height: 1024,
    images: './images/'
  },
  bones: [{ name: 'root' }, { name: 'body', parent: 'root' }],
  slots: [{ name: 'body', bone: 'body', attachment: 'asha_transport' }],
  skins: [{
    name: 'default',
    attachments: {
      body: {
        asha_transport: { path: 'asha-transport-v1', y: 354, width: 1024, height: 1024 }
      }
    }
  }],
  animations: {
    idle_transport_probe: {
      bones: {
        body: { rotate: [{ value: 0 }, { time: 0.5, value: 0.35 }, { time: 1, value: 0 }] }
      }
    }
  }
}
```

The body-region center is 354 Spine units above the established source feet anchor
`(384, 738)`, after both are shifted by the same 128-pixel padding. The root stays at `(0, 0)`.

- [ ] **Step 4: Implement editor execution and semantic validation**

Resolve Spine from `SUMMONLAB_SPINE_CLI` or `<workspace>/Spine/Spine.sh`; reject any path outside the
workspace and never print launcher settings. Use `spawn` with an argument array, inherited stdin
disabled, stdout/stderr captured, and exit-code enforcement.

Run these two logical commands:

```text
Spine.sh --hide-license --update 4.3.26 --input <import-json> --output <project> --import asha_transport_v1
Spine.sh --hide-license --update 4.3.26 --input <project> --output <runtime-directory> --export json+pack
```

Redact any line beginning with `Licensed to:` before persisting or printing output. Require exactly
one `.json`, one `.atlas`, and one `.png` in the fresh runtime directory. Normalize their filenames to
`asha-transport-v1.json`, `asha-transport-v1.atlas`, and `asha-transport-v1.png` using exclusive
renames in the same directory, then update the atlas page line to `asha-transport-v1.png` if Spine's
default project basename differs.

`validateTransportExport` asserts:

- exported `skeleton.spine === '4.3.26'`;
- bones are exactly `root`, `body` in that order;
- slot `body` resolves attachment `asha_transport`;
- only `idle_transport_probe` exists and its duration is 1 second;
- body rotation keys round-trip as `0`, `0.35`, `0` at `0`, `0.5`, `1`;
- no root timeline, negative `scaleX`, draw-order timeline, mesh, or missing region exists;
- atlas has one page no larger than 2048×2048 and one `asha-transport-v1` region; and
- PNG metadata is RGBA and no larger than 2048×2048.

- [ ] **Step 5: Implement the CLI and README**

The CLI accepts exactly one mode:

```ts
const mode = process.argv[2];
if (mode !== '--write' && mode !== '--check') {
  throw new Error('Usage: tsx tools/asha-spine-transport.ts --write|--check');
}
await runAshaSpineTransport({
  workspaceRoot: process.cwd(),
  mode: mode === '--write' ? 'write' : 'check'
});
```

The README labels the output `candidate / transport-only`, names the immutable sources, records the
three input hashes and generated output hashes, explains that the probe is not production motion, and
provides the exact `--check` and review-route commands.

- [ ] **Step 6: Run the actual headless transport gate**

Run:

```bash
./Spine/Spine.sh --hide-license --activated
npx --yes node@24.14.1 node_modules/tsx/dist/cli.mjs tools/asha-spine-transport.ts --write
npx --yes node@24.14.1 node_modules/tsx/dist/cli.mjs tools/asha-spine-transport.ts --check
```

Expected: activation says `Activated`; write imports and exports with Spine 4.3.26; check reports
three matching authority hashes and a valid one-region transport export. The known graphics warning
is allowed; `Licensed to:` must not appear in captured artifacts.

- [ ] **Step 7: Re-run unit tests and typecheck**

```bash
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run tools/asha-spine-transport-lib.spec.ts
npx --yes node@24.14.1 node_modules/typescript/bin/tsc -p tools/tsconfig.asha-spine-transport.json
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add tools/asha-spine-transport-lib.ts tools/asha-spine-transport-lib.spec.ts tools/asha-spine-transport.ts assets/heroes/visuals/spine-exploration-canary-v1/transport apps/web/static/runtime/exploration/spine-canary-v1/asha
git commit -m "feat(art): prove Asha Spine transport export"
```

---

### Task 3: Pin and characterize the official Spine Pixi runtime

**Files:**

- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.ts`
- Create: `apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.spec.ts`

**Interfaces:**

- Consumes: validated runtime files from Task 2.
- Produces: `ASHA_SPINE_TRANSPORT_ASSETS`, `loadAshaSpineTransport`,
  `createAshaSpineTransportInstance`, and `destroyAshaSpineTransportAssets`.

- [ ] **Step 1: Install the exact 4.3 runtime without lifecycle scripts**

```bash
npx --yes pnpm@10.33.0 add --filter @summonlab/web --save-exact --ignore-scripts @esotericsoftware/spine-pixi-v8@4.3.13
```

Verify `apps/web/package.json` contains exact version `4.3.13` and `pixi.js` remains `8.20.0`.

- [ ] **Step 2: Write failing binding and instance-isolation tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  ASHA_SPINE_TRANSPORT_ASSETS,
  createAshaSpineTransportInstance,
  loadAshaSpineTransport
} from './asha-spine-transport';

class FakeSpine {
  readonly state = {
    current: undefined as string | undefined,
    setAnimation: (_track: number, name: string) => {
      this.state.current = name;
    }
  };

  constructor(readonly options: Readonly<Record<string, unknown>>) {}
}

describe('Asha Spine transport runtime', () => {
  it('loads the data and atlas under stable aliases', async () => {
    const add = vi.fn();
    const load = vi.fn().mockResolvedValue([]);
    await loadAshaSpineTransport({ add, load });
    expect(add.mock.calls).toEqual([
      [{ alias: 'asha-spine-transport-data-v1', src: ASHA_SPINE_TRANSPORT_ASSETS.data }],
      [{ alias: 'asha-spine-transport-atlas-v1', src: ASHA_SPINE_TRANSPORT_ASSETS.atlas }]
    ]);
    expect(load).toHaveBeenCalledWith([
      'asha-spine-transport-data-v1',
      'asha-spine-transport-atlas-v1'
    ]);
  });

  it('creates independent playback state for each instance', () => {
    const first = createAshaSpineTransportInstance(FakeSpine);
    const second = createAshaSpineTransportInstance(FakeSpine);
    first.state.setAnimation(0, 'idle_transport_probe', true);
    expect(first.state).not.toBe(second.state);
    expect(second.state.current).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the focused runtime test**

```bash
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.spec.ts
```

Expected: FAIL because the binding module is absent.

- [ ] **Step 4: Implement the loader and factory**

Use the official 4.3 constructor API:

```ts
export const ASHA_SPINE_TRANSPORT_ASSETS = {
  data: '/runtime/exploration/spine-canary-v1/asha/asha-transport-v1.json',
  atlas: '/runtime/exploration/spine-canary-v1/asha/asha-transport-v1.atlas'
} as const;

export async function loadAshaSpineTransport(assets = Assets): Promise<void> {
  assets.add({ alias: 'asha-spine-transport-data-v1', src: ASHA_SPINE_TRANSPORT_ASSETS.data });
  assets.add({ alias: 'asha-spine-transport-atlas-v1', src: ASHA_SPINE_TRANSPORT_ASSETS.atlas });
  await assets.load(['asha-spine-transport-data-v1', 'asha-spine-transport-atlas-v1']);
}

export function createAshaSpineTransportInstance(SpineClass = Spine): Spine {
  return new SpineClass({
    skeleton: 'asha-spine-transport-data-v1',
    atlas: 'asha-spine-transport-atlas-v1',
    autoUpdate: true,
    allowMissingRegions: false
  });
}
```

`destroyAshaSpineTransportAssets` unloads data then atlas and tolerates a second call. It does not call
`Assets.reset()` or release unrelated global assets.

- [ ] **Step 5: Run focused tests and the web typecheck**

```bash
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.spec.ts
npx --yes node@24.14.1 apps/web/node_modules/svelte-check/bin/svelte-check --tsconfig apps/web/tsconfig.json
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.ts apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.spec.ts
git commit -m "feat(web): load pinned Asha Spine transport"
```

---

### Task 4: Build the isolated calibration and playback route

**Files:**

- Create: `apps/web/src/lib/components/living-village/spine-canary/AshaSpineTransportStage.svelte`
- Create: `apps/web/src/routes/living-village-lab/asha-spine-transport/+page.svelte`
- Create: `apps/web/src/routes/living-village-lab/asha-spine-transport/asha-spine-transport.e2e.ts`

**Interfaces:**

- Consumes: Task 3 loader/factory and Task 2 runtime assets.
- Produces: review route `/living-village-lab/asha-spine-transport` with source, 72 px, 84 px, and
  96 px calibration views and explicit lifecycle status.

- [ ] **Step 1: Write the failing browser test**

```ts
import { expect, test } from '@playwright/test';

test('loads the transport probe at three exploration scales', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/living-village-lab/asha-spine-transport');
  await expect(page.getByTestId('spine-transport-status')).toHaveText('ready');
  await expect(page.getByTestId('asha-spine-source')).toBeVisible();
  await expect(page.getByTestId('asha-spine-72')).toBeVisible();
  await expect(page.getByTestId('asha-spine-84')).toBeVisible();
  await expect(page.getByTestId('asha-spine-96')).toBeVisible();
  await page.waitForTimeout(1200);
  expect(errors).toEqual([]);
});

test('keeps reduced motion visible but pauses the probe', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/living-village-lab/asha-spine-transport');
  await expect(page.getByTestId('spine-transport-status')).toHaveText('ready');
  await expect(page.getByTestId('spine-transport-motion')).toHaveText('paused');
});
```

- [ ] **Step 2: Run the route test and confirm failure**

```bash
npx --yes node@24.14.1 apps/web/scripts/run-playwright.js apps/web/src/routes/living-village-lab/asha-spine-transport/asha-spine-transport.e2e.ts
```

Expected: FAIL with a 404 for the missing route.

- [ ] **Step 3: Implement a bounded Pixi lifecycle**

On mount, dynamically import Pixi and Spine runtime modules, create `Application`, load the two stable
aliases, and create four independent Spine instances. The source view fits a 512-pixel inspection
panel; calibration instances render at exact visible heights 72, 84, and 96 logical pixels over
62-pixel tile markers. Set each instance position from the same feet anchor and never use negative
`scale.x`.

For normal motion:

```ts
instance.state.setAnimation(0, 'idle_transport_probe', true);
```

For reduced motion, apply setup pose and leave track 0 empty. Expose `loading`, `ready`, `error`, and
`disposed` through `data-testid="spine-transport-status"`; expose `playing` or `paused` through
`data-testid="spine-transport-motion"`.

Unmount order is: mark disposed, disconnect `ResizeObserver`, stop the application, destroy Spine
instances, destroy application children, then unload only the two Asha aliases. A load resolving after
unmount must immediately release those assets and must not append a stage child.

- [ ] **Step 4: Implement the review page**

The route must state:

- `Candidate · transport-only`;
- `This is not Asha's production idle.`;
- editor `4.3.26`, runtime `4.3.13`, and Pixi `8.20.0`;
- feet anchor `(384, 738)` in the 768 source;
- the three 72/84/96 pixel scale labels; and
- that Floor One still uses a separate branch and no exploration state is present here.

Use `LabBackLink.svelte` for navigation. Do not add this route to Village or Tower production
navigation.

- [ ] **Step 5: Run unit, browser, type, lint, and build checks**

```bash
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run tools/asha-spine-transport-lib.spec.ts apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.spec.ts
npx --yes node@24.14.1 apps/web/node_modules/svelte-check/bin/svelte-check --tsconfig apps/web/tsconfig.json
npx --yes node@24.14.1 apps/web/node_modules/eslint/bin/eslint.js apps/web/src/lib/components/living-village/spine-canary apps/web/src/routes/living-village-lab/asha-spine-transport tools/asha-spine-transport-lib.ts tools/asha-spine-transport.ts
npx --yes node@24.14.1 apps/web/scripts/run-playwright.js apps/web/src/routes/living-village-lab/asha-spine-transport/asha-spine-transport.e2e.ts
npx --yes node@24.14.1 apps/web/node_modules/vite/bin/vite.js build apps/web
```

Expected: all commands PASS. The build must contain the review route and no server-side import of
`@esotericsoftware/spine-pixi-v8`.

- [ ] **Step 6: Capture and inspect evidence**

Run the development server on the required remote interface:

```bash
npx --yes node@24.14.1 apps/web/node_modules/vite/bin/vite.js dev apps/web --host 0.0.0.0 --port 5173
```

Open `http://10.110.24.218:5173/living-village-lab/asha-spine-transport`. Inspect source scale and
72/84/96 px panels, watch at least three one-second loops, and verify orientation, alpha, feet anchor,
probe reachability, and absence of clipping. Save desktop and 390×844 screenshots under
`docs/evidence/asha-spine-transport/` only when they contain no license identity or unrelated private
data.

- [ ] **Step 7: Commit Task 4**

```bash
git add apps/web/src/lib/components/living-village/spine-canary apps/web/src/routes/living-village-lab/asha-spine-transport docs/evidence/asha-spine-transport
git commit -m "feat(web): add Asha Spine transport review"
```

---

### Task 5: Close the transport gate without starting decomposition

**Files:**

- Modify: `assets/heroes/visuals/spine-exploration-canary-v1/transport/README.md`

**Interfaces:**

- Consumes: all Task 1–4 tests and visual evidence.
- Produces: a binary `pass` or `stop` Gate 1 record and an owner-review handoff.

- [ ] **Step 1: Run the complete Gate 1 verification set from a clean checkout state**

```bash
./Spine/Spine.sh --hide-license --activated
npx --yes node@24.14.1 node_modules/tsx/dist/cli.mjs tools/asha-spine-transport.ts --check
npx --yes node@24.14.1 node_modules/vitest/vitest.mjs run tools/asha-spine-transport-lib.spec.ts apps/web/src/lib/components/living-village/spine-canary/asha-spine-transport.spec.ts
npx --yes node@24.14.1 node_modules/typescript/bin/tsc -p tools/tsconfig.asha-spine-transport.json
npx --yes node@24.14.1 apps/web/node_modules/svelte-check/bin/svelte-check --tsconfig apps/web/tsconfig.json
npx --yes node@24.14.1 apps/web/scripts/run-playwright.js apps/web/src/routes/living-village-lab/asha-spine-transport/asha-spine-transport.e2e.ts
git diff --check
```

Expected: activation and every validation pass; no command outputs license identity.

- [ ] **Step 2: Record the exact disposition**

Append one of these exact records to the README:

```text
Gate 1 disposition: pass
Meaning: Spine 4.3.26 import/export and Spine Pixi 4.3.13 playback are technically validated.
Art status: candidate / transport-only; no new Asha pixels were generated.
Next authorization: owner review before a Gate 2 decomposition plan is written.
```

or, after any failed acceptance condition:

```text
Gate 1 disposition: stop
Meaning: the transport chain did not satisfy every acceptance condition.
Art status: unchanged; no Asha decomposition was attempted.
Next authorization: diagnose the named transport failure without starting Gate 2.
```

- [ ] **Step 3: Commit, push, and verify cleanliness**

```bash
git add assets/heroes/visuals/spine-exploration-canary-v1/transport/README.md
git commit -m "docs(art): record Asha Spine transport gate"
git push origin codex/asha-spine-art-pipeline
git status --short --branch
```

Expected: push succeeds and the working tree is clean.

- [ ] **Step 4: Request focused owner feedback**

Provide the remote review URL and ask the owner to judge only:

1. whether the unmodified Asha cutout loads with correct alpha and orientation;
2. which of 72, 84, or 96 px is the right starting exploration height; and
3. whether the tiny transport probe is acceptably subtle as technical evidence.

Do not ask for animation-art approval and do not begin Gate 2 in the same turn.
