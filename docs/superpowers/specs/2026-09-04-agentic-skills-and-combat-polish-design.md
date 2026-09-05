# Agentic Skills Wiki and Combat Animation Polish Design

**Status:** Approved

**Date:** 2026-09-04

## Purpose

Publish a durable wiki inventory of every repository-owned or repository-installed agentic skill,
fix Nessa's remaining idle-ground registration defect, and replace Toma's rejected v4 run with a
visually coherent heavy run. The work must preserve the existing combat prototype, historical
animation artifacts, and the distinction between project skills and machine-specific Codex skills.

This is one coordinated slice because the animation corrections exercise the same agentic workflow
that the wiki will document. The wiki must describe the real discoverable skill surface, while the
combat work must prove that the action and animation skills lead to better runtime results rather
than merely valid metadata.

## Approved decisions

- Synchronize `codex/realtime-combat-study` with `origin/main` before implementation. Use the remote
  branch, not the locally ahead `main` checkout. A read-only merge-tree probe completed without
  conflicts.
- Publish the page at `/wiki/systems/agentic-skills` as a public engineering/system page.
- List every repository-discoverable skill, divided into Summonlab-authored skills and the pinned
  external PixiJS support collection.
- Exclude global system, plugin, and personal skills outside the repository because their presence
  varies by machine and they are not Summonlab project assets.
- Generate the inventory from skill frontmatter and validate the committed Markdown against the
  filesystem so a missing, duplicated, or invented entry fails checks.
- Make every canonical `skills/summonlab-*` directory discoverable through `.agents/skills` without
  duplicating its content.
- Correct Nessa's idle presentation with clip-specific registration rather than editing her raster
  sheet or moving her shadow.
- Record Toma v4 as owner-rejected for its run motion while preserving its bytes and history.
- Produce Toma v5 as a new full five-pose run strip. Do not patch individual v4 cells into another
  inconsistent sequence.
- Keep the current five-beat classical run authority and support order while adapting stride,
  bounce, and equipment motion to a heavy shield bearer.
- Keep Toma v5 at `candidate` until owner playback approval.

## Branch synchronization boundary

The combat branch is 313 commits behind `origin/main` and contains 23 commits not on that base.
Implementation begins with a normal merge of `origin/main` into the named combat branch. This
brings in the current wiki catalog and six existing project-authored skills before the two character
skills on the combat branch are inventoried.

The merge is an integration prerequisite, not permission to absorb the locally ahead `main` branch,
rewrite history, or resolve unrelated product decisions. After the merge, baseline tests are rerun
and any new failure is classified before feature edits begin.

## Agentic skills wiki

### Inventory scope

The first-party Summonlab inventory after synchronization contains these eight skills:

1. `summonlab-character-action-creation`
2. `summonlab-character-animations`
3. `summonlab-enemy-creation`
4. `summonlab-hero-creation`
5. `summonlab-image-production`
6. `summonlab-item-production`
7. `summonlab-skill-creation`
8. `summonlab-skill-icon-production`

The external section contains every skill in the pinned `pixijs*` collection under
`.agents/skills`, including the `pixijs` router and all 25 specialized skills. The page identifies
this group as third-party, records the pin/license boundary already maintained by
`.agents/skills/README.md`, and lists each skill rather than collapsing the collection into one
unverifiable count.

The inventory deliberately does not include skills discovered only in `/home/joao/.codex/skills`,
system-owned skills, or plugin-provided skills. Those are execution-environment capabilities, not
repository canon.

### Source and generation contract

A repository tool reads YAML frontmatter from:

- canonical `skills/*/SKILL.md` sources;
- direct project skills under `.agents/skills/*/SKILL.md`; and
- repository aliases under `.agents/skills`, resolved without counting the same skill twice.

For each unique skill name it records the description, ownership class, canonical repository path,
and discovery path. Names are sorted within the first-party and external sections. Duplicate names
with different canonical content are an error.

The generated `docs/wiki/systems/agentic-skills.md` page contains:

- what agentic skills are and when Codex loads them;
- the exact inventory scope and explicit exclusions;
- a complete Summonlab-authored table;
- a complete pinned PixiJS table;
- the action-definition to animation-production handoff;
- maintenance instructions and the command that regenerates the page.

