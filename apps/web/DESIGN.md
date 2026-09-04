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
roots; family and skill records remain flat ledger content.

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

The playable opening laboratory is the deliberate exception for scene choreography. Its four states
reuse the approved full-screen story plates while one engraved interaction surface changes at a time.
The summoning glow becomes the equipment-selection line and then the Tower-floor marker, giving the
sequence one continuous visual gesture. Reduced motion preserves the same state and focus order with
near-instant transitions.

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
