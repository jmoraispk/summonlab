# FIN-009 development story workshop

The story workshop proposes five-floor arcs for developer review. It does not author canonical
events, change a run, or compile a proposal into playable content. The current checked Band 02
fixture is intentionally marked `scripted-fixture`; it proves the complete review boundary without
claiming that an external model produced the writing.

## Review the current candidates

Run:

```bash
pnpm validate:story-workshop
pnpm dev:app
```

Open `http://localhost:5173/story-workshop`. Compare each candidate at all five floors, then assess
the six editorial dimensions:

1. **Causality** — every turn follows from the supplied opening facts and earlier floor anchors.
2. **Mechanical fit** — the story makes the permitted objective and mechanics meaningful rather
   than decorating them with prose.
3. **Emotional arc** — setup, complication, division, consequence, and payoff answer the target
   emotional question through play.
4. **Character agency** — roles remain available to actual autonomous heroes; no beat assumes
   obedience, allegiance, or knowledge they do not hold.
5. **Production scope** — locations, policies, assets, and prototype dependencies remain affordable.
6. **Envelope compile** — required anchors, optional apertures, finale constraints, and the reward
   ceiling can become a strict content envelope without expanding authority.

Record an exact-version decision in
`packages/evaluation/fixtures/story-workshop-band-02-v1.json`. A final review is `accepted`,
`revise`, or `rejected`; `accepted` requires all six criteria to pass. Retain an earlier proposal
when adding a revision and point the revision's `supersedesProposalId` to it. Only one exact
proposal version may be accepted.

Run `pnpm export:story-workshop` after editing. Acceptance means **eligible for envelope
compilation**, not canonical or playable. A proposal that references a prototype mechanic remains
on production hold even after editorial acceptance.

## Record an optional model generation

The provider path is opt-in, development-only, and excluded from CI. Configure a server-side key
and an explicit model, then run:

```bash
export OPENAI_API_KEY='<server-side key>'
export STORY_WORKSHOP_MODEL='<configured development model>'
pnpm record:story-workshop
pnpm export:story-workshop
```

`record:story-workshop` requires an explicit paid-provider acknowledgment through its package
script. It sends the exact versioned brief with `store: false`, requests strict structured output,
records model/response/hash/token provenance, clears stale reviews, and refuses to overwrite the
fixture if any proposal crosses the brief catalogs or production bounds. Never commit a credential.

## Compile an accepted proposal

Compilation is a separate future content change. It must translate the accepted proposal into the
existing strict mission packages and band story envelope, assign authored content versions and
hashes, bind objective/arena/enemy/reward catalogs, and pass the same causal and replay validators
as Band 01. The workshop itself has no API or schema field that can apply runtime state.
