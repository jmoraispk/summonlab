# Summonlab skill-creation repository workflow

Use this reference for repository implementation. Resolve paths from the repository root and inspect
the live versions before editing; paths identify authorities, while dated counts and hashes remain
historical unless a current contract says otherwise.

## 1. Choose the route

### Existing family

Add the canonical row to the family's current Markdown table. Preserve its column schema and assign
the next stable row number. Add the skill to one existing motif sequence at the intended visual
position, or create a new motif sequence under the existing family when its concrete subject and
progression grammar differ materially.

Regenerate the complete affected family reference sheet in a new production revision. Generate the
new individual skill independently; do not regenerate accepted siblings merely because the sheet
changed.

### New family

Confirm the family belongs under exactly one of `Martial`, `Magical`, or `Craft`. Update the
canonical family allowlist, wiki index/navigation, interactive tree data, and add a canonical
Markdown source in the same shape as neighboring families. Define every initial motif sequence,
then generate one reference sheet per motif family and one independent icon per new skill.

Do not introduce an intermediate taxonomy level. Equipment and Element remain optional labels on
skills.

## 2. Canonical mechanics and provenance

Start with:

- `docs/wiki/mechanics/skills/README.md`
- the owning file under `docs/wiki/mechanics/skills/`
- `tools/skill-taxonomy-lib.ts`
- `tools/validate-skill-taxonomy.ts`
- `apps/web/src/lib/components/wiki/skill-tree-data.ts`

Each published row needs a unique name within its family plus:

- rarity: `F`, `E`, `D`, `C`, `B`, `A`, or `S`;
- type: `A`, `P`, `St`, or `C`;
- complete learning requirements and effect;
- optional labels allowed by the current taxonomy validator.

Check requirements and prose references for renamed or new skills. Update navigational content and
tests that intentionally enumerate current families or skills.

`docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json` and its source hash are frozen evidence.
`migration-v2.json` describes that legacy migration; do not fabricate a legacy source record for a
newly authored skill. If the live validator requires every target to appear in that ledger, add a
separate, explicit net-new provenance schema and tests before publishing the row. Historical dated
plans and accepted decisions stay historical unless they claim to be a live inventory authority.

Run before art work:

```bash
pnpm validate:skill-taxonomy
pnpm validate:wiki
```

## 3. Visual lineage and authored specification

Inspect:

- `docs/superpowers/specs/2026-09-01-skill-icon-production-system-design.md`
- `docs/superpowers/specs/2026-09-01-skill-icon-motif-map.md`
- `assets/wiki/skills/icon-production-v1/visual-specs.json`
- `assets/wiki/skills/icon-production-v1/geometry-v2.json`
- `assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png`
- `assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png`

The accepted v1 motif-map Markdown is historical authored lineage authority. For post-v1 skills,
create a dated/versioned successor source rather than editing it. Motif-map and catalog JSON are
generated outputs. Add each target exactly once and keep family members in parent-before-child
order. The immediate parent must be in the same motif family and visually explain the child's
progression.

Author the visual-spec record with one dominant concrete subject and at most one supporting effect.
F through A remain concrete-first. S may become primarily abstract only when the skill concept and
lineage make the ancestry recognizable. Preserve these final-composite invariants; the individual
provider request remains a frameless artwork layer:

- regular point-up hexagonal tile;
- correct rarity frame with integrated crest and uppercase rank letter;
- standard charcoal interior and transparent exterior;
- no name, mastery, level, caption, UI panel, scenery, logo, or watermark;
- no enlarged crop from a family sheet and no reused sibling icon.

The v1 exporter contains frozen catalog-count assertions, and the completed v1 manifest binds its
catalog, motif map, and visual specs by path and hash. Treat the inspected v1 visual specs as a
style/content reference, not an editable destination. A post-v1 addition must not rewrite those
files. Create the next versioned icon-production authority (prefer
`assets/wiki/skills/icon-production-v2/`) or an explicit, tested append-only overlay that binds v1
as its base. Preserve the v1 exporter/checker and add a version-aware exporter/checker for the new
authority. Prefer counts derived from frozen inputs over replacing one global magic number with
another.

Export and check the intended version only after mechanics, lineage, and visual state agree. These
commands are the current v1 interface; extend or version them before using them for later inventory:

```bash
pnpm export:skill-icons
pnpm check:skill-icon-catalog
```

## 4. Additive image production

Read `docs/skill-icon-mass-production-goal-contract.md` for the completed baseline conventions, but
do not edit `icon-production-v1` or its `mass-production-v1` evidence. Under the new versioned
authority, create a collision-safe run root and manifest that freezes the new canonical inputs and
references the approved frame, geometry, and Painted Emblem authorities by path and hash. Existing
v1 individual icons may be referenced by exact hash; they are not copied or silently re-approved.

For every affected motif family:

1. Save a provider-native reference sheet with all current members in lineage order, complete
   frames, and no captions. It is reference-only presentation for lineage review: it does not
   authorize frame generation or cropping a framed cell into an individual artwork layer.
2. Save its cell map, prompt packet, result, references, hashes, and revision evidence.
3. Generate one frameless artwork layer from content, geometry, family, and immediate-parent
   authorities. The individual producer receives no approved frame as generation content. The
   family sheet may remain a complete framed review reference, never crop content; do not use an
   enlarged crop from it as individual artwork.
4. The coordinator centers the accepted provider artwork at artworkScale: 0.9, producing 922x922
   pixels at (51,51) on the 1024x1024 canvas. It verifies complete aperture coverage, extracts the
   aperture interior, adds canonical backing, and applies the canonical rarity frame as the final
   layer with compositionProfile: 'frame-opening-v3'. A different scale requires new explicit
   owner-reviewed authority; never guess it per target. Here, accepted provider artwork means the
   coordinator-selected exact provider source, not owner approval or promotion.
5. Fail closed before composition acceptance on incomplete aperture coverage, baked frame traces,
   exterior opacity, backing-only components, layer-hash mismatch, non-exact recomposition,
   protected-band mismatch, or any composition where the frame is not the final layer.
   Required final order: frame is the final layer. Preserve
   source, layer, candidate, result, hashes, and inspection evidence for the provider artwork and
   deterministic assembly.

Use `summonlab-skill-icon-production` for each assigned manifest-bound raster. That producer writes
only its owned candidate/result paths and never promotes. The coordinating change owns manifests,
reference sheets, maps, catalogs, contact sheets, and completion evidence.

If extending existing production tooling to a new run revision, add tests first and retain
compatibility with the completed v1 checker. A new revision needs its own read-only completion check;
passing `pnpm check:skill-icon-mass-production` for v1 alone is insufficient.

## 5. Verification and handoff

At minimum, run the live equivalents of:

```bash
pnpm validate:wiki
pnpm check:skill-icon-catalog
pnpm typecheck:skill-icons
pnpm test:skill-icons
pnpm check:skill-icon-mass-production
```

Also run the new revision's checker and the broader repository suite required by `AGENTS.md`. Inspect
each new candidate full-size and at 96 pixels. Confirm the manifest indexes every new file and hash,
and that the working tree contains no unindexed provider output.

Report separately:

- canonical mechanics and taxonomy changes;
- new or revised motif lineages;
- family sheets and individual candidates produced;
- validations and exact new-run counts;
- unresolved visual-review decisions;
- commit, push, and working-tree state.

Candidate means technically reviewable. Only the owner can accept or promote it.
