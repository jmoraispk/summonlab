# Summonlab web

SvelteKit client and authoritative server endpoints for the local Summonlab playtest. Run it from the repository root with `pnpm dev`, or without starting PostgreSQL with `pnpm dev:app`.

Phase 0 routes:

- `/` — typed runtime health shell;
- `/health` — structured health JSON;
- `/design-reference` — preserved original interactive prototype.

The browser renders projections and submits commands. It never owns game state, entropy, policy keys, or simulation time.
