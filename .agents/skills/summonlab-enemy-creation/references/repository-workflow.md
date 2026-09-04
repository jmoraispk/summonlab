# Enemy creation repository workflow

Resolve all paths from the repository root and inspect the current versions before editing. Treat
dated counts and examples as historical evidence, not universal constants.

## 1. Establish authority and scope

Read `AGENTS.md`, then inspect the relevant enemy sources, usually:

- `docs/wiki/creatures/monster-races/README.md`;
- `docs/wiki/creatures/monsters/README.md` and its exporter;
- the active design/specification page for the expansion;
- `tools/family-affinity-production-lib.ts` and `FamilyPacketSchema`;
- the applicable `assets/enemies/experiments/*/manifest.json` and `active-sources.json`;
- focused validators and neighboring family packets.

Use `rg` to find every live mention of the family and current program totals. Check git status and
the diff boundary before editing.

Choose one route:

- **New family:** add it to a collision-safe expansion root or the explicitly active unfinished
  expansion. Do not alter a completed baseline merely to keep all families together.
- **Revision:** create a new version/revision when the current manifest is frozen or evidence is
  immutable. Preserve accepted siblings unless the user requests their revision.

The completed original enemy matrix under `family-affinity-v1` is protected unless current owner
instructions explicitly reopen it. Never modify engine contracts, unrelated visual domains, or a
shared runtime catalog without root-orchestrator integration.

## 2. Design-only implementation

For a design phase:

1. Author one schema-valid family packet.
2. Add its path once to active sources.
3. Update manifest family/form/coordinate counts from source data.
4. Keep target, assignment, candidate, approved, and runtime counts at zero.
5. Update the canonical design and authored wiki page.
6. Update generated wiki source code, then run the exporter; do not hand-edit managed output when an
   exporter owns it.
7. Add focused tests proving exact tier order, unique IDs, affinity order, T3/T5 mechanics, state
   separation, and protected-manifest immutability.

The coordinate formula is `new families × 5 forms × 5 targets`, where the targets are Normal, Fire,
Earth, Wind, and Water.

## 3. Image-production implementation

Only enter this phase when images are explicitly requested. A prose design packet is not a
production assignment.

1. Freeze the approved source packets into a new collision-safe manifest revision.
2. Materialize one immutable target and one exclusive assignment per form/variant coordinate.
3. Record prompts, references, expected output paths, ownership, and hashes required by the current
   production schema.
4. Dispatch each raster through `summonlab-image-production`; producers write only their assigned
   candidate/result paths.
5. Keep provider sources, normalized candidates, receipts, provenance, and visual-review evidence
   indexed by the coordinating manifest.
6. Generate contact sheets or HTML review surfaces only as derived evidence.

Candidates remain candidates until owner review. Approved assets remain separate from runtime.
Promotion is a distinct, explicitly authorized integration step.

## 4. Verification and delivery

Run the narrow validator first, then the relevant wiki/export checks and repository checks in
proportion to the change. At minimum for a design addition:

```bash
pnpm validate:fauna-family-design
pnpm validate:wiki-monsters
pnpm validate:wiki
pnpm exec prettier --check <changed-paths>
```

Also validate the skill package when this workflow itself changes. Confirm the protected production
root has no scoped diff and no unindexed output exists. Follow `AGENTS.md`: commit only in-scope
files, push the current branch, report commit subject/hash and destination, and confirm whether the
working tree is clean.

## Common failure modes

- Updating manifest counts but leaving the wiki or exporter prose stale.
- Creating candidates before immutable targets and exclusive assignments exist.
- Reusing a legacy raster without current target provenance.
- Calling a design packet, contact-sheet cell, or generated raster an approved/runtime asset.
- Regenerating completed families to accommodate a new family.
- Writing an authored page into a generated wiki directory.
