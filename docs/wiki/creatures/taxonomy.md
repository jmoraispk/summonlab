# Creature taxonomy

Wiki ID: `creatures.taxonomy`

“Monster race” is useful conversationally but too ambiguous for mechanics, lore, and image
production. The wiki separates several axes so an artist does not turn a combat job into anatomy and
an implementer does not turn ancestry into behavior.

## Classification axes

| Axis | Question | Examples |
| --- | --- | --- |
| Origin | What kind of existence produced it? | natural, constructed, undead, elemental, summoned, interdimensional |
| Visual/content family | Which creatures share a production grammar? | goblinoids, constructs, beasts, draconic |
| Species | Which physiology and life cycle are shared? | goblin, grey wolf, cave drake |
| People/race | Is there a sapient population with identity/culture? | only when authored; never inferred from combat labels |
| Faction | Which organization or allegiance acts here? | tower warband, bound order, wild pack |
| Duty/archetype | What battlefield or civic job is performed? | skirmisher, archer, guard, healer, builder |
| Variant | Which bounded individual/content variation applies? | regional, evolved, injured, equipped, affinity expression |

A “goblinoid family plate” may contain several species or one people with several duties; the image
alone cannot decide. A “Tower Summoner” is an archetype, not a species. “Undead” is usually an origin
or state, not automatically a people.

## Personhood and hostility

Sapience, personhood, hostility, and faction are separate fields.

- A sapient species is not biologically evil because tower content deploys hostile members.
- A non-sapient predator can be dangerous without moral intent.
- A construct may have no agency, bounded agency, or full personhood depending on its authored
  cognition—not its material.
- Undead status does not answer whether memories, autonomy, or rights remain.
- Encounter content must name the duty, coercion, faction, hunger, territorial behavior, or other
  cause that produces hostility.

This distinction matters mechanically: conversation, surrender, negotiation, morale, capture,
knowledge, social consequences, and synthesis ethics depend on what kind of being is present.

## Mechanical inheritance

Definitions inherit only through explicit references:

```text
origin definition
  + species physiology
  + individual attribute/affinity profile
  + faction knowledge/equipment
  + duty policy and skills
  + encounter-local state
  = deployed actor
```

Family or species may constrain anatomy and typical affinity ranges. It may not assign intelligence,
morality, personality, worth, or combat role without an explicit authored reason. Individual
variation remains possible within content rules.

## Wiki page selection

Create a page when a classification has enough stable content to brief another worker:

- family page: shared visual grammar and production catalog;
- species page: physiology, life cycle, affinity distribution, senses, and variants;
- people/race page: culture, social organization, history, language, internal variation;
- faction page: goals, membership, resources, duties, and relationships;
- archetype page: combat/civic role, policy, tells, skills, counters;
- individual page: unique identity and canonical history.

Until the distinction is known, keep a draft family page and list the taxonomy question explicitly.

## Current family catalogs

The repository currently contains review content for:

- goblinoids, beasts, constructs, and large threats;
- elementals, arachnids, arcane hostiles, undead, draconic creatures, and dungeon predators.

These are visual/content families, not ten automatically accepted biological races. See the
[monster family index](monster-races/README.md) and [visual gallery](../art/monster-gallery.md).

## Open questions

- Which current families contain sapient peoples?
- Are tower populations native, summoned, copied, bound, or constructed per run?
- Can factions contain multiple species and affinities?
- What information reveals personhood or permits noncombat resolution?
