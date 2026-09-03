# Mass Skill Icon Generation Plan

**Status:** Ready after frame registration and provider-compatibility gates

**Date:** 2026-09-03

**Goal:** Produce a consistent, independently replaceable painted emblem for every canonical skill,
then deterministically place each emblem beneath its fixed rarity frame and above the universal
charcoal backing.

**Current scope:** 456 skills: 258 Martial, 124 Magical, and 74 Craft. The accepted motif map has 104
multi-skill motif families containing 436 skills and 20 standalone skills. All 456 records are mapped,
but all 456 visual specifications, masters, and owner reviews are currently missing.

## Non-negotiable output contract

- Every frame, backing, and skill-art master uses the same 1024×1024 RGBA canvas and center.
- Skill artwork is generated alone. It never contains a rarity frame, rank letter, backing, skill
  name, mastery, level, type badge, UI, or scenery.
- One dominant painted-emblem subject stays within the 64% subject-safe zone. At most one supporting
  cue may extend to the 72% effect-safe zone and never touches the frame or medallion exclusion.
- The final tile is assembled deterministically as backing → skill artwork → fixed rarity frame.
  The UI renders skill name and `MASTERY · LV N` below it. No image generator performs composition.
- Calibration plates establish consistency only. No plate cell is ever cropped into a master.
- Every individual skill master has the same 1024×1024 size, including standalone skills.

## Phase 0 — finish and lock the reusable layers

**Progress:** The registered frame set and its replacement horizontal strip were visually rejected.
The owner selected v6 Variant 2 as the canonical crop source. Its seven frames are now extracted onto
shared 1024×1024 RGBA canvases, and one independently generated Measured Cut emblem is composited
across all rarities. The frame crops and composition pilot await owner review. No rejected frame may
be promoted or used as a future generation reference.

The selected source's checkerboard has been removed deterministically after a provider
background-extraction attempt failed. The crops retain their proportions and share one scale and
canvas center. Obtain owner approval on isolated, composite, and 96-pixel views before promoting the
seven masters.

Locate or restore the already accepted charcoal forged-stone backing, register it to the canonical
aperture, and promote it through the same review gate. Do not start bulk skill generation while any
reusable layer is missing or geometrically inconsistent.

## Phase 1 — freeze and enrich the generation inventory

1. Re-export the canonical taxonomy immediately before dispatch and bind the exact catalog and motif
   map hashes to the rollout revision.
2. Refuse generation if coverage is not exactly one record per canonical skill, a visual parent is
   outside its motif family, or a lineage contains a cycle.
3. Fill all 456 visual specifications. Each record must define:
   - dominant subject or action silhouette;
   - optional single supporting cue;
   - semantic palette and painted material vocabulary;
   - pose, direction, negative-space requirement, and exclusions;
   - motif family and primary visual parent, when applicable;
   - exact rarity used only later during composition.
4. Produce a human-readable inventory grouped by Domain → Family → Motif Family. This is the review
   and restart ledger for the entire run.

New skills added after the freeze enter a subsequent catalog revision. They do not silently alter an
active wave.

## Phase 2 — prove provider compatibility before mass spending

Run a bounded technical pilot with three representative skill artworks: one dark Martial emblem,
one luminous Magical emblem, and one fine-detail Craft emblem. This is specifically an alpha,
safe-zone, and small-size test—not a style-selection exercise.

Because the current provider painted checkerboards into the frame outputs, add and validate a
versioned skill-art normalization route before dispatch. It may accept only one precisely specified
provider envelope and matte, record the original provider hash, create canonical 1024×1024 RGBA, and
reject checkerboards, matte fringe, forbidden-region pixels, and unrecognized containers. Producers
must never remove backgrounds manually.

Stop after these three calls if any output cannot be normalized faithfully. Do not discover the same
provider incompatibility hundreds of images later.

## Phase 3 — generate and approve motif-family calibration plates

Generate at least one reference plate for each of the 104 multi-skill motif families. Each plate shows
three to six representative lineage stages at equal scale using the global Painted Emblem authority.
Eleven continuation plates are required for families longer than six, producing 115 plates in total.

