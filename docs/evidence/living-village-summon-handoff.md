# Living Village Summoning Portal handoff

Status: isolated browser prototype ready for coordinator review

Public direct route: `http://10.110.24.218:4180/living-village-lab/summon`

Implementation branch: `codex/lv-summon-screen`

## Delivered slice

- Release-facing portal composition without owner, fixture, annotation, recommendation, or
  presentation-receipt chrome.
- The speculative banner selector is removed. Standard Hearth Gate is the only surface shown;
  Limited and Equipment are not advertised as future economies here.
- Svelte route and interaction state with an isolated, dynamically loaded PixiJS/WebGL gate. The
  default ritual now has an authored beat curve: star intake, sequential rune lock, accelerating
  compression, aperture rupture, energy veil, silhouette traversal, rarity-colored shockwaves,
  identity bloom, and settling afterglow rather than evenly rotating decoration.
- The reveal now obeys a vessel-first compositing contract: the arched identity frame draws before
  portrait pixels are allowed to resolve, silhouettes remain clipped inside it, and contained art
  prevents the source matte, head, hands, or feet from escaping the presentation frame.
- Standard as the active banner, earned and premium balances, visible guarantee movement, rates,
  and costs on both `Summon ×1` and `Summon ×10 + 1 bonus`.
- Guarantee state is evaluated in receipt order. A natural or threshold-forced 3★ resets progress
  to zero immediately, subsequent slots advance the renewed bond, and Rates reads the same live
  value. The portal explicitly acknowledges when a 3★ renewed the guarantee.
- Gate ignition, constellation assembly, and immediate identity remain selectable under Rates &
  details, with replay, skip, muted-by-default sound hooks, measured identity timing, and a
  reduced-motion path.
- Recognition timing remains measurable by the focused test but milliseconds and timing targets
  are no longer player-facing.
- Results resolve inside the gate instead of opening a second presentation screen.
- Result frames now arrive before their portrait layer. Single art is contained rather than
  head-cropped; batch slots are an exact five-by-two company with the same-size bonus centered on a
  third row. All result and Recent-arrival slots carry an always-visible numeric star badge.
- The two spend actions are a side-by-side `Summon ×1` / `Summon ×10` pair with costs inside each
  action and a separate `+1 bonus` marker. Batch performs one selected reveal, then opens the full
  eleven-result company.
- Five sequential singles and an eleven-result batch remain in a clickable recent-arrivals strip.
  Every receipt slot starts with a rarity-colored `NEW` marker, opens an in-place identity dossier,
  and clears independently even when two slots reference the same fixed person.
- Dossiers use the wiki's accepted six attributes—Might, Vitality, Agility, Dexterity, Intellect,
  and Spirit—and split them visually into Body (Might, Vitality, Agility) on the left and Mind
  (Dexterity, Intellect, Spirit) on the right. Personality remains separate as traits, value, drive,
  social style, stress response, and leadership/risk tendency.
- Elemental affinities now have explicit Ember, Tide, Gale, or Grove icons. Aptitudes have icon-led
  route-local Martial, Magical, or Craft & Life classes, using sword, arcane, and hammer marks.
  Body uses a flexed-arm mark and Mind uses a brain. Star presentation is visibly tiered: 1★
  ember-gold, 2★ arc-blue, and 3★ astral-violet.
- The accidental opaque-yellow rate and reveal-option fills were removed. The dialog now uses dark
  opaque surfaces, warm primary type, and brighter secondary copy.
- Only Dara Zev, Mara Vey, Jori Daro, Kira Toren, Iven Orra, and Remy Nahl appear. The browser
  receipt never writes durable hero instances.

## Canon and demo boundary

The attribute names and mechanical territories are established in
`docs/wiki/mechanics/attributes.md`. The personality dimensions and their separation from body,
capability, and worth are established in
`docs/system-architecture/systems/heroes-and-agency.md`.

Exact attribute numeric ranges, prices, rates, guarantee thresholds, and currency grants remain
open. The dossier bars are therefore route-local readiness estimates, and one quiet `Demo values`
line remains in Rates and the purchase column. This is the minimum disclosure needed to avoid
presenting prototype economics as canon.

The Body/Mind grouping and icon mapping are presentation proposals in this route. The wiki
establishes the six-attribute vocabulary and the Martial, Magical, and Craft & Life skill sectors;
it does not assign these route-local aptitude families to the six people as production state.

The wiki preserves all 520 imported draft rows in the immutable legacy inventory and reconciles them
to a 492-skill active target; the Living Village still proposes only a twelve-skill runtime subset.
It explicitly defines aptitudes as innate talent for an attribute, family, or learning mode, distinct
from learned skills. The dossier therefore uses current wiki family vocabulary (`Ranged`, `Body`,
`Shield`, `Elemental`, `Ward`, `Restoration`, and `Knowledge`) rather than invented skill-like labels.
These person-to-family assignments remain route-local; the screen does not claim that a specific hero
owns one of the twelve runtime skills.

## Recommended direction

Use **Gate ignition** as the default. It gives the summon a clear physical event before the face,
then releases control as soon as identity is known. Immediate identity remains the fast setting.
Constellation assembly is useful when the product wants aptitude/affinity symbolism to lead, but it
is less immediately legible as an arrival.

