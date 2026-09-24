# Asha Spine transport canary

Status: **candidate / transport-only**

## Gate 1 disposition

**Pass.** Spine 4.3.26 import/export and Spine Pixi 4.3.13 playback are technically validated.
The art remains candidate / transport-only: this gate generated no new Asha pixels and does not
approve a production animation. Owner review is required before a Gate 2 decomposition plan is
written.

Owner review on 2026-09-11 selected **84 px visible character height** as the balanced,
configurable exploration default and authorized Gate 2 planning.

This canary proves the Spine editor-to-runtime transport path with Asha's existing approved raster
cutout. `idle_transport_probe` is a deliberately tiny technical motion test, not Asha's production
idle, and none of these files author or approve new character artwork.

## Immutable inputs

- Canonical identity source: `assets/heroes/visuals/realtime-combat-study-v1/saffron-braid-source-v1.png`
  (`3cc917c4b0b15bfce012bb2fcdbf01d1cb4977871fdc222b4db3afd32120fa77`)
- Accepted transport cutout: `apps/web/static/runtime/combat/realtime-study-v1/hero-saffron-braid-ready-v1.png`
  (`9f6704c825a642c1664cc34573a2e2264a9d3d2f0cf85c5f65ee6c09f4bb5a2b`)
- Existing comparison motion sheet: `assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/asha/asha-motion-sheet-source-v2.png`
  (`3a8ebfd62479c95aec94b934e5cebb24770ad9bea019b96f7388d5bdd0e4902f`)

The accepted cutout is copied pixel-for-pixel onto a transparent 1024×1024 transport canvas. The
tool rejects changed hashes, symlinks, unexpected image dimensions, occupied output paths, root
motion, horizontal mirroring, meshes, draw-order timelines, and missing atlas regions.

## Generated output hashes

| Output | SHA-256 |
| --- | --- |
| `images/asha-transport-v1.png` | `23aef2acecbe1beef60c4bb44b43b90d7c26778904aefd97e006ddc850941898` |
| `asha-transport-import-v1.json` | `3410bab1d5c97c7675f39346d0744cdc011b6bcf8f46167eae9909af296f0a35` |
| `asha-transport-v1.spine` | `40324be399d9aaf7b6ad70479d5fcf68efd2be5c8b711e47364b89b974deb28b` |
| Runtime `asha-transport-v1.json` | `382f4357f9deb027af92feebe684534ad791e72d8b1cd60cd85c9dc5b1270750` |
| Runtime `asha-transport-v1.atlas` | `99d361ece14586a302148afc72bbb02cfe5f1e22128314ab48343c5a08e2a8d0` |
| Runtime `asha-transport-v1.png` | `22ac47911d8b0323deffecaef04a55ebf015c7f52a494c241cc1a4dbbaca88f6` |

## Reproduce and validate

The pinned toolchain is Spine Professional 4.3.26, Spine Pixi 4.3.13, PixiJS 8.20.0, and Node
24.14.1. The local `Spine/` installation and activation data remain ignored and untracked.

```bash
./Spine/Spine.sh --hide-license --activated
npx --yes node@24.14.1 node_modules/tsx/dist/cli.mjs tools/asha-spine-transport.ts --check
```

`--write` is intentionally one-shot and refuses to overwrite this version's outputs. To reproduce
from a clean checkout where those owned outputs are absent:

```bash
npx --yes node@24.14.1 node_modules/tsx/dist/cli.mjs tools/asha-spine-transport.ts --write
```

Once the web review route is available, run it with:

```bash
cd apps/web
npx --yes node@24.14.1 node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port 5174
```

Review `/living-village-lab/asha-spine-transport`. Floor One remains on a separate branch; this
canary has no exploration state and is not linked from Village or Tower production navigation.
