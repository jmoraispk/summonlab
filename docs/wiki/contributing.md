# Contributing to the Summonlab Wiki

Wiki ID: `wiki.contributing`

## Session contract

Every wiki-centered session begins with a bounded input packet and ends with a durable output patch.

Input:

- the target page and its catalog record;
- linked accepted principles, system interfaces, and ADRs;
- explicit owner feedback;
- relevant executable definitions, asset catalogs, and evidence;
- the requested output ownership and review question.

Output:

- revised text with design status preserved or deliberately changed;
- new candidate assets registered by key, path, provenance, and status;
- links to code/content/evidence when implementation changed;
- open questions and conflicts made explicit;
- catalog and feedback/ADR updates when the decision is durable;
- successful `pnpm validate:wiki` plus proportionate repository checks.

An agent should receive only the relevant dependency bundle, not an unfiltered dump of the entire
wiki.

## Page contract

Every non-template Markdown page must:

1. Declare a unique `Wiki ID: \`...\`` matching `catalog.json`.
2. Separate player-facing description from internal rules or spoilers.
3. Distinguish accepted facts from proposals and tuning hypotheses.
4. Name the subsystem that owns each mechanic.
5. Link executable content and evidence instead of copying values that can silently drift.
6. Use asset status honestly and never label a candidate as approved/runtime.
7. Record unresolved questions instead of filling gaps with generated certainty.

When the four supplied progression, skill, equipment, and monster-race Markdown sources directly
conflict with earlier conversational notes, follow ADR 0063 and use the supplied source. Preserve
anything that source itself labels approximate, contradictory, parked, or unfinished.

Complete documentation and release availability are separate concerns. Do not delete or thin a
mechanic merely because a small release turns it off. Update the
[release roadmap](roadmap/README.md) instead, and ensure disabled content cannot leak into that
release through generation, rewards, training, UI actions, policy choices, or runtime commands.

Use the [general entry](templates/entry-template.md),
[monster family](templates/monster-race-template.md), or
[affinity](templates/affinity-template.md) template.

## Text-to-image-to-game loop

```text
textual canon
  → bounded visual brief
  → one or more generated candidates
  → provenance + hash + generation record
  → human review
  → approved source
  → runtime export/binding
  → in-game evidence
  → wiki gallery and implementation status update
```

The wiki links domain-owned files such as `assets/enemies/...`; it does not move or clone them into
the documentation tree. Compact derivatives may be generated into `apps/web/static/wiki-media/`
for the online art-book view; these never replace the hash-bound production source. The visual agent
owns only its collision-safe output path and cannot promote a shared catalog without the normal
review boundary.

For monster-affinity work, the visual worker updates only its assigned target, candidate, and result
paths. After branches are integrated, the coordinator runs `pnpm export:wiki-monsters`. That checked
export reads the validated family packets, current-class mapping, and active manifest; regenerates
the canonical form pages and `visual-index.json`; preserves old pixels only as candidate-only
reconciliation references; and never promotes a candidate or mutates a runtime catalog.

For a creature image, the page supplies anatomy, scale, material, movement, habitat, affinity cues,
combat duty, comparison references, prohibited shortcuts, and required camera views. The image may
clarify the page, but any new anatomical or mechanical idea visible only in the image returns as a
text proposal before becoming canon.

## Mechanics-to-runtime loop

Numerical or mechanical wiki claims need a stable executable binding:

```text
accepted mechanic page
  → versioned contract/content definition
  → deterministic resolver
  → unit/property/integration evidence
  → verified wiki status
```

Markdown is the normative human specification. Typed content is the executable representation.
Neither silently overrides the other: a validator or review must resolve disagreement.

## Change policy

- `seed` and `draft` pages may change freely within their owner boundary.
- Moving to `accepted` requires explicit owner feedback or an accepted ADR/RFC.
- Changing accepted cross-system behavior requires an ADR and migration/replay statement.
- `implemented` means code exists; `verified` requires a reproducible check or replay.
- `approved` visuals require a human verdict against exact bytes; `runtime` additionally requires a
  checked runtime binding.
- `off` in a release matrix means deliberately unreachable in that release, not rejected,
  superseded, or removed from the wiki.
- Superseded prose remains reachable through history or an ADR rather than being rewritten as if it
  never existed.

## Recommended review questions

- Is the page clear enough to brief a new worker without verbal context?
- Can a player understand the rule without seeing a formula?
- Can an implementer identify the owner and deterministic boundary?
- Can an artist identify stable anatomy/material/identity constraints?
- Does the page distinguish a race/species from a combat role or visual family?
- Are dignity, knowledge, and representation boundaries preserved?
- Are every image and mechanic status claims honest?
