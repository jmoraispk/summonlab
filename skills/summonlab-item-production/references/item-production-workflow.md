# Item production workflow

Use this reference for implementation. Scale the artifacts to the request, but preserve the
lifecycle boundaries. A single unranked consumable may need one row and one image; a ranked Equipment
class needs a complete matrix and review campaign.

## 1. Discover authority and current truth

1. Read repository instructions and inspect the current branch, worktrees, and dirty files.
2. Find the canonical item theory, material vocabulary, class/slot model, content catalog, approved
   visual catalog, runtime resolver, acquisition logic, UI, and validators.
3. Identify the domain owner for every file that might change. Keep proposals in the item domain
   until shared-contract integration is discussed.
4. Classify existing artifacts by lifecycle state. Do not treat a polished gallery, closeout, or
   selected candidate as approved unless an approval manifest or receipt says so.
5. Record accepted decisions and open questions. Prefer one reversible assumption over inventing a
   system that the request does not need.

## 2. Define one canonical item model

Write the item’s player meaning before its appearance:

- stable ID, display name, class, family, and owning feature;
- slot/hand/stack/consumption rules;
- primary effect or use, without balancing unrelated systems;
- base rank source, material compatibility, and item difficulty;
- craftsmanship relationship;
- acquisition and provenance kinds;
- set membership and required continuity anchor;
- visual use cases: direction board, approved master, card, detail, scene, icon, or animation;
- non-goals and deferred variants.

Keep the mapping simple. Material plus form normally selects the authored definition and source art.
Craftsmanship can raise final rank or benefits when the rules say so, but should remain instance data
unless the owner explicitly commissions separate quality artwork.

If two acquisition routes yield the same authored item, call the same item factory or definition
resolver. Preserve origin on the instance instead of cloning definitions.

## 3. Build the coverage matrix

Generate a machine-readable matrix before prompts or filenames. Cross only axes that change an
actual deliverable:

- item class or form;
- retained material;
- rank;
- slot or set piece;
- approved usage size;
- explicitly authorized variant.

Derive counts from the matrix. Reject duplicate IDs and paths. For ranked material equipment, the
default matrix includes every retained rank and every legal material. For a set, count one full-set
reference plus every individual member. Do not multiply images for provenance, craftsmanship, hand
occupancy, or cosmetic families unless those variables really select different art.

State the math in both forms when useful: per rank and per material. This catches missing cells and
makes the production cost legible before generation.

**Example:** an approved new one-piece metal weapon form in the current seven-rank ladder adds seven
individual item cells—one for each retained metal—and one reference-only seven-rank direction board.
It does not add seven more images for Forged versus Dropped origin or for Standard versus deferred
craftsmanship grades. Each individual joins its same-material cohort review before promotion.

## 4. Gather and bind references

Store durable references with a README or manifest recording source, date, rights/provenance, hash,
and purpose. Route each input narrowly:

- silhouette ambition;
- item-class readability;
- material finish and construction;
- camera, pose, framing, or lighting;
- rank-escalation rhythm;
- complete-set continuity;
- style target or negative example.

Do not ask one reference to control everything. Never promote a reference-only study or crop its
cells into final items. References may inspire original geometry but cannot authorize recognizable
copying.

## 5. Produce direction anchors

Before a large run, make the smallest boards that test the real uncertainties:

1. one full-rank class board to calibrate `F → S` progression;
2. one same-material cohort containing all applicable item forms to calibrate material language;
3. one full-set anchor for each set family that needs internal continuity;
4. two or more dedicated individual reconstructions—usually a low rank and a high rank—to prove
   accepted board designs can survive standalone rendering.

Direction studies remain references. Record what each one proved and any aspect that is explicitly
noncompliant for production.

## 6. Create production contracts

For more than a trivial handful of images, use a versioned manifest and immutable assignments.
Each target should bind:

- stable target and assignment IDs;
- canonical item/material/rank/slot identity;
- exact references in semantic order and their hashes;
- complete prompt material or deterministic prompt inputs;
- dimensions, framing, background, and required negative constraints;
- owned candidate/result paths;
- permitted outputs and forbidden shared outputs;
- retry ceiling and correction policy;
- acceptance criteria and review group;
- schema/profile version.

