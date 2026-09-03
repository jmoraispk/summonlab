# Equipment material-first full-production plan

Status: **superseded; do not activate**
Owner: Equipment visual domain  
Scope: the 28-material core ladder, six Weapons, Shield, Staff, and three four-piece Armour classes

## Outcome

Produce a complete review-ready Equipment candidate library using a hybrid workflow:

1. establish each material as a coherent equipment family;
2. render every actual item individually from that material anchor;
3. compare each item class across all seven materials;
4. revise only repeated or weak silhouettes;
5. derive Armour pieces only from accepted full-set sources.

The material cohort sheets are design anchors, not item assets. They must never be cropped into
individual files. The final candidate library still contains one dedicated rendering for every item
and, for Armour, one full-set source plus four dedicated piece renderings.

The accepted Dagger calibration sheet is a creative-direction benchmark for silhouette ambition and
rank escalation. It is not an approved source and its pictured designs are not production assets.

> **Calibration hold — 2026-09-02:** the owner has made cross-rank class progression the primary
> design axis and material cohesion the secondary review axis. This earlier material-first ordering
> must not be activated. It is superseded by the final
> [rank-first full-production plan](2026-09-02-equipment-rank-first-full-production.md).

## Locked creative rules

- Generate and review by material first. Every material gets a coherent construction language,
  finish, wear, ornament vocabulary, and supernatural intensity.
- Review by class second. Sword, Dagger, Spear, Bow, Axe, Mace, Shield, Staff, Heavy Armour, Light
  Armour, and Robes must each remain readable while changing visibly across materials.
- Camera, pose, framing, and normalized footprint are comparison anchors. Exact geometry is not.
- Material identity must alter silhouette, construction, proportion, or ornament. Palette alone is
  insufficient.
- F and E are grounded but attractive; D is refined; C and B may show bounded supernatural
  construction; A and S carry the most ambitious shapes and effects.
- The core ladder gets one visual form per class and material. Round Shield, composite Bow, hero
  Shield, and similar forms do not become new mechanical classes or randomized variant pools.
- Named and monster-derived equipment may exceed this visual range later without changing the six
  Weapon classes.
- All designs must remain legible at approximately 128 CSS pixels on a phone.

## Image math

### Production candidates

| Family | Root forms per material | Materials | Root images | Armour pieces | Candidate total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Metal | Sword, Dagger, Spear, Axe, Mace, Shield, Heavy Armour set: 7 | 7 | 49 | 28 | 77 |
| Wood | Bow, Staff: 2 | 7 | 14 | 0 | 14 |
| Hide or scale | Light Armour set: 1 | 7 | 7 | 28 | 35 |
| Cloth or fibre | Robes set: 1 | 7 | 7 | 28 | 35 |
| **Total** |  | **28** | **77** | **84** | **161** |

The 21 full-set images are production evidence and design sources, not equippable items. The 84
separate Armour-piece images are the equippable Head, Torso, Legs, and Boots assets.

### Additional production evidence

| Evidence | Count | Creation method |
| --- | ---: | --- |
| Metal material-cohort concept sheets | 7 | Generated; seven root forms per sheet |
| Wood material-cohort concept sheets | 7 | Generated; Bow and Staff per sheet |
| Hide/scale and cloth material anchors | 14 | Their full-set root candidates already serve this role |
| Cross-material class review sheets | 11 | Deterministically composed from candidates; no image-generation call |
| Full-set plus four-piece audit sheets | 21 | Deterministically composed from candidates; no image-generation call |

The no-revision baseline is therefore **175 generated images**: 14 cohort concept sheets plus 161
candidate images. The 32 review sheets add no image-generation calls. Revisions are counted and
reported separately rather than hidden in the baseline.

## Individual rendering contract

Every candidate is generated as its own complete image:

- isolated item: 1024×1024 master;
- full Armour set: 1024×1536 master;
- separate Armour piece: 1024×1024 master;
- no crops from a concept sheet or contact sheet;
- no multi-item image used as a runtime item;
- paired Boots remain one item image containing the matching pair;
- every candidate records its exact prompt, reference hashes, output hash, dimensions, and review
  status.

