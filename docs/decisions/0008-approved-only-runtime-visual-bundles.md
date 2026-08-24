# ADR 0008: Runtime visual bundles export approved sources only

Status: accepted on 2026-08-23.

## Context

The production PNGs are large review artifacts, not appropriate settlement or dialogue payloads.
Runtime compression must not overwrite those sources, obscure provenance, silently ship rejected
art, or force the client to load one maximum-resolution image for every camera tier.

PixiJS v8 recommends a manifest of named bundles and aliased assets that can be initialized once and
loaded lazily with `Assets.loadBundle`; see the official
[PixiJS manifest and bundle guide](https://pixijs.com/8.x/guides/components/assets/manifest). Sharp
removes metadata by default and exposes explicit WebP quality, effort, drawing preset, and smart
subsampling controls; see the official [Sharp output options](https://sharp.pixelplumbing.com/api-output/).

## Decision

- Static source-catalog status is the build gate. Only `approved` source assets receive runtime
  derivatives. Approval candidates and rejected sources are listed in the output manifest as
  deferred and never copied into `apps/web/static/runtime`.
- The source PNG remains untouched. Every derivative records source asset key, source SHA-256,
  identity manifest hashes, camera use, output dimensions, exact bytes, output SHA-256, encoder
  settings, and an individual byte ceiling.
- Runtime filenames contain the first twelve characters of their output SHA-256. Changes to source
  pixels or encoder output produce a new URL instead of poisoning a long-lived browser cache.
- `runtime-visual-exporter-v1` uses pinned Sharp `0.35.3`, metadata-stripped WebP, effort 6, the
  drawing preset, and smart chroma subsampling. The manifest records the actual Sharp, libvips, and
  WebP versions plus the exact PixiJS v8 dependency.
- Approved full-body anchors export separate summon, dialogue, and roster widths. Later approved
  roster groups, settlement previews, dialogue close-ups, and summon cards use role-specific
  profiles. Continuity sheets remain development references rather than runtime payloads.
- Every asset has a purpose-level ceiling; every hero bundle sums those ceilings. The first-load
  mobile visual budget remains 8,000,000 bytes, matching the plan's under-8-MB settlement target.
- `pnpm export:runtime-visuals` replaces only the validated
  `apps/web/static/runtime/<catalog-version>` output directory. `pnpm validate:runtime-visuals`
  re-encodes in memory and rejects byte drift, manifest drift, unexpected files, hash drift, Pixi
  projection drift, or any budget overrun.
- The browser proof initializes the checked-in PixiJS manifest and renders the approved summon
  texture by bundle alias. It does not use the source PNG URL as a fallback.
- A post-build budget check traverses Vite's actual import graph and stores gzip measurements. It
  rejects every budget overrun, exact visual-payload drift, and JavaScript evidence drift greater
  than 256 bytes. That narrow tolerance absorbs SvelteKit's build-version hash churn without hiding
  a material bundle change. The dev route reads the evidence at request time so its measured values
  cannot recursively alter the client bundle being measured.

## Consequences

The first approved Mara Vey anchor produces three WebP textures totaling 47,758 bytes, 97.3% below
its 1,801,226-byte source and 0.60% of the phone bundle budget. Five current approval candidates
remain deferred. New approved sources enter the same deterministic pipeline without hand-editing
client imports, while source review and runtime delivery remain separately auditable. The measured
initial shell is 36,787 gzip bytes; the fully loaded renderer inspector is 372,191 gzip bytes, with a
174,947-byte largest lazy chunk. Both remain below the 700,000-byte compressed JavaScript ceiling.
