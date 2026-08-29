# Image-production skill and affinity workload plan

Status: **in execution; controlled generation and semantic regression complete, breadth gated on
human blind review and controlled-quality corrections**

Date: **2026-08-29**

Scope: reusable image-production skill, structured target manifests, elemental-affinity grammar,
species preservation, compound goblin variation, parallel image-generation workloads, provenance,
review, and concurrency measurement.

This is a post-production extension of [Character Pack 2](character-pack-2-plan.md). It uses the
accepted Pack 2 monster language as a controlled test bed without changing or automatically
promoting any accepted Pack 2 candidate. Generated results remain experimental approval candidates
until a human records a review decision.

## Execution record

The plan is now backed by a runnable implementation rather than being a design-only document:

- the reusable, locally installed `summonlab-image-production` skill is versioned under
  `skills/summonlab-image-production/` and passes the skill-package validator;
- strict target, assignment, attempt, result, catalog, blind-review, evaluation, and dedicated
  affinity-review contracts are implemented and covered by tests;
- 48 base manifests plus six versioned Elemental semantic-regression manifests are exported with
  108 unique owned output paths;
- deterministic export, validation, exact-source persistence, result verification, aggregate sync,
  review-evidence export, and goblin-independence audit tooling is implemented;
- the Forge affinity-workflow page presents all 54 coordinates, supports label-visible and
  server-stripped blind modes, verifies candidate bytes before serving them, and records append-only
  hash-bound reviews without promotion;
- the Death Knight six-affinity pilot, the first Grey Wolf canaries, and the neutral-chassis
  Elemental regression have produced measured, hash-bound evidence;
- all 24 controlled results and six Elemental regression results are complete: 26 producer
  candidates and four bounded `revise` outcomes, all unapproved;
- the controlled matrix has only 10 first-attempt candidates against the 20-target threshold, and
  no blind human recognition evidence has been recorded, so the 24-image breadth phase is not yet
  authorized by its release gate.

The active Codex task exposes four total agent slots. Reserving one slot for orchestration yields a
measured ceiling of three concurrent image jobs, even though local configuration requests 16. This
is an environment-capacity finding, not proof that 8-, 12-, or 16-job execution works. Those ladder
stages require a newly provisioned task that actually exposes the requested slots; the manifests,
ownership boundaries, stop rules, and instrumentation are prepared for that continuation.

Current generation timing shows why parallelism matters. Built-in image calls are commonly around
20–48 seconds, while a complete auditable job—including task startup, reference inspection, one
possible correction, exact persistence, structured result writing, and verification—has commonly
taken roughly 110–214 seconds. Runtime drawing of already-authored modular assets can still be
real-time; model generation of a novel finished portrait should be treated as asynchronous
production or background enrichment rather than a frame-time operation.

## Objective

Build and validate a reusable `summonlab-image-production` skill that can:

- receive one structured visual target and an explicit output assignment;
- inspect purpose-specific references without treating them as instructions;
- generate one independently owned image;
- inspect anatomy, canvas completion, framing, identity, and target fidelity;
- retry under a bounded policy;
- record exact prompt, timing, source, dimensions, hash, and review state;
- operate safely across many parallel agents without shared-file collisions;
- preserve a species while expressing a materially meaningful elemental affinity;
- support controlled single-axis tests and more difficult compound-variation tests;
- produce review candidates without promoting its own work into an approved catalog.

The initial work must answer five questions:

1. Does a concise reusable workflow produce complete, auditable assets when an agent receives only
   the workflow, one target, and an execution envelope?
2. Can the generator preserve species identity across Normal, Wood, Fire, Metal, Water, and Wind?
3. Does each affinity change construction, silhouette, motion, anatomy, equipment, or counterplay
   rather than merely changing color?
4. Does the same affinity adapt appropriately to armored undead, substance-bodied elementals,
   organic beasts, humanoid enemies, and unusual reptilian anatomy?
5. How do reliability, candidate quality, and wall-clock throughput change at 2, 4, 8, 12, and
   eventually 16 parallel image jobs?

## Product and execution decisions

- One target produces one image. Comparison plates are assembled deterministically from individual
  outputs after generation; they are not generated as multi-subject images.
- The agent that creates an image owns only its assigned target, output image, and result record.
  It never edits a shared catalog, review index, aggregate metric, or comparison sheet.
- A parent/orchestrator validates manifests, assigns collision-free paths, integrates completed
  results, builds review sheets, runs aggregate validation, and makes commits.
