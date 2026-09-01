# Material equipment production v1

Status: **planning only**. This directory reserves collision-safe candidate, provenance-result, and
human-review paths for the canonical material Equipment wave. It contains no generated, approved,
or runtime images.

The checked [manifest](manifest.json) expands the four material ladders into 161 image targets:

- 140 isolated Equipment item images;
- 21 full-set Armour consistency images;
- seven rank waves, each containing 23 targets.

## Armour dependency gate

Every Armour material has exactly one ordered five-target sequence:

1. complete set;
2. Head;
3. Torso;
4. Legs;
5. Boots.

The four pieces declare the complete-set target through `dependsOnTargetId`. A piece may not enter
generation until human review accepts that complete-set candidate as its consistency source. The
source image is production evidence rather than a fifth equippable item.

Weapons, Shield, and Staff do not depend on an Armour source and do not need to match one.

## Lifecycle boundary

All manifest entries begin as `planned`. Their paths are reservations only:

- `candidates/` is for unapproved generated images;
- `results/` is for generation and persistence provenance;
- `reviews/` is for human review evidence.

The manifest deliberately reserves no approved-source or runtime-export path. Approval and runtime
promotion are later integration actions and must not be inferred from generation success.

## Generation boundary

The current `summonlab-image-production` target contract is enemy-specific and does not accept this
Equipment manifest. Do not dispatch these entries through that contract. Before image production,
the image-production owner must provide an Equipment profile with per-target manifests,
assignments, reference routing, prompt rendering, persistence, and result verification under this
directory.

## Deterministic maintenance

Regenerate the manifest after an accepted Equipment vocabulary change:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-material-production.ts
```

Verify that the committed manifest matches the generator:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-material-production.ts --check
```
