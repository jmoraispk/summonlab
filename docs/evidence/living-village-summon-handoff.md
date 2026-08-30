# Living Village Summoning Portal handoff

Status: isolated browser prototype ready for coordinator review

Direct route: `http://127.0.0.1:4173/living-village-lab/summon`

Implementation branch: `codex/lv-summon-screen`

## Delivered slice

- A route-local, database-free Summoning Portal with earned and premium currency counters.
- Standard as the only active fixture banner; Limited and Equipment are disabled future previews.
- Mara Vey as the featured emotional anchor, using her existing approved image.
- Visible fixture guarantee progress and a one-action rates/details disclosure.
- Printed fixture costs on `Summon ×1` and `Summon ×10 + 1 bonus`.
- Gate ignition, constellation assembly, and immediate-identity reveal experiments against fixed
  receipt `LV-R-001`.
- Skip, replay, measurable time to recognizable identity, muted-by-default sound hooks, and a
  visible reduced-motion override.
- Single and eleven-slot batch presentations. Batch slots reference only the six fixed Living
  Village identities and explicitly create no durable copies.
- Focused Playwright coverage and review screenshots. No production routes, APIs, contracts,
  catalogs, or economies were changed.

## Recommended direction

Use **Immediate identity** as the default. It makes Mara recognizable almost instantly, then lets
calling and affinity arrive as restrained secondary information. This best protects the product's
people-first identity and removes suspense that would otherwise continue after the player already
knows the face.

Keep **Gate ignition** as the ceremonial alternative if owner testing values anticipation enough to
accept a roughly 1.75-second recognition target. Constellation assembly communicates mechanics
well, but its pre-portrait abstraction currently feels more like a specialist affinity reveal than
the default arrival ritual.

## Useful review actions and the decisions they inform

1. Open the direct route, compare Gate ignition, Constellation assembly, and Immediate identity,
   then use Replay for the same `LV-R-001` receipt. Decide whether immediate recognition or portal
   ceremony should define the default rhythm.
2. Turn on Reduced motion, run both summon actions, and use Skip once. Decide whether the safe
   alternative retains enough premium atmosphere and whether skip should remain in the stage footer
   or move closer to the portrait.
3. Open Rates & details, compare the two printed-cost actions, and inspect the `10 + 1` receipt.
   Decide whether the trust hierarchy makes the bonus and non-persistence boundary clear before the
   batch action is pressed.

## Evidence

- `docs/evidence/living-village-summon-desktop.png`
- `docs/evidence/living-village-summon-mobile.png` (390 × 844)
- `docs/evidence/living-village-summon-animation-gate.png`
- `docs/evidence/living-village-summon-animation-constellation.png`
- `docs/evidence/living-village-summon-animation-identity.png`
- `docs/evidence/living-village-summon-single-result.png`
- `docs/evidence/living-village-summon-batch-result.png`

The three animation frames use the same Mara Vey receipt and capture the threshold, forming, and
identity-recognized phases respectively.

## Validation record

| Gate | Result |
| --- | --- |
| Web typecheck | pass · zero diagnostics |
| Web lint | pass |
| Focused Playwright spec | pass · 2 tests |
| Production web build | pass |

The build retains the repository's existing large-chunk advisory; it produced the isolated route
successfully and did not introduce a build failure.

## Proposed summon view-model fields

These are integration proposals only. They intentionally remain outside shared production
contracts in this branch.

```ts
type SummonPortalViewModel = {
  fixtureVersion?: string;
  wallets: Array<{
    currencyId: string;
    label: string;
    balance: number;
    kind: 'earned' | 'premium';
  }>;
  banners: Array<{
    bannerId: string;
    label: string;
    availability: 'active' | 'preview' | 'closed';
    featuredHeroId?: string;
    rateTableId?: string;
    guaranteeRuleId?: string;
  }>;
  activeBannerId: string;
  featuredHero: {
    heroId: string;
    displayName: string;
    identityLine: string;
    portraitAssetKey: string;
  };
  guarantee?: {
    current: number;
    threshold: number;
    unit: 'summons';
  };
  rates: Array<{
    outcomeBand: string;
    probabilityBasisPoints: number;
  }>;
  offers: Array<{
    offerId: string;
    paidCount: number;
    bonusCount: number;
    cost: { currencyId: string; amount: number };
  }>;
  presentation: {
    receiptId: string;
    revealDirection: 'gate' | 'constellation' | 'identity';
    reducedMotion: boolean;
    muted: boolean;
  };
};
```

Durable acquisition should consume a validated `SummonReceipt` in its owning system. Repeated IDs
in a presentation receipt must not imply multiple owned `HeroInstance` records.

## Unresolved economy questions

- What are the canonical names and grants for earned summon currency and premium gems?
- What are the accepted single and `10 + 1` prices, and is the bonus always result eleven?
- Which banner owns guarantee progress, what advances it, and does it carry between versions?
- What are the accepted Standard rates and summonable star bands for Living Village?
- What happens when a receipt resolves to an identity the player already owns?
- With only six unique identities, does a batch substitute typed non-hero rewards, stop early, or
  issue another entitlement?
- Is Limited a future hero banner, a rules overlay, or outside Living Village?
- Is Equipment a summon banner or a separate acquisition surface?
- How should daily free summons and floor-earned tokens coexist with premium spend without implying
  an unaccepted exchange rate?

Every numeric value in this prototype is labeled as a fixture until those questions are accepted.
