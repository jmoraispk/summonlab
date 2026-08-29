# Story and tower campaign

Status: **architecture proposed; existing first-band envelope proven**

Primary owner: campaign narrative and tower content

## Player promise

Each run climbs a coherent but variable one-hundred-floor tower. The campaign remembers who died,
what was discovered, what the parties chose, and how the settlement changed. Heroes make the story
personal without acquiring authority to invent the world.

## Owns

- `CampaignStoryPlan`: twenty compatible five-floor envelope bindings, recurrence graph, secret
  graph, finale constraints, and plan hash;
- reviewed story envelopes, required anchors, optional beats, roles, and patch slots;
- eligibility, cast binding, story-beat completion, and patch history;
- development-time story workshop inputs and accepted content artifacts.

## Does not own

- floor geometry, combat legality, attempt state, or extraction;
- reward balances, XP, promotion, or resource ledgers;
- who knows a fact or a hero's private context;
- generated prose as mechanical truth.

## Target model

At run creation, a deterministic compiler selects twenty compatible envelopes from approved
catalogs. Global validation proves exactly 100 floors, causal reachability, reward/promotion budget,
enemy and visual coverage, cross-band recurrence payoff, secret dependencies, and Floor-100 finale
compatibility. Failure chooses a known default campaign rather than a partial plan.

Each band keeps the established rhythm:

| Floor | Narrative job | Mechanical job |
| ---: | --- | --- |
| 1 | setup | introduce a pressure |
| 2 | complication | require another capability |
| 3 | division | force scarcity, separation, or injury tradeoff |
| 4 | consequence/reveal | test preparation and knowledge |
| 5 | payoff | boss, band test, or irreversible choice |

Runtime StoryDirector calls are sparse. They select eligible authored proposals, order optional
beats, and bind a role to a living hero with the relevant evidence. Facts remain immutable;
personality and mood influence expression.

## Interfaces

Consumes:

- expedition outcomes and discovery evidence;
- living cast refs and holder evidence;
- campaign progression and reward budget projections;
- active player direction and settlement consequences.

Publishes:

- `campaign.story.instantiated`;
- `story.beat.completed`;
- validated `story.patch.applied`;
- anchor/fact references that Society can turn into witness-owned observations.

## Invariants

- A seed chooses from reviewed ontology; it does not create new mechanics.
- Every selected beat is causally eligible.
- A cast-bound speaker is alive and knows the fact.
- A patch cannot change world laws, primary objectives, topology, reward budget, or required finale.
- Replay never calls a model.
- Unlocking a floor globally does not grant its secrets to every hero.

## Roadmap

1. Define and fixture the `CampaignStoryPlan` compiler/validator.
2. Author at least one alternate first-band envelope and prove deterministic composition.
3. Integrate hero-only party outcomes and a leader report into the first band.
4. Prove one cross-band recurring consequence before producing broad content.
5. Expand reviewed envelope coverage toward twenty bands.
6. Add neighbor stories through the same envelope/evidence contracts.

## Feedback ledger

| Date | Status | Feedback | Consequence |
| --- | --- | --- | --- |
| 2026-08-29 | accepted | Tower story can be randomized. | Randomize a reviewed campaign plan and optional route, not runtime world truth. |
| 2026-08-29 | accepted | Heroes should suggest whether their party is ready for a floor. | Story consumes the resulting expedition; party readiness and petitions own the advice. |

## Open decisions

- How much of the twenty-band plan should the player be able to preview?
- Should a failed party permanently change a floor for the next party, or only selected envelopes?
- Which recurring mysteries must appear in every campaign versus a subset of seeds?

## Existing foundations

Start with ADRs 0030, 0034, 0035, 0041, 0045, and 0052; `packages/content/src/tower-band-01.ts`;
`packages/content/src/tower-band-01-story.ts`; and the story contracts/reducer.
