# Summonlab web

SvelteKit client and authoritative server endpoints for the local Summonlab playtest. Run it from the repository root with `pnpm dev`, or without starting PostgreSQL with `pnpm dev:app`.

The same application is also the public documentation platform:

- `/wiki` — game-styled rulebook and art-book landing page;
- `/wiki/art/living-village-heroes` — the current hero visual packet;
- `/wiki/<catalog path>` — every public/discoverable repository wiki page, rendered from its
  canonical Markdown during the build.

The web package uses the Vercel adapter. A Vercel project can point at the repository root and run
the normal workspace install plus `pnpm --filter @summonlab/web build`; game routes still require
their documented environment/database configuration.

Phase 0 routes:

- `/` — typed runtime health shell;
- `/health` — structured health JSON;
- `/design-reference` — preserved original interactive prototype.

The browser renders projections and submits commands. It never owns game state, entropy, policy keys, or simulation time.