- Every generation is a candidate. The generating agent can reject or request revision, but cannot
  approve or promote its own result.
- The default retry allowance is one corrective retry per target. A second failure is recorded as
  `revise` rather than inviting an unbounded loop.
- Affinity, monster grade, level, battlefield duty, and random physical attributes remain separate
  axes. They may be combined only in a test that explicitly declares compound variation.
- The controlled affinity matrix holds presentation at Grade 4 / Elite. Grades 7–10 are a later
  stress test so that scale and magical escalation do not hide weak affinity design.
- Pack 2 remains medieval. The workflow itself is not medieval-only and must accept a pack-specific
  style contract so later packs can use different coherent genres.
- No paid or externally mutating generation route is enabled merely by this plan. Any such route
  requires its own explicit authorization and cost boundary.

## Workload matrix

### Controlled matrix: 24 targets

The first matrix isolates affinity as much as practical across four construction modes:

| Species | Construction mode | Normal | Wood | Fire | Metal | Water | Wind |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Death Knight | Undead body, armor, weapon, and binding | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Elemental | Body made from the affinity substance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Grey Wolf | Organic quadruped with integrated affinity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cave Bear | Heavy organic quadruped with integrated affinity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Core total: **24 unique targets**, excluding corrective retries.

The unaffiliated elemental is a neutral tower elemental made from rough stone, dust, and pale arcane
binding energy. It acts as the Normal baseline rather than borrowing one of the five affinity
languages.

### Breadth matrix: 24 additional targets

After the controlled matrix passes its visual and workflow gates, extend the same six affinity
states to four previously established Summonlab enemies:

| Species | Why it is useful | Normal | Wood | Fire | Metal | Water | Wind |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Goblin | Humanoid face, body, clothing, equipment, and duty variation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tunnel Boar | Compact charging quadruped with tusks and armored shoulders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cave Drake | Wingless draconic anatomy, digging forequarters, and breath cues | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tower Basilisk | Low six-legged reptile with gaze organs and a readable blind flank | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Breadth total: **24 additional unique targets**. The complete planned ceiling is therefore **48
unique images**, plus only the retries or final regressions justified by observed failures.

The breadth phase is gated. It is not necessary to generate all 48 images if the controlled matrix
already reveals a fundamental skill, prompt, quality, or capacity problem.

## Shared visual controls

The controlled targets use:

- Grade 4 / Elite combat intensity;
- the Pack 2 realistic dark-fantasy material and lighting contract;
- one subject, head to toe or entire creature, with all extremities visible;
- consistent camera distance, neutral cracked-stone floor, and charcoal-to-midnight backdrop;
- a `1536×1024` landscape canvas unless the pilot proves a portrait canvas is more reliable for
  individual full-body anchors;
- at least eight percent safe margin around the complete silhouette;
- restrained local emission rather than a colored full-body glow;
- no labels, text, UI, frames, logos, watermarks, extra creatures, or published-character
  resemblance.

The image must contain finished detail across the entire canvas. Blank bands, unpainted regions,
abrupt cutoffs, and cropped limb tips are failures, reflecting the earlier arachnid generation
failure rather than acceptable negative space.

## Species invariants

### Death Knight

Every variant retains:

- an undead armored commander identity;
- a skull or death mask;
- a small command pennant;
- a deliberate sword guard;
- a command seal beneath the gorget;
- disciplined military posture and believable armor load paths.

Affinity may alter the armor construction, weapon behavior, binding medium, local aura, exposed
weak point, and environmental wake. A Metal Death Knight must be more specific than an ordinary
knight wearing ordinary metal armor.

### Elemental

Every variant retains:

- a readable combat body and locomotion;
- a concentrated core or binding structure;
- anatomy constructed from the selected substance;
- a silhouette that communicates its attack pattern and exposed counterplay.

Affinity is the body itself for an elemental, not an exterior particle overlay.

### Grey Wolf

Every variant retains recognizable canine anatomy, four-legged predatory locomotion, wolf facial
structure, and a fast flanking silhouette. It must not acquire humanoid armor, antlers, wings, or
dragon anatomy merely to make the affinity visible.

### Cave Bear

Every variant retains recognizable ursine anatomy, heavy shoulder mass, powerful forelimbs,
four-legged weight distribution, and a close-range bruiser silhouette. It must remain distinct from
a large wolf or a humanoid golem.

### Tunnel Boar