Review each plate for recurring silhouette, progression, palette boundaries, density, negative
space, and separation between adjacent skills. Approved plates become immutable, hash-bound visual
references. The 20 standalone skills skip calibration plates.

Calibration work may run in parallel across motif families. Within one family, continuation plates
remain sequential so the later plate inherits the approved family grammar.

## Phase 4 — controlled individual-skill pilot

Generate fifteen individual masters: five Martial, five Magical, and five Craft, selected from three
approved motif families. Generate each skill independently at 1024×1024 and follow each family from
root to child so a child can reference its approved parent master.

For every retained candidate, automatically derive—not generate—three review views:

1. isolated 1024×1024 artwork;
2. backing + artwork + the skill's correct rarity frame;
3. frame-free 96×96 recognition thumbnail.

The pilot passes only when all fifteen remain distinct at 96 pixels, motif progression is coherent,
composites do not collide with frames or medallions, and provider processing has no manual repair.

## Phase 5 — mass production of all individual masters

After the pilot is accepted, dispatch the remaining 441 skills in collision-safe batches of at most
24 images. Run different motif families in parallel, but preserve root-to-leaf order inside each
family. Standalone skills can run in any batch after their visual specifications are approved.

Each job owns one immutable target, one assignment, one candidate, and one structured result. It
submits the exact prompt and ordered references, generates exactly one raster, and permits at most
one narrowly scoped corrective edit. A failure or `revise` result remains visible and never causes an
automatic retry loop or silent replacement.

After every batch, publish counts for generated, passed technical validation, awaiting owner review,
revised, failed, provider calls consumed, and remaining. Pause the rollout if more than 20% of a
batch needs revision or if the same defect appears three times; fix the shared prompt, plate, or
normalization authority before spending on the next batch.

Suggested rollout order is Craft (74), Magical (124), then Martial (258). This tests the smaller and
more materially varied domain first while preserving family-level consistency. Owner approval can
proceed family by family rather than waiting for all 456 images.

## Phase 6 — promotion, composition, and runtime export

Only explicit owner acceptance promotes a candidate to an immutable master. Promotion updates the
catalog atomically and creates deterministic 512, 256, and 128-pixel derivatives. Composition uses
the catalog rarity to select F–S and never regenerates the emblem when its presentation changes.

Regenerate review sheets from approved masters only. Final validation requires:

- 456 canonical skills, 456 visual specifications, and 456 approved skill-art masters;
- no duplicate target IDs, missing motif assignments, broken parent links, or unreviewed latest jobs;
- valid 1024 RGBA masters and matching 512/256/128 derivatives;
- 456 passing isolated, composite, and 96-pixel recognition views;
- seven promoted rarity frames and one promoted backing sharing exact geometry;
- zero drift between the wiki taxonomy, machine catalog, public manifest, and runtime files.

## Generation budget and checkpoints

The minimum new image-generation budget is 571 calls: 115 calibration plates plus 456 individual
skill masters. The three provider-compatibility images are included among the fifteen pilot masters,
not added on top. A permitted corrective edit can raise the absolute ceiling to 1,142 calls, but no
edit is automatic.

The spend checkpoints are therefore:

1. reusable-layer geometry approval — zero generation calls;
2. provider compatibility — three calls, then stop or proceed;
3. first three calibration plates and fifteen-skill pilot — eighteen initial calls total;
4. remaining calibration plates — 112 initial calls;
5. remaining skill masters — 441 initial calls in visible batches.

No later checkpoint starts without a recorded pass for the previous one. This makes progress and
cost observable and prevents a long-running workflow from completing with no reviewable images.

## Execution handoff

Before execution, convert this plan into versioned target and assignment packets derived from the
frozen catalog. Use the dedicated one-target/one-image production workflow for each plate or skill,
and reserve shared catalog mutation, approval, promotion, composition, and queue coordination for
the coordinator. The first execution deliverable is the geometry overlay plus the three-image
provider-compatibility pilot—not the full 571-call run.
