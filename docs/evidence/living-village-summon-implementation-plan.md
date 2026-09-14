# Living Village Summoning Portal implementation plan

## Owner-feedback revision — focused portal and phone-safe reveal

The supplied screenshots are evidence of the current build. This revision removes speculative
navigation and measurement chrome, corrects the mechanics vocabulary against the local wiki, and
treats 390 × 844 reveal frames—not only the resting page—as acceptance targets.

### Product-surface cleanup

1. Remove the full Standard/Limited/Equipment banner rail. This isolated route has one Standard
   Hearth Gate; it does not advertise future economies that are unlikely to share this surface.
2. Keep recognizable-identity timing available to the focused test, but remove milliseconds and
   timing targets from player-facing UI. Rates opens with a plain `Rates & details` affordance.
3. Replace the offer-button legends with direct actions: `Summon ×1` and `Summon ×10`. Keep costs
   inside each action and retain the compact `+1 bonus` marker on the batch offer.
4. Present both offers side by side at desktop/tablet widths. Stack only when the phone width can no
   longer preserve readable action and cost labels.
5. A batch uses the selected single-person reveal once, then resolves to the eleven-result company
   view. It does not repeat the ceremony eleven times.

### Mobile animation and compositing contract

Capture the 390 × 844 route at five deterministic checkpoints: rest, frame lock, silhouette,
identity, and result. At every checkpoint:

- the stage fits within the viewport width with no horizontal crop;
- the portrait vessel uses a bounded aspect ratio rather than desktop percentage insets;
- the hero's head and body remain inside the vessel;
- source-image edges remain behind the vessel backing;
- identity copy has its own lower safe area and never overlaps the face;
- Skip and Replay remain visible and reachable;
- reduced motion resolves the same contained composition without stagger.

Mobile Gate keeps the same narrative beats as desktop, but scales the vessel from the stage width,
caps its height, and reduces the portal radius. It does not reuse the desktop `inset` geometry.

### Wiki-aligned attributes, aptitudes, and icons

The local wiki now contains the complete 520-row draft skill catalog and the proposed twelve-skill
Living Village runtime subset. It also explicitly distinguishes learned skills from aptitudes:
aptitudes are innate talent for an attribute, skill family, or learning mode. Therefore this route
must not label invented phrases such as `Shieldwork` or `Ember control` as if they were accepted
skills.

- Use one unified four-attribute grid in `STR`, `AGI`, `VIT`, `MAG` order. Accessible labels and
  surrounding prose use Strength, Agility, Vitality, and Magic. Do not add Body/Mind headings or
  attribute-group icons.
- Aptitude names use accepted wiki family/focus vocabulary under the three supplied sectors:
  Martial, Magical, and Craft & Life. They remain route-local person-to-family assignments until a
  hero ownership contract establishes them.
- Martial uses a single sword icon, Craft & Life uses a hammer icon, and Magical retains the
  existing arcane-star mark.
- Do not display the twelve runtime skills as owned by a specific hero without an accepted roster
  assignment. The handoff records that the catalog exists and keeps learned skills out of this
  prototype dossier for now.

### Acceptance checks for this revision

1. Standard loads directly with no banner selector and no Limited or Equipment controls.
2. No player-facing milliseconds or recognition target appears in the portal or Rates.
3. Desktop offer controls are side by side and read `Summon ×1` and `Summon ×10`, with costs and
   the `+1 bonus` marker visible.
4. A batch performs one reveal and then shows the `5 / 5 / 1` result layout.
5. Body and Mind contain three attributes each with Dexterity on Mind; their headings expose muscle
   and brain icons.
6. Martial, Magical, and Craft & Life aptitude classes expose sword, arcane, and hammer icons and
   use wiki family vocabulary.
7. Save the five phone checkpoints and verify vessel, portrait, copy, and controls remain within
   stage bounds.

Status: implementation sequence for the focused-cleanup pass; authored before code changes

## Owner-feedback revision — cinematic continuity and guarantee correctness

The supplied screenshots are a visual audit of the current build, not a style reference. This pass
must fix the observed defects before adding more ornament: low-contrast rate surfaces, an exposed
rectangular portrait matte, portrait pixels arriving before their containing card, unsafe head and
body crops, a `6 / 4 / 1` batch composition, star counts hidden below the fold, and guarantee
progress that advances but never resolves.

### Reveal choreography contract

Gate ignition becomes the quality bar and follows one unambiguous visibility contract. The portal
may suggest a person before recognition, but no source portrait pixels or rectangular source matte
may appear until the identity vessel is visibly established.

