# Item-contract reconciliation findings

Status: source review only. No combined runtime implementation or Godot validation yet.

## Reviewed revisions

- Integration: b24a3fe2de4f4a46fe7d819aa06cdd1e49553b0b
- Main: 9e649bf076f1d081de55a433b696c7fb824bd272
- Common base: d35d506036e2269bd4dc6aa49eed18eeb5caa902

ItemData was compared with both tips and the common base. Inventory and ItemDatabase were compared between the two tips. This is not a complete review of their callers.

## Confirmed incompatibilities

1. Category: integration uses ARMOR at value 6; main uses ARMOUR at value 6 and NOTE at value 7. Do not insert a new distinct armor category and shift NOTE.
2. Slots: integration has ArmorSlot including CLOAK; main has ArmourSlot with HEAD, BODY and LEGS. A spelling change alone cannot preserve cloak behavior.
3. Protection units: integration ItemData documents fractional absorption and registers values such as 0.14 for quilted_gambeson; main Inventory.total_protection uses flat reduction and main registers 5.0 for that same item. These values are not interchangeable.
4. Overlapping IDs: quilted_gambeson and splinted_greaves have different statistics between branches. Do not silently overwrite definitions based on registration order.
5. Integration-only fields include food_value, warmth_value, insulation, armor_sprint_mult and stops_bleeding. Main includes lore, note_text, poise_bonus and bleed_resist. Both sets have dependent behavior to review.
6. Inventory APIs differ: armor/get_armor/armor_pieces versus armour/armour_in/worn_armour. Main also implements protection, poise, bleed resistance, noise and wear helpers; integration includes clear().
7. Registry functions differ: main registers lore and NOTE items, while integration adds food, cloaks, wildlife and other loot functions. roll_crawler_loot and roll_troll_loot differ in content, not just naming.

## Proposed implementation policy

Preserve main's flat-reduction combat contract and NOTE support. Port integration survival fields and cloak behavior deliberately. Adapt callers and registry definitions in one coherent runtime batch; do not apply an ItemData-only replacement or add aliases that conceal incompatible units. New armor items need explicit flat-reduction values rather than an invented fractional-to-flat conversion.

Preserve existing main statistics for overlapping IDs unless a separate balance decision changes them. Retain integration-only food and loot functionality after its dependencies are reconciled. This policy is proposed, not implemented or tested.

## Required follow-up before applying runtime changes

- Inspect player damage, sprint, warmth, noise and equip-timing consumers.
- Inspect inventory UI, survivor backgrounds, save/load and multiplayer serialization if they consume these fields.
- Define one canonical equipment representation, including cloak handling.
- Preserve note registration, lore and reading UI.
- Test equipped-item removal and consumption for dangling references, pack clearing, slot replacement, broken armor, food use and note behavior.
- Run import/compile checks and the reconciled smoke suite on the combined revision.

## Independent ignore-rule reconciliation

The accompanying .gitignore combines both reviewed tip versions' rules. It does not complete a Git merge, resolve the other conflict paths, or validate gameplay.