Validate manifests before dispatch. A plan or materialization command creates contracts; it does not
create pixels. Report these phases separately:

1. theory/coverage ready;
2. targets and assignments materialized;
3. pixel production launched;
4. candidates persisted;
5. review complete;
6. approved promotion complete;
7. runtime/content integration complete.

## 7. Generate collision-safe candidates

Use the available image-generation tool best suited to the brief. When a compatible manifest-bound
assignment exists, use `summonlab-image-production` for each target. Direction boards may use the
general image-generation tool, but must remain in reference/experiment paths.

Parallelize only independent targets. Give each worker exact read inputs and exclusive versioned
outputs. Keep shared manifests, catalogs, contact sheets, approval decisions, and promotion files
coordinator-owned. Persist the exact path returned by the generation call; do not scan a shared
directory for the newest image.

Perform bounded visual correction. Preserve passing traits and change the smallest failed property.
Do not silently retry provider failures or overwrite an occupied destination.

## 8. Review in the right order

Review direction and identity before detail polish:

1. **Coverage:** every expected target exists once and no unexpected target exists.
2. **Class recognition:** the form reads correctly at phone size.
3. **Rank progression:** adjacent ranks and the full `F → S` ladder escalate through silhouette,
   construction, ornament, and bounded supernatural behavior—not color alone.
4. **Material coherence:** every retained material is represented; same-material cohorts share
   palette, finish, joinery, and construction logic across applicable forms.
5. **Material distinction:** changing material visibly changes the item rather than recoloring a
   template.
6. **Set continuity:** full-set anchor and individual pieces agree in cut, material, trim, lighting,
   and construction.
7. **Production hygiene:** complete object, stable pose/camera, safe margins, no text, watermark,
   extra subject, accidental mannequin, or unfinished canvas.
8. **Individual quality:** inspect accepted candidates at native resolution after the comparison
   sheets pass.

Group galleries by rank, material, form, and review state. Use `accept`, `revise`, `experiment`, or
`defer` explicitly. Never encode human approval in a producer result.

## 9. Promote accepted masters

Promotion requires explicit owner acceptance bound to exact candidate paths and hashes. Before
writing:

- rebuild the expected promotion plan without writes;
- verify the candidate, result, selection, and checkpoint chain;
- require a clean or safely isolated tree;
- ensure every destination is absent or exactly matches an already recorded idempotent promotion;
- copy source bytes exactly; do not resize, strip metadata, repaint, or normalize;
- write a strict manifest and promotion receipt;
- verify all expected and unexpected files afterward.

Approved masters are inert source assets. Do not load them directly in the initial phone bundle.

## 10. Export runtime derivatives

Runtime exporters read the approved manifest only. Produce content-hashed, size-budgeted outputs for
actual use cases such as card and detail. Strip irrelevant metadata during deterministic derivation,
reserve dimensions to avoid layout shift, and load item art lazily by definition. Reference-only
full sets do not become equippable runtime entries.

Validate exact counts, source hashes, derivative hashes, dimensions, byte budgets, stale files,
unexpected files, and initial payload contribution. Generate a review gallery that links each
runtime derivative back to its approved source and hash evidence.

## 11. Bind content and runtime behavior

Create one canonical definition per legal matrix cell and bind it to stable visual aliases. Then add
only the authorized behavior:

- schema/version compatibility;
- item-instance factory and provenance;
- inventory ownership and legal equip/use slots;
- forging, gathering input, drop, shop, or reward seam;
- persistence, idempotency, replay, catch-up, and migration behavior where applicable;
- inspection and phone UI;
- lazy visual resolution.

Test the same definition through multiple origins when applicable. Their authored fields and visual
bindings must agree; only origin and explicitly allowed initial condition may differ.

## 12. Close out with evidence

Run focused validators first, then the widest safe repository checks. Verify no generator rewrites
tracked outputs unexpectedly. Produce a deterministic integration report containing counts, hashes,
versions, commands, evidence paths, commits, and deferred work.

Commit reviewable batches and push them according to repository instructions. Report the branch,
commit hash and subject, push destination, clean-tree state, validation results, galleries, and any
shared-catalog integration request.
