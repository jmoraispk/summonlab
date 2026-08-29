# System brief registry

Each brief is the durable handoff for one subsystem owner. It records scope, interfaces, phases,
feedback, and open decisions. Cross-system rules live one directory above and win over local
convenience.

| Brief | Primary owner | Main dependencies |
| --- | --- | --- |
| [Story and tower](story-and-tower.md) | Campaign narrative/content | Expedition, evidence, progression budget |
| [Progression and skills](progression-and-skills.md) | Capability/progression | Character, economy grants, content catalog |
| [Heroes and agency](heroes-and-agency.md) | Cognition/society/presentation | Character, scheduling, policies, evidence |
| [Settlement and expansion](settlement-and-expansion.md) | Base/spatial simulation | Economy, scheduling, capability registry |
| [Expeditions and neighbors](expeditions-and-neighbors.md) | Party/mission/world travel | Character availability, settlement, story |
| [Summoning, synthesis, economy](summoning-synthesis-economy.md) | Acquisition/irreversible exchange | Character, progression, society, ledger |

When a brief grows beyond a reviewable size, split implementation detail into sibling files but keep
the brief as its index and feedback ledger.