The generator owns only a marked inventory region, leaving explanatory prose reviewable. A
validator regenerates that region in memory and compares it to the committed page. This preserves a
human wiki page while making completeness deterministic.

### Discovery parity

Every canonical first-party directory under `skills/` receives a relative directory symlink under
`.agents/skills`. Direct first-party skills that already live under `.agents/skills` remain in place.
Validation requires:

- all canonical first-party skills are repository-discoverable;
- every discoverable `summonlab-*` skill appears exactly once in the wiki;
- every installed `pixijs*` skill appears exactly once in the external section;
- the displayed count equals the unique discovered count;
- every canonical and discovery path resolves inside the repository; and
- the wiki contains no environment-only skill.

The wiki catalog gains `systems.agentic-skills`, and the root wiki browse list links to the page.
Repository-source links must render as GitHub links for both `skills/` and `.agents/` paths.

## Nessa idle registration correction

### Observed defect and cause boundary

All five Nessa v2 idle atlas cells end their visible alpha at row 245, and the shared motion anchor is
row 246. The raster cells therefore have a stable baseline. Runtime presentation applies one
`-4`-logical-pixel body offset to every living Nessa clip, while her contact shadow stays at the
world point. Owner evidence still reads the idle feet as embedded in the terrain.

The stable atlas baseline rules out per-frame raster drift as the first correction target. The
remaining defect belongs to actor/clip presentation registration: the idle silhouette needs more
clearance from the fixed contact shadow and painted ground than her moving clips.

### Correction

`actorVisualRegistration` becomes explicitly clip-aware for Nessa:

- `idle` receives the smallest additional upward lift that leaves a clearly visible contact edge
  between both boots and the painted ground;
- `advance`, `attack`, and `hit` retain their established registration unless playback evidence
  proves a separate defect; and
- `down` remains on the shared ground line.

The shadow stays anchored to the actor's world point. Body and shadow must not be placed in one
shared transformed container, and projection modes must not change the logical clearance rule.

The final idle lift is selected from captured 2.5D V2 evidence. At the configured Nessa display
size, the lowest opaque idle pixel must remain visibly above the shadow center with approximately
10–12 logical pixels of separation; the character must not appear to hover in 2D.

### Nessa acceptance gates

- All five idle frames retain a stable foot line without entering the painted terrain.
- The contact shadow remains below the character and tracks the same world point.
- Idle-to-advance and advance-to-idle do not produce a conspicuous vertical pop.
- Down frames remain grounded.
- Health-bar placement, actor scale, bow handedness, and every Nessa raster artifact remain
  unchanged.
- The result is inspected in 2D, 2.5D, and 2.5D V2 at desktop and mobile widths.

## Toma v5 heavy run

### Why v4 is rejected

Toma v4 satisfies the mechanical support sequence, but owner review rejects its motion quality. The
five poses jump from a high forward kick to a deep squat, then to a large airborne pose and two
widely different landing silhouettes. Alternating feet is necessary, but it does not compensate for
unstable stride length, center-of-mass height, and equipment rhythm.

Provenance records v4 as an immutable owner-rejected candidate. Runtime remains on v4 only until v5
passes validation and is ready for direct comparison; no v4 file is overwritten or deleted.

### Motion authority and sentence

Action authority remains `classical-human-run-5`.

```text
Toma advances in a compact armored run: a short left contact loads into a controlled push, a low
passing flight moves the opposite knee forward, a short right contact absorbs the weight, and a
right-supported recovery prepares the loop without changing torso scale or guard.
```

The five required beats are:

1. **Left contact:** left boot lands only a short step ahead; right leg trails; shield leads.
2. **Left compression and push:** left knee bends modestly; hips lower slightly; no full squat.
3. **Low airborne pass:** neither boot is planted; the visible air gap is small; right knee passes
   without rising above the belt.
4. **Right contact:** right boot lands a short step ahead; silhouette is visibly opposite to beat 1.
5. **Right recovery:** weight moves over the right boot; left leg begins its return toward beat 1.

Support remains exactly `left, left, none, right, right`.

### Visual locks

- Stable gray topknot, beard, face, stocky adult proportions, navy/teal armor, bronze shield on the
  left arm, and compact mace in the right hand.
