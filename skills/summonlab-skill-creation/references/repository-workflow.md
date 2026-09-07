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

Generate a pre-generation family sheet on demand from already accepted family interiors, backing,
and frames. It excludes the target being created. Generate the new individual skill independently;
do not regenerate accepted siblings. After generation, the coordinator may create a complete
framed family sheet that includes the candidate for owner review. Do not retain either sheet.

### New family

Confirm the family belongs under exactly one of `Martial`, `Magical`, or `Craft`. Update the
canonical family allowlist, wiki index/navigation, interactive tree data, and add a canonical
Markdown source in the same shape as neighboring families. Define every initial motif sequence,
then generate one temporary reference sheet per motif family from any already accepted members and
one independent interior per new skill. The first skill in a new family has no family sheet; its
generation references only geometry and any separately approved visual parent.

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
- `assets/wiki/skills/icon-production-v2/visual-specs.json`
- `assets/wiki/skills/icon-production-v2/asset-manifest.json`
- `assets/wiki/skills/icon-production-v2/geometry.json`
- `assets/wiki/skills/icon-production-v2/geometry-guide.png`
- `assets/wiki/skills/icon-production-v2/frames/`

Motif-map and catalog JSON are generated outputs. Add each target exactly once and keep family
members in parent-before-child order. The immediate parent must be in the same motif family and
visually explain the child's progression.

Author the visual-spec record with one dominant concrete subject and at most one supporting effect.
F through A remain concrete-first. S may become primarily abstract only when the skill concept and
lineage make the ancestry recognizable. Preserve these final-composite invariants; the individual
provider request remains a frameless artwork layer:

- regular point-up hexagonal tile;
- correct rarity frame with integrated crest and uppercase rank letter;
- standard charcoal interior and transparent exterior;
- no name, mastery, level, caption, UI panel, scenery, logo, or watermark;
- no enlarged crop from a family sheet and no reused sibling icon.

`assets/wiki/skills/icon-production-v2/` is the sole live visual authority. Its asset manifest binds
one frameless interior to every catalog row plus seven reusable frames, one backing, and geometry.
Export and check the derived catalog after mechanics, lineage, and visual state agree. The full
asset/runtime validator intentionally waits until the approved interior is promoted:

```bash
pnpm export:skill-icons
pnpm check:skill-icon-catalog
```

## 4. Temporary review and canonical promotion

Use a collision-safe temporary run for new provider output. It must reference the live canonical
frame, backing, geometry, and family members by path and hash, but it is not a second catalog or a
permanent production archive.

For every affected motif family:

1. Before generation, compose a temporary reference sheet from already accepted members in lineage
   order, complete frames, and no captions. Exclude the target. It is temporary reference-only
   presentation for lineage review: it does not authorize frame generation or cropping a framed
   cell into an individual artwork layer. Omit this sheet when no accepted family member exists.
2. Keep the temporary cell map, prompt packet, result, references, and hashes only through review.
3. Generate one frameless artwork layer from content, geometry, family, and immediate-parent
   authorities. The individual producer receives no approved frame as generation content. The
   family sheet may remain a complete framed review reference, never crop content; do not use an
   enlarged crop from it as individual artwork.
4. Keep the accepted provider artwork byte-for-byte as the 1024x1024 canonical interior. Do not
   resize, reposition, mask, crop, or extract it. The shared manifest declares
   `sourcePolicy: 'exact-frameless-source'` and `interiorTransform: 'identity'` so a future frame
   replacement reuses the original art without hidden reframing.
5. The coordinator creates the review composite with the shared runtime composition function by
   running `pnpm render:skill-icon-review -- ...`. It uses
   `backing → interior → rarity-frame`, with the frame last. Automated checks bind every layer hash,
   enforce the identity transform and exact inventory, and reproduce the composite. The owner
   visually confirms subject placement, aperture coverage, absence of baked frame traces, and
   recognition at full size and 96px.
6. After the candidate exists, the coordinator may compose a complete framed family sheet including
   it for final lineage review using the same command's `--family-output`. This post-generation
   sheet is never a generation source.

Before generation, when accepted lineage members exist:

```bash
pnpm render:skill-icon-review -- \
  --target-id martial:blade:measured-cut \
  --family-output .skill-icon-work/martial-blade-measured-cut-v2/family-reference.png
```

After generation, create the individual composite and optional complete review sheet:

```bash
pnpm render:skill-icon-review -- \
  --target-id martial:blade:measured-cut \
  --candidate .skill-icon-work/martial-blade-measured-cut-v2/candidate.png \
  --review-output .skill-icon-work/martial-blade-measured-cut-v2/review-composite.png \
  --family-output .skill-icon-work/martial-blade-measured-cut-v2/family-review.png
```

The command refuses permanent output paths and refuses an empty first-lineage sheet.

Use `summonlab-skill-icon-production` for each assigned manifest-bound raster. That producer writes
only its temporary candidate/result paths and never promotes. The target's mechanics, motif, and
visual-spec records must already exist before image production. Once the owner approves the
isolated art and its framed composite, the coordinator promotes the exact frameless file into the
canonical interior inventory, regenerates `asset-manifest.json` and the wiki runtime, verifies both,
and deletes the temporary run. Do not retain
the generated family sheet, framed candidate, provider source, contact sheet, or review gallery in
the repository after promotion.

## 5. Verification and handoff

At minimum, run the live equivalents of:

```bash
pnpm validate:wiki
pnpm validate:skill-icons
pnpm typecheck:skill-icons
pnpm test:skill-icons
pnpm validate:wiki-skill-visual-catalog
```

Also run the broader repository suite required by `AGENTS.md`. Inspect each new candidate full-size
and at 96 pixels before promotion. Confirm the canonical manifest indexes every retained file and
hash, and that the working tree contains no unindexed provider output.

Report separately:

- canonical mechanics and taxonomy changes;
- new or revised motif lineages;
- temporary family review and approved interior produced;
- canonical manifest and runtime validations;
- any unresolved visual-review decision;
- commit, push, and working-tree state.

Candidate means technically reviewable. Only the owner can accept it; only the coordinator can
promote it into shared canonical state.
