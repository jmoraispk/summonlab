# Mass Skill Icon Generation Plan

**Status:** Executed as `full-catalog-v1`; candidates await owner review

**Date:** 2026-09-03

**Controlling contract:** [Sol skill-icon mass-production goal contract](../../skill-icon-mass-production-goal-contract.md)

## Outcome

The run produces a complete review set for the frozen 456-skill catalog:

- 258 Martial, 124 Magical, and 74 Craft skills;
- 124 motif-family reference sheets, including singleton families;
- 456 independently generated `1024x1024` RGBA framed candidates;
- one contact sheet per motif family and paginated whole-catalog contact sheets;
- exact prompt, provider-source, reference, output, and SHA-256 evidence for every generation.

The owner reviews these candidates after mass generation. Completion of this run does not mean
visual approval or runtime promotion.

## Production method

1. Freeze and hash the catalog, motif map, authored visual specifications, and approved rarity-frame
   authority. Materialize one immutable family prompt and one immutable individual prompt for every
   target.
2. Generate one complete framed sheet for every motif family. Each sheet establishes its shared
   silhouette, action, material, palette, and progression grammar and maps every cell to a canonical
   target ID in adjacent JSON.
3. Generate every skill independently at full provider resolution, parent before child. Each call
   receives the global Painted Emblem reference, approved seven-rank frame reference, its family
   sheet, and its immediate parent image when applicable.
4. Preserve the exact provider PNG. Normalize a separate final candidate to `1024x1024` RGBA,
   removing only edge-connected neutral provider matte and retaining the full frame, crest, letter,
   charcoal interior, and painted emblem.
5. Derive family and catalog contact sheets from the individual candidates. Index exact hashes and
   mark the manifest complete only after every expected artifact validates.

There are no spend or visual-review checkpoints inside this run. A completed independent artifact
is persisted immediately, making interruption and continuation idempotent. Missing work resumes
without regenerating existing outputs.

## Visual contract

- Every tile is a regular point-up hexagon with the approved rarity treatment and integrated F–S
  crest letter.
- F through A remain concrete-first: the acting weapon, body, element, magical operation, craft
  tool, material, ingredient, creature, document, or result remains visible.
- S may become more abstract only when the authored visual specification calls for a pinnacle
  treatment and the family ancestry remains readable.
- No skill name, mastery, level, UI, caption, logo, or watermark is baked into the image. Those
  labels remain interface data.
- Family sheets are consistency references only; individual candidates are fresh generations and
  are never enlarged crops from those sheets.

## Durable outputs

All run artifacts live under:

`assets/wiki/skills/icon-production-v1/mass-production-v1/`

The root contains `manifest.json`, prompt packets, reference sheets and cell maps, normalized icons,
exact provider sources, structured result records, and derived contact sheets. The manifest is the
completion authority and records 580 retained successful provider outputs: 124 family sheets plus
456 individual skills. No automatic corrective output was consumed. One coordinator-worker
interruption and six dependency deferrals were recovered without overwriting any retained output;
the built-in provider exposes retained output evidence rather than a separate billing-call ledger.

## Commands

```bash
pnpm export:skill-icon-mass-production -- --write
pnpm persist:skill-icon-mass-output -- --kind family|skill --id <canonical-id> --source <png>
pnpm finalize:skill-icon-mass-production
pnpm check:skill-icon-mass-production
```

The exporter creates or verifies the frozen queue without replacing completed artifacts. The
persister is collision-safe. Finalization derives contact sheets and completion evidence. The check
command is read-only and rejects missing files, stale hashes, wrong dimensions or alpha mode,
authority drift, and incomplete inventories.

## Review and later promotion

Review starts from `contact-sheets/catalog/page-01.png` or an individual motif-family sheet under
`contact-sheets/families/`. Accepted, revise, and rejected decisions belong to a later additive
review ledger. This run never rewrites historical candidates, silently promotes them, or claims
owner acceptance.