- Steep three-quarter up-field camera, constant body scale, common light, and full equipment
  clearance.
- Upright forward-leaning torso with a continuous low center-of-mass arc.
- Shield stays between Toma and the target with restrained secondary lag.
- Mace remains below the waist or slightly behind the hip; it never becomes a ground anchor or a
  long pendulum.
- No high front kick, knee above the belt, deep crouch, frog-leg pose, split leap, duplicated
  contact, foot pointed directly at the camera, baked shadow, text, scenery, crop, or equipment swap.

### Measurable runtime gates

- Exactly five unique advance frames and source-bound evidence for
  `left, left, none, right, right`.
- The airborne frame has a 4–10-pixel transparent gap above the 256-pixel atlas contact baseline,
  enough to read as running without making Toma spring upward.
- A common scale is used for all five poses; shield diameter varies by at most 5%.
- Crown-height movement across the normalized sequence stays within 16 atlas pixels. Compression is
  read through joints and hips rather than apparent whole-character shrinkage.
- Frames 1 and 4 are opposite contacts with similar stride length and torso height.
- Frames 5 and 1 form a coherent recovery-to-contact seam at 184-pixel gameplay size.
- Every idle, attack, hit, and down runtime frame is decoded-pixel identical to Toma v4.
- At least three loops are inspected at the declared FPS in 2D, 2.5D, and 2.5D V2, including
  idle-to-run and run-to-attack transitions.

### Artifact and runtime policy

Create immutable v5 strip, sheet, support evidence, atlas, atlas JSON, and manifest artifacts.
Extend the deterministic v4 tooling only where necessary; the documented v5 commands must reproduce
all committed v5 outputs byte-for-byte. Runtime switches from v4 to v5 only after the focused
validators and playback gates pass. The resulting v5 art remains `candidate` pending owner review.

## Testing and verification

### Wiki

- Generator unit tests cover direct skills, symlinked skills, duplicate names, missing aliases,
  path escape, and first-party/external classification.
- A freshness test compares the generated inventory region with the committed Markdown.
- Wiki tests require the catalog route, page title/body, complete counts, root link, and repository
  source-link rewriting.
- `pnpm validate:wiki` passes after synchronization, or any unrelated synchronized baseline failure
  is demonstrated at the merge parent and reported without weakening the new checks.

### Combat

- Registration tests fail before and pass after Nessa receives an idle-only correction.
- Motion-production tests require v5 reproducibility, support evidence, airborne gap, normalized
  scale gates, and decoded preservation of all non-advance frames.
- Focused animator, registration, motion-config, typecheck, format, lint, and Playwright checks pass.
- Browser evidence covers Nessa idle and Toma's complete loop in all three presentation modes.

### Repository delivery

- Historical animation artifacts remain unchanged.
- The final diff contains no generated scratch files or environment-specific absolute paths.
- Every in-scope change is committed and pushed to `origin/codex/realtime-combat-study` with a clean
  working tree.

## Non-goals

- Document system, plugin, marketplace, or personal skills that are not stored in the repository.
- Turn the engineering skills page into the in-game hero-skill taxonomy.
- Redesign the whole wiki shell or add a second skill browser.
- Change Nessa's raster animation, shadow art, combat behavior, scale, or down pose.
- Change combat simulation, pathfinding, attack cadence, or presentation projection.
- Rework Toma's idle, attack, hit, or defeat animation.
- Promote Toma v5 without owner playback approval.

## Acceptance criteria

- `/wiki/systems/agentic-skills` renders every unique repository-discoverable skill exactly once,
  grouped into Summonlab-authored and external PixiJS sections.
- Adding or removing a repository skill without regenerating the page causes a deterministic test
  failure.
- All eight Summonlab skills are discoverable from `.agents/skills` without duplicated sources.
- Nessa's five idle frames read as standing on the terrain in all three modes, with no transition
  pop or hover.
- Toma v5 reads as one compact heavy run rather than five unrelated action poses.
- Toma alternates support, retains a low flight beat, keeps a stable torso/equipment silhouette, and
  loops cleanly into combat.
- All older Toma and Nessa artifacts remain immutable, and every v5 output is reproducible and
  honestly labeled `candidate`.
