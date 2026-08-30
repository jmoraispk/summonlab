# Summonlab website and online wiki roadmap

Wiki ID: `roadmap.wiki-website`

Design status: **accepted direction; first web slice implemented**

Summonlab should be one platform with two closely related entrances:

```text
summonlab address
├─ /       game landing, account/run entry, and playable client
└─ /wiki   public rulebook, art book, bestiary, roadmap, and compendium
```

The same SvelteKit application owns both. The wiki is not a separate Markdown viewer or unrelated
documentation theme; it should feel like entering the Hearth's archive from the game.

## Source and publishing pipeline

```text
docs/wiki Markdown + catalog.json + domain-owned image assets
                         │
                         ▼
             checked build-time wiki registry
                         │
                         ▼
        responsive /wiki pages + status + navigation
                         │
                         ▼
            Vercel preview → review → production
```

Repository Markdown remains the canonical prose. The web renderer resolves registered pages and
local image references during the build, so publishing does not fork text or copy an artist's
source files into a second hand-maintained catalog.

## W1 — Living archive shell

Status: **implemented for review**

- Game-styled `/wiki` landing page using the Hearth, hero, and monster visual language.
- Online routes for every public/discoverable catalog page.
- Responsive searchable index, source/status metadata, Markdown tables, code, links, and images.
- Art-book treatment for the fixed Living Village six with honest per-asset approval labels.
- One application and one domain, using the supported Vercel adapter.

Acceptance: open the wiki at desktop and phone widths, find Progression and the visual packet, and
confirm that a source Markdown edit appears online after a build without a copied content change.

## W2 — Beautiful rulebook and art book

- Full-text build index with ranked results, synonyms, and stable deep links.
- Generated table of contents, breadcrumbs, backlinks, related entries, and next/previous reading.
- Status and spoiler controls that distinguish draft, accepted, implemented, verified, candidate,
  approved, and runtime.
- Gallery layouts, comparison views, zoom, captions, provenance, and approval history.
- Dedicated templates for monsters, affinities, skills, equipment, characters, systems, and release
  matrices rather than one generic article presentation.
- Social previews, structured metadata, sitemap, canonical URLs, and strong loading/accessibility
  budgets.

Acceptance: a player can browse the bestiary as an art book, while a worker can identify the exact
source, status, dependencies, and missing artifacts for the same entry.

## W3 — Wiki and game convergence

- The in-game compendium consumes the same accepted page IDs and asset bindings.
- Discovery state controls which `discoverable` entries and spoiler sections a run reveals.
- Hero, monster, skill, equipment, floor, and reward UI deep-link to the matching entry.
- Runtime evidence and balance versions flow back to implementation-status panels.
- Public rules remain readable without a game account; run-specific knowledge never leaks into the
  canonical public view.

Acceptance: encountering a monster unlocks the same entry used by artists and designers, filtered
to the player's evidence rather than copied into separate compendium prose.

## W4 — Production platform

- Connect the repository to Vercel with the repository root as the project root and the web package
  build as the deployment target.
- Configure the production address, preview deployments, required game/database environment values,
  cache behavior, analytics consent, and monitoring.
- Gate production promotion on `pnpm validate:wiki`, web typecheck/tests/build, link checks, visual
  budgets, and phone review.
- Add editorial preview for draft/accepted changes and a spoiler-safe public export policy.

Vercel documents first-class SvelteKit support and recommends installing the Vercel adapter
explicitly for version stability: [SvelteKit on Vercel](https://vercel.com/docs/frameworks/full-stack/sveltekit).

## Near-term visual production lanes

The online wiki lets several art lanes proceed without expanding Living Village runtime:

1. finish cross-surface packets for the fixed Dara, Mara, Jori, Kira, Iven, and Remy roster—no
   additional prototype faces;
2. three selected runtime monsters plus broader bestiary concept plates;
3. initial skill effects/icons, followed by disabled-skill concept work;
4. initial equipment icons and material language;
5. Hearth destinations, tower threshold, and combat backdrop.

Every lane returns candidates to its wiki entry. An integration owner alone promotes reviewed bytes
to approved/runtime status.

## Decisions needed from the owner

- Which existing address and subdomain/path should become production?
- Should `/` initially remain the current playable title screen, or become a broader marketing page
  with **Play** and **Wiki** entrances?
- Which three monster races should receive the first runtime-grade visual packets?
- Should draft design pages be public with visible labels, or available only on preview deployments?
