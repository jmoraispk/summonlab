# Living Village Summoning Portal handoff

Status: isolated browser prototype ready for coordinator review

Public direct route: `http://10.110.24.218:4180/living-village-lab/summon`

Implementation branch: `codex/lv-summon-screen`

## Delivered slice

- Release-facing portal composition without owner, fixture, annotation, recommendation, or
  presentation-receipt chrome.
- Svelte route and interaction state with an isolated, dynamically loaded PixiJS/WebGL gate:
  concentric geometry, rune fields, sparks, aperture light, rotating layers, and phase bursts.
- Standard as the active banner, earned and premium balances, visible guarantee movement, rates,
  and costs on both `Summon ×1` and `Summon ×10 + 1 bonus`.
- Gate ignition, constellation assembly, and immediate identity remain selectable under Rates &
  details, with replay, skip, muted-by-default sound hooks, measured identity timing, and a
  reduced-motion path.
- Results resolve inside the gate instead of opening a second presentation screen.
- Five sequential singles and an eleven-result batch remain in a clickable recent-arrivals strip.
  Every result opens an in-place identity dossier.
- Dossiers use the wiki's accepted six attributes—Might, Vitality, Agility, Dexterity, Intellect,
  and Spirit—and keep personality separate as traits, value, drive, social style, stress response,
  and leadership/risk tendency. Aptitudes are presented separately again.
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
- `docs/evidence/living-village-summon-animation-gate.png`
- `docs/evidence/living-village-summon-animation-constellation.png`
- `docs/evidence/living-village-summon-animation-identity.png`
- `docs/evidence/living-village-summon-connected-spend.png`
- `docs/evidence/living-village-summon-single-result.png`
- `docs/evidence/living-village-summon-batch-result.png`

The focused Playwright spec covers banner/rates interaction, visible costs, all three animations,
skip/replay, reduced motion, five sequential arrivals, the `10 + 1` message, connected currency and
guarantee movement, and a clickable dossier with all six canonical attribute names.

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
	guarantee?: { current: number; threshold: number; unit: 'summons' };
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
			heroId: string;
			slot: number;
			isBonus: boolean;
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
	affinity: string;
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
	aptitudes: string[];
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