The future mobile export should derive 512×512 isolated items and 512×768 full sets. Masters remain
available for zoomed inspection and future re-export. Runtime export and catalog integration require
separate authorization.

## Variation guide by class

| Class | Keep recognizable | Let the material change |
| --- | --- | --- |
| Sword | long cutting blade, usable grip | blade profile, fuller, guard, pommel, negative space |
| Dagger | compact one-hand fighting weapon | point geometry, blade mass, guard, hooks, cutouts |
| Spear | compact head on a long shaft | head profile, socket, wings or lugs, shaft treatment |
| Bow | two-limbed ranged weapon with readable string | limb profile, recurve, grip, tips, inlay |
| Axe | single dominant cutting bit on a haft | beard, bit sweep, poll, socket, bounded cutouts |
| Mace | weighted striking head on a practical haft | flange count, crown profile, head mass, haft fittings |
| Shield | one-hand defensive face and grip | outline, boss, ribs, rim, apertures, surface construction |
| Staff | full-length wood-led magical focus | crown gesture, branching, rings, growth, fittings, inlay |
| Heavy Armour | broad articulated metal protection | plate cut, overlap, helm, shoulder and skirt silhouette |
| Light Armour | mobile hide- or scale-led protection | paneling, scale direction, closures, hood or helm, layering |
| Robes | cloth-led draped equipment | hem, sleeves, collar or hood, layers, weave behavior, trim |

These are variation levers, not requirements to maximize every feature. Each candidate should have
one dominant silhouette idea and one supporting material cue.

## Additive v3 workspace

Create `assets/equipment/experiments/material-equipment-v3/` without mutating v1 or v2:

```text
material-equipment-v3/
├── README.md
├── manifest.json
├── concepts/<family>/<rank>/<material>/
├── assignments/<family>/<rank>/<material>/
├── candidates/<family>/<rank>/<material>/
├── results/<family>/<rank>/<material>/
├── reviews/material-cohorts/
├── reviews/class-progressions/
├── reviews/armour-piece-audits/
└── runs/<run-id>/
```

Concept sheets, candidates, review evidence, approved sources, and runtime exports remain distinct.
Workers write only their assigned material directory and per-target provenance result. The Equipment
orchestrator alone composes review sheets and records review decisions. No shared runtime catalog,
engine contract, or unrelated visual domain changes in this plan.

Reuse the working v2 target, assignment, result, and exclusive-write mechanisms where they fit.
Add only the minimum v3 bindings needed to hash each candidate to its accepted material-cohort
anchor. Do not introduce another general runner or shared catalog.

## Execution phases

### Phase 0 — Freeze direction and prepare packets

1. Record the Dagger calibration as an owner-accepted **direction reference**, not an asset approval.
2. Materialize the additive v3 manifest and collision-safe output paths.
3. Give every material a concise brief containing:
   - material character;
   - rank intensity;
   - allowed physical or supernatural behavior;
   - one construction motif;
   - one silhouette objective per mapped class;
   - explicit avoid-list for neighboring materials.
4. Validate that all 161 candidate targets exist exactly once and all 84 Armour pieces depend on one
   full-set target.

Exit condition: deterministic plan, zero candidate images, and no shared integration changes.

### Phase 1 — Material-cohort anchors

Generate seven Metal sheets and seven Wood sheets. Each material sheet is one coherent concept pass:

- Metal: Sword, Dagger, Spear, Axe, Mace, Shield, and empty Heavy Armour set.
- Wood: Bow and Staff.

Review the 14 sheets together for material separation. Reject a sheet before individual rendering if
its family could be mistaken for a neighboring material or if its classes are not readable.

Hide/scale and cloth/fibre proceed directly to their full-set root images in Phase 3 because one
Armour set already functions as the complete material anchor.

**Owner checkpoint 1:** one hosted gallery containing all 14 cohort sheets, organized by rank and
family. The owner accepts, revises, or defers each material direction.

### Phase 2 — Individual Metal and Wood roots

Assign one material lane per accepted material. A material lane produces its mapped item classes
sequentially, always using its accepted cohort sheet as the primary direction reference. Different
material lanes may run in parallel.