## Useful review actions and decisions

1. Summon five singles, then select different people in Recent arrivals. Decide whether the compact
   rail and in-gate dossier are enough to support the opening “summon three, meet each one” loop.
2. Open Rates & details and replay Gate, Constellation, and Identity first. Use Skip during Gate and
   enable Reduced motion once. Decide which ceremony becomes default and whether the current face
   recognition timings feel premium rather than slow.
3. Run `Summon ×10 + 1 bonus`, select the marked bonus, then compare it with the single action and
   the visibly moved gem/guarantee counters. Decide whether the batch value is unambiguous before
   spend and whether an eleven-person contact sheet is the right final composition.

## Acceptance evidence

- `docs/evidence/living-village-summon-desktop.png`
- `docs/evidence/living-village-summon-mobile.png` (390 × 844)
- `docs/evidence/living-village-summon-mobile-lock.png`
- `docs/evidence/living-village-summon-mobile-silhouette.png`
- `docs/evidence/living-village-summon-mobile-identity.png`
- `docs/evidence/living-village-summon-mobile-result.png`
- `docs/evidence/living-village-summon-animation-gate.png`
- `docs/evidence/living-village-summon-animation-constellation.png`
- `docs/evidence/living-village-summon-animation-identity.png`
- `docs/evidence/living-village-summon-connected-spend.png`
- `docs/evidence/living-village-summon-single-result.png`
- `docs/evidence/living-village-summon-dossier.png`
- `docs/evidence/living-village-summon-batch-result.png`

The focused Playwright spec covers removal of the speculative banner rail, rates interaction and
readable rate surfaces, side-by-side visible-cost actions, absence of player-facing timings, all
three animations, frame-before-portrait ordering, skip/replay, reduced motion including
the result child, five sequential arrivals, natural-3★ reset, the `10 + 1` message, exact `5 / 5 /
1` desktop geometry, eleven visible star badges, connected currency and live guarantee movement,
independent unread clearing for duplicate slots, distinct 1★/2★ presentation, Body/Mind
positioning, the three/three Body/Mind split with Dexterity on Mind, all six canonical attribute
names, elemental affinity icons, canonical aptitude-family labels, all three aptitude-class icons,
and five bounded 390 × 844 animation checkpoints.

## Validation record

| Gate                    | Result                  |
| ----------------------- | ----------------------- |
| Web typecheck           | pass · zero diagnostics |
| Web lint                | pass                    |
| Focused Playwright spec | pass · 2 tests          |
| Production web build    | pass                    |

The build retains the repository's existing large-chunk advisory. PixiJS is dynamically imported
inside the route component; the warning remains repository-wide and is not a route build failure.

## Proposed summon view-model fields

These remain integration proposals only; no shared production contracts were changed.

```ts
type SummonPortalViewModel = {
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
	featuredHero: SummonHeroSummary;
	guarantee?: {
		current: number;
		threshold: number;
		unit: 'summons';
		lastResetReason?: 'natural-three-star' | 'guaranteed-three-star';
	};
	rates: Array<{ outcomeBand: string; probabilityBasisPoints: number }>;
	offers: Array<{
		offerId: string;
		paidCount: number;
		bonusCount: number;
		cost: { currencyId: string; amount: number };
	}>;
	presentation: {
		revealDirection: 'gate' | 'constellation' | 'identity';
		reducedMotion: boolean;
		muted: boolean;
		recognizableIdentityMilliseconds?: number;
	};
	sessionReceipt?: {
		receiptId: string;
		offerId: string;
		outcomes: Array<{
			arrivalId: string;
			heroId: string;
			slot: number;
			isBonus: boolean;
			isUnread: boolean;
			summary: SummonHeroSummary;
		}>;
	};
};

type SummonHeroSummary = {
	heroId: string;
	displayName: string;
	identityLine: string;
	portraitAssetKey: string;
	stars: number;
	calling: string;
	affinity: { label: string; icon: 'ember' | 'tide' | 'gale' | 'grove' };
	attributes: Array<{
		attribute: 'Might' | 'Vitality' | 'Agility' | 'Dexterity' | 'Intellect' | 'Spirit';
		value: number;
		scaleVersion: string;
	}>;
	personality: {
		traits: string[];
		value: string;
		drive: string;
		socialStyle: string;
		stressResponse: string;
		tendency: string;
	};
	aptitudes: Array<{
		name: string;
		class: 'martial' | 'magic' | 'crafting';
	}>;
};
```

Repeated `heroId` values in a presentation receipt must never imply multiple durable
`HeroInstance` records. Acquisition remains an owning-system transaction after a validated receipt.

## Unresolved economy questions

- What are the canonical names and grants for earned summon currency and premium gems?
- What are the accepted single and `10 + 1` prices, and is the bonus always slot eleven?
- Which banner owns guarantee progress, what advances it, and does it carry between versions?
- What are the accepted Standard rates and summonable star bands?
- What does a repeat identity grant when that unique person is already owned?
- With only six unique identities, does a batch substitute typed non-hero rewards, stop early, or
  issue another entitlement?
- Is Equipment a summon banner or a separate acquisition surface?
- How do daily free summons and floor-earned tokens coexist with premium spend?
