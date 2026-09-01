# Four-Element Domain Tree Design

**Date:** 2026-09-01
**Status:** Approved design; awaiting written-spec review
**Scope:** Skill wiki domain navigation, Magical domain artwork, and Elemental migration cleanup

## Goal

Present the skill taxonomy as a collapsed three-domain tree and align Elemental magic with the accepted four-affinity model: Fire, Earth, Wind, and Water. Replace the five-symbol Magical domain image with a four-element version in the established visual language. Remove Metal from active and deferred skill ownership without inventing a Wind skill ladder.

Skill-card frames, rarity cues, level display, and individual skill visualization are explicitly deferred to a later design pass.

## Source state from `main`

The accepted affinity work on `main` already establishes Fire, Earth, Wind, and Water as the four active base affinities. Wood legacy Elemental rows are deleted. Fire, Water, and Earth retain published single-affinity ladders. Wind is active at the affinity layer but does not yet have published Elemental skill content.

The remaining inconsistency is the Metal legacy ladder: its 18 rows currently point at unpublished deferred Wind targets. This design removes those targets and records the Metal rows as deletions instead.

The current reconciled target contains 456 published skills:

| Domain | Published skills |
| --- | ---: |
| Martial | 258 |
| Magical | 124 |
| Craft | 74 |

Deleting deferred Metal targets does not change those published counts because deferred rows are already excluded from the active target.

## Interaction model

### Collapsed domain root

The top of the interactive skill tree becomes a three-column domain gallery:

1. Martial
2. Magical
3. Craft

Each domain is a native button containing its square image, name, family count, and a concise disclosure cue. The three images remain side by side at desktop and narrow widths. At 390px they become compact square plates rather than stacking, preserving the requested root-level comparison.

Initial state has no expanded domain. Each button exposes `aria-expanded` and `aria-controls`.

### Single-open branch

Clicking or keyboard-activating a domain opens its family ledger directly beneath the three images. Only one domain may be open at a time:

- selecting a closed domain opens it;
- selecting another domain switches the open branch;
- selecting the open domain again collapses the tree to its root;
- family filters remain local buttons and canonical skill/family destinations remain links.

Focus remains on the disclosure button after activation. The open panel is not modal and does not steal focus. The current short reveal motion remains, while `prefers-reduced-motion` removes it.

### Expanded content

The expanded panel no longer repeats the selected domain as a large left-side image. The image gallery is the expressive root. The open branch uses the full content width for:

- the domain description;
- family records;
- optional Equipment or Element filters;
- representative skill links.

This keeps the established field-archive typography, ember selection state, fine dividers, flat ledger rows, and direct canonical links. It does not introduce ornamental connector lines, generic cards, or a second visual system.

## Magical domain image

Create a versioned project asset at:

`apps/web/static/wiki-media/skills/magical-domain-v2.webp`

Use the existing `magical-domain.webp` as the structural and style reference. The new square image must retain:

- a near-black background;
- a realistic, ornate brass arcane instrument;
- a luminous central arcane star or focus;
- restrained sparks, mist, and elemental energy;
- the same high-detail, photographed artifact quality as the Martial and Craft images;
- no text or lettering.

Exactly four elemental nodes surround the center at cardinal positions:

- Fire above: a living orange flame;
- Wind right: a pale, translucent air vortex or flowing current;
- Earth below: a grounded stone or mineral mass without metallic blades;
- Water left: a sculptural blue wave.

The image must contain no leaf, branch, wood-growth, sword, needle, floating blade, metal ingot, or fifth elemental node. Brass belongs only to the neutral arcane framework and must not read as a Metal affinity symbol.

The UI switches Magical to the v2 asset. The v1 asset remains unreferenced rather than being overwritten, preserving visual provenance.

## Elemental skill ownership

### Active labels

The only active Element labels are:

- Fire
- Earth
- Wind
- Water

Every published Elemental skill has exactly one of these affinity labels. Multi-affinity Elemental skills are out of scope. `Attuned` remains a compatibility label for the existing Ward and Enchantment definitions and is not an Elemental affinity ladder.

### Published ladders

- Fire, Water, and Earth retain their current published ladders.
- Wind remains an active affinity with no invented skill definitions in this pass.
- Selecting Wind in the Elemental filter shows a concise, truthful empty result: its skill ladder is not published yet.
- Wood remains deleted under the accepted four-affinity migration.
- Metal is deleted, not renamed, rehomed, deferred, or converted to Wind.

### Migration contract

All 18 `Evocation — Metal` legacy rows receive disposition `delete` with the rationale:

`Metal affinity removed by accepted four-base model`

Their original identity, rarity, type, requirements, and effect remain present in the immutable legacy inventory and generated migration ledger. No active or deferred target is emitted.

If Metal was the only consumer of the deferred-publication migration shape, remove that unused schema and validation path rather than retaining dead machinery.

## Data and component changes

- `skill-tree-data.ts` points Magical at `magical-domain-v2.webp`, retains the four active labels, and supplies the Wind empty-result copy.
- `SkillTree.svelte` changes selected-domain state from a required default to a nullable single-open disclosure state.
- The three domain buttons become image plates with accessible disclosure semantics.
- The expanded family ledger becomes full-width and renders only when a domain is open.
- The migration exporter deletes Metal rows and regenerates `migration-v2.json`.
- Canonical skill and affinity prose consistently describes four active affinities, three currently published Elemental ladders, and no Metal-to-Wind conversion.

## Accessibility and responsive behavior

- Native buttons own domain disclosure; native links own navigation.
- Domain buttons expose visible hover, pressed/open, focus-visible, and active states.
- Domain name and family count remain text, so the images are decorative within each named button.
- The three root images reserve a square aspect ratio to avoid layout shift.
- At 390px all three domain plates remain side by side with readable abbreviated metadata; the expanded ledger flows beneath them without horizontal document overflow.
- Reduced-motion mode removes disclosure and image transforms.
- Opening and closing a domain is synchronous; no loading, error, or asynchronous state is invented.

## Verification contract

### Taxonomy

- The immutable 520-row inventory digest is unchanged.
- The active target remains 456 skills: 258 Martial, 124 Magical, 74 Craft.
- All 18 Metal legacy rows are deleted with the approved rationale and have no target.
- No active or deferred Element label is Metal or Wood.
- Every published Elemental row has exactly one label from Fire, Earth, Wind, or Water.
- Fire, Water, and Earth canonical rows reconcile exactly; Wind publishes no invented skill row.

### Interaction

- Initial render has three visible domain image buttons and no expanded family branch.
- Each domain opens by pointer and keyboard.
- A second activation collapses the open domain.
- Opening another domain replaces the prior branch; multiple branches never remain open.
- Element filters, family links, and representative skill links retain their semantics.
- Wind selection exposes the truthful unpublished-ladder result.
- Desktop and 390px layouts have no horizontal overflow.
- Focus visibility and reduced-motion behavior pass browser tests.

### Visual asset

- The final repository asset is square, web-ready, and referenced by the Magical domain data.
- Visual inspection confirms exactly four elemental nodes and no Wood/Metal symbol.
- The three domain plates read as one coherent set in the live wiki.

## Deferred work

The next skill-visualization pass may define the individual skill frame, rarity cue, and text such as `Intermediate — Level 7`. Nothing in this implementation should pre-commit that frame system or attach rarity/level presentation to the current representative links.
