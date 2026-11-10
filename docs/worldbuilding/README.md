# Worldbuilding archive

## Scope and status

This index covers the original worldbuilding archive through 2026-11-01 18:06 EST, the Godot additions below, and the 2026-11-09 lore imports listed separately. These documents preserve proposed lore, not implemented game systems. Storage in GitHub does not automatically settle canon. No assets, development checkpoints, or existing lore documents are replaced by this additive batch.

## Previously preserved

- [Keeping and Merewick](keeping-and-merewick.md): structured consolidation, not a verbatim transcript; includes unresolved Mara Venn and Harl name conflicts.
- [The Last Gardens](the-last-gardens.md): full write-up.
- [Halwen House](halwen-house.md): full write-up.
- [Private chapel](halwen-house-private-chapel.md): full write-up.
- [Occupation overview](halwen-house-occupation-factions.md): three factions, before the Grey Lash addition.
- [Garden Hands](garden-hands.md): full faction profile.
- [Gutter Kin](gutter-kin.md): full faction write-up.
- [Gutter Kin members](gutter-kin-members.md): full expanded profiles.

## Remaining conversation material preserved in this batch

- [Roads and towns](blackfen-roads-and-towns.md): structured consolidation.
- [Bell Road locations](bell-road-locations.md): structured consolidation.
- [The third arch](roofed-mile-third-arch.md): full Roofed Mile story.
- [Halwen Remnant](halwen-remnant.md): structured consolidation of expanded faction and five members.
- [Gutter Kin–Remnant web](gutter-remnant-relationship-web.md): consolidated relationships and diagram.
- [Grey Lash](grey-lash.md): consolidated faction and expanded three-member profiles.
- [Grey Lash relationship web](grey-lash-relationship-web.md): consolidated three-way relationships and diagram.
- [Glasshouse Clearing](glasshouse-clearing.md): consolidated evacuation operation.
- [Evacuation complications](glasshouse-clearing-complications.md): consolidated ten complications.
- [Goods interception](remnant-goods-interception.md): consolidated proposed Remnant overreach.
- [Hesh challenges Oren](hesh-challenges-oren.md): full dialogue scene.

## Bestiary (2026-11-04)

- [The Blackfen Bestiary](bestiary.md): proposed. Sixteen entries with measures, biology, senses, habitat, sleep, diet, temperament, signs, and what is known and unknown; revised 2026-11-05 for O1: goblins and orks are beasts (a swarming nest scavenger and a ranked pack with stolen arms), the Ashbound cover the Vault-born beasts and, as a verdict, people who have stopped answering, and the walking blooms are added, keeps the Roofed Mile animal unidentified and what the orks fled unexplained. Sizes match the Godot build's collision numbers.

## Godot additions (2026-11-05)

Copied into the Godot repository with everything above (unchanged, from the browser prototype's commit `7afd805`), then extended to fill the gaps the archive left. All proposed. Start with the canon sheet. **Owner decision O1 (2026-11-05): only humans are people; every creature is an animal, a lizard, a fish or a monster.** The archive above was revised to match the same day: the bestiary's goblins and orks are beasts, the Gutter Kin are a human household of road waifs (every name and scene kept, so the glasshouse clearing is a negotiation between people), and Saint Vey's Fold keeps an ork den, not ork families. The canon sheet lists each revision; the originals are in git history at commit `fd60061`.

- [Canon sheet](CANON.md): the facts both builds and every file share, the precedence rule, open questions (the Gutter-kin background, the name conflicts) and the name register.
- [The Kingdom and the Breaking](the-kingdom-and-the-breaking.md): Orlen before, the five Highland Citadels and slag-iron, the Black Seam and the Breaking, S.0 to S.30 year by year, the Flight South, a timeline, contested histories, survivor voices.
- [The Smothering](the-smothering.md): the ash as lived, the spores and the walking blooms, the six weathers as the Godot build plays them, fire and fuel, food and water, sayings and weather banners.
- [Act I: the Outskirts](act-one-the-outskirts.md): the Godot level location by location (the shelter fire, the Watchhouse, the Spore Hollow, the Old Quarry, the feeding ground, the ork-held choke point and the fallen Causeway tower), with props and hooks.
- [The Godot game's people](godot-people.md): Edda, the eight backgrounds as people, the band that took Edda, future companions, the Watchhouse's named residents.
- [Acts II and III](acts-two-and-three.md): the story built from the archive's places and factions, up the Bell Road to the Citadels and the Vaults; quests, set pieces, endings that save nothing.
- [Items and texts](items-and-texts.md): lore and prices for every item in the game, material culture, new item proposals, and a library of notes, inscriptions, banners and epigraphs ready to place (plain ASCII).

## Quarry and Drowned Measures imports (2026-11-09)

Imported from the browser repository at commit `b46237b50b9aa1244e394b165364ad0ac5c6b5f6` on the review branch `integration/lore-parity`. This is a content-preservation and continuity pass, not a runtime merge. See the [integration report and remaining queue](INTEGRATION_REPORT.md).

| Document | Lore status | Implementation status |
| --- | --- | --- |
| [Rook's Stair: The Held Benches](rooks-stair-quarry-supplement.md) | Proposed; speaking/trading salvagers adapted to humans under O1 | Documentation only; custom d20 rules are not Godot combat |
| [The Silt Readers and the Drowned Measures](silt-readers-and-drowned-measures.md) | Proposed; no new canon approval implied | Documentation only; no basin simulation or faction AI |
| [Drowned Measures playbook](drowned-measures-playbook.md) | Proposed player procedure, Cutwardens, Rootstone Witness, events and quest | Documentation only; no forecast journal, event integration or quest implementation |

The `quarry-recreated/` workshop package remains pending import and validation. Its source README includes speaking goblins and requires O1 reconciliation or clearly segregated archival status. Do not treat a reference to that package in imported source prose as proof it is already present. Existing owner decisions and CANON.md keep precedence; these imports do not approve new species, exact placement, populations or balance.

## Continuity boundaries

Exact map scale, travel distances, population simulations, and quest implementation are unset. The estate occupation is a proposed later phase, not a retroactive claim that all groups were always present. Complications are alternatives or consequences, not a mandatory chain of disasters. Geography and NPC additions remain proposals. Annet and Pell in the Roofed Mile story have no confirmed identity links to similarly named regional characters. The beast in that story is unidentified, not a confirmed bestiary species. The existing Merewick compilation does not preserve every original prose scene word for word. This index does not claim recovery of unrelated project attachments or historical game assets.
