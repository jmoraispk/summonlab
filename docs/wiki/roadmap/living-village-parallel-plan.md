# Living Village three-agent plan

Wiki ID: `roadmap.living-village-parallel-plan`

Design status: **integrated prototype wave**

The workable team is **one coordinator plus three screen-owning agents**. Each worker delivers a
separate browser route that can be reviewed without waiting for the complete game, while also
carrying the smallest subsystem needed to make that screen meaningful.

The prototype roster remains **Dara Zev, Mara Vey, Jori Daro, Kira Toren, Iven Orra, and Remy
Nahl**. Screen experiments must use these six identities and existing visual anchors; they may not
generate another face.

The consolidated comparison surface is `/living-village-lab`. It connects the three independently
testable routes without pretending their fixtures are already one shared save-state implementation.

## The four active threads

| Thread | Testable route | Screen responsibility | Subsystem responsibility |
| --- | --- | --- | --- |
| Coordinator | all reviewed routes | shared shell, final navigation, integration | contracts, fixtures, capability flags, conflict resolution |
| Village + Roster agent | `/living-village-lab/village` | Hearth, heroes, popovers, zoom/pan, orders | primary world surface and hero inspection |
| Tower Hunt agent | `/living-village-lab/tower` | species hunts, party, safety threshold, haul report | repeat combat, XP, material rewards, automatic return |
| Summon agent | `/living-village-lab/summon` | portal, banners, currencies, rates, reveal animations | summon offer and presentation proposal |

This is deliberately the entire first wave. Village and Roster are one surface, not two navigation
destinations. Hero walking and local activity were folded into the Village owner after the separate
activity experiment proved to be an unnecessary boundary. Monster art, skill art, equipment art,
broad mechanics, and extra QA agents wait until these three prototypes reveal what the game
actually needs. Each owner must provide desktop and phone evidence plus a small interaction test.

## Worktrees and branches

Use **one worktree and one branch per coding agent**. Three workers changing Svelte routes, tests, and
styles in one checkout will eventually overwrite or entangle each other's work. Worktrees keep
dependencies shared by Git while giving every worker an independent index and branch.

Recommended branches:

- `codex/lv-village-screen`
- `codex/lv-tower-screen`
- `codex/lv-summon-screen`

All three should begin from the same accepted integration commit. The coordinator remains on the
integration branch, reviews one route at a time, and merges or cherry-picks only accepted commits.
Agents must not merge their own work into the integration branch.

## Collision-safe ownership

Each worker owns only its named route, component folder, route-local fixtures/tests, and evidence
prefix. The coordinator alone owns shared layouts, homepage navigation, production routes, shared
contracts, content catalogs, capability manifests, and wiki catalog entries.

```text
apps/web/src/routes/living-village-lab/<screen>/**
apps/web/src/lib/components/living-village/<screen>/**
docs/evidence/living-village-<screen>-*
```

Existing settlement, mission, summon-card, wiki, and production routes are read-only references.
An agent may propose a shared change in its handoff but may not make it.

## Portal direction

The summon screen should use the supplied reference's information hierarchy, translated into the
Summonlab visual language:

1. visible free and premium currency balances;
2. a compact banner selector;
3. large featured-hero art as the emotional anchor;
4. a transparent pity/progress meter;
5. rates and details within one action;
6. cost printed directly on **Summon ×1** and **Summon ×10 + 1 bonus**;
7. a beautiful, skippable, reduced-motion-safe reveal.

The `10 + 1` offer is accepted as the intended broader summon rule. It is a **non-committing visual
and economy proposal** in the fixed-six Living Village lab until duplicate handling, currency
values, rates, and synthesis are accepted. The agent may replay reveal presentations using only the
six fixed identities, but must label the batch as a simulation and must not create eleven durable
hero instances.

The summon agent compares three presentations against the same test receipt:

- **Gate ignition** — portal energy builds, a silhouette crosses, then identity and mechanics
  resolve;
- **Constellation assembly** — affinity and skill marks form the person before the portrait reveal;
- **Immediate identity** — portrait-first, restrained parallax, then staged mechanical details.

The review should decide one production direction, not ship three permanent animation systems.

## Training and hunting direction

The Village is the persistent home surface. The player selects a visible hero—or finds them through
a compact roster ribbon—and opens a small anchored popover. The popover expands only when equipment
or detailed progression needs more room. Orders should become visible behavior: the selected hero
walks to the Court, Gate, or another named destination and performs an authored activity loop.

Local Court training and Tower hunts have different purposes:

- **Court training** safely targets one attribute or owned skill and is visible in the Village;
- **species hunts** grant level XP, practical skill use, and species materials, but expose the party
  to combat risk.

A hunt order chooses an unlocked species, a party, and a remaining-Health return threshold. After
each resolved encounter, the party returns automatically when any member is at or below that
threshold, the next encounter is unsafe, or another explicit cap is reached. The threshold is not
an invulnerability guarantee: one encounter can cross it. The result must report kills, XP, skill
practice, materials, remaining Health, and the exact return reason.

Materials may be collected and persisted in the prototype before crafting is enabled, but the
player must see their species source and future or current use. The first playable economy should
eventually give at least one selected material an immediate fixed exchange or equipment use rather
than accumulating meaningless inventory.

## Merge order

1. Review the unified Village/Roster, zoom, hero selection, walking, and local activity readability.
2. Review species-hunt setup, safety-threshold clarity, and the material haul report.
3. Review portal hierarchy, `10 + 1` communication, and animation preference.
4. Review all three from `/living-village-lab`, then move only accepted fixture fields into shared
   contracts.

No screen owner needed another owner's code to start. Static, clearly labeled screen fixtures were
correct for this wave. The coordinator has now reconciled navigation while intentionally leaving
shared persistence as a later acceptance step instead of forcing premature interfaces onto every
branch.

## Ready-to-paste prompts

- [Village screen agent](../../agent-prompts/living-village/01-village-screen.md)
- [Tower species-hunt agent](../../agent-prompts/living-village/03-tower-screen.md)
- [Summoning Portal screen agent](../../agent-prompts/living-village/04-summon-screen.md)

The [prompt index](../../agent-prompts/living-village/README.md) contains the worktree workflow and
review order. The older hero-activity prompt is retained there as historical input, but its route is
not part of the integrated prototype. Accepted screen decisions must return to the owning wiki
system or milestone page; these prompts are assignments, not a second rules authority.
