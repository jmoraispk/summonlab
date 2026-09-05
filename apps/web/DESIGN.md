---
version: alpha
name: 'Summonlab Web'
description: 'A dark living rulebook and game interface shaped like an annotated field archive.'
colors:
  background: '#090805'
  surface: '#0C0B08'
  paper: '#F3EAD9'
  muted: '#AAA08E'
  primary: '#D4773D'
  focus: '#E5AA73'
  line: 'rgba(231, 206, 164, 0.14)'
typography:
  prose:
    fontFamily: 'Georgia, serif'
  utility:
    fontFamily: 'ui-monospace, monospace'
rounded:
  DEFAULT: '0.2rem'
  square: '0rem'
spacing:
  topbar: '4.5rem'
  wiki-sidebar: '22rem'
  reading-measure: '76rem'
components:
  wiki-navigation:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.paper}'
  taxonomy-filter:
    backgroundColor: '{colors.background}'
    textColor: '{colors.muted}'
  taxonomy-mark:
    backgroundColor: '{colors.background}'
    textColor: '{colors.primary}'
  taxonomy-reset:
    backgroundColor: '{colors.background}'
    textColor: '{colors.focus}'
  field-guide-record:
    backgroundColor: '{colors.background}'
    textColor: '{colors.paper}'
  ledger-divider:
    backgroundColor: '{colors.line}'
  equipment-workshop:
    backgroundColor: '{colors.background}'
    textColor: '{colors.paper}'
    accentColor: '{colors.primary}'
    focusColor: '{colors.focus}'
---

# Summonlab Web Design System

## Overview

### Creative North Star

Summonlab should feel like a field archive kept beside a dangerous expedition: near-black pages,
paper-toned type, ember taxonomy marks, fine rules, and full-bleed plates that make creatures,
heroes, and domains feel observed rather than advertised.

### Product context and register

- **Audience and primary job:** Game designers and players inspect rules, content, and playtest
  surfaces without losing the fiction's tone.
- **Target market and evidence:** The repository establishes an English-language public wiki and
  local playtest; no region-specific market contract is currently maintained.
- **Locale and language policy:** Authored interface and canonical wiki content are English.
- **Usage scene:** Desktop-first reference work with complete narrow-screen access for reading and
  quick lookup.
- **Register:** Hybrid. The wiki is a product reference library with restrained brand expression;
  game routes may carry stronger scene-specific art direction.
- **Memorable signature:** Expressive domain imagery anchors major reference surfaces; the skill
  taxonomy uses three circular image roots connected to one flat family ledger.
- **Restraint:** Navigation, filters, tables, and dense records remain flat, legible, and quiet.
- **Anti-references:** Do not resemble generic SaaS cards, glass panels, parchment cosplay,
  ornamental diagrams, gradient text, or pill-heavy marketing layouts. Structural connectors that
  clarify taxonomy relationships are permitted; ornamental connector diagrams remain forbidden.
- **Token ownership/runtime mapping:** Ownership model B. Runtime styles are canonical; this file
  mirrors accepted values from `src/routes/wiki/+layout.svelte`, wiki page styles, and maintained
  components. Feature styles consume those roles without introducing a parallel theme package.

## Colors

`background` owns the document ground and `surface` separates navigation or records by tone.
`paper` is primary text, `muted` is supporting copy, and `primary` maps to the wiki's ember
taxonomy and selection color. `focus` is reserved for conspicuous keyboard focus and interactive
emphasis. Selected controls use a translucent ember wash over `background`, and `line` supplies quiet
structure. Color never carries selection alone: controls also expose semantic pressed/current state,
borders, or text.

The established wiki is dark-only. Forced-colors behavior remains browser-owned; no decorative
effect may remove native control or link legibility.

## Typography

Georgia is the lore and reference voice for headings, prose, family names, and skill names. The
system monospace stack is the taxonomy voice for metadata, counts, labels, and compact status.
Sentence case is standard. Uppercase is reserved for short utility metadata with generous tracking,
never paragraphs or primary actions.