| Beat        |    Gate target | Visual event                                                               | Identity visibility |
| ----------- | -------------: | -------------------------------------------------------------------------- | ------------------- |
| Breath      |       0–180 ms | Near-still room tone, dim outer orbit, controls remain available           | None                |
| Intake      |     180–620 ms | Sparks and filaments travel inward; rings accelerate with unequal inertia  | None                |
| Lock        |     620–880 ms | Runes align, cardinal marks strike, and an arched identity vessel draws    | None                |
| Rupture     |   880–1,080 ms | Aperture compresses to a bright seam and releases one restrained shockwave | None                |
| Crossing    | 1,080–1,430 ms | A monochrome silhouette crosses inside the already-complete vessel         | Silhouette only     |
| Recognition | 1,430–1,650 ms | Rarity color lands, portrait resolves from the face outward, name follows  | Recognizable face   |
| Settle      | 1,650–2,250 ms | Depth separates, particles decay, mechanics enter, replay/skip stay live   | Full identity       |

Constellation assembly uses the same vessel-first rule: affinity and aptitude marks create the
outline, the frame closes, then the portrait resolves. Immediate identity draws the frame in the
first 80 ms and resolves the face within 150 ms; it never flashes an unframed image. Reduced motion
shows a complete static vessel and portrait in one dissolve, with no flashes, spin, parallax, or
staggered wait.

Animation implementation invariants:

- Keep Svelte for orchestration and PixiJS/WebGL for the portal. A framework replacement is not an
  animation-quality strategy; timing, compositing, masking, and art direction are the relevant
  boundaries.
- The portrait source is always clipped by the authored vessel, and `object-fit: contain` keeps the
  face, head, hands, and feet inside its safe area. Source-image edges must never define the stage.
- The vessel's opaque backing and border render before portrait opacity rises. Result cards follow
  the same frame-before-image sequence.
- Use asymmetric angular velocity, inward particle travel, brief compression, and fast-decaying
  rarity light. Avoid perpetual equal-speed rotation and long full-screen glow.
- Once the face is recognizable, no input-blocking delay is permitted. Skip resolves the current
  receipt immediately; replay resets every animated layer to the breath beat.
- Muted-by-default sound remains an honest hook. The visual timing cannot depend on audio.

### Readability and result-composition contract

- Replace malformed opaque yellow alpha tokens with dark translucent surfaces, ivory primary copy,
  and teal/gold accents that meet readable contrast in the actual dialog.
- Single-result art uses a contained full-body crop inside a visible card; the card exists before
  its portrait is revealed.
- The first ten batch arrivals form exactly two equal rows of five at desktop widths. The bonus is
  the same card size, centered on a third row. Responsive layouts may reflow but must remain
  balanced and preserve source order.
- Every result card and Recent arrival exposes an always-visible `1★`, `2★`, or `3★` badge. Rarity
  color is supplementary: ember-gold for 1★, arc-blue for 2★, astral-violet for 3★.
- `NEW` is keyed to receipt slot, not identity. Opening one duplicate clears only that slot.

### Guarantee state machine

Guarantee progress is evaluated for each arrival in receipt order:

1. Increment progress for the pending slot.
2. If the increment reaches the threshold, resolve that slot as an existing 3★ fixture identity.
3. If the resolved arrival is 3★—natural or guaranteed—reset progress to `0` immediately.
4. Otherwise retain the incremented progress for the next slot.

The batch resolver applies this rule eleven times, including the bonus, and the guarantee display
and Rates panel consume the same live value. This remains browser-session presentation state and
does not establish production odds, prices, thresholds, or grants.

### Acceptance checks for this revision

1. Capture the crossing beat and verify there is no exposed rectangular portrait matte and no hero
   image outside the already-visible vessel.
2. Inspect single-result bounds at desktop and mobile to verify the head and body remain inside the
   card.
3. Measure the first ten batch card rectangles and prove two rows of five; prove the bonus card is
   centered and all eleven star badges are visible.
4. Summon through a natural 3★ and prove live guarantee progress resets to `0 / 30`; then prove the
   next non-3★ advances to `1 / 30`.
5. Open Rates and verify its live guarantee value matches the portal and no rate/direction surface
   uses a high-luminance yellow fill.
6. Re-run gate, constellation, identity-first, skip, replay, and reduced-motion checks after the
   compositing changes.

Status: approved implementation sequence for the current pass; authored before code changes

