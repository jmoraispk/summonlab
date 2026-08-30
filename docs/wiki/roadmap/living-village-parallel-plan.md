# Living Village four-agent plan

Wiki ID: `roadmap.living-village-parallel-plan`

Design status: **draft for owner review**

The workable team is **one coordinator plus four screen-owning agents**. Each worker delivers a
separate browser route that can be reviewed without waiting for the complete game, while also
carrying the smallest subsystem needed to make that screen meaningful.

The prototype roster remains **Dara Zev, Mara Vey, Jori Daro, Kira Toren, Iven Orra, and Remy
Nahl**. Screen experiments must use these six identities and existing visual anchors; they may not
generate another face.

## The five active threads

| Thread | Testable route | Screen responsibility | Subsystem responsibility |
| --- | --- | --- | --- |
| Coordinator | all reviewed routes | shared shell, final navigation, integration | contracts, fixtures, capability flags, conflict resolution |
| Village agent | `/living-village-lab/village` | Hearth view, zoom/pan, hotspots, summaries | static settlement navigation and camera behavior |
| Roster agent | `/living-village-lab/roster` | roster, hero sheet, equipment, party, training | hero projection and direct progression flow |
| Tower agent | `/living-village-lab/tower` | floors, party confirmation, combat report, return | tower progression and deterministic combat presentation |
| Summon agent | `/living-village-lab/summon` | portal, banners, currencies, rates, reveal animations | summon offer and presentation proposal |

This is deliberately the entire first wave. Monster art, skill art, equipment art, broad mechanics,
and extra QA agents wait until these four screen prototypes reveal what the game actually needs.
Each screen owner must provide desktop and phone evidence plus a small interaction test.

## Worktrees and branches

Use **one worktree and one branch per coding agent**. Four workers changing Svelte routes, tests, and
styles in one checkout will eventually overwrite or entangle each other's work. Worktrees keep
dependencies shared by Git while giving every worker an independent index and branch.

Recommended branches:

- `codex/lv-village-screen`
- `codex/lv-roster-screen`
- `codex/lv-tower-screen`
- `codex/lv-summon-screen`

All four should begin from the same accepted integration commit. The coordinator remains on the
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

## Merge order

1. Review Village zoom and destination clarity.
2. Review Roster/Hero decision density and the three-step training flow.
3. Review Tower result comprehension and the direct return-to-training action.
4. Review portal hierarchy, `10 + 1` communication, and animation preference.
5. The coordinator creates the shared shell only after the four isolated routes are accepted.

No worker needs another worker's code to start. Static, clearly labeled screen fixtures are correct
for this wave. The coordinator reconciles them into shared contracts after product review instead
of forcing premature interfaces onto every branch.

## Ready-to-paste prompts

- [Village screen agent](../../agent-prompts/living-village/01-village-screen.md)
- [Roster and Hero screen agent](../../agent-prompts/living-village/02-roster-screen.md)
- [Tower and combat screen agent](../../agent-prompts/living-village/03-tower-screen.md)
- [Summoning Portal screen agent](../../agent-prompts/living-village/04-summon-screen.md)

The [prompt index](../../agent-prompts/living-village/README.md) contains the worktree workflow and
review order. Accepted screen decisions must return to the owning wiki system or milestone page;
these prompts are assignments, not a second rules authority.