## Layout

The wiki shell owns a `4.5rem` fixed topbar and `22rem` desktop archive index. Content uses natural
document scrolling. Interactive reference surfaces stay within an approximately `76rem` reading
measure and must reflow without horizontal overflow at 390px. Dense collections use full-width
ledger rows and fine dividers instead of identical card grids. Image geometry is reserved with
width, height, or aspect ratio to prevent layout shifts.

## Elevation & Depth

Hierarchy comes from surface tone, borders, image overlays, and fixed-shell placement. Static
records remain flat. Blur is confined to the established topbar; shadows are reserved for a mobile
navigation layer above the document, not content cards.

## Shapes

Edges are square by default. The `0.2rem` radius belongs to compact controls and fields where a
slightly softened hit area improves recognition. Pills and large rounded containers are not part of
the wiki grammar. Fine one-pixel rules organize reference material.

## Components

### Foundational visual states

Enabled controls expose pointer cursor, hover, active/pressed, and a `focus` outline. Disabled and
busy states are added only when the underlying workflow has them. Static wiki data has no invented
loading, error, or empty state. Reduced motion removes transitions and transforms that are not
required to understand state.

### Buttons and actions

Buttons are native semantic controls. Primary selection uses ember border/surface changes plus
`aria-pressed`; quiet reset actions use focus-colored underlined text. Touch targets aim for at
least 40px in compact taxonomy controls and preserve wrapping at narrow widths.

### Navigation and data display

Links navigate and buttons change local state. The archive index owns global discovery. Taxonomy
surfaces use domain selectors, local label filters, ledger rows, and direct canonical links. An
optional label filters compatibility but never appears as an ownership node; unlabeled family-wide
skills remain visible under every label filter. Circular nodes are reserved for top-level taxonomy
roots. Family records remain flat ledger content; a dedicated individual-skill visualization may
use the accepted hexagonal rarity frame without turning the family ledger into a generic card grid.

### Skill rarity frames

The canonical comparison source is `assets/wiki/skills/rarity-frame-v1/`. Skill rarity uses one
domain-independent material ladder: weathered iron F, aged bronze E, tempered blue steel D,
moonlit silver C, blackened amethyst B, champagne electrum A, and ceremonial antique gold S.
Ornament remains restrained through C, B relies on faceted mineral material, A adds fine spear-leaf
accents, and S owns the crowned ceremonial apex. Frame rarity and bearer mastery remain separate;
mastery and level appear only in the second text row beneath a skill.

The approved comparison plate is not a sprite sheet. Runtime work must consume separately produced
transparent frame assets rather than cropping the plate or approximating its ornament with CSS or
inline SVG.

### Skill visual catalog

The permanent skill visual catalog is the deliberate exception to the wiki's usual flat-ledger
density: it may use four image-bearing cards per row above 64rem of catalog content width so readers
can compare all 456 canonical skill emblems. Its component establishes an inline-size container so
the grid responds to the space left by the 22rem wiki shell, not to the raw viewport. It steps down
to three columns from 52–64rem, two from 30–52rem, and one below 30rem; family pages remain flat
tables and the taxonomy root remains the three-circle tree.

Each card reserves a square image well with a solid `#090805` background and contains the complete
512×512 framed image. Never use the checkerboard review background on this public wiki surface.
Rarity remains communicated by the integrated frame and must not be duplicated as card text.
Cards stay square-edged and flat, separated by fine rules without glass, gradients, or shadows.

### Forms and overlays

The archive search uses the established native search field. New authored overlays are not created
for reference-only interactions. Any future modal must be app-owned, semantically named, and
keyboard complete rather than using browser alert, confirm, or prompt.

### Iconography

The wiki uses sparing typographic arrows and text labels. Icons never replace a necessary action or
taxonomy name. Decorative arrows are hidden from assistive technology.

### Motion

State transitions run roughly 150–250ms with direct easing. Motion may clarify domain or filter
changes; it does not orchestrate routine reading. `prefers-reduced-motion: reduce` removes reveal,
transform, and transition effects.