Every variant retains a low charging body, thick neck, load-bearing shoulders, cloven feet, tusks,
and an armored line-breaking duty. Affinity must not obscure the head-down charge line or turn the
boar into a generic horned beast.

### Cave Drake

Every variant remains a wingless low quadrupedal dragon with digging shoulders, large foreclaws,
battering skull, tail balance, and a readable throat vulnerability. It must not acquire wyvern
wings or lose credible draconic joints.

### Tower Basilisk

Every variant remains a low heavy reptile with six grounded legs, a rigid group of forward-facing
gaze organs, one controlled attack lane, and a vulnerable blind flank. Affinity cannot turn the
basilisk into a snake, ordinary lizard, or many-eyed amorphous mass.

## Goblin compound-variation grammar

Goblins deliberately test whether the workflow can combine affinity with individual variation.
Each goblin target draws or specifies independent attributes for:

- battlefield duty: skirmisher, archer, hexweaver, chieftain, guard, or scout;
- stature within goblin range: short, average, or tall;
- build: wiry, lean, sturdy, or broad;
- adult age and visible wear;
- face shape, nose, jaw, brow, ear shape, scars, and asymmetry;
- skin palette and localized markings;
- clothing layers, material condition, footwear, headwear, and armor coverage;
- handedness, weapon or focus, posture, and equipment anchors;
- affinity expression and counterplay cue.

Affinity, duty, body, face, and clothing are seeded independently. Compatibility rules may reject
an impossible equipment combination, but must not encode fixed stereotypes such as every Fire
goblin being a mage, every Metal goblin being broad, or every Wind goblin being an archer.

For the first six-image goblin cohort, manifests intentionally cover all six affinities, at least
four duties, all four builds, visibly different faces, and six clothing silhouettes. Because this
is a compound test, its results are evaluated for both manifest fidelity and affinity recognition;
they are not used to infer that affinity alone caused every visual difference.

Before larger random generation, run 60- and 600-manifest audits without creating images. Reject
accidental correlations between affinity and duty, stature, build, skin, facial construction,
clothing quality, or battlefield importance.

## Affinity grammar

Every affinity must alter at least two meaningful dimensions among material, silhouette, motion,
anatomy, equipment, attack telegraph, environmental wake, and exposed counterplay. Color alone does
not count.

| Affinity | Required construction language | Common failure to reject |
| --- | --- | --- |
| Normal | Established species materials and restrained neutral effects | Accidental elemental glow or unexplained magical anatomy |
| Wood | Bark grain, roots, vines, resin, wooden articulation, or living growth | Brown recolor, decorative antlers, or foliage pasted over the body |
| Fire | Heat-blackened surfaces, ember seams, combustion, smoke, and heat distortion | Uniform orange glow that destroys material and anatomy detail |
| Metal | Forged anatomy, articulated plates, metallic marrow, or controlled fragments | Ordinary armor presented as an affinity |
| Water | Flow, pressure, mist, wet reflection, and readable fluid transitions | Shapeless blue blob or generic blue glow |
| Wind | Directional fur or cloth, vapor channels, debris flow, and pressure distortion | Pale recolor, transparency alone, or effects with no directional force |

Application differs by construction mode:

- Death Knights express affinity through undead binding, armor, weapons, and command effects.
- Elementals express affinity as substance-bodied anatomy.
- Beasts express affinity through organic integration, breath, movement, localized anatomy, and
  environmental response.
- Goblins express affinity through physiology, equipment, clothing, tools, and combat telegraphs
  while preserving individual identity.
- Draconic and reptilian creatures integrate affinity into scales, throat or gaze organs, locomotion,
  and signature attacks without abandoning their established anatomy.

## Reusable skill package

Keep the skill entrypoint concise and move conditional detail into supporting references:

```text
skills/summonlab-image-production/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── target-schema.md
│   ├── result-schema.md
│   ├── species-grammar.md
│   ├── affinity-grammar.md
│   └── review-rubric.md
└── scripts/
    ├── validate-target
    └── verify-result
```

The repository copy is canonical and versioned. Installation or a link beneath
`/home/joao/.codex/skills/` makes it discoverable to local Codex tasks. The implementation must
validate the installed form rather than assuming discovery succeeded.

`SKILL.md` contains only the reusable workflow:

1. Validate the assignment and target.
2. Read only the references required by that target.
3. Inspect each visual reference for its declared purpose.
4. Construct and preserve the exact generation prompt.
5. Generate exactly one candidate.
6. Inspect anatomy, full-canvas completion, framing, identity, affinity, and prohibited traits.
7. Perform at most one corrective retry when the failure is correctable.
8. Save only inside the assigned output boundary.
9. Write a structured result and provenance record.
10. Leave approval, shared-catalog integration, and commit ownership to the orchestrator.

## Agent input contract

An image-producing agent receives three small inputs:

1. **Workflow:** invoke `summonlab-image-production`.
2. **Target:** a versioned target manifest describing the desired asset.
3. **Execution envelope:** assignment ID, permitted outputs, forbidden shared files, retry ceiling,
   and completion contract.

The target manifest includes:

- asset, pack, experiment, species, affinity, grade, and battlefield-duty IDs;
- identity and anatomy invariants;
- physical or compound variation attributes when applicable;
- permitted transformations and prohibited traits;
- reference paths with an explicit purpose for each reference;
- style, medium, background, lighting, composition, and canvas requirements;
- objective and human-review acceptance tests;
- owned candidate and result paths.

The result record includes:

- target, assignment, skill-version, and attempt IDs;
- status: `candidate`, `revise`, or `failed`;
- exact prompt and referenced-input hashes;
- request start, generation completion, inspection completion, and total wall time;
- source-output identifier;
- output dimensions, file size, media type, and SHA-256;
- self-inspection observations and failed criteria;
- retry reason and relationship to the preceding attempt;
- output paths and confirmation that no shared file was edited.

## Output layout

The implementation should use a collision-resistant experimental layout such as:

```text
assets/enemies/experiments/affinity-workflow-v1/
├── targets/
├── candidates/
│   ├── death-knight/
│   ├── elemental/
│   ├── grey-wolf/
│   ├── cave-bear/
│   ├── goblin/
│   ├── tunnel-boar/
│   ├── cave-drake/
│   └── tower-basilisk/
├── results/
├── review/
│   ├── contact-sheet.png
│   ├── blind-review.json
│   └── evaluation.json
└── generation-record.md
```

Targets and per-job results may be written independently. The orchestrator creates the contact
sheet, aggregate evaluation, generation record, and any Forge catalog only after all jobs in a wave
have stopped.

## Implementation and test sequence

### Phase 1 — Build the workflow

- Create the skill and its focused references.
- Define versioned target, assignment, and result schemas.
- Add deterministic target and result validators.
- Create the first 24 controlled manifests before image generation.
- Validate unique IDs, normalized paths, references, and ownership boundaries.
- Run a dry execution that stops before image generation.
- Validate the skill package with the skill validator.

Exit gate: a fresh agent can read only the skill, one target, and one execution envelope and produce
the expected dry-run result without additional coaching.

### Phase 2 — Death Knight pilot

Use the strongest existing identity grammar to expose workflow and palette-swap failures early:

1. Run Normal and Fire as two parallel canaries.
2. Inspect workflow adherence, image completion, identity, affinity, and provenance.
3. Correct only generalized workflow, species, or affinity problems.
4. Run Wood, Metal, Water, and Wind as four parallel jobs.
5. Perform a blinded affinity and Death Knight identity review.

Successful canaries count toward the 24-image matrix.

### Phase 3 — Balanced six-job matrix

Generate the remaining Elemental, Grey Wolf, and Cave Bear targets in three balanced waves:

| Wave | Elemental | Grey Wolf | Cave Bear |
| --- | --- | --- | --- |
| A | Normal, Wood | Fire, Metal | Water, Wind |
| B | Fire, Metal | Water, Wind | Normal, Wood |
| C | Water, Wind | Normal, Wood | Fire, Metal |

Each wave contains every affinity once and two targets from every species. This separates species
difficulty from wave timing and backend conditions.

Exit gate: controlled-matrix workflow, fidelity, recognition, and provenance thresholds pass before
compound variation or higher concurrency begins.

### Phase 4 — Goblin and breadth manifests

- Generate and validate the 60- and 600-goblin manifest audits without image calls.
- Author the 24 breadth targets for Goblin, Tunnel Boar, Cave Drake, and Tower Basilisk.
- Verify that goblin duty, build, face, clothing, and affinity coverage are independent and coherent.
- Run one Goblin and one Tunnel Boar as targeted breadth canaries.
- Revise only rules supported by repeated or structurally explained failures.

### Phase 5 — Concurrency ladder

Increase parallelism only after the preceding stage passes:

| Stage | Parallel image jobs | Purpose | Promotion gate |
| --- | ---: | --- | --- |
| Canary | 2 | Verify tool invocation, ownership, saving, and result contract | Zero collisions and complete provenance |
| Pilot | 4 | Exercise Death Knight affinities after canary correction | No workflow failures |
| Controlled | 6 | Balanced species/affinity comparison | Visual and workflow thresholds pass |
| Breadth | 8 | Add goblin attributes and unusual anatomy | No quality or retry-rate regression |
| Load | 12 | Measure queueing, throughput, and integration behavior | Stable completion and no throttling cascade |
| Scale | 16 | Prove the planned maximum concurrent workload | Explicit capacity preflight and all earlier gates pass |

The 16-job wave should mix species and affinities rather than assign one family to the entire wave.
A representative schedule contains two targets from each of the eight species and distributes the
six affinity labels as evenly as possible. This prevents one unusually difficult species from being
mistaken for a concurrency failure.

Before the scale wave:

- verify the effective Codex agent limit in the running task rather than trusting configuration
  alone;
- configure a project ceiling of 16 agent threads if supported by the current environment;
- restart or begin a new task if configuration changes require it;
- verify image-tool and backend concurrency separately from agent concurrency;
- reserve the orchestrator for validation and integration rather than assigning it an image target;
- prepare all paths and manifests before starting any child job;
- define a stop condition for widespread timeout, throttle, or malformed-output failures.

A project configuration may request the intended ceiling:

```toml
[agents]
enabled = true
max_concurrent_threads_per_session = 16
```

That setting is only a ceiling. The active Codex task, account, image backend, or application build
may expose a lower effective limit. A 16-agent configuration therefore does not by itself prove 16
simultaneous image generations.

Suggested stop conditions for the 12- and 16-job stages:

- stop launching new work if three jobs in the same wave receive a throttle or capacity failure;
- allow already-running jobs to finish and retain their evidence;
- do not retry capacity failures inside every child agent simultaneously;
- reduce concurrency one step and repeat only the affected targets;
- classify capacity reduction as a scheduler finding, not a visual-skill failure.

### Phase 6 — Final-skill regression

If the skill or its references change materially during testing, regenerate four to eight sentinel
targets with the final skill version. The sentinel set includes every construction mode and the
most common earlier failure. Recommended coverage:

- Normal and Water Death Knights;
- Metal Elemental;
- Wind Grey Wolf;
- Fire Cave Bear;
- one compound Goblin;
- one Cave Drake or Tower Basilisk;
- the species-affinity pair with the lowest review score.

### Phase 7 — Forge review surface

Add an experimental affinity-workflow route with:

- species rows and Normal/Wood/Fire/Metal/Water/Wind columns;
- controlled and breadth cohort filters;
- labeled and label-hidden blind-review modes;
- normal-versus-affinity comparison;
- full-size candidate inspection;
- manifest, exact prompt, attempt, timing, source, dimensions, and hash;
- candidate/revise decision recording;
- concurrency and retry metrics;
- no automatic promotion into Pack 2 or the runtime enemy catalog.

## Evaluation rubric

### Workflow success

- 100% of completed targets have complete provenance and valid hashes.
- Zero cross-agent output collisions or shared-file edits.
- Every result stays within its assigned output boundary.
- Every failed acceptance criterion is reported explicitly.
- Retry ceilings are respected.
- At least 80% of controlled targets become candidates on the first attempt.

### Visual success

- Species is recognized correctly in at least 23 of the 24 controlled images.
- Affinity is identified correctly in at least 20 of the 24 controlled images during blind review.
- All four controlled Normal variants read as unaffiliated.
- Every accepted affinity changes at least two meaningful visual dimensions.
- No accepted candidate contains cropped anatomy, unfinished canvas regions, catastrophic limb
  errors, or an unreadable silhouette.
- Death Knights preserve all required command cues across all affinities.
- Wolves, bears, boars, drakes, and basilisks remain unmistakably different species.
- Goblin targets preserve manifest-owned body, face, clothing, duty, equipment, and affinity cues
  without collapsing into one repeated goblin.

### Parallel performance

Record for every concurrency stage:

- generation, inspection, and end-to-end time per attempt;
- median, `p90`, `p95` where sample size is meaningful, and slowest completion;
- whole-wave wall-clock time;
- sum of individual job times;
- effective speedup and parallel efficiency;
- queue delay, timeout, throttle, malformed-output, and retry rates;
- candidate rate and visual score by concurrency stage;
- missing results, duplicate IDs, path conflicts, and integration errors.

