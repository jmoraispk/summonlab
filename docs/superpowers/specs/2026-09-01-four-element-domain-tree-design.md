# Four-Element Domain Tree Design

**Date:** 2026-09-01
**Status:** Approved
**Scope:** Skill wiki domain navigation, Magic domain artwork, and Elemental migration cleanup

## Goal

Make the skill taxonomy read as a literal interactive tree: one `Skills` root branches into three circular domain nodes—Martial, Magic, and Craft—and only the selected node grows into its family and skill records. Align Elemental magic with the accepted four-affinity model: Fire, Water, Wind, and Earth. Replace the current five-symbol Magical domain image with a four-element version in the established visual language, and remove Metal from migration ownership without inventing a Wind skill ladder.

`Magic` is the reader-facing node label. `Magical` remains the canonical domain value in Markdown, migration data, validation, and internal identifiers.

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

### Skills root and circular domain nodes

The taxonomy begins with a compact `Skills` root marker. A restrained vertical stem meets one horizontal branch, which connects three circular image buttons in this reader-facing order:

1. Martial
2. Magic
3. Craft

Each node contains its domain artwork cropped into a circle. Its visible label and family count sit directly beneath the circle. The existing Martial and Craft image files stay byte-for-byte unchanged; circular presentation is a CSS crop, not an asset rewrite.

The connector is structural, not ornamental: one quiet line communicates the root-to-domain relationship, with no sprawling diagram, decorative arrows, or faux-parchment treatment. The three circles remain side by side at desktop and at 390px. Their diameter uses a responsive clamp so the hierarchy stays legible without introducing horizontal page overflow.

Initial state has no expanded domain. Each circular node is a native button exposing `aria-expanded` and `aria-controls`. The image is decorative inside the fully named button.

### Single-open branch

Clicking or keyboard-activating a domain grows its branch beneath all three nodes. Only one domain may be open at a time:

- selecting a closed domain opens it;
- selecting another domain replaces the open branch;
- selecting the open domain again returns to the three-node root;
- family filters remain local buttons and canonical skill/family destinations remain links.

The selected node receives an ember edge and a short vertical connector into the open family ledger. Focus remains on the domain button after activation. The panel is not modal and does not steal focus. The reveal is brief and direct; `prefers-reduced-motion` removes animation and transforms.

### Expanded content

The open branch uses the full content width for:

- the domain description;
- five family records;
- optional Equipment or Element filters;
- representative skill links.

It does not repeat the domain image at large scale. The three circular nodes are the expressive root. Family records retain the established field-archive typography, ember selection state, fine dividers, flat ledger rows, and direct canonical links.

## Magic domain image prototypes

Create two visual prototypes from the existing `apps/web/static/wiki-media/skills/magical-domain.webp` reference before choosing the final repository asset.

### Prototype A — cardinal astrolabe

Preserve the photographed, ornate brass instrument, near-black ground, and luminous central focus. Place exactly four independent elemental nodes at cardinal positions:

- Fire above: a living orange flame;
- Wind right: a pale translucent air vortex;
- Earth below: grounded stone or mineral, with no metal blade;
- Water left: a sculptural blue wave.

### Prototype B — elemental quadrant wheel

Use the same material realism and visual density, but organize the instrument as four readable quadrants or orbit segments around the central focus. Each quadrant carries only one element, in the same cardinal positions as Prototype A, and the divisions remain subtle enough to feel like one artifact rather than four UI badges.

### Shared prototype constraints

Both candidates must retain:

- a square composition suitable for circular cropping;
- a near-black background;
- a realistic, ornate brass arcane framework;
- a luminous central arcane star or focus;
- restrained sparks, mist, and elemental energy;
- the same high-detail, photographed artifact quality as the Martial and Craft images;
- no text or lettering.

They must contain exactly four elemental symbols. They must contain no leaf, branch, wood-growth, sword, needle, floating blade, metal ingot, or fifth node. Brass belongs only to the neutral framework and must not read as a Metal affinity symbol.

Prototype candidates remain in Codex's generated-image scratch space outside the repository and are shown together for review. Only the accepted or refined candidate is promoted to:

`apps/web/static/wiki-media/skills/magical-domain-v2.webp`

The original `magical-domain.webp` remains unmodified and unreferenced by the new tree, preserving provenance.

## Elemental skill ownership

### Active labels

The only active Element labels are:

- Fire
- Water
- Wind
- Earth

