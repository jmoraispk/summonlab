# Equipment rank-first full-production plan

Status: **complete through owner-reviewed candidate closeout**
Owner: Equipment visual domain
Scope: all 28 canonical materials across the current Weapon, Shield, Staff, and Armour forms

## Completion record

Completed on 2026-09-03. All three owner checkpoints are hash-bound and accepted: four generated
class directions, 77 root candidates, and 84 Armour-piece candidates. The final evidence reconciles
11 direction sheets, 161 dedicated candidates, 11 class audits, 28 material audits, and 21 Armour
set-and-piece audits.

- [Checkpoint 1 directions](../../../assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-1-directions.json)
- [Checkpoint 2 roots](../../../assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-2-roots.json)
- [Checkpoint 3 Armour pieces](../../../assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-3-armour-pieces.json)
- [Candidate closeout](../../../assets/equipment/experiments/material-equipment-v3/runs/material-equipment-v3-run-001/candidate-closeout-v1.json)
- [Proposal-only promotion list](../../../assets/equipment/experiments/material-equipment-v3/reviews/proposed-promotions/candidate-promotion-v1.json)

The recorded run contains 161 base assignments and 49 revision assignments. All 210 attempts have
terminal evidence: 193 succeeded and 17 failed, with 36 intentionally withheld generation calls
also preserved. Final owner decisions total 165 accept, zero revise, zero defer, and zero no-image.
The production remains candidate-only: no approved-source or runtime asset was created, and no
shared runtime catalog was changed.

## Goal

Produce a complete, review-ready Equipment candidate library in which rank is immediately readable,
each material retains its character, and every actual item has a dedicated rendering.

The production rule is:

```text
design seven ranks together by class
→ accept the rank progression
→ render every item individually
→ audit the individual renders by class
→ audit them again by material
→ accept each full Armour set
→ render its four individual pieces
→ close the candidate run
```

Ranking is the primary visual axis. Material coherence is secondary and should come mainly from
palette, finish, texture, construction vocabulary, and bounded supernatural behavior—not identical
geometry across unrelated equipment.

## Confirmed deliverables

### Dedicated candidate images

| Family | Root candidates | Armour-piece candidates | Total |
| --- | ---: | ---: | ---: |
| Metal | 49: five Weapons, Shield, and Heavy Armour set across seven metals | 28 | 77 |
| Wood | 14: Bow and Staff across seven woods | 0 | 14 |
| Hide or scale | 7 Light Armour sets | 28 | 35 |
| Cloth or fibre | 7 Robes sets | 28 | 35 |
| **Total** | **77** | **84** | **161** |

Every one of the 161 candidates is generated as a dedicated image. No progression sheet, contact
sheet, or material sheet is cropped into an item asset.

This means, explicitly:

- seven dedicated Dagger renderings;
- seven dedicated Sword renderings;
- seven each for Spear, Axe, Mace, Shield, Bow, and Staff;
- seven dedicated full-set sources for each Armour class;
- four dedicated piece renderings from every accepted full-set source.

The complete-set image is production evidence rather than a fifth equippable item. Head, Torso,
Legs, and Boots are the four equippable Armour images.

### Original direction and review estimate

The following table preserves the pre-activation estimate. Current results are recorded in the
completion record above and the immutable closeout report.

| Evidence | Total | Already accepted | Still to create | Generation calls |
| --- | ---: | ---: | ---: | ---: |
| Seven-rank class progression sheets | 11 | 7 | 4 | 11 total; 4 remaining |
| Dedicated candidate images | 161 | 0 | 161 | 161 |
| Reassembled class audits | 11 | 0 | 11 | 0; deterministic composition |
| Material-cohort audits | 28 | 0 | 28 | 0; deterministic composition |
| Full-set plus piece audits | 21 | 0 | 21 | 0; deterministic composition |

The complete no-revision evidence set contains **172 generated images**: 11 progression sheets plus
161 dedicated candidates. Seven progression sheets already exist, so **165 new generation calls**
remain before revisions: four missing progression sheets and 161 candidates.

The 60 audit sheets are built automatically from existing candidates and consume no generation
calls. Every revision call is reported separately; it is never hidden by rerunning a batch.

## Accepted direction references

The following experiment images are owner-accepted **direction references**. They are not candidate
or runtime assets.

### Primary rank references

