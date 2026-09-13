# Overgeared item property vocabulary

Wiki ID: `research.attribute-systems.overgeared.item-properties`

The supplied 44-item property audit found a stable vocabulary even though it could not exhaust the
fan wiki's full inventory.

## Property families

1. Flat values: attack ranges, defense, durability, Health, attributes, resistance, and weight.
2. Percentage modifiers: speed, accuracy, skill power, cooldowns, healing, penetration, and
   specific resistances—including negative modifiers.
3. Conditions: terrain, light, target type/rank, enemy count, hit count, combo timing, repeated
   hits, durability loss, Health thresholds, and wearer identity.
4. Probabilistic effects: blocks, spell/status procs, concealment, and even failure drawbacks.
5. Resource/cooldown gates: Mana per attack, charges, reuse windows, and durability recovery.
6. Granted capabilities: active/passive skills, mastery ranks, and bindable magic slots.
7. Summons, transformations, separable forms, combinations, and item evolution.
8. Requirements: level, attribute, mastery, class, race, profession, title, named user, or item
   choice.
9. Social/economic effects: acquisition, mastery XP, crafting quality, command, emotion, and
   deliberate monster attraction.

## Summonlab use

Conditionals are the strongest source of memorable item identity because the combat engine already
tracks the state they depend on. Durability can become a spendable item resource, not merely a repair
tax. Growth items should unlock qualitatively new behavior, and opposed item pairs create stronger
choices than a single strictly ascending ladder. Requirements can connect equipment to ranked
skills without introducing Dexterity or rigid macro-class exclusions.

Not every property belongs in the initial equipment runtime. Each adopted family needs a typed,
deterministic owner, a stacking rule, and a balance budget before content can use it.

Source: user-supplied `overgeared_item_properties.md`, received 2026-09-12.
