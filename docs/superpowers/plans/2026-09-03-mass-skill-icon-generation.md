# Mass Skill Icon Generation Plan

**Status:** Ready for owner review; execution remains gated by the reset frame import and the
three-domain production pilot

**Date:** 2026-09-03

**Goal:** Produce a consistent, independently replaceable painted emblem for every canonical skill,
then deterministically place each emblem beneath its fixed rarity frame and above the universal
charcoal backing.

**Current scope:** 456 skills: 258 Martial, 124 Magical, and 74 Craft. The accepted motif map has 104
multi-skill motif families containing 436 skills and 20 standalone skills. All 456 records are mapped,
but all 456 visual specifications, masters, and owner reviews are currently missing.

## Non-negotiable output contract

- Every frame, backing, and skill-art master uses the same 1024×1024 RGBA canvas and center.
- Provider source dimensions and alpha mode are transport details. Retained masters are always
  normalized to the shared 1024×1024 RGBA contract without inventing detail by upscaling a contact
  sheet crop.
- Skill artwork is generated alone. It never contains a rarity frame, rank letter, backing, skill
  name, mastery, level, type badge, UI, or scenery.
- One dominant painted-emblem subject stays within the 64% subject-safe zone. At most one supporting
  cue may extend to the 72% effect-safe zone and never touches the frame or medallion exclusion.
- The final tile is assembled deterministically as backing → skill artwork → fixed rarity frame.
  The top crest and its F–S letter are permanent parts of that frame, not another runtime layer.
  The UI renders skill name and `MASTERY · LV N` below it. No image generator performs composition.
- Motif-family calibration plates establish consistency only and are never cropped into masters.
  The owner-designated reset rarity sheet is a visual reconstruction authority, not a runtime sprite
  sheet or permission to upscale its crops into masters.
- Every individual skill master has the same 1024×1024 size, including standalone skills.
- Normal visual approval uses the full 1024 master and a 384×384 composite representing the intended
  300–400-pixel interface range. A 96-pixel thumbnail may be retained as optional diagnostic
  evidence, but it is never a production-quality target or an approval gate.
- Concrete readability is the default. For Blade cut motifs from F through A, a visible blade makes
  the cut; a free-floating slash, split plane, or abstract wound cannot replace the acting blade.
  S skills may become abstract when the abstraction expresses the named pinnacle outcome more
  clearly, but they must retain recognizable motif-family ancestry. Other equipment, body, magical,
  and craft motifs apply the same rule to their own acting tool, body, element, material, or process.

## Phase 0 — finish and lock the reusable layers

**Progress:** Previous frame candidates remain historical evidence. The owner reset the visual
authority to the seven-frame sheet at
`/home/joao/.codex/generated_images/01a058d5-4568-76e1-bae0-81d6988ab046/exec-aba43e6f-7d3d-4fec-a87d-cd3c1b1aecc3.png`
(1484×1060 RGB; SHA-256
`4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266`). Its checkerboard is
painted into RGB pixels, so the sheet is a visual authority rather than a transparent runtime sprite
sheet.

Execution first imports those exact bytes into a versioned repository source record, then creates
one mathematically regular point-up chassis with a common aperture and fixed crest socket. Each
rarity treatment is reconstructed against that chassis while preserving its integrated letter,
material, and ornament. The resulting seven 1024×1024 frame masters must have transparent centers
and exteriors, identical registration, and successful full-size plus 384-pixel composite review.
The charcoal backing must overlap beneath the rim without becoming part of the frame. No bulk skill
generation starts while any reusable layer is missing, geometrically inconsistent, or visually
unapproved.

## Phase 1 — freeze and enrich the generation inventory

1. Re-export the canonical taxonomy immediately before dispatch and bind the exact catalog and motif
   map hashes to the rollout revision.
2. Refuse generation if coverage is not exactly one record per canonical skill, a visual parent is
   outside its motif family, or a lineage contains a cycle.
3. Fill all 456 visual specifications. Each record must define:
   - dominant acting subject or action silhouette, including the visible tool, body, element,
     material, or process that causes the effect;
   - optional single supporting cue;
   - semantic palette and painted material vocabulary;
   - pose, direction, negative-space requirement, and exclusions;
   - motif family and primary visual parent, when applicable;
   - representation mode, which is `concrete` by default and may be `abstract-pinnacle` only for an
     owner-approved S skill;
   - exact rarity used only later during composition.
