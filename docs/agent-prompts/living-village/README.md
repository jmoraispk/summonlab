# Living Village screen-agent prompts

These four prompts form the first parallel implementation wave. Keep this coordinating task as the
fifth active thread and open four separate coding tasks—one prompt per task.

## Use worktrees

For each task, select an independent Git worktree based on the latest
`codex/shared-system-architecture` branch. Let Codex create its normal `codex/` branch, or use the
suggested branch from the prompt. Do not run the four coding agents in the same checkout.

The worktree rule is simple:

- one agent, one worktree, one branch, one route;
- agents commit and push their own branch;
- agents never merge to the integration branch;
- the coordinator reviews the direct route and accepts, revises, or rejects it;
- the coordinator integrates accepted commits one at a time.

## Start order

The four tasks can start together because they use route-local fixtures. Review them in this order:

1. [Village screen](01-village-screen.md)
2. [Roster and Hero screen](02-roster-screen.md)
3. [Tower and combat screen](03-tower-screen.md)
4. [Summoning Portal screen](04-summon-screen.md)

## What each agent must return

- a direct local URL;
- desktop and 390×844 screenshots;
- two or three concrete test actions and the decisions they inform;
- typecheck, lint, focused interaction-test, and production-build results;
- a commit hash, pushed branch, and clean worktree;
- unresolved product questions without changing shared contracts or catalogs.

Do not ask these workers to generate additional hero faces. Living Village has exactly six fixed
identities.