### Combat presentation

Combat is a scene-first game surface, not an archive dashboard. A PixiJS canvas may own the arena,
characters, depth sorting, contact shadows, camera movement, and effects. Svelte remains responsible
for readable controls, initiative information, public intent, responsive layout, and accessibility.
Both layers consume the same authoritative combat projection; neither invents timing, legality, or
results.

The realtime combat study at `/living-village-lab/realtime-combat` is the accepted matched-comparison
surface for deciding between flat 2D and near-3D 2.5D. Its three lenses must share one simulation,
initial state, timing, damage, targets, and outcome. `2D` uses rectangular placement, fixed actor scale,
and fixed team-layer priority. Classic `2.5D` preserves rectangular placement while adding depth
scale, foot-anchored Y sorting, shadow deformation, atmospheric depth, local light, and restrained
parallax. `2.5D V2` is the only lens allowed to apply trapezoidal lane convergence, nonlinear depth
scale, foreground occlusion, and visible projection guides. Switching lenses never restarts the
encounter. The owned saffron-braid lead is the identity and quality gate; supporting heroes and
enemies match her compact adult proportions without copying her identity or costume. Motion expansion
began with an authored Asha-and-lesser-rat canary rather than applying low-quality animation to the
whole cast. The accepted vocabulary now covers every combatant: idle, advance, attack, hit, and
defeat, with equipment and weight specific to each silhouette.

Combat spacing is silhouette-aware. Actors use stable engagement slots while approaching, then lock
in place while their target remains within a small exit threshold; actor-to-actor repulsion must not
create orbiting or running-in-place. Role-aware arena margins keep full silhouettes on stage. The V2
well has an expanded visual-clearance ellipse beyond the visible stone rim and participates in the
same foot-anchor depth ordering as actors, so it occludes only characters actually behind it. Contact
shadows are world siblings anchored to rendered feet rather than children inheriting attack
transforms.

Accepted phone reference: [combat direction v1](../../docs/evidence/living-village-combat-phone-direction-v1.png).
Treat its camera, battlefield density, timeline restraint, tile alignment, live-feed hierarchy, and
command-bar proportions as the visual baseline for the first combat slice.

Accepted motion reference: [combat motion storyboard v1](../../docs/evidence/living-village-combat-motion-storyboard-v1.png).
Use its `focus -> move -> impact -> settle` sequence as the baseline action cadence. Establish the
destination tile before impact and let the resolved state become readable before advancing.

- Use a steep top-down 2.5D camera, with only enough pitch to preserve silhouettes, environmental
  depth, and elliptical contact shadows.
- Make action order unmistakable. The primary initiative display is a portrait rail with a visible
  `Now` origin and a dominant ready-actor treatment. Do not print relative-time labels beside every
  portrait by default; exact engine-projected timing can appear on inspection and through accessible
  descriptions.
- On phone, anchor that rail horizontally to the top edge of the battlefield. It is a thin overlay,
  not an opaque header or a reserved band: the scene remains visible beneath it, with only a local
  contrast veil behind portraits. Future actors sweep left toward `Now`.
- Desktop may preserve the same top rail or reposition it within the wider combat shell, but it must
  keep the same leftward order semantics and ready-actor emphasis as phone.
- Keep the battlefield dominant. Action controls and Manual, Assist, or Auto ownership remain quiet
  overlays and must not compete with the ready actor or the next material event.
- Render environmental opportunities as part of the battlefield. Surprise, concealment, hazards,
  and other encounter advantages originate in authoritative environment and perception state; the
  canvas reveals only the projected evidence and legal affordances.
- Preserve a flat chibi character language at combat scale: stable feet anchors, readable
  silhouettes, consistent directional frames, and soft elliptical shadows. Dimensionality comes
  from authored layers, overlap, lighting, and motion rather than requiring full 3D models.
- Center each combatant's feet anchor and contact shadow on one tactical tile. Selection outlines
  trace that tile's exact projected edges; they must not float inside it, exceed it, or straddle seams.