| Class | Path | SHA-256 |
| --- | --- | --- |
| Dagger | `assets/equipment/experiments/material-vs-class-calibration-2026-09-02/approach-b-dagger-class-progression-v1.png` | `6ecc2035df1272044ca96a0f033977e6de3bad02cd1e855c4f04cad9a45394b2` |
| Sword | `assets/equipment/experiments/rank-first-calibration-2026-09-02/sword-metal-ranks-v1.png` | `63835048580050dfae01d4195d26a1a0dc9b8d66546ca2af8540aa5565338f43` |
| Spear | `assets/equipment/experiments/rank-first-calibration-2026-09-02/spear-metal-ranks-v1.png` | `bdfa20d86ca6b2a4c6b9540e6b0924e018cfe749b1dc8981fdead06ded7101bd` |
| Axe | `assets/equipment/experiments/rank-first-calibration-2026-09-02/axe-metal-ranks-v1.png` | `b99400da66d60a542d80683dc8083993dbcca30a2f4a268a77037b3d6fbbb8dd` |
| Mace | `assets/equipment/experiments/rank-first-calibration-2026-09-02/mace-metal-ranks-v1.png` | `b8e12d3b64ec7ac4515ef067b87dad09c5b51b02a1f5d6a1fb13f1c425389359` |
| Shield | `assets/equipment/experiments/rank-first-calibration-2026-09-02/shield-metal-ranks-v1.png` | `fa4f02530a8838cd9ac0738dae28ffdddcbf5f87527f9fc2d2989f4568d936e2` |
| Heavy Armour | `assets/equipment/experiments/rank-first-calibration-2026-09-02/heavy-armour-metal-ranks-v1.png` | `e43eebe931c75330abe54d39b35a97b69bc1e18c2e349c31eff1bb0b096683da` |

Heavy Armour is accepted for rank escalation, silhouette, and finish only. Production sources must
still satisfy the empty, self-supporting set rule without a mannequin or wearer.

### Secondary style reference

The Steel cohort at
`assets/equipment/experiments/material-vs-class-calibration-2026-09-02/approach-a-steel-material-cohort-v1.png`
is the accepted finish and cross-class material-coherence reference, especially for its Axe, Spear,
Dagger, Shield, and Heavy Armour. Its SHA-256 is
`6749ad1a65b995f48b89b0c1c8c8ee051da145315f5fd60775803f691ad7b887`.

### Individual-render method references

The Bronze and Sunsteel Dagger reconstructions prove that a progression design can become a
dedicated rendering without cropping. They remain experiment references because their portrait
canvas and provenance predate the v3 manifest:

- Bronze: `47022bbdf47bb370b1a84156190f8a7bab75c1f999c7b126fc3e8e7dcd47ec08`
- Sunsteel: `8c5c69fc6a02b6eaa71bb6cfa679fb19f3c12b775ca85722cb282350a5e97cd1`

## Creative contract

### Rank progression

Each class is designed as one ordered F-to-S sheet before individual production:

| Rank | Visual intent |
| --- | --- |
| F | practical, readable, appealing, minimal ornament |
| E | sturdier and more deliberate than F |
| D | refined professional construction |
| C | bold silhouette and first clearly supernatural construction cues |
| B | elegant or powerful material behavior; visibly exceptional |
| A | extraordinary geometry and ornament without losing class identity |
| S | legendary silhouette, strongest material behavior, controlled spectacle |

Adjacent ranks must differ through at least one structural cue visible at phone-thumbnail size.
Palette may reinforce the order but cannot establish it alone.

### Class recognition

Camera, pose family, normalized footprint, and lighting remain comparable within a class. The item
geometry is free to change:

| Class | Stable identity | Primary variation levers |
| --- | --- | --- |
| Sword | long cutting blade and usable grip | profile, fuller, guard, pommel, negative space |
| Dagger | compact one-hand fighting weapon | point, blade mass, guard, hooks, cutouts |
| Spear | metal head on a long shaft | head profile, socket, wings or lugs, shaft fittings |
| Axe | one dominant cutting bit on a haft | beard, bit sweep, poll, socket, bounded cutouts |
| Mace | weighted striking head on a practical haft | flange count, crown, head mass, haft fittings |
| Shield | one-hand defensive face and grip | outline, boss, ribs, rim, apertures |
| Bow | two limbs, grip, and readable string | recurve, limb profile, tips, inlay |
| Staff | full-length wood-led magical focus | crown gesture, growth, rings, fittings, inlay |
| Heavy Armour | broad articulated metal protection | plate cut, overlap, helmet, shoulders, fauld |
| Light Armour | mobile hide- or scale-led protection | panels, scale direction, closures, layering |
| Robes | cloth-led draped equipment | hem, sleeves, collar or hood, layers, weave behavior |

The core ladder still contains one mechanical class per row. Visual forms such as round Shield or
hero-shaped Shield do not create subclasses or additional skill families.

