# Summonlab Wiki

Wiki ID: `wiki.root`

The Summonlab Wiki is the joint rulebook, world bible, subsystem index, and visual art book for the
game. It is designed to be both the **input** and **output** of a work session:

```text
accepted wiki text + linked mechanics + visual brief
                         │
                         ▼
               agent or human work session
                         │
                         ▼
candidate rules · prose · images · code · evidence
                         │
                         ▼
reviewed wiki update + artifact links + implementation status
```

The game should match accepted wiki behavior. The wiki, executable content, asset catalogs, and
replay evidence make that claim verifiable rather than aspirational.

## Browse

- [Game systems](systems/README.md) — every vertical subsystem and horizontal capability.
- [Playable milestones](milestones/README.md) — integration slices beginning with the reduced
  [Living Village](milestones/living-village.md) loop.
- [Release roadmap](roadmap/README.md) — the explicit `on`, `off`, `placeholder`, and `decision`
  matrix that selects from the complete wiki without deleting deferred design.
- [Website and online wiki roadmap](roadmap/wiki-website.md) — one SvelteKit platform for the game,
  public art-book wiki, in-game compendium, and Vercel deployment.
- [Progression](mechanics/progression/README.md), [skills](mechanics/skills/README.md), and
  [equipment](mechanics/equipment/README.md) — complete supplied design drafts plus runtime scope.
- [Rewards and engagement](mechanics/rewards-and-engagement.md) — benefits, daily return, mission
  rewards, special access, and the ownership boundary for claims.
- [Attributes](mechanics/attributes.md) — the shared mechanical vocabulary behind capability.
- [Affinities](mechanics/affinities/README.md) — hero/monster affinities, attribute expression, and
  typed effects.
- [Creature taxonomy](creatures/taxonomy.md) — family, race/species, archetype, variant, and faction.
- [Monster database](creatures/monsters/README.md) — 38 families, 190 canonical T1–T5 forms, 950
  Normal/Fire/Earth/Wind/Water coordinates, including the approved fauna runtime set.
- [Fauna family expansion](creatures/fauna-family-expansion.md) — eight accepted expedition
  families and 40 T1–T5 forms; all 200 images are approved and wired to the wiki runtime, while the
  original 750 images remain untouched.
- [Monster families](creatures/monster-races/README.md) — the growing textual bestiary.
- [Monster visual gallery](art/monster-gallery.md) — current review plates and their actual status.
- [Skill rarity frames](art/skill-rarity-frames.md) — the accepted F–S material and ornament
  grammar for hexagonal skill displays.
- [Living Village hero packet](art/living-village-heroes.md) — the fixed Dara, Mara, Jori, Kira,
  Iven, and Remy roster, with bounded derivative work and no additional prototype faces.
- [Hero identity and evolution art](art/hero-identity-and-evolution.md) — the accepted stochastic
  production workflow for physical variation, capability cues, wardrobe, aptitudes, and 1★–7★
  identity continuity beyond the fixed prototype roster.
- [Every person can contribute](principles/every-person-contributes.md) — the dignity, opportunity,
  and social-system principle behind heroes.
- [Contribution workflow](contributing.md) — how sessions consume and return wiki material.
- [Supplied-draft ingestion record](sources/2026-08-29-design-drafts.md) — hashes, destinations,
  completeness evidence, and unresolved convergence decisions.

For engineering ownership and dependency boundaries, use the
[shared system architecture](../system-architecture/README.md). For the complete implemented
history, use [implementation progress](../progress.md) and the [ADR directory](../decisions/).

## Status is multidimensional

A page never hides several kinds of readiness behind one “done” label:

| Axis           | Values                                                | Meaning                                                                                                     |
| -------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Design         | `seed`, `draft`, `accepted`, `approved`, `superseded` | Whether rules, lore, or presentation design are proposed, canonical, explicitly review-approved, or retired |
| Implementation | `none`, `partial`, `implemented`, `verified`          | Whether game behavior exists and matches                                                                    |
| Visual         | `none`, `brief`, `candidate`, `approved`, `runtime`   | Whether visual instantiation exists and is promoted                                                         |
| Spoiler        | `public`, `discoverable`, `internal`                  | Which audience may receive the page or section                                                              |

The checked [catalog](catalog.json) records these axes for every page. `pnpm validate:wiki` rejects
unregistered pages, duplicate IDs, invalid status values, missing local links, and missing registered
assets.

Design `approved` records explicit approval of the page's rules, information architecture, or
interaction design; it does not approve the page's media. `visualStatus` is a separate promotion
axis, so an approved page design may intentionally continue to present `candidate` visuals until
their provenance and human visual review are complete.

Release availability is a separate axis owned by the [roadmap](roadmap/README.md). A complete,
accepted mechanic may still be `off` in Living Village; that means it remains available for future
planning and art production but must be unreachable in that release.

## Canon and discovery

Formal rules do not require the player to begin with perfect knowledge. The same corpus can produce:

- a public rulebook for controls and disclosed mechanics;
- a discoverable compendium populated by encounters, research, and testimony;
- an internal design view containing spoilers, formulas, generation briefs, and implementation
  evidence.

The engine owns what a particular hero or player has discovered. Wiki spoiler scope controls what
may be presented; it never grants in-game knowledge.

## Visual rule

Wiki pages embed images from domain asset catalogs; they do not duplicate the bytes. Every visual
must declare whether it is a brief, candidate, approved source, or runtime asset. A beautiful image
is not canon merely because it was generated. Promotion still requires identity/content binding,
provenance, human review, and the relevant runtime validation.

The gallery contains the repository's monster-family plates, while the
[monster database](creatures/monsters/README.md) publishes 190 canonical form pages and 950
production coordinates. The earlier forty classes are reconciled separately: fifteen map into
canonical forms, while twenty-five remain bridge-only secondary roles. Their old images remain
candidate-only references and are not automatic canonical anchors.

The generator bestiary's thirty source families remain taxonomy-aware draft briefs even though
their five-form production identities are now consolidated. Visual production does not silently
turn a family label into accepted biology, culture, morality, or runtime content.

## Online presentation

The repository-backed Markdown is the source, not the final ceiling for presentation. The first
game-styled `/wiki` renderer is now implemented in the existing SvelteKit application:

1. **Authoring wiki:** checked pages, catalogs, templates, assets, and evidence in the repository.
2. **Art-book web view:** a responsive `/wiki` surface; the shell, searchable catalog navigation,
   first galleries, statuses, and all catalog routes exist, while richer templates, backlinks, and
   spoiler controls continue through the [website roadmap](roadmap/wiki-website.md).
3. **In-game compendium:** the same accepted public/discoverable content filtered by what the run has
   actually revealed.
4. **Public export:** an optional spoiler-safe website built from the same IDs and asset bindings.

These views should render the catalog rather than fork its prose or copy its images. The art-book
surface becomes its own reviewable implementation slice after the wiki taxonomy and page contract
survive real content iteration.
