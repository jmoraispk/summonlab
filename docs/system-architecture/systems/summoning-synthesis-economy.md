# Summoning, synthesis, and economy

Status: **Forge and safe synthesis proofs exist; production economy is new**

Primary owner: acquisition channels, ledger transactions, and irreversible conversion

## Player promise

Summoning creates the game's people and should feel like meeting someone, not opening inventory.
Synthesis asks whether short-term survival or acceleration justifies permanently losing one of those
people. The economy makes both actions legible and replayable.

## Owns

- Economy: resource, item, cargo, reservation, and premium-gem ledgers;
- Summoning: channel configurations, odds, pity/anomaly state, entropy draw, generation transaction,
  and summon receipt;
- Synthesis: preview quote, compatibility/saturation, source termination, output selection, and
  irreversible receipt.

These should be separate domain modules even if one workstream coordinates them.

## Does not own

- character identity generation internals or visual rendering;
- XP/skills/promotion mutation;
- social consequence calculation or witness truth;
- a mission's attempt-local cargo before extraction;
- personality or memory transfer.

## Summoning channels and gems

The supplied progression design defines Normal as mostly 1★ with some 2★ and a small 3★ chance, and
Advanced as gem-funded with a 3★ minimum, possible 4★, and extraordinarily rare 5★. No channel may
summon 6★ or 7★. A later Special reward can grant an entitlement to an authored configuration, but
it cannot silently change these rank ceilings. Exact prices, odds, pity, and Special behavior remain
versioned tuning.

Every committed summon atomically binds debit, channel/odds version, pity before/after, entropy,
generation recipe, manifest hash, hero ID, and receipt hash. Retry is idempotent. The reveal follows
commitment and cannot reroll the outcome. Appearance, culture, personality, aptitude, and rarity use
independent generation streams.

Roster pressure uses reserve companies, housing, leadership, and attention tools. It does not make
synthesis mandatory cleanup.

## Rewards and return cadence

Reward orchestration defines why a benefit is eligible, when it may repeat, and which typed claims
compose its bundle. It does not keep balances or mutate progression. Economy commits gems, tickets,
and items; progression commits experience and growth; summoning consumes access according to its
channel rules.

The owner wants almost every meaningful action to produce a legible benefit and wants a reason to
return daily. The current Living Village candidates are a small daily gem claim and periodic access
to a Special summon, alongside mission, training, and milestone benefits. `2` gems per daily claim
is a proposed fixture—not an accepted price or cadence. Special access may count total claims, bind
to major mission milestones, or combine both; it must not rely on a hidden or punishing missed-day
streak.

All claims are idempotent, disclose eligibility and repeat rules, and return committed receipts.
The UI celebrates committed results rather than predicting a grant that another owner may reject.

## Synthesis output

Preview names immediate output and permanent exclusions. Candidate outputs:

- bounded experience;
- promotion essence;
- one compatible skill fragment;
- affinity reinforcement.

Yield depends on demonstrated development, compatibility, chamber capability, and recipient
saturation. Latent potential contributes little; newly summoned feeders are economically negative.
No personality, memories, relationships, unique evidence, or full skill transfers. Exclusive
knowledge dies unless shared or recorded.

Retention is intentionally better over the long horizon through labor, teaching, party coverage,
relationships, knowledge, and the source hero's own future. Synthesis remains locally useful when
time or survival pressure makes acceleration valuable. The receipt is honest even though the global
strategic lesson remains discoverable.

## Interfaces

Consumes:

- facility capabilities and quote context;
- character generation and lifecycle validation;
- progression valuation/grant validation;
- occupancy/witness evidence and society aftermath;
- mission extraction claims and construction/promotion spend requests.

Publishes:

- ledger reservation/debit/credit/finalization receipts;
- summon/pity/hero-created events;
- synthesis preview and commit receipts;
- source terminal lifecycle event and typed progression/social follow-up claims.

## Invariants

- Balances never go negative and every spend/grant is idempotent.
- Odds and pity configuration are content/version bound and disclosed at spend.
- Network retry cannot duplicate a pull or synthesis.
- Synthesis is confirmed, irreversible, non-self-targeted, and source-terminal exactly once.
- Synthesis does not create gems and is never required for promotion.
- Summon-to-synthesize loops lose value before social cost.
- Personality, rarity, appearance, and aptitude remain independent.

## Roadmap

1. Define generic ledger reservations/grants, gem currency, and typed reward claims.
2. Turn Forge channel fixtures into production-shaped quote/commit/pity receipts and add the
   versioned Living Village reward table.
3. Define reserve-roster organization and housing/attention pressure.
4. Extend synthesis preview to typed outputs, compatibility, and saturation.
5. Add skill fragments and alternative promotion paths.
6. Run long-horizon anti-feeder and retained-roster simulations; reveal the strategic history through
   authored tower/neighbor content.

## Feedback ledger

| Date | Status | Feedback | Consequence |
| --- | --- | --- | --- |
| 2026-08-29 | accepted | Gems are premium currency needed for advanced summons. | Add a separate premium ledger and atomic summon receipts. |
| 2026-08-29 | accepted | Synthesis is major, while not synthesizing is secretly best. | Make it a short-term accelerator with negative long-term value and no mandatory gate. |
| 2026-08-29 | accepted | Synthesizer may transfer experience, potential skills, or skills. | Use bounded XP/essence/fragments/affinity; never full identity or memory. |
| 2026-08-29 | accepted | The wiki must preserve all supplied systems while each release can turn unsupported features off. | Keep complete catalogs and enforce a fail-closed release allowlist. |
| 2026-08-29 | accepted | Engagement needs visible benefits across play, including reasons to return. | Add shared reward orchestration while domain owners continue to commit their own grants. |
| 2026-08-29 | experiment | A daily claim could grant a couple of gems and occasionally lead to a Special summon. | Model `2` gems as the first candidate and review cadence, economy, and missed-day behavior before acceptance. |

## Open decisions

- Are Special summons bought with gems, earned milestones, or both?
- Is the first daily claim exactly two gems, and is Advanced summoning active in Living Village or
  merely visible as a future use?
- Does Special progress use total daily claims, major mission milestones, or both, and what happens
  after a missed day?
- Does synthesis select one output or divide a fixed budget among several outputs?
- How much of compatibility and social visibility should the preview disclose?

## Existing foundations

Start with ADRs 0020–0021, the engine-v22 synthesis receipt/social chain, ADRs 0055–0056, Forge
channel cohorts, existing resource ledger, and current deterministic generator. The current simple
XP formula is proof behavior, not the target economy.