- Keep tactical cells logically square and authoritative in engine space, then project them through
  the scene's steep top-down camera. Screen-space cells may be foreshortened or trapezoidal; never
  flatten the painted battlefield into an equal-pixel checkerboard. Environment plates may author
  square paving in perspective, while interaction uses a scene-owned mapping from each cell ID to
  projected corners and a feet anchor. Selection outlines trace those projected corners exactly.
- Present combat activity as a live, chat-like feed. Engine-authored outcome lines stay terse and
  causal. For example:
  `hero_04 used Fleeting Step → flanked goblin_02 → Opening → critical → goblin_02 died`.
  Optional character messages are short public intent or personality, not private reasoning, and
  never imply an outcome before the engine resolves it.
- Keep the feed subordinate to the battlefield: on phone it is a shallow, collapsible overlay above
  the command bar showing the latest three messages by default; expanding it reveals the complete
  history. Desktop uses adjacent space for the feed. Each message retains actor identity, event
  order, and replay linkage, and the complete feed remains reachable without relying on transient
  animation.
- In the compact live view, keep the newest message at full emphasis and fade the preceding two
  progressively. Expanded history restores uniform readable contrast; fading never removes content
  or becomes the only indication of event order.
- Identify character-voice messages with a concise colored name prefix. Do not repeat portrait
  thumbnails in the feed; the name supplies identity while preserving battlefield space and keeping
  mechanical event lines easy to scan.

### Opening presentation

The playable opening laboratory is the deliberate exception for scene choreography. Its four states
reuse the approved full-screen story plates while one engraved interaction surface changes at a time.
The summoning glow becomes the equipment-selection line and then the Tower-floor marker, giving the
sequence one continuous visual gesture. Reduced motion preserves the same state and focus order with
near-instant transitions.

### Equipment workshop

The in-game forge is a field-archive workbench inside the play surface, never the top-level character
portrait `/forge`. It consumes the existing `background`, `surface`, `paper`, `muted`, `primary`,
`focus`, and `line` roles directly; no Equipment-only theme values or parallel token source exists.

- Use a stacked `material → form → assay → inventory → loadout` workflow on phone and a
  selection/inspection split on desktop. The order is functional and remains visible in the numbered
  ledger headings.
- The signature surface is a square material assay plate: selected approved art, one rank stamp,
  Standard craftsmanship, and abbreviated source/runtime provenance. The surrounding workflow stays
  flat and quiet.
- Material and form choices are square ledger rows separated by fine rules. Do not convert them to
  SaaS cards, pills, glass, gradients, or ornamental containers.
- Reserve a square image area before decode. Lists request 256px card art lazily; only the actively
  inspected definition requests its 512px detail art.
- Keep forging server-owned and explicit. Pending, completed, unavailable, error, and empty states
  occupy stable space, and busy controls preserve their size.
- Present the authoritative six slots as `main-hand`, `off-hand`, `head`, `torso`, `legs`, and
  `boots`. Item rows retain their acquisition provenance after forging, equipping, and reload.

### Content and data visualization

Copy is concise, literal, and written from the reader's perspective. Taxonomy language follows the
canonical `Domain → Family → Skill` model. Counts describe authored records; labels communicate
compatibility, not progression or ownership.

## Do's and Don'ts

- **Do:** Let expressive domain imagery carry the visual weight of a reference surface, with
  circular nodes reserved for top-level taxonomy roots.
- **Do:** Use Georgia, utility monospace, ember markers, and fine rules consistently with the wiki.
- **Do:** Keep dense records flat, navigable, and complete on narrow screens.
- **Don't:** Turn families into generic identical cards or labels into a hidden hierarchy.
- **Don't:** Add glass, gradient type, broad shadows, oversized pills, ornamental diagrams, or
  decorative tree lines. Structural connectors are permitted when they clarify taxonomy
  relationships.
- **Don't:** Invent asynchronous states, balance values, or interactions that canonical content does
  not support.
