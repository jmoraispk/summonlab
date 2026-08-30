# Living Village Summoning Portal implementation plan

Status: implementation-ready plan, written before prototype code

Owner boundary:

- `apps/web/src/routes/living-village-lab/summon/**`
- `apps/web/src/lib/components/living-village/summon/**`
- `docs/evidence/living-village-summon-*`

The route is a browser-only presentation lab. It will not call a database, provider, production
summon API, catalog writer, or image-generation endpoint, and it will not create durable hero
instances.

## 1. Experience intent

Translate the supplied hierarchy brief into a dark, premium Hearth portal that feels desirable and
trustworthy at the moment of spend. The composition should make the featured identity the emotional
anchor while keeping balances, banner, guarantee, rates, prices, and the difference between a
single summon and the `10 + 1 bonus` presentation legible without scrolling on desktop. Mobile will
retain the same decision order in a single-column layout with sticky, reachable action controls.

The prototype will use only these six existing identity anchors:

1. Dara Zev
2. Mara Vey
3. Jori Daro
4. Kira Toren
5. Iven Orra
6. Remy Nahl

No seventh face, generated derivative, or duplicate persistent instance will be introduced.

## 2. Information architecture

The screen will contain these regions, in this order:

1. A compact portal header with route identity, quiet lab-fixture disclosure, and two wallet
   counters: earned summon sigils and premium gems.
2. A three-option banner rail. `Standard` is the only active fixture; `Limited` and `Equipment` are
   visibly labeled previews and cannot be selected as working economies.
3. A cinematic featured stage with Mara Vey as the fixed featured identity, a short identity line,
   existing anchor art, controlled portal lighting, and a motion-mode selector.
4. A trust rail showing guarantee progress, the fixture disclaimer, and a one-action rates/details
   disclosure.
5. Two spend actions with costs printed inside the controls: `Summon ×1` and
   `Summon ×10 + 1 bonus`. Both initiate a presentation-only receipt and never mutate balances,
   guarantee, ownership, or a backend.
6. An owner-comparison strip for the three reveal directions, replay/skip/mute controls, reduced
   motion status, measured time to recognizable identity, and the current phase.
7. An in-composition result treatment: one premium hero receipt for the single action and an
   eleven-slot contact sheet for the batch action, drawn from the fixed six identities and clearly
   described as a non-persistent presentation preview.

## 3. Route-local model and fixtures

Create a typed `fixtures.ts` beside the route. It will define:

- `HeroFixture`: stable fixture ID, name, pronouns if used in copy, identity line, affinity label,
  role label, star presentation, and imported anchor URL.
- `BannerFixture`: ID, label, state (`active` or `preview`), title, description, featured hero ID,
  and fixture notice.
- `WalletFixture`: currency ID, label, balance, short symbol, and fixture status.
- `GuaranteeFixture`: current progress, threshold, label, and fixture status.
- `RateFixture`: rarity label, displayed probability, pool note, and fixture status.
- `SummonOfferFixture`: mode (`single` or `batch`), printed cost, currency, result count, bonus count,
  and non-commitment note.
- `RevealDirection`: `gate`, `constellation`, or `identity`.
- `RevealReceipt`: fixed receipt ID plus the stable hero ID sequence used for all comparisons.

All numeric economy data will be grouped under an exported fixture-version constant and rendered
with `Fixture`/`Prototype fixture` labels. The UI will not imply that balances, costs, probability,
guarantee threshold, or grants are accepted production values.

The fixed batch receipt may repeat portraits to demonstrate eleven slots, but each result will be a
presentation slot referencing one of the six stable identity fixture IDs. Copy and accessibility
text will explicitly state that it creates no durable hero copies.

## 4. Component design

Build small route-owned components under
`apps/web/src/lib/components/living-village/summon/`:

- `PortalGlyph.svelte`: CSS/SVG-free semantic ornament for currency and portal marks.
- `RevealStage.svelte`: the visual state machine for the three animation directions, hero art,
  phase captions, skip/replay, mute hook, reduced-motion behavior, and timing readout.
- `RatesPanel.svelte`: an accessible disclosure/dialog-style panel containing rates, guarantee
  behavior, pool identities, offer comparison, and fixture disclaimers.
- `ResultPresentation.svelte`: single and batch receipts with result hierarchy and the honest
  non-persistence note.

The route page will own banner/wallet/offer layout and orchestration state; components will receive
typed values and dispatch changes through callback props, without stores or shared contracts.

## 5. Reveal experiment

All three directions will replay against the same single-result receipt, Mara Vey, so review judges
pacing and hierarchy rather than outcome luck. Timings are presentation targets, not gameplay
economy:

| Direction | Stages | Face recognizable target | Full mechanics target |
| --- | --- | ---: | ---: |
| Gate ignition | charge → threshold → silhouette → identity → mechanics | 1.75 s | 2.55 s |
| Constellation assembly | marks → form → identity → mechanics | 1.55 s | 2.35 s |
| Immediate identity | identity → parallax settle → mechanics | 0.15 s | 1.15 s |

Implementation notes:

- A small TypeScript timer/state machine will set an explicit phase and record elapsed time with
  `performance.now()` when the identity phase is reached.
- Skip moves immediately to the complete state. Replay resets the same receipt and direction.
- Once the identity phase is reached, mechanics continue without an input-blocking delay; controls
  remain available.
- Sound is muted by default. The mute toggle is an honest hook/status only; no audio asset will be
  introduced.