Earth is the sole grounded element name. It is never presented as `Earth/Metal`, `Earth/Wood`, or a renamed combination. Wood and Metal remain retired identities and are not absorbed into Earth in this pass.

Every published Elemental skill has exactly one active Element label. Multi-affinity Elemental skills are out of scope. `Attuned` remains a compatibility label for the existing Ward and Enchantment definitions and is not an Elemental affinity ladder.

### Published ladders

- Fire, Water, and Earth retain their current published ladders.
- Wind remains an active affinity with no invented skill definitions in this pass.
- Selecting Wind in the Elemental filter shows: `The Wind skill ladder is not published yet.`
- Wood remains deleted under the accepted four-affinity migration.
- Metal is deleted, not renamed, rehomed, deferred, converted to Wind, or folded into Earth.

### Migration contract

All 18 `Evocation — Metal` legacy rows receive disposition `delete` with the rationale:

`Metal affinity removed by accepted four-base model`

Their original identity, rarity, type, requirements, and effect remain present in the immutable legacy inventory and generated migration ledger. No active or deferred target is emitted.

Because Metal is the only consumer of the deferred-publication migration target, remove that unused schema and validation path rather than retaining dead machinery.

## Data and component changes

- `skill-tree-data.ts` keeps the internal id `magical`, changes its display name to `Magic`, points it at `magical-domain-v2.webp`, retains the four active Element filters, and supplies the Wind empty-result copy.
- `SkillTree.svelte` changes selected-domain state from a required default to a nullable single-open disclosure state.
- The three domain controls become circular image nodes connected to a visible `Skills` root.
- The expanded family ledger becomes full-width and renders only when a domain is open.
- The migration exporter deletes Metal rows and regenerates `migration-v2.json`.
- Migration target types and validators lose deferred-publication support.
- Canonical skill and affinity prose consistently describes four active affinities, three currently published Elemental ladders, and no Metal-to-Wind or Metal-to-Earth conversion.
- `apps/web/DESIGN.md` records this tree as an intentional exception to the wiki's square default: circles represent taxonomy roots, while family records and all ordinary controls remain flat and square.

## Accessibility and responsive behavior

- Native buttons own domain disclosure; native links own navigation.
- Domain buttons expose visible hover, pressed/open, focus-visible, and active states.
- `aria-expanded` communicates branch state; `aria-controls` points to the shared open branch.
- Domain name and family count remain text, so the images use empty alt text within the named buttons.
- The circles reserve a `1 / 1` aspect ratio to avoid layout shift.
- At 390px all three nodes remain side by side with legible names; the family ledger flows beneath them without horizontal document overflow.
- The connector remains visible but quiet at narrow widths and never intersects labels.
- Reduced-motion mode removes branch reveal and image transforms.
- Opening and closing a domain is synchronous; no loading or error state is invented.

## Verification contract

### Taxonomy

- The immutable 520-row inventory digest is unchanged.
- The active target remains 456 skills: 258 Martial, 124 Magical, 74 Craft.
- All 18 Metal legacy rows are deleted with the approved rationale and have no target.
- No active or deferred Element label is Metal or Wood.
- Every published Elemental row has exactly one label from Fire, Water, Wind, or Earth.
- Fire, Water, and Earth canonical rows reconcile exactly; Wind publishes no invented skill row.

### Interaction

- Initial render shows the `Skills` root, three visible circular image buttons, and no family branch.
- Visible node labels are exactly Martial, Magic, and Craft.
- Each node opens by pointer and keyboard.
- A second activation collapses the selected node.
- Opening another node replaces the prior branch; multiple branches never remain open.
- The open node connects visually to one full-width family ledger.
- Element filters, family links, and representative skill links retain their semantics.
- Wind selection exposes the unpublished-ladder result.
- Desktop and 390px layouts have no horizontal overflow.
- Focus visibility and reduced-motion behavior pass browser tests.

### Visual assets

- Martial and Craft source-image hashes are unchanged.
- The accepted Magic asset is square, web-ready, and referenced by the `magical` domain data.
- Visual inspection confirms exactly four elemental nodes and no Wood or Metal symbol.
- All three circular nodes read as one coherent set in the live wiki.

## Deferred work

The next skill-visualization pass may define the individual skill frame, rarity cue, and text such as `Intermediate — Level 7`. Nothing in this implementation pre-commits that frame system or attaches rarity/level presentation to the current representative links.