## Owner-feedback revision — release presentation pass

The review screenshots are evidence of current problems, not a style target. The next slice keeps
Svelte for routing and interaction state, and moves the portal itself to the repository's existing
PixiJS/WebGL renderer. Replacing the application framework would add risk without improving the
GPU animation primitive; the renderer is the useful boundary.

This revision supersedes the visible lab-comparison composition below:

1. Remove owner, fixture, annotation, presentation-receipt, and recommendation furniture from the
   primary portal. Keep one quiet “demo values” disclosure inside Rates because prices, rates, and
   pity remain intentionally non-canonical.
2. Replace the separate result screen with an in-gate arrival state. A single summon and an eleven
   result batch both remain inside the portal surface.
3. Keep a session arrival strip so five sequential singles or an eleven-result batch remain
   clickable. Selecting an arrival opens an in-place hero dossier rather than navigating away.
4. Model dossiers with the accepted four attributes (`Strength`, `Agility`, `Vitality`, `Magic`)
   and the accepted personality dimensions (traits, value, drive, social
   style, stress response, and risk/leadership tendency). Numeric readiness bars are explicitly
   local presentation estimates because the wiki still leaves attribute numeric ranges open.
5. Retain all three reveal directions, replay, skip, muted sound hooks, recognition timing, and the
   reduced-motion-safe path, but place reveal-style controls in the Rates/settings surface instead
   of a player-facing owner experiment panel.
6. Render layered rings, runes, sparks, energy filaments, aperture light, and phase-driven bursts in
   PixiJS. The approved hero anchor remains a DOM portrait above the canvas so identity stays sharp,
   accessible, and constrained to the existing six people.
7. Rework the focused Playwright proof around release-facing behavior: economy disclosure, connected
   costs and balances, all reveal styles, skip/replay/reduced motion, sequential arrivals, batch
   bonus communication, and clickable dossiers with the canonical attribute vocabulary.

## Owner-feedback revision — replay desire and mechanical readability

The supplied screenshots document the current implementation; they do not introduce new product
instructions. This pass keeps the accepted in-gate composition and raises its craft in four areas:

1. Replace the evenly rotating portal with an authored beat curve: distant star intake, rune lock,
   accelerating concentric compression, aperture rupture, silhouette traversal, chromatic identity
   bloom, rarity strike, and a short settling afterglow. Gate, Constellation, and Identity-first keep
   distinct choreography rather than sharing one visual with different labels.
2. Give every browser receipt slot an arrival ID and unread state. New results carry a visible
   `NEW` marker in both the result contact sheet and Recent arrivals; opening a dossier clears only
   that receipt slot, including when several slots reference the same fixed identity.
3. Present canonical attributes in one row or a responsive 2×2 grid in `STR`, `AGI`, `VIT`, `MAG`
   order. Use full names in accessible labels and no Body/Mind grouping.
4. Add code-native elemental affinity icons and aptitude-class icons. Route-local aptitude entries
   are tagged `martial`, `magic`, or `crafting`; no shared catalog or production skill contract is
   changed.
5. Establish a readable rarity palette across the reveal, result cards, Recent arrivals, and
   dossier: 1★ ember-gold, 2★ arc-blue, and 3★ astral-violet. Rarity changes presentation only and
   never portrait quality, body treatment, dignity, or personality.
6. Extend the focused browser proof to verify unread clearing, duplicate-slot independence,
   unified attribute ordering, affinity and aptitude icons, and distinct 1★/2★ rarity treatments.

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
   `Summon ×10 + 1 bonus`. Both initiate a presentation-only receipt. After owner review, their
   route-local session previews visibly move balances and guarantee progress, while never mutating
   ownership, a backend, or durable economy state.
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

| Direction              | Stages                                                 | Face recognizable target | Full mechanics target |
| ---------------------- | ------------------------------------------------------ | -----------------------: | --------------------: |
| Gate ignition          | charge → threshold → silhouette → identity → mechanics |                   1.75 s |                2.55 s |
| Constellation assembly | marks → form → identity → mechanics                    |                   1.55 s |                2.35 s |
| Immediate identity     | identity → parallax settle → mechanics                 |                   0.15 s |                1.15 s |

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
- The batch summon starts the same direction and ends on a visually dense `10 + 1` receipt. Its
  reversible session preview decrements fixture gems and advances fixture guarantee progress so
  the presentation feels connected; reset or reload restores the fixture.
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
- `docs/evidence/living-village-summon-connected-spend.png`

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