### Material coherence

Each of the 28 materials receives one concise text brief defining:

- base palette and value range;
- honest surface response and wear;
- dominant construction vocabulary;
- allowed supernatural behavior;
- neutral secondary materials;
- explicit differences from its neighboring ranks.

These briefs apply across classes. They should make two Steel items feel materially related without
forcing their silhouettes to match. If rank clarity conflicts with cross-class material uniformity,
rank clarity wins.

### Armour consistency

Armour has two separate consistency requirements:

1. seven material sets in one Armour class must show a readable rank progression;
2. the accepted full set and its Head, Torso, Legs, and Boots must match exactly.

Every full set uses a consistent mild three-quarter front view and shows exactly four readable slot
components. It is empty and self-supporting, with natural cavity shadows only. No body, mannequin,
black void figure, or pose dummy is permitted.

## Image specifications

- isolated candidate master: 1024×1024 PNG;
- full Armour-set master: 1024×1536 PNG;
- individual Armour-piece master: 1024×1024 PNG;
- required framing margin: at least 5%, targeting approximately 8%;
- phone review sizes: 128px and 256px;
- future mobile derivatives: 512×512 isolated items and 512×768 full sets;
- no concept-sheet crops, upscales, or silent aspect-ratio substitutions.

Runtime derivatives and compression settings are a later integration step. Source masters remain
lossless and provenance-bound.

## Additive v3 layout

Create a new Equipment-local namespace without changing v1 or v2:

```text
assets/equipment/experiments/material-equipment-v3/
├── README.md
├── manifest.json
├── direction/
│   ├── class-progressions/
│   └── material-briefs/
├── assignments/<family>/<rank>/<material>/
├── candidates/<family>/<rank>/<material>/
├── results/<family>/<rank>/<material>/
├── reviews/
│   ├── class-audits/
│   ├── material-audits/
│   └── armour-piece-audits/
└── runs/<run-id>/
```

Direction references, candidates, human approvals, and runtime assets remain separate. The v3
manifest points to accepted experimental references by exact path and hash; it does not duplicate or
silently promote them.

Reuse the v2 target, assignment, result, exclusive-write, and terminal-evidence mechanisms. Add only
the minimum fields needed to bind a target to its class progression and material brief. Do not create
another shared runner or modify shared runtime catalogs.

## Implementation phases

### Phase 0 — Build the v3 planning package

1. Create the v3 directory and immutable manifest.
2. Preserve the existing 161-target mapping and 77-root/84-child dependency structure.
3. Add direction-reference hashes for the seven accepted progression sheets and Steel style sheet.
4. Author all 28 concise material briefs.
5. Materialize collision-safe target and assignment paths.
6. Validate exact counts, unique IDs, dependency closure, reference hashes, and output ownership.

No image generation is activated in this phase.

### Phase 1 — Complete progression direction

Generate the four missing seven-rank sheets:

- Bow across Ash, Yew, Ironwood, Heartwood, Spiritwood, Living Branch, and Worldtree Limb;
- Staff across the same wood ladder;
- Light Armour across Coarse Hide, Hard Leather, Beast Scale, Chitin, Drakescale, Wyrmscale, and
  Ancient Dragon Scale;
- Robes across Hemp Weave, Wool, Layered Silk, Spellweave, Moonweave, Starcloth, and Fateweave.

Use the accepted finish and Dagger escalation rhythm as style references without copying geometry.
Review all 11 class sheets together at full size and phone-thumbnail size.

**Owner checkpoint 1:** accept, revise, or defer the four new sheets and confirm the consolidated
11-class direction library.

### Phase 2 — Generate all 77 dedicated roots

The creative continuity lane is the class. One lane receives one accepted progression sheet and
generates its seven ranks sequentially from F through S:

- eight isolated lanes: Sword, Dagger, Spear, Axe, Mace, Shield, Bow, Staff;
- three full-set lanes: Heavy Armour, Light Armour, Robes.

Different class lanes run concurrently, giving 11 active creative lanes under the 16-worker ceiling.
Each target still owns a unique candidate and result path. Workers never append to a shared result
file.

Every individual prompt includes:

1. the accepted class progression as primary design reference;
2. the target material brief;
3. the accepted finish reference;
4. the exact rank design selected from the progression;
5. the class pose, framing, and mobile-readability requirements;
6. a prohibition on cropping, extra objects, and recognizable reference copying.

The two existing individual Daggers validate this method but do not replace the manifest-bound
Bronze and Sunsteel candidates.

### Phase 3 — Audit rank first, material second

After all 77 roots are persisted:

