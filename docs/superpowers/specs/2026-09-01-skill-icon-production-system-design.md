# Skill icon production system design

**Status:** Proposed for owner review

**Date:** 2026-09-01

**Owner:** Skills visual production

## Purpose

Produce complete, consistent, independently replaceable icon artwork for every canonical skill
without sacrificing per-icon resolution. The current catalog contains 456 skills: 258 Martial, 124
Magical, and 74 Craft. The system must also make a newly authored skill visibly incomplete until it
receives a reviewed visual record.

The production model separates two jobs that one generated image cannot perform equally well:

- **calibration plates** establish consistency across related assets;
- **individual square masters** provide the pixel density and isolation required by production.

Calibration plates are never cropped into runtime assets.

## Accepted visual direction

The owner selected the **Painted Emblem** direction.

Every skill icon uses:

- one dominant subject or action silhouette;
- at most one supporting effect or material cue;
- lightly dimensional painted materials rather than flat pictograms;
- restrained semantic color based on the skill itself;
- controlled highlights and glow;
- enough simplification to remain recognizable at small size;
- no text, rarity cue, type badge, frame, or narrative scenery inside the artwork layer.

Rarity is communicated only by the canonical F–S frame. Active, Passive, Stance, and Craft type
remain external metadata. Domain and family do not force a palette onto the icon.

## Layer contract

Every rendered skill tile is assembled from four independent layers:

1. a universal charcoal backing;
2. one skill-specific painted-emblem artwork layer;
3. the skill's fixed rarity frame;
4. interface-rendered text beneath the hexagon.

The first text row is the skill name. The second is bearer-specific mastery and level in the form
`MASTERY · LV N`. Text is never baked into the frame, backing, or icon artwork.

### Shared geometry

All image layers use a `1024×1024` RGBA working canvas with the same center and registration. The
outer frame, inner aperture, backing mask, and icon safe zone are fixed by one geometry manifest.
The painted subject stays within the central 64% safe zone; restrained supporting effects may
extend to 72% but never enter the frame or rarity medallion exclusion zones.

Approved masters retain their original lossless PNG. Runtime exports derive deterministically at
`512×512`, `256×256`, and `128×128` without replacing the master.

## Production phases

### Phase 1 — rarity frames

The accepted Option C seven-rarity comparison is the calibration authority. Produce F through S
again as seven independent transparent `1024×1024` frame masters. Each individual generation uses
the comparison plate as a visual reference and the shared geometry manifest as a hard constraint.

The individual frame masters—not crops from the comparison—become the production assets. Review
must confirm identical registration and aperture geometry across all seven frames while preserving
the accepted material ladder:

`weathered iron → aged bronze → tempered blue steel → moonlit silver → blackened amethyst →
champagne electrum → ceremonial antique gold`.

### Phase 2 — universal backing

Produce one standalone `1024×1024` charcoal forged-stone backing, transparent outside the common
hexagonal aperture. Its design is already accepted; the remaining work is production, geometry
registration, and validation of the standalone file.

### Phase 3 — motif map

Every canonical skill receives exactly one visual classification:

- a named motif family with zero or one primary visual parent; or
- `standalone`, with no visual parent.

Mechanical prerequisites remain recorded separately and may contain several parents. They do not
force the icon to become a collage. A secondary prerequisite may influence a small pose, material,
or effect cue, but only the primary visual parent controls inherited iconography.

The proposed complete map is maintained in
[the companion motif map](2026-09-01-skill-icon-motif-map.md). Motif families are intentionally
narrower than mechanical families. For example, Blade separates precision cuts, sweeping cuts,
guards and counters, blade throwing, heavy cleaves, and paired-blade techniques.

### Phase 4 — motif-family calibration

Before producing members of a multi-skill motif family, generate one family calibration plate with
approximately three to six representative members or lineage stages. A family plate establishes:

- the recurring silhouette or construction motif;
- how the motif changes from parent to child;
- semantic palette boundaries;
- material and effect vocabulary;
- icon density and negative space;
- the distinction between adjacent members.

The family plate is an approved reference, not an asset sheet. Large or branching families receive
multiple lineage plates rather than shrinking many icons into one overcrowded image. Standalone
skills skip this phase and use the global Painted Emblem reference directly.

