# Release roadmap

Wiki ID: `roadmap.index`

The wiki describes the complete intended game. This roadmap decides which documented capabilities
are reachable in each playable release. Scope reduction happens here, not by deleting mechanics,
catalog entries, visual briefs, or future interfaces from their owning pages.

## Availability vocabulary

| State | Meaning for one named release |
| --- | --- |
| `on` | Required and player-reachable; must pass the release acceptance test |
| `off` | Intentionally unreachable; no generation, reward, training, UI, policy, or runtime path may invoke it |
| `placeholder` | Player-reachable through a deliberately reduced implementation behind the final interface |
| `decision` | Not safe to schedule until an owner or dependency resolves the named question |

Availability is different from the wiki catalog's design, implementation, visual, and spoiler
status. For example, Taming can be a detailed design draft with commissioned concept art and
still be `off` in Living Village v1.

## Release matrices

- [Living Village v1](living-village-v1.md) — summon heroes, train them directly, and send one party
  through simplified missions.
- [Living Village parallel production plan](living-village-parallel-plan.md) — split the three
  screens, summon experiments, mechanics, visual production, and QA into collision-safe agent lanes.
- [Website and online wiki](wiki-website.md) — publish the game and living art-book documentation as
  one SvelteKit platform.

## Runtime rule

Every release matrix should compile to or be mirrored by one versioned capability/allowlist
manifest. A disabled skill family may exist in immutable content but must fail closed if a summon,
reward, training assignment, UI action, or policy attempts to make it reachable.

Changing `off` to `on` requires:

1. accepted player-facing rules;
2. a stable content/contract version;
3. required visuals and UI;
4. deterministic success, rejection, and replay evidence;
5. an updated integration acceptance path.

This keeps parallel text and art production useful without allowing it to expand the shipping build
by accident.