- `prefers-reduced-motion` is detected with `matchMedia`, while a visible owner override allows the
  safe mode to be tested. Safe mode reveals the face immediately, replaces transforms and flashing
  layers with a restrained dissolve/static composition, and reports a near-zero recognizable time.
- CSS animation will use opacity, transform, masks/gradients, and restrained light layers around
  the existing art. No generic card flip will be used.

Recommendation hypothesis to test: **Immediate identity** should become the default because it
centers the person fastest and avoids theatrical delay after recognition. Gate ignition should
remain the high-ceremony option if its sub-two-second recognition target feels worth the extra
anticipation.

## 6. Interaction behavior

- Standard opens selected and remains the only actionable banner.
- Preview banner controls announce `Preview · not available in this fixture` and do not change
  prices or active selection.
- Rates/details opens in one action, traps no user behind a second disclosure, closes by button,
  backdrop, or Escape, and returns focus to the trigger.
- The single summon starts the selected animation and ends on the fixed one-result receipt.
- The batch summon starts the same direction and ends on a visually dense `10 + 1` receipt. It does
  not decrement fixture balances or increment guarantee progress.
- Replay preserves offer and direction. Skip preserves receipt and jumps to its result.
- Changing direction replays the fixed test receipt for direct comparison.
- Controls use native buttons, visible focus states, live-region phase/status messaging, and labels
  that retain the cost and bonus language at narrow widths.

## 7. Responsive and visual system

Desktop target: 1440 × 1000 or taller. Use a two-column hero/trust composition with the cinematic
stage taking most visual weight and a right-side decision column keeping guarantee, costs, and
comparison controls visible.

Mobile target: 390 × 844. Stack the wallet/banner/header, use a compact cinematic stage, move trust
details below the identity, keep offer buttons visible without horizontal clipping, and show the
batch receipt as a small grid with readable names.

Visual direction:

- midnight charcoal and blue-black stone rather than pure black;
- ember/copper light for spend and spectacle;
- desaturated teal for trust, disclosures, and guarantee progress;
- warm ivory type with a serif display face and system sans-serif controls;
- fine borders, grain-like CSS gradients, vignette, depth, and asymmetric framing;
- portrait remains realistic and unaltered except for CSS crop, light, shadow, and parallax.

## 8. Focused Playwright evidence

Add a focused test within the owned route directory. It will prove:

1. Direct navigation succeeds and the two fixture currency balances are visible.
2. Standard is active; Limited and Equipment are labeled previews.
3. Rates/details opens in one action and contains probability, guarantee, pool, offer, and fixture
   disclosure copy.
4. Both spend controls expose printed costs, and the batch control communicates `10 + 1 bonus` and
   eleven presentation results.
5. Gate ignition, constellation assembly, and immediate identity can each be selected and replayed
   against the same receipt.
6. Skip immediately reaches a visible result.
7. Replay returns a completed sequence to an active phase.
8. Reduced-motion override exposes the safe alternative, removes waiting, and still produces the
   result.
9. The batch receipt names only the fixed six identities and states that no durable copies were
   created.

Tests will avoid arbitrary sleep by asserting explicit `data-state`, result, and timing hooks.

## 9. Capture plan

After the production build passes, run the focused Playwright flow against the preview server and
capture:

- `docs/evidence/living-village-summon-desktop.png`
- `docs/evidence/living-village-summon-mobile.png` at 390 × 844
- `docs/evidence/living-village-summon-animation-gate.png`
- `docs/evidence/living-village-summon-animation-constellation.png`
- `docs/evidence/living-village-summon-animation-identity.png`

The three-frame sequence will use the same receipt and capture each direction at its most
characteristic pre-complete phase, making the comparison reviewable without relying on video
playback.

## 10. Validation and delivery

Run, in order:

1. Prettier on the owned implementation files.
2. `pnpm --filter @summonlab/web typecheck`.
3. `pnpm --filter @summonlab/web lint`.
4. The focused Playwright spec only.
5. `pnpm --filter @summonlab/web build`.
6. A final Git diff and ownership-boundary audit.

Then commit all in-scope files with a concise Conventional Commit subject, push
`codex/lv-summon-screen` to its configured remote, and report the hash, subject, destination, and
clean-tree state without merging.

## 11. Handoff: proposed summon view-model fields

These are proposals for later coordinator review, not shared contract edits:

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
  guarantee?: { current: number; threshold: number; unit: 'summons' };
  rates: Array<{ outcomeBand: string; probabilityBasisPoints: number }>;
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

Durable acquisition should consume a validated `SummonReceipt` elsewhere. The lab view model must
not imply that repeating an identity in presentation equals owning a second hero instance.

## 12. Unresolved economy questions

The prototype will surface, not answer, these decisions:

- What are the canonical names and grants for the earned and premium currencies?
- What are the accepted single and `10 + 1` costs, and is the bonus always the eleventh result?
- Which banner owns a guarantee, what advances it, and does it carry between banner versions?
- What are the accepted Normal/Standard probabilities and star bands for this release?
- How should a summon resolve when the player already owns the selected unique identity?
- Does a batch stop, substitute a non-hero reward, or issue another typed entitlement when fewer
  than eleven not-yet-owned identities exist?
- Is Limited a future hero banner, a ruleset overlay, or absent from Living Village entirely?
- Is Equipment truly a summon banner or should it live in a different acquisition surface?
- How are free daily summons and floor-earned tokens shown alongside premium spend without implying
  an exchange rate that has not been accepted?