### Phase 5 — individual skill masters

Generate each skill independently at `1024×1024` with genuine transparency. A multi-skill family
member receives these references:

1. the global Painted Emblem style authority;
2. its approved motif-family calibration plate;
3. its approved primary-parent master, when one exists;
4. the universal geometry and safe-zone guide.

A standalone skill receives the global style authority and geometry guide. Every prompt repeats
the skill's dominant subject, optional supporting cue, semantic palette, exclusions, and exact
safe-zone requirements. Generations own one collision-safe candidate path and never edit a shared
catalog.

If a provider does not return clean alpha, use a dedicated background-extraction revision against
the same candidate. Do not disguise a black square as transparency.

### Phase 6 — deterministic assembly and review

The review compositor combines the backing, individual artwork, fixed rarity frame, and external
text without generative editing. Every candidate is inspected in three views:

1. full-resolution isolated artwork;
2. the canonical composite at normal interface size;
3. a `96×96` recognition thumbnail without text.

The compositor also produces contact sheets for review, but those sheets remain derived evidence.
They never become an image source.

## Manifest model

The production manifest has one record for each canonical `targetId` and contains:

- canonical skill ID, name, domain, family, labels, rarity, and type;
- motif family or `standalone`;
- nullable primary visual parent;
- mechanical prerequisites as authored source text;
- dominant subject;
- nullable supporting cue;
- semantic palette;
- composition direction and exclusions;
- calibration-plate reference, when applicable;
- candidate, approved-master, and derived-export paths;
- generation prompt, input references, dimensions, alpha mode, and SHA-256;
- review state and recognition results.

Canonical skill metadata is imported from the authored Markdown tables rather than duplicated by
hand. Visual fields are owned by the icon manifest.

## Validation and completion gates

Automated validation rejects:

- a canonical skill without exactly one icon-manifest record;
- an icon record whose skill no longer exists;
- duplicate skill IDs, candidate paths, or approved paths;
- a non-standalone record without an existing calibration plate;
- more than one primary visual parent;
- a parent outside the same motif family unless explicitly reviewed as a cross-family bridge;
- a parent cycle;
- a missing or invalid rarity frame;
- non-`1024×1024` masters, absent alpha, unsafe visible pixels, or incorrect registration;
- missing provenance, hashes, recognition review, or required runtime derivations.

Human approval requires:

- immediate recognition of the dominant subject at `96×96`;
- meaningful distinction from adjacent members of the same motif family;
- visible lineage with its primary parent where one exists;
- no frame, text, type, rarity, or domain information baked into the artwork;
- no confusing collision between semantic color and the rarity frame;
- no cropped subject, illegible micro-detail, or uncontrolled particles.

“100% complete” means the current canonical skill set and manifest are in exact one-to-one
correspondence and every record has an approved individual master plus required derivatives. The
current target is therefore 456 of 456, not the former 520-row legacy inventory.

## New-skill procedure

When a new skill is authored:

1. taxonomy validation creates a missing-icon failure;
2. the visual owner assigns an existing motif family or marks the skill standalone;
3. the owner chooses at most one primary visual parent and authors its subject, cue, palette, and
   exclusions;
4. a new motif family receives and approves a calibration plate before individual generation;
5. the skill receives one isolated high-resolution generation job;
6. automated geometry, alpha, provenance, and coverage checks run;
7. the full-size, composite, and `96×96` views receive human review;
8. approval promotes the master and deterministic derivatives together.

Changing a skill's rarity swaps the frame during composition; it does not regenerate the artwork.
Changing a skill's mechanics does not invalidate its image unless the dominant visual meaning has
changed.

## Rollout and review boundaries

Production should proceed in reviewable gates:

1. approve the geometry manifest, seven individual rarity frames, and universal backing;
2. review and revise the complete 456-skill motif map;
3. pilot three motif families spanning Martial, Magical, and Craft;
4. approve their family plates and individual masters before scaling;
5. produce remaining families in bounded waves with independent ownership;
6. enable the 456-of-456 completion gate only after the production queue is intentionally active.

No skill artwork generation begins merely because this design is approved. The written motif map,
geometry contract, and production plan must receive their own review first.