- seven Metal lanes produce 49 individual roots;
- seven Wood lanes produce 14 individual roots;
- up to 14 lanes may be active under the 16-worker ceiling;
- a lane owns only its material paths and never updates a shared result file.

Once all 63 images exist, deterministically compose progression sheets for Sword, Dagger, Spear,
Axe, Mace, Shield, Bow, and Staff. Compare all seven materials per class at full size and at 128px.
If two ranks collide visually, revise the weaker individual candidate without redesigning the whole
material cohort.

### Phase 3 — Full Armour-set roots

Generate all 21 full sets:

- seven Heavy Armour sets, already guided by accepted Metal cohort sheets;
- seven Light Armour sets, one per hide/scale material;
- seven Robes sets, one per cloth/fibre material.

Every set must show exactly Head, Torso, Legs, and paired Boots; use the locked three-quarter camera;
remain empty and self-supporting; and use natural cavity shadow without a mannequin or void figure.

Compose Heavy Armour, Light Armour, and Robes progression sheets across their seven materials. Check
that each set is internally coherent and that different materials do not reuse one cut.

**Owner checkpoint 2:** one hosted gallery containing the eight isolated-class progression sheets
and three Armour progression sheets. No Armour children unlock until their source set is accepted.

### Phase 4 — Individual Armour pieces

For each accepted full set, generate four dedicated candidates: Head, Torso, Legs, and Boots. The
accepted full set must be the first visual reference, and the piece prompt forbids redesign.

The four children of one set may run in parallel. Across the run, claim no more than 16 piece jobs at
once. A failed child can be revised independently unless review shows that the accepted set itself
is ambiguous.

Compose one five-image audit sheet per material: full set followed by Head, Torso, Legs, and Boots.
Review material, silhouette language, palette, trim, fastenings, wear, ornament, and slot boundary.

**Owner checkpoint 3:** one hosted gallery containing all 21 set-and-piece audit sheets. This is the
final candidate review, not runtime promotion.

### Phase 5 — Completion and handoff

The candidate run is complete only when:

- all 14 cohort sheets have terminal provenance and review decisions;
- all 77 root candidates exist with verified hashes and dimensions;
- all 84 Armour-piece candidates exist and bind to accepted full sets;
- all 11 class progression sheets and 21 Armour audit sheets are reproducible;
- every candidate has a terminal status and no silent retry or replacement occurred;
- the Equipment wiki records the accepted direction and remaining revisions;
- approved and runtime directories remain unchanged unless separately authorized.

Report the initial 175 generation calls, every revision call, final candidate/revise/fail totals,
branch, commits, validation commands, and any integration request.

## Revision policy

- Fix a weak material concept before generating its individual roots.
- During class review, revise only the candidates that repeat another rank or fail material identity.
- Keep successful siblings immutable; never rerun a whole rank merely for symmetry.
- If a full Armour set fails, do not generate its four pieces.
- If one Armour piece fails to match, revise that piece against the same accepted source.
- Preserve every unsuccessful terminal result as provenance evidence.
- Promotion is always a separate human decision; `candidate` never means approved.

## Parallelism model

The unit of creative continuity is the **material lane**, while the unit of filesystem ownership is
the **individual target**. This preserves the benefit of same-material production without creating
write collisions:

```text
accepted material cohort
→ one material lane generates its mapped roots sequentially
→ different materials run in parallel, up to 16 workers
→ deterministic class sheets expose cross-material repetition
→ targeted revisions only
→ accepted full Armour set unlocks four bounded child jobs
```

The orchestrator may use fewer than 16 workers when a single material lane would otherwise be split
across contexts. Creative continuity takes priority over filling every slot.

## Implementation batches

1. **v3 plan and material briefs** — manifest, paths, validators, and review evidence only.
2. **cohort production** — 14 concept sheets and owner checkpoint 1.
3. **root production** — 63 isolated Metal/Wood roots plus 21 Armour roots and owner checkpoint 2.
4. **piece production** — 84 Armour children and owner checkpoint 3.
5. **candidate closeout** — provenance reconciliation, final report, and proposed promotion list.

Each batch is independently reviewable, committed, and pushed. Activating image generation requires
an explicit owner go-ahead after the plan and material briefs are reviewed.