4. Produce a human-readable inventory grouped by Domain → Family → Motif Family. This is the review
   and restart ledger for the entire run.

New skills added after the freeze enter a subsequent catalog revision. They do not silently alter an
active wave.

## Phase 2 — prove provider compatibility before mass spending

Run a bounded technical pilot with three representative skill artworks: one dark Martial emblem,
one luminous Magical emblem, and one fine-detail Craft emblem. This is specifically a provider,
safe-zone, edge-blending, and 384-pixel normal-display test—not a style-selection exercise.

Because the current provider repeatedly painted checkerboards when asked for transparency, the
pilot compares two declared source modes: genuine alpha when actually returned, and an exact uniform
near-black field blended into the canonical charcoal backing through a deterministic aperture mask.
The accepted versioned normalization route records original bytes and source mode, creates canonical
1024×1024 RGBA, and rejects checkerboards, matte fringe, forbidden-region pixels, and unrecognized
containers. Producers never remove backgrounds manually.

The pilot selects exactly one retained layer contract for the full rollout. If genuine alpha is
reliable, retain backing and skill art separately. If it is not, retain one aperture-clipped
`skill-interior` master containing the standard charcoal field and artwork, then overlay the fixed
frame. Do not mix layer contracts between skills; any schema change is additive and receives owner
approval before Phase 3.

Stop after these three calls if any output cannot be normalized faithfully. Do not discover the same
provider incompatibility hundreds of images later.

## Phase 3 — generate and approve motif-family calibration plates

Generate at least one reference plate for each of the 104 multi-skill motif families. Each plate shows
three to six representative lineage stages at equal scale using the global Painted Emblem authority.
Eleven continuation plates are required for families longer than six, producing 115 plates in total.

Review each plate for recurring silhouette, progression, palette boundaries, density, negative
space, and separation between adjacent skills. Approved plates become immutable, hash-bound visual
references. The 20 standalone skills skip calibration plates.

Every plate also declares its concrete anchor: Blade and Polearm plates show the weapon causing the
action; Ranged plates show the projectile, launcher, or shot path; Body plates show the relevant body
action; Magical plates show the operative element, sigil, target, or transformation; Craft plates
show the tool, material, ingredient, creature, document, or result. Abstract effect-only art is
rejected for F–A. An S-stage abstraction is reviewed as an explicit exception rather than inherited
automatically by the family.

Calibration work may run in parallel across motif families. Within one family, continuation plates
remain sequential so the later plate inherits the approved family grammar.

## Phase 4 — controlled individual-skill pilot

Generate fifteen individual masters: five Martial, five Magical, and five Craft, selected from three
approved motif families. Generate each skill independently at full provider resolution, normalize
to 1024×1024, and follow each family from
root to child so a child can reference its approved parent master.

For every retained candidate, automatically derive—not generate—three review views:

1. isolated 1024×1024 artwork;
2. full-resolution backing + artwork + the skill's correct rarity frame;
3. the same canonical composite at 384×384, representing normal interface presentation.

The pilot passes only when all fifteen remain distinct and readable at 384 pixels, motif progression
is coherent,
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
catalog atomically and creates deterministic 512, 384, and 256-pixel derivatives. Composition uses
the catalog rarity to select F–S and never regenerates the emblem when its presentation changes.

Regenerate review sheets from approved masters only. Final validation requires:

- 456 canonical skills, 456 visual specifications, and 456 approved skill-art masters;
- no duplicate target IDs, missing motif assignments, broken parent links, or unreviewed latest jobs;
- valid 1024 RGBA masters and matching 512/384/256 derivatives;
- 456 passing isolated, full composite, and 384-pixel normal-display views;
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
the coordinator. Historical 96-pixel evidence and packet schemas remain immutable; new skill-art
work uses an additive 384-pixel review profile. The first execution deliverable is the imported
reset frame authority, one reconstructed F/B/S frame comparison, and the three-image
provider-compatibility pilot—not the full 571-call run.
