# 0064 — The game site hosts the wiki

**Status:** Accepted

**Date:** 2026-08-29

## Context

The wiki is intended for players, designers, artists, and implementation workers. Repository
Markdown is the right authoring source but not an adequate public experience. A separate wiki
application would duplicate navigation, visual language, deployment, analytics, content IDs, and
eventual player-discovery state.

## Decision

- The existing SvelteKit product is the shared website and playable platform.
- `/` remains the game/landing entry and `/wiki` is the public art-book rulebook.
- Wiki routes render the checked repository Markdown and catalog directly during the web build.
  They do not maintain a second prose copy.
- Domain assets remain in their owning catalogs and are bundled into the web presentation at build
  time.
- The wiki uses Summonlab's Hearth, tower, typography, color, and identity language while preserving
  accessible text, responsive navigation, honest statuses, and spoiler boundaries.
- The application uses the supported Vercel adapter so one repository deployment can host the game
  and wiki on one domain.

## Consequences

Every currently registered public/discoverable wiki page can become an online route immediately.
Later work can add search indexes, backlinks, status filters, compendium discovery, and game-state
gating without migrating content to another CMS. Deployments must validate wiki links and assets
before publishing, and internal-spoiler pages must never enter public navigation by accident.