1. deterministically compose 11 class audits from the dedicated candidates;
2. review F-to-S ordering, silhouette separation, class recognition, pose, and thumbnail readability;
3. revise only the weak or drifting candidates;
4. compose 28 material-cohort audits;
5. review palette, finish, texture, construction vocabulary, and supernatural behavior;
6. revise material outliers without homogenizing class silhouettes.

The class audit is the primary acceptance gate. A candidate cannot be preserved merely because it
matches its material cohort if it weakens rank readability.

**Owner checkpoint 2:** one hosted, filterable gallery containing all 11 class audits, 28 material
audits, and dedicated root images. Every root receives accept, revise, or defer.

### Phase 4 — Generate 84 Armour pieces

An Armour set unlocks children only after its dedicated full-set source passes:

- its class progression audit;
- its material-cohort audit;
- the empty-set and four-component checks.

Generate Head, Torso, Legs, and Boots as four dedicated images. The accepted full-set candidate must
be the first reference, and each prompt forbids redesign. The four children of one set may run in
parallel; global piece concurrency remains capped at 16.

Compose 21 five-image audits in the required order: full set, Head, Torso, Legs, Boots. Review
material, silhouette language, palette, trim, fastenings, wear, ornament, and slot boundary.

**Owner checkpoint 3:** one hosted gallery containing all 21 Armour audits and their dedicated piece
images.

### Phase 5 — Candidate closeout

Reconcile the immutable run and report:

- 11 progression sheets and their owner decisions;
- 77 verified root candidates;
- 84 verified Armour pieces;
- 11 reproducible class audits;
- 28 reproducible material audits;
- 21 reproducible Armour audits;
- every revision and failed call;
- final accept/revise/defer/no-image totals;
- exact branch, commits, validations, and unresolved integration requests.

This phase stops at reviewed Equipment candidates. Approved-source promotion and runtime catalog
integration require a separate owner decision and coordination with the root orchestrator.

## Parallelism and ownership

- At most 11 class lanes run during root production; keeping one class progression in one context is
  more valuable than filling all 16 slots.
- Up to 16 workers may run during Armour-piece production because the accepted full-set source binds
  the four children visually.
- Every worker receives an immutable assignment and writes only its candidate and provenance result.
- The Equipment orchestrator alone writes review composites, review receipts, and run closeout.
- Existing v1/v2 outputs are read-only evidence and never output destinations.
- No worker edits engine contracts, creature assets, unrelated visual domains, approved catalogs, or
  runtime catalogs.

## Revision rules

- Progression-sheet weakness is fixed before dedicated candidates begin.
- A class-audit collision revises the weaker individual candidate, not the entire class.
- A material-audit mismatch revises finish or material expression without undoing rank silhouette.
- A failed full Armour set produces no child jobs.
- A mismatched Armour child is revised against the same accepted full-set source.
- Successful siblings remain immutable.
- Failed calls remain terminal evidence; retries create new versioned attempts.
- `candidate` means reviewable, never approved.

## Validation

Before activation:

- exactly 28 materials, 161 candidate targets, 77 roots, and 84 Armour children;
- exactly seven target ranks per class;
- exactly four children per full Armour set;
- every direction path exists and matches its recorded SHA-256;
- every candidate/result path is unique and Equipment-local;
- no target points into v1, v2, approved, or runtime output paths.

Before closeout:

- every PNG decodes and matches its required dimensions;
- every candidate hash and prompt/reference record verifies;
- every class and material audit is reproducible from exact candidate hashes;
- every Armour piece binds to one accepted full-set hash;
- no missing terminal result or unrecorded retry;
- repository tests and deterministic exporters pass;
- working tree is clean after each committed and pushed batch.

## Reviewable implementation batches

1. **v3 package:** manifest, material briefs, minimal bindings, validators, and zero generated images.
2. **direction completion:** four missing class progression sheets and owner checkpoint 1.
3. **root production:** 77 dedicated candidates, two-axis audits, targeted revisions, and owner
   checkpoint 2.
4. **Armour production:** 84 dedicated pieces, 21 set audits, targeted revisions, and owner
   checkpoint 3.
5. **closeout:** reconciled evidence and a separate proposed promotion list.

Each batch is independently validated, committed, and pushed. Image generation begins only after the
owner explicitly authorizes the relevant batch.

## Definition of done

The plan is complete when all 161 dedicated candidates are reviewable, every one is traceable to an
accepted class progression and material brief, ranking reads clearly from F through S, every Armour
piece matches its accepted full set, the three review checkpoints are recorded, and no asset has been
silently promoted into approved or runtime state.
