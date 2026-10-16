# Rewards and Engagement

Wiki ID: `mechanics.rewards-engagement`

Design status: **draft**. The engagement goal is explicit; exact rewards, cadence, prices, odds,
streak behavior, and Special-summon access require owner review and simulation.

Rewards and Engagement ensures that useful play produces visible benefits and a reason to return.
It connects summoning, training, missions, progression, collection, discovery, and longer milestones
without letting each feature mint private currency or invent unrelated reward rules.

The owner described the ambition as “100% engaging” and, to some extent, “addictive”: strong enough
that players look forward to returning each day. This page translates that ambition into
anticipation, progress, mastery, collection, meaningful goals, and new possibilities. The system
should not depend on disguised odds, irreversible missed-day loss, fake scarcity, or punishment
severe enough to turn desire into obligation.

## Player promise

Almost every meaningful activity should answer three questions immediately:

1. What changed because of this action?
2. What durable benefit did it create?
3. What newly attractive objective can be pursued next?

Not every click needs currency. Benefits can take several forms:

| Reward layer | Examples | Purpose |
| --- | --- | --- |
| Immediate feedback | animation, impact, exact delta, result explanation | Make the action feel responsive and understandable |
| Capability growth | XP, attribute progress, skill practice, affinity progress | Make the same hero meaningfully stronger or broader |
| Acquisition | equipment, materials, summon currency, summon tickets | Create new options and collection anticipation |
| Access | next floor, new training focus, channel, recipe, facility, destination | Change what the player can do |
| Knowledge | monster entry, weakness, recipe condition, floor evidence | Reward attention and discovery |
| Recognition | milestone, title, record, visual commemoration | Preserve meaningful accomplishment |
| Strategic leverage | better preparation, resource efficiency, party flexibility | Reward good systems rather than raw repetition alone |

## Candidate reward loops

### Daily return

The owner's current proposal is a small daily gem benefit—“a couple of gems”—plus an occasional
Special summon. A first tuning fixture may represent the daily grant as **2 gems**, but that number
is not accepted balance.

A daily claim must publish:

- the eligible game-day/calendar window and reset rule;
- claim ID, reward-table version, before/after balance, and receipt hash;
- whether missed days pause, accumulate, or simply pass;
- the visible path from accumulated gems to a useful summon or other benefit;
- any Special-summon progress and exact remaining requirement.

Candidate Special-summon routes:

- a transparent number of daily claims;
- a major first-clear or campaign milestone;
- a mixed rule where either route grants the same ticket.

Calendar rewards and mission rewards should not create two incompatible versions of “Special
summon.” Both grant one typed ticket or channel entitlement through the shared ledger.

### Summoning and collection

- A summon is itself a major reward because it introduces one persistent person and new strategic
  possibilities.
- Odds, pity, entitlement, and gem cost are disclosed and version-bound before commitment.
- Daily and milestone rewards may fund Advanced pulls or directly grant a Special ticket, but
  network retry cannot duplicate either.
- Unique-person generation prevents duplicate identities; collection pressure must never turn
  people into disposable duplicate materials.

### Missions

- First clear: the strongest authored reward bundle, next-floor access, and a clear new objective.
- Repeat clear: smaller practice or targeted farming benefits without duplicating first-clear
  unlocks.
- Higher challenge, optional constraints, or excellent preparation may alter a declared reward
  table, never an improvised narrator grant.
- Failure should still return information and a useful next recommendation even when it grants no
  first-clear reward.

### Training

- Completion shows exact attribute or skill progress and the expected combat/readiness consequence.
- First demonstrations, mastery thresholds, and difficult regimens may grant recognition or unlock a
  new training option later.
- Rewards must not make clicking many tiny training actions superior to making one meaningful plan.

### Long-term milestones

Floor bands, roster breadth, mastery, compendium completion, promotion, base development, and later
neighbor exploration can each feed a shared milestone catalog. A milestone names its exact
requirements and one-time reward claim. Visual celebration never substitutes for the committed
benefit.

## Reward contract

```text
RewardDefinition
  rewardId · version · trigger · eligibility · contents · repeat policy · presentation brief

RewardClaim
  claimId · source event · recipient/account · reward version · eligibility evidence

RewardReceipt
  claimId · committed deltas · before/after · idempotency key · event/hash references
```

Reward orchestration decides which declared bundle a source event makes eligible. The Economy ledger
commits gems, tickets, items, and currencies. Progression commits XP, attributes, mastery, and
affinity grants. Summoning consumes a ticket/ledger reservation and creates a hero. Tower content
owns floor eligibility and unlocks. Presentation celebrates only the committed receipt.

## Engagement health and evaluation

“100% engaging” is a design ambition rather than a claim that every player can be retained. Measure
whether the system creates healthy, comprehensible desire to continue:

- players can name the next objective and why it is valuable;
- training or loadout changes produce visible improvement;
- rewards add options rather than only larger numbers;
- daily return feels beneficial without making a missed day catastrophic;
- players understand summon costs, odds, pity, and Special progress;
- no optimal loop depends on meaningless clicking, clock abuse, duplicate claims, or disposable
  heroes;
- the game remains satisfying in a normal session instead of withholding all progress for a daily
  timer.

## Living Village availability

The [Living Village v1 matrix](../roadmap/living-village-v1.md) may enable a small placeholder reward
table while the complete system remains documented. Alchemy, Animal Handling and Taming, crafting, story,
construction, and other disabled features cannot appear as reward requirements or grant unusable
outputs in that release.

Minimum v1 reward surfaces:

- first-clear mission benefit;
- smaller repeat-combat practice;
- explicit training delta;
- initial and later Normal summon access;
- a reviewed daily-return benefit;
- visible progress toward an occasional special summon if that channel is enabled.

## Future work

- Add daily rewards and clear check-in updates that show current eligibility, claimed benefits, and
  what becomes available next without relying on hidden or punishing streak pressure.
- Create a strong sense of fast progress from the start through frequent visible improvements,
  useful unlocks, and clearly explained next opportunities.
- Break onboarding into many incremental goals, and use contextual tutorial pointers to direct the
  player toward the relevant controls, heroes, facilities, and next actions.

## Open decisions

- Are Advanced summons active in Living Village v1, and what can daily gems buy there?
- Does a Special ticket come from consecutive claims, total claims, mission milestones, or several
  equivalent routes?
- Should missed days be neutral, accumulate partial catch-up, or preserve an unbroken total-claim
  track?
- Which activities warrant currency, which warrant capability, and which need only feedback and
  knowledge?
- What repetition caps stop low-risk floors or trivial training from dominating progression?
