# Town Master Operations and Foundation

Wiki ID: `system.town-master-foundation`

Town Master Operations is the player-facing control and knowledge layer: objectives, policies,
assignments, parties, reports, history, alerts, and later automation. The Foundation is the
non-player-facing technical spine: IDs, events, entropy, versioning, saves, replay, content and
asset catalogs, projections, accessibility, performance, and validation.

These are documented together here because the Living Village intentionally needs very few Master
operations while every active system still depends on the foundation.

## Living Village operations

- summon;
- inspect a hero;
- equip or unequip;
- add or remove a hero from the single party;
- assign one direct training focus;
- select an unlocked floor and deploy;
- inspect combat and reward explanations.

There are no policies, schedules, inbox, hero requests, dialogue, knowledge management, or
automation.

## Living Village foundation

- immutable, versioned content IDs and hashes;
- deterministic entropy and combat receipts;
- one authoritative event commit boundary;
- reservation preventing simultaneous training and deployment;
- save/reload and replayable run snapshots;
- wiki-to-content-to-asset traceability;
- audience-safe presentation projections;
- desktop/phone accessibility and performance gates.

See [Living Village](../milestones/living-village.md) for the minimum contract list.
