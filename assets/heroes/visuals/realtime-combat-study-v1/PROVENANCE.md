# Realtime combat study v1 provenance

## Owned source

- `saffron-braid-source-v1.png`
- SHA-256: `3cc917c4b0b15bfce012bb2fcdbf01d1cb4977871fdc222b4db3afd32120fa77`
- Supplied by the project owner in the Codex task on 2026-09-03.
- The project owner explicitly authorized use of the complete character and derivative hero designs for this prototype.

The two gameplay recordings used for motion and camera study are reference-only and are not copied into the repository. No Last Asylum assets, packages, extracted data, or screenshots ship with this study.

## Generated derivatives

All generated images below were produced with the built-in Codex image generation tool on 2026-09-03. Generation originals remain in Codex-managed storage; gameplay-ready copies live under `apps/web/static/runtime/combat/realtime-study-v1/`.

### Asha / saffron-braid lead

- Generation original: `exec-7c12f314-cf62-4fa2-974d-cb2d89ba0be4.png`
- References: an earlier combat adaptation and `saffron-braid-source-v1.png` as the canonical owned identity/costume reference.
- Final prompt: preserve the adult Black woman's exact identity, RIGHT shaved temple and geometric marking, long heavy braid on HER LEFT, hoop earring, saffron hooded robe, cream trim, dark inner layer, woven sash, loose cream trousers, wraps, and boots; redraw as a dignified compact adult chibi about three heads tall, full body, planted unarmed stance facing diagonally up-right, steep three-quarter top-down mobile strategy camera, premium hand-painted near-3D rendering, cool dusk rim and warm saffron key, readable at 140px, clean transparent isolation, no scenery, UI, text, weapon, mirroring, infant proportions, or costume redesign.

### Toma / iron guardian

- Generation original: `exec-d7790946-0dd4-4466-9530-c177cc7bd4eb.png`
- Reference: Asha output for quality, camera, proportions, palette discipline, and lighting only.
- Final prompt: create an original stocky older East Asian male guardian with gray topknot and short beard, iron-blue and muted teal layered village armor, battered round shield and compact mace; approximately three heads tall, steep three-quarter top-down camera, facing diagonally up-left, premium hand-painted near-3D volume, adult dignity, full body, clean transparent isolation, no copied facial identity or costume elements.

### Nessa / moss archer

- Generation original: `exec-dfb78f06-5681-4829-9c72-9c74a107e9eb.png`
- Reference: Asha output for quality, camera, proportions, palette discipline, and lighting only.
- Final prompt: create an original agile adult light-brown-skinned female scout with cropped copper curls, a moss-green mantle, practical layered travel clothes, and recurved bow; approximately three heads tall, steep three-quarter top-down camera, facing diagonally up-right, premium hand-painted near-3D volume, full body, clean transparent isolation, no copied facial identity or costume elements.

## Runtime processing

The generator returned the isolated actors against a baked light checkerboard. `tools/key-checkerboard-background.mjs` converts connected neutral-light pixels to alpha, trims the subject, and places it on a transparent 768×768 runtime canvas. The generation originals remain unmodified outside the repository.
