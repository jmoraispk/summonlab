# Five-Head Chibi Regeneration Goal-Harness Prompt

Copy the fenced block below into the goal harness without shortening it.

```text
Continue until the complete five-head combat-chibi regeneration plan is genuinely finished, or a
hard safety/provider blocker prevents further progress.

Objective:
Generate one new candidate combat chibi for every one of the 200 approved one-star heroes, using
the locked 5.0-anatomical-head standard, and publish a three-way summon / historical chibi / new
candidate review site. Preserve complete prompts, source bindings, provider bytes, hashes, call
evidence, producer QA, and collision-safe result records. These are candidates only: do not approve,
promote, merge, or modify runtime catalogs.

Authoritative instructions:
1. Read AGENTS.md completely.
2. Read docs/decisions/0070-combat-chibis-target-five-heads.md.
3. Read docs/superpowers/specs/2026-09-04-five-head-chibi-regeneration-design.md.
4. Read docs/superpowers/plans/2026-09-04-five-head-chibi-regeneration.md.
5. Read and follow the complete SKILL.md files for superpowers:using-superpowers,
   superpowers:subagent-driven-development, superpowers:test-driven-development, imagegen,
   summonlab-image-production, and superpowers:verification-before-completion. Use
   superpowers:systematic-debugging for any unexpected failure.

Execution rules:
- Rebase the work on current origin/main before implementation. Work on
  codex/five-head-chibi-regeneration, or a collision-safe codex/ successor if that branch already
  contains remote work that cannot be fast-forwarded.
- Execute every unchecked plan item in order. Resume from strict artifacts after interruption;
  never regenerate or overwrite a valid completed assignment.
- The frozen roster is exactly the 200 selectedPairs in
  assets/heroes/experiments/one-star-overnight-200-001/review/review-manifest.json, whose SHA-256 must
  remain 8ae3ee617fb200018c261cdee7b2e3fb5a2f1d807cea77df2fe75b78464c6fe5.
- Generate from each selected summon portrait only. Never provide the historical chibi as an image
  reference; it is comparison evidence for the review UI.
- Every prompt targets 5.0 anatomical heads measured skull crown to chin, excluding hair mass, and
  preserves the source face, age, body construction, body mass, limb girth, hairstyle, wardrobe,
  palette, accessories, tattoos, and markings. Do not add generic thick arms, giant hands, broad
  shoulders, a barrel torso, short legs, fat, or muscle.
- Produce 1024x1536 PNG candidates in the accepted cinematic semi-realistic painted register. No
  weapons, magic, affinity effects, rarity frames, stars, UI, labels, logos, or text.
- Run the twelve-hero stratified pilot first. If at least three pilot outputs share a systemic prompt
  defect, stop bulk dispatch, correct the prompt contract additively, regenerate only assignments
  invalidated by that contract change, and record why. Individual visual misses do not trigger
  paid correction and do not block bulk production.
- Use subagents for bounded parallel image work. Root is the sole coordinator and the only writer of
  shared manifests, plans, journals, review exports, reports, commits, and pushes. Each image worker
  owns exactly one assignment's candidate and result paths. Dispatch at most sixteen image workers
  concurrently.
- Spend exactly one primary generation call per hero. Only a provider response with no usable image
  may receive one versioned retry. The hard run limit is 200 primary calls plus at most ten no-output
  retries. Never retry a valid image merely for visual quality; retain it and mark producer QA
  revise. Stop before exceeding the retry cap.
- Validate and visually inspect every output. The operational ratio gate is an estimated 4.5–5.75
  heads, but any face, age, body-mass, limb, wardrobe, crop, or anatomy drift is still revise.
- Commit and push every reviewable batch exactly as the plan specifies. Explicitly stage only Heroes
  domain files. Preserve unrelated dirty files and report them.
- Keep the user informed at least every 60 seconds during ongoing work. Do not ask routine preference
  questions; apply the accepted rules and continue. Ask only when new authority is required or the
  plan's hard stop is reached.
- Bind the final review server to 0.0.0.0 and share the exact URL using 10.110.24.218, never localhost
  or 127.0.0.1.
- Do not mark the goal complete until all 200 strict candidate/result pairs, ten review pages,
  completion evidence, tests, wiki validation, commits, and pushes are complete. Then report the
  final goal token usage supplied by the goal tool.

Completion proof:
- 200 unique source-roster records, targets, assignments, PNG candidates, and strict results.
- Exactly 200 primary calls and no more than ten eligible no-output retries.
- Every candidate is readable 1024x1536 and all retained hashes agree.
- Every target uses prompt version and five-head contract consistently and references only the
  selected summon source.
- Review manifest has 200 entries; ten pages have twenty heroes each and expose only
  accept-five-head, revise-five-head, or hold decisions.
- Upstream source files and non-Heroes domains are unchanged.
- Experiment tests, experiment validator, Prettier checks, wiki validation, and git diff checks pass.
- All in-scope work is committed and pushed. Candidates remain unpromoted and unmerged pending owner
  review.
```