Do not declare a faster stage successful if its visual candidate rate or provenance completeness
falls materially below the preceding stage.

At roughly one minute per image, 48 serial candidates would require roughly 48 minutes of raw model
time before inspection and retries. Sixteen-way execution could reduce raw generation to about three
waves under ideal capacity, but agent startup, image-backend queueing, inspection, saving, and
retries prevent assuming linear speedup. The benchmark replaces estimates with measured evidence.

## Blind and automated review

Automated validation checks:

- target and result schema validity;
- unique IDs and owned paths;
- file existence, media type, dimensions, size, and hash;
- complete timestamps and exact prompt retention;
- attempt linkage and retry ceiling;
- completed-canvas and safe-margin heuristics where reliable;
- absence of undeclared shared-file modifications.

Human blind review hides species and affinity labels, then asks the reviewer to identify both and
score:

- species identity;
- affinity readability;
- silhouette and battlefield duty;
- material credibility;
- anatomy and ground contact;
- affinity integration rather than palette swap;
- Pack 2 style cohesion;
- overall candidate/revise decision.

The producing agent's inspection is useful evidence but never substitutes for human approval.

## Failure classification and iteration rules

Correct failures at the narrowest durable layer:

| Failure | Correction location |
| --- | --- |
| Missing provenance, wrong path, unbounded retry | Skill or execution contract |
| Repeated loss of one species' identity | Species grammar |
| Repeated palette swaps across species | Affinity grammar |
| One malformed or anatomically broken image | Target-specific retry or generator variance |
| Repeated goblin attribute correlation | Manifest generator or compatibility rules |
| Duplicate IDs or overwritten assets | Orchestrator and path assignment |
| Timeouts or throttling under load | Scheduler and concurrency ceiling |
| Forge comparison or metadata error | Integration and review surface |

Do not add a universal skill rule for every isolated visual accident. Promote a correction into the
shared skill or reference only when the failure is structurally explained or repeats across
targets.

## Delivery checkpoints

### Checkpoint A — Workflow contract

Review the skill, schemas, dry-run handoff, owned-output policy, and retry boundary before making
image calls.

### Checkpoint B — Death Knight pilot

Review all six Death Knights. Confirm that they remain one species, all affinities are recognizable,
and Metal and Normal are clearly different.

### Checkpoint C — Controlled matrix

Review the 24-image blind contact sheet and measured six-job workloads. Decide whether the skill is
ready for compound goblin variation and higher concurrency.

### Checkpoint D — Breadth and goblins

Review the goblin manifest audits, six individual goblins, and the added beast/reptile families.
Decide whether body, face, clothing, duty, and affinity variation remain coherent.

### Checkpoint E — 16-job scale test

Compare 8-, 12-, and 16-job stages for speed, failures, retries, quality, and integration safety.
Select the highest concurrency that improves useful throughput without a material reliability or
quality regression.

## Final deliverables

- versioned, validated `summonlab-image-production` skill;
- target, assignment, and result schemas;
- deterministic validation and review-sheet helpers;
- 24 controlled target manifests and their bounded-attempt results;
- up to 24 gated breadth targets and their bounded-attempt results;
- 60- and 600-manifest goblin independence audits;
- exact prompts, sources, timing, dimensions, hashes, and review states;
- controlled and breadth contact sheets;
- blind-review results and failure classifications;
- concurrency report covering 2, 4, 6, 8, 12, and, when capacity permits, 16 jobs;
- recommended safe concurrency and fallback behavior;
- experimental Forge affinity-review route;
- accepted visual rules for later monster grades and future packs;
- a scale recommendation for producing hundreds of static candidates.

## Completion criteria

The workflow experiment is complete when:

- a fresh agent can execute a target correctly from the skill, manifest, and envelope alone;
- the controlled 24-image matrix meets workflow and visual thresholds;
- generalized failures have been corrected and verified through final-skill sentinels;
- goblin attribute manifests demonstrate independence before large image batches;
- at least one unusual added anatomy class passes the workflow;
- the system has measured, rather than assumed, its useful concurrency ceiling;
- the 16-job test either passes or yields a recorded lower safe ceiling with evidence;
- every candidate remains hash-bound, reviewable, and unpromoted until human acceptance;
- the Forge exposes the complete evidence needed for a product and visual decision.
