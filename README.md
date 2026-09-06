<div align="center">

<img src="assets/agent-summoning-concept.png" alt="A summoner watches an autonomous agent hero emerge through a gate surrounded by possible actions" width="100%">

# Summonlab

**A hero-summoning game where every hero is an autonomous agent.**

</div>

Summon heroes, build a home around them, prepare parties, and climb a randomized
one-hundred-floor tower. Heroes develop through experience, relationships, habits, training, and
the systems the player creates around them.

## What defines the game

- **Heroes have agency.** They interpret directions and choose from legal actions; only the
  deterministic engine changes game state.
- **The settlement stays alive.** Heroes work, train, socialize, and form routines between
  expeditions, even when the player is not directing each moment.
- **Leadership is the core skill.** The player shapes facilities, schedules, parties, incentives,
  and culture instead of controlling every hero directly.
- **Every person can contribute.** Starting talent and combat strength do not define a hero's
  worth; combat, craft, research, care, and leadership are all paths to mastery.

## Run locally

Requires Node `24.14.1` and pnpm `10.33.0`.

```sh
pnpm install
pnpm dev:app
```

Open `http://localhost:5173`. This lightweight mode does not require Docker; database-backed
features report PostgreSQL as unavailable.

For the complete local stack, including PostgreSQL and migrations, run `pnpm dev`. This command
uses Docker.

## Useful commands

```sh
pnpm dev       # web, worker, and local PostgreSQL
pnpm dev:app   # web and worker without PostgreSQL
pnpm check     # full repository validation
pnpm test:e2e  # browser tests
pnpm db:stop   # stop local PostgreSQL
```

## Deploy

The SvelteKit application and public wiki target Vercel through the repository's configured Vercel
adapter. Point the Vercel project at the repository root and build with:

```sh
pnpm --filter @summonlab/web build
```

A full persistent deployment also needs a hosted PostgreSQL database supplied through
`DATABASE_URL` and the standalone `apps/worker` process on an always-on Node host.

## Project guide

- `apps/web` — SvelteKit game client, server endpoints, and public wiki
- `apps/worker` — background decisions, catch-up simulation, and job processing
- `packages` — engine, contracts, persistence, policies, and shared libraries
- `docs/wiki` — canonical game rules, world material, and visual catalog
- `docs/system-architecture` — ownership boundaries and integration contracts
- `docs/evidence` — reproducible implementation proofs
- `assets` — source and runtime visual assets
- `tools` — validation, export, and production workflows

## Documentation

- [Game wiki](docs/wiki/README.md)
- [System architecture](docs/system-architecture/README.md)
- [Release roadmap](docs/wiki/roadmap/README.md)
- [Implementation progress](docs/progress.md)
- [Web application](apps/web/README.md)
